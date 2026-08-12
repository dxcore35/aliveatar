// ---------------------------------------------------------------------------
// Humation bridge — WHO the avatar is, and where its face lives.
//
// Humation draws a modular person: bottom + body + head + item + glasses, each
// slot picked deterministically from a seed, each recoloured through CSS custom
// properties. It is a still illustration — the eyes are two little paths baked
// into the head art.
//
// This module does three things:
//   1. builds that person (palette rules ported from AgentDesk's EntityIcon),
//   2. CUTS the two baked eyes out of the head layer,
//   3. measures where they were, and turns that into a face sphere the motion
//      engine can rotate eyes around.
//
// Step 3 is the whole merge. The gist's engine needs a sphere (centre, radius,
// two base longitudes); a Humation head is a flat drawing. Measuring the skin
// path and the two eye paths recovers exactly those numbers.
// ---------------------------------------------------------------------------
import { createAvatar, humation1 } from '../vendor/humation.bundle.js'
import { buildDefs } from './render/textures.js'
import { repaint, shadingFor, groundShadow, grainWash } from './render/shading.js'

// ── Seeded picking ──────────────────────────────────────────────────────────
/** FNV-1a — same hash AgentDesk uses, so a given id picks the same colours. */
export function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const pick = (arr, key) => arr[hash(key) % arr.length]

/**
 * Pick from a palette, but skip anything too close in lightness to `against`.
 *
 * Hair and skin are chosen independently from the seed, and often enough the
 * two land within a few points of each other — which erases the hairline and
 * leaves a face-shaped blob. Walking the palette from the seeded index keeps
 * the choice deterministic while guaranteeing the two read apart.
 */
function pickContrasting(arr, key, against, minDelta = 20) {
  const target = lightnessOf(against)
  const start = hash(key) % arr.length
  let best = arr[start]
  let bestDelta = -1
  for (let i = 0; i < arr.length; i++) {
    const candidate = arr[(start + i) % arr.length]
    const delta = Math.abs(lightnessOf(candidate) - target)
    if (delta >= minDelta) return candidate
    if (delta > bestDelta) {
      bestDelta = delta
      best = candidate
    }
  }
  return best // nothing clears the bar — take the most different there is
}

/** Perceptual-ish lightness, 0..100. */
function lightnessOf(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return (0.299 * r + 0.587 * g + 0.114 * b) * 100
}

// Humation gives 8 tops and 8 bottoms. Colour is what turns those into a crowd
// that does not repeat: 34 outfit tones across warm, cool, earth and jewel
// families, so two people in the same cut still read as two people.
const CLOTHES = [
  '#3457D5', '#2E7D6B', '#C2410C', '#7C3AED', '#0E7490', '#B45309',
  '#BE185D', '#4338CA', '#15803D', '#0F766E', '#9333EA', '#0284C7',
  '#B91C1C', '#A16207', '#4D7C0F', '#047857', '#0369A1', '#6D28D9',
  '#A21CAF', '#DB2777', '#E11D48', '#EA580C', '#CA8A04', '#65A30D',
  '#059669', '#0891B2', '#2563EB', '#7E22CE', '#C026D3', '#9F1239',
  '#78716C', '#44403C', '#1E3A5F', '#3F3F46',
]
// Human complexions. The avatar used to paint every person the same flat
// white, which is not a skin colour and made the whole crowd look like one
// person in different wigs. This is an even spread from fair through to deep,
// warm and cool sides of each, so a list of customers looks like a room full
// of people.
// The deep end stops at a warm mid-brown, never near-black: the line art is
// drawn in near-black ink, so a very dark complexion swallows its own outline
// and the face stops being readable — in light mode AND in dark mode.
const HUMAN_SKIN = [
  '#FBE3D2', '#F7D9C4', '#F2CDB4', '#EDBE9E', '#E5AE8B', '#DDA179',
  '#D2906A', '#C4805C', '#B87456', '#AE6C4C', '#A66448', '#9C5E42',
  '#946B4E', '#8A5A3E', '#F6DFCE', '#EAC2A6', '#CE9C74', '#B98863',
]
// Natural human hair, widened: black through to grey and dyed reds/blondes.
const HUMAN_HAIR = [
  '#2B2B2B', '#0B0B0B', '#4A3728', '#6D4C41', '#8D6E63', '#A55728', '#C2410C', '#5C3A21',
  '#1C1917', '#3E2723', '#795548', '#B08968', '#D6A55C', '#E3C08D', '#8B4513', '#A0522D',
  '#9E9E9E', '#BDBDBD', '#E0E0E0', '#7F1D1D', '#B45309',
]
// Agents are not people, so their hair does not have to be a hair colour.
const AGENT_HAIR = [
  '#16181d', '#1F2937', '#0F172A', '#2E1065', '#4C1D95', '#7C3AED', '#9333EA',
  '#C026D3', '#0891B2', '#0EA5E9', '#06B6D4', '#10B981', '#22C55E', '#EAB308',
  '#F97316', '#EF4444', '#EC4899', '#F43F5E', '#84CC16', '#14B8A6',
]
const HUMAN_BG = ['#F1EFE8', '#E8F3F0', '#E9EEFB', '#FBEAF6', '#FAEEDA', '#E6F4F7', '#EAF3DE', '#F4ECFB']
const HUMAN_BOTTOM = [
  '#33415C', '#5B21B6', '#374151', '#1F2937', '#4B5563', '#3F3F46',
  '#292524', '#1E293B', '#3730A3', '#164E63', '#065F46', '#7C2D12',
  '#0C4A6E', '#581C87', '#831843', '#422006',
]
const DARK = '#16181d'

