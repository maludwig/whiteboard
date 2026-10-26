//! The HTTP server: shared state, routes, and startup.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use axum::extract::{Request, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Redirect, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use sqlx::mysql::{MySqlPool, MySqlPoolOptions};
use tokio::sync::{Notify, watch};
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::signals::BoardSignals;
use crate::{admin, clientlog, upload, ws};

/// How long the status check waits on the database before calling it down.
const DB_CHECK_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Clone)]
pub struct AppState {
    pub db: MySqlPool,
    pub db_check_timeout: Duration,
    pub admin_token: Option<String>,
    /// Notified to shut the server down gracefully (see `admin::die`).
    pub shutdown: Arc<Notify>,
    /// Set to true once shutdown begins, so WebSockets close instead of
    /// holding the server open.
    pub closing: Arc<watch::Sender<bool>>,
    pub stream_logs: bool,
    pub signals: BoardSignals,
    pub heartbeat: Heartbeat,
}

/// WebSocket keepalive: ping every `every`; close if nothing comes back within `timeout`.
#[derive(Clone, Copy, Debug)]
pub struct Heartbeat {
    pub every: Duration,
    pub timeout: Duration,
}

impl Default for Heartbeat {
    fn default() -> Heartbeat {
        Heartbeat { every: Duration::from_secs(20), timeout: Duration::from_secs(10) }
    }
}

/// All routes, mounted under `base_path`: the API at `{base_path}/api/...`, the
/// WebSocket at `{base_path}/ws`, and, when `static_dir` is set, that
/// directory's files at `{base_path}/`.
pub fn router(base_path: &str, static_dir: Option<&Path>, state: AppState) -> Router {
    let api = Router::new()
        .route("/status", get(status))
        .route("/upload", post(upload::upload))
        .route("/admin/die", post(admin::die))
        .route("/client-config", get(clientlog::client_config))
        .route("/log", post(clientlog::log))
        .layer(middleware::map_response(no_store));
    let mut app = Router::new()
        .nest(&format!("{base_path}/api"), api)
        .route(&format!("{base_path}/ws"), get(ws::upgrade));
    if let Some(dir) = static_dir {
        app = app
            .nest_service(base_path, ServeDir::new(dir))
            .layer(middleware::map_response(revalidate))
            .layer(middleware::map_response(isolate))
            .layer(middleware::from_fn_with_state(base_path.to_owned(), add_trailing_slash));
    }
    app.layer(TraceLayer::new_for_http()).with_state(state)
}

/// API responses are never cacheable, by CloudFront or anyone else.
async fn no_store(mut response: Response) -> Response {
    response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// Static files may be cached but must be revalidated, so an edited file is
/// picked up on the next load. Responses that set their own policy keep it.
async fn revalidate(mut response: Response) -> Response {
    let headers = response.headers_mut();
    if !headers.contains_key(header::CACHE_CONTROL) {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    }
    response
}

/// Makes served pages cross-origin isolated, which gets them a finer
/// performance.now() for timing. Safe while the frontend loads nothing from
/// other origins (the single-file wb_web build doesn't).
async fn isolate(mut response: Response) -> Response {
    let headers = response.headers_mut();
    headers.insert("cross-origin-opener-policy", HeaderValue::from_static("same-origin"));
    headers.insert("cross-origin-embedder-policy", HeaderValue::from_static("require-corp"));
    response
}

/// `/whiteboard` -> `/whiteboard/`, so the page's relative URLs (api/, ws) resolve.
async fn add_trailing_slash(State(base_path): State<String>, request: Request, next: Next) -> Response {
    if request.uri().path() == base_path {
        return Redirect::permanent(&format!("{base_path}/")).into_response();
    }
    next.run(request).await
}

#[derive(Serialize)]
struct Status {
    now: String,
    db: &'static str,
    version: &'static str,
    built: String,
}

/// When this binary was compiled (stamped by build.rs).
fn build_time() -> String {
    let secs: i64 = env!("WB_BUILD_UNIX_TIME").parse().unwrap_or(0);
    chrono::DateTime::from_timestamp(secs, 0)
        .map_or_else(String::new, |t| t.to_rfc3339_opts(SecondsFormat::Secs, true))
}

/// Liveness plus a database round trip. Answers 503 when the database is
/// unreachable, so monitors can tell without parsing the body.
async fn status(State(state): State<AppState>) -> impl IntoResponse {
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let check = tokio::time::timeout(state.db_check_timeout, sqlx::query("SELECT 1").execute(&state.db)).await;
    let (code, db) = match check {
        Ok(Ok(_)) => (StatusCode::OK, "ok"),
        Ok(Err(e)) => {
            tracing::warn!(error = %e, "status: database check failed");
            (StatusCode::SERVICE_UNAVAILABLE, "error")
        }
        Err(_) => {
            tracing::warn!(timeout = ?state.db_check_timeout, "status: database check timed out");
            (StatusCode::SERVICE_UNAVAILABLE, "error")
        }
    };
    (code, Json(Status { now, db, version: env!("CARGO_PKG_VERSION"), built: build_time() }))
}

pub async fn serve(config: Config) -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_new(&config.log).context("invalid log filter in config")?)
        .init();

    // Lazy, so the server comes up (and /status reports the problem) even
    // while the database is down.
    let db = MySqlPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(DB_CHECK_TIMEOUT)
        .connect_lazy(&config.database_url)
        .context("database_url is not a valid MySQL URL")?;
    if let Some(dir) = &config.static_dir {
        if !dir.is_dir() {
            bail!("static_dir {} is not a directory", dir.display());
        }
        tracing::info!("serving files from {} at {}/", dir.display(), config.base_path);
    }
    if config.admin_token.is_some() {
        tracing::info!("admin API enabled at {}/api/admin/", config.base_path);
    }
    let shutdown = Arc::new(Notify::new());
    let closing = Arc::new(watch::Sender::new(false));
    let state = AppState {
        db,
        db_check_timeout: DB_CHECK_TIMEOUT,
        admin_token: config.admin_token.clone(),
        shutdown: shutdown.clone(),
        closing: closing.clone(),
        stream_logs: config.stream_logs,
        signals: BoardSignals::default(),
        heartbeat: Heartbeat::default(),
    };
    if config.stream_logs {
        tracing::info!("streaming frontend logs into this log (target \"client\")");
    }
    let app = router(&config.base_path, config.static_dir.as_deref(), state);

    let listener = tokio::net::TcpListener::bind(config.listen)
        .await
        .with_context(|| format!("could not listen on {}", config.listen))?;
    tracing::info!("listening on http://{}{}/", config.listen, config.base_path);
    axum::serve(listener, app).with_graceful_shutdown(shutdown_signal(shutdown, closing)).await?;
    tracing::info!("shut down");
    Ok(())
}

