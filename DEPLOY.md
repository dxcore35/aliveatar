# Deploy

This site is plain files — HTML, JavaScript, images. No build step, no server
code, no database, no environment variables. Anything that can serve a folder
over HTTP can host it.

## Vercel (the live site)

```bash
vercel --prod
```

The first run asks which project to link and then remembers it. `vercel.json`
is in the repo and only sets cache headers: the vendored artwork never changes,
so it is cached for a year; `src/` is cached for ten minutes.

To make a pull request preview, push a branch — Vercel builds every branch on
its own URL.

## Anywhere else

Netlify, GitHub Pages, Cloudflare Pages, or an `nginx` that points at the
checkout. All of them need the same thing: serve `index.html`, `lab.html`,
`src/`, `vendor/` and `docs/` as static files.

## Your own machine, behind a tunnel

The path below publishes the site from a home server over HTTPS **without
opening a port** — the machine makes an outbound connection to Cloudflare, and
Cloudflare accepts the public traffic. Use it when you want the files on
hardware you own.

### 1. One-time Cloudflare Tunnel setup (~10 min, from any browser)

A **tunnel** is a private, outbound-only connection from the server to
Cloudflare. The server calls out to Cloudflare and keeps that connection
open; Cloudflare then forwards visitor traffic through it. Because the
server only calls *out*, there is no need to open any port *in* on the
server or the home router.

1. Log in to https://dash.cloudflare.com (the `dxcore35.eu` domain
   should already be set up there — this reuses it).
2. Go to **Zero Trust** → **Networks** → **Tunnels**.
3. If a tunnel already exists that you want to reuse, open it. Otherwise
   click **Create a tunnel** → type **Cloudflared** → give it a name,
   e.g. `avatar-motion`.
4. On the tunnel's setup screen, find the **connector command** — it
   contains a long string starting with `eyJ…` after the word `--token`.
   Copy that whole string. This is the **tunnel token**: a secret that
   lets the server prove to Cloudflare it is allowed to use this tunnel.
5. Still on the tunnel screen, go to the **Public Hostname** tab → **Add a
   public hostname**:
   - Subdomain: `avatar`
   - Domain: `dxcore35.eu`
   - Service: **HTTP** → `web:80`
   (`web:80` is the name Docker Compose gives the site's container on
   port 80 — see step 3, this is not a real internet address, it only
   makes sense inside the tunnel.)
   → **Save**. HTTPS is issued automatically; there is nothing else to
   configure for the certificate.

### 2. On the server: install and start

A **container** is a small, self-contained package that runs the app the
same way everywhere, without installing anything else on the machine.
**Docker Compose** is the tool that starts a group of containers together
from one config file (`docker-compose.yml`, already in this repo).

If Docker is not installed yet:

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
sudo usermod -aG docker $USER
```

(Log out and back in after that second command, so your user account is
allowed to run Docker without `sudo` every time.)

Get the code onto the server:

```bash
git clone <this-repo-url> avatar-motion && cd avatar-motion
```

Create the local settings file from the template and paste in the tunnel
token from step 2.4:

```bash
cp .env.example .env
```

```bash
nano .env
```

Set the line to `CLOUDFLARE_TUNNEL_TOKEN=eyJ…` (your real token, no
quotes), save, and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in `nano`).

Build and start everything in the background:

```bash
docker compose up -d --build
```

### 3. How to check it worked

List the running containers and confirm both show as healthy/running:

```bash
docker compose ps
```

Ask the public address for its headers — a working site returns
`HTTP/2 200`:

```bash
curl -I https://avatar.dxcore35.eu
```

Open `https://avatar.dxcore35.eu` in a browser and confirm the page
loads with a valid padlock.

### 4. How to update after a code change

```bash
git pull && docker compose up -d --build
```

This pulls the newest files and rebuilds the container in place; the
tunnel keeps running throughout, so the address never goes down.
