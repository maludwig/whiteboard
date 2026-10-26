//! `GET {base_path}/ws`: the upload protocol over a WebSocket, plus pushes.
//!
//! Every message is a JSON object with an `action`: the same actions and fields
//! as `/api/upload`, but as JSON rather than form fields (so `linedata` is an
//! array, not a string of JSON). A request may carry an `id`, which its reply
//! echoes: `{"id", "since", "data"}`, or `{"id", "error"}`.
//!
//! The connection remembers its board, client and `since`, so after `new` or
//! `init`, requests leave out `hash` and `client` (except undo's `client`, the
//! stroke's owner, which defaults to this client). `init` may name a `client`
//! to rejoin as, after a reconnect; without one it hands out a new client id.
//! Writes are idempotent, as over HTTP, so one that got no reply can be sent
//! again either way; `clear` takes a `code` so its resends are recognised.
//!
//! `getlines` keeps answering: after its reply, whenever the board changes the
//! server sends the new rows as `{"since", "data"}`, with no `id`. `getlines`
//! with a `since` restarts from there.
//!
//! Heartbeat: the server sends `{"action":"ping"}` every 20s and closes the
//! socket if nothing at all arrives within 10s of one. Clients answer
//! `{"action":"pong"}`, and may send pings of their own.

use anyhow::Result;
use axum::extract::State;
use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade, close_code};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use tokio::time::{Instant, MissedTickBehavior};

use crate::boards::{self, Board, BoardHash};
use crate::server::{AppState, Heartbeat};
use crate::signals::Changes;
use crate::upload::{ApiError, LineIn, to_flows};

pub async fn upgrade(State(state): State<AppState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(move |socket| Connection { state, socket, session: None }.run())
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
enum Request {
    New,
    Init { hash: String, client: Option<u32> },
    Lines { linedata: Vec<LineIn> },
    /// `code` names the clear, so a resend of it is recognised (see `boards::clear`).
    Clear { code: Option<u16> },
    Undo { code: u16, client: Option<u32> },
    Getlines { since: Option<i64> },
    Ping,
    Pong,
}

impl Request {
    fn action(&self) -> &'static str {
        match self {
            Request::New => "new",
            Request::Init { .. } => "init",
            Request::Lines { .. } => "lines",
            Request::Clear { .. } => "clear",
            Request::Undo { .. } => "undo",
            Request::Getlines { .. } => "getlines",
            Request::Ping => "ping",
            Request::Pong => "pong",
        }
    }
}

enum Outcome {
    Reply { since: i64, data: Value },
    Pong,
    Nothing,
}

fn done(since: i64) -> Outcome {
    Outcome::Reply { since, data: json!("") }
}

/// The board this connection joined, and how far it has read.
struct Session {
    board: Board,
    client: u32,
    since: i64,
    changes: Changes,
    /// Set by the first `getlines`: from then on, changes are pushed.
    watching: bool,
}

struct Connection {
    state: AppState,
    socket: WebSocket,
    session: Option<Session>,
}

impl Connection {
    async fn run(mut self) {
        let Heartbeat { every, timeout } = self.state.heartbeat;
        let mut ping = tokio::time::interval_at(Instant::now() + every, every);
        ping.set_missed_tick_behavior(MissedTickBehavior::Delay);
        // When an unanswered ping gives up; anything at all from the client clears it.
        let mut deadline: Option<Instant> = None;
        let mut closing = self.state.closing.subscribe();

        let why = loop {
            tokio::select! {
                incoming = self.socket.recv() => {
                    let Some(Ok(message)) = incoming else { break "connection lost" };
                    deadline = None;
                    let sent = match message {
                        Message::Text(text) => self.handle(text.as_str()).await,
                        Message::Binary(_) => self.send(&json!({ "error": "messages must be JSON text" })).await,
                        Message::Close(_) => break "closed by the client",
                        Message::Ping(_) | Message::Pong(_) => Ok(()),
                    };
                    if sent.is_err() {
                        break "send failed";
                    }
                }
                () = next_change(&mut self.session) => {
                    if self.push().await.is_err() {
                        break "send failed";
                    }
                }
                _ = ping.tick() => {
                    if self.send(&json!({ "action": "ping" })).await.is_err() {
                        break "send failed";
                    }
                    deadline.get_or_insert(Instant::now() + timeout);
                }
                () = until(deadline) => {
                    self.close(close_code::NORMAL, "no reply to ping").await;
                    break "no reply to ping";
                }
                _ = closing.changed() => {
                    self.close(close_code::AWAY, "server shutting down").await;
                    break "server shutting down";
                }
            }
        };
        let board = self.session.as_ref().map(|s| s.board.hash.as_str());
        let client = self.session.as_ref().map(|s| s.client);
        tracing::info!(why, board, client, "websocket closed");
    }

