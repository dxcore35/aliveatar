// ---------------------------------------------------------------------------
// Icons — the emblem set, drawn here rather than vendored.
//
// A licence survey of the usual sets (Phosphor MIT, Fluent Emoji MIT, and a
// long list of ones to avoid — Solar and Font Awesome Free are CC BY and want
// visible credit, OpenMoji is share-alike, JoyPixels Free forbids commercial
// use outright, Remix quietly changed licence in January 2026) came back with
// two clean options. Both would work. Neither would MATCH.
//
// Twenty simple glyphs is a couple of hundred lines, and drawing them here buys
// two things no third-party set can: they share the avatar's exact line weight,
// cap and corner language, and the project carries no asset licence at all.
//
// Everything is composed from primitives rather than hand-typed path data, so
// the whole set stays consistent by construction — change STROKE once and every
// glyph changes with it. Grid is 24x24, optical centre (12, 12).
// ---------------------------------------------------------------------------

const n = (v) => Math.round(v * 1000) / 1000

// ── Primitives ──────────────────────────────────────────────────────────────

const poly = (pts, close = false) =>
  'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + (close ? 'Z' : '')

/** A full circle, as two arcs — works as both stroke and fill. */
const circle = (cx, cy, r) =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0Z`

const roundRect = (x, y, w, h, r) =>
  `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}` +
  `a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}` +
  `v${n(-(h - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}Z`

/** Arc from a0 to a1, in degrees, clockwise. */
function arc(cx, cy, r, a0, a1) {
  const rad = (a) => (a * Math.PI) / 180
  const x0 = cx + r * Math.cos(rad(a0))
  const y0 = cy + r * Math.sin(rad(a0))
  const x1 = cx + r * Math.cos(rad(a1))
  const y1 = cy + r * Math.sin(rad(a1))
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${large} 1 ${n(x1)} ${n(y1)}`
}

function star(cx, cy, outer, inner, points = 5, rot = -90) {
  const pts = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = ((rot + (i * 180) / points) * Math.PI) / 180
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return poly(pts, true)
}

/** A four-point sparkle with concave sides — the "magic" glyph. */
function sparkle(cx, cy, r, waist = 0.3) {
  const d = []
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    const na = a + Math.PI / 2
    const tipX = cx + r * Math.cos(a)
    const tipY = cy + r * Math.sin(a)
    const ntX = cx + r * Math.cos(na)
    const ntY = cy + r * Math.sin(na)
    const cX = cx + r * waist * (Math.cos(a) + Math.cos(na))
    const cY = cy + r * waist * (Math.sin(a) + Math.sin(na))
    d.push(i === 0 ? `M${n(tipX)} ${n(tipY)}` : '')
    d.push(`Q${n(cX)} ${n(cY)} ${n(ntX)} ${n(ntY)}`)
  }
  return d.join('') + 'Z'
}

function gear(cx, cy, outer, inner, teeth = 8) {
  const pts = []
  const step = (Math.PI * 2) / teeth
  // Half the circumference is tooth and half is root, and the tooth tips are
  // nearly as wide as their base — anything narrower reads as a flower.
  const half = step * 0.5
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    pts.push([cx + inner * Math.cos(a - half * 0.82), cy + inner * Math.sin(a - half * 0.82)])
    pts.push([cx + outer * Math.cos(a - half * 0.5), cy + outer * Math.sin(a - half * 0.5)])
    pts.push([cx + outer * Math.cos(a + half * 0.5), cy + outer * Math.sin(a + half * 0.5)])
    pts.push([cx + inner * Math.cos(a + half * 0.82), cy + inner * Math.sin(a + half * 0.82)])
  }
  return poly(pts, true)
}

/** A soft cloud — three lobes on a flat base. Used for thought and idle. */
function cloud(cx, cy, w) {
  const h = w * 0.62
  const l = cx - w / 2
  const b = cy + h / 2
  return (
    `M${n(l + w * 0.18)} ${n(b)}` +
    `a${n(w * 0.19)} ${n(w * 0.19)} 0 0 1 0 ${n(-w * 0.38)}` +
    `a${n(w * 0.25)} ${n(w * 0.25)} 0 0 1 ${n(w * 0.44)} ${n(-w * 0.16)}` +
    `a${n(w * 0.22)} ${n(w * 0.22)} 0 0 1 ${n(w * 0.4)} ${n(w * 0.16)}` +
    `a${n(w * 0.19)} ${n(w * 0.19)} 0 0 1 ${n(-w * 0.02)} ${n(w * 0.38)}` +
    'Z'
  )
}