// Humation ships three glasses parts and only ONE of them is "none", so a plain
// seed puts glasses on roughly two avatars in three. They are also drawn low,
// with opaque white lenses that fight the animated eyes. So they are off by
// default everywhere, and only appear deliberately:
//   • a seeded minority of PEOPLE wear them, as reading glasses
//   • an AGENT puts them on for the length of a tool call, and takes them off
const HUMAN_GLASSES_RATE = 0.18

function tint(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16)
  const c = (v) => Math.max(0, Math.min(255, v))
  return '#' + ((c((n >> 16) + amt) << 16) | (c(((n >> 8) & 255) + amt) << 8) | c((n & 255) + amt))
    .toString(16).padStart(6, '0')
}

/**
 * Agent = AI mascot: the signature colour IS the skin, and the hair is free to
 * be a colour no person's hair has ever been. An agent that reads as a person
 * with dyed hair is a worse outcome than one that reads as clearly synthetic.
 */
export function agentColors(signature, id) {
  // The signature colour is whatever the caller hands us, and it becomes the
  // agent's FACE. A very dark one produces a black-skinned figure whose own
  // near-black outline disappears into it — so it gets floored into a range
  // that still reads as a face, while keeping the hue it was given.
  const skin = readableSkin(signature)
  return {
    skin,
    hair: pickContrasting(AGENT_HAIR, id + ':hair', skin, 22),
    clothes: pickContrasting(CLOTHES, id + ':clothes', skin, 14),
    bottom: pick(CLOTHES, id + ':bottom'),
    stroke: DARK,
    background: tint(signature, 165),
  }
}

// Hair that has greyed. Used in place of the normal palette as age rises, so an
// older customer does not read as a twenty-year-old in a cardigan.
const GREY_HAIR = ['#9E9E9E', '#BDBDBD', '#D6D6D6', '#E8E8E8', '#8A8A8A', '#B0AAA4', '#C9C2BA', '#7C7671']

/**
 * Everything age changes about an avatar.
 *
 * Age is real information a CRM usually has, and it is the single strongest
 * signal for how a person looks and moves — stronger than any random seed. When
 * it is absent nothing here applies and the seed decides, exactly as before.
 *
 * @param {number|undefined} age
 */
export function ageProfile(age) {
  if (!age || !Number.isFinite(age)) return { grey: 0, glassesBias: 0, pace: 1, stoop: 0 }
  // Greying starts around 35 and is well advanced by 70.
  const grey = Math.max(0, Math.min(1, (age - 35) / 35))
  return {
    grey,
    // Reading glasses become common from about 45 — presbyopia is near-universal.
    glassesBias: Math.max(0, Math.min(0.62, (age - 42) / 40)),
    // Older people move a little less, and more slowly.
    pace: age > 60 ? 1 - Math.min(0.32, (age - 60) / 110) : age < 24 ? 1.1 : 1,
    stoop: Math.max(0, Math.min(1, (age - 62) / 30)),
  }
}

/** Customer = person: a real complexion, and everything else varies by id. */
export function humanColors(id, age) {
  const skin = pick(HUMAN_SKIN, id + ':skin')
  const { grey } = ageProfile(age)
  // Above the greying threshold the hair comes from the grey palette instead,
  // with the crossover itself seeded so a room of 50-year-olds is not uniformly
  // half-grey.
  const greyed = grey > 0 && (hash(id + ':greying') % 1000) / 1000 < grey
  const palette = greyed ? GREY_HAIR : HUMAN_HAIR
  return {
    skin,
    hair: pickContrasting(palette, id + ':hair', skin, 20),
    clothes: pickContrasting(CLOTHES, id + ':clothes', skin, 12),
    bottom: pick(HUMAN_BOTTOM, id + ':bottom'),
    stroke: '#2a2a2a',
    background: pick(HUMAN_BG, id + ':bg'),
  }
}

/**
 * Force a colour into a range that works as SKIN.
 *
 * Too dark and the near-black outline vanishes into the face; too light and
 * the face vanishes into a light page. Hue and saturation are kept exactly, so
 * an agent still reads as "the blue one" or "the green one" — only the
 * lightness is pulled into a usable band.
 */
