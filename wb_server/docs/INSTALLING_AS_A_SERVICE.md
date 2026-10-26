# Installing wb_server as a service

How to run the `whiteboard` server on a Linux machine with systemd, behind a
web server (Apache or nginx) on the same machine, with MariaDB or MySQL for
storage. Written for, and the commands given for:

- **Debian / Ubuntu** (`apt`, Apache as `apache2`, AppArmor), and
- **Amazon Linux 2023 / RHEL / Fedora** (`dnf`, Apache as `httpd`, SELinux).

The files to copy are in [`systemd/`](systemd).

## Requirements

- **systemd 248 or newer**, for `LoadCredential=` and its `%d` specifier
  (`systemctl --version`). Ubuntu 22.04+, Debian 12+, Amazon Linux 2023,
  RHEL 9 and current Fedora all qualify.
- **MariaDB 10.6+ or MySQL 8**, reachable from the machine. The server has
  been run on MariaDB 10.11.
- **A reverse proxy** that can pass WebSockets: Apache 2.4.47+ or nginx.
- To build: git, a C toolchain (for linking), and Rust (via rustup).
  About 1 GB of RAM plus some swap is enough to build; the server itself uses
  tens of MB.

## Layout

| Path | Owner, mode | What |
|---|---|---|
| `/opt/whiteboard` | your user | The git checkout, built as that user. Any path works. |
| `/usr/local/bin/whiteboard` | root, 755 | The installed binary. |
| `/etc/whiteboard/server.json` | root, 600 | The config, which holds the database password. |
| `/etc/systemd/system/whiteboard.service` | root, 644 | The unit, [`systemd/whiteboard.service`](systemd/whiteboard.service). |

The service runs as a **dynamic user** (`DynamicUser=yes`): systemd makes up an
unprivileged user for each run, which owns no files and can write nowhere. It
can't read `/etc/whiteboard/server.json` either. Instead `LoadCredential=` hands
it a private read-only copy at start, and `WHITEBOARD_CONFIG` points at that.
So the password file is readable by root alone, and a compromised server can't
change its own code, binary or config.

It listens on `127.0.0.1` only. The web server in front passes everything
under the base path (`/whiteboard/` by default) to it: the page, the API and
the WebSocket. Nothing needs opening in the firewall. Logs go to the journal.

## 1. Install the build tools

```bash
# Debian / Ubuntu
sudo apt install git build-essential curl
# Amazon Linux / RHEL / Fedora
sudo dnf install git gcc curl
```

Then Rust, as the user who will build (no sudo):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
source ~/.cargo/env
```

## 2. Get the code and build

```bash
sudo install -d -o "$USER" /opt/whiteboard
git clone https://github.com/maludwig/whiteboard.git /opt/whiteboard
cd /opt/whiteboard/wb_server
cargo build --release
```

A first release build takes a few minutes; rebuilds after small changes take
well under one. A binary built on one distribution runs on others with the
same or a newer glibc, so building on the oldest machine you deploy to is the
safe choice.

The frontend is one self-contained file, `wb_web/dist/index.html`. Build it
anywhere with Node (`cd wb_web && npm install && npm run build`) and copy it to
`/opt/whiteboard/wb_web/dist/` on the server; the server needs no Node.

## 3. Install the binary

```bash
sudo install -m 755 /opt/whiteboard/wb_server/target/release/whiteboard /usr/local/bin/whiteboard
```

## 4. Create the database

As the database's admin (on both MariaDB and MySQL, `sudo mysql` logs in as
its root through the Unix socket on a default install):

```sql
CREATE DATABASE whiteboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'whiteboard'@'localhost' IDENTIFIED BY 'a-long-random-password';
GRANT ALL PRIVILEGES ON whiteboard.* TO 'whiteboard'@'localhost';
```

`ALL` on its own database covers the migrations (`CREATE`, `ALTER`, `INDEX`)
as well as normal running (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Use
letters and digits for the password, or percent-encode it in the URL below.
The server connects over TCP to `127.0.0.1`, which matches a `'localhost'`
account.

If the database only serves this machine, have it listen on loopback alone:
add `bind-address = 127.0.0.1` under `[mysqld]` in a drop-in config file
(`/etc/my.cnf.d/` on Amazon Linux and RHEL, `/etc/mysql/mariadb.conf.d/` or
`/etc/mysql/mysql.conf.d/` on Debian and Ubuntu) and restart the database.

## 5. Write the config

Copy [`systemd/server.json.example`](systemd/server.json.example) to the
machine, then:

```bash
sudo install -d -m 700 /etc/whiteboard
sudo install -m 600 server.json.example /etc/whiteboard/server.json
sudo whiteboard config set database_url -
sudo whiteboard config set static_dir /opt/whiteboard/wb_web/dist
```

The `database_url` line reads the URL
(`mysql://whiteboard:password@127.0.0.1:3306/whiteboard`) from stdin, so the
password stays out of shell history: paste it, press Enter, then Ctrl-D.
`config set` checks the whole file before writing and rewrites it in place,
so it stays root-owned with mode 600.

