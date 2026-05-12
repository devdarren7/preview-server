# preview-server

A tiny Node/Express server for browsing a working directory in the browser. Renders Markdown files on the fly, surfaces a "Recently Updated" list, and shows a QR code so you can pull anything up on your phone over the local network.

Originally written as a scratchpad viewer for `~/preview/` — drop drafts, mockups, exports, or one-off HTML/Markdown files into a folder and read them in a browser instead of a terminal.

## Features

- Directory listing with file-type icons
- Markdown rendered client-side via `marked`
- "Recently Updated" panel on the index (recursive, 3 levels deep)
- Auto-serves `index.html` for subdirectories (override with `?browse`)
- QR code linking to the LAN URL for quick phone preview
- Path-traversal guard
- Single file, ~280 LOC, one runtime dependency

## Install

```bash
git clone https://github.com/YOURNAME/preview-server.git
cd preview-server
npm install
```

## Run

By default it serves `./preview/` on `127.0.0.1:4173`:

```bash
mkdir -p preview
npm start
```

Open <http://127.0.0.1:4173>.

### Configuration

All via environment variables:

| Var           | Default                | Purpose                                                  |
|---------------|------------------------|----------------------------------------------------------|
| `PORT`        | `4173`                 | Port to listen on                                        |
| `HOST`        | `127.0.0.1`            | Bind address (use `0.0.0.0` to expose on LAN)            |
| `PREVIEW_DIR` | `./preview` (absolute) | Directory to serve                                       |

Example:

```bash
PORT=8080 HOST=0.0.0.0 PREVIEW_DIR=$HOME/notes npm start
```

## Run under PM2

```bash
pm2 start server.js --name preview-server
pm2 save
```

## Exposing it over SSH (reverse tunnel + nginx)

The default bind is `127.0.0.1` — nothing leaves your machine. If you want a shareable HTTPS URL, the cleanest pattern is an SSH reverse tunnel into a server you already own, with nginx proxying a subdomain to the tunneled port.

### 1. Pick an obscure remote port

On your VPS, decide on a high port that won't be obvious (e.g. `47291`). Bind it to loopback only — nginx will be the only thing that talks to it.

### 2. Open the reverse tunnel from your laptop

```bash
ssh -N -R 127.0.0.1:47291:127.0.0.1:4173 user@your-server.example.com
```

Breakdown:
- `-N` — don't run a remote command, just hold the tunnel open
- `-R 127.0.0.1:47291:127.0.0.1:4173` — on the remote, forward `127.0.0.1:47291` to your local `127.0.0.1:4173`
- The leading `127.0.0.1:` on the remote side prevents the port from binding to `0.0.0.0` even if `GatewayPorts` is enabled

For long-running tunnels, use `autossh`:

```bash
autossh -M 0 -f -N \
  -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" \
  -R 127.0.0.1:47291:127.0.0.1:4173 \
  user@your-server.example.com
```

### 3. nginx vhost on the VPS

```nginx
server {
    listen 443 ssl http2;
    server_name preview.example.com;

    ssl_certificate     /etc/letsencrypt/live/preview.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/preview.example.com/privkey.pem;

    # Optional: gate access with basic auth
    # auth_basic "preview";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass         http://127.0.0.1:47291;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Issue the cert with `certbot --nginx -d preview.example.com`, reload nginx, and you've got `https://preview.example.com` fronting your laptop's preview server. Kill the SSH tunnel and the site goes 502 — no exposure when you're offline.

### Security notes

- The remote port (`47291` above) should bind to loopback only. nginx is your TLS + auth boundary.
- Add HTTP basic auth (`auth_basic`) or an IP allowlist if the content is private. The server itself has no auth.
- The path-traversal guard prevents `../` escapes from `PREVIEW_DIR`, but anything *inside* `PREVIEW_DIR` is fully readable. Don't point it at `$HOME`.

## License

MIT.
