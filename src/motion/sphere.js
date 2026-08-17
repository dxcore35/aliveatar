// ---------------------------------------------------------------------------
// Sphere — the eye engine, ported from bloub (MIT, Jérémy Perret).
//   https://github.com/jeremy-prt/bloub — reference copy in reference/bloub/
//   ported from src/bot/face.ts @ 1caf2c55
//
// WHAT THIS REPLACES
//
// The old placement treated the head as a circle seen from the front: an eye
// was put at `cx + radius·sin(longitude)`, squeezed horizontally by a scalar,
// and rotated by a fixed per-eye tilt. Three things are missing from that, and
// all three are what makes a face read as a solid object rather than a sticker:
//
//   * the eye has no ORIENTATION on the surface, only a width scale, so it
//     never leans the way a feature on a turning head leans;
//   * there is no pitch and no roll — the head could only look left and right;
//   * the compression was applied along the screen x axis, not along the
//     surface, so a tilted eye sheared instead of foreshortening.
//
// bloub's model fixes all three at once by giving each eye the sphere's TANGENT
// FRAME at its own position, projected orthographically. The eye is then drawn
// through that 2×2 frame. Foreshortening, lean, and the eye sliding out of
// sight past the limb all fall out of the projection — none of them is coded.
//
// bloub measured the model against video of the original x.ai bot: the eye
// nearer the edge is 0.69× the width of the other and 0.663× its area, which is
// exactly the depth factor of a point on a sphere at that distance from centre.
//
// WHAT IS DIFFERENT HERE, AND WHY
//
// bloub owns its head: a perfect circle, two eyes straddling the centre at
// ±EYE_SPLIT, one rest pose measured off a video. We do not own ours — the head
// is Humation art, drawn in three-quarter view looking LEFT, with the two eyes
// both sitting well left of the head centre and at slightly different heights.
//
// So the rest pose is not a constant here. `headFrame()` RECOVERS it from the
// measured art (see the derivation on that function), which keeps every
// existing face exactly where the illustrator drew it while giving it a real
// head orientation to move away from.
// ---------------------------------------------------------------------------

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)

/** Rotate two vectors of an orthonormal frame within their common plane. */
function spin(u, v, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s],
  ]
}

/**
 * The head frame, then one tangent frame per feature.
 *
 * Screen axes: x right, y DOWN (SVG), z towards the viewer.
 * Angles are in RADIANS, unlike bloub's degrees, because everything measured
 * off the Humation art (`baseLongitude`) is already in radians.
 *
 * @param {{yaw:number,pitch:number,roll:number}} gaze head orientation.
 *        yaw + = turns right, pitch + = looks up, roll = head tilt.
 * @param {number[]} offsets each feature's own longitude on the head, measured
 *        from the head's forward direction. This is the generalisation of
 *        bloub's symmetric ±split: our two eyes are NOT symmetric about the
 *        head centre, and the mouth is a third feature on the same sphere.
 * @returns {{fx:number,fy:number,depth:number,a:number,b:number,c:number,d:number}[]}
 *        fx/fy are unit screen offsets from the head centre — multiply by the
 *        head radius. depth > 0 means the feature faces the viewer. (a,b) is
 *        where the tangent plane's own x axis lands on screen, (c,d) its y.
 */
export function eyeBasis(gaze, offsets) {
  let f = [0, 0, 1]
  let right = [1, 0, 0]
  let down = [0, 1, 0]

  ;[f, right] = spin(f, right, gaze.yaw)
  ;[down, f] = spin(down, f, gaze.pitch)
  ;[right, down] = spin(right, down, gaze.roll)

  return offsets.map((s) => {
    const [ef, er] = spin(f, right, s)
    return {
      fx: ef[0],
      fy: ef[1],
      depth: ef[2],
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
    }
  })
}

