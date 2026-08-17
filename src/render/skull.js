// ---------------------------------------------------------------------------
// Skull — a generated head shape for agents, worn UNDER the Humation hair.
//
// WHY THE HAIR SURVIVES THIS
//
// A Humation head is fourteen shapes, and they are already split by what paints
// them. The skull is ONE path, drawn three times (base colour, occlusion, rim
// light). The hair is ONE path, drawn four times. The rest are ink outlines.
// So swapping the head shape is not a matter of redrawing twenty-four
// illustrations — it is rewriting a single `d`, and the hair sitting on top has
// never heard of it.
//
// WHAT THAT MEANS FOR HOW THIS LOOKS
//
// Measured on the real artwork, the hair box is WIDER than the skull box —
// `[17.1, 22.1 → 76.4, 64.8]` against `[23.3, 21 → 54.1, 53.5]`. The hair
// overhangs the skull on every side. So what you actually see change is the
// FACE: the opening the hair frames goes from round to hexagonal, to an egg, to
// a squircle. That is the honest description of this feature, and it is why the
// shapes below all fit INSIDE the original box rather than escaping it. A skull
// larger than its hair pokes through the fringe and reads as a broken asset.
//
// Keeping the bounding box identical buys one more thing, and it is the
// important one: the eye engine recovers the head sphere by measuring this very
// path (`faceFrom` in humation.js). Same box in, same sphere out — so a
// generated skull cannot move anybody's eyes.
//
// EVERY SHAPE IS A POLAR PROFILE, sampled at the same angles. Two shapes
// therefore have points that correspond one to one, which is what would let one
// morph into another later without a path-morphing library. bloub makes the
// same argument about its silhouettes and it is right.
// ---------------------------------------------------------------------------

/** Points per skull outline. Even, and enough that a corner reads as a corner. */
const N = 96

/** A superellipse |x|^n + |y|^n = 1, as a radius at angle t. */
const superellipse = (t, n) =>
  1 / Math.pow(Math.pow(Math.abs(Math.cos(t)), n) + Math.pow(Math.abs(Math.sin(t)), n), 1 / n)

/** A regular polygon of `k` sides, as a radius at angle t. */
function polygon(t, k, turn = 0) {
  const seg = (Math.PI * 2) / k
  const a = ((t + turn) % seg + seg) % seg
  return Math.cos(Math.PI / k) / Math.cos(a - Math.PI / k)
}

/**
 * The shapes.
 *
 * Each is `r(t)` where t runs anticlockwise from the +x axis, in a space where
 * 1 is the edge. y is SVG-down, so `Math.sin(t) > 0` is the LOWER half of the
 * head — that sign is the easy thing to get backwards, and getting it backwards
 * puts the chin on the forehead.
 */
export const SKULL_SHAPES = {
  round: {
    label: 'round',
    r: () => 1,
  },
  squircle: {
    label: 'squircle',
    note: 'A rounded box. Reads as a machine without reading as a robot.',
    r: (t) => superellipse(t, 4.2),
  },
  hexagon: {
    label: 'hexagon',
    note: 'Flat top and bottom, six corners. The most obviously non-natural.',
    r: (t) => polygon(t, 6, Math.PI / 6),
  },
  egg: {
    label: 'egg',
    note: 'Narrow at the top, full at the jaw.',
    r: (t) => 1 - 0.17 * Math.max(0, -Math.sin(t)),
  },
  pear: {
    label: 'pear',
    note: 'The other way round — broad brow, narrow chin.',
    r: (t) => 1 - 0.19 * Math.max(0, Math.sin(t)),
  },
  capsule: {
    label: 'capsule',
    note: 'Straight sides, domed top and bottom.',
    r: (t) => superellipse(t, 6.5),
  },
  diamond: {
    label: 'diamond',
    note: 'Pinched to points at the sides.',
    r: (t) => superellipse(t, 1.25),
  },
  shield: {
    label: 'shield',
    note: 'Square across the brow, tapering to a chin.',
    r: (t) => {
      const low = Math.max(0, Math.sin(t))
      return superellipse(t, 3.4) * (1 - 0.3 * low * low)
    },
  },
  blob: {
    label: 'blob',
    note: 'Soft and asymmetric, different for every seed.',
    r: (t, s) => 1 + 0.11 * Math.sin(3 * t + s) + 0.07 * Math.sin(5 * t + s * 1.7) + 0.04 * Math.sin(2 * t + s * 2.3),
  },
}

export const SKULL_NAMES = Object.keys(SKULL_SHAPES)

/**
 * Build the outline of one skull, filling `box` exactly.
 *
 * @param {string} shape one of SKULL_NAMES
 * @param {number[]} box the ORIGINAL skull bbox, [x0, y0, x1, y1]
 * @param {number} seed  a number, for the shapes that vary
 * @returns {string|null} an SVG path `d`, or null for an unknown shape
 */
export function skullPath(shape, box, seed = 0) {
  const def = SKULL_SHAPES[shape]
  if (!def || !box) return null
  const s = (seed % 1000) / 1000 * Math.PI * 2

  const pts = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const r = def.r(t, s)
    const x = Math.cos(t) * r
    const y = Math.sin(t) * r
    pts.push([x, y])
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  // Normalise to the original box. Doing this rather than trusting each r() to
  // be unit-sized is what guarantees the head sphere the eye engine measures
  // comes out identical whatever shape is picked.
  const [x0, y0, x1, y1] = box
  const sx = (x1 - x0) / (maxX - minX)
  const sy = (y1 - y0) / (maxY - minY)

  let d = 'M'
  for (let i = 0; i < N; i++) {
    const px = x0 + (pts[i][0] - minX) * sx
    const py = y0 + (pts[i][1] - minY) * sy
    d += `${px.toFixed(2)} ${py.toFixed(2)}${i < N - 1 ? 'L' : ''}`
  }
  return d + 'Z'
}

/**
 * Pick a shape for a seed.
 *
 * `round` is weighted heavily on purpose. A room full of hexagons is a novelty;
 * an occasional one among ordinary heads is a character. Callers who want a
 * specific shape pass it and skip this.
 */
const POOL = [
  'round', 'round', 'round', 'round',
  'squircle', 'squircle', 'egg', 'egg', 'capsule',
  'hexagon', 'shield', 'pear', 'blob', 'diamond',
]
export function skullForSeed(hashValue) {
  return POOL[hashValue % POOL.length]
}
