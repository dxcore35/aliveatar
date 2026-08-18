# Wardrobe research — more hairstyles, more clothing, same style

Scope: research only, no code changed. This answers what exists today, what a
new part must satisfy to drop in, where free compatible artwork might come
from, a concrete proposal, an effort ranking, and the specific risk the
eye/skull pipeline puts on new hairstyles.

Everything below was read from the real files in this repository —
`vendor/@humation/assets-humation-1/manifest.json`, the SVGs under
`vendor/@humation/assets-humation-1/assets/humation-1/`, and
`src/humation.js` / `src/render/skull.js` — plus, for the licence research,
real SVGs fetched live from the DiceBear API and inspected in the browser.

---

> **Decision, 2026-08-18 — the frame stays a portrait.**
>
> The avatar is drawn 104 units tall and shown through an 88-unit square, so
> everything below the chest is outside the frame. That crop is deliberate and
> is not changing.
>
> What follows from it: **anything in the `bottom` slot is invisible.** Swim
> shorts, the skirts, the trousers — none of them can be seen at the size this
> is used. Drawing them is wasted work. The proposals below that belong to
> `bottom` are kept for the record but should not be built.
>
> Still worth drawing: **tops** (a bikini top DOES show), **hairstyles**, and
> **items**. Those are all inside the frame.

## 1. What the existing parts actually are

The friendly names below are exactly what the app uses: `PARTS` in
`src/humation.js` (line 437) is built straight from the manifest's `name`
field, grouped by `selectionSlot` — nothing is re-cased or relabelled. These
are the names that appear in the picker UI and in `PARTS.head` /
`PARTS.body` / `PARTS.bottom`.

### Heads — 24 hairstyles (`selectionSlot: "head"`)

| # | Name | Description |
|---|------|-------------|
| 001 | fluffy-bob | Chin-length bob with soft, rounded, voluminous ends |
| 002 | round-bob | Tight, rounded bob that curves under at the jaw |
| 003 | short | Plain short crop, closer to the head than the others |
| 004 | curly-short | Short hair rendered as tight curl clusters |
| 005 | short-bangs | Short cut with a straight-cut fringe |
| 006 | side-swept-short | Short cut, fringe swept to one side |
| 007 | messy-short | Short cut with deliberately irregular, tousled strands |
| 008 | wavy-medium | Shoulder-length hair with a visible wave pattern |
| 009 | flipped-long | Long hair with the ends flicked outward |
| 010 | lob | "Long bob" — bob length extended past the shoulder |
| 011 | long-straight | Straight hair falling well past the shoulders |
| 012 | side-swept-lob | Lob length, fringe/parting swept to one side |
| 013 | blunt-bob | Bob with a hard, straight-cut hem, no layering |
| 014 | bun | Hair gathered into a single rounded bun |
| 015 | low-side-bun | Bun placed low, off to one side of the nape |
| 016 | low-twin-buns | Two small buns, both low near the nape |
| 017 | ponytail | Single gathered tail |
| 018 | low-ponytail | Ponytail gathered low, near the nape |
| 019 | low-twin-tails | Two low pigtails |
| 020 | braids | Hair worked into braid(s) |
| 021 | blunt-long | Long hair with a hard straight-cut hem |
| 022 | side-swept-long | Long hair, fringe swept to one side (jaw ink partial — see §6) |
| 023 | wavy-long | Long hair with a wave pattern (jaw ink partial — see §6) |
| 024 | curly-long | Long hair rendered as curl clusters (jaw ink absent — see §6) |

### Bodies — 8 tops (`selectionSlot: "body"`)

| # | Name | Description |
|---|------|-------------|
| 001 | cropped-shirt | Short top that stops above the waist, bare midriff |
| 002 | tank-top | Sleeveless top, straight or scoop neckline |
| 003 | drape-tee | Loose, draped T-shirt silhouette |
| 004 | polo | Collared shirt with a short button placket |
| 005 | tee | Plain crew-neck short-sleeve T-shirt (inspected directly — see §2) |
| 006 | shirt | Button-front shirt with a collar, long sleeves |
| 007 | jacket | Open outer layer, worn over an under-layer |
| 008 | hoodie | Hooded sweatshirt, drawstring visible at the neck |