/**
 * Recover the head's rest orientation from the measured Humation face.
 *
 * This is the whole bridge between bloub's model and our realistic heads, and
 * it is solved ONCE per avatar, at build time. bloub argues the same point at
 * length about its own eye-fit table: anything solved inside the render loop
 * chatters, because everything it reads is moving sixty times a second.
 *
 * The derivation, taking the model above with roll = 0:
 *
 *   yaw only   →  f = [sin yaw, 0, cos yaw],  right = [cos yaw, 0, −sin yaw]
 *   feature s  →  ef = f·cos s + right·sin s = [sin(yaw+s), 0, cos(yaw+s)]
 *
 * so a feature's screen x is `radius · sin(yaw + s)` — and `baseLongitude` was
 * measured as exactly `asin((x − cx) / radius)`. Therefore
 *
 *   yaw = mean of the two baseLongitudes      (the pose: negative, looking left)
 *   s_i = baseLongitude_i − yaw               (the half-split, per eye)
 *
 * Adding pitch gives `ef.y = −sin(pitch)·cos(s)`, which inverts for pitch.
 * Roll tilts the line joining the two eyes; its on-screen slope is
 * `tan(roll) / cos(yaw)`, which inverts for roll.
 *
 * The three angles are then a very good fit but not an exact one, so whatever
 * is left over is stored as a RESIDUAL in the eye's own tangent plane. That
 * residual rides the surface like the eye does, so at rest every face is
 * pixel-identical to what Humation drew, and away from rest it stays glued on.
 *
 * @param {object} face the object `faceFrom()` builds in humation.js
 */
export function headFrame(face) {
  const [L, R] = face.slots
  const yaw = (L.baseLongitude + R.baseLongitude) / 2
  const offsets = [L.baseLongitude - yaw, R.baseLongitude - yaw]

  const meanY = ((L.y + R.y) / 2 - face.cy) / face.radius
  const pitch = -Math.asin(clamp(meanY / (Math.cos(offsets[1]) || 1), -0.999, 0.999))

  const dx = R.x - L.x
  const dy = R.y - L.y
  const roll = Math.abs(dx) > 1e-6 ? Math.atan((dy / dx) * Math.cos(yaw)) : 0

  const rest = { yaw, pitch, roll }
  const mouthOffset = face.mouth.baseLongitude - yaw
  const all = eyeBasis(rest, [offsets[0], offsets[1], mouthOffset])

  // Express each leftover offset in that feature's OWN tangent plane, by
  // inverting the 2×2 basis. Stored as (u, v) so the runtime can re-apply it
  // through whatever the basis has become.
  const residual = (e, wantX, wantY) => {
    const ex = wantX - (face.cx + e.fx * face.radius)
    const ey = wantY - (face.cy + e.fy * face.radius)
    const det = e.a * e.d - e.b * e.c
    if (Math.abs(det) < 1e-6) return [0, 0]
    return [(ex * e.d - ey * e.c) / det, (ey * e.a - ex * e.b) / det]
  }

  return {
    rest,
    offsets,
    mouthOffset,
    anchor: [residual(all[0], L.x, L.y), residual(all[1], R.x, R.y)],
    mouthAnchor: residual(all[2], face.mouth.x, face.mouth.y),
    /** Rest depth per eye — what the runtime depth is compared against. */
    restDepth: [all[0].depth, all[1].depth, all[2].depth],
    /** How far a gaze deflection may swing the head, in radians. */
    yawRange: Math.asin(clamp(face.gazeXMax / face.radius, 0, 0.9)),
    pitchRange: Math.asin(clamp(face.gazeYMax / face.radius, 0, 0.9)),

    /**
     * How far up and down an eye may travel, in viewBox units.
     *
     * Pitch, a mood's head pose and an act all push the eyes vertically, and
     * they ADD. `wide` alone tips the head 50° back. Left unbounded they stack
     * into eyes on the forehead or on the chin, which is not a strong pose —
     * it is a broken face, and it only shows on some heads, which makes it the
     * kind of fault that ships.
     *
     * The limit is a band around where the illustrator PUT the eyes, scaled to
     * the head, so it holds on a small head and a large one alike. It is a
     * clamp on the drawn result rather than on any one input, because clamping
     * the inputs separately still lets three of them add up past the edge.
     */
    eyeBand: [
      (L.y + R.y) / 2 - face.radius * 0.3,
      (L.y + R.y) / 2 + face.radius * 0.26,
    ],
    /** The same for the mouth, which must not climb into the eyes. */
    mouthBand: [face.mouth.y - face.radius * 0.2, face.mouth.y + face.radius * 0.22],
  }
}