export function readableSkin(hex) {
  const [h, s] = hexToHsl(hex)
  // Floor on PERCEIVED luminance, not on HSL lightness. HSL treats a saturated
  // purple at L=34 as the same brightness as a grey at L=34, and the eye does
  // not — that purple still reads as near-black, which is exactly how a "fixed"
  // colour came back looking black anyway. So walk lightness up until the
  // luminance the eye actually sees clears the bar.
  const MIN = 38
  const MAX = 84
  let lo = 0
  let hi = 100
  let out = hex
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    // Very dark colours are usually very saturated too; opening one up without
    // easing saturation gives a neon face rather than a skin.
    out = hslToHex(h, Math.min(s, 68), mid)
    const lum = lightnessOf(out)
    if (lum < MIN) lo = mid
    else hi = mid
  }
  const lit = lightnessOf(out)
  if (lit > MAX) {
    // Too bright the other way — the outline stops holding the shape.
    for (let i = 0; i < 14; i++) {
      const [hh, ss, ll] = hexToHsl(out)
      if (lightnessOf(out) <= MAX) break
      out = hslToHex(hh, ss, ll - 3)
    }
  }
  return out
}

/** Does this person wear reading glasses? Deterministic, and a small minority. */
export function wearsGlasses(kind, id, age) {
  if (kind !== 'customer') return false
  const rate = HUMAN_GLASSES_RATE + ageProfile(age).glassesBias
  return (hash(id + ':specs') % 1000) / 1000 < rate
}

/**
 * Dark-mode palette.
 *
 * The character must NOT change — same person, same hairstyle, same outfit,
 * only re-toned. Two things need care beyond dimming the tile: human hair runs
 * near-black and trousers run dark navy, so on a dark page they merge into it
 * and the avatar reads as a floating face. Both get a lightness floor. The ink
 * line lifts off pure black for the same reason.
 */
export function darkColors(c, kind = 'agent') {
  const [bh, bs] = hexToHsl(c.background)
  // Lightness alone is not enough for the CLOTHES. Raising a near-grey colour
  // just gives a lighter grey, which is how the whole figure turned into a
  // silhouette on a dark page — so those get a saturation floor too.
  //
  // HAIR on a person does NOT get one: forcing saturation into brown or grey
  // hair tints it towards a colour no hair is. People keep natural hair in
  // both themes; only an agent's hair is allowed to be a colour.
  const human = kind === 'customer'
  return {
    ...c,
    background: hslToHex(bh, Math.min(bs, 26), 14),
    hair: human ? floorLight(c.hair, 40) : lift(c.hair, 42, 18),
    bottom: lift(c.bottom, 40, 24),
    clothes: lift(c.clothes, 46, 34),
    // The ink line has to stay VISIBLE against a dark page. Left at near-black
    // it reads fine inside the figure but the outer silhouette merges into the
    // background and the character loses its edge entirely.
    stroke: floorLight(c.stroke, 32),
  }
}

/** Raise a colour to at least `minL` lightness AND `minS` saturation. */
function lift(hex, minL, minS) {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, Math.max(s, minS), Math.max(l, minL))
}

function hexToHsl(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  if (d === 0) return [0, 0, l * 100]
  let h
  if (mx === r) h = 60 * (((g - b) / d) % 6)
  else if (mx === g) h = 60 * ((b - r) / d + 2)
  else h = 60 * ((r - g) / d + 4)
  if (h < 0) h += 360
  return [h, (d / (1 - Math.abs(2 * l - 1))) * 100, l * 100]
}

