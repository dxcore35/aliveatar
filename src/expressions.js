// ---------------------------------------------------------------------------
// Expressions — the SHAPE of the two eyes.
//
// The GrokBot gist ships each expression as two hand-authored rings of 48 raw
// coordinate pairs (about 110 KB of numbers for 25 faces). Faithful, but it is
// authored for one specific 228-unit head, and adding a 26th face means hand-
// drawing 96 more numbers.
//
// Here the rings are GENERATED instead, from eight readable numbers per eye.
// Same output contract — a closed 48-point ring per eye — so the gist's morph,
// blink and projection math is unchanged and any two expressions still
// cross-fade point-for-point. Different input contract: an expression is a
// short row you can read and edit, and it is resolution-independent, which is
// what lets the same face sit on a 4.5-unit Humation head instead of a 49-unit
// blob.
//
// Eye model, in a normalised eye box (x and y in ±1, SVG y-down):
//
//   spine(u)   = bend * (u² − ½)      the curve the eye is built around.
//                                     bend > 0 arcs UP in the middle → "^" (happy)
//                                     bend < 0 arcs DOWN in the middle → "v" (sad)
//   top(u)     = spine(u) − openT * √(1 − u²)
//   bottom(u)  = spine(u) + openB * √(1 − u²)
//
// openT/openB are the upper and lower lid openings. Dropping both to ~0.2
// gives a crescent; raising them past 1 gives a wide startled eye. The ring is
// 24 samples along the top edge plus 24 back along the bottom.
// ---------------------------------------------------------------------------

/** Points per eye ring. Must be identical for every expression so they morph. */
export const RING_POINTS = 48

/**
 * One eye.
 * @param {number} openT upper lid opening (0 = shut, 1 = round, >1 = wide)
 * @param {number} openB lower lid opening
 * @param {number} bend  spine curvature (+ arcs up "^", − arcs down "v")
 * @param {number} w     half-width multiplier
 * @param {number} h     half-height multiplier
 * @param {number} tilt  rotation in degrees (+ = outer corner down)
 * @param {number} dx    horizontal offset, in eye half-widths
 * @param {number} dy    vertical offset, in eye half-heights
 */
const eye = (openT, openB, bend, w = 1, h = 1, tilt = 0, dx = 0, dy = 0) => ({
  openT, openB, bend, w, h, tilt, dx, dy,
})

/**
 * Sample one eye definition into a closed ring of RING_POINTS [x, y] pairs in
 * the normalised eye box. Point 0 is always the left corner of the top edge, so
 * index i means the same place on every expression — that is what makes the
 * morph clean instead of a scramble.
 */