### Bottoms — 8 (`selectionSlot: "bottom"`)

| # | Name | Description |
|---|------|-------------|
| 001 | wide-pants | Straight, wide-leg full-length trousers (inspected — see §2) |
| 002 | tapered-pants | Full-length trousers narrowing toward the ankle |
| 003 | culottes | Wide-legged, cropped above the ankle — skirt-like silhouette |
| 004 | long-skirt | Full-length skirt |
| 005 | mini-skirt | Short skirt, well above the knee (inspected — see §2) |
| 006 | midi-skirt | Mid-calf-length skirt |
| 007 | flared-skirt | Skirt with an A-line/flared hem |
| 008 | cropped-pants | Full-length-cut trousers cropped at the ankle |

This is the baseline. Every one of those 40 names is taken; a new part
proposal that reuses one of them, or draws a shape that's really the same
garment under a new name (e.g. another plain crew-neck tee), is wasted work.

**Age/gender pools matter for reach.** `src/humation.js` (lines 390–403)
splits heads and bottoms into `MALE_HEADS` (5 of the 24), `FEMALE_HEADS` (19
of the 24) and `OLDER_HEADS` (8, shared), and bottoms into `MALE_BOTTOMS` (3)
and `FEMALE_BOTTOMS` (5). `genderSelections()` (line 418) only draws from
these lists when a caller passes `gender: 'male'` or `'female'`; without a
gender hint, or for `kind: 'customer'` without a gender, the underlying
Humation seed picks from *all* parts in the slot. Bodies aren't split by
gender, only by age (`OLDER_BODIES`, `YOUNGER_BODIES`, `ALL_BODIES`, lines
407–409). **A new hairstyle that isn't added to one of these pools is still
technically selectable (raw seed pick), but will never come up for an avatar
built with an explicit gender — which is most of them.** This is a real
registration step, not an SVG-only change (detailed in §2).

---

## 2. The drawing contract

Concrete numbers, read from the files, not estimated.

**File format.** One SVG per part, `width="80" height="80" viewBox="0 0 80 80"`
for head/body/item/glasses; bottoms are taller — `width="80" height="107"
viewBox="0 0 80 107"`. `fill="none"` on the root `<svg>`. No `<g>` wrapper, no
`<defs>`, just a flat list of `<path>` elements (glasses/items are the one
exception — see below).

**Coordinate origin and registration.** The composited avatar's own crop is
`{x:-4, y:-4.5, width:88, height:88}` (`manifest.json` → `crops.avatar`).
Each slot is placed by `layerSlots` in the manifest at a fixed offset, in the
same 80-wide coordinate space:

| Slot | Offset (x, y) | Size | Global y-range |
|------|---------------|------|-----------------|
| bottom | (0, 85) | 80 × 107 | 85 → 192 |
| body | (0, 51) | 80 × 80 | 51 → 131 |
| head | (0, -0.5) | 80 × 80 | -0.5 → 79.5 |
| item | (0, 0) | 80 × 80 | 0 → 80 |
| glasses | (0, 0) | 80 × 80 | 0 → 80 |

Body and bottom **overlap by 46 units** (global y 85–131): the body SVG's own
local coordinates already run down to y≈68–69 (confirmed in `body/005.svg`,
the `tee`), i.e. into the hip/upper-leg zone, and the bottom SVG's local y=0
is exactly where that zone starts. A new top must draw its lower hem/hip
silhouette inside that shared band so it doesn't step outside the leg shape
the chosen bottom is about to draw underneath it — this is the one seam a new
part actually has to get right by eye, there's no clipping enforced.

**Colour.** Every fill on every part is `fill="var(--hm-<slot>, #<hex>)"` —
CSS custom properties, never a raw literal, with exactly one exception per
part: the shoes. `bottom/001.svg`'s first two paths (the shoe/sock shapes)
are hardcoded `fill="#000000"` and `fill="#FFFFFF"` with no CSS variable at
all — footwear is not recolourable in the current art, on any of the 8
bottoms checked. A new bottom that wants recolourable shoes would be
introducing a capability the existing set doesn't have; matching the
existing contract means leaving shoes black/white too.

