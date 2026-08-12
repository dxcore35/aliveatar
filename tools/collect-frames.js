// Frame collector for the documentation animation.
//
// The avatar is SVG driven by JavaScript, so the only place it can actually be
// rendered is a browser. This is a tiny sink the page POSTs rasterised frames
// to, so they land on disk as real files that ffmpeg can turn into a GIF —
// rather than round-tripping megabytes of base64 through anything else.
//
//   bun tools/collect-frames.js          # listens on :4331
//   (drive the page, which POSTs /frame/0001 … )
//   ffmpeg -i docs/frames/%04d.png ...
const ROOT = import.meta.dir.replace(/\/tools$/, '')
const OUT = `${ROOT}/docs/frames`

await Bun.$`mkdir -p ${OUT}`.quiet()

let count = 0
Bun.serve({
  port: 4331,
  async fetch(req) {
    const url = new URL(req.url)
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

    const m = url.pathname.match(/^\/frame\/(\d+)$/)
    if (req.method === 'POST' && m) {
      const buf = await req.arrayBuffer()
      await Bun.write(`${OUT}/${m[1].padStart(4, '0')}.png`, buf)
      count++
      return new Response('ok', { headers: cors })
    }
    if (url.pathname === '/count') return new Response(String(count), { headers: cors })
    if (url.pathname === '/reset') {
      count = 0
      return new Response('reset', { headers: cors })
    }
    return new Response('frame collector', { headers: cors })
  },
})

console.log(`frame collector → http://localhost:4331  (writing to ${OUT})`)