function hslToHex(h, sPct, lPct) {
  const s = sPct / 100
  const l = lPct / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = l - c / 2
  const t = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(t[0])}${to(t[1])}${to(t[2])}`
}

function floorLight(hex, minL) {
  const [h, s, l] = hexToHsl(hex)
  return l >= minL ? hex : hslToHex(h, s, minL)
}

// ── Gender ──────────────────────────────────────────────────────────────────
const MALE_HEADS = ['short', 'curly-short', 'short-bangs', 'side-swept-short', 'messy-short']
const FEMALE_HEADS = [
  'long-straight', 'wavy-long', 'curly-long', 'blunt-long', 'side-swept-long', 'braids',
  'ponytail', 'low-ponytail', 'low-twin-tails', 'bun', 'low-side-bun', 'low-twin-buns',
  'wavy-medium', 'flipped-long', 'lob', 'side-swept-lob', 'fluffy-bob', 'round-bob', 'blunt-bob',
]
const MALE_BOTTOMS = ['wide-pants', 'tapered-pants', 'cropped-pants']
const FEMALE_BOTTOMS = ['long-skirt', 'midi-skirt', 'flared-skirt', 'mini-skirt', 'culottes']

// Hair that reads as older — shorter, tidier, pinned up. Long loose hair on a
// seventy-year-old is possible but it is not what a room of them looks like.
const OLDER_HEADS = ['short', 'curly-short', 'side-swept-short', 'bun', 'low-side-bun', 'lob', 'blunt-bob', 'round-bob']
// Every top and bottom Humation has, so nothing sits unused.
const ALL_BODIES = ['cropped-shirt', 'tank-top', 'drape-tee', 'polo', 'tee', 'shirt', 'jacket', 'hoodie']
// Older people skew towards the more covered tops.
const OLDER_BODIES = ['shirt', 'polo', 'jacket', 'hoodie', 'tee', 'drape-tee']
const YOUNGER_BODIES = ['cropped-shirt', 'tank-top', 'tee', 'drape-tee', 'hoodie', 'polo']

/**
 * Which parts this person gets.
 *
 * Previously only hair and lower body varied, and the TOP was left to the raw
 * seed — so a list of customers cycled through the same handful of shirts with
 * different hair. Now every slot is chosen, and age biases the pools, which is
 * where most of the extra variety comes from.
 */
export function genderSelections(gender, id, age) {
  const { grey } = ageProfile(age)
  const older = grey > 0.45
  const bodies = age ? (older ? OLDER_BODIES : age < 30 ? YOUNGER_BODIES : ALL_BODIES) : ALL_BODIES
  const sel = { body: pick(bodies, id + ':body') }

  if (gender === 'male') {
    sel.head = pick(older ? OLDER_HEADS.filter((h) => MALE_HEADS.includes(h) || !FEMALE_HEADS.includes(h)) : MALE_HEADS, id + ':head')
    sel.bottom = pick(MALE_BOTTOMS, id + ':bottom')
  } else if (gender === 'female') {
    sel.head = pick(older ? OLDER_HEADS : FEMALE_HEADS, id + ':head')
    sel.bottom = pick(FEMALE_BOTTOMS, id + ':bottom')
  } else if (older) {
    sel.head = pick(OLDER_HEADS, id + ':head')
  }
  return sel
}

/** Every part name Humation offers, grouped by slot — the "modular" axis. */
export const PARTS = humation1.parts.reduce((acc, p) => {
  ;(acc[p.selectionSlot] ||= []).push(p.name)
  return acc
}, {})

// ── Geometry ────────────────────────────────────────────────────────────────
// The head layer is inlined at translate(0, HEAD_DY) inside a viewBox of
// -4 -4.5 88 88. Every head part in humation-1 draws its two eyes at exactly
// these boxes, in head-art coordinates — checked against all 24 heads.
const HEAD_DY = -0.5
export const EYE_BOX_L = [28.2, 35.1, 30.1, 37.3]
export const EYE_BOX_R = [32.7, 35.4, 34.6, 37.7]
const BOX_TOLERANCE = 0.6

/** Rough bbox of a path `d`, from its raw coordinate pairs. Control points make
 *  it slightly generous, which is fine — it is only used to identify and place. */
function bboxOf(d) {
  const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g)
  if (!nums || nums.length < 4) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = +nums[i]
    const y = +nums[i + 1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= BOX_TOLERANCE)

/**
 * The plain Humation avatar — baked eyes still in place. Used as the "before"
 * side of the comparison, and as the input buildAvatar() then cuts.
 */
export function composeOriginal({ seed, kind = 'agent', color = '#3B82F6', gender, age, selections, transparentBg = false, theme = 'light' }) {
  const base = kind === 'customer' ? humanColors(seed, age) : agentColors(color, seed)
  const colors = theme === 'dark' ? darkColors(base, kind) : base
  const sel = {
    // Glasses off unless this seed is one of the few people who wear them, or
    // the caller asked for a specific pair.
    glasses: wearsGlasses(kind, seed, age) ? (hash(seed + ':specstyle') % 2 ? 'round' : 'tiny') : 'none',
    ...(genderSelections(gender, seed, age) || {}),
    ...(selections || {}),
  }

  const svg = createAvatar(humation1, {
    seed,
    ...(Object.keys(sel).length ? { selections: sel } : {}),
    colors,
  })
    .toString()
    // Humation always paints a fixed #F6F5F4 frame rect that ignores the
    // background colour, and roots the <svg> at 88x88. Same two rewrites
    // AgentDesk does, so the avatar takes its container's size and our tint.
    .replace(/(<rect x="-4" y="-4\.5" width="88" height="88" fill=")#F6F5F4("\s*\/>)/,
      `$1${transparentBg ? 'none' : colors.background}$2`)
    .replace('width="88" height="88"', 'width="100%" height="100%"')

  return { svg, colors }
}

/**
 * Build one avatar.
 *
 * @returns {{svg:string, colors:object, face:object, strippedEyes:number}}
 *   `svg` has the baked eyes removed and an empty <g id="face-slot"> where the
 *   motion engine draws. `face` carries the sphere the engine rotates around.
 */
export function buildAvatar(config) {
  const { svg: raw, colors } = composeOriginal(config)
  let svg = raw
  // Humation recolours through CSS custom properties on the <svg> element, so
  // the outfit can be re-tinted live without rebuilding a single path.
  svg = svg.replace('<svg ', '<svg id="am-root" ')

  // Isolate the head layer group.
  const headMark = svg.indexOf('data-hm-layer-slot="head"')
  if (headMark < 0) throw new Error('humation: no head layer in composed avatar')
  const headStart = svg.lastIndexOf('<g', headMark)
  const nextMark = svg.indexOf('data-hm-layer-slot="item"', headMark)
  const headEnd = nextMark < 0 ? svg.length : svg.lastIndexOf('<g', nextMark)
  const head = svg.slice(headStart, headEnd)

  // Find the two baked eyes — and the skin path, which gives the head sphere.
  const paths = [...head.matchAll(/<path d="([^"]+)"\s*fill="([^"]*)"\s*\/>/g)]
  let skinBox = null
  const eyes = []
  for (const m of paths) {
    const box = bboxOf(m[1])
    if (!box) continue
    if (m[2].includes('--hm-skin') && !skinBox) skinBox = box
    if (near(box, EYE_BOX_L) || near(box, EYE_BOX_R)) eyes.push({ tag: m[0], box })
  }
  if (eyes.length !== 2) {
    throw new Error(`humation: expected 2 baked eyes in the head art, found ${eyes.length} — the asset pack changed, re-measure EYE_BOX_L/R`)
  }
  if (!skinBox) throw new Error('humation: no skin path in the head art')

  const lenses = findLenses(svg)

  // Cut the baked eyes, then open a slot for the live ones. The slot goes
  // AFTER the head group, not inside it: inside, the skin and hair paths would
  // paint over the eyes, and it would inherit the head's translate on top of
  // coordinates that already account for it. After the head group, the eyes sit
  // above the face and still below glasses — which is where they belong.
  // Cut the baked eyes and wrap the head so the engine can move it on a turn.
  let newHead = head
  for (const e of eyes) newHead = newHead.replace(e.tag, '')
  svg = svg.slice(0, headStart) + '<g id="head-shift">' + newHead + '</g>' + svg.slice(headEnd)

  // The BODY gets its own wrapper too, for breathing. Chest rise has to happen
  // on the body alone — scaling the whole figure just makes it grow.
  const bodyMark = svg.indexOf('data-hm-layer-slot="body"')
  if (bodyMark >= 0) {
    const bodyStart = svg.lastIndexOf('<g', bodyMark)
    const afterBody = svg.indexOf('data-hm-layer-slot="head"', bodyMark)
    const bodyEnd = afterBody < 0 ? svg.length : svg.lastIndexOf('<g', afterBody)
    let body = svg.slice(bodyStart, bodyEnd)

    // THE NECK IS PART OF THE BODY LAYER, not the head — which is why the head
    // kept detaching from it. Breathing scaled the neck away from the chin, and
    // rotating the head swung the chin off the neck.
    //
    // The fix is to move the neck WITH the head while leaving it where it is in
    // the z-order: it is the topmost skin path in the body layer, drawn before
    // the shirt, so wrapping just that path lets it rotate with the head and
    // still slide underneath the collar. The join never opens.
    const neckPath = [...body.matchAll(/<path d="([^"]+)"\s*fill="var\(--hm-skin[^"]*"\s*\/>/g)]
      .map((m) => ({ tag: m[0], box: bboxOf(m[1]) }))
      .filter((p) => p.box)
      .sort((a, b) => a.box[1] - b.box[1])[0]
    if (neckPath) body = body.replace(neckPath.tag, `<g id="neck-shift">${neckPath.tag}</g>`)

    svg = svg.slice(0, bodyStart) + '<g id="body-shift">' + body + '</g>' + svg.slice(bodyEnd)
  }

  // A companion animal sitting on the head has its own baked eyes, and a still
  // pet on a living face reads as taxidermy. Wrap them so the engine can blink
  // them on their own rhythm.
  const pets = markPetEyes(svg)
  svg = pets.svg

  // The live eyes go LAST, above every other layer.
  //
  // Humation wears its round glasses low, with the eyes peeking over the rims,
  // and the lenses are opaque white. Drawing the eyes in their old place would
  // let a lens swallow any expression that opens wider than the baked dots —
  // the face would visibly stop animating on every avatar with glasses. On top
  // of the stack the eyes are always the thing you see.
  //
  // #face-shift carries the same nudge as #head-shift, so head and eyes still
  // move as one even though they are no longer siblings.
  svg = svg.replace(/<\/svg>\s*$/, '<g id="face-shift"><g id="face-slot"></g></g></svg>')

  // Agents get a spare pair of glasses parked off-screen. An agent running a
  // tool puts them on — a small visible tell that work is happening, on a
  // character that otherwise only has eyes to act with. Avatars that already
  // wear glasses do not get a second pair.
  let toolGlasses = false
  if ((config.kind || 'agent') !== 'customer' && !lenses.length) {
    const spare = spareGlassesLayer(config)
    if (spare) {
      svg = svg.replace(/<\/svg>\s*$/, `<g id="tool-glasses" opacity="0">${spare}</g></svg>`)
      toolGlasses = true
    }
  }

  // ── Look pass ───────────────────────────────────────────────────────────
  // Everything above is structure. This is what makes it read as illustration
  // rather than as a flat vector fill: one light across the whole figure,
  // texture in the cloth and hair, occlusion under the hairline, a rim on the
  // far edge, a contact shadow on the ground, and one grain over all of it.
  const defsId = `am${hash(String(config.seed || 'a')).toString(36)}`
  if (config.look !== false) {
    svg = repaint(svg, defsId)
    svg = svg.replace(/(<rect x="-4" y="-4\.5"[^>]*\/>)/, `$1${groundShadow(defsId)}`)
    svg = addShading(svg, defsId)
    svg = svg.replace('<svg ', '<svg ').replace(/(<svg[^>]*>)/, `$1${buildDefs(defsId)}`)
  }

  // One wrapper around the whole figure, for the mount animation and bounces.
  svg = svg.replace(/(<rect x="-4" y="-4\.5"[^>]*\/>)/, '$1<g id="root-shift" style="isolation:isolate">')

  // Grain sits at the very top, over everything including the eyes, so the
  // whole avatar reads as printed on one surface. It has to stay quiet: at any
  // strength you actually notice, it stops being paper and becomes noise.
  //
  // It closes root-shift FIRST and then paints, so the grain is outside every
  // transform. Inside, the figure's breathing and hops stretched the texture
  // with them and the whole backdrop appeared to squeeze — the surface an
  // avatar is drawn on does not move when the avatar does.
  svg = svg.replace(/<\/svg>\s*$/, `</g>${config.look === false ? '' : grainWash(defsId, 0.13)}</svg>`)

  const lensSlots = lenses.length ? lenses : toolGlasses ? findLenses(svg) : []

  return {
    svg,
    colors,
    face: faceFrom(skinBox, eyes, lenses, variationFor(config.seed || 'a')),
    // Where the eyes move to while the tool glasses are on, so they keep
    // fitting the lenses instead of hiding behind them.
    faceGlassed: lensSlots.length ? faceFrom(skinBox, eyes, lensSlots, variationFor(config.seed || 'a')) : null,
    strippedEyes: eyes.length,
    petEyes: pets.count,
    lenses: lenses.length,
    toolGlasses,
  }
}

/**
 * Lay the shading passes over the big shapes.
 *
 * Only the LARGEST couple of paths per material get shaded. Humation splits a
 * hairstyle into a dozen slivers, and shading every one of them would triple
 * the node count for detail nobody can see at avatar size — the two biggest
 * shapes carry all of the read.
 */
function addShading(svg, id) {
  const plan = [
    // EVERY skin shape, not just the biggest. The neck is a separate path in
    // the body layer, and shading only the face left the neck reading as a
    // lighter, flatter colour than the chin directly above it — a visible seam
    // exactly where the head is supposed to join the body.
    { name: 'skin', take: 4, opts: { occlusionOpacity: 0.9, rimOpacity: 0.55 } },
    { name: 'clothes', take: 2, opts: { texture: 'weave', textureOpacity: 0.5, occlusionOpacity: 0.42, rimOpacity: 0.4 } },
    { name: 'bottom', take: 1, opts: { texture: 'weave', textureOpacity: 0.42, occlusionOpacity: 0.35, rimOpacity: 0.3 } },
    { name: 'hair', take: 2, opts: { texture: 'hairtex', textureOpacity: 0.6, occlusionOpacity: 0.3, rimOpacity: 0.75 } },
  ]

  let out = svg
  for (const { name, take, opts } of plan) {
    const re = new RegExp(`<path d="([^"]+)" fill="url\\(#${id}-${name}\\)"\\s*/>`, 'g')
    const hits = [...out.matchAll(re)]
      .map((m) => {
        const b = bboxOf(m[1])
        return { tag: m[0], d: m[1], area: b ? (b[2] - b[0]) * (b[3] - b[1]) : 0 }
      })
      .sort((a, b) => b.area - a.area)
      .slice(0, take)
    for (const hit of hits) {
      out = out.replace(hit.tag, hit.tag + shadingFor(hit.d, id, opts))
    }
  }
  return out
}

