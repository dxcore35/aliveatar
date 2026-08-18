// ---------------------------------------------------------------------------
// Variation — one definition of "a random person", used everywhere.
//
// The crowd needed it to fill an endless scroll; the control API needed it so
// an agent can ask for a fresh avatar without knowing what a Humation part is.
// Writing it twice would guarantee the two drift, and the interesting failure
// is silent: a generator that only ever reaches half the wardrobe still LOOKS
// like it works.
//
// So it lives here, it enumerates the real option lists rather than a
// hand-copied subset, and `SPACE` reports how large the space actually is —
// which is the number to check when someone says "there is no variation".
// ---------------------------------------------------------------------------
import { PARTS } from './humation.js'
import { SKULL_NAMES } from './render/skull.js'
import { STATES } from './states.js'

/**
 * Agent signature colours.
 *
 * Spread around the wheel on purpose: the skin IS this colour, so a palette
 * bunched in the blues makes every agent look like the same character in
 * different shirts.
 */
export const AGENT_COLORS = [
  '#3B82F6', '#16A34A', '#9333EA', '#E36F3D', '#0E7490', '#BE185D',
  '#EAB308', '#14B8A6', '#F43F5E', '#8B5CF6', '#06B6D4', '#84CC16',
  '#EF4444', '#F97316', '#22C55E', '#0EA5E9', '#D946EF', '#FACC15',
  '#10B981', '#6366F1', '#EC4899', '#A3E635', '#2DD4BF', '#FB7185',
]

/** States worth showing in a gallery — every one that reads as something. */
export const SHOWCASE_STATES = [
  'idle', 'listening', 'thinking', 'working', 'searching', 'happy', 'excited',
  'curious', 'confused', 'surprised', 'sad', 'laughing', 'proud', 'shy',
  'suspicious', 'angry', 'scared', 'sleeping', 'drowsy', 'bored', 'playful',
  'celebrate', 'alerting', 'notifying', 'writing', 'uploading', 'dictating',
  'humming', 'radar', 'loading',
]

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const maybe = (p) => Math.random() < p

/**
 * How many distinct avatars this can produce, ignoring the seed.
 *
 * The seed alone multiplies this without limit — it drives hair, outfit, face
 * proportions and complexion — so the real space is unbounded. This is the part
 * a caller can enumerate.
 */
export const SPACE = {
  heads: PARTS.head.length,
  bodies: PARTS.body.length,
  bottoms: PARTS.bottom.length,
  items: PARTS.item.length,
  glasses: PARTS.glasses.length,
  skulls: SKULL_NAMES.length,
  agentColors: AGENT_COLORS.length,
  states: STATES.length,
  get partCombinations() {
    return this.heads * this.bodies * this.bottoms * this.items * this.glasses
  },
}

/**
 * A complete, random avatar description.
 *
 * Everything is optional and anything passed is honoured, so this doubles as
 * "fill in the blanks": pass `{ kind: 'customer' }` and you get a random person
 * rather than a random anything.
 *
 * @param {object} [fixed] values to keep
 * @param {object} [opts]
 * @param {boolean} [opts.pinParts] also pick explicit head, body, bottom and
 *        item. Off by default — the SEED already picks them, and letting it do
 *        so is what keeps an avatar reproducible from its id alone. Turn it on
 *        when you need coverage of the whole wardrobe rather than an average.
 *        Glasses are never pinned: they follow age and tool calls.
 */
export function randomVariation(fixed = {}, opts = {}) {
  const kind = fixed.kind || (maybe(0.5) ? 'agent' : 'customer')
  const id = Math.random().toString(36).slice(2, 10)
  const v = {
    seed: fixed.seed || `${kind}:${id}`,
    kind,
    state: fixed.state || pick(SHOWCASE_STATES),
  }

  if (kind === 'agent') {
    v.color = fixed.color || pick(AGENT_COLORS)
    // Most agents get a generated skull; some keep the drawn head, so the set
    // does not read as "every AI is a polygon".
    v.skull = fixed.skull || (maybe(0.75) ? pick(SKULL_NAMES) : 'round')
  } else {
    // People get a real age often enough that a crowd has a range in it —
    // greying, reading glasses and a slower pace all follow from this one value.
    if (fixed.age !== undefined) v.age = fixed.age
    else if (maybe(0.75)) v.age = 18 + Math.floor(Math.random() * 62)
    if (fixed.gender) v.gender = fixed.gender
    else if (maybe(0.7)) v.gender = maybe(0.5) ? 'male' : 'female'
  }

  if (opts.pinParts) {
    // Pinning is what guarantees COVERAGE: the seed picks parts by hash, which
    // is uniform on average but never promises you saw all 24 heads. Pinning
    // draws from the list directly, so a long enough crowd reaches every one.
    for (const slot of ['head', 'body', 'bottom']) v[slot] = fixed[slot] || pick(PARTS[slot])
    // `item` is a hat, a pet or something held. Uniform picking puts one on
    // 42 of every 43 avatars, which reads as a costume party rather than a
    // crowd, so bare heads stay common.
    v.item = fixed.item || (maybe(0.3) ? 'none' : pick(PARTS.item))
    // Glasses are deliberately NOT pinned. They are earned — age for people,
    // a running tool call for agents — and randomising them breaks that rule.
    if (fixed.glasses) v.glasses = fixed.glasses
  } else {
    for (const slot of ['head', 'body', 'bottom', 'item', 'glasses']) {
      if (fixed[slot]) v[slot] = fixed[slot]
    }
  }
  return v
}

/** Apply a variation to an `<avatar-motion>` element. */
export function applyVariation(el, v) {
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined || val === null || val === '') el.removeAttribute(k)
    else el.setAttribute(k, String(val))
  }
  return v
}
