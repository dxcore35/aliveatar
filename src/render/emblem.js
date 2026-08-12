// ---------------------------------------------------------------------------
// Emblem — the little symbol that floats over the head and says what is going
// on, in place of the cat.
//
// Deliberately mostly SYMBOLS rather than face emoji. The avatar already has a
// face doing the acting; putting a second face above it splits the reader's
// attention and the two rarely agree. A thought cloud, a magnifier or a warning
// triangle adds information instead of competing for it. The handful of face
// emoji here are the ones with no good symbolic equivalent.
//
// Emoji are used rather than shipped icon artwork so the prototype carries no
// asset licence at all. Swapping this map for an icon set later is a one-file
// change — the mount, float and exit animation stay as they are.
// ---------------------------------------------------------------------------

/** state → [glyph, how it should behave] */
const EMBLEM = {
  sleeping: ['💤', 'float'],
  drowsy: ['💤', 'float'],
  'powering-down': ['🌙', 'float'],
  waking: ['☀️', 'pop'],
  idle: [null, null],
  humming: ['🎵', 'float'],
  bored: ['💭', 'float'],

  listening: ['👂', 'pulse'],
  dictating: ['💬', 'pulse'],
  thinking: ['💭', 'float'],
  confused: ['❓', 'wobble'],
  working: ['⚙️', 'spin'],
  writing: ['✍️', 'pulse'],
  searching: ['🔍', 'sweep'],
  loading: ['⏳', 'wobble'],
  progress: ['⏳', 'wobble'],
  orbit: ['🛰️', 'spin'],
  radar: ['📡', 'pulse'],
  spawning: ['✨', 'pop'],
  sending: ['📤', 'pop'],
  receiving: ['📥', 'pop'],
  uploading: ['⬆️', 'pulse'],

  happy: ['✨', 'float'],
  laughing: ['😂', 'shake'],
  playful: ['🎈', 'float'],
  celebrate: ['🎉', 'pop'],
  proud: ['⭐', 'pulse'],
  excited: ['⚡', 'shake'],
  shy: ['🌸', 'float'],
  sad: ['💧', 'float'],
  angry: ['💢', 'shake'],
  suspicious: ['🧐', 'wobble'],
  scared: ['❗', 'shake'],
  surprised: ['❗', 'pop'],
  curious: ['❔', 'wobble'],
  notifying: ['🔔', 'shake'],
  alerting: ['⚠️', 'pulse'],
  bouncing: ['🎈', 'float'],
  dragging: ['✋', 'pulse'],
}

/**
 * The same meanings in the drawn icon set (icons.js) — same behaviours, so an
 * avatar can switch between emoji and icons without any motion changing.
 */
const ICON_EMBLEM = {
  sleeping: ['sleep', 'float'],
  drowsy: ['sleep', 'float'],
  'powering-down': ['moon', 'float'],
  waking: ['sun', 'pop'],
  idle: [null, null],
  humming: ['note', 'float'],
  bored: ['think', 'float'],

  listening: ['ear', 'pulse'],
  dictating: ['chat', 'pulse'],
  thinking: ['think', 'float'],
  confused: ['question', 'wobble'],
  working: ['gear', 'spin'],
  writing: ['pencil', 'pulse'],
  searching: ['search', 'sweep'],
  loading: ['hourglass', 'wobble'],
  progress: ['hourglass', 'wobble'],
  orbit: ['orbit', 'spin'],
  radar: ['signal', 'pulse'],
  spawning: ['spark', 'pop'],
  sending: ['upload', 'pop'],
  receiving: ['download', 'pop'],
  uploading: ['upload', 'pulse'],

  happy: ['spark', 'float'],
  laughing: ['spark', 'shake'],
  playful: ['balloon', 'float'],
  celebrate: ['party', 'pop'],
  proud: ['star', 'pulse'],
  excited: ['bolt', 'shake'],
  shy: ['flower', 'float'],
  sad: ['drop', 'float'],
  angry: ['bolt', 'shake'],
  suspicious: ['eye', 'wobble'],
  scared: ['exclam', 'shake'],
  surprised: ['exclam', 'pop'],
  curious: ['question', 'wobble'],
  notifying: ['bell', 'shake'],
  alerting: ['warn', 'pulse'],
  bouncing: ['balloon', 'float'],
  dragging: ['hand', 'pulse'],
}

/**
 * @param {string} state
 * @param {'emoji'|'icon'} mode
 * @returns {[string|null, string|null]} glyph or icon name, and its behaviour
 */
export function emblemFor(state, mode = 'emoji') {
  return (mode === 'icon' ? ICON_EMBLEM[state] : EMBLEM[state]) || [null, null]
}

// ── Tinting an emoji ────────────────────────────────────────────────────────
// Colour-emoji fonts ignore `color` and `-webkit-text-fill-color` entirely —
// the glyph carries its own palette, and no CSS property will override it. The
// one reliable way to force a colour is to take the glyph's SHAPE and repaint
// it: draw it to a canvas, then composite a solid fill with `source-in`, which
// keeps the alpha and replaces every colour in it.
//
// The result is a silhouette, so the emoji's internal detail goes — but a
// badge at 20 % of an avatar's width was never showing that detail anyway, and
// matching the character's own colour is worth more than the lost shading.
const tintCache = new Map()

export function tintedEmoji(glyph, color, size = 96) {
  const key = `${glyph}|${color}|${size}`
  const hit = tintCache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.font = `${Math.round(size * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.04)

  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  const url = canvas.toDataURL('image/png')
  tintCache.set(key, url)
  return url
}

/** Every glyph, for the lab's reference sheet. */
export const EMBLEM_TABLE = EMBLEM

/**
 * The emblem's own motion, evaluated per frame.
 *
 * Each behaviour gets its own curve rather than one shared bob, because the
 * point of the emblem is to be read at a glance from across a dashboard —
 * a spinning gear and a shaking warning should not move the same way.
 *
 * @returns {{x:number, y:number, rot:number, scale:number}} in pixels/degrees
 */
export function emblemMotion(behaviour, t, life) {
  // Arrival: overshoot up and settle, so it lands rather than appears.
  const inP = Math.min(1, life / 0.42)
  const ease = 1 - Math.pow(1 - inP, 3)
  const pop = inP < 1 ? 0.4 + 0.6 * ease + Math.sin(inP * Math.PI) * 0.22 : 1
  const rise = (1 - ease) * 10

  let x = 0
  let y = -rise
  let rot = 0
  let scale = pop

  switch (behaviour) {
    case 'float':
      y += Math.sin(t * 1.5) * 3
      rot = Math.sin(t * 0.9) * 5
      break
    case 'pulse':
      scale *= 1 + Math.sin(t * 4.2) * 0.08
      break
    case 'spin':
      rot = (t * 90) % 360
      break
    case 'wobble':
      rot = Math.sin(t * 3.1) * 16
      y += Math.sin(t * 1.7) * 2
      break
    case 'shake':
      x += Math.sin(t * 22) * 2.2 * Math.max(0, 1 - ((t * 1.2) % 2))
      rot = Math.sin(t * 19) * 7
      break
    case 'sweep':
      x += Math.sin(t * 2.6) * 7
      rot = Math.sin(t * 2.6) * 12
      break
    case 'pop':
      scale *= 1 + Math.max(0, 1 - life * 3) * 0.25
      y += Math.sin(t * 2.2) * 1.5
      break
    default:
      break
  }
  return { x, y, rot, scale }
}
