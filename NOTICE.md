# Third-party notices

## Humation — MIT

`vendor/@humation/core` and `vendor/@humation/assets-humation-1` are vendored
copies of the Humation avatar system by Yusuke Endo, used unmodified and under
the MIT licence. Their `LICENSE.md` files are included in those directories.

- https://github.com/endo-yusuke/humation

The avatar artwork (heads, bodies, bottoms, items, glasses) comes from that
package. Everything this project does to it — cutting the baked eyes, measuring
the head sphere, repainting the fills as lit gradients — is applied at runtime;
the source assets are not altered.

## bloub — MIT

`src/motion/sphere.js` is a port of the eye engine from **bloub** by Jérémy
Perret, used under the MIT licence.

- https://github.com/jeremy-prt/bloub — commit `1caf2c55`

A reference copy of that repository is kept read-only in `reference/bloub/`,
including its `LICENSE`. It is there so the model can be checked against its
source; nothing in it is imported or built.

`src/motion/eyeacts.js` is a second port from the same repository — the eye
half of bloub's animated states (`src/bot/states.ts`) and its gaze scripts
(`src/ui/gaze.ts`). Everything there that belongs to bloub's own BODY — the blob
collapsing into three dots, the travelling exclamation mark, the orbiting rings,
the comet — is deliberately not ported; we draw a person, not a blob. Where such
a state also moved the eyes, that part is here, rewritten as offsets and
multipliers so it lands on a real face.

The sixteen moods in `src/expressions.js` from index 25 upward come from
bloub's `src/bot/expressions.ts`, translated the same way.

What was ported is the geometry: the head frame built from yaw/pitch/roll, the
per-eye tangent frame taken off the sphere and projected orthographically, the
blink as a screen-space vertical squash applied after that frame, and the
seamless `loopNoise` drift. What is different here is that bloub owns its head —
a perfect circle with symmetric eyes and one rest pose measured off a video —
while ours is Humation artwork in three-quarter view. So the rest pose is not a
constant: `headFrame()` recovers it from the measured art, and each eye carries
its own longitude instead of a shared ±split. The eye shapes themselves stay
this project's parametric rings; bloub's capsules were not adopted.

## Generated skulls

`src/render/skull.js` is original to this project — no third-party geometry. It
rewrites the single skull path of a Humation head for agents only, leaving the
hair, the ink outlines and every other shape exactly as drawn. People always
keep the head the illustrator drew.

## Everything else

The motion engine, the shading and texture pass, the icon set, the aura shader,
the speech engine and the control API are original to this project.

The behaviour of the face engine was reimplemented from a public technical
teardown published as a GitHub gist
(`smontlouis/49a4c9303de70118a90dc43badc1aba5`). No code was copied from it —
the expression data in that gist is ~110 KB of hand-authored coordinates, and
this project generates its expressions parametrically instead. The measured
constants that were reused (blink timing, the spring form, the projection
formulas, the state cadence tables) are documented in `README.md`.

## Deliberately not used

A licence survey of icon and emoji sets is summarised in `README.md`. The
following were rejected and are **not** present in this repository:

- **JoyPixels Free** — personal use only, no commercial use
- **OpenMoji** — CC BY-SA 4.0, viral share-alike on any recolour
- **Solar**, **Font Awesome Free**, **Twemoji artwork** — CC BY 4.0, visible
  credit required
- **Remix Icon** — licence changed in January 2026; npm metadata still
  advertises Apache-2.0
- **Animate.css** — Hippocratic 2.1, not a permissive licence
- **css-loaders.com** — no licence granted at all

The emblem icon set in `src/render/icons.js` was drawn for this project
specifically so that no third-party asset licence has to be carried.