/** Render the same person wearing round glasses, and keep only that layer. */
function spareGlassesLayer(config) {
  const { svg } = composeOriginal({ ...config, selections: { ...(config.selections || {}), glasses: 'round' } })
  const mark = svg.indexOf('data-hm-layer-slot="glasses"')
  if (mark < 0) return null
  const layer = svg.slice(svg.lastIndexOf('<g', mark)).replace(/<\/svg>\s*$/, '')
  // A "none" glasses part still emits a group, just an empty one.
  return /<(circle|path|ellipse|rect)\b/.test(layer) ? layer : null
}

/**
 * Locate the lenses when the avatar happens to wear glasses.
 *
 * Most avatars do not — two of the three glasses parts are "none" — so the eyes
 * belong in their measured place, and this returns nothing. When glasses ARE
 * worn the lenses are opaque white discs painted over the face, which would
 * swallow any expression wider than Humation's baked dots. Rather than fight
 * that, the lens becomes the eye's field: the eye is re-anchored to the lens
 * centre and sized to sit inside it. The glasses stay exactly as drawn, and the
 * face still animates through them.
 *
 * Lens art lives inside a `scale(k)` wrapper, so its numbers are divided back
 * into the avatar's 88-unit space.
 */
function findLenses(svg) {
  const mark = svg.indexOf('data-hm-layer-slot="glasses"')
  if (mark < 0) return []
  const start = svg.lastIndexOf('<g', mark)
  const layer = svg.slice(start)
  const k = Number((layer.match(/<g transform="scale\(([\d.]+)\)"/) || [])[1] || 1)

  const found = [...layer.matchAll(/<circle\b[^>]*\/>/g)]
    .map((m) => {
      const num = (a) => {
        const hit = m[0].match(new RegExp(`${a}="(-?[\\d.]+)"`))
        return hit ? +hit[1] : NaN
      }
      return { x: num('cx') * k, y: num('cy') * k, r: num('r') * k }
    })
    .filter((c) => Number.isFinite(c.x) && Number.isFinite(c.r))

  if (found.length !== 2) return []
  return found.sort((a, b) => a.x - b.x)
}