    /// One message from the client: answer it, or say what was wrong with it.
    async fn handle(&mut self, text: &str) -> Result<()> {
        let value: Value = match serde_json::from_str(text) {
            Ok(value) => value,
            Err(e) => return self.send(&json!({ "error": format!("not JSON: {e}") })).await,
        };
        let id = value.get("id").cloned();
        let outcome = match serde_json::from_value::<Request>(value) {
            Ok(request) => {
                tracing::debug!(action = request.action(), "websocket request");
                self.answer(request).await
            }
            Err(e) => Err(ApiError::bad(e.to_string())),
        };
        match outcome {
            Ok(Outcome::Reply { since, data }) => self.send(&with_id(id, json!({ "since": since, "data": data }))).await,
            Ok(Outcome::Pong) => self.send(&json!({ "action": "pong" })).await,
            Ok(Outcome::Nothing) => Ok(()),
            Err(e) => {
                let (_, message) = e.status_and_message();
                self.send(&with_id(id, json!({ "error": message }))).await
            }
        }
    }

    async fn answer(&mut self, request: Request) -> Result<Outcome, ApiError> {
        let db = &self.state.db;
        match request {
            Request::New => {
                let board = boards::create(db).await?;
                Ok(self.join(board, boards::new_client()))
            }
            Request::Init { hash, client } => {
                let hash = BoardHash::parse(&hash).ok_or_else(|| ApiError::bad("hash must be 1 to 8 hex digits"))?;
                let board = boards::find(db, hash).await?.ok_or(ApiError::NotFound("no such board"))?;
                Ok(self.join(board, client.unwrap_or_else(boards::new_client)))
            }
            Request::Lines { linedata } => {
                let s = joined(&mut self.session)?;
                boards::add_flows(db, &s.board, s.client, &to_flows(linedata)).await?;
                self.state.signals.notify(s.board.id);
                Ok(done(0))
            }
            Request::Clear { code } => {
                let s = joined(&mut self.session)?;
                let id = boards::clear(db, &s.board, s.client, code).await?;
                self.state.signals.notify(s.board.id);
                Ok(done(id))
            }
            Request::Undo { code, client } => {
                let s = joined(&mut self.session)?;
                boards::undo(db, &s.board, client.unwrap_or(s.client), code).await?;
                self.state.signals.notify(s.board.id);
                Ok(done(0))
            }
            Request::Getlines { since } => {
                let s = joined(&mut self.session)?;
                if let Some(since) = since {
                    s.since = since;
                }
                // Before reading, so a write landing during the read still wakes us.
                s.changes.mark_seen();
                let (since, lines) = boards::lines_since(db, &s.board, s.client, s.since).await?;
                s.since = since;
                s.watching = true;
                Ok(Outcome::Reply { since, data: json!(lines) })
            }
            Request::Ping => Ok(Outcome::Pong),
            Request::Pong => Ok(Outcome::Nothing),
        }
    }

    fn join(&mut self, board: Board, client: u32) -> Outcome {
        tracing::info!(board = board.hash.as_str(), client, "websocket joined");
        let data = json!({ "hash": board.hash.as_str(), "clientid": client });
        let changes = self.state.signals.subscribe(board.id);
        self.session = Some(Session { board, client, since: 0, changes, watching: false });
        Outcome::Reply { since: 0, data }
    }

    /// The board changed: send whatever is new for this client, if anything.
    async fn push(&mut self) -> Result<()> {
        let Some(s) = self.session.as_mut() else { return Ok(()) };
        match boards::lines_since(&self.state.db, &s.board, s.client, s.since).await {
            Ok((since, lines)) => {
                s.since = since;
                if lines.is_empty() {
                    return Ok(());
                }
                send(&mut self.socket, &json!({ "since": since, "data": lines })).await
            }
            Err(e) => {
                // The rows stay in the database; the next change fetches them.
                tracing::warn!(error = format!("{e:#}"), "websocket push failed");
                Ok(())
            }
        }
    }

    async fn send(&mut self, value: &Value) -> Result<()> {
        send(&mut self.socket, value).await
    }

