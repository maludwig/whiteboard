//! `POST {base_path}/api/upload`: the upload.php protocol, so the existing
//! frontend (js/server.js) works unchanged apart from the URL.
//!
//! Requests are form-encoded with an `action`. Success answers
//! `{"since": N, "data": ...}` as PHP did. Failures answer `{"error": "..."}` with
//! a 4xx/5xx status, where PHP gave an empty 200 or an HTML fatal error.

use std::str::FromStr;

use axum::extract::{Form, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::boards::{self, BoardHash, NewFlow};
use crate::server::AppState;

#[derive(Debug, Default, Deserialize)]
pub struct UploadForm {
    action: Option<String>,
    hash: Option<String>,
    client: Option<String>,
    since: Option<String>,
    linedata: Option<String>,
    code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Reply {
    since: i64,
    data: Value,
}

fn reply(since: i64, data: Value) -> Json<Reply> {
    Json(Reply { since, data })
}

/// One element of `linedata`.
#[derive(Debug, Deserialize)]
struct LineIn {
    code: u16,
    flow: Value,
}

pub async fn upload(State(state): State<AppState>, Form(form): Form<UploadForm>) -> Result<Json<Reply>, ApiError> {
    let db = &state.db;
    let action = required(&form.action, "action")?;

    if action == "new" {
        let board = boards::create(db).await?;
        let clientid = boards::next_client(db, &board).await?;
        return Ok(reply(0, json!({ "hash": board.hash.as_str(), "clientid": clientid })));
    }

    let hash = BoardHash::parse(required(&form.hash, "hash")?)
        .ok_or_else(|| ApiError::bad("hash must be 1 to 8 hex digits"))?;
    let board = boards::find(db, hash).await?.ok_or(ApiError::NotFound("no such board"))?;

    if action == "init" {
        let clientid = boards::next_client(db, &board).await?;
        return Ok(reply(0, json!({ "hash": board.hash.as_str(), "clientid": clientid })));
    }

    let client: u8 = number(&form.client, "client")?;
    match action {
        "lines" => {
            let lines: Vec<LineIn> = serde_json::from_str(required(&form.linedata, "linedata")?)
                .map_err(|e| ApiError::bad(format!("linedata: {e}")))?;
            let flows: Vec<NewFlow> = lines
                .into_iter()
                .map(|line| NewFlow { code: line.code, json: line.flow.to_string() })
                .collect();
            boards::add_flows(db, &board, client, &flows).await?;
            Ok(reply(0, json!("")))
        }
        "clear" => Ok(reply(boards::clear(db, &board, client).await?, json!(""))),
        "undo" => {
            boards::undo(db, &board, client, number(&form.code, "code")?).await?;
            Ok(reply(0, json!("")))
        }
        "getlines" => {
            let (since, lines) = boards::lines_since(db, &board, client, number(&form.since, "since")?).await?;
            Ok(reply(since, json!(lines)))
        }
        other => Err(ApiError::bad(format!("unknown action {other:?}"))),
    }
}

fn required<'a>(field: &'a Option<String>, name: &str) -> Result<&'a str, ApiError> {
    field.as_deref().ok_or_else(|| ApiError::bad(format!("missing {name}")))
}

fn number<T: FromStr>(field: &Option<String>, name: &str) -> Result<T, ApiError> {
    required(field, name)?
        .parse()
        .map_err(|_| ApiError::bad(format!("{name} must be a number in range")))
}

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    NotFound(&'static str),
    Internal(anyhow::Error),
}