/**
 * Place a feature on the head and return its SVG matrix.
 *
 * The composition, in order, is bloub's and the order is the point:
 *
 *   1. the tangent frame           — the surface the feature is painted on
 *   2. × the feature's own tilt    — a rotation INSIDE that plane, which is
 *                                    what lets the two eyes lean in mirror
 *   3. × its half-extents          — our rings are normalised to ±1, so size
 *                                    goes in the matrix; bloub bakes it into
 *                                    the path instead. Same result.
 *   4. × the blink, on screen y    — a blink is a vertical squash IN THE
 *                                    IMAGE, not a shrink along the eye's own
 *                                    tilted axis. Applying it before the frame
 *                                    makes a leaning eye close diagonally.
 *
 * `sphere` blends the whole thing back towards a flat sticker, because that is
 * the locked behaviour for people: a human's eyes stay on their face and do not
 * ride around the skull. Agents get the full projection.
 *
 * @param {object} e      one entry from eyeBasis()
 * @param {number[]} anchor the (u, v) residual from headFrame()
 * @param {object} g      geometry: {cx, cy, radius, flatX, flatY, w, h, tilt}
 * @param {number} blinkK screen-space vertical squash, 0..1
 * @param {number} sphere 0 = flat sticker, 1 = full sphere projection — the
 *        SHAPE of the feature: its lean and its foreshortening.
 * @param {number} posMix the same blend for the feature's PLACEMENT. Split from
 *        `sphere` because people need both halves set differently: a person may
 *        gain the volume without their eyes travelling further across the face
 *        than the illustrator drew them travelling. Defaults to `sphere`.
 */
export function featureMatrix(e, anchor, g, blinkK, sphere, posMix = sphere) {
  // Rotate within the tangent plane (Basis × Rot).
  const cp = Math.cos(g.tilt)
  const sp = Math.sin(g.tilt)
  const ax = e.a * cp + e.c * sp
  const ay = e.b * cp + e.d * sp
  const cx2 = -e.a * sp + e.c * cp
  const cy2 = -e.b * sp + e.d * cp

  // The flat fallback is the same eye with no surface under it: its own tilt,
  // no foreshortening. Blending the four numbers is a blend of the two frames.
  const fax = cp
  const fay = sp
  const fcx = -sp
  const fcy = cp

  const mix = (s, f) => f + (s - f) * sphere
  const m00 = mix(ax, fax) * g.w
  const m10 = mix(ay, fay) * g.w * blinkK
  const m01 = mix(cx2, fcx) * g.h
  const m11 = mix(cy2, fcy) * g.h * blinkK

  // The anchor rides the surface, so it goes through the BARE tangent frame —
  // the same one `headFrame` inverted to produce it. Putting it through the
  // tilted frame instead rotates the correction by the eye's own lean and the
  // rest pose stops being exact.
  const sx = g.cx + e.fx * g.radius + anchor[0] * e.a + anchor[1] * e.c
  const sy = g.cy + e.fy * g.radius + anchor[0] * e.b + anchor[1] * e.d

  // `offX`/`offY` ride on top of BOTH placements — they are movements of the
  // whole feature in the image (breath, drift), not of the head it sits on, so
  // blending them away with the projection would silently drop them on agents.
  let x = g.flatX + (sx - g.flatX) * posMix + (g.offX || 0)
  let y = g.flatY + (sy - g.flatY) * posMix + (g.offY || 0)

  // Hold the feature inside the part of the face it belongs to.
  //
  // Applied to the FINAL numbers, after every contributor has had its say —
  // pitch, mood pose, act and gaze all move this and they ADD, so bounding any
  // one of them still lets the sum run off the face.
  //
  // The region is an ellipse, not a rectangle, and it is asymmetric vertically:
  // an eye has less room upward (the hairline) than downward (the cheek), and
  // the mouth has less room up (the nose) than down (the chin). Clamping
  // radially rather than per axis means a diagonal push is pulled back along
  // its own direction, so the feature slides along the boundary instead of
  // catching on a corner.
  if (g.region) {
    const r = g.region
    const dx = x - r.cx
    const dy = y - r.cy
    const ry = dy < 0 ? r.up : r.down
    const nx = dx / r.rx
    const ny = dy / ry
    const d = Math.hypot(nx, ny)
    if (d > 1) {
      x = r.cx + (dx / d)
      y = r.cy + (dy / d)
    }
  } else if (g.band) {
    y = clamp(y, g.band[0], g.band[1])
  }

  return {
    x,
    y,
    // The four matrix components, so a caller can move the feature AFTER the
    // fact — the eye-separation pass below needs to slide an eye sideways and
    // rebuild its matrix without recomputing the frame.
    m: [m00, m10, m01, m11],
    // Half the feature's extent along screen x, which is what the unit ring
    // (±1 in both axes) maps to through this matrix. Used to tell whether two
    // eyes are actually overlapping rather than merely close.
    halfX: Math.abs(m00) + Math.abs(m01),
    transform: matrixOf([m00, m10, m01, m11], x, y),
  }
}

