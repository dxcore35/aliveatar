# Names research — what could replace or extend `src/names.js`

Research only. Nothing in `src/` was touched.

`src/names.js` is 81 lines, zero dependencies, and produces two things
deterministically from a seed: an agent name (48 words × 10 tags ≈ 480
combinations) and a person name (64 first names × 22 initials ≈ 1,408
combinations). The brief was to find open-source name generators or word-list
corpora that could give far more variety without breaking the two things that
make the current engine work: zero runtime dependencies, and "same seed, same
name, forever" with nothing stored.

Fourteen candidates were evaluated. Every licence claim below was checked
against a primary source — the npm registry's own metadata (`license`
field, `dependencies`, `dist.unpackedSize`, fetched from
`registry.npmjs.org` directly), or GitHub's own licence detection API
(`gh api repos/<owner>/<repo> --jq .license`), or a package's `LICENSE` file
read directly from its repository. The source used is named in every row.

**Recommendation, one line:** keep `src/names.js` — vendor `unique-names-generator`'s three MIT, zero-dependency, seedable word-list files (`adjectives.ts`, `animals.ts`, `names.ts`, ~78 KB combined) as flat JSON for the agent and people lists, and use the Docker/Moby `namesgenerator` word pair (Apache-2.0, 108×245 = 26,460 combinations, ~5 KB once stripped to data) as a second free flavour for agents — both keep the file hand-rolled and dependency-free, they just feed it bigger lists.

---

## Candidates evaluated

### 1. `unique-names-generator` — MIT — the strongest candidate

