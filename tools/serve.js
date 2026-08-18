// Tiny static server for the draft. ES modules need http://, so this is the way
// to open index.html.
//
//   bun run dev   →  http://localhost:4330
const ROOT = import.meta.dir.replace(/\/tools$/, '')
const PORT = Number(process.env.PORT || 4330)

const TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
  json: 'application/json',
  md: 'text/markdown; charset=utf-8',
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    let path = decodeURIComponent(url.pathname)
    if (path === '/' || path.endsWith('/')) path += 'index.html'
    // Keep the server inside the project directory.
    const file = Bun.file(`${ROOT}${path}`.replace(/\/\.\./g, ''))
    if (!(await file.exists())) return new Response('not found', { status: 404 })
    const ext = path.split('.').pop()
    return new Response(file, {
      headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' },
    })
  },
})

console.log(`avatar-motion → http://localhost:${PORT}`)