The five variables actually used across head/body/bottom:
- `--hm-hair` (hair fill, hex default `#000000`)
- `--hm-skin` (skin fill, `#FFFFFF`)
- `--hm-clothes` (top fill, `#FFFFFF`)
- `--hm-bottom` (bottom-garment fill, `#000000`)
- `--hm-stroke` (every ink outline, `#000000`) — this is not a real SVG
  `stroke`, it's the fill colour of separate outline-shaped paths (see next
  point).

**The "stroke" is a filled shape, not a stroke.** In head/body/bottom art,
what reads as a black ink outline is drawn as its own closed path filled with
`var(--hm-stroke, #000000)`, layered over the colour fills — e.g. `head/001.svg`
has 8 separate `fill="var(--hm-stroke, ...)"` paths on top of one hair path
and one skin path. There is no `stroke-width` property anywhere in these
three slots to quote a line weight from. **Glasses and some items are drawn
the opposite way** — `glasses/001.svg` uses real `<circle>`/`<path>` elements
with `stroke="var(--hm-stroke, ...)"` and an explicit `stroke-width="25.51"`
in a scaled `transform="scale(0.06667)"` group, i.e. an effective width of
25.51 × 0.06667 ≈ **1.7 units** in the 80-unit frame (≈2.1% of head width).
`item/031.svg` (sunglasses) uses `stroke-width="1.5px"` directly in the same
80-unit frame (≈1.9%). **For a new hairstyle or garment, match the visual
weight implied by that ≈1.5–1.7-unit figure when drawing the ink-outline
paths as filled shapes** — there's no property to set, only a width to eyeball
against.

**Registration points a new head must hit exactly.** `src/humation.js`
(lines 444–455) hardcodes four bounding boxes measured off all 24 existing
heads, with a ±0.6-unit tolerance (`BOX_TOLERANCE`, line 455):

```
EYE_BOX_L = [28.2, 35.1, 30.1, 37.3]
EYE_BOX_R = [32.7, 35.4, 34.6, 37.7]
JAW_L_BOX = [22.5, 32.8, 36.7, 53.5]
JAW_R_BOX = [44.3, 36.9, 53.7, 52.3]
```

`buildAvatar()` (line 511 onward) scans every path in the head layer, and:
1. Requires **exactly two** paths whose bbox matches `EYE_BOX_L`/`EYE_BOX_R` —
   these get cut out and replaced by the live animated eyes. **A new head
   without two small filled paths at those exact coordinates throws at build
   time** (`humation: expected 2 baked eyes in the head art, found N`, line
   545) — this is not cosmetic, it's a hard runtime failure.
2. Requires exactly one path whose fill contains `--hm-skin` — used to
   measure the head-as-sphere (`skinBox`).
3. Looks for the jaw ink paths at `JAW_L_BOX`/`JAW_R_BOX` (only used when a
   generated skull replaces the face shape — agents only, see §6).

So the drawing contract for a **new head** is: 80×80 viewBox, one
`--hm-hair` path, one `--hm-skin` path, N `--hm-stroke` ink paths, and **two
small eye-pupil paths whose bounding boxes fall within 0.6 units of the
constants above** — i.e. the eyes must sit in the *same place on the canvas*
as every existing head, because the face is three-quarter view looking left
on every one of the 24 (confirmed by inspecting `head/001.svg` and
`head/003.svg` directly — both are unmistakably the same head angle, same
eye placement, different hair only).

**No multi-layer parts.** Checked the whole manifest (86 parts): every part
has exactly one `layers` entry. A part is one SVG file, full stop — nothing
like "top + separate collar" splitting.

**The vendored asset pack is not directly editable at runtime — there's a
bake step.** `src/humation.js` imports `humation1` from
`vendor/humation.bundle.js`, which is a generated file (`tools/bake-humation.js`,
run via `bun run bake`) that bundles
`vendor/@humation/core/dist/index.js` and
`vendor/@humation/assets-humation-1/dist/index.js`. The actual part data —
manifest *and* every SVG's content, inlined as a JS template string — lives in
`vendor/@humation/assets-humation-1/dist/embedded.js` (2,634 lines), which is
itself a *compiled* file; the generator that produces it from
`manifest.json` + the loose `assets/**/*.svg` files is **not vendored** (the
package's own README says "the generated `src/` manifest modules are a
synchronized asset snapshot" — that `src/` doesn't exist in this vendor copy,
only `dist`). **Concretely: dropping a new SVG into
`vendor/@humation/assets-humation-1/assets/humation-1/head/025.svg` and
adding an entry to `manifest.json` does nothing on its own.** The part also
has to be added to `dist/embedded.js` (and `dist/manifest-json.js`, and
`manifest.json`, kept in sync by hand or by a small custom script written
for this repo, since upstream's generator isn't available here), and then
`bun run bake` re-run to regenerate `vendor/humation.bundle.js`, which is
the only thing `src/humation.js` actually reads. This is mechanical — the
JSON/JS structure is simple and regular — but it's a real step, not "drop a
file in".

