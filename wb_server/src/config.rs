//! Server configuration, loaded from a JSON file.
//!
//! The file is found at `$WHITEBOARD_CONFIG` when that variable is set (and it
//! is an error if nothing is there), otherwise at the platform default:
//! `/etc/whiteboard/server.json`, or `%ProgramData%\whiteboard\server.json` on Windows.

use std::ffi::OsString;
use std::io::ErrorKind;
use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const CONFIG_ENV: &str = "WHITEBOARD_CONFIG";

/// Every setting's name, in the order `Config` declares them.
pub const KEYS: &[&str] = &["listen", "base_path", "database_url", "log", "static_dir", "admin_token", "stream_logs"];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// Address the HTTP server binds to. Apache proxies to it, so keep it on loopback.
    #[serde(default = "default_listen")]
    pub listen: SocketAddr,
    /// URL prefix the API and WebSocket routes are mounted under.
    #[serde(default = "default_base_path")]
    pub base_path: String,
    pub database_url: String,
    /// A tracing filter, e.g. `info` or `info,sqlx=warn`.
    #[serde(default = "default_log")]
    pub log: String,
    /// If set, files in this directory are served under `base_path` (for local
    /// development; in production Apache serves the frontend).
    #[serde(default)]
    pub static_dir: Option<PathBuf>,
    /// Bearer token for `{base_path}/api/admin/...`. Unset, the admin API doesn't exist.
    #[serde(default)]
    pub admin_token: Option<String>,
    /// Have the frontend send its log lines to `{base_path}/api/log`, which
    /// writes them to this server's log (target `client`). For debugging.
    #[serde(default)]
    pub stream_logs: bool,
}

fn default_listen() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], 8080))
}

fn default_base_path() -> String {
    "/whiteboard".to_owned()
}

fn default_log() -> String {
    "info".to_owned()
}

