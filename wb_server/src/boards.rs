//! Boards and their rows in `lines`: every database operation behind the upload API.
//!
//! Fixed relative to the PHP version (sqliboard.php):
//! - parameterized queries instead of hand-built SQL;
//! - client ids are random 32-bit numbers, not a per-board counter that wrapped
//!   at 256 (and raced, handing two joiners the same id);
//! - clear deletes and records the clear in one transaction;
//! - undo only ever deletes a `flow` row (it could delete a clear row before);
//! - undo rows reach every client, including the owner of the undone stroke;
//! - writes to a board lock its row first, so its line ids commit in order and a
//!   reader polling from `since` can't skip a row that committed late;
//! - writes are idempotent, so a client can resend one that seemed to fail.
//!   Every write is named by (board, client, code): a client numbers its strokes
//!   and clears, and an undo names the stroke it undoes. A write whose name is
//!   already in the table is a resend, and is skipped.

use std::collections::HashSet;

use anyhow::{Context, Result, bail};
use serde::Serialize;
use sqlx::mysql::MySqlPool;
use sqlx::{MySql, QueryBuilder};

/// A board's public name: 1 to 8 hex digits. Stored right-padded with zeros in
/// a `binary(4)` column, so "ab" is 0xAB000000 (and "ab00" names the same board).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoardHash(String);

