// ---------------------------------------------------------------------------
// States — WHAT the avatar is doing right now.
//
// POOLS / BLINK / EXPR_CADENCE are ported verbatim from the GrokBot teardown
// (gist smontlouis/49a4c930). A state never sets one fixed face: it names a
// POOL of expressions the face rotates through, plus how often it rotates
// (EXPR_CADENCE) and how often it blinks (BLINK, `null` = never). That is what
// makes the thing read as alive rather than as a looping animation.
//
// MOTION is NEW — it does not exist in the gist. The gist animates a floating
// blob, so its only body motion is spin/bounce. Humation draws a whole person,
// so each state also gets breathing, head sway, nodding and gaze wandering.
// ---------------------------------------------------------------------------

/** Expression indices each state may show. Indices point into EXPRESSIONS. */
export const POOLS = {
  sleeping: [13, 22, 4],
  waking: [13],
  idle: [0, 8],
  listening: [10, 1, 19],
  thinking: [8, 16, 14, 17, 5],
  searching: [15, 9, 3, 20, 12, 18],
  working: [7, 16, 11, 10],
  excited: [2, 17, 21, 3, 11],
  surprised: [3, 21],
  suspicious: [14, 5, 23],
  angry: [7, 16],
  drowsy: [4, 22, 13],
  happy: [2, 11, 17, 19],
  curious: [3, 21, 0, 15],
  confused: [14, 5, 8],
  bored: [4, 22, 0],
  proud: [15, 8, 2],
  shy: [0, 24, 13],
  sad: [4, 13, 22],
  laughing: [2, 11, 17],
  scared: [3, 21],
  playful: [2, 17, 11, 8],
  celebrate: [2, 8, 17],
  orbit: [0, 8],
  radar: [0, 8],
  progress: [0, 8],
  spawning: [3, 0],
  humming: [0, 8],
  loading: [0, 8],
  dictating: [10, 1, 19],
  sending: [0, 8],
  receiving: [19, 0, 8],
  uploading: [15, 9, 8],
  writing: [15, 9],
  notifying: [3, 21, 0],
  alerting: [3, 21],
  bouncing: [2, 17],
  dragging: [3, 15, 0],
  'powering-down': [13, 22],
}

/** Milliseconds between blinks, picked uniformly in [lo, hi]. null = no blink. */
export const BLINK = {
  sleeping: null,
  waking: null,
  idle: [6000, 14000],
  listening: [3000, 7000],
  thinking: [3500, 7000],
  searching: [1600, 4000],
  working: [2800, 5500],
  excited: [2000, 4000],
  surprised: [1800, 3500],
  suspicious: [4500, 8000],
  angry: [3500, 7000],
  drowsy: null,
  happy: [2500, 5000],
  curious: [2500, 5500],
  confused: [2800, 5500],
  bored: [4000, 8000],
  proud: [3500, 7000],
  shy: [3000, 6000],
  sad: [4000, 8000],
  laughing: [2500, 5000],
  scared: [1200, 3000],
  playful: [2000, 4500],
  celebrate: [2200, 4500],
  orbit: null,
  radar: null,
  progress: null,
  spawning: null,
  humming: [4000, 8000],
  loading: null,
  dictating: null,
  sending: null,
  receiving: null,
  uploading: null,
  writing: null,
  notifying: [2000, 4000],
  alerting: null,
  bouncing: null,
  dragging: [2200, 4500],
  'powering-down': null,
}

/** Milliseconds between expression changes, picked uniformly in [lo, hi]. */
export const EXPR_CADENCE = {
  sleeping: [6000, 10000],
  waking: [800, 800],
  idle: [9000, 16000],
  listening: [2800, 5000],
  thinking: [2000, 3600],
  searching: [1000, 1800],
  working: [1800, 3200],
  excited: [1100, 2000],
  surprised: [2500, 4000],
  suspicious: [2600, 4500],
  angry: [2200, 3800],
  drowsy: [4000, 8000],
  happy: [2500, 4500],
  curious: [1800, 3200],
  confused: [2200, 3800],
  bored: [3500, 6000],
  proud: [3500, 6000],
  shy: [3000, 5500],
  sad: [4000, 7000],
  laughing: [1200, 2400],
  scared: [900, 1800],
  playful: [1500, 3000],
  celebrate: [1400, 2600],
  orbit: [4000, 8000],
  radar: [4000, 8000],
  progress: [4000, 8000],
  spawning: [1200, 1200],
  humming: [5000, 9000],
  loading: [6000, 10000],
  dictating: [4000, 8000],
  sending: [4000, 8000],
  receiving: [4000, 8000],
  uploading: [4000, 8000],
  writing: [4000, 8000],
  notifying: [1500, 2600],
  alerting: [2000, 3600],
  bouncing: [3000, 6000],
  dragging: [1600, 3000],
  'powering-down': [6000, 9000],
}