---

## 3. Free, MIT/CC0 sources of compatible artwork

Judged against Humation's actual style: **thick, uniform, hand-inked outline
drawn as a filled shape (not a stroke), flat colour fills swappable per
region, three-quarter-view face, moderate realism (not chibi/emoji-flat, not
sketchy/loose)**. I fetched and looked at the real rendered SVGs for the
candidates below (via the DiceBear API, seed=`test`, and separately checked
the Open Peeps/Notionists project pages) rather than judging from
descriptions alone.

| Set | Licence | Parts | Verdict |
|---|---|---|---|
| **Open Peeps** (Pablo Stanley, served via DiceBear `open-peeps`) | **CC0 1.0** — public domain, no attribution needed | ~600k combinations from 20+ hair, 30+ face, 40+ clothing pieces | **Closest match of everything checked.** Thick uniform black outline, flat colour fills for skin/hair/clothes — same construction philosophy as Humation. Genuine differences: Open Peeps' shapes are chunkier and more blob-like (fewer interior strokes — no eyebrow/wrinkle/strand linework the way Humation heads have 6–8 separate ink paths each), and it's front-facing, not three-quarter view. **Usable as a shape/pose reference to hand-trace from, not as drop-in SVGs** — the line density is visibly lower than Humation's. |
| **Avataaars** (Pablo Stanley) | **CC0** | Full modular set (hair, clothing, accessories, facial hair) | **Does not match.** Confirmed by rendering: it's almost entirely flat colour blocks with little to no ink outline at all — silhouettes are separated by colour contrast, not by a drawn line. Humation's whole visual identity is the ink line; Avataaars doesn't have one to speak of. Reject. |
| **DiceBear Personas** (Draftbit) | **CC0**, code MIT | Broad age/appearance range, hair, facial hair, glasses | **Does not match.** Confirmed by rendering: zero outline anywhere, pure flat shape stacking (this is closer to Google's "Material" illustration language than to hand-drawn ink art). Reject. |
| **DiceBear Notionists** | **CC0** (by Zoish) | Half-body figures with props | **Does not match, and not just stylistically.** Confirmed by rendering: it's monochrome black-ink linework on white — there are no separate flat-fill regions for skin/hair/clothes at all, so there's nothing to map onto `--hm-skin`/`--hm-hair`/`--hm-clothes`. Adapting it would mean redrawing the fills from scratch, not recolouring existing ones. Reject. |
| **DiceBear Adventurer** (Lisa Wischofsky) | **CC-BY-4.0** — attribution required | Hair, facial features, accessories | **Closest *stroke philosophy* of anything checked** — thick, uniform, flat-filled outline, genuinely similar line weight to Humation. But: proportions are caricatured/wide-eyed rather than Humation's more restrained three-quarter portrait, the crop I could render is head-only (no visible clothing set in the free tier check), and CC-BY-4.0 means every shipped avatar using derived art needs a visible credit line somewhere in the product — a real product decision, not a formality. Worth a closer look if attribution is acceptable; not free of legal/UX cost the way CC0 is. |
| **DiceBear Big Ears**, **Croodles** | **CC-BY-4.0** | Not visually checked in this pass (time-boxed) | Same attribution caveat as Adventurer. Listed for completeness; would need the same real-file check before use — don't take this row as a recommendation, only as "known to exist, unverified fit." |

**Bottom line:** nothing found is a genuine drop-in. Open Peeps is the best
*reference* for silhouette/pose ideas under a licence with zero strings
attached; everything CC0 that was actually checked either has no ink line
(Avataaars, Personas) or no colour fills (Notionists). The CC-BY sets
(Adventurer particularly) are stylistically closer but carry an attribution
obligation that should be a deliberate call, not something absorbed
silently. None of this changes the practical recommendation in §5: hand
tracing over Humation's own paths, or deriving from an existing Humation
part, will look more "in-family" than importing from any of these.

---

## 4. Concrete proposal

### ~12 new hairstyles (`selectionSlot: "head"`)

| Name | Shape | Slot |
|---|---|---|
| `pixie-cut` | Very short at the sides and back, slightly longer swept fringe on top. | head |
| `buzz-cut` | Uniform near-scalp length all over, no parting, no fringe. | head |
| `afro` | Round, voluminous halo of tight curls framing the whole head. | head |
| `top-knot` | Hair pulled fully up and gathered into one high, rounded knot on the crown. | head |
| `space-buns` | Two rounded buns set high, near the crown (distinct from the existing low-set `low-twin-buns`). | head |
| `cornrows` | Tight rows of braids close to the scalp, gathered at the nape. | head |
| `curtain-bangs` | Long hair, centre-parted, with two face-framing fringe pieces swept outward. **Risk-flagged, §6.** | head |
| `mullet` | Short and cropped at the front/sides, long at the back. | head |
| `quiff` | Short at the sides, swept-up voluminous roll at the front. | head |
| `wolf-cut` | Shaggy, heavily layered medium length with a choppy, textured fringe. | head |
| `locs` | Long twisted rope-like sections, worn loose or gathered back. | head |
| `finger-waves` | Short, close-set S-shaped waves combed flat against the scalp. | head |

### ~14 new clothing parts, tops + bottoms, including swimwear

**Tops (`selectionSlot: "body"`):**

| Name | Shape | Slot |
|---|---|---|
| `bikini-top` | Halter-tied triangle top, bare midriff below (swimwear). | body |
| `sports-bra` | Cropped, close-fitting athletic strap top. | body |
| `knitted-jumper` | Chunky, ribbed crew-neck knit, long sleeves, visible cable/rib texture lines. | body |
| `vest` | Sleeveless fitted waistcoat, worn open over a collar, one or two buttons. | body |
| `suit-jacket` | Structured blazer with lapels, single button, worn open or closed. | body |
| `cardigan` | Open-front knit layer over an under-top, button placket down the centre. | body |
| `turtleneck` | High folded collar, long sleeves, close fit. | body |
| `blouse` | Softer button-front top with a tie or bow at the neckline. | body |

**Bottoms (`selectionSlot: "bottom"`):**

| Name | Shape | Slot |
|---|---|---|
| `swim-shorts` | Above-knee elastic-waist trunks with a drawstring tie. | bottom |
| `joggers` | Tapered sweatpants with an elastic, cuffed ankle hem. | bottom |
| `denim-shorts` | Casual mid-thigh shorts, straight hem. | bottom |
| `wrap-skirt` | Asymmetric tie-front skirt, midi length, overlapping front panel. | bottom |

**Cross-slot pairs — see the constraint noted below before building these:**

| Name | Shape | Slots |
|---|---|---|
| `dress` | One continuous garment: fitted bodice (body slot) + matching skirt (bottom slot). | body **+** bottom, paired |
| `one-piece-swimsuit` | Fitted bodice cut low at the leg (body slot) + matching plain-leg bottom, no separate garment break at the waist (bottom slot). | body **+** bottom, paired |
| `coat` | Long outer layer reaching past the hip — structurally the same cross-slot problem as `dress`. | body **+** bottom, paired |

**The pairing constraint, stated plainly:** `body` and `bottom` are two
independent `selectionSlots` (`manifest.json`), and `genderSelections()`
(`src/humation.js` line 418 onward) currently hashes each one separately —
nothing today ties a specific top to a specific bottom. A `dress`,
`one-piece-swimsuit`, or `coat` needs its top half and bottom half to *always*
appear together, never mixed with an unrelated bottom/top. That's not solved
by drawing the SVGs — it needs either (a) a manifest-level "linked pair" rule
that doesn't exist in Humation today, or (b) treating the visible-skin-gap
convention loosely (draw the "bottom half" as a bare-leg/plain fill that
looks fine under *any* top, and accept the dress only ever really reads
right when both halves are picked, which the seed-hash approach doesn't
guarantee). This is a real design decision to make before drawing these
three, not just extra effort — flagging it here rather than glossing over
it.

That's 12 heads and 15 clothing parts (8 tops + 4 bottoms + 3 flagged
cross-slot pairs) — slightly over the ~14 asked for, because the prompt's
named examples (coat, jumper, vest, suit jacket, dress) plus the three named
swimwear pieces (bikini top, swim shorts, one-piece) already total 8 fixed
items before any of my own additions.