impl BoardHash {
    pub fn parse(s: &str) -> Option<BoardHash> {
        let valid = (1..=8).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_hexdigit());
        valid.then(|| BoardHash(s.to_ascii_lowercase()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    fn stored(&self) -> Vec<u8> {
        hex::decode(format!("{:0<8}", self.0)).expect("BoardHash is always valid hex")
    }
}

#[derive(Debug, Clone)]
pub struct Board {
    pub id: i32,
    pub hash: BoardHash,
}

pub async fn find(db: &MySqlPool, hash: BoardHash) -> Result<Option<Board>> {
    let id: Option<i32> = sqlx::query_scalar("SELECT id FROM boards WHERE shorthash = ? ORDER BY id LIMIT 1")
        .bind(hash.stored())
        .fetch_optional(db)
        .await?;
    Ok(id.map(|id| Board { id, hash }))
}

/// A new board under the shortest free hash: the first 2 hex digits of a random
/// 8, widening to 4, 6, then all 8 if shorter ones are taken.
pub async fn create(db: &MySqlPool) -> Result<Board> {
    for _ in 0..10 {
        let full: [u8; 4] = rand::random();
        let full_hex = hex::encode(full);
        for len in [2, 4, 6, 8] {
            let hash = BoardHash(full_hex[..len].to_owned());
            if find(db, hash.clone()).await?.is_some() {
                continue;
            }
            let inserted = sqlx::query("INSERT INTO boards (hash, shorthash) VALUES (?, ?)")
                .bind(&full[..])
                .bind(hash.stored())
                .execute(db)
                .await?;
            let id = i32::try_from(inserted.last_insert_id()).context("board id out of range")?;
            return Ok(Board { id, hash });
        }
    }
    bail!("could not find a free board hash")
}

/// A client id for a page joining a board: random, so ids aren't reused and
/// (board, client, code) can name a write. Two joiners of one board share an
/// id about once in four billion.
pub fn new_client() -> u32 {
    rand::random()
}

pub struct NewFlow {
    pub code: u16,
    /// The stroke, serialized: `{"p": [...], "c": color, "t": tool, "w": width}`.
    pub json: String,
}

/// Rows per INSERT; five placeholders each keeps well under MySQL's 65,535 limit.
const INSERT_CHUNK: usize = 1000;

/// Store strokes, skipping any already stored (a resend).
pub async fn add_flows(db: &MySqlPool, board: &Board, client: u32, flows: &[NewFlow]) -> Result<()> {
    let mut tx = db.begin().await?;
    lock(&mut tx, board).await?;
    let fresh = without_repeats(&mut tx, board, client, flows).await?;
    if fresh.len() < flows.len() {
        tracing::info!(board = board.hash.as_str(), client, repeats = flows.len() - fresh.len(), "skipped resent strokes");
    }
    for chunk in fresh.chunks(INSERT_CHUNK) {
        let mut insert: QueryBuilder<MySql> = QueryBuilder::new("INSERT INTO `lines` (board, client, code, type, json) ");
        insert.push_values(chunk, |mut row, flow| {
            row.push_bind(board.id).push_bind(client).push_bind(flow.code).push_bind("flow").push_bind(&flow.json);
        });
        insert.build().execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// The flows whose (client, code) isn't stored yet. A stored one with the same
/// JSON is a resend; with different JSON it's a genuine clash (which random
/// client ids make vanishingly rare), so it's stored anyway.
async fn without_repeats<'a>(
    tx: &mut sqlx::Transaction<'_, MySql>,
    board: &Board,
    client: u32,
    flows: &'a [NewFlow],
) -> Result<Vec<&'a NewFlow>> {
    let mut stored: HashSet<(u16, String)> = HashSet::new();
    for chunk in flows.chunks(INSERT_CHUNK) {
        let mut select: QueryBuilder<MySql> = QueryBuilder::new("SELECT code, json FROM `lines` WHERE board = ");
        select.push_bind(board.id).push(" AND client = ").push_bind(client);
        select.push(" AND type = 'flow' AND code IN (");
        let mut codes = select.separated(", ");
        for flow in chunk {
            codes.push_bind(flow.code);
        }
        select.push(")");
        let rows: Vec<(u16, String)> = select.build_query_as().fetch_all(&mut **tx).await?;
        stored.extend(rows);
    }
    let fresh = flows.iter().filter(|flow| !stored.contains(&(flow.code, flow.json.clone()))).collect();
    Ok(fresh)
}

/// Wipe the board and record the clear. Returns the clear row's id. With a
/// `code`, a resend is answered with the first clear's id and wipes nothing,
/// so it can't take strokes drawn since. (Unless someone else cleared in
/// between, deleting the first clear's row: then it clears again.)
pub async fn clear(db: &MySqlPool, board: &Board, client: u32, code: Option<u16>) -> Result<i64> {
    let mut tx = db.begin().await?;
    lock(&mut tx, board).await?;
    if let Some(code) = code
        && let Some(id) = find_marker(&mut tx, board, client, code, "clear").await?
    {
        tx.commit().await?;
        return Ok(id);
    }
    sqlx::query("DELETE FROM `lines` WHERE board = ?").bind(board.id).execute(&mut *tx).await?;
    let id = insert_marker(&mut tx, board, client, code.unwrap_or(0), "clear").await?;
    tx.commit().await?;
    Ok(id)
}

/// Remove the newest stroke `client` drew with `code`, and record the undo.
/// `client` is the stroke's owner, which isn't necessarily who asked. A stroke
/// is only ever undone once (redo stores it again under a new code), so an
/// undo already recorded is a resend.
pub async fn undo(db: &MySqlPool, board: &Board, client: u32, code: u16) -> Result<()> {
    let mut tx = db.begin().await?;
    lock(&mut tx, board).await?;
    if find_marker(&mut tx, board, client, code, "undo").await?.is_some() {
        tx.commit().await?;
        return Ok(());
    }
    sqlx::query(
        "DELETE FROM `lines` WHERE board = ? AND client = ? AND code = ? AND type = 'flow' ORDER BY id DESC LIMIT 1",
    )
    .bind(board.id)
    .bind(client)
    .bind(code)
    .execute(&mut *tx)
    .await?;
    insert_marker(&mut tx, board, client, code, "undo").await?;
    tx.commit().await?;
    Ok(())
}

/// Hold the board's row until `tx` ends. Ids are handed out at insert time, so
/// without this two writers could commit ids 11 then 10, and a reader that had
/// already seen 11 would never fetch 10. Other boards' writes don't wait.
async fn lock(tx: &mut sqlx::Transaction<'_, MySql>, board: &Board) -> Result<()> {
    sqlx::query("SELECT id FROM boards WHERE id = ? FOR UPDATE").bind(board.id).execute(&mut **tx).await?;
    Ok(())
}

/// The id of the undo or clear row named (board, client, code), if stored.
async fn find_marker(
    tx: &mut sqlx::Transaction<'_, MySql>,
    board: &Board,
    client: u32,
    code: u16,
    kind: &str,
) -> Result<Option<i64>> {
    let id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM `lines` WHERE board = ? AND client = ? AND code = ? AND type = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(board.id)
    .bind(client)
    .bind(code)
    .bind(kind)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(id.map(i64::from))
}

async fn insert_marker(
    tx: &mut sqlx::Transaction<'_, MySql>,
    board: &Board,
    client: u32,
    code: u16,
    kind: &str,
) -> Result<i64> {
    let inserted = sqlx::query("INSERT INTO `lines` (board, client, code, type, json) VALUES (?, ?, ?, ?, '')")
        .bind(board.id)
        .bind(client)
        .bind(code)
        .bind(kind)
        .execute(&mut **tx)
        .await?;
    i64::try_from(inserted.last_insert_id()).context("line id out of range")
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Line {
    /// The row id, so a client reading the board two ways at once (a poll
    /// and a WebSocket) can skip rows it already has.
    pub id: i64,
    #[serde(rename = "type")]
    pub kind: String,
    /// The stroke JSON as a string; the client JSON.parses it.
    pub data: String,
    pub client: u32,
    pub code: u16,
}

/// Rows after `since` that `me` hasn't seen, plus the id to poll from next.
/// A client's own flow and clear rows are skipped (it made them), but undo rows
/// go to everyone: when someone undoes your stroke, the row carries your client
/// id, and you are exactly who needs it. Echoing your own undo back is harmless.
pub async fn lines_since(db: &MySqlPool, board: &Board, me: u32, since: i64) -> Result<(i64, Vec<Line>)> {
    let rows: Vec<(i32, String, String, u32, u16)> = sqlx::query_as(
        "SELECT id, CAST(type AS CHAR), json, client, code FROM `lines`
         WHERE board = ? AND id > ? AND (client <> ? OR type = 'undo') ORDER BY id",
    )
    .bind(board.id)
    .bind(since)
    .bind(me)
    .fetch_all(db)
    .await?;
    let next = rows.last().map_or(since, |row| since.max(i64::from(row.0)));
    let lines = rows
        .into_iter()
        .map(|(id, kind, data, client, code)| Line { id: i64::from(id), kind, data, client, code })
        .collect();
    Ok((next, lines))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_are_short_lowercase_hex() {
        assert_eq!(BoardHash::parse("AB").unwrap().as_str(), "ab");
        for bad in ["", "abcdef012", "xy", "a b", "-1"] {
            assert!(BoardHash::parse(bad).is_none(), "accepted {bad:?}");
        }
    }

    #[test]
    fn hashes_are_stored_right_padded() {
        assert_eq!(BoardHash::parse("ab").unwrap().stored(), [0xab, 0, 0, 0]);
        assert_eq!(BoardHash::parse("abc").unwrap().stored(), [0xab, 0xc0, 0, 0]);
        assert_eq!(BoardHash::parse("ab00").unwrap().stored(), BoardHash::parse("ab").unwrap().stored());
    }
}
