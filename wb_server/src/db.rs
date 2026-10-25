//! Database commands: applying and inspecting migrations.

use std::collections::HashMap;

use anyhow::{Context, Result};
use sqlx::Connection;
use sqlx::migrate::{Migrate, Migrator};
use sqlx::mysql::MySqlConnection;

use crate::config::Config;

/// The SQL files in the repo's top-level `migrations/` dir, embedded at compile time.
static MIGRATOR: Migrator = sqlx::migrate!("../migrations");

/// sqlx's default tracking table.
const MIGRATIONS_TABLE: &str = "_sqlx_migrations";

async fn connect(config: &Config) -> Result<MySqlConnection> {
    // The URL holds the password, so it is deliberately left out of the error.
    MySqlConnection::connect(&config.database_url)
        .await
        .context("could not connect to the database in database_url")
}

/// Checksums of the applied migrations, by version. Empty if nothing has ever
/// been applied; this never creates the tracking table.
async fn applied(conn: &mut MySqlConnection) -> Result<HashMap<i64, Vec<u8>>> {
    let tables: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    )
    .bind(MIGRATIONS_TABLE)
    .fetch_one(&mut *conn)
    .await?;
    if tables == 0 {
        return Ok(HashMap::new());
    }
    let applied = conn.list_applied_migrations(MIGRATIONS_TABLE).await?;
    Ok(applied.into_iter().map(|m| (m.version, m.checksum.into_owned())).collect())
}

pub async fn migrate(config: &Config) -> Result<()> {
    let mut conn = connect(config).await?;
    let before = applied(&mut conn).await?;
    MIGRATOR.run(&mut conn).await.context("migration failed")?;

    let mut ran = 0;
    for m in MIGRATOR.iter().filter(|m| !before.contains_key(&m.version)) {
        println!("applied {:04} {}", m.version, m.description);
        ran += 1;
    }
    if ran == 0 {
        println!("already up to date");
    }
    Ok(())
}

pub async fn status(config: &Config) -> Result<()> {
    let mut conn = connect(config).await?;
    let database: Option<String> = sqlx::query_scalar("SELECT DATABASE()").fetch_one(&mut conn).await?;
    let applied = applied(&mut conn).await?;

    println!("database: {}", database.as_deref().unwrap_or("(none selected)"));
    for m in MIGRATOR.iter() {
        let state = match applied.get(&m.version) {
            None => "pending",
            Some(checksum) if *checksum == *m.checksum => "applied",
            Some(_) => "applied, but the file has changed since",
        };
        println!("{:04}  {:<20}  {state}", m.version, m.description);
    }
    let mut orphans: Vec<_> = applied.keys().filter(|v| !MIGRATOR.version_exists(**v)).collect();
    orphans.sort();
    for version in orphans {
        println!("{version:04}  {:<20}  applied, but no such migration file", "?");
    }
    Ok(())
}