Run as root, `whiteboard` finds `/etc/whiteboard/server.json` by itself.
`sudo whiteboard config get listen` reads one setting back. `config show` and
`config get database_url` print the password, so mind who's watching.

The keys are listed in [the README](../README.md#config). Worth knowing:

- `listen`: keep it on `127.0.0.1`; pick another port if 8080 is taken
  (`ss -ltn` shows what is).
- `base_path`: where the site lives, `/whiteboard` by default. The proxy
  config below has to match it.
- `static_dir`: the server serves the page from here. (Leaving it unset and
  having the web server serve `index.html` also works.)
- `stream_logs`: leave it off in production.

## 6. Migrate the database

```bash
sudo whiteboard db status
sudo whiteboard db migrate
sudo whiteboard db status
```

`db status` shows each migration as applied, pending, or changed since
applied, and creates nothing. Migrations only go forward, so on a database
that already has data, take a dump first
(`sudo mysqldump --single-transaction whiteboard > whiteboard.sql`).

## 7. Install and start the service

```bash
sudo install -m 644 whiteboard.service /etc/systemd/system/whiteboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now whiteboard
```

Then check it:

```bash
systemctl status whiteboard
journalctl -u whiteboard -f
curl -s http://127.0.0.1:8080/whiteboard/api/status
```

The status endpoint answers `{"now", "db": "ok", "version", "built"}`, or 503
with `"db": "error"` while the database is unreachable (the server starts
anyway and recovers by itself). `systemd-analyze security whiteboard` scores
the sandboxing; this unit scores about 1.2 ("OK").

## 8. Put the web server in front

Everything under the base path goes to the service. WebSocket upgrades must
pass through too.

### Apache (2.4.47 or newer)

The config, as `whiteboard.conf`:

```apache
RedirectMatch 301 ^/whiteboard$ /whiteboard/
ProxyPass        /whiteboard/ http://127.0.0.1:8080/whiteboard/ upgrade=websocket
ProxyPassReverse /whiteboard/ http://127.0.0.1:8080/whiteboard/
```

`upgrade=websocket` lets the one `ProxyPass` line carry WebSocket connections
as well (no `mod_proxy_wstunnel` rules needed).

```bash
# Debian / Ubuntu
sudo a2enmod proxy proxy_http
sudo cp whiteboard.conf /etc/apache2/conf-available/
sudo a2enconf whiteboard
sudo apachectl configtest && sudo systemctl reload apache2

# Amazon Linux / RHEL / Fedora (the proxy modules are loaded by default)
sudo cp whiteboard.conf /etc/httpd/conf.d/
sudo apachectl configtest && sudo systemctl reload httpd
```

### nginx

Inside the `server { }` block, plus the `map` at `http { }` level (in a file
under `/etc/nginx/conf.d/` it is at `http` level already):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    # ...
    absolute_redirect off;
    location = /whiteboard { return 301 /whiteboard/; }
    location /whiteboard/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
    }
}
```

Then `sudo nginx -t && sudo systemctl reload nginx`.

### SELinux (Amazon Linux, RHEL, Fedora)

When SELinux is enforcing (`getenforce`), the web server may not connect to
arbitrary local ports, and the proxy answers 503 with a "permission denied"
in its error log. Allow it, either for any port:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

or, more narrowly, by labelling the one port as a web port (needs
`policycoreutils-python-utils`; 8080 is already labelled `http_cache_port_t`,
for which `httpd_can_network_relay` is the narrower switch):

```bash
sudo semanage port -a -t http_port_t -p tcp 9876
```

Debian and Ubuntu use AppArmor, whose default profiles don't restrict Apache
or nginx this way.

### Behind a CDN or another proxy

- Don't cache `/whiteboard/api/*` or `/whiteboard/ws` (the server sends
  `Cache-Control: no-store` on the API; make sure the CDN honours it), and
  forward the WebSocket handshake headers (`Sec-WebSocket-*`) to the origin.
  On CloudFront: a cache behaviour for each path with the managed
  CachingDisabled cache policy and the AllViewerExceptHostHeader origin
  request policy.
- Redirects: Apache makes redirect targets absolute using the `Host` header it
  received. If the CDN sends the origin's own name as `Host`, a relative
  `RedirectMatch` sends visitors to the origin's name. Write the public URL in
  full instead (`RedirectMatch 301 ^/whiteboard$ https://example.com/whiteboard/`),
  or use nginx's `absolute_redirect off`.
- The WebSocket goes idle between strokes; the server pings every 20 seconds,
  which keeps it inside any idle timeout of a minute or more.

## Updating

```bash
cd /opt/whiteboard && git pull
cd wb_server && cargo build --release
sudo install -m 755 target/release/whiteboard /usr/local/bin/whiteboard
sudo whiteboard db status               # migrate first if anything is pending
sudo systemctl restart whiteboard
```

A restart is graceful (SIGTERM): requests in flight finish, and open
WebSockets are closed with code 1001, so pages reconnect and catch up by
themselves. `/api/status`'s `built` time confirms which binary is running.

## Changing the config

`sudo whiteboard config set <name> <value>`, then
`sudo systemctl restart whiteboard`: the service reads its copy of the file at
start.

## Removing

```bash
sudo systemctl disable --now whiteboard
sudo rm /etc/systemd/system/whiteboard.service /usr/local/bin/whiteboard
sudo systemctl daemon-reload
```

Remove the proxy config and reload the web server. The database and
`/etc/whiteboard` are left for you to delete.

## Troubleshooting

- **The service dies at once**, with `status=31/SYS` in `systemctl status`:
  the system-call filter blocked something. The journal names it; relax that
  one setting in the unit (`SystemCallFilter=`, `MemoryDenyWriteExecute=`).
- **`Failed to set up credentials`**: `/etc/whiteboard/server.json` is missing,
  or systemd is older than 248.
- **`could not listen on 127.0.0.1:8080`**: the port is taken; change `listen`
  (and the proxy config).
- **The proxy answers 503**: the service isn't running, is on another port, or
  SELinux is blocking the connection (above).
- **The page works but drawings only appear after a second or so**: the
  WebSocket isn't getting through, so the page has fallen back to polling.
  Check the proxy's WebSocket settings, and the CDN's header forwarding.

## Notes on the unit

- **Sandboxing**: no capabilities, read-only filesystem, no home directories,
  private `/tmp` and `/dev`, only IPv4/IPv6/Unix sockets, a system-call
  allowlist, and no writable-executable memory. The server needs none of what
  this takes away; if a future feature does (say, writing files), loosen the
  one setting it needs.
- **Limits**: `MemoryMax=300M` (it uses tens of MB), so a leak can't take the
  machine down with it; `TasksMax=128` threads.
- **Ordering**: it starts after `mariadb.service` or `mysql.service` when
  either exists, but doesn't require them. With the database down it still
  answers `/api/status` (as 503) and recovers when the database returns.