export function ringFor(e) {
  const half = RING_POINTS / 2
  const pts = []
  const spine = (u) => e.bend * (u * u - 0.5)
  const lid = (u) => Math.sqrt(Math.max(0, 1 - u * u))

  for (let i = 0; i < half; i++) {
    const u = -1 + (2 * i) / (half - 1)
    pts.push([u, spine(u) - e.openT * lid(u)])
  }
  for (let i = 0; i < half; i++) {
    const u = 1 - (2 * i) / (half - 1)
    pts.push([u, spine(u) + e.openB * lid(u)])
  }

  const rad = (e.tilt * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return pts.map(([x, y]) => {
    const sx = x * e.w
    const sy = y * e.h
    return [sx * cos - sy * sin + e.dx, sx * sin + sy * cos + e.dy]
  })
}

// ── The 25 expressions ──────────────────────────────────────────────────────
// Index order is the gist's, because POOLS in states.js refers to these numbers.
// Each entry is [leftEye, rightEye]. "Left"/"right" are the viewer's left and
// right, matching how the Humation face is drawn.

export const EXPRESSIONS = [
  /* 00 neutral        */ [eye(1, 1, 0), eye(1, 1, 0)],
  /* 01 attentive      */ [eye(1.12, 0.92, 0.1, 1.02), eye(1.12, 0.92, 0.1, 1.02)],
  /* 02 beaming        */ [eye(0.18, 0.2, 1.5, 1.15, 1.05), eye(0.18, 0.2, 1.5, 1.15, 1.05)],
  /* 03 wide / startled*/ [eye(1.32, 1.32, 0, 1.14, 1.16), eye(1.32, 1.32, 0, 1.14, 1.16)],
  /* 04 heavy lids     */ [eye(0.3, 0.78, -0.16, 1, 0.95, 0, 0, 0.12), eye(0.3, 0.78, -0.16, 1, 0.95, 0, 0, 0.12)],
  /* 05 doubtful       */ [eye(0.42, 0.6, -0.3, 0.98, 0.95, -6), eye(0.86, 0.88, -0.05, 1, 1, 4)],
  /* 06 soft smile     */ [eye(0.5, 0.62, 0.7, 1.04), eye(0.5, 0.62, 0.7, 1.04)],
  /* 07 hard focus     */ [eye(0.62, 0.96, -0.85, 1.05, 0.95, 9), eye(0.62, 0.96, -0.85, 1.05, 0.95, -9)],
  /* 08 mild / thoughtful*/ [eye(0.9, 0.86, 0.18, 0.98), eye(0.9, 0.86, 0.18, 0.98)],
  /* 09 scanning       */ [eye(1.05, 0.85, 0.05, 0.9, 1.08, 0, -0.28), eye(1.05, 0.85, 0.05, 0.9, 1.08, 0, -0.28)],
  /* 10 listening      */ [eye(1.05, 1.0, 0.05, 1, 1.04, 0, 0, -0.08), eye(1.05, 1.0, 0.05, 1, 1.04, 0, 0, -0.08)],
  /* 11 pleased        */ [eye(0.34, 0.4, 1.15, 1.08), eye(0.34, 0.4, 1.15, 1.08)],
  /* 12 sweep left     */ [eye(0.95, 0.9, 0.05, 0.94, 1.02, 0, -0.42), eye(0.95, 0.9, 0.05, 0.94, 1.02, 0, -0.42)],
  /* 13 shut           */ [eye(0.05, 0.06, -0.1, 1.05, 0.9), eye(0.05, 0.06, -0.1, 1.05, 0.9)],
  /* 14 puzzled        */ [eye(1.15, 1.0, 0.05, 1.05, 1.08, -8), eye(0.5, 0.66, -0.2, 0.95, 0.95, 8)],
  /* 15 bright / proud */ [eye(1.05, 1.0, 0.35, 1.02, 1.06, 0, 0, -0.14), eye(1.05, 1.0, 0.35, 1.02, 1.06, 0, 0, -0.14)],
  /* 16 concentrating  */ [eye(0.46, 0.82, -0.5, 1.02, 0.92), eye(0.46, 0.82, -0.5, 1.02, 0.92)],
  /* 17 delighted      */ [eye(0.24, 0.28, 1.35, 1.12, 1.1, 0, 0, -0.1), eye(0.24, 0.28, 1.35, 1.12, 1.1, 0, 0, -0.1)],
  /* 18 sweep right    */ [eye(0.95, 0.9, 0.05, 0.94, 1.02, 0, 0.42), eye(0.95, 0.9, 0.05, 0.94, 1.02, 0, 0.42)],
  /* 19 warm           */ [eye(0.7, 0.8, 0.55, 1.04, 1.02), eye(0.7, 0.8, 0.55, 1.04, 1.02)],
  /* 20 alert scan     */ [eye(1.2, 1.05, 0, 1.0, 1.12, 0, 0.2, -0.18), eye(1.2, 1.05, 0, 1.0, 1.12, 0, 0.2, -0.18)],
  /* 21 shocked        */ [eye(1.45, 1.45, 0, 1.2, 1.24), eye(1.45, 1.45, 0, 1.2, 1.24)],
  /* 22 dozing         */ [eye(0.14, 0.4, -0.2, 1.02, 0.9, 0, 0, 0.18), eye(0.14, 0.4, -0.2, 1.02, 0.9, 0, 0, 0.18)],
  /* 23 side-eye       */ [eye(0.6, 0.72, -0.35, 0.92, 0.95, 0, 0.34), eye(0.6, 0.72, -0.35, 0.92, 0.95, 0, 0.34)],
  /* 24 bashful        */ [eye(0.36, 0.5, 0.85, 1, 0.92, 0, 0, 0.16), eye(0.36, 0.5, 0.85, 1, 0.92, 0, 0, 0.16)],
]

// ── Mouths ──────────────────────────────────────────────────────────────────
// Humation draws no mouth at all — the face is eyes only. That is fine for a
// still avatar and wrong for a talking one, so the mouth is added here and
// built the same way as the eyes: a closed ring between an upper and a lower
// lip, so it morphs with the same spring and never pops.
//
//   baseline(u) = smile * (½ − u²)   smile > 0 lifts the corners → "∪"
//   top(u)      = baseline(u) − open * √(1 − u²)
//   bottom(u)   = baseline(u) + open * √(1 − u²)
//
// open near 0 gives a drawn line; open near 1 gives a round open mouth.

export const MOUTH_POINTS = 32

// A mouth at rest is a drawn line, not a hairline. Every mouth gets this much
// lip thickness added to its opening, so a closed mouth still reads at avatar
// sizes where the whole head is 40 pixels across. It rides the same lid taper,
// so the corners still come to a point.
const LIP = 0.19

/**
 * @param {number} open  how far the mouth is open (0 = a line, 1 = round)
 * @param {number} smile + turns the corners up, − turns them down
 * @param {number} w     half-width multiplier
 * @param {number} dy    vertical offset, in mouth half-heights
 */
const mouth = (open, smile, w = 1, dy = 0) => ({ open, smile, w, dy })

export function mouthRing(m) {
  const half = MOUTH_POINTS / 2
  const pts = []
  const base = (u) => m.smile * (0.5 - u * u)
  const lid = (u) => Math.sqrt(Math.max(0, 1 - u * u))
  const open = m.open + LIP
  for (let i = 0; i < half; i++) {
    const u = -1 + (2 * i) / (half - 1)
    pts.push([u * m.w, base(u) - open * lid(u) + m.dy])
  }
  for (let i = 0; i < half; i++) {
    const u = 1 - (2 * i) / (half - 1)
    pts.push([u * m.w, base(u) + open * lid(u) + m.dy])
  }
  return pts
}

/** One mouth per expression index — same order as EXPRESSIONS. */
export const MOUTHS = [
  /* 00 neutral      */ mouth(0.09, 0.34, 0.9),
  /* 01 attentive    */ mouth(0.14, 0.4, 0.9),
  /* 02 beaming      */ mouth(0.55, 1.15, 1.05),
  /* 03 startled     */ mouth(0.62, -0.1, 0.62),
  /* 04 heavy lids   */ mouth(0.07, -0.2, 0.78),
  /* 05 doubtful     */ mouth(0.08, -0.35, 0.8),
  /* 06 soft smile   */ mouth(0.12, 0.8, 0.95),
  /* 07 hard focus   */ mouth(0.08, -0.55, 0.86),
  /* 08 thoughtful   */ mouth(0.1, 0.16, 0.86),
  /* 09 scanning     */ mouth(0.12, 0.1, 0.82),
  /* 10 listening    */ mouth(0.11, 0.42, 0.9),
  /* 11 pleased      */ mouth(0.34, 0.95, 1.0),
  /* 12 sweep left   */ mouth(0.1, 0.12, 0.82),
  /* 13 shut         */ mouth(0.06, 0.1, 0.8),
  /* 14 puzzled      */ mouth(0.13, -0.3, 0.78),
  /* 15 bright       */ mouth(0.26, 0.75, 0.95),
  /* 16 concentrating*/ mouth(0.07, -0.42, 0.84),
  /* 17 delighted    */ mouth(0.7, 1.0, 1.05),
  /* 18 sweep right  */ mouth(0.1, 0.12, 0.82),
  /* 19 warm         */ mouth(0.16, 0.7, 0.95),
  /* 20 alert scan   */ mouth(0.18, 0.05, 0.8),
  /* 21 shocked      */ mouth(0.85, -0.15, 0.7),
  /* 22 dozing       */ mouth(0.16, -0.12, 0.66),
  /* 23 side-eye     */ mouth(0.08, -0.3, 0.8),
  /* 24 bashful      */ mouth(0.09, 0.5, 0.72),
]

// MOUTH_RINGS and RINGS are both sampled at the very bottom of this file,
// AFTER the bloub set has been appended. Sampling here would freeze the tables
// at twenty-five entries and every bloub index would read undefined.

// ── bloub's sixteen moods ───────────────────────────────────────────────────
// Ported from bloub (MIT) — reference/bloub/src/bot/expressions.ts.
//
// These are a DIFFERENT KIND of expression from the twenty-five above, and that
// is the reason to have both. Above, a mood is a drawn eye shape and the head
// never moves. In bloub a mood is carried by FOUR levers at once: the head's
// own orientation, how far apart the eyes sit on it, their proportions, and
// each eye's individual lean. Anger and sadness are the clearest case — both
// need the two eyes tilted in MIRROR (tops converging, or tops diverging), and
// no single head roll can do that because rolling leans both eyes the same way.
//
// TWO TRANSLATIONS ARE NEEDED, because bloub owns its head and we do not.
//
// 1. SIZES ARE RELATIVE, NOT ABSOLUTE. bloub's numbers are in ball-radius units
//    for a capsule whose neutral is 0.186 × 0.412 — a tall narrow lozenge with
//    an aspect of 2.2. Our eye is the box Humation drew, aspect about 1.2. So a
//    bloub size is read as "this many times ITS neutral" and applied to OURS,
//    which transfers the intent (wider, flatter, taller) instead of the shape.
//
// 2. HEAD POSES ARE DELTAS, NOT DESTINATIONS. bloub's rest pose is yaw +28.5°;
//    ours is recovered from the artwork at about −29°, the mirrored three-
//    quarter view. Copying its absolute angles would spin every Humation face
//    round to look the other way. Each mood therefore stores its OFFSET from
//    bloub's own neutral, which is the part that actually means something.
//
// MOOD_GAIN damps both. bloub's moods are drawn for a face that is two eyes and
// nothing else, so they are enormous — `surpris` is 2.4× the neutral width. On a
// head that also has a nose, hair and a jaw, full strength reads as a cartoon.
// This is the one number to turn up if the moods feel too polite.
const MOOD_GAIN = 0.6

/** bloub's own neutral, which everything below is measured against. */
const B_W = 0.186
const B_H = 0.412
const B_SPLIT = 15.46
const B_REST = { yaw: 28.49, pitch: 28.62, roll: -13 }

/** Pull a raw multiplier towards 1 by the gain. */
const damp = (v) => 1 + (v - 1) * MOOD_GAIN

/**
 * One bloub eye → one of our eye rows.
 * `open` is bloub's half-lid; it squashes the eye vertically, so it folds into
 * the height rather than needing a mechanism of its own.
 */
const bEye = (w, h, tilt = 0, open = 1) =>
  eye(1, 1, 0, damp(w / B_W), damp((h / B_H) * open), tilt * MOOD_GAIN)

/** Both eyes the same, leaning in mirror when a tilt is given. */
const bPair = (w, h, tilt = 0, open = 1) => [bEye(w, h, tilt, open), bEye(w, h, -tilt, open)]

/**
 * A mood's head pose, as an offset from bloub's neutral, in RADIANS, plus how
 * much wider or narrower it sets the eyes on the head.
 */
const bGaze = (yaw, pitch, roll, split) => ({
  dYaw: (((yaw - B_REST.yaw) * MOOD_GAIN) * Math.PI) / 180,
  dPitch: (((pitch - B_REST.pitch) * MOOD_GAIN) * Math.PI) / 180,
  dRoll: (((roll - B_REST.roll) * MOOD_GAIN) * Math.PI) / 180,
  splitScale: damp(split / B_SPLIT),
})

const BLOUB = [
  ['bloub neutral',    bGaze(28.49, 28.62, -13, 15.46), bPair(B_W, B_H),          mouth(0.09, 0.3, 0.88)],
  ['bloub attentive',  bGaze(4, 5, -4, 16),             bPair(0.21, 0.44),        mouth(0.13, 0.38, 0.9)],
  ['bloub surprised',  bGaze(3, -3, 0, 19),             bPair(0.45, 0.47),        mouth(0.5, -0.1, 0.66)],
  ['bloub excited',    bGaze(6, -14, 0, 19.5),          bPair(0.4, 0.56, -10),    mouth(0.52, 0.85, 1.0)],
  ['bloub happy',      bGaze(5, 9, 0, 17),              bPair(0.27, 0.17, 14),    mouth(0.3, 1.0, 1.0)],
  ['bloub laughing',   bGaze(4, 14, 0, 18),             bPair(0.34, 0.13, 20),    mouth(0.72, 1.05, 1.06)],
  ['bloub angry',      bGaze(3, 7, 0, 17),              bPair(0.34, 0.15, 30),    mouth(0.1, -0.62, 0.84)],
  ['bloub sad',        bGaze(3, -13, 0, 16),            bPair(0.22, 0.4, -28),    mouth(0.08, -0.5, 0.8)],
  ['bloub frightened', bGaze(2, -20, 0, 20.5),          bPair(0.4, 0.6),          mouth(0.8, -0.2, 0.68)],
  ['bloub wary',       bGaze(12, 6, -6, 16),            [bEye(0.21, 0.4), bEye(0.22, 0.15)], mouth(0.08, -0.28, 0.8)],
  ['bloub confused',   bGaze(-14, 3, 8, 16.5),          [bEye(0.2, 0.44, -18), bEye(0.28, 0.17, 14)], mouth(0.12, -0.26, 0.78)],
  ['bloub curious',    bGaze(16, -9, -15, 16.5),        [bEye(0.24, 0.46, -8), bEye(0.2, 0.38, -8)],  mouth(0.14, 0.24, 0.84)],
  ['bloub proud',      bGaze(5, 17, 0, 17),             bPair(0.3, 0.15, 18),     mouth(0.2, 0.72, 0.94)],
  ['bloub shy',        bGaze(-19, -14, -7, 14),         bPair(0.17, 0.3),         mouth(0.08, 0.46, 0.7)],
  ['bloub bored',      bGaze(-22, 2, 0, 16),            bPair(0.3, 0.12),         mouth(0.07, -0.16, 0.78)],
  ['bloub drowsy',     bGaze(6, -9, -3, 16),            bPair(0.2, 0.42, 0, 0.42), mouth(0.14, -0.1, 0.68)],
]

// Appended, never inserted: POOLS in states.js addresses expressions by NUMBER,
// so every index already in use has to keep meaning what it meant.
/** Where the bloub set starts, for the lab's grouping. Read BEFORE appending. */
export const BLOUB_FIRST = EXPRESSIONS.length
for (const [, , eyes, m] of BLOUB) {
  EXPRESSIONS.push(eyes)
  MOUTHS.push(m)
}

/**
 * Head-pose offset per expression index.
 *
 * The first twenty-five carry none — their mood is entirely in the drawn eye,
 * which is how they were designed. The bloub sixteen carry a real one, and the
 * engine springs between whatever two are in play so a mood change moves the
 * head as well as the eyes.
 */
const NO_POSE = { dYaw: 0, dPitch: 0, dRoll: 0, splitScale: 1 }
export const EYE_POSE = [
  ...new Array(BLOUB_FIRST).fill(NO_POSE),
  ...BLOUB.map(([, g]) => g),
]

/** Human-readable name per index, for the lab UI. */
export const EXPRESSION_NAMES = [
  'neutral', 'attentive', 'beaming', 'startled', 'heavy lids',
  'doubtful', 'soft smile', 'hard focus', 'thoughtful', 'scanning',
  'listening', 'pleased', 'sweep left', 'shut', 'puzzled',
  'bright', 'concentrating', 'delighted', 'sweep right', 'warm',
  'alert scan', 'shocked', 'dozing', 'side-eye', 'bashful',
  ...BLOUB.map(([name]) => name),
]

// ── Sampled tables ──────────────────────────────────────────────────────────
// Both are built here, at the very end, so they cover the bloub set too.

/** Pre-sampled rings, so the animation loop never re-generates geometry. */
export const RINGS = EXPRESSIONS.map((pair) => pair.map(ringFor))

/** Pre-sampled mouth rings. */
export const MOUTH_RINGS = MOUTHS.map(mouthRing)
