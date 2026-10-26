# wb_server

The whiteboard's server, in Rust: one `whiteboard` binary that serves the board's
API (and, for local development, the frontend), and manages its config and
database. It replaces the old PHP (`upload.php`, `sqliboard.php`, `sqli.php`).

Built on [axum](https://docs.rs/axum) and [tokio](https://tokio.rs), with
[sqlx](https://docs.rs/sqlx) for MariaDB/MySQL.

## Commands

```
whiteboard serve
whiteboard config show [--pretty-json]
whiteboard config get <name>
whiteboard config set <name> <value | - to read it from stdin>
whiteboard db migrate
whiteboard db status
```

- **serve** runs the HTTP server until Ctrl-C, SIGTERM (what systemd sends), or a
  `POST .../api/admin/die`. Shutdown is graceful: in-flight requests finish.
- **config set** validates the whole file before writing, keeps other keys as
  written, and never creates a file. `-` reads the value from stdin, which keeps
  secrets like `database_url` out of shell history. Values are stored as JSON
  strings unless that's invalid (so `true` becomes a boolean).
- **db migrate** applies pending migrations from `../migrations/` (embedded in the
  binary at build time). **db status** lists each one as applied, pending, or
  changed since it was applied, without creating anything.

## Config

A JSON file, found at `$WHITEBOARD_CONFIG` if that's set (and then it must
exist), otherwise `/etc/whiteboard/server.json`, or
`%ProgramData%\whiteboard\server.json` on Windows. Unknown keys are rejected.

| Key | Default | |
|---|---|---|
| `listen` | `127.0.0.1:8080` | Address to bind. Keep it on loopback behind Apache in production. |
| `base_path` | `/whiteboard` | URL prefix for everything the server answers. |
| `database_url` | (required) | `mysql://user:password@host:3306/whiteboard` |
| `log` | `info` | A [tracing filter](https://docs.rs/tracing-subscriber/latest/tracing_subscriber/filter/struct.EnvFilter.html), e.g. `info,tower_http=debug`. |
| `static_dir` | none | Serve this directory's files under `base_path/` (local development; production uses Apache). |
| `admin_token` | none | Bearer token for `base_path/api/admin/...`. Unset, those routes are 404. |
| `stream_logs` | `false` | Have the frontend send its log lines here (logged under target `client`). |

The file holds the database password: give it mode 600 in production.
`../server.local.example.json` and `../docker/server.dev.example.json` are
starting points.

## HTTP API

All under `{base_path}/api`; every response is `Cache-Control: no-store`.

| Route | |
|---|---|
| `GET /status` | `{"now", "db": "ok"\|"error", "version", "built"}`; 503 when the database is unreachable. |
| `POST /upload` | The upload.php protocol, form-encoded with an `action`: `new`, `init`, `lines`, `clear`, `undo`, `getlines`. Replies `{"since", "data"}`; errors reply `{"error"}` with a 4xx/5xx status. |
| `GET /client-config` | `{"stream_logs"}`, for the frontend. |
| `POST /log` | Frontend log lines, when `stream_logs` is on (404 otherwise). |
| `POST /admin/die` | Graceful shutdown; needs `Authorization: Bearer <admin_token>`. |

Compared with upload.php, these bugs are fixed: client 0 (and stroke code 0) were
ignored; SQL was built by hand; the client counter could hand two joiners the same
id; clear wasn't atomic; undo could delete a clear row; and undoing someone else's
stroke never reached that stroke's owner.

Stored strokes keep the old format (`{"p":[x,y,...],"c":"#hex","t":tool,"w":width}`),
so old and new clients can share a board.

## Database

Two tables, `boards` and `lines`, defined by `../migrations/`:
`0001_initial_migration.sql` matches the production schema (and is a no-op
against it); `0002_utf8mb4.sql` converts to utf8mb4. Migration checksums cover
the files' exact bytes, which is why the repo forces LF line endings
(`.gitattributes`).

## Development

```bash
cargo build
cargo test
```

Tests use `#[sqlx::test]`, which creates a throwaway database per test, so they
need `DATABASE_URL` pointing at a MariaDB server as a user that can create
databases. The repo's `.env` (see `../.env.example`) provides one for the
`docker compose` database.

With Docker (from the repo root):

```bash
docker compose up -d db
docker compose run --rm app cargo run -- db migrate
docker compose up app
```

The `app` service is Amazon Linux 2023 with Rust, like production; the server is
then at `http://localhost:8080/whiteboard/`.

On the host, point `WHITEBOARD_CONFIG` at a config (e.g. `../server.local.json`)
and run `cargo run -- serve`.
