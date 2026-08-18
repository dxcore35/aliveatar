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

// ── what the face reports ───────────────────────────────────────────────────
const BEHAVIOURS = [
  ['listening', 'on a call'],
  ['thinking', 'working it out'],
  ['searching', 'running a tool'],
  ['writing', 'taking a note'],
  ['sleeping', 'idle'],
  ['celebrate', 'booking made'],
]
BEHAVIOURS.forEach(([state, caption], i) => {
  const cell = document.createElement('div')
  cell.className = 'cell'
  const box = document.createElement('div')
  box.className = 'box'
  const el = document.createElement('avatar-motion')
  el.setAttribute('seed', `agent:duty-${i}`)
  el.setAttribute('kind', 'agent')
  el.setAttribute('state', state)
  el.setAttribute('emblem', 'icon')
  el.setAttribute('no-aura', '')
  box.appendChild(el)
  box.addEventListener('pointerenter', () => el.setAttribute('mouse-interactive', ''))
  box.addEventListener('pointerleave', () => el.removeAttribute('mouse-interactive'))
  const label = document.createElement('span')
  label.textContent = caption
  cell.append(box, label)
  $('behaviours').appendChild(cell)
})

// ── the endless wall ────────────────────────────────────────────────────────
// Grow at the bottom, drop from the top: an endless scroll must never become an
// endless DOM.
const wall = $('wall')
const BATCH = 18
const WINDOW = 180
let made = 0

const sentinel = document.createElement('div')
sentinel.style.cssText = 'grid-column:1/-1;height:1px'
wall.appendChild(sentinel)

function grow(n = BATCH) {
  const frag = document.createDocumentFragment()
  for (let i = 0; i < n; i++) {
    const box = document.createElement('div')
    box.className = 'box'
    const el = document.createElement('avatar-motion')
    applyVariation(el, randomVariation({}, { pinParts: true }))
    el.setAttribute('emblem', 'icon')
    el.setAttribute('no-aura', '')
    box.appendChild(el)
    box.addEventListener('pointerenter', () => el.setAttribute('mouse-interactive', ''))
    box.addEventListener('pointerleave', () => el.removeAttribute('mouse-interactive'))
    frag.appendChild(box)
    made++
  }
  wall.insertBefore(frag, sentinel)
  while (wall.children.length - 1 > WINDOW) wall.removeChild(wall.firstElementChild)
  $('wall-count').textContent = `${made} made so far · keep scrolling`
}

new IntersectionObserver(
  (entries) => { if (entries.some((e) => e.isIntersecting)) grow() },
  { rootMargin: '700px' },
).observe(sentinel)

// The observer needs a laid-out viewport to fire against, and there are real
// cases where it never gets one — an embedded frame with no height, a tab that
// was hidden for the whole scroll. A rect read per scroll covers those.
let growing = false
function maybeGrow() {
  if (growing) return
  const r = sentinel.getBoundingClientRect()
  if (r.top - (window.innerHeight || 0) > 700) return
  growing = true
  grow()
  growing = false
}
addEventListener('scroll', maybeGrow, { passive: true })
addEventListener('resize', maybeGrow)

grow()
