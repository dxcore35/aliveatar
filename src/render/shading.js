// ---------------------------------------------------------------------------
// Shading — turning flat vector fills into lit, textured illustration.
//
// Humation paints every shape with one of five CSS custom properties. That is
// the whole lever: swap those five paints for gradient paint servers derived
// from the SAME properties, and every part of every avatar becomes lit at once,
// while the engine's live recolouring keeps working because the gradients still
// read from the property it animates.
//
// On top of that, each large shape gets duplicated two or three times with a
// translucent gradient or a texture pattern over it. Duplicating a path is far
// cheaper than an SVG filter: no offscreen buffer, no re-run when the face
// moves, and the gradient maps to the path's own bounding box for free.
//
// Order over a shape, matching how the illustration would be painted by hand:
//
//   1. the lit base colour            (gradient, one light from the upper left)
//   2. texture                        (weave / hair strands, multiplied)
//   3. occlusion                      (under the hairline, in folds)
//   4. rim light                      (the far edge catching the key light)
// ---------------------------------------------------------------------------

const PAINTS = [
  ['--hm-skin', 'skin'],
  ['--hm-clothes', 'clothes'],
  ['--hm-bottom', 'bottom'],
  ['--hm-hair', 'hair'],
]

/** Escape a path `d` for safe re-insertion. */
const attr = (s) => s.replace(/"/g, '&quot;')

/**
 * Repaint every Humation fill with its lit gradient.
 * `fill="var(--hm-skin, #FFFFFF)"` → `fill="url(#id-skin)"`.
 * The stroke colour is deliberately left alone: the ink line is what holds the
 * drawing together, and gradient-filled outlines look muddy.
 */
export function repaint(svg, id) {
  let out = svg
  for (const [v, name] of PAINTS) {
    out = out.replaceAll(`fill="var(${v}, #FFFFFF)"`, `fill="url(#${id}-${name})"`)
    out = out.replaceAll(`fill="var(${v}, #000000)"`, `fill="url(#${id}-${name})"`)
  }
  return out
}

/**
 * Add the shading passes over one shape, by duplicating its path.
 *
 * @param {string} d       the path data to duplicate
 * @param {string} id      this avatar's def prefix
 * @param {object} opts    which passes to draw
 */
export function shadingFor(d, id, opts = {}) {
  const { texture, occlusion = true, rim = true, occlusionOpacity = 1, rimOpacity = 1 } = opts
  const dd = attr(d)
  let out = ''
  if (texture) {
    out += `<path d="${dd}" fill="url(#${id}-${texture})" style="mix-blend-mode:multiply" opacity="${opts.textureOpacity ?? 0.55}"/>`
  }
  if (occlusion) out += `<path d="${dd}" fill="url(#${id}-occl)" opacity="${occlusionOpacity}"/>`
  if (rim) out += `<path d="${dd}" fill="url(#${id}-rim)" opacity="${rimOpacity}"/>`
  return out
}

/**
 * The contact shadow the figure casts on the ground.
 *
 * Nothing in the source art sits on anything, which is a large part of why a
 * flat avatar reads as a sticker. One soft ellipse under the feet is enough to
 * put the character in a space.
 */
export function groundShadow(id) {
  return `<ellipse id="${id}-shadow" cx="41" cy="83.5" rx="25" ry="4.2" fill="url(#${id}-ground)"/>`
}

/**
 * A single grain wash over the whole figure.
 *
 * This is the last pass, and it does most of the work: identical noise across
 * skin, cloth and hair is what makes them look printed on the same surface
 * rather than pasted together. It is one tiled image in `overlay`, so it costs
 * a composite and nothing else.
 */
export function grainWash(id, opacity = 0.5) {
  return `<rect x="-4" y="-4.5" width="88" height="88" fill="url(#${id}-grain)" style="mix-blend-mode:overlay" opacity="${opacity}" pointer-events="none"/>`
}