impl ApiError {
    fn bad(message: impl Into<String>) -> ApiError {
        ApiError::BadRequest(message.into())
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> ApiError {
        ApiError::Internal(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, message) = match self {
            ApiError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            ApiError::NotFound(message) => (StatusCode::NOT_FOUND, message.to_owned()),
            ApiError::Internal(e) => {
                tracing::error!(error = format!("{e:#}"), "upload failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error".to_owned())
            }
        };
        (code, Json(json!({ "error": message }))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use axum::Router;
    use axum::body::Body;
    use axum::http::{Request, header};
    use sqlx::mysql::MySqlPool;
    use tower::ServiceExt;

    use super::*;
    use crate::server::router;

    fn app(pool: MySqlPool) -> Router {
        router("/whiteboard", None, AppState { db: pool, db_check_timeout: Duration::from_secs(2) })
    }

    async fn post(app: &Router, fields: &[(&str, &str)]) -> (StatusCode, Value) {
        let body = fields
            .iter()
            .map(|(k, v)| format!("{}={}", urlencode(k), urlencode(v)))
            .collect::<Vec<_>>()
            .join("&");
        let request = Request::post("/whiteboard/api/upload")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .body(Body::from(body))
            .unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let bytes = axum::body::to_bytes(response.into_body(), 1 << 20).await.unwrap();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    fn urlencode(s: &str) -> String {
        s.bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
                _ => format!("%{b:02X}"),
            })
            .collect()
    }

    /// A new board plus a second client on it: (hash, first client, second client).
    async fn board_with_two_clients(app: &Router) -> (String, String, String) {
        let (_, new) = post(app, &[("action", "new")]).await;
        let hash = new["data"]["hash"].as_str().unwrap().to_owned();
        let (_, init) = post(app, &[("action", "init"), ("hash", &hash)]).await;
        (hash, new["data"]["clientid"].to_string(), init["data"]["clientid"].to_string())
    }

    async fn getlines(app: &Router, hash: &str, client: &str, since: &str) -> (i64, Vec<Value>) {
        let (code, body) = post(app, &[("action", "getlines"), ("hash", hash), ("client", client), ("since", since)]).await;
        assert_eq!(code, StatusCode::OK, "{body}");
        (body["since"].as_i64().unwrap(), body["data"].as_array().unwrap().clone())
    }

    const FLOW: &str = r#"[{"code":1,"flow":{"p":[1,2,3,4],"c":"rgba(30, 119, 185, 1)","t":"pen","w":10}}]"#;

    #[sqlx::test(migrations = "../migrations")]
    async fn new_board_then_init_hands_out_successive_clients(pool: MySqlPool) {
        let app = app(pool);
        let (code, new) = post(&app, &[("action", "new")]).await;
        assert_eq!(code, StatusCode::OK);
        assert_eq!(new["since"], 0);
        let hash = new["data"]["hash"].as_str().unwrap();
        assert_eq!(hash.len(), 2, "first board should get a 2-digit hash: {new}");
        assert_eq!(new["data"]["clientid"], 1);

        let (_, init) = post(&app, &[("action", "init"), ("hash", hash)]).await;
        assert_eq!(init["data"]["hash"], hash);
        assert_eq!(init["data"]["clientid"], 2);
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn hashes_widen_when_short_ones_are_taken(pool: MySqlPool) {
        for b in 0..=255u8 {
            sqlx::query("INSERT INTO boards (hash, shorthash) VALUES (?, ?)")
                .bind(&[b, 0, 0, 0][..])
                .bind(&[b, 0, 0, 0][..])
                .execute(&pool)
                .await
                .unwrap();
        }
        let (_, new) = post(&app(pool), &[("action", "new")]).await;
        // Usually 4; 6 when the random 4-digit prefix ends in "00" (an "xy" board's alias).
        assert!(new["data"]["hash"].as_str().unwrap().len() > 2, "{new}");
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn strokes_reach_other_clients_but_not_their_author(pool: MySqlPool) {
        let app = app(pool);
        let (hash, alice, bob) = board_with_two_clients(&app).await;
        let (code, _) = post(&app, &[("action", "lines"), ("hash", &hash), ("client", &alice), ("linedata", FLOW)]).await;
        assert_eq!(code, StatusCode::OK);

        let (since, lines) = getlines(&app, &hash, &bob, "0").await;
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0]["type"], "flow");
        assert_eq!(lines[0]["client"].to_string(), alice);
        let stroke: Value = serde_json::from_str(lines[0]["data"].as_str().unwrap()).unwrap();
        assert_eq!(stroke["t"], "pen");
        assert!(since > 0);

        let (_, again) = getlines(&app, &hash, &bob, &since.to_string()).await;
        assert!(again.is_empty(), "nothing new since {since}");
        let (_, own) = getlines(&app, &hash, &alice, "0").await;
        assert!(own.is_empty(), "author shouldn't get its own stroke back");
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn client_zero_is_a_real_client(pool: MySqlPool) {
        let app = app(pool.clone());
        let (hash, alice, _) = board_with_two_clients(&app).await;
        sqlx::query("UPDATE boards SET clients = 255").execute(&pool).await.unwrap();
        let (_, init) = post(&app, &[("action", "init"), ("hash", &hash)]).await;
        assert_eq!(init["data"]["clientid"], 0, "should wrap from 255 to 0");

        let (code, _) = post(&app, &[("action", "lines"), ("hash", &hash), ("client", "0"), ("linedata", FLOW)]).await;
        assert_eq!(code, StatusCode::OK);
        let (_, lines) = getlines(&app, &hash, &alice, "0").await;
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0]["client"], 0);
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn undo_by_another_client_reaches_the_owner(pool: MySqlPool) {
        let app = app(pool.clone());
        let (hash, alice, bob) = board_with_two_clients(&app).await;
        post(&app, &[("action", "lines"), ("hash", &hash), ("client", &alice), ("linedata", FLOW)]).await;

        // Bob undoes Alice's stroke: the JS sends the stroke owner's client id.
        let (code, _) = post(&app, &[("action", "undo"), ("hash", &hash), ("client", &alice), ("code", "1")]).await;
        assert_eq!(code, StatusCode::OK);

        let flows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM `lines` WHERE type = 'flow'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(flows, 0, "the stroke should be gone");
        let (_, for_alice) = getlines(&app, &hash, &alice, "0").await;
        assert_eq!(for_alice.len(), 1, "{for_alice:?}");
        assert_eq!(for_alice[0]["type"], "undo");
        assert_eq!(for_alice[0]["code"], 1);
        let (_, for_bob) = getlines(&app, &hash, &bob, "0").await;
        assert_eq!(for_bob.len(), 1);
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn undo_never_deletes_a_clear(pool: MySqlPool) {
        let app = app(pool.clone());
        let (hash, alice, _) = board_with_two_clients(&app).await;
        post(&app, &[("action", "clear"), ("hash", &hash), ("client", &alice)]).await;
        post(&app, &[("action", "undo"), ("hash", &hash), ("client", &alice), ("code", "0")]).await;
        let clears: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM `lines` WHERE type = 'clear'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(clears, 1);
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn clear_wipes_the_board_and_returns_its_row(pool: MySqlPool) {
        let app = app(pool.clone());
        let (hash, alice, bob) = board_with_two_clients(&app).await;
        post(&app, &[("action", "lines"), ("hash", &hash), ("client", &bob), ("linedata", FLOW)]).await;

        let (code, cleared) = post(&app, &[("action", "clear"), ("hash", &hash), ("client", &alice)]).await;
        assert_eq!(code, StatusCode::OK);
        let clear_id: i64 = sqlx::query_scalar("SELECT id FROM `lines` WHERE type = 'clear'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(cleared["since"], clear_id);

        let (_, for_bob) = getlines(&app, &hash, &bob, "0").await;
        assert_eq!(for_bob.len(), 1, "bob's stroke is gone and he sees the clear: {for_bob:?}");
        assert_eq!(for_bob[0]["type"], "clear");
        let (_, for_alice) = getlines(&app, &hash, &alice, "0").await;
        assert!(for_alice.is_empty(), "alice made the clear herself");
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn bad_requests_say_what_is_wrong(pool: MySqlPool) {
        let app = app(pool);
        let (hash, alice, _) = board_with_two_clients(&app).await;
        let cases: &[(&[(&str, &str)], StatusCode, &str)] = &[
            (&[], StatusCode::BAD_REQUEST, "missing action"),
            (&[("action", "init")], StatusCode::BAD_REQUEST, "missing hash"),
            (&[("action", "init"), ("hash", "zz")], StatusCode::BAD_REQUEST, "hex"),
            (&[("action", "init"), ("hash", "abcdef01")], StatusCode::NOT_FOUND, "no such board"),
            (&[("action", "getlines"), ("hash", &hash)], StatusCode::BAD_REQUEST, "missing client"),
            (&[("action", "getlines"), ("hash", &hash), ("client", "256")], StatusCode::BAD_REQUEST, "client"),
            (&[("action", "lines"), ("hash", &hash), ("client", &alice), ("linedata", "{")], StatusCode::BAD_REQUEST, "linedata"),
            (&[("action", "fly"), ("hash", &hash), ("client", &alice)], StatusCode::BAD_REQUEST, "unknown action"),
        ];
        for (fields, want_code, want_text) in cases {
            let (code, body) = post(&app, fields).await;
            assert_eq!(code, *want_code, "{fields:?} -> {body}");
            assert!(body["error"].as_str().unwrap().contains(want_text), "{fields:?} -> {body}");
        }
    }
}