// ── Body motion ─────────────────────────────────────────────────────────────
// One entry per state. All values are in "eye units" (1 unit ≈ one eye width)
// except `breathe`/`turn` which are amplitudes in their own scale.
//
//   breathe  chest rise amplitude (0 = none)          period in ms
//   sway     head left/right drift, degrees of turn   period in ms
//   nod      head up/down drift, eye units            period in ms
//   bounce   whole-body hop, eye units                period in ms
//   gaze     how far the eyes wander on their own, 0..1 of the gaze range
//   gazeRate ms between new random gaze targets (0 = eyes stay put)
const M = (breathe, breatheMs, sway, swayMs, nod, nodMs, bounce, bounceMs, gaze, gazeRate) => ({
  breathe, breatheMs, sway, swayMs, nod, nodMs, bounce, bounceMs, gaze, gazeRate,
})

export const MOTION = {
  sleeping: M(0.55, 5200, 2, 9000, 0.10, 5200, 0, 0, 0, 0),
  waking: M(0.30, 3000, 6, 2600, 0.10, 1800, 0.06, 900, 0.35, 900),
  idle: M(0.26, 4200, 5, 7000, 0.05, 5200, 0, 0, 0.30, 2600),
  listening: M(0.22, 3400, 3, 4200, 0.16, 1500, 0, 0, 0.18, 3200),
  thinking: M(0.20, 3800, 9, 3400, 0.10, 3000, 0, 0, 0.75, 1500),
  searching: M(0.20, 2600, 16, 1300, 0.06, 1700, 0, 0, 1.00, 620),
  working: M(0.24, 2800, 4, 2600, 0.13, 900, 0, 0, 0.25, 1400),
  excited: M(0.34, 1500, 12, 1100, 0.10, 700, 0.30, 620, 0.55, 700),
  surprised: M(0.16, 2400, 2, 3000, 0.04, 2600, 0.10, 1400, 0.25, 1200),
  suspicious: M(0.18, 4000, 7, 3600, 0.05, 3600, 0, 0, 0.45, 2000),
  angry: M(0.40, 1900, 3, 2200, 0.12, 1100, 0, 0, 0.20, 2200),
  drowsy: M(0.42, 5600, 4, 8000, 0.14, 4200, 0, 0, 0.15, 4000),
  happy: M(0.26, 2600, 6, 2600, 0.10, 1300, 0.10, 1300, 0.35, 1600),
  curious: M(0.24, 3000, 13, 2200, 0.12, 1900, 0, 0, 0.80, 1100),
  confused: M(0.22, 3400, 11, 2600, 0.09, 2400, 0, 0, 0.65, 1500),
  bored: M(0.30, 5000, 8, 6000, 0.07, 5000, 0, 0, 0.55, 3200),
  proud: M(0.22, 3400, 2, 5000, 0.09, 3400, 0, 0, 0.15, 3000),
  shy: M(0.20, 3800, 11, 3000, 0.11, 2600, 0, 0, 0.60, 1900),
  sad: M(0.24, 5000, 3, 6000, 0.14, 4200, 0, 0, 0.30, 3400),
  laughing: M(0.50, 900, 5, 900, 0.20, 460, 0.22, 460, 0.25, 1400),
  scared: M(0.44, 1100, 14, 700, 0.08, 620, 0.14, 500, 0.90, 500),
  playful: M(0.28, 2000, 14, 1500, 0.12, 900, 0.18, 900, 0.60, 900),
  celebrate: M(0.32, 1400, 9, 1100, 0.13, 620, 0.34, 560, 0.40, 900),
  orbit: M(0.22, 4000, 22, 3400, 0.06, 3400, 0, 0, 0.10, 3400),
  radar: M(0.22, 4000, 26, 2200, 0.05, 4000, 0, 0, 0.10, 4000),
  progress: M(0.22, 3400, 3, 4200, 0.07, 2600, 0, 0, 0.20, 2600),
  spawning: M(0.30, 1500, 5, 1500, 0.12, 900, 0.16, 900, 0.40, 800),
  humming: M(0.30, 2600, 7, 2000, 0.14, 1000, 0.08, 1000, 0.25, 2200),
  loading: M(0.22, 3400, 6, 2600, 0.06, 2600, 0, 0, 0.25, 1800),
  dictating: M(0.24, 3000, 4, 3400, 0.15, 1200, 0, 0, 0.20, 2600),
  sending: M(0.22, 3000, 5, 2600, 0.10, 1300, 0.06, 1300, 0.20, 2200),
  receiving: M(0.22, 3000, 5, 2600, 0.10, 1300, 0.06, 1300, 0.30, 1800),
  uploading: M(0.22, 2800, 7, 2200, 0.09, 1500, 0, 0, 0.40, 1400),
  writing: M(0.22, 3000, 5, 2600, 0.13, 1100, 0, 0, 0.45, 1400),
  notifying: M(0.26, 2000, 8, 1300, 0.11, 700, 0.14, 700, 0.35, 1000),
  alerting: M(0.34, 1300, 12, 800, 0.09, 560, 0.20, 560, 0.55, 700),
  bouncing: M(0.26, 1400, 5, 1400, 0.10, 500, 0.36, 500, 0.25, 1600),
  dragging: M(0.24, 2200, 10, 1500, 0.09, 1200, 0, 0, 0.55, 1000),
  'powering-down': M(0.36, 6000, 3, 8000, 0.16, 5200, 0, 0, 0.10, 5000),
}