/** Format a 2×3 affine as an SVG matrix(). */
export function matrixOf(m, x, y) {
  return (
    `matrix(${m[0].toFixed(4)},${m[1].toFixed(4)},${m[2].toFixed(4)},` +
    `${m[3].toFixed(4)},${x.toFixed(3)},${y.toFixed(3)})`
  )
}

/**
 * Two eyes may never become one.
 *
 * A face has two eyes with a nose between them, and nothing a mood, an act or a
 * head turn does changes that. Several things here legitimately pull them
 * together — a mood's `splitScale`, the region clamp, and the foreshortening of
 * a hard turn — and they ADD, so on some combinations the two eyes met in the
 * middle and read as a cyclops.
 *
 * This is the last word on where they end up: if their drawn shapes would
 * overlap, both are pushed apart along the line between them until they do not,
 * symmetrically, so the pair stays centred where the face put it.
 *
 * It deliberately does NOT run when one eye is most of the way behind the head
 * — there the two converging is correct perspective, and the far one is fading
 * out anyway.
 *
 * @param {object} a  first eye's featureMatrix result
 * @param {object} b  second eye's result
 * @param {number} gap minimum ink between the two shapes, in viewBox units
 */
export function separateEyes(a, b, gap = 0.35) {
  let dx = b.x - a.x
  let dy = b.y - a.y
  let dist = Math.hypot(dx, dy)
  // Exactly coincident: pick an axis rather than dividing by zero.
  if (dist < 1e-4) {
    dx = 1
    dy = 0
    dist = 1
  }
  const need = a.halfX + b.halfX + gap
  if (dist >= need) return
  const push = (need - dist) / 2
  const ux = dx / dist
  const uy = dy / dist
  a.x -= ux * push
  a.y -= uy * push
  b.x += ux * push
  b.y += uy * push
  a.transform = matrixOf(a.m, a.x, a.y)
  b.transform = matrixOf(b.m, b.x, b.y)
}

/**
 * Blink, as a vertical squash factor.
 *
 * Never reaches zero. An eye scaled flat vanishes for a frame or two and the
 * face reads as a glitch; leaving a sliver keeps the closed eye as a drawn
 * line, which is what a closed eye looks like.
 */
export function blinkScale(lid, floor = 0.06) {
  return floor + (1 - floor) * clamp(lid)
}

/**
 * Periodic 1D noise — loops seamlessly on `period`, so nothing accumulates and
 * nothing drifts out of range no matter how long the page is open.
 */
export function loopNoise(t, period, seed = 0) {
  const p = (t / period) * Math.PI * 2
  return (
    0.55 * Math.sin(p + seed) +
    0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
    0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
  )
}

/**
 * Head roll wobble — the one axis of bloub's `liveliness()` we did not already
 * have.
 *
 * Our gaze engine (motion/gaze.js) already models saccades, microsaccades and
 * drift far more thoroughly than bloub's yaw/pitch drift does, so importing
 * those would only double the same motion. Roll is genuinely new: the old
 * engine had no way to tilt a head at all, and a head that never rolls is a
 * head bolted to a post.
 *
 * Pure function of time — no accumulator, so pausing, resuming, or jumping to
 * an arbitrary instant all give the same image.
 *
 * @returns {number} radians
 */
export function rollWobble(t, amount = 1) {
  return loopNoise(t, 13.7, 3.2) * 0.038 * amount
}
