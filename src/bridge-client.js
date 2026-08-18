// ---------------------------------------------------------------------------
// Bridge client — lets an outside process drive an avatar on this page.
//
// Opt-in, never automatic: a page that has not asked for this opens no socket
// and behaves exactly as before. An avatar that silently accepts commands from
// a local port is a surprise nobody wants in a product build.
//
//   import { connectBridge } from './bridge-client.js'
//   connectBridge(document.querySelector('avatar-motion'), { name: 'stage' })
//
// or, in the lab, add ?bridge to the URL.
//
// It reconnects, because the interesting case is exactly the one where the
// bridge restarts while the page stays open.
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement|() => HTMLElement} avatar  the element, or a getter for
 *        it — the lab rebuilds its avatar on every identity change, so a live
 *        lookup is what keeps the connection pointed at the current one.
 * @param {{name?: string, url?: string}} [opts]
 * @returns {{ close: () => void }}
 */
export function connectBridge(avatar, opts = {}) {
  const name = opts.name || 'avatar'
  const url = opts.url || `ws://${location.hostname}:4332`
  const get = typeof avatar === 'function' ? avatar : () => avatar

  let ws = null
  let closed = false
  let retry = 500

  const open = () => {
    if (closed) return
    ws = new WebSocket(url)

    ws.onopen = () => {
      retry = 500
      ws.send(JSON.stringify({ hello: 'avatar', name }))
      console.info(`[avatar-motion] bridged as "${name}" → ${url}`)
    }

    ws.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if (msg.replyTo === undefined) return
      let result
      try {
        // The command goes through the SAME entry point the JS API uses, so a
        // remote caller can never reach anything a local one cannot.
        result = get()?.send(msg.cmd) ?? { error: 'no avatar on this page' }
      } catch (err) {
        result = { error: String(err?.message || err) }
      }
      ws.send(JSON.stringify({ replyTo: msg.replyTo, result }))
    }

    ws.onclose = () => {
      if (closed) return
      // Back off, but keep trying: the bridge restarting is the normal case.
      setTimeout(open, retry)
      retry = Math.min(retry * 2, 8000)
    }
    // `onclose` always follows, so the retry is scheduled there and not twice.
    ws.onerror = () => ws.close()
  }

  open()
  return {
    close() {
      closed = true
      ws?.close()
    },
  }
}