// ── Talking ─────────────────────────────────────────────────────────────────
// [amount, period ms] — how much the mouth opens and closes on its own. Only
// states where the avatar is actually producing sound get one; everywhere else
// the mouth holds the expression's shape.
export const TALK = {
  dictating: [0.55, 250],
  laughing: [0.7, 210],
  humming: [0.22, 620],
  celebrate: [0.4, 300],
  excited: [0.3, 280],
  spawning: [0.3, 320],
  notifying: [0.3, 300],
  alerting: [0.4, 240],
  waking: [0.2, 520],
}

// ── Kind profiles ───────────────────────────────────────────────────────────
// A person and an AI should not move the same way, and the difference is the
// point: you should be able to tell which one you are talking to without
// reading a label.
//
//   turnMode 'slide'  eyes stay stuck on the face and shift a little, the way a
//                     real face works. No rotating around the skull.
//   turnMode 'sphere' the full GrokBot projection — eyes travel around the head
//                     and vanish past the horizon. Impossible, and meant to be.
//
//   eyeW/eyeH         eye size multiplier. Agents get taller, more drawn eyes,
//                     so they read as a character rather than a photo.
//   swayScale         how much the state's head sway is allowed to reach.
//   fx                agent-only theatrics: tool bubbles, glasses, colour runs.
export const KIND_PROFILE = {
  customer: {
    turnMode: 'slide',
    turnLimit: (14 * Math.PI) / 180,
    eyeW: 1,
    eyeH: 1,
    swayScale: 0.55,
    blinkFloor: 0.04,
    // A person blinks roughly every three or four seconds — 15 to 20 times a
    // minute. The cadences in BLINK were measured off a robot blob and are far
    // too slow for a face, so people get them scaled right down. This is why a
    // human avatar looked like it never blinked at all.
    blinkScale: 0.32,
    fx: false,
  },
  agent: {
    turnMode: 'sphere',
    turnLimit: Infinity,
    eyeW: 1.22,
    eyeH: 1.62,
    swayScale: 1.5,
    blinkFloor: 0.02,
    blinkScale: 1,
    fx: true,
  },
}

/** States that read as "the agent is running a tool". */
export const TOOL_STATES = ['thinking', 'working', 'searching', 'writing', 'uploading', 'loading']

/** Sample tool calls for the bubble. Shape only — nothing here calls anything. */
export const TOOL_SCRIPTS = [
  { name: 'calendar.find_slot', args: '{ day: "tue", len: 30 }', result: '3 slots' },
  { name: 'crm.lookup_customer', args: '{ phone: "+421…" }', result: 'Jana K.' },
  { name: 'booking.reserve', args: '{ slot: "14:30" }', result: 'confirmed' },
  { name: 'kb.search', args: '{ q: "opening hours" }', result: '2 docs' },
  { name: 'sms.send', args: '{ tpl: "reminder" }', result: 'queued' },
  { name: 'billing.get_invoice', args: '{ id: "2026-441" }', result: '€184,00' },
]

