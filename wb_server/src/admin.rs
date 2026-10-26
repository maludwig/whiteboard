//! `{base_path}/api/admin/...`, guarded by `Authorization: Bearer <admin_token>`.
//! Without an `admin_token` in the config, these routes answer 404.

use axum::Json;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::server::AppState;

/// `POST .../admin/die`: shut down gracefully, finishing in-flight requests.
pub async fn die(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(denied) = authorize(&state, &headers) {
        return denied;
    }
    tracing::warn!("shutdown requested through the admin API");
    state.shutdown.notify_one();
    (StatusCode::ACCEPTED, Json(json!({ "shutting_down": true }))).into_response()
}

/// Plain string equality on the token, for now.
fn authorize(state: &AppState, headers: &HeaderMap) -> Result<(), Response> {
    let Some(expected) = state.admin_token.as_deref() else {
        return Err(StatusCode::NOT_FOUND.into_response());
    };
    let given = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    if given == Some(expected) {
        return Ok(());
    }
    let body = Json(json!({ "error": "missing or wrong bearer token" }));
    Err((StatusCode::UNAUTHORIZED, [(header::WWW_AUTHENTICATE, "Bearer")], body).into_response())
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use axum::Router;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    use super::*;
    use crate::server::{router, test_state};

    async fn die_with(app: &Router, authorization: Option<&str>) -> StatusCode {
        let mut request = Request::post("/whiteboard/api/admin/die");
        if let Some(value) = authorization {
            request = request.header(header::AUTHORIZATION, value);
        }
        app.clone().oneshot(request.body(Body::empty()).unwrap()).await.unwrap().status()
    }

    async fn shutdown_requested(state: &AppState) -> bool {
        tokio::time::timeout(Duration::from_millis(50), state.shutdown.notified()).await.is_ok()
    }

    #[tokio::test]
    async fn without_a_configured_token_the_route_is_absent() {
        let state = test_state(None);
        let app = router("/whiteboard", None, state.clone());
        assert_eq!(die_with(&app, Some("Bearer anything")).await, StatusCode::NOT_FOUND);
        assert!(!shutdown_requested(&state).await);
    }

    #[tokio::test]
    async fn wrong_or_missing_tokens_are_refused() {
        let state = test_state(Some("s3cret"));
        let app = router("/whiteboard", None, state.clone());
        for auth in [None, Some("Bearer nope"), Some("s3cret"), Some("Basic s3cret"), Some("Bearer s3cret ")] {
            assert_eq!(die_with(&app, auth).await, StatusCode::UNAUTHORIZED, "{auth:?}");
        }
        assert!(!shutdown_requested(&state).await);
    }

    #[tokio::test]
    async fn the_right_token_requests_shutdown() {
        let state = test_state(Some("s3cret"));
        let app = router("/whiteboard", None, state.clone());
        assert_eq!(die_with(&app, Some("Bearer s3cret")).await, StatusCode::ACCEPTED);
        assert!(shutdown_requested(&state).await);
    }
}
