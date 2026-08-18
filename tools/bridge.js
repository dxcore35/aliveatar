// ---------------------------------------------------------------------------
// Bridge — the wire between a process and an avatar living in a browser.
//
// The control API takes plain JSON, which is the easy half. The hard half is
// that an avatar is a DOM element inside a page, while an MCP server and a CLI
// are processes with no DOM at all. Something has to carry a command across
// that gap, and it has to work when the page is a dashboard someone else wrote.
//
// So: one WebSocket. Pages connect as AVATARS and announce a name; processes
// connect as CONTROLLERS and send commands at them. Every front door — the CLI,
// the MCP server, anything you write — speaks the same three-line protocol, and
// none of them needs to know a browser exists.
//
//   bun tools/bridge.js            # listens on :4332
//
//   controller → { id, target, cmd }        target: name, or '*' for all
//   bridge     → { id, results: [ { avatar, result } ] }
//   avatar     → { hello: 'avatar', name }  on connect
//
// Commands are the SAME objects `avatar.send()` takes. The bridge does not
// interpret them — it is a wire, and a wire that understands the payload is a
// wire that has to be updated every time the payload grows.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.BRIDGE_PORT || 4332)

/** ws → { role, name } */
const peers = new Map()
/** request id → { resolve, results, expected, timer } */
const pending = new Map()
let nextId = 1

const avatars = () => [...peers.entries()].filter(([, p]) => p.role === 'avatar')

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj))
  } catch {
    /* peer went away mid-write; the close handler cleans up */
  }
}

const server = Bun.serve({
  port: PORT,
  fetch(req, srv) {
    if (srv.upgrade(req)) return
    // A plain GET is a health check — useful from a shell without a WS client.
    const list = avatars().map(([, p]) => p.name)
    return Response.json({ ok: true, avatars: list })
  },
  websocket: {
    open(ws) {
      peers.set(ws, { role: 'controller', name: null })
    },

    message(ws, raw) {
      let msg
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return send(ws, { error: 'not JSON' })
      }

      // A page introducing itself.
      if (msg.hello === 'avatar') {
        peers.set(ws, { role: 'avatar', name: msg.name || `avatar-${peers.size}` })
        return send(ws, { ok: true, registered: msg.name })
      }

      // A page answering a command we forwarded.
      if (msg.replyTo !== undefined) {
        const p = pending.get(msg.replyTo)
        if (!p) return
        p.results.push({ avatar: peers.get(ws)?.name ?? '?', result: msg.result })
        if (p.results.length >= p.expected) p.done()
        return
      }

      // A controller asking for the roster.
      if (msg.cmd?.type === 'avatars') {
        return send(ws, { id: msg.id, results: [{ avatar: 'bridge', result: { avatars: avatars().map(([, p]) => p.name) } }] })
      }

      // A controller sending a command.
      if (msg.cmd) {
        const target = msg.target || '*'
        const targets = avatars().filter(([, p]) => target === '*' || p.name === target)
        if (!targets.length) {
          return send(ws, { id: msg.id, error: `no avatar named "${target}" is connected`, results: [] })
        }
        const rid = nextId++
        const entry = {
          results: [],
          expected: targets.length,
          done() {
            clearTimeout(entry.timer)
            pending.delete(rid)
            send(ws, { id: msg.id, results: entry.results })
          },
        }
        // A page that never answers must not wedge the caller forever.
        entry.timer = setTimeout(entry.done, Number(msg.timeout) || 4000)
        pending.set(rid, entry)
        for (const [target] of targets) send(target, { replyTo: rid, cmd: msg.cmd })
        return
      }

      send(ws, { error: 'expected { cmd } or { hello }' })
    },

    close(ws) {
      peers.delete(ws)
    },
  },
})

console.log(`avatar bridge → ws://localhost:${server.port}  (GET / for the roster)`)