impl Config {
    pub fn parse(json: &str) -> Result<Config> {
        let config: Config = serde_json::from_str(json)?;
        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<()> {
        let bp = &self.base_path;
        if !bp.starts_with('/') || bp.ends_with('/') || bp.len() < 2 {
            bail!("base_path must start with '/' and not end with one, like \"/whiteboard\"; got {bp:?}");
        }
        tracing_subscriber::EnvFilter::try_new(&self.log)
            .with_context(|| format!("log must be a tracing filter like \"info\" or \"info,sqlx=warn\"; got {:?}", self.log))?;
        if self.admin_token.as_deref() == Some("") {
            bail!("admin_token must not be empty; leave it out to disable the admin API");
        }
        Ok(())
    }

    /// One setting's effective value (defaults included), as it appears in JSON.
    pub fn get(&self, key: &str) -> Result<Value> {
        check_key(key)?;
        let mut all = serde_json::to_value(self)?;
        Ok(all[key].take())
    }
}

fn check_key(key: &str) -> Result<()> {
    if !KEYS.contains(&key) {
        bail!("unknown setting {key:?}; expected one of {}", KEYS.join(", "));
    }
    Ok(())
}

/// The config file's text with `key` set to `value`, keeping every other key
/// as written (unset keys stay unset, so they keep following the defaults).
/// Fails, without producing anything, if the result would not be a valid config.
///
/// `value` is stored as a JSON string if that makes a valid config, and
/// otherwise as the JSON it spells (so `true` becomes a boolean).
pub fn with_setting(json: &str, key: &str, value: &str) -> Result<String> {
    check_key(key)?;
    let doc: Map<String, Value> = serde_json::from_str(json)?;
    let as_string = updated_doc(&doc, key, Value::String(value.to_owned()))?;
    let string_error = match Config::parse(&as_string) {
        Ok(_) => return Ok(as_string),
        Err(e) => e,
    };
    if let Ok(literal) = serde_json::from_str::<Value>(value) {
        let as_literal = updated_doc(&doc, key, literal)?;
        if Config::parse(&as_literal).is_ok() {
            return Ok(as_literal);
        }
    }
    Err(string_error.context("the config would be invalid after this change"))
}

fn updated_doc(doc: &Map<String, Value>, key: &str, value: Value) -> Result<String> {
    let mut doc = doc.clone();
    doc.insert(key.to_owned(), value);
    Ok(serde_json::to_string_pretty(&doc)? + "\n")
}

/// Where the config file is, and whether `WHITEBOARD_CONFIG` chose it.
#[derive(Debug, PartialEq)]
pub struct ConfigPath {
    pub path: PathBuf,
    pub from_env: bool,
}

pub fn resolve_path(env_value: Option<OsString>) -> ConfigPath {
    match env_value {
        Some(value) => ConfigPath { path: value.into(), from_env: true },
        None => ConfigPath { path: default_path(), from_env: false },
    }
}

#[cfg(windows)]
fn default_path() -> PathBuf {
    let program_data = std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
    program_data.join("whiteboard").join("server.json")
}

#[cfg(not(windows))]
fn default_path() -> PathBuf {
    PathBuf::from("/etc/whiteboard/server.json")
}

pub fn load() -> Result<Config> {
    load_from(&locate())
}

pub fn load_from(location: &ConfigPath) -> Result<Config> {
    let json = read(location)?;
    Config::parse(&json).with_context(|| format!("invalid config file {}", location.path.display()))
}

/// Set one setting in the config file. The file must already exist; this never
/// creates one, so a mistyped `WHITEBOARD_CONFIG` fails instead of writing somewhere new.
pub fn set(key: &str, value: &str) -> Result<()> {
    let location = locate();
    let path = location.path.display();
    let json = read(&location)?;
    let updated = with_setting(&json, key, value).with_context(|| format!("{path} was not changed"))?;
    // Rewritten in place rather than via a temp file and rename, so the file
    // keeps its owner and permissions (it holds the database password).
    std::fs::write(&location.path, updated).with_context(|| format!("could not write {path}"))
}

fn locate() -> ConfigPath {
    resolve_path(std::env::var_os(CONFIG_ENV))
}

fn read(location: &ConfigPath) -> Result<String> {
    let path = location.path.display();
    match std::fs::read_to_string(&location.path) {
        Ok(json) => Ok(json),
        Err(e) if e.kind() == ErrorKind::NotFound => {
            if location.from_env {
                bail!("{CONFIG_ENV} is set to {path}, but there is no file there");
            }
            bail!("no config file at {path} (the default location); create it, or set {CONFIG_ENV} to its path");
        }
        Err(e) => Err(e).with_context(|| format!("could not read config file {path}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL: &str = r#"{"database_url": "mysql://wb:pw@localhost/whiteboard"}"#;

    #[test]
    fn env_value_wins_over_default() {
        let got = resolve_path(Some(OsString::from("/some/where.json")));
        assert_eq!(got, ConfigPath { path: PathBuf::from("/some/where.json"), from_env: true });
    }

    #[test]
    fn falls_back_to_default_only_when_unset() {
        let got = resolve_path(None);
        assert!(!got.from_env);
        assert!(got.path.ends_with("whiteboard/server.json") || got.path.ends_with(r"whiteboard\server.json"));
    }

    #[test]
    fn missing_env_file_is_an_error_not_a_fallback() {
        let location = ConfigPath { path: PathBuf::from("definitely/not/here.json"), from_env: true };
        let err = load_from(&location).unwrap_err().to_string();
        assert!(err.contains(CONFIG_ENV), "{err}");
        assert!(err.contains("here.json"), "{err}");
    }

    #[test]
    fn defaults_fill_in_optional_fields() {
        let config = Config::parse(MINIMAL).unwrap();
        assert_eq!(config.listen, default_listen());
        assert_eq!(config.base_path, "/whiteboard");
        assert_eq!(config.log, "info");
        assert_eq!(config.static_dir, None);
        assert_eq!(config.admin_token, None);
        assert!(!config.stream_logs);
    }

    #[test]
    fn set_stores_booleans_as_booleans() {
        let updated = with_setting(MINIMAL, "stream_logs", "true").unwrap();
        assert!(Config::parse(&updated).unwrap().stream_logs);
        assert!(updated.contains("\"stream_logs\": true"), "{updated}");
        assert!(with_setting(MINIMAL, "stream_logs", "yes").is_err());
        // Strings that happen to look like JSON stay strings.
        let updated = with_setting(MINIMAL, "admin_token", "12345").unwrap();
        assert_eq!(Config::parse(&updated).unwrap().admin_token.as_deref(), Some("12345"));
    }

    #[test]
    fn unknown_keys_are_rejected() {
        let json = r#"{"database_url": "mysql://x", "databse_url": "typo"}"#;
        assert!(Config::parse(json).is_err());
    }

    #[test]
    fn database_url_is_required() {
        assert!(Config::parse("{}").is_err());
    }

    #[test]
    fn base_path_must_be_a_clean_prefix() {
        for bad in ["whiteboard", "/whiteboard/", "/", ""] {
            let json = format!(r#"{{"database_url": "mysql://x", "base_path": "{bad}"}}"#);
            assert!(Config::parse(&json).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn round_trips_through_json() {
        let config = Config::parse(MINIMAL).unwrap();
        let again = Config::parse(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!(config, again);
    }

    #[test]
    fn keys_match_the_struct() {
        let config = Config::parse(MINIMAL).unwrap();
        let serialized = serde_json::to_value(&config).unwrap();
        let fields: Vec<&str> = serialized.as_object().unwrap().keys().map(String::as_str).collect();
        assert_eq!(fields, KEYS);
    }

    #[test]
    fn get_returns_effective_values() {
        let config = Config::parse(MINIMAL).unwrap();
        assert_eq!(config.get("base_path").unwrap(), "/whiteboard");
        assert_eq!(config.get("listen").unwrap(), "127.0.0.1:8080");
        assert!(config.get("nope").unwrap_err().to_string().contains("expected one of"));
    }

    #[test]
    fn set_adds_a_key_and_keeps_the_rest_in_order() {
        let json = r#"{"log": "debug", "database_url": "mysql://x"}"#;
        let updated = with_setting(json, "listen", "0.0.0.0:9000").unwrap();
        let doc: Map<String, Value> = serde_json::from_str(&updated).unwrap();
        let keys: Vec<&str> = doc.keys().map(String::as_str).collect();
        assert_eq!(keys, ["log", "database_url", "listen"]);
        assert_eq!(Config::parse(&updated).unwrap().listen.port(), 9000);
    }

    #[test]
    fn set_leaves_defaults_implicit() {
        let updated = with_setting(MINIMAL, "log", "warn").unwrap();
        assert!(!updated.contains("base_path"), "{updated}");
    }

    #[test]
    fn set_rejects_what_load_would_reject() {
        assert!(with_setting(MINIMAL, "listen", "not an address").is_err());
        assert!(with_setting(MINIMAL, "base_path", "/trailing/").is_err());
        assert!(with_setting(MINIMAL, "databse_url", "typo").is_err());
        assert!(with_setting(MINIMAL, "log", "info,sqlx=loud").is_err());
        assert!(with_setting(MINIMAL, "admin_token", "").is_err());
        assert!(with_setting("[]", "log", "info").is_err());
    }
}
