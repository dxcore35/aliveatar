# Deploy Runbook — avatar.dxcore35.eu

Click-by-click guide to put this site on the home Linux server. Written
for a non-technical reader — every technical word is explained where it
first appears.

---

## 1. What you get

A public web address, `https://avatar.dxcore35.eu`, that anyone can open
in a browser. The padlock icon (HTTPS, meaning the connection is
encrypted) works automatically. The server itself has **no open ports** —
nobody on the internet can reach the machine directly, only through the
Cloudflare Tunnel set up below. This site has no server-side code (it is
plain files: HTML, JavaScript, images) and no database, so there is
nothing else to configure.

## 2. One-time Cloudflare Tunnel setup (~10 min, from any browser)

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

## 3. On the server: install and start

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

## 4. How to check it worked

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

## 5. How to update after a code change

```bash
git pull && docker compose up -d --build
```

This pulls the newest files and rebuilds the container in place; the
tunnel keeps running throughout, so the address never goes down.

## 6. Running it without Docker

This site has no build step and no server-side code — it is only static
files. Any of the following work, with no code changes:

- **Local preview on your own machine:**

  ```bash
  bun run dev
  ```

  (starts `tools/serve.js`, a small local file server included in the
  repo, for testing before you deploy)

- **Any static file host** — upload the repository (or point the host at
  it) to Netlify, Vercel, GitHub Pages, or a plain `nginx` install
  elsewhere. All that's required is that the host serves `index.html`,
  `lab.html`, `src/`, `vendor/`, and `docs/` as plain files over HTTP —
  there is no server process, database, or environment variable to
  configure outside of this Docker/Cloudflare path.