/// Ctrl-C anywhere, SIGTERM on Unix (what systemd sends on stop), or the admin
/// API. Then tells open WebSockets to close.
async fn shutdown_signal(requested: Arc<Notify>, closing: Arc<watch::Sender<bool>>) {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{SignalKind, signal};
        match signal(SignalKind::terminate()) {
            Ok(mut sigterm) => {
                sigterm.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
        _ = requested.notified() => {}
    }
    tracing::info!("shutting down");
    closing.send_replace(true);
}

/// State for router tests: a pool aimed at a port nothing listens on, so every
/// query fails. Swap in a real pool with `AppState { db, ..test_state(None) }`.
#[cfg(test)]
pub fn test_state(admin_token: Option<&str>) -> AppState {
    let db = MySqlPoolOptions::new()
        .acquire_timeout(Duration::from_millis(300))
        .connect_lazy("mysql://nobody:nothing@127.0.0.1:1/none")
        .unwrap();
    AppState {
        db,
        db_check_timeout: Duration::from_millis(300),
        admin_token: admin_token.map(str::to_owned),
        shutdown: Arc::new(Notify::new()),
        closing: Arc::new(watch::Sender::new(false)),
        stream_logs: false,
        signals: BoardSignals::default(),
        heartbeat: Heartbeat::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    async fn get(app: Router, uri: &str) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
        let response = app.oneshot(Request::get(uri).body(Body::empty()).unwrap()).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let body = axum::body::to_bytes(response.into_body(), 64 * 1024).await.unwrap();
        (status, headers, body.to_vec())
    }

    #[tokio::test]
    async fn status_reports_a_down_database_as_503() {
        let app = router("/whiteboard", None, test_state(None));
        let (code, headers, body) = get(app, "/whiteboard/api/status").await;

        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(headers[header::CACHE_CONTROL], "no-store");
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["db"], "error");
        assert_eq!(json["version"], env!("CARGO_PKG_VERSION"));
        assert!(json["built"].as_str().unwrap().ends_with('Z'), "{json}");

        // Like 2026-10-25T18:34:59.123Z: UTC, millisecond precision.
        let now = json["now"].as_str().unwrap();
        assert!(chrono::DateTime::parse_from_rfc3339(now).is_ok(), "{now}");
        assert!(now.ends_with('Z'), "{now}");
        assert_eq!(now.split('.').nth(1).map(str::len), Some(4), "{now}");
    }

    #[tokio::test]
    async fn routes_live_under_base_path() {
        let (code, _, _) = get(router("/whiteboard", None, test_state(None)), "/api/status").await;
        assert_eq!(code, StatusCode::NOT_FOUND);

        let (code, _, _) = get(router("/elsewhere", None, test_state(None)), "/elsewhere/api/status").await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn static_dir_is_served_under_base_path() {
        let dir = std::env::temp_dir().join(format!("wb_static_test_{}", std::process::id()));
        std::fs::create_dir_all(dir.join("js")).unwrap();
        std::fs::write(dir.join("index.html"), "<p>board</p>").unwrap();
        std::fs::write(dir.join("js").join("app.js"), "var x;").unwrap();
        let app = router("/whiteboard", Some(&dir), test_state(None));

        let (code, headers, _) = get(app.clone(), "/whiteboard").await;
        assert_eq!(code, StatusCode::PERMANENT_REDIRECT);
        assert_eq!(headers[header::LOCATION], "/whiteboard/");

        let (code, headers, body) = get(app.clone(), "/whiteboard/").await;
        assert_eq!(code, StatusCode::OK);
        assert_eq!(body, b"<p>board</p>");
        assert_eq!(headers[header::CACHE_CONTROL], "no-cache");
        assert_eq!(headers["cross-origin-opener-policy"], "same-origin");
        assert_eq!(headers["cross-origin-embedder-policy"], "require-corp");
        let (code, _, body) = get(app.clone(), "/whiteboard/js/app.js").await;
        assert_eq!(code, StatusCode::OK);
        assert_eq!(body, b"var x;");
        let (code, _, _) = get(app.clone(), "/whiteboard/missing.js").await;
        assert_eq!(code, StatusCode::NOT_FOUND);

        // The API still wins over the static files.
        let (code, _, _) = get(app, "/whiteboard/api/status").await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        std::fs::remove_dir_all(&dir).ok();
    }
}
