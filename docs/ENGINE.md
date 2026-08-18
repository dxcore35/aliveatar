# How aliveatar works

Moved out of the lab page so the workbench stays a workbench. This is the
reference explanation of the engine.

## What each side brings

| Value | What it is |
|---|---|
| `Humation → identity` | Modular parts (head, body, bottom, item, glasses) picked from a seed, recoloured per entity. Deterministic: the same id is always the same person. |
| `GrokBot → life` | Spring morphs between eye shapes, blink curve, gaze clamp, spherical eye projection, and a state machine of expression pools and cadences. |

## The seam

Humation's eyes are two little paths baked into the head drawing. Every one
of the 24 head parts draws them at the *same* two boxes, which is what makes
the swap safe: cut those two paths, then measure them to recover the sphere
the engine needs.

| Step | What happens |
|---|---|
| **01 — Compose** | seed → parts + palette |
| **02 — Cut** | remove 2 baked eyes |
| **03 — Measure** | skin box → sphere |
| **04 — Project** | rings onto sphere |
| **05 — Draw** | d + transform per frame |

## Ported unchanged from the gist

| Value | What it is |
|---|---|
| `blink(t) = close 42 % → open 58 %, floor 0.04` | 320 ms, closing faster than opening. |
| `v += (−2ζωv − ω²(x − target)) dt` | Expression morph is a damped spring, not a linear tween. |
| `longitude = asin(offset / radius) + turn` | Each eye keeps its own resting angle on the head. |
| `scaleX = cos(longitude) / cos(longitude₀)` | Eyes narrow as they rotate away, and hide past the horizon. |
| `pointer clamped to ±0.6` | The gaze can never reach the edge of the face. |
| `POOLS · BLINK · EXPR_CADENCE` | All 39 state rows copied as-is. |

## What makes it read as real

Almost none of this is expensive. The ordering below is by how much each one
changes the impression, not by how much it costs.

| Value | What it is |
|---|---|
| `saccades, not glides` | Real eyes are still, then JUMP, then still. A saccade takes 30–80 ms and its duration scales with distance. Smoothly gliding eyes are the single most uncanny thing an avatar can do — this is the biggest change of the lot. |
| `microsaccades and drift` | During a fixation the eye is never actually still. A ~0.02 tremor every few hundred milliseconds, plus a slow drift. |
| `the head lags the eyes` | A look starts with the eyes; the head follows on a spring and the eyes then roll back towards centre. That lag is what makes a glance read as intentional. |
| `blinks that are not a metronome` | Intervals are clustered, not uniform. One in seven is a double, one in six is a half-lid, and a big saccade drags a blink along with it. |
| `breath is not a sine` | Quick inhale, catch at the top, slower exhale, pause at the bottom — and the weight shift runs on a completely different clock so the two never line up into one loop. |
| `lids follow the gaze` | Looking down lowers the upper lid. Without it, a downward glance reads as a stare. |
| `squash and stretch` | A hop stretches on the way up and squashes on landing, and the contact shadow tightens as the figure leaves the ground. |
| `every face is its own` | Eye spacing, size, aspect, corner tilt, mouth height, lid weight, blink rate and fidget level are all drawn from the seed. Two avatars sharing a hairstyle no longer share a face. |

## The look pass, and what it costs

| Value | What it is |
|---|---|
| `one light, whole figure` | The five Humation colour variables are repainted as gradients in USER space, so head, body and legs are lit by one light instead of each shape shading itself. |
| `texture is an image, not a filter` | Grain, twill and hair strands are generated once into a canvas at load and tiled. An SVG filter would re-run every time the face moved; a tiled image costs a composite and nothing else. |
| `shading is duplicated paths` | Occlusion under the hairline and a rim on the far edge are the same path drawn again with a translucent gradient. No offscreen buffer. |
| `a contact shadow` | One soft ellipse under the feet. Nothing in the source art sits on anything, which is most of why a flat avatar reads as a sticker. |
| `one shader, hard limits` | The aura is real WebGL, capped at three live contexts for the whole page, 144×144 regardless of display size, 30 fps, skipped when flat, and released the moment the avatar scrolls off screen. |
| `one loop for everybody` | Fifty avatars share ONE requestAnimationFrame. Physics runs at a fixed 120 Hz so springs settle identically on any display, off-screen avatars stop, a hidden tab stops, and reduced-motion is obeyed and watched. |

## An AI does not move like a person

Both kinds run the same engine; the profile decides how far it is allowed to
go. You should be able to tell which one you are looking at without reading
a label.

| Value | What it is |
|---|---|
| `customer · eyes stay on the face` | The head turn only slides the eyes a little, never rotates them around the skull, and never narrows them. Capped at ±14°. Natural eye size, no theatrics. |
| `agent · the full sphere` | Eyes travel around the head and disappear past the horizon. Taller, more drawn eyes (1.22 × 1.62). Sway reaches further. Spin is allowed. |
| `agent · tool calls` | Running a tool puts glasses on the face, floats a bubble with the call and its result, and runs the outfit colour around the hue wheel until the call returns. |
| `the mouth` | Humation draws none, so it is generated: four numbers per expression, plus a talk oscillation for the states where the avatar is actually speaking. |
| `the companion animal` | The cat on the head blinks on its own clock — never in step with its owner, because two faces blinking together look mechanical — and naps when the person is asleep. |
| `the arrival` | A new avatar springs up from small and low with its eyes shut, then opens them. Without it the first second reads as a static image. |

## Changed on purpose

| Value | What it is |
|---|---|
| `Expressions are generated, not stored` | Eight numbers per eye instead of 96 raw coordinates — so the same face fits a 4.5-unit Humation head as well as a 49-unit blob, and a new expression is one readable line. |
| `18 blob shapes → Humation part slots` | The gist's silhouette axis becomes the modular person: 24 heads × 8 bodies × 8 bottoms × 43 items × 3 glasses. |
| `MOTION table added` | A person needs breathing, sway, nodding and self-directed gaze; a floating blob did not. |
| `Head counter-shift` | The head art is still, so a turn nudges the whole head group — otherwise the eyes look like they are sliding across a frozen face. |

Back to the [README](../README.md).