/**
 * Find a companion animal's eyes in the item layer and wrap each one so it can
 * be scaled independently.
 *
 * The rule is deliberately strict: exactly two <circle> elements in that layer,
 * same radius, same cy, different cx. That matches all twelve cat items and
 * nothing else — the camera's single lens circle and the shark's two mismatched
 * highlight dots are both correctly left alone. Items whose eyes are paths
 * (duck, frog, fox mask) simply do not blink; a wrong guess here would animate
 * a random part of the art, which is worse than a still duck.
 */
function markPetEyes(svg) {
  const itemMark = svg.indexOf('data-hm-layer-slot="item"')
  if (itemMark < 0) return { svg, count: 0 }
  const start = svg.lastIndexOf('<g', itemMark)
  const nextMark = svg.indexOf('data-hm-layer-slot="glasses"', itemMark)
  const end = nextMark < 0 ? svg.length : svg.lastIndexOf('<g', nextMark)
  const item = svg.slice(start, end)

  const circles = [...item.matchAll(/<circle\b[^>]*\/>/g)].map((m) => {
    const num = (a) => {
      const hit = m[0].match(new RegExp(`${a}="(-?[\\d.]+)"`))
      return hit ? +hit[1] : NaN
    }
    return { tag: m[0], cx: num('cx'), cy: num('cy'), r: num('r') }
  })
  if (circles.length !== 2) return { svg, count: 0 }
  const [a, b] = circles
  if (!(Math.abs(a.cy - b.cy) < 0.01 && Math.abs(a.r - b.r) < 0.01 && Math.abs(a.cx - b.cx) > a.r)) {
    return { svg, count: 0 }
  }

  let next = item
  for (const c of circles) {
    next = next.replace(
      c.tag,
      `<g class="am-pet-eye" data-cx="${c.cx}" data-cy="${c.cy}">${c.tag}</g>`,
    )
  }
  return { svg: svg.slice(0, start) + next + svg.slice(end), count: 2 }
}