    async fn close(&mut self, code: u16, reason: &'static str) {
        let frame = CloseFrame { code, reason: reason.into() };
        self.socket.send(Message::Close(Some(frame))).await.ok();
    }
}

fn joined(session: &mut Option<Session>) -> Result<&mut Session, ApiError> {
    session.as_mut().ok_or_else(|| ApiError::bad("not on a board: send new or init first"))
}

async fn send(socket: &mut WebSocket, value: &Value) -> Result<()> {
    socket.send(Message::Text(value.to_string().into())).await?;
    Ok(())
}

/// `body` with the request's `id` first, when it had one.
fn with_id(id: Option<Value>, body: Value) -> Value {
    let mut out = Map::new();
    if let Some(id) = id {
        out.insert("id".to_owned(), id);
    }
    if let Value::Object(fields) = body {
        out.extend(fields);
    }
    Value::Object(out)
}

async fn next_change(session: &mut Option<Session>) {
    match session {
        Some(s) if s.watching => s.changes.changed().await,
        _ => std::future::pending().await,
    }
}

async fn until(deadline: Option<Instant>) {
    match deadline {
        Some(deadline) => tokio::time::sleep_until(deadline).await,
        None => std::future::pending().await,
    }
}

#[cfg(test)]
mod tests {
    use std::net::SocketAddr;
    use std::time::Duration;

    use futures_util::{SinkExt, StreamExt};
    use sqlx::mysql::MySqlPool;
    use tokio_tungstenite::tungstenite::Message as WsMessage;
    use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;

    use super::*;
    use crate::server::{router, test_state};

    type Client = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

    async fn serve(state: AppState) -> SocketAddr {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let app = router("/whiteboard", None, state);
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        addr
    }

    async fn connect(addr: SocketAddr) -> Client {
        tokio_tungstenite::connect_async(format!("ws://{addr}/whiteboard/ws")).await.unwrap().0
    }

    async fn send(ws: &mut Client, value: Value) {
        ws.send(WsMessage::Text(value.to_string().into())).await.unwrap();
    }

    /// The next frame, or None if the socket ended; panics after `wait`.
    async fn next_frame(ws: &mut Client, wait: Duration) -> Option<WsMessage> {
        let frame = tokio::time::timeout(wait, ws.next()).await.expect("timed out waiting for the server");
        frame.map(Result::unwrap)
    }

    /// The next JSON message other than a ping.
    async fn recv(ws: &mut Client) -> Value {
        loop {
            match next_frame(ws, Duration::from_secs(2)).await {
                Some(WsMessage::Text(text)) => {
                    let value: Value = serde_json::from_str(text.as_str()).unwrap();
                    if value["action"] != "ping" {
                        return value;
                    }
                }
                other => panic!("expected a JSON message, got {other:?}"),
            }
        }
    }

    async fn request(ws: &mut Client, value: Value) -> Value {
        send(ws, value).await;
        recv(ws).await
    }