---

## 5. How to actually make them, ranked by effort

**(a) Hand-drawn SVG following the contract — highest fidelity, highest cost.**
Someone draws fresh paths in a vector tool, matching the ≈1.5–1.7-unit ink
weight (§2), landing the two eye-pupil paths inside the `EYE_BOX_L`/`R`
tolerance, and — for heads — respecting the jaw-ink convention (§6). This is
the only route that gets a genuinely new silhouette (an afro, cornrows,
space-buns — nothing in the existing 24 heads is close in shape). Estimate:
**2–5 hours per head**, less for a garment (**1–3 hours**) since garments
have fewer eye/skull constraints. Risk to visual consistency: **low, if the
person drawing it studies 3–4 existing parts first** — the failure mode is
someone drawing at the wrong ink weight (too thin reads as a different,
thinner-lined engine entirely) or getting the three-quarter face angle
subtly wrong on a head, which is very noticeable side-by-side with the other
23.

**(b) Derived from an existing part by transformation — cheapest, most
limited.** Take an existing head/body/bottom SVG and edit its path data:
e.g. `low-twin-buns` → `space-buns` by moving the two bun paths up and
enlarging them slightly; `wide-pants` → `joggers` by narrowing the ankle
hem and adding a cuff line; `tee` → `sports-bra` by cropping the hem
higher. This **guarantees** the ink weight, eye boxes, and jaw convention
stay correct, because they're inherited untouched. Estimate: **20–45
minutes per part** for a plausible derivation, more if the target shape is
structurally different from anything on offer (there is no existing curly
hair with a low profile to derive `buzz-cut` from — that one has no good
donor and effectively becomes route (a)). Risk: **very low** for parts with
a close donor (`space-buns`, `denim-shorts`, `joggers`, `sports-bra`,
`turtleneck` from `polo`); **not viable** for parts with no structural
relative in the current 40 (`afro`, `cornrows`, `locs`, `bikini-top`,
`suit-jacket`).