/**
 * Turn flat measurements into the sphere the gist's engine expects.
 *
 * Humation faces are drawn in three-quarter view looking left, so the two eyes
 * do NOT straddle the centre of the head — they sit well to the left of it.
 * Reading each eye's own base longitude off the skin box is what preserves that
 * pose at turn = 0, and makes turn > 0 rotate the head towards the viewer
 * rather than snapping it to a front view.
 */
/**
 * Per-seed facial proportions.
 *
 * Humation gives 24 heads, and with a large list you start seeing the same face
 * twice — the hair differs, the face underneath does not. Nudging the spacing,
 * size and tilt of the features per seed makes every avatar's FACE its own,
 * which is what people actually recognise. The ranges are small on purpose:
 * enough that two avatars are never quite the same, never enough to look
 * deformed.
 *
 * All of it is derived from the seed, so an id keeps its face forever.
 */
function variationFor(seed) {
  const u = (salt) => (hash(seed + salt) % 10000) / 10000 // 0..1
  const s = (salt, amt) => (u(salt) * 2 - 1) * amt // −amt..+amt
  return {
    gap: 1 + s(':gap', 0.1), // eye spacing
    size: 1 + s(':size', 0.09), // eye size
    aspect: 1 + s(':aspect', 0.11), // tall vs wide eyes
    tilt: s(':tilt', 5), // degrees, outer corners up or down
    mouthY: s(':mouthy', 0.16), // mouth height on the face
    mouthW: 1 + s(':mouthw', 0.14),
    lidBias: s(':lid', 0.09), // heavier or lighter upper lids
    headScale: 1 + s(':head', 0.035),
    blinkRate: 1 + s(':blink', 0.3), // some people blink more
    energy: 1 + s(':energy', 0.28), // some people fidget more
  }
}

