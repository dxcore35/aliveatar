// ---------------------------------------------------------------------------
// site.js — the landing page.
//
// The lab is the workbench; this is the shop window, and the window shows one
// thing: the people. The hero has no controls at all — you move the cursor and
// they appear behind it, a fresh one every time, which demonstrates "endless
// variation" and "it is alive" in a single gesture that needs no label.
//
// Everything the engine can DO is further down the page, reached by scrolling.
// That ordering is the design: show first, explain second.
// ---------------------------------------------------------------------------
import './avatar-motion.js'
import { randomVariation, applyVariation } from './variation.js'

const $ = (id) => document.getElementById(id)

// ── copy buttons ────────────────────────────────────────────────────────────
// One behaviour for the install line and every code card: the label swaps to a
// tick, then swaps back. No toast, no dialog.
async function copyFrom(node, done) {
  const text = node.innerText.replace(/ /g, ' ')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard access can be refused. Selecting the text keeps ⌘C working.
    const range = document.createRange()
    range.selectNodeContents(node)
    getSelection().removeAllRanges()
    getSelection().addRange(range)
  }
  done()
}

const TICK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>`

function wireCopy(button, source) {
  const icon = button.querySelector('.ico') || button
  const original = icon.innerHTML
  button.addEventListener('click', () =>
    copyFrom(source, () => {
      icon.innerHTML = TICK
      setTimeout(() => (icon.innerHTML = original), 1400)
    }),
  )
}

wireCopy($('cmd'), $('cmd-text'))
for (const button of document.querySelectorAll('.card .copy')) {
  wireCopy(button, document.querySelector(button.dataset.copy))
}

// ── the hero trail ──────────────────────────────────────────────────────────
// A fixed pool, reused in order. Building an avatar costs real work, so the
// pool is rebuilt on spawn rather than created and thrown away — the DOM cost
// is paid once and the seed does the varying.
const trail = $('trail')
const hero = $('hero')
const POOL = 12
const STEP = 96 // px of pointer travel between two spawns
const LIFE = 1500 // ms a face stays before it fades

const pool = []
for (let i = 0; i < POOL; i++) {
  const el = document.createElement('avatar-motion')
  el.setAttribute('no-aura', '')
  el.setAttribute('no-mount', '')
  el.setAttribute('transparent-bg', '')
  applyVariation(el, randomVariation({}, { pinParts: true }))
  trail.appendChild(el)
  pool.push(el)
}

let next = 0
let lastX = null
let lastY = null
let z = 1

function spawn(x, y) {
  const el = pool[next % POOL]
  next++
  // A new person for every appearance — that IS the point of the hero.
  applyVariation(el, randomVariation({}, { pinParts: true }))
  el.setAttribute('no-aura', '')
  el.setAttribute('no-mount', '')
  el.setAttribute('transparent-bg', '')
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.zIndex = String(z++)
  el.animate(
    [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.55) rotate(-6deg)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%, -54%) scale(1) rotate(0deg)', offset: 0.62 },
      { opacity: 0, transform: 'translate(-50%, -62%) scale(0.86) rotate(4deg)' },
    ],
    { duration: LIFE, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
  )
}

function track(x, y) {
  const box = hero.getBoundingClientRect()
  const localX = x - box.left
  const localY = y - box.top
  if (localX < 0 || localY < 0 || localX > box.width || localY > box.height) return
  if (lastX !== null && Math.hypot(localX - lastX, localY - lastY) < STEP) return
  lastX = localX
  lastY = localY
  spawn(localX, localY)
}

hero.addEventListener('pointermove', (e) => track(e.clientX, e.clientY))
hero.addEventListener('pointerdown', (e) => {
  lastX = null
  track(e.clientX, e.clientY)
})

// Nobody has touched the page yet — on a phone, nobody will. A slow drifting
// path keeps the hero alive on its own and shows what the gesture does.
let idleTimer = 0
let t = 0
function drift() {
  const box = hero.getBoundingClientRect()
  t += 0.45
  const x = box.width * (0.5 + 0.3 * Math.sin(t * 0.6));
  const y = box.height * (0.5 + 0.22 * Math.sin(t * 0.95 + 1.1))
  spawn(x, y)
}
let heroOnScreen = true
function idle() {
  clearInterval(idleTimer)
  if (!heroOnScreen) return
  idleTimer = setInterval(drift, 700)
}

// Drifting off-screen is work nobody can see, so the hero stops as soon as it
// scrolls away and picks up again when it comes back.
new IntersectionObserver((entries) => {
  heroOnScreen = entries[0].isIntersecting
  if (heroOnScreen) idle()
  else clearInterval(idleTimer)
}).observe(hero)
function busy() {
  clearInterval(idleTimer)
  idleTimer = 0
  clearTimeout(busy.resume)
  busy.resume = setTimeout(idle, 2600)
}
hero.addEventListener('pointermove', busy)
setTimeout(idle, 900)

// ── the radial stream ──────────────────────────────────────────────────────
// Faces spawn on a ring around the middle and fly straight out past the edge,
// fading in as they leave the ring and out as they leave the frame. The ring
// has a hole in it, and the hole is where the words sit — so the copy is never
// covered and the motion never has to dodge it.
const stage = $('stage')
const stream = $('stream')
const TILE = 112
const DENSITY = 24
const BLANK = 0.45 // share of the short side kept empty in the middle

// The tile behind each face. Saturated on purpose: the drawing has a dark
// outline, so it holds up on any of these, and colour is what makes a wall of
// strangers read as a crowd rather than a spreadsheet.
const PAPER = [
  '#FDE68A', '#FBCFE8', '#BFDBFE', '#BBF7D0', '#DDD6FE', '#FED7AA',
  '#A7F3D0', '#FECACA', '#C7D2FE', '#F5D0FE', '#D9F99D', '#99F6E4',
]

let born = 0
const pick = (a) => a[Math.floor(Math.random() * a.length)]

function launch(tile) {
  const box = stream.getBoundingClientRect()
  if (!box.width || !box.height) return
  const angle = Math.random() * Math.PI * 2
  const hole = (Math.min(box.width, box.height) / 2) * BLANK
  // Far enough that the tile is fully past the corner before it is recycled.
  const far = Math.hypot(box.width, box.height) / 2 + TILE

  const avatar = tile.firstElementChild
  applyVariation(avatar, randomVariation({}, { pinParts: true }))
  avatar.setAttribute('no-aura', '')
  avatar.setAttribute('no-mount', '')
  avatar.setAttribute('transparent-bg', '')
  tile.style.background = pick(PAPER)
  born++
  $('stream-count').textContent = `${born} made so far`

  const x0 = box.width / 2 + Math.cos(angle) * hole
  const y0 = box.height / 2 + Math.sin(angle) * hole
  const x1 = box.width / 2 + Math.cos(angle) * far
  const y1 = box.height / 2 + Math.sin(angle) * far

  const anim = tile.animate(
    [
      { opacity: 0, transform: `translate(${x0 - TILE / 2}px, ${y0 - TILE / 2}px) scale(0.45)` },
      { opacity: 1, offset: 0.16 },
      { opacity: 1, offset: 0.62 },
      { opacity: 0, transform: `translate(${x1 - TILE / 2}px, ${y1 - TILE / 2}px) scale(1)` },
    ],
    { duration: 5200 + Math.random() * 3600, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' },
  )
  anim.onfinish = () => launch(tile)
  tile.anim = anim
}

const tiles = []
for (let i = 0; i < DENSITY; i++) {
  const tile = document.createElement('div')
  tile.className = 'tile'
  tile.appendChild(document.createElement('avatar-motion'))
  stage.appendChild(tile)
  tiles.push(tile)
}

// Spread the first launches over one cycle, otherwise the whole stream pulses
// in and out together like a heartbeat.
let started = false
function start() {
  if (started) return
  started = true
  tiles.forEach((tile, i) => setTimeout(() => launch(tile), (i * 5200) / DENSITY))
}

// Off-screen the stream is work nobody sees, so it holds still until it is.
new IntersectionObserver((entries) => {
  const visible = entries[0].isIntersecting
  if (visible) started ? tiles.forEach((t) => t.anim?.play()) : start()
  else tiles.forEach((t) => t.anim?.pause())
}, { rootMargin: '200px' }).observe(stream)
