// ---------------------------------------------------------------------------
// Emblem — the little symbol that floats over the head and says what is going
// on, in place of the cat.
//
// Deliberately SYMBOLS rather than faces. The avatar already has a face doing
// the acting; putting a second face above it splits the reader's attention and
// the two rarely agree. A thought cloud, a magnifier or a warning triangle adds
// information instead of competing for it.
//
// Every symbol is drawn here, in `render/icons.js`, from primitives. Nothing is
// a font glyph and nothing is downloaded, so the whole project stays MIT with
// no third-party asset in it.
// ---------------------------------------------------------------------------

/**
 * The same meanings in the drawn icon set (icons.js) — same behaviours, so an
 * behaviour is named separately from the symbol, so the set can change
 * without any motion changing.
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
 * @returns {[string|null, string|null]} icon name, and how it should behave
 */
export function emblemFor(state) {
  return ICON_EMBLEM[state] || [null, null]
}

/** Every symbol, for the lab's reference sheet. */
export const EMBLEM_TABLE = ICON_EMBLEM

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