function faceFrom(skinBox, eyes, lenses = [], v = variationFor('a')) {
  const [sx0, sy0, sx1, sy1] = skinBox
  const cx = (sx0 + sx1) / 2
  const cy = (sy0 + sy1) / 2 + HEAD_DY
  const radius = (sx1 - sx0) / 2

  const sorted = [...eyes].sort((a, b) => a.box[0] - b.box[0])
  const rawMid = sorted.map(({ box }) => (box[0] + box[2]) / 2)
  const pairCentre = (rawMid[0] + rawMid[1]) / 2

  const slots = sorted.map(({ box }, i) => {
    const lens = lenses[i]
    // No glasses (the usual case): the eye keeps the place and size Humation
    // drew it, only alive and nudged by this seed's own proportions. Glasses:
    // the lens becomes its field, and the variation stands down so the eye
    // still fits the frames.
    const baseX = (box[0] + box[2]) / 2
    const ex = lens ? lens.x : pairCentre + (baseX - pairCentre) * v.gap
    const ey = lens ? lens.y : (box[1] + box[3]) / 2 + HEAD_DY
    const grow = lens ? 1 : v.size
    return {
      x: ex,
      y: ey,
      halfW: (lens ? lens.r * 0.74 : (box[2] - box[0]) / 2) * grow * (lens ? 1 : 2 - v.aspect),
      halfH: (lens ? lens.r * 0.8 : (box[3] - box[1]) / 2) * grow * (lens ? 1 : v.aspect),
      // Outer corner up or down — a couple of degrees changes a face entirely.
      tilt: lens ? 0 : (i === 0 ? -v.tilt : v.tilt),
      // Sized to the lens already — the per-kind eye gain must not push it
      // back outside the frames it was just fitted into.
      fitted: !!lens,
      // Where this eye sits on the sphere when the head is at rest.
      baseLongitude: Math.asin(Math.max(-1, Math.min(1, (ex - cx) / radius))),
    }
  })

  const sep = Math.abs(slots[1].x - slots[0].x)

  // Humation draws no mouth, so there is nothing to measure — it is placed.
  // In this three-quarter view the front of the face is the LEFT contour, so
  // the mouth sits slightly left of the eye pair's midpoint and well below it,
  // and it gets its own longitude so it swings with the head like the eyes do.
  //
  // It is anchored to the BAKED eyes, never to the lens-fitted slots: glasses
  // sit lower than the eyes, and letting them drag the mouth down with them
  // would put it on the chin.
  const bakedMid = sorted.map(({ box }) => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + HEAD_DY])
  const bakedSep = Math.abs(bakedMid[1][0] - bakedMid[0][0])
  const mouthX = (bakedMid[0][0] + bakedMid[1][0]) / 2 - bakedSep * 0.42
  const mouth = {
    x: mouthX,
    y: (bakedMid[0][1] + bakedMid[1][1]) / 2 + bakedSep * (1.35 + v.mouthY),
    halfW: bakedSep * 0.34 * v.mouthW,
    halfH: bakedSep * 0.3,
    baseLongitude: Math.asin(Math.max(-1, Math.min(1, (mouthX - cx) / radius))),
  }

  // Where the head meets the body. The head pivots HERE rather than sliding,
  // because a sliding head opens a seam at the neck on every turn — which is
  // also how a real head works: it rotates on a neck, it does not translate.
  const neck = { x: (sx0 + sx1) / 2, y: sy1 + HEAD_DY + 1.5 }

  return {
    cx,
    cy,
    radius,
    slots,
    mouth,
    neck,
    variation: v,
    separation: sep,
    // The gist moves the gaze 13.2 of a 49-unit eye separation horizontally and
    // 8.4 vertically. Keeping those RATIOS (not the absolute units) is what
    // makes the same motion read correctly on a much smaller face.
    gazeXMax: sep * (13.2 / 49.2),
    gazeYMax: sep * (8.4 / 49.2),
  }
}
