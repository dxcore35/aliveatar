// Bakes the vendored Humation packages into ONE browser ESM file so index.html
// needs no install step and no bundler at runtime.
//
//   bun tools/bake-humation.js   →   vendor/humation.bundle.js
//
// Re-run this only if vendor/@humation is replaced.
// import.meta.dir is already a decoded filesystem path (the project folder name
// contains a space, so a URL pathname would arrive percent-encoded and fail to
// resolve).
const root = `${import.meta.dir.replace(/\/tools$/, '')}/`

const entry = `${root}vendor/entry.js`
await Bun.write(
  entry,
  `export { createAvatar } from './@humation/core/dist/index.js'\n` +
    `export { humation1 } from './@humation/assets-humation-1/dist/index.js'\n`,
)

const out = await Bun.build({
  entrypoints: [entry],
  target: 'browser',
  format: 'esm',
  minify: false,
})

if (!out.success) {
  console.error(out.logs)
  process.exit(1)
}

const code = await out.outputs[0].text()
await Bun.write(`${root}vendor/humation.bundle.js`, code)
console.log(`vendor/humation.bundle.js — ${(code.length / 1024).toFixed(0)} KB`)