**(c) Imported from a compatible open set — fastest, and the riskiest for
consistency given §3's findings.** Since nothing checked in §3 is a genuine
drop-in, "import" really means "trace over an Open Peeps or Adventurer
silhouette as a starting shape, then redraw the ink at Humation's weight and
re-plant the eye positions" — which is really route (a) with a faster first
pass, not a true import. A literal unmodified import (paste Open Peeps' flat
fills straight in) would visibly clash: fewer interior strokes, different
face angle, and — for the CC0 sets that were checked — either no outline at
all or no separate colour fills to wire into `--hm-hair`/`--hm-clothes`.
Estimate: **1–2 hours per part** if used honestly as a tracing reference;
treat any lower estimate as a sign the output will look like a different
avatar set spliced in. Risk: **high** unless someone experienced with the
Humation line style does the redraw pass — this route saves time on
*silhouette ideation*, not on execution quality.

**Recommendation implied by the numbers, not asked for but worth stating
plainly:** route (b) first for anything with a close donor (roughly half of
both lists above), route (a) for the rest, and treat route (c) as a mood-board
input rather than a source of files.

---

## 6. The eye-cut and skull risk

Two pipeline stages depend on exact geometry in the head art, and both are
described with real numbers in §2 — this section is specifically about which
*new* hairstyles from §4 are risky against them, and why.

