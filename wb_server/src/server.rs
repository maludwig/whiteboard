//! The HTTP server: shared state, routes, and startup.

use std::time::Duration;

use anyhow::{Context, Result};
use axum::extract::State;
use axum::http::{StatusCode, header};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use sqlx::mysql::{MySqlPool, MySqlPoolOptions};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::config::Config;

/// How long the status check waits on the database before calling it down.
const DB_CHECK_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Clone)]
pub struct AppState {
    pub db: MySqlPool,
    pub db_check_timeout: Duration,
}

/// All routes, mounted under `base_path` (e.g. `/whiteboard/api/status`).
pub fn router(base_path: &str, state: AppState) -> Router {
    let api = Router::new().route("/status", get(status));
    Router::new()
        .nest(&format!("{base_path}/api"), api)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
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
    (code, [(header::CACHE_CONTROL, "no-store")], Json(Status { now, db }))
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
    let app = router(&config.base_path, AppState { db, db_check_timeout: DB_CHECK_TIMEOUT });

    let listener = tokio::net::TcpListener::bind(config.listen)
        .await
        .with_context(|| format!("could not listen on {}", config.listen))?;
    tracing::info!("listening on http://{}{}/api/status", config.listen, config.base_path);
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
        let app = router("/whiteboard", unreachable_state());
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
        let (code, _, _) = get(router("/whiteboard", unreachable_state()), "/api/status").await;
        assert_eq!(code, StatusCode::NOT_FOUND);

        let (code, _, _) = get(router("/elsewhere", unreachable_state()), "/elsewhere/api/status").await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
    }
}