- **Licence:** MIT. Verified in the npm registry's own `license` field (v4.7.1) and in the embedded `licenseText` field, which reads "MIT License, Copyright (c) 2018-2022 AndreaSonny". Also stated on the npm package page and the GitHub repo's licence badge.
- **Repo:** https://github.com/andreasonny83/unique-names-generator
- **Size:** `dist.unpackedSize` from the registry is 850,278 bytes (≈ 830 KB) for the *whole* published package — but it is deliberately tree-shakeable, and the dictionaries are separate files you import individually. Checked each dictionary file's exact byte size via the GitHub contents API: `names.ts` (≈4,900 real first names) is 59,826 bytes, `adjectives.ts` (≈1,400 adjectives) is 15,983 bytes, `animals.ts` (≈350 animals) is 4,415 bytes, `colors.ts` is 633 bytes, `countries.ts` (≈250) is 3,977 bytes, `star-wars.ts` (≈80) is 1,376 bytes. The three useful ones for this project — adjectives + animals + names — total **≈ 78 KB**, well inside the "small" bar.
- **Dependencies:** 0 (confirmed: `"dependencies": {}` in the registry metadata, and npm's own package page states "0 Dependencies").
- **Seedable:** yes, natively, and it is the only candidate here with a first-class seed parameter built for this exact purpose. Its `Config` object takes `seed: number | string`; same seed, same name, every time, on every device — the README states this explicitly and shows the example.
- **Distinct names:** the `names.ts` dictionary alone gives ≈4,900 first names. Combined with `adjectives.ts` × `animals.ts` (1,400 × 350 ≈ 490,000 two-word combinations) it comfortably clears the "far more variety" bar for agents.
- **Reads well?** Mostly yes, with one caveat. `names.ts` looked at directly (`Aaren`, `Abagael`, `Ada`, `Adelaide`, …) is a real, mostly Anglo-American first-name list — no Slovak/Central European names in it, so it *extends* rather than *replaces* the project's Slovak-weighted people list. `adjectives.ts` + `animals.ts` reads closer to "Determined Wozniak" than "Waffle" — competent-sounding, not silly — the pairing style (`focused_donkey`) is workmanlike rather than warm; the project would want to filter the adjective list down to the playful subset (drop `heuristic`, `pedantic`, `condescending`, keep `goofy`, `bubbly`, `wobbly`-style entries) rather than use it wholesale.

### 2. Docker / Moby `namesgenerator` word list — Apache-2.0 — good second flavour

- **Licence:** Apache-2.0. Verified via `gh api repos/moby/moby --jq '.license.spdx_id'` → `Apache-2.0`, and by reading the LICENSE file at the repo root (Apache License, Version 2.0, fetched and confirmed to start with the standard Apache preamble).
- **Not an npm package** — it is a single Go source file: `internal/namesgenerator/names-generator.go` (path confirmed via GitHub code search; it moved out of the old `pkg/namesgenerator` location some time ago). This is the exact word list Docker prints for every unnamed container (`affectionate_curie`, `focused_turing`).
- **Size:** the Go file itself is 50,919 bytes, but that is mostly Go boilerplate. Counted the two arrays directly: `left` (adjectives) has **108** entries, `right` (surnames) has **245** entries. Stripped to plain JSON arrays, the actual word data is roughly 4–5 KB total.
- **Dependencies:** none — it is a flat pair of string arrays, trivially portable to a JSON word list.
- **Seedable:** not as shipped (Go's own `math/rand/v2`, unseeded in the library itself) — but because it is just two arrays, seeding is exactly the hash-and-index trick `names.js` already does. No adaptation needed beyond copying the words.
- **Distinct names:** 108 × 245 = 26,460 two-word combinations.
- **Reads well?** The right-hand list is a deliberate, opinionated tribute list of real scientists, engineers and hackers — `lovelace`, `turing`, `hopper`, `curie`, `einstein`, `wozniak` — the file's own header comment calls it "frozen" and says openly that new additions caused too much internal conflict to keep accepting them. This is the "Determined Wozniak" register exactly: competent and admiring, not silly. It would suit a *serious* or *technical* agent persona better than the project's stated "Waffle" register, but the adjective half (`left`) overlaps usefully with warmer words (`jolly`, `nifty`, `silly`, `sweet`, `goofy`) that could be pulled out and remixed against the existing `AGENT_NAMES` list instead of used with the surnames.

### 3. `@faker-js/faker` — MIT — capable but heavy, and it disagrees with your seed rule

- **Licence:** MIT. Verified in the registry metadata for v10.6.0 and on the maintained repo, https://github.com/faker-js/faker (the actively maintained fork after the 2022 `faker`/`Marak` incident — see candidate 4).
- **Size:** `dist.unpackedSize` 2,898,437 bytes (≈ 2.9 MB), 315 files, across 70+ locale packs (only the locales actually imported get bundled, but the base install is still multiple megabytes).
- **Dependencies:** 0 runtime dependencies (confirmed empty `dependencies` in the registry). Its `engines` field requires modern Node (`^20.19 || ^22.13 || ^23.5 || >=24`) for *development*, but the shipped `dist/index.js` is plain ESM with no Node-only APIs, so it does run in a browser bundle.
- **Seedable:** yes, via `faker.seed(n)` — but it is a *global, mutable* seed on a shared module-level RNG, not a per-call parameter. Every call after `.seed()` advances shared state, so getting the same name back for the same avatar id means re-seeding before every single lookup and being careful nothing else in the app also calls a `faker.*` method in between — a much easier way to introduce a subtle non-determinism bug than `unique-names-generator`'s explicit `seed:` option per call.
- **Distinct names:** `faker.person.firstName()` alone draws from real name lists across 70+ locales — tens of thousands of names — and `faker.person.fullName()` composes first + last for far more. This is easily the largest name space of any candidate.
- **Reads well?** The person names are genuinely real names across many cultures (`faker.person.firstName('sk')` gives real Slovak names), which is exactly the register this project wants for people. But there is no "warm and silly agent name" mode — Faker has no equivalent of `unique-names-generator`'s playful-adjective-plus-animal dictionaries built for that tone; you would be building the agent-name curation yourself either way, at 30× the install size of the alternative.

### 4. `faker` (the original, unscoped package) — do not use, at any version

- **Licence:** MIT, per its own `package.json` — but this package cannot be safely recommended regardless of licence. Verified: the npm registry's `latest` tag for the bare `faker` package currently resolves to **v6.6.6**, `dist.unpackedSize` **3,816 bytes**. That is not a typo — the real Faker.js codebase is megabytes; a 3.8 KB package published under the name "faker" is the well-known January 2022 incident where the original maintainer, in protest, gutted the package and published a broken/corrupted release under the `faker` name before the community forked it as `@faker-js/faker` (candidate 3). Installing `faker` today installs that broken protest release.
- **Recommendation:** never install the bare `faker` package. If Faker-style data is wanted, `@faker-js/faker` is the only safe name.

### 5. `chance.js` — MIT — capable, mid-sized, awkward for this use case

- **Licence:** MIT. Verified in the registry metadata for v1.1.13 and on https://github.com/chancejs/chancejs.
- **Size:** `dist.unpackedSize` 2,134,394 bytes (≈ 2.1 MB) across 164 files — but that figure includes the full documentation site (`docpress`) bundled into the published tarball. The actual library is a single file, `chance.js`; unminified it is in the 200–250 KB range, which is still ten times the current `names.js`.
- **Dependencies:** 0 runtime dependencies.
- **Seedable:** yes — `new Chance(seed)` builds a Mersenne-Twister-seeded instance, and the same seed always drives the same sequence of `.first()` / `.last()` / `.name()` calls in the same order. That "in the same order" is the catch: Chance is a stream of pseudo-random draws from one seeded generator, not a pure `hash(seed) → name` function, so a single avatar needing just a name (not a whole sequence of random draws) is a slightly awkward fit compared to `unique-names-generator`'s one-shot `seed` option.
- **Distinct names:** `.first({ gender })` draws from Chance's built-in first-name list (a few hundred entries per gender, English-only) plus `.last()` surnames — a smaller name space than `unique-names-generator`'s `names.ts` and with no non-English names at all.
- **Reads well?** Chance's names are plain, real, unremarkable English names — fine for people, no Slovak coverage, and no equivalent at all of a "silly agent name" mode; Chance is a general-purpose random-data library (dice, credit card numbers, IP addresses), not a naming-flavoured one.

### 6. `docker-names` (npm, by bearjaws) — ISC — small JS port of the Moby list

- **Licence:** ISC (an OSI-approved, MIT-equivalent permissive licence — allowed by the brief). Verified in the registry metadata for v1.2.1.
- **Repo:** https://github.com/bearjaws/docker-names
- **Size:** `dist.unpackedSize` 71,447 bytes (≈ 70 KB), 6 files.
- **Dependencies:** 0.
- **Seedable:** not as shipped (`Math.random()` internally, no seed parameter) — would need the same seed-and-index rewrite as any raw word list.
- **Distinct names:** a smaller, hand-copied subset of the Moby list — worth going to the real Moby source (candidate 2) instead, which is actively "frozen" (stable) and larger.
- **Reads well?** Same register as candidate 2 (`admiring_turing` style) — competent, not silly.

### 7. `friendly-words` (Glitch) — MIT — good, but do not `npm install` it

- **Licence:** MIT. Verified two ways: the registry metadata's `license` field, and GitHub's own licence-detection API (`gh api repos/glitchdotcom/friendly-words/license` → `MIT`). Glitch (the "friendly" project-naming site behind names like `fuzzy-pancake`) maintains it.
- **Repo:** https://github.com/glitchdotcom/friendly-words
- **Size:** the registry's `dist.unpackedSize` for the *whole npm package* is 207,438 bytes, but the actual data file — `generated/words.json`, confirmed via the GitHub contents API — is **45,572 bytes (≈ 44.5 KB)** on its own. The rest of the package is a demo Express server and build scripts you would never ship.
- **Dependencies — the catch:** the published `package.json` lists `ava`, `express` and `lodash.samplesize` as **runtime** `dependencies`, not `devDependencies` — almost certainly a packaging mistake by the maintainers (a word-list library has no reason to need an HTTP framework at runtime), but it is what `npm install friendly-words` will actually pull in: three packages including a full web server. **Do not `npm install` this one; vendor `generated/words.json` directly instead**, which has zero dependencies of its own.
- **Seedable:** not shipped with a seed — it is plain JSON, so the project's own `pick()`/`hash()` approach applies directly.
- **Distinct names:** the word list is split into `predicates` (adjectives), `objects` (nouns), `teams`, `collections` — a two- or three-word combinatorial space in the tens of thousands.
- **Reads well?** Yes — this is the best-matching *tone* of any candidate here. Glitch's own stated design goal for the list is "friendly, positive, inspiring, whimsical, memorable" and safe for children — which is much closer to "Waffle" than any other candidate's word list. Worth a close look even though its raw combinatorial size is smaller than `unique-names-generator`'s.

### 8. `starwars-names` (kentcdodds) — MIT, but weak fit

- **Licence:** MIT, confirmed in the registry metadata.
- **Repo:** https://github.com/kentcdodds/starwars-names
- **Size:** small (no `unpackedSize` reported by the registry for this old a package; the source file is a short hand-written list).
- **Dependencies:** 1 (`unique-random-array`) — fails the zero-dependency preference.
- **Seedable:** no — it wraps `Math.random()` via its one dependency, with no seed hook exposed.
- **Distinct names:** roughly 80 canonical Star Wars character names — tiny, and last touched in 2016 (built as an npm-publishing tutorial, not maintained since).
- **Reads well?** Only for a Star Wars-themed product; off-brand for this one, and too small to move the needle regardless.

### 9. `project-name-generator` (aceakash) — ISC, but deprecated

- **Licence:** ISC, confirmed in the registry metadata.
- **Repo:** https://github.com/aceakash/project-name-generator
- **Size:** `dist.unpackedSize` 38,547 bytes (≈ 38 KB).
- **Dependencies:** 2 (`lodash`, `commander` — the latter is a CLI argument parser, entirely dead weight for a browser use case).
- **Seedable:** no seed parameter; `Math.random()` internally.
- **Note:** the npm registry itself marks this package `"deprecated": "Package no longer supported. Contact Support…"` — an explicit signal from the author, not an inference.
- **Reads well?** Heroku-style two-word names (`resonant-silence`) — abstract-adjective + abstract-noun, closer to the "Nexus/Synergy" register the project's own `names.js` comment explicitly says to avoid than to "Waffle".

### 10. `human-readable-ids` (coolaj86) — Apache-2.0, abandoned, wrong shape

- **Licence:** stated in the registry as `"Apache2"` — non-standard SPDX spelling but unambiguously Apache License 2.0, which is on the allowed list.
- **Repo:** https://git.coolaj86.com/coolaj86/human-readable-ids.js (mirrored on GitHub at MattAlan-io and others, not the canonical source)
- **Size:** `dist.unpackedSize` 23,002 bytes (≈ 22 KB) — the smallest candidate by far.
- **Dependencies:** 1 (`knuth-shuffle`).
- **Seedable:** designed for *uniqueness*, not *reproducibility* — its whole purpose is "generate an id nobody else has right now", which is close to the opposite of "same seed, same name forever". Would need real rework, not just a wrapper.
- **Distinct names:** small noun/adjective lists, last published 2018 and inactive since.
- **Reads well?** Plain, workmanlike nouns and adjectives (`brave-lion`-style) — not bad, just small and unmaintained.

### 11. `haikunator` (Atrox, TypeScript rewrite) — BSD-3-Clause, functional but not zero-dep

- **Licence:** BSD-3-Clause. Verified in the registry metadata's `license` field and the embedded `licenseText` for v2.1.2 ("Copyright (c) 2019, Atrox… Redistribution and use… BSD-3-Clause text"). This is the actively maintained rewrite; the older `usmanbashir/haikunator` fork found via search is a JS-only, less-maintained predecessor of the same idea.
- **Repo:** https://github.com/Atrox/haikunatorjs
- **Size:** `dist.unpackedSize` 54,187 bytes (≈ 53 KB), and it ships proper browser/ESM builds (`module`, `browser`, `esnext` fields all present) — genuinely usable in a browser bundle, unlike several other candidates here.
- **Dependencies:** 3 (`random-seed`, `lodash.defaults`, `@types/random-seed`) — fails the "zero runtime dependencies" preference, though modestly.
- **Seedable:** yes, natively — `haikunate({ seed })` deterministically reproduces the same "quiet-water-1142"-style name, which is exactly the mechanism this project wants.
- **Distinct names:** a modest adjective+noun+number combinatorial space, in the low thousands.
- **Reads well?** Genuinely close to the "Waffle" register — Heroku's own naming style (`rough-snowflake-1142`) reads warm and a little silly. The dependency count is the only real strike against it.

### 12. US Social Security Administration baby-name data — public domain (facts, not a curated creative list)

- **Nature of the source:** the SSA publishes, directly at ssa.gov, the exact count of American babies given each first name each year since 1880. As a work of the US federal government, this data carries **no copyright at all** under 17 U.S.C. § 105 — it is public domain by law, not by a licence grant, and stronger than any of the permissive licences above (nothing to attribute, nothing that could ever be revoked).
- **Caveat found during this research:** third-party repos that repackage this data can and do apply their *own* licence to their wrapper code, which is a different thing from the underlying data. Checked two: `hackerb9/ssa-baby-names` (`gh api repos/hackerb9/ssa-baby-names --jq .license.spdx_id` → `LGPL-2.1`, which is **not** on this project's allowed list) and `jonroig/usBabyNames.js` (same check → `MIT`, allowed). Neither result changes the status of the raw SSA numbers themselves — but it means going to a third-party repo for convenience risks accidentally taking on a licence for the wrapper scripts around data that never needed one. **The safe path is to pull the year files directly from ssa.gov and write a five-line extraction script yourself**, not to vendor someone else's repackaging.
- **Size:** the SSA's full national file (`names.zip` at ssa.gov, all years, all names given to ≥5 babies) is several megabytes — too big to vendor whole per the brief's "not a 5 MB corpus" rule. A single recent year's file is roughly 500 KB of `name,sex,count` rows; trimmed to (say) the top 1,000 most common names per sex from the most recent year, it is tens of kilobytes — comfortably small.
- **Distinct names:** effectively unlimited headroom — the full historical corpus holds around 100,000 distinct first names across 140+ years; even a "top 2,000" cut supplies far more variety than the current 64-entry list.
- **Reads well?** These are real, common, unremarkable American first names — exactly the register `FEMALE`/`MALE` already aims for, but skewed entirely English/American with zero Slovak or other-culture coverage, so it is a *supplement* to the existing lists, not a wholesale replacement — the project would still need to hand-curate a Slovak-name block the way `names.js` already does.

### 13. Behind the Name — excluded, licence fails the hard constraint

- **What it is:** a well-known given-names etymology and meaning database with an API.
- **Licence:** the portion of Behind the Name's data available for reuse is offered under **Creative Commons Attribution-ShareAlike 4.0** (confirmed via their own Data Access page). CC-BY-SA is explicitly excluded by the brief's hard constraints (share-alike). **Not usable, full stop**, regardless of how good the data is.
- **Fact vs curation:** this is the clearest example in the whole survey of the fact/curation distinction the brief asked about — the *names themselves* (e.g. "Aiden means little fire") are facts nobody can own, but Behind the Name's *specific write-ups, meanings and structured entries* are original curated content, and that curation is what the CC-BY-SA licence actually protects. You could not legally take their database wholesale; you could independently look up a name's etymology from a different, uncontaminated source and write your own one-line meaning.

### 14. Wiktionary-derived word lists — excluded, licence fails the hard constraint

- **What it is:** community-edited dictionary data, sometimes packaged into word-list generators for exactly this kind of project.
- **Licence:** all Wiktionary text (and therefore anything extracted from it, including word lists) is CC-BY-SA (dual-licensed with GFDL) — share-alike, excluded by the brief's hard constraints for the same reason as Behind the Name.
- **Fact vs curation:** individual dictionary words are not copyrightable, but a *specific extracted list* — which words were picked, in what form, with what filtering — is Wiktionary's own curated compilation, and that is the CC-BY-SA-covered part. A hand-built word list of ordinary English words (which is what `AGENT_NAMES` already is) sidesteps this entirely, because plain common words picked by a person and typed into a JS array carry no one else's copyright to begin with.

---

## Facts versus curated creative lists — the distinction the brief asked about

Two clearly different kinds of "licence risk" showed up across these fourteen candidates, and they should not be treated the same:

- **Lists of facts** — real historical head counts (SSA baby names), real people's real surnames used as a naming tribute (Moby's `right` list, itself built from real historical figures), real country names, real language names. Facts and names of real things cannot be copyrighted. The SSA data is public domain outright; the Moby list is Apache-2.0 because Docker/Moby chose to licence *their specific selection and code*, not because the underlying surnames needed a licence.
- **Curated creative lists** — Behind the Name's write-ups, Wiktionary's extracted word sets, `unique-names-generator`'s and `friendly-words`' specific choice-and-ordering of adjectives. These carry a compilation/creative-expression copyright even though no single word in them is original — which is exactly why some of these (MIT-licensed ones) are fine to vendor and others (CC-BY-SA ones) are not, despite both being "just word lists" at a glance.

---

## Recommendation

**Keep `src/names.js`'s hand-rolled shape.** It is 81 lines, has zero dependencies, and the `hash → pick` mechanism it already uses is exactly what every seedable candidate above ends up doing internally anyway. Nothing evaluated here is worth taking on as a runtime dependency — the two best candidates (`unique-names-generator`, `friendly-words`) are both better used as **vendored word-list data**, not as installed packages, because:

- `unique-names-generator` is 0 dependencies and genuinely excellent, but importing it as a package pulls in code for features this project will never call (the `NumberDictionary` helper, style-casing, custom-dictionary merging) — the actual payload wanted is three flat arrays.
- `friendly-words`'s own `package.json` would pull in Express as a "dependency" if installed normally, which is a straightforward packaging bug on their end, but it means the only safe way to use it is to skip `npm install` and copy `generated/words.json` directly.

### Concrete plan

1. **Vendor three files, not a package**, next to `src/names.js`:
   - Adjectives: `adjectives.ts` from `unique-names-generator` (15,983 bytes, ≈1,400 words, MIT) — filtered down by hand to the playful subset (drop the clinical-sounding ones like `condescending`, `heuristic`, `pedantic`; this project's existing `AGENT_NAMES` comment already explains why abstract/dry words are rejected).
   - Nouns: `animals.ts` from the same package (4,415 bytes, ≈350 words, MIT) to pair with the adjectives, giving a two-word agent-name space in the hundreds of thousands.
   - People: `names.ts` from the same package (59,826 bytes, ≈4,900 real first names, MIT) merged into the existing `FEMALE`/`MALE` arrays as an "everyone else" pool alongside the hand-picked Slovak-weighted core — the Slovak names stay hand-curated because no candidate here supplies them.
   - Total added payload: **≈80 KB** of plain word-list data, zero new runtime dependencies, same `hash(seed) >>> shift % list.length` mechanism already in `names.js`.
2. **Add a NOTICE.md entry**, matching this project's existing attribution style (see the "Humation — MIT" and "bloub — MIT" sections already in `NOTICE.md`):
   ```
   ## unique-names-generator word lists — MIT

   Copyright (c) 2018-2022 AndreaSonny <andreasonny83@gmail.com>

   The adjectives, animals and first-name word lists in `src/names.js` are
   taken from the `adjectives`, `animals` and `names` dictionaries of
   unique-names-generator, used under the MIT licence. Only the plain word
   lists are used; none of the package's code is imported.

   Upstream: https://github.com/andreasonny83/unique-names-generator
   ```
3. **Optionally, a second flavour for agents**: extract the Moby/Docker `left`/`right` arrays (Apache-2.0, ≈5 KB once stripped of Go syntax) as a togglable "technical" agent-name style alongside the "silly" one, with its own NOTICE.md entry crediting moby/moby.

### If the goal is specifically "reach one million distinct names" with the hand-rolled approach alone

The current formula is `len(AGENT_NAMES) × len(AGENT_TAGS)` for agents and `(len(FEMALE)+len(MALE)) × len(INITIALS)` for people. To clear one million on each side while keeping the same two-slot shape:

- **Agents:** `AGENT_NAMES` would need to grow from 48 to roughly **500 words** paired with the existing 10 tags (500 × 10 = 5,000 — still short), or, more realistically, add a **third pick slot** (the `hash` already has spare bits: it currently only consumes shifts 0, 5 and 7 out of a 32-bit hash, so a third `pick(SOMETHING, 13)` costs nothing new). 100 adjectives × 100 nouns × 100 tags = 1,000,000 exactly, and all three lists are small enough to hand-curate in an afternoon using the filtered `unique-names-generator` adjective/animal lists as a starting point (they already supply 1,400 and 350 candidates respectively — pruning down to 100 "warm and silly" ones from each is editing, not writing from scratch).
- **People:** the current two-slot shape (first name × initial) already scales enormously with a bigger first-name list — 4,900 names (from `unique-names-generator`'s `names.ts`, MIT) × 22 initials ≈ 108,000. Reaching a million from there just needs the initials list widened from single letters to two-letter clusters (22 × 22 ≈ 484 combinations instead of 22), giving 4,900 × 484 ≈ 2.4 million — no new word list needed, just widening the existing `INITIALS` mechanism to two characters. Where the extra first names come from: the SSA public-domain data (candidate 12) is the deepest well available — a "top 2,000 per sex, most recent year" extraction comfortably clears what's needed while staying tens of kilobytes, and carries no licence at all to track.

---

## Sources consulted

- npm registry metadata (`registry.npmjs.org/<package>/latest`) for: `unique-names-generator`, `@faker-js/faker`, `faker`, `chance`, `docker-names`, `starwars-names`, `friendly-words`, `human-readable-ids`, `haikunator`, `project-name-generator` — fetched directly, license/dependencies/unpackedSize read from the raw registry JSON.
- GitHub repository/licence/contents APIs (`gh api repos/<owner>/<repo>`, `.../license`, `.../contents/<path>`) for: `moby/moby`, `glitchdotcom/friendly-words`, `andreasonny83/unique-names-generator`, `hackerb9/ssa-baby-names`, `jonroig/usBabyNames.js`, `hadley/babynames`.
- Direct read of `moby/moby`'s `internal/namesgenerator/names-generator.go` source (word-count verified programmatically).
- Behind the Name's own Data Access page (behindthename.com/api) for its CC-BY-SA terms.
- Existing project files read for context: `src/names.js`, `NOTICE.md`.
