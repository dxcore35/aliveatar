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
