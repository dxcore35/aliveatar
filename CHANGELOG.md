# Changelog

## 1.0.0 — 2026-08-18

First tagged release.

- `<avatar-motion>` web component — plain ES modules, no build step, no
  runtime dependencies, MIT.
- 39 states, driving saccadic eyes, breathing, idle motion and a tool-call
  animation (glasses on, bubble out, outfit colour running hot for agents).
- Speech driven by real audio — loudness and spectral centroid off an FFT,
  no phoneme model, no alignment step.
- CLI (`bin/avatar.js`) and an MCP server (`mcp/server.js`), both generated
  from the same command manifest as the app-facing control API, plus a
  WebSocket bridge (`tools/bridge.js`) carrying commands from a process into
  the page.
- `lab.html` — every state, eye type, spring parameter and a crowd of
  avatars at once.
- `index.html` — the public landing page.
- Docker + Cloudflare Tunnel deploy path, documented in `DEPLOY.md`.
