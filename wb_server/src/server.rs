//! The HTTP server: shared state, routes, and startup.

use std::path::Path;
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
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::upload;

/// How long the status check waits on the database before calling it down.
const DB_CHECK_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Clone)]
pub struct AppState {
    pub db: MySqlPool,
    pub db_check_timeout: Duration,
}

/// All routes, mounted under `base_path`: the API at `{base_path}/api/...`, and,
/// when `static_dir` is set, that directory's files at `{base_path}/`.
pub fn router(base_path: &str, static_dir: Option<&Path>, state: AppState) -> Router {
    let api = Router::new()
        .route("/status", get(status))
        .route("/upload", post(upload::upload))
        .layer(middleware::map_response(no_store));
    let mut app = Router::new().nest(&format!("{base_path}/api"), api);
    if let Some(dir) = static_dir {
        app = app
            .nest_service(base_path, ServeDir::new(dir))
            .layer(middleware::from_fn_with_state(base_path.to_owned(), add_trailing_slash));
    }
    app.layer(TraceLayer::new_for_http()).with_state(state)
}

/// API responses are never cacheable, by CloudFront or anyone else.
async fn no_store(mut response: Response) -> Response {
    response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// `/whiteboard` -> `/whiteboard/`, so the page's relative links (css/, js/) resolve.
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
    (code, Json(Status { now, db }))
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
    let state = AppState { db, db_check_timeout: DB_CHECK_TIMEOUT };
    let app = router(&config.base_path, config.static_dir.as_deref(), state);

    let listener = tokio::net::TcpListener::bind(config.listen)
        .await
        .with_context(|| format!("could not listen on {}", config.listen))?;
    tracing::info!("listening on http://{}{}/", config.listen, config.base_path);
    axum::serve(listener, app).with_graceful_shutdown(shutdown_signal()).await?;
    tracing::info!("shut down");
    Ok(())
}

/// Ctrl-C anywhere, or SIGTERM on Unix (what systemd sends on stop).
async fn shutdown_signal() {
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
    }
    tracing::info!("shutting down");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    /// A pool aimed at a port nothing listens on, so every query fails.
    fn unreachable_state() -> AppState {
        let db = MySqlPoolOptions::new()
            .acquire_timeout(Duration::from_millis(300))
            .connect_lazy("mysql://nobody:nothing@127.0.0.1:1/none")
            .unwrap();
        AppState { db, db_check_timeout: Duration::from_millis(300) }
    }

    async fn get(app: Router, uri: &str) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
        let response = app.oneshot(Request::get(uri).body(Body::empty()).unwrap()).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let body = axum::body::to_bytes(response.into_body(), 64 * 1024).await.unwrap();
        (status, headers, body.to_vec())
    }

    #[tokio::test]
    async fn status_reports_a_down_database_as_503() {
        let app = router("/whiteboard", None, unreachable_state());
        let (code, headers, body) = get(app, "/whiteboard/api/status").await;

        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(headers[header::CACHE_CONTROL], "no-store");
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["db"], "error");

        // Like 2026-10-25T18:34:59.123Z: UTC, millisecond precision.
        let now = json["now"].as_str().unwrap();
        assert!(chrono::DateTime::parse_from_rfc3339(now).is_ok(), "{now}");
        assert!(now.ends_with('Z'), "{now}");
        assert_eq!(now.split('.').nth(1).map(str::len), Some(4), "{now}");
    }

    #[tokio::test]
    async fn routes_live_under_base_path() {
        let (code, _, _) = get(router("/whiteboard", None, unreachable_state()), "/api/status").await;
        assert_eq!(code, StatusCode::NOT_FOUND);

        let (code, _, _) = get(router("/elsewhere", None, unreachable_state()), "/elsewhere/api/status").await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn static_dir_is_served_under_base_path() {
        let dir = std::env::temp_dir().join(format!("wb_static_test_{}", std::process::id()));
        std::fs::create_dir_all(dir.join("js")).unwrap();
        std::fs::write(dir.join("index.html"), "<p>board</p>").unwrap();
        std::fs::write(dir.join("js").join("app.js"), "var x;").unwrap();
        let app = router("/whiteboard", Some(&dir), unreachable_state());

        let (code, headers, _) = get(app.clone(), "/whiteboard").await;
        assert_eq!(code, StatusCode::PERMANENT_REDIRECT);
        assert_eq!(headers[header::LOCATION], "/whiteboard/");

        let (code, _, body) = get(app.clone(), "/whiteboard/").await;
        assert_eq!(code, StatusCode::OK);
        assert_eq!(body, b"<p>board</p>");
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
