mod admin;
mod boards;
mod clientlog;
mod config;
mod db;
mod server;
mod signals;
mod upload;
mod ws;

use std::io::Read;
use std::process::ExitCode;

use anyhow::{Context, Result, bail};
use serde_json::Value;

const USAGE: &str = "\
usage:
  whiteboard serve
  whiteboard config show [--pretty-json]
  whiteboard config get <name>
  whiteboard config set <name> <value | - to read it from stdin>
  whiteboard db migrate
  whiteboard db status";

#[tokio::main]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e:#}");
            ExitCode::FAILURE
        }
    }
}

async fn run(args: &[String]) -> Result<()> {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    match args.as_slice() {
        ["serve"] => server::serve(config::load()?).await,
        ["config", "show", flags @ ..] => config_show(flags),
        ["config", "get", key] => config_get(key),
        ["config", "set", key, value] => config_set(key, value),
        ["db", "migrate"] => db::migrate(&config::load()?).await,
        ["db", "status"] => db::status(&config::load()?).await,
        ["help" | "--help" | "-h"] => {
            println!("{USAGE}");
            Ok(())
        }
        _ => bail!("{USAGE}"),
    }
}

/// Print the effective config (file contents plus defaults) as JSON.
fn config_show(flags: &[&str]) -> Result<()> {
    let mut pretty = false;
    for flag in flags {
        match *flag {
            "--pretty-json" => pretty = true,
            other => bail!("unknown option {other:?}\n{USAGE}"),
        }
    }
    let config = config::load()?;
    let json = if pretty {
        serde_json::to_string_pretty(&config)?
    } else {
        serde_json::to_string(&config)?
    };
    println!("{json}");
    Ok(())
}

/// Print one setting's effective value. Strings print bare, for use in scripts.
fn config_get(key: &str) -> Result<()> {
    match config::load()?.get(key)? {
        Value::String(s) => println!("{s}"),
        other => println!("{other}"),
    }
    Ok(())
}

/// Set one setting. A value of `-` is read from stdin, which keeps secrets like
/// database_url out of shell history; one trailing newline is dropped.
fn config_set(key: &str, value: &str) -> Result<()> {
    let value = if value == "-" {
        let mut input = String::new();
        std::io::stdin().read_to_string(&mut input).context("could not read the value from stdin")?;
        let trimmed = input.strip_suffix('\n').unwrap_or(&input);
        trimmed.strip_suffix('\r').unwrap_or(trimmed).to_owned()
    } else {
        value.to_owned()
    };
    config::set(key, &value)
}