// ── Emotional colour ────────────────────────────────────────────────────────
// An agent's skin IS its signature colour, which makes it a channel a person
// does not have: the whole face can flush or drain with the mood. Kept subtle —
// a shift you notice consciously reads as a bug, one you notice unconsciously
// reads as feeling.
//
// [hue shift °, saturation ×, lightness ×]
//
// These are deliberately SMALL. A skin colour that visibly swings reads as a
// rendering fault, not as a mood — and never darkens far, because a face that
// goes near-black has stopped being a face. Anger is a flush, not a repaint.
export const SKIN_MOOD = {
  angry: [-12, 1.16, 0.98], // a flush toward red
  scared: [-6, 0.78, 1.05], // slightly drained
  sad: [6, 0.82, 0.98], // cooler, duller
  shy: [-9, 1.12, 1.03], // flushed
  excited: [-5, 1.12, 1.03],
  celebrate: [-4, 1.13, 1.04],
  laughing: [-6, 1.11, 1.02],
  happy: [-3, 1.07, 1.02],
  proud: [-2, 1.08, 1.02],
  suspicious: [4, 0.93, 0.99],
  sleeping: [3, 0.86, 0.98],
  drowsy: [3, 0.89, 0.99],
  'powering-down': [0, 0.66, 0.96], // colour drains, but the face stays a face
  alerting: [-10, 1.14, 1.01],
  surprised: [-3, 1.05, 1.03],
}

/**
 * Tool calls that change the outfit while they run.
 *
 * A records lookup is invisible, so the agent acts it out: it tries colours the
 * way you would try clothes, stepping to a new one every beat until the call
 * comes back. Continuous hue sweeping looks like a fault; discrete steps look
 * like searching.
 */
export const WARDROBE_STEP_MS = 420

/**
 * How the avatar carries itself while the beams are up.
 *
 * `searching` on its own is all fast darting — right for scanning a list, wrong
 * the moment the eyes are weapons. Menace is SLOW: long holds, a small
 * deliberate sweep, heavy breathing, a head that turns like it is deciding
 * rather than looking. Blended in as the beams charge, so the avatar visibly
 * settles into the posture instead of snapping into it.
 */
export const LASER_POSTURE = {
  breathe: 0.44, breatheMs: 5200,
  sway: 4, swayMs: 7000,
  nod: 0.03, nodMs: 6000,
  bounce: 0, bounceMs: 0,
  gaze: 0.34, gazeRate: 3200,
  turnStiffness: 2.1, // a slow, heavy head turn
  expression: 7, // hard focus
}

/** Plain-language note per state, for the lab UI. */
export const STATE_NOTES = {
  sleeping: 'Eyes almost shut, slow breathing, no blinking.',
  waking: 'Short wake-up run before settling into a neutral face.',
  idle: 'Slow micro-movement, expressions 0 and 8, rare blinking.',
  listening: 'Head slightly raised, small nods, steady gaze.',
  thinking: 'Gaze up and to the side, asymmetric expressions.',
  searching: 'Fast gaze sweeps and frequent expression changes.',
  working: 'Steady rhythm, small nods, focused expressions.',
  excited: 'Bouncing, big expressions, occasional turns.',
  curious: 'Head tilt, roaming gaze, very asymmetric expressions.',
}

export const STATES = Object.keys(POOLS)

/** States grouped for the lab UI. */
export const STATE_GROUPS = [
  { label: 'Rest', states: ['sleeping', 'drowsy', 'waking', 'idle', 'bored', 'humming'] },
  { label: 'Conversation', states: ['listening', 'dictating', 'thinking', 'confused', 'working', 'writing'] },
  { label: 'Feeling', states: ['happy', 'laughing', 'playful', 'celebrate', 'proud', 'excited', 'shy', 'sad', 'angry', 'suspicious', 'scared', 'surprised', 'curious'] },
  { label: 'System', states: ['searching', 'loading', 'progress', 'orbit', 'radar', 'spawning', 'sending', 'receiving', 'uploading', 'notifying', 'alerting', 'bouncing', 'dragging', 'powering-down'] },
]