**Stage 1 — the eye cut (`buildAvatar()`, `src/humation.js` lines 511–560,
every avatar).** Every head must contain exactly two filled paths whose
bounding boxes land within 0.6 units of `EYE_BOX_L = [28.2, 35.1, 30.1,
37.3]` and `EYE_BOX_R = [32.7, 35.4, 34.6, 37.7]`. These get cut out and
replaced with the live, animated eyes drawn by the motion engine. **If a
hairstyle's own linework passes in front of that box** — a fringe strand, a
face-framing piece, a low-hanging curl — the baked hair path will still be
there after the cut (only the two eye paths are removed), and the live eye
will render *underneath* the hair, or visibly clipped by it, because the
live eyes are drawn as a layer positioned after the head group (§ code
comment, `src/humation.js` lines 551–556) but the hair path itself is
untouched artwork sitting in the same visual space.

**Stage 2 — the generated skull (`src/render/skull.js`, agents only, one of
ten shapes: round, squircle, hexagon, egg, pear, capsule, diamond, shield,
triangle, blob).** This replaces the face silhouette but is deliberately
built to stay *inside* the original skin bbox precisely so it can't move the
eyes (`skullPath()`, box param). The hair survives untouched because the
hair path is measurably wider than the skull path on every existing head —
confirmed directly: I checked all 24 heads for the jaw-ink convention this
stage depends on, and **21 of 24 draw both `JAW_L_BOX` and `JAW_R_BOX`
strokes; `side-swept-long` and `wavy-long` draw only the left jaw stroke, and
`curly-long` draws neither** — because on those three the hair itself covers
that part of the jaw, so there's no ink there to begin with. That's not a
bug, it's the existing precedent for what "hair covers the jaw" does to this
pipeline: it silently skips the jaw-ink removal for that side, because
there was nothing there to remove.

**Which of the 12 proposed hairstyles are risky, and why:**

- **`curtain-bangs`** — the highest risk of the twelve. By definition it
  places face-framing fringe pieces near the eye line; if drawn the way
  curtain bangs actually look (swept forward past the temple line, partially
  over the outer eye), it will sit in front of `EYE_BOX_L`/`R` and the eye
  cut won't fix that — the live eye will render correctly in its slot but
  the static bangs will visually overlap it. **Mitigation**: draw the fringe
  parted and swept *outward*, stopping at the hairline the way `short-bangs`
  and `side-swept-short` already do (both existing heads keep fringe clear
  of the eye boxes) — i.e. don't draw it as fully face-framing as the name
  implies elsewhere.
- **`wolf-cut`** and **`mullet`** — moderate risk only if the choppy
  front layers are drawn long enough to dip toward the eyeline; both are
  primarily back/crown-volume styles so the front can stay short, matching
  `messy-short`'s existing fringe height.
- **`afro`**, **`space-buns`**, **`top-knot`**, **`quiff`**, **`buzz-cut`**,
  **`pixie-cut`**, **`cornrows`**, **`locs`**, **`finger-waves`** — low risk.
  All are volume-above/behind-the-hairline styles (crown, sides, nape) with
  no natural reason to cross the eye line; they're structurally closer to
  the existing short styles (`003`–`007`) that keep clear of both eye boxes.
- **Jaw coverage** (skull-shape stage, agents only): any of the twelve drawn
  long enough to cover the jaw the way `side-swept-long`/`wavy-long`/`curly-long`
  do (i.e. `locs`, if drawn full-length and loose, or a very full `afro`)
  should follow the same precedent those three already set — draw the jaw
  ink where the hair doesn't cover it, omit it where the hair does, and
  don't force jaw strokes to exist just to "match" the other 21 heads,
  because the skull-shape stage tolerates their absence by design.

None of the proposed clothing (§4) touches either pipeline — the eye cut and
skull generation only ever look at the head layer.

---

## Summary of what to check before building anything from this

- Naming: none of the 24/8/8 existing names in §1 are reused above.
- Registration: any new head needs its two eye paths inside the boxes in §2,
  and needs adding to the manifest **and** to `dist/embedded.js` **and**
  needs `bun run bake` re-run — dropping an SVG file alone does nothing.
- Gender/age reach: a new head/bottom that should show up for
  `gender: 'male'`/`'female'` avatars needs adding to the relevant pool
  array in `src/humation.js` (§1), not just the manifest.
- Style: nothing free and unencumbered found in §3 is a drop-in; treat any
  external set as a shape reference, not a source of files.
- The `dress` / `one-piece-swimsuit` / `coat` cross-slot pairing problem
  (§4) is a design decision, not a drawing task — resolve it before anyone
  starts on those three specifically.
