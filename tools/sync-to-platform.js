// Copy the engine into AgentDesk-Unified.
//
//   bun tools/sync-to-platform.js          # copy
//   bun tools/sync-to-platform.js --check  # fail if the two have drifted
//
// WHY THIS EXISTS
//
// The platform got its copy of the engine by hand, once. Three modules were
// added here afterwards — the sphere projection, the eye acts, the generated
// skulls — and none of them reached it, so the platform silently kept running
// a months-old face while this one moved on. The symptom was "the head
// variations are not implemented"; the cause was a copy nobody re-ran.
//
// The only edit made on the way across is the Humation import: this project
// loads it from a pre-bundled vendor file so `index.html` needs no install,
// while the app has `@humation/core` and `@humation/assets-humation-1` as real
// dependencies.
const HERE = import.meta.dir.replace(/\/tools$/, '')
const DEST =
  `${HERE}/../AgentDesk-Unified/packages/ui/src/components/ui/avatar/motion`

// lab.js drives the prototype page only — the app has its own UI.
const SKIP = new Set(['lab.js'])

const VENDOR_IMPORT = /import \{ createAvatar, humation1 \} from '\.\.\/vendor\/humation\.bundle\.js'/
const APP_IMPORT =
  "import { createAvatar } from '@humation/core'\nimport { humation1 } from '@humation/assets-humation-1'"

const check = process.argv.includes('--check')

const files = [...new Bun.Glob('**/*.js').scanSync(`${HERE}/src`)].filter((f) => !SKIP.has(f))

let copied = 0
const drifted = []

for (const rel of files) {
  const source = await Bun.file(`${HERE}/src/${rel}`).text()
  const out = source.replace(VENDOR_IMPORT, APP_IMPORT)
  const target = Bun.file(`${DEST}/${rel}`)
  const existing = (await target.exists()) ? await target.text() : null
  if (existing !== out) {
    drifted.push(rel)
    if (!check) {
      await Bun.write(`${DEST}/${rel}`, out)
      copied++
    }
  }
}

if (check) {
  if (drifted.length) {
    console.error(`out of sync (${drifted.length}):\n  ${drifted.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`in sync — ${files.length} modules`)
} else {
  console.log(
    copied ? `synced ${copied} of ${files.length} modules:\n  ${drifted.join('\n  ')}` : `already in sync (${files.length})`,
  )
}
