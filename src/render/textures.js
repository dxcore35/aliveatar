// ---------------------------------------------------------------------------
// Textures — the paper grain and fabric weave that stop the avatar looking like
// a flat vector fill.
//
// These could be SVG filters, and feTurbulence would give a nicer noise. It is
// also the classic way to melt a laptop: a filter re-runs whenever anything in
// its subtree changes, and this avatar has a face moving inside it sixty times
// a second.
//
// So the noise is generated ONCE, into a small canvas, at module load, and
// handed out as a data URI. After that it is an ordinary image the compositor
// tiles for free — no per-frame GPU work at all, on any number of avatars.
// ---------------------------------------------------------------------------

const cache = new Map()

function makeCanvas(size) {
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(size, size) : document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function toDataURL(canvas) {
  if (canvas.convertToBlob) {
    // OffscreenCanvas has no synchronous data URL; fall back to a real canvas.
    const c = document.createElement('canvas')
    c.width = canvas.width
    c.height = canvas.height
    c.getContext('2d').drawImage(canvas, 0, 0)
    return c.toDataURL('image/png')
  }
  return canvas.toDataURL('image/png')
}

/** Deterministic 32-bit PRNG, so the grain is identical on every load. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

/**
 * Paper grain: fine monochrome noise, drawn as a translucent overlay in
 * `overlay` blend so it darkens darks and lightens lights, the way ink on
 * textured stock behaves.
 */
export function grainTexture(size = 128) {
  const key = `grain:${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(size, size)
  const rand = rng(0x9e3779b9)
  for (let i = 0; i < img.data.length; i += 4) {
    // Two octaves: fine speckle plus a slower blotch, so it does not read as TV static.
    const fine = rand()
    const v = 128 + (fine - 0.5) * 170
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/**
 * Fabric: a fine twill weave plus irregular slubs. Multiplied over the clothes
 * so the outfit reads as cloth rather than a filled shape.
 */
export function weaveTexture(size = 64) {
  const key = `weave:${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)

  // Twill: two crossing sets of thin diagonals at different weights.
  ctx.lineWidth = 1
  for (let i = -size; i < size * 2; i += 3) {
    ctx.strokeStyle = 'rgba(255,255,255,0.20)'
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + size, size)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'
    ctx.beginPath()
    ctx.moveTo(i + 1.4, 0)
    ctx.lineTo(i + 1.4 + size, size)
    ctx.stroke()
  }
  for (let i = -size; i < size * 2; i += 6) {
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'
    ctx.beginPath()
    ctx.moveTo(i + size, 0)
    ctx.lineTo(i, size)
    ctx.stroke()
  }
  // Slubs — the thicker threads that make real cloth uneven.
  const rand = rng(0x51ed270b)
  for (let i = 0; i < size * 1.2; i++) {
    const x = rand() * size
    const y = rand() * size
    const len = 2 + rand() * 5
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + len)
    ctx.stroke()
  }
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/** Hair: soft directional streaks, so a block of hair has strands in it. */
export function hairTexture(size = 96) {
  const key = `hair:${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  const rand = rng(0x2545f491)
  for (let i = 0; i < size * 2.2; i++) {
    const x = rand() * size
    const y = rand() * size
    const len = 6 + rand() * 22
    const bend = (rand() - 0.5) * 8
    ctx.strokeStyle = rand() > 0.45 ? `rgba(255,255,255,${0.05 + rand() * 0.12})` : `rgba(0,0,0,${0.05 + rand() * 0.12})`
    ctx.lineWidth = 0.6 + rand() * 1.1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + bend, y + len * 0.5, x + bend * 0.4, y + len)
    ctx.stroke()
  }
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/**
 * The shared <defs> every avatar's SVG gets.
 *
 * The gradient stops are written in terms of the SAME CSS custom properties
 * Humation already uses (`--hm-skin`, `--hm-clothes`, …) via color-mix, so the
 * live recolouring still works: when the engine runs an agent's outfit hue, the
 * gradient, its shadow and its highlight all follow, because they are all
 * derived from that one property rather than baked.
 *
 * Light comes from the upper left, in user space, so head, body and legs are
 * lit by ONE light instead of each shape being shaded on its own. That single
 * change is most of the difference between "vector art" and "illustration".
 */
export function buildDefs(id) {
  const g = (name) => `${id}-${name}`
  const shade = (v, amt, toward) => `color-mix(in oklab, var(${v}) ${100 - amt}%, ${toward})`

  const ramp = (name, v, lift, drop, tone) => `
    <linearGradient id="${g(name)}" gradientUnits="userSpaceOnUse" x1="6" y1="-4" x2="72" y2="86">
      <stop offset="0"    stop-color="${shade(v, lift, '#ffffff')}"/>
      <stop offset="0.42" stop-color="var(${v})"/>
      <stop offset="1"    stop-color="${shade(v, drop, tone)}"/>
    </linearGradient>`

  return `
  <defs>
    ${ramp('skin', '--hm-skin', 22, 26, '#5b3b2a')}
    ${ramp('clothes', '--hm-clothes', 17, 33, '#160d20')}
    ${ramp('bottom', '--hm-bottom', 14, 30, '#0b0a14')}
    ${ramp('hair', '--hm-hair', 30, 18, '#000000')}

    <!-- Contact shadow under the figure. -->
    <radialGradient id="${g('ground')}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(0,0,0,0.30)"/>
      <stop offset="0.6" stop-color="rgba(0,0,0,0.12)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>

    <!-- Occlusion under the hairline, and the light wrapping the far cheek. -->
    <linearGradient id="${g('occl')}" gradientUnits="objectBoundingBox" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="rgba(40,22,12,0.34)"/>
      <stop offset="0.34" stop-color="rgba(40,22,12,0.06)"/>
      <stop offset="1" stop-color="rgba(40,22,12,0)"/>
    </linearGradient>
    <linearGradient id="${g('rim')}" gradientUnits="objectBoundingBox" x1="1" y1="0.1" x2="0.35" y2="0.9">
      <stop offset="0" stop-color="rgba(255,255,255,0.42)"/>
      <stop offset="0.4" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>

    <pattern id="${g('weave')}" width="12" height="12" patternUnits="userSpaceOnUse">
      <image href="${weaveTexture()}" width="12" height="12" preserveAspectRatio="none"/>
    </pattern>
    <pattern id="${g('hairtex')}" width="16" height="16" patternUnits="userSpaceOnUse">
      <image href="${hairTexture()}" width="16" height="16" preserveAspectRatio="none"/>
    </pattern>
    <pattern id="${g('grain')}" width="13" height="13" patternUnits="userSpaceOnUse">
      <image href="${grainTexture()}" width="13" height="13" preserveAspectRatio="none"/>
    </pattern>
  </defs>`
}
