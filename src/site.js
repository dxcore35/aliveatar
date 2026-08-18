// ---------------------------------------------------------------------------
// site.js — the landing page, which is one screen and one idea.
//
// Faces spawn on a ring around the middle and drift straight out past the edge.
// The ring has a hole in it and the words sit in the hole, so the copy is never
// covered and the motion never has to dodge it.
//
// Slow on purpose. The point is not motion, it is that every face arriving is a
// different person — and nobody can see that from a blur.
// ---------------------------------------------------------------------------
import './alive-avatar.js'
import { randomVariation, applyVariation } from './variation.js'
import { tap } from './sound.js'

const $ = (id) => document.getElementById(id)

// ── the install line ────────────────────────────────────────────────────────
// One behaviour: the copy glyph swaps to a tick, then swaps back. No toast.
const TICK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>`

const cmd = $('cmd')
const ico = cmd.querySelector('.ico')
const glyph = ico.innerHTML
cmd.addEventListener('click', async () => {
  const source = $('cmd-text')
  try {
    await navigator.clipboard.writeText(source.textContent)
  } catch {
    // Clipboard access can be refused. Selecting the text keeps ⌘C working.
    const range = document.createRange()
    range.selectNodeContents(source)
    getSelection().removeAllRanges()
    getSelection().addRange(range)
  }
  ico.innerHTML = TICK
  setTimeout(() => (ico.innerHTML = glyph), 1400)
})

// ── sound ───────────────────────────────────────────────────────────────────
// On. There is no switch.
//
// A browser will not start audio before a gesture, but it does not care WHICH
// gesture — so the first touch anywhere on the page arms it (see sound.js).
// The taps are quiet and they only fire when a face passes, so there is
// nothing here worth asking permission for twice.

// ── the stream ──────────────────────────────────────────────────────────────
const stage = $('stage')
const stream = $('stream')
const TILE = window.innerWidth < 620 ? 84 : 112
const DENSITY = 40
const BLANK = 0.5 // share of the short side kept empty in the middle
const TRAVEL = [8000, 12500] // ms, centre to edge — a face is readable the whole way
const YOUNG = 0.3 // a tile is "still in the crowd" for this share of its flight
const GROW = [0.45, 2.15] // scale at the ring → scale at the edge; they come at you

// A share of the crowd is mid tool call on the way out — glasses on, a bubble
// with the call in it, the outfit running hot, and the eyes performing the
// lookup. It is the thing this engine does that a still avatar cannot, so it
// belongs in the window, not only in the docs.
const TOOLS = [
  { name: 'search_calendar', args: '{ day: "tue" }', result: '3 slots' },
  { name: 'find_customer', args: '{ phone: "+421…" }', result: 'Ivana K.' },
  { name: 'create_booking', args: '{ at: "14:30" }', result: 'confirmed' },
  { name: 'send_sms', args: '{ to: "+421…" }', result: 'sent' },
  { name: 'check_stock', args: '{ sku: "A-12" }', result: '7 left' },
  { name: 'read_notes', args: '{ id: 41 }', result: '2 notes' },
  { name: 'cancel_booking', args: '{ id: 88 }', result: 'cancelled' },
  { name: 'verify_number', args: '{ n: "…" }', result: 'ok' },
]
const TOOL_SHARE = 0.45 // of the agents in flight

// The tile behind each face. Saturated on purpose: the drawing has a dark
// outline, so it holds up on any of these, and colour is what makes a crowd of
// strangers read as a crowd rather than a spreadsheet.
const PAPER = [
  '#FDE68A', '#FBCFE8', '#BFDBFE', '#BBF7D0', '#DDD6FE', '#FED7AA',
  '#A7F3D0', '#FECACA', '#C7D2FE', '#F5D0FE', '#D9F99D', '#99F6E4',
]

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const counter = $('stream-count')
let born = 0

/** How far through its flight a tile is, 0 at the ring and 1 off the edge. */
function progress(tile) {
  if (!tile.life) return 1
  return (performance.now() - tile.born) / tile.life
}

/**
 * An angle to spawn at that does not land on somebody who just spawned.
 *
 * Only the young ones matter. Two faces released at the same angle a moment
 * apart travel the same line and stay stacked the whole way out, which is the
 * collision that reads as a bug. Once they are out and grown, touching is fine
 * — a crowd overlaps, and forcing gaps out there would make the ring visible.
 */
function freeAngle(self, hole) {
  const crowd = tiles.filter((t) => t !== self && t.life && progress(t) < YOUNG)
  if (!crowd.length) return Math.random() * Math.PI * 2
  // The angle one tile covers where it spawns, plus a little air.
  const need = 2 * Math.atan((TILE * GROW[0] * 0.62) / hole)
  let best = 0
  let bestGap = -1
  for (let i = 0; i < 24; i++) {
    const candidate = Math.random() * Math.PI * 2
    let gap = Math.PI
    for (const other of crowd) {
      let d = Math.abs(candidate - other.angle) % (Math.PI * 2)
      if (d > Math.PI) d = Math.PI * 2 - d
      if (d < gap) gap = d
    }
    if (gap >= need) return candidate
    if (gap > bestGap) { bestGap = gap; best = candidate }
  }
  // Everything is busy — take the roomiest spot rather than stack on someone.
  return best
}

function launch(tile) {
  const box = stream.getBoundingClientRect()
  if (!box.width || !box.height) return

  const hole = (Math.min(box.width, box.height) / 2) * BLANK
  const angle = freeAngle(tile, hole)
  // Far enough that the tile is fully past the corner before it is recycled.
  const far = Math.hypot(box.width, box.height) / 2 + TILE * GROW[1]

  const avatar = tile.firstElementChild
  applyVariation(avatar, randomVariation({}, { pinParts: true }))
  avatar.setAttribute('no-aura', '')
  avatar.setAttribute('no-mount', '')
  avatar.setAttribute('transparent-bg', '')
  tile.style.background = pick(PAPER)

  born++
  counter.textContent = born.toLocaleString('en-US')
  tap()

  const at = (r) => [
    box.width / 2 + Math.cos(angle) * r - TILE / 2,
    box.height / 2 + Math.sin(angle) * r - TILE / 2,
  ]
  const [x0, y0] = at(hole)
  const [x1, y1] = at(far)

  const anim = tile.animate(
    [
      { opacity: 0, transform: `translate(${x0}px, ${y0}px) scale(${GROW[0]})` },
      { opacity: 1, offset: 0.14 },
      { opacity: 1, offset: 0.76 },
      { opacity: 0, transform: `translate(${x1}px, ${y1}px) scale(${GROW[1]})` },
    ],
    {
      duration: TRAVEL[0] + Math.random() * (TRAVEL[1] - TRAVEL[0]),
      // Near-linear: a face that eases out looks like it was thrown, and this
      // one is meant to drift.
      easing: 'cubic-bezier(.32,.5,.5,.86)',
      fill: 'forwards',
    },
  )
  anim.onfinish = () => launch(tile)
  tile.anim = anim
  tile.angle = angle
  tile.born = performance.now()
  tile.life = anim.effect.getTiming().duration

  // Only agents run tools — a person on the phone is not calling an API — and
  // the call starts once the face is fully in, so nobody sees it arrive busy.
  clearTimeout(tile.toolTimer)
  if (avatar.getAttribute('kind') === 'agent' && Math.random() < TOOL_SHARE) {
    const call = pick(TOOLS)
    const hold = anim.effect.getTiming().duration
    tile.toolTimer = setTimeout(() => avatar.runTool(call, hold * 0.5), hold * 0.2)
  }
}

const tiles = []
for (let i = 0; i < DENSITY; i++) {
  const tile = document.createElement('div')
  tile.className = 'tile'
  tile.appendChild(document.createElement('alive-avatar'))
  stage.appendChild(tile)
  tiles.push(tile)
}

// Spread the first launches over one crossing, otherwise the whole stream
// pulses in and out together like a heartbeat.
tiles.forEach((tile, i) => setTimeout(() => launch(tile), (i * TRAVEL[0]) / DENSITY))

// A hidden tab is work nobody can see.
document.addEventListener('visibilitychange', () => {
  for (const tile of tiles) {
    if (document.hidden) tile.anim?.pause()
    else tile.anim?.play()
  }
})
