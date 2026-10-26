//! Frontend log lines streamed into the server's log, when `stream_logs` is on.
//!
//! `GET {base_path}/api/client-config` tells the page whether to send them;
//! `POST {base_path}/api/log` receives them and logs each at info level under
//! target `client`. With `stream_logs` off, the log route answers 404.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::json;

use crate::server::AppState;

/// Anyone who can load the page can post here, so keep each batch small.
const MAX_LINES: usize = 100;
const MAX_LINE_CHARS: usize = 500;

pub async fn client_config(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "stream_logs": state.stream_logs }))
}

#[derive(Debug, Deserialize)]
pub struct Batch {
    hash: Option<String>,
    client: Option<serde_json::Value>,
    lines: Vec<Line>,
}

#[derive(Debug, Deserialize)]
pub struct Line {
    /// The browser's clock, ISO 8601.
    at: String,
    /// Milliseconds since the page started loading.
    page_ms: f64,
    msg: String,
}

pub async fn log(State(state): State<AppState>, Json(batch): Json<Batch>) -> Response {
    if !state.stream_logs {
        return StatusCode::NOT_FOUND.into_response();
    }
    if batch.lines.len() > MAX_LINES {
        return (StatusCode::PAYLOAD_TOO_LARGE, Json(json!({ "error": format!("at most {MAX_LINES} lines") })))
            .into_response();
    }
    let hash = batch.hash.as_deref().unwrap_or("-");
    let client = batch.client.map_or_else(|| "-".to_owned(), |c| c.to_string());
    for line in &batch.lines {
        let msg: String = line.msg.chars().take(MAX_LINE_CHARS).collect();
        let at: String = line.at.chars().take(40).collect();
        tracing::info!(target: "client", hash, client, at, page_ms = line.page_ms.round(), "{msg}");
    }
    StatusCode::NO_CONTENT.into_response()
}

#[cfg(test)]
mod tests {
    use axum::Router;
    use axum::body::Body;
    use axum::http::{Request, header};
    use tower::ServiceExt;

    use super::*;
    use crate::server::{router, test_state};

    fn app(stream_logs: bool) -> Router {
        router("/whiteboard", None, AppState { stream_logs, ..test_state(None) })
    }

    async fn post_log(app: &Router, body: &str) -> StatusCode {
        let request = Request::post("/whiteboard/api/log")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_owned()))
            .unwrap();
        app.clone().oneshot(request).await.unwrap().status()
    }

    async fn client_config_of(app: &Router) -> serde_json::Value {
        let request = Request::get("/whiteboard/api/client-config").body(Body::empty()).unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        let bytes = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        serde_json::from_slice(&bytes).unwrap()
    }

    const ONE_LINE: &str = r#"{"hash":"ab","client":1,"lines":[{"at":"2026-10-25T21:00:00.000Z","page_ms":12.5,"msg":"hi"}]}"#;

    #[tokio::test]
    async fn off_by_default_and_then_the_log_route_is_absent() {
        let app = app(false);
        assert_eq!(client_config_of(&app).await["stream_logs"], false);
        assert_eq!(post_log(&app, ONE_LINE).await, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn when_on_lines_are_accepted() {
        let app = app(true);
        assert_eq!(client_config_of(&app).await["stream_logs"], true);
        assert_eq!(post_log(&app, ONE_LINE).await, StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn oversized_batches_are_refused() {
        let line = r#"{"at":"x","page_ms":0,"msg":"spam"}"#;
        let lines = vec![line; MAX_LINES + 1].join(",");
        let body = format!(r#"{{"lines":[{lines}]}}"#);
        assert_eq!(post_log(&app(true), &body).await, StatusCode::PAYLOAD_TOO_LARGE);
    }
}