    /// Nothing but pings arrives for a little while.
    async fn quiet(ws: &mut Client) {
        let deadline = tokio::time::Instant::now() + Duration::from_millis(200);
        while let Ok(frame) = tokio::time::timeout_at(deadline, ws.next()).await {
            match frame {
                Some(Ok(WsMessage::Text(text))) if text.as_str().contains(r#""ping""#) => {}
                other => panic!("expected nothing, got {other:?}"),
            }
        }
    }

    fn flow(code: u16) -> Value {
        json!([{ "code": code, "flow": { "p": [1, 2, 3, 4], "c": "#1e77b9", "t": "pen", "w": 10 } }])
    }

    /// Alice on a new board and Bob joined to it, both watching.
    struct Pair {
        alice: Client,
        bob: Client,
        hash: String,
        alice_id: Value,
        bob_id: Value,
    }

    async fn alice_and_bob(addr: SocketAddr) -> Pair {
        let mut alice = connect(addr).await;
        let new = request(&mut alice, json!({ "id": 1, "action": "new" })).await;
        assert_eq!(new["id"], 1, "{new}");
        let hash = new["data"]["hash"].as_str().unwrap().to_owned();

        let mut bob = connect(addr).await;
        let init = request(&mut bob, json!({ "id": "b", "action": "init", "hash": hash })).await;
        assert_eq!(init["id"], "b", "{init}");
        let (alice_id, bob_id) = (new["data"]["clientid"].clone(), init["data"]["clientid"].clone());
        assert!(alice_id.is_u64() && bob_id.is_u64() && alice_id != bob_id, "{new} {init}");

        for ws in [&mut alice, &mut bob] {
            let lines = request(ws, json!({ "id": 2, "action": "getlines" })).await;
            assert_eq!(lines["data"], json!([]), "{lines}");
        }
        Pair { alice, bob, hash, alice_id, bob_id }
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn strokes_and_undos_are_pushed_to_watchers(pool: MySqlPool) {
        let addr = serve(AppState { db: pool, ..test_state(None) }).await;
        let Pair { mut alice, mut bob, alice_id, .. } = alice_and_bob(addr).await;

        let reply = request(&mut alice, json!({ "id": 3, "action": "lines", "linedata": flow(7) })).await;
        assert_eq!(reply, json!({ "id": 3, "since": 0, "data": "" }));
        let push = recv(&mut bob).await;
        assert!(push.get("id").is_none(), "pushes have no id: {push}");
        assert_eq!(push["data"].as_array().unwrap().len(), 1, "{push}");
        assert_eq!(push["data"][0]["type"], "flow");
        assert_eq!(push["data"][0]["client"], alice_id);
        assert_eq!(push["data"][0]["code"], 7);
        assert_eq!(push["data"][0]["id"], push["since"], "rows carry their id");
        quiet(&mut alice).await; // her own stroke doesn't come back

        // Bob undoes Alice's stroke: the undo row reaches both of them.
        let reply = request(&mut bob, json!({ "id": 4, "action": "undo", "client": alice_id, "code": 7 })).await;
        assert_eq!(reply["id"], 4, "{reply}");
        for ws in [&mut alice, &mut bob] {
            let push = recv(ws).await;
            assert_eq!(push["data"][0]["type"], "undo", "{push}");
            assert_eq!(push["data"][0]["code"], 7, "{push}");
        }
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn http_writes_reach_websocket_watchers(pool: MySqlPool) {
        let state = AppState { db: pool, ..test_state(None) };
        let addr = serve(state.clone()).await;
        let Pair { mut bob, hash, .. } = alice_and_bob(addr).await;

        let http = router("/whiteboard", None, state);
        let linedata = flow(1).to_string();
        let (code, _) = crate::upload::tests::post(
            &http,
            &[("action", "lines"), ("hash", &hash), ("client", "5"), ("linedata", &linedata)],
        )
        .await;
        assert_eq!(code, axum::http::StatusCode::OK);
        let push = recv(&mut bob).await;
        assert_eq!(push["data"][0]["client"], 5, "{push}");
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn clear_is_pushed_and_answers_its_row_id(pool: MySqlPool) {
        let addr = serve(AppState { db: pool, ..test_state(None) }).await;
        let Pair { mut alice, mut bob, .. } = alice_and_bob(addr).await;
        let reply = request(&mut alice, json!({ "id": 5, "action": "clear", "code": 1 })).await;
        assert!(reply["since"].as_i64().unwrap() > 0, "{reply}");
        let push = recv(&mut bob).await;
        assert_eq!(push["data"][0]["type"], "clear", "{push}");
        assert_eq!(push["since"], reply["since"]);
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn resent_writes_are_not_repeated(pool: MySqlPool) {
        let addr = serve(AppState { db: pool, ..test_state(None) }).await;
        let Pair { mut alice, mut bob, .. } = alice_and_bob(addr).await;
        request(&mut alice, json!({ "action": "lines", "linedata": flow(1) })).await;
        assert_eq!(recv(&mut bob).await["data"].as_array().unwrap().len(), 1);
        request(&mut alice, json!({ "action": "lines", "linedata": flow(1) })).await;
        quiet(&mut bob).await;

        let first = request(&mut alice, json!({ "action": "clear", "code": 2 })).await;
        recv(&mut bob).await;
        request(&mut bob, json!({ "action": "lines", "linedata": flow(1) })).await;
        recv(&mut alice).await; // Bob's stroke, pushed
        let again = request(&mut alice, json!({ "action": "clear", "code": 2 })).await;
        assert_eq!(again["since"], first["since"], "a resent clear answers the first one's id");
        let lines = request(&mut alice, json!({ "action": "getlines", "since": 0 })).await;
        assert_eq!(lines["data"].as_array().unwrap().len(), 1, "Bob's stroke survives: {lines}");
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn rejoining_keeps_the_client_and_catches_up(pool: MySqlPool) {
        let addr = serve(AppState { db: pool, ..test_state(None) }).await;
        let Pair { mut alice, bob, hash, alice_id, bob_id } = alice_and_bob(addr).await;
        drop(bob);
        request(&mut alice, json!({ "action": "lines", "linedata": flow(1) })).await;

        let mut bob = connect(addr).await;
        let init = request(&mut bob, json!({ "action": "init", "hash": hash, "client": bob_id })).await;
        assert_eq!(init["data"]["clientid"], bob_id, "rejoined as the same client: {init}");
        let lines = request(&mut bob, json!({ "action": "getlines", "since": 0 })).await;
        assert_eq!(lines["data"].as_array().unwrap().len(), 1, "caught up on what he missed: {lines}");
        assert_eq!(lines["data"][0]["client"], alice_id);
    }

    #[sqlx::test(migrations = "../migrations")]
    async fn bad_requests_say_what_is_wrong(pool: MySqlPool) {
        let addr = serve(AppState { db: pool, ..test_state(None) }).await;
        let mut ws = connect(addr).await;
        let cases = [
            (json!({ "id": 1, "action": "lines", "linedata": [] }), "send new or init first"),
            (json!({ "id": 2, "action": "fly" }), "unknown variant"),
            (json!({ "id": 3, "action": "init" }), "missing field `hash`"),
            (json!({ "id": 4, "action": "init", "hash": "zz" }), "hex"),
            (json!({ "id": 5, "action": "init", "hash": "abcdef01" }), "no such board"),
            (json!({ "id": 6, "action": "init", "hash": "ab", "client": 4_294_967_296_u64 }), "u32"),
        ];
        for (message, want) in cases {
            let id = message["id"].clone();
            let reply = request(&mut ws, message).await;
            assert_eq!(reply["id"], id, "{reply}");
            assert!(reply["error"].as_str().unwrap().contains(want), "wanted {want:?}: {reply}");
        }
        ws.send(WsMessage::Text("{".into())).await.unwrap();
        let reply = recv(&mut ws).await;
        assert!(reply.get("id").is_none());
        assert!(reply["error"].as_str().unwrap().contains("not JSON"), "{reply}");
    }

    #[tokio::test]
    async fn pings_are_answered() {
        let addr = serve(test_state(None)).await;
        let mut ws = connect(addr).await;
        assert_eq!(request(&mut ws, json!({ "action": "ping" })).await, json!({ "action": "pong" }));
    }

    fn quick_heartbeat() -> AppState {
        AppState {
            heartbeat: Heartbeat { every: Duration::from_millis(50), timeout: Duration::from_millis(100) },
            ..test_state(None)
        }
    }

    #[tokio::test]
    async fn clients_that_stop_answering_are_closed() {
        let addr = serve(quick_heartbeat()).await;
        let mut ws = connect(addr).await;
        let started = tokio::time::Instant::now();
        loop {
            match next_frame(&mut ws, Duration::from_secs(1)).await {
                Some(WsMessage::Text(text)) => assert_eq!(text.as_str(), r#"{"action":"ping"}"#),
                Some(WsMessage::Close(frame)) => {
                    assert_eq!(frame.unwrap().reason.as_str(), "no reply to ping");
                    break;
                }
                other => panic!("unexpected {other:?}"),
            }
        }
        // First ping at 50ms, given up on 100ms later.
        assert!(started.elapsed() >= Duration::from_millis(150), "{:?}", started.elapsed());
    }

    #[tokio::test]
    async fn answering_pings_keeps_the_connection_open() {
        let addr = serve(quick_heartbeat()).await;
        let mut ws = connect(addr).await;
        let mut pings = 0;
        while pings < 8 {
            match next_frame(&mut ws, Duration::from_secs(1)).await {
                Some(WsMessage::Text(text)) if text.as_str() == r#"{"action":"ping"}"# => {
                    pings += 1;
                    send(&mut ws, json!({ "action": "pong" })).await;
                }
                other => panic!("unexpected {other:?}"),
            }
        }
    }

    #[tokio::test]
    async fn shutdown_closes_sockets() {
        let state = test_state(None);
        let addr = serve(state.clone()).await;
        let mut ws = connect(addr).await;
        assert_eq!(request(&mut ws, json!({ "action": "ping" })).await["action"], "pong");
        state.closing.send_replace(true);
        match next_frame(&mut ws, Duration::from_secs(1)).await {
            Some(WsMessage::Close(Some(frame))) => assert_eq!(frame.code, CloseCode::Away),
            other => panic!("expected a close, got {other:?}"),
        }
    }
}