// ── The set ─────────────────────────────────────────────────────────────────
// Each icon is { s: [stroked paths], f: [filled paths] }.

const S = (...d) => ({ s: d, f: [] })
const F = (...d) => ({ s: [], f: d })
const SF = (s, f) => ({ s, f })
/**
 * Filled body with a HOLE punched through it, via even-odd.
 *
 * A detail stroked on top of a filled shape in the same ink simply vanishes —
 * a gear hub, a flower centre, a pupil. Punching the hole instead keeps the
 * glyph readable at any size and in any colour, including on a dark backdrop.
 */
const H = (body, ...holes) => ({ s: [], f: [], e: [body + holes.join('')] })

export const ICONS = {
  sleep: S(poly([[5, 15.5], [11.5, 15.5], [5, 21], [11.5, 21]]), poly([[13.5, 4], [19, 4], [13.5, 10], [19, 10]])),

  moon: F('M20.4 15.1A8.6 8.6 0 0 1 9.4 4.1a8.7 8.7 0 1 0 11 11Z'),

  sun: SF(
    [
      poly([[12, 2.4], [12, 4.6]]), poly([[12, 19.4], [12, 21.6]]),
      poly([[2.4, 12], [4.6, 12]]), poly([[19.4, 12], [21.6, 12]]),
      poly([[5.2, 5.2], [6.8, 6.8]]), poly([[17.2, 17.2], [18.8, 18.8]]),
      poly([[18.8, 5.2], [17.2, 6.8]]), poly([[6.8, 17.2], [5.2, 18.8]]),
    ],
    [circle(12, 12, 4.4)],
  ),

  note: SF([poly([[10, 17.4], [10, 5.4], [19, 3.6], [19, 15.4]])], [circle(7.6, 17.6, 2.6), circle(16.6, 15.6, 2.6)]),

  think: SF([], [cloud(13, 9.5, 15), circle(7, 17.4, 1.7), circle(4.2, 20.6, 1.05)]),

  ear: S('M9.4 21.4c-.6-2.6-3-3.4-3-8.2a6.1 6.1 0 1 1 12.2 0c0 3.1-3.1 3.4-3.1 5.7a2.45 2.45 0 0 1-4.7.9'),

  chat: SF([], ['M5 4.6h14A2.4 2.4 0 0 1 21.4 7v7a2.4 2.4 0 0 1-2.4 2.4h-7.2L6.6 20.6v-4.2H5A2.4 2.4 0 0 1 2.6 14V7A2.4 2.4 0 0 1 5 4.6Z']),

  gear: H(gear(12, 12, 9.8, 6.4, 8), circle(12, 12, 2.9)),

  pencil: SF([], ['M16.6 3.2 20.8 7.4 9.2 19H5v-4.2Z', poly([[14.6, 5.2], [18.8, 9.4]])]),

  search: SF([circle(10.6, 10.6, 6.2), poly([[15.2, 15.2], [20.4, 20.4]])], []),

  hourglass: S(
    poly([[6.4, 3.4], [17.6, 3.4]]), poly([[6.4, 20.6], [17.6, 20.6]]),
    'M7.4 3.4c0 4.4 4.6 5.6 4.6 8.6s-4.6 4.2-4.6 8.6',
    'M16.6 3.4c0 4.4-4.6 5.6-4.6 8.6s4.6 4.2 4.6 8.6',
  ),

  orbit: SF(['M12 4.4a10.4 5.2 0 1 1 0 15.2 10.4 5.2 0 1 1 0-15.2Z'], [circle(12, 12, 3.4), circle(21.1, 9.6, 1.9)]),

  signal: S(arc(12, 17, 4, 200, 340), arc(12, 17, 7.6, 205, 335), arc(12, 17, 11.2, 210, 330)),

  spark: F(sparkle(11.5, 11, 8.2), sparkle(19, 18.6, 3.6)),

  upload: SF([poly([[12, 20], [12, 5.6]]), poly([[6.6, 11], [12, 5.4], [17.4, 11]])], []),
  download: SF([poly([[12, 4], [12, 18.4]]), poly([[6.6, 13], [12, 18.6], [17.4, 13]])], []),

  star: F(star(12, 12, 9.2, 4.1, 5)),

  drop: F('M12 2.6c4.2 5.3 6.4 8.6 6.4 11.4a6.4 6.4 0 1 1-12.8 0c0-2.8 2.2-6.1 6.4-11.4Z'),

  bolt: F(poly([[13.6, 2], [5.4, 13.2], [10.8, 13.2], [9.6, 22], [18.4, 10.2], [12.8, 10.2]], true)),

  bell: SF([poly([[10.2, 19.4], [13.8, 19.4]])], ['M12 2.6a5.9 5.9 0 0 1 5.9 5.9c0 4.4 1.5 5.6 2.1 6.9H4a10 10 0 0 0 2.1-6.9A5.9 5.9 0 0 1 12 2.6Z']),

  warn: SF([poly([[12, 9], [12, 13.6]])], ['M12 2.8 22 20.4H2Z', circle(12, 17, 1.15)]),

  question: SF(['M8.6 8.6a3.5 3.5 0 1 1 4.2 4.4c-.9.3-1.3 1-1.3 2v.6'], [circle(11.6, 19.4, 1.3)]),

  exclam: SF([poly([[12, 3.6], [12, 14.4]])], [circle(12, 19.4, 1.35)]),

  heart: F('M12 20.6C6.4 16.6 3 13.6 3 9.9A4.9 4.9 0 0 1 12 7a4.9 4.9 0 0 1 9 2.9c0 3.7-3.4 6.7-9 10.7Z'),

  flower: H(
    circle(12, 5.8, 3.6) + circle(12, 18.2, 3.6) + circle(5.8, 12, 3.6) + circle(18.2, 12, 3.6) + circle(12, 12, 3.4),
    circle(12, 12, 1.8),
  ),

  balloon: SF([poly([[12, 17], [12, 21.4]])], ['M12 2.6a6.4 7.4 0 0 1 0 14.8 6.4 7.4 0 0 1 0-14.8Z']),

  party: SF([poly([[4, 20.6], [11.2, 7.4], [17.2, 13.4], [4, 20.6]], true)], [
    circle(17.4, 4.4, 1.4), circle(21, 8.6, 1.1), circle(13.6, 3.2, 1),
  ]),

  hand: S(
    'M8.6 12.6V5.6a1.7 1.7 0 0 1 3.4 0v5.2',
    'M12 10.8V4.6a1.7 1.7 0 0 1 3.4 0v6.2',
    'M15.4 11V7a1.7 1.7 0 0 1 3.4 0v7.8a6.6 6.6 0 0 1-13.2 0v-3a1.7 1.7 0 0 1 3.4 0',
  ),

  check: S(poly([[4.6, 12.6], [9.8, 18], [19.4, 6.4]])),

  // Almond outline stroked, pupil filled — an eye needs contrast between the
  // two, and both in one ink only works if the lid is a line, not a shape.
  eye: SF(['M12 5c5.5 0 9.3 4.5 10.3 7-1 2.5-4.8 7-10.3 7S2.7 14.5 1.7 12C2.7 9.5 6.5 5 12 5Z'], [circle(12, 12, 3.1)]),
}

export const ICON_NAMES = Object.keys(ICONS)

/**
 * Render one icon as SVG markup.
 *
 * Stroke and fill are separate lists so a glyph can mix both — a magnifier is
 * all stroke, a warning triangle is a filled body with a stroked bar, and the
 * stroke geometry is drawn with round caps and joins to match the ink line
 * Humation uses.
 */
export function iconSvg(name, { size = 24, color = 'currentColor', stroke = 2.2 } = {}) {
  const icon = ICONS[name]
  if (!icon) return ''
  const holes = (icon.e || []).map((d) => `<path d="${d}" fill="${color}" fill-rule="evenodd"/>`).join('')
  const fills = holes + (icon.f || []).map((d) => `<path d="${d}" fill="${color}"/>`).join('')
  const strokes = (icon.s || [])
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${fills}${strokes}</svg>`
}
