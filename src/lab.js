// Wiring for the draft page. No framework — the point of the draft is that the
// merged avatar is a plain custom element you can drop anywhere.
import './avatar-motion.js'
import { buildAvatar, PARTS } from './humation.js'
import { EXPRESSION_NAMES, RINGS, BLOUB_FIRST } from './expressions.js'
import { EYE_ACTS, ACT_BY_ID } from './motion/eyeacts.js'
import { SKULL_NAMES, SKULL_SHAPES } from './render/skull.js'
import { POOLS, BLINK, EXPR_CADENCE, MOTION, STATE_GROUPS, STATE_NOTES, TOOL_SCRIPTS } from './states.js'
import { STATES } from './states.js'
import { activeCount, totalCount } from './core/ticker.js'
import { iconSvg } from './render/icons.js'
import { emblemFor } from './render/emblem.js'
import { randomVariation, applyVariation, SPACE } from './variation.js'

const $ = (id) => document.getElementById(id)
const SLOTS = ['head', 'body', 'bottom', 'item', 'glasses']

// ── The two stage avatars ───────────────────────────────────────────────────
// Two avatars, same seed, same state, one per theme — driven as a pair so a
// bug that only shows in one theme cannot hide.
const live = document.createElement('avatar-motion')
live.style.cssText = 'width:100%;height:100%'
live.setAttribute('theme', 'dark')
$('box-live').appendChild(live)

const lightTwin = document.createElement('avatar-motion')
lightTwin.style.cssText = 'width:100%;height:100%'
lightTwin.setAttribute('theme', 'light')
// Both panels get the aura. It behaves differently against a light page than a
// dark one, which is exactly the thing this comparison exists to show.
$('box-light').appendChild(lightTwin)

/** Mirror an attribute onto the light twin. */
function mirror(name, value) {
  if (value === null || value === undefined) lightTwin.removeAttribute(name)
  else lightTwin.setAttribute(name, value)
}

/** Copy whoever the dark avatar currently is onto the twin. */
function syncTwin() {
  for (const a of ['seed', 'kind', 'color', 'gender', 'state', 'emblem']) {
    mirror(a, live.getAttribute(a))
  }
}

/** Run the same call on both avatars, so the comparison stays honest. */
function both(fn) {
  fn(live)
  fn(lightTwin)
}

function currentConfig() {
  const cfg = {
    seed: $('seed').value.trim() || 'avatar',
    kind: $('kind').value,
    color: $('color').value,
    gender: $('gender').value || undefined,
    age: $('age').value ? Number($('age').value) : undefined,
    skull: $('part-skull')?.value || '',
    selections: {},
  }
  for (const slot of SLOTS) {
    const v = $(`part-${slot}`)?.value
    if (v) cfg.selections[slot] = v
  }
  return cfg
}

// ── The accent is the avatar ────────────────────────────────────────────────
// Every "this one is on" highlight in the lab takes its colour from whoever is
// on the stage. It costs three custom properties and it makes the panel read as
// part of the same object as the face above it, rather than a control surface
// bolted to the side of one.
function paintAccent(colour) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16))
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  // A fill needs ink that survives on it; a border or a label needs a colour
  // that survives on the PAGE. They are rarely the same colour.
  const mix = (t, target) => {
    const to = target === 'white' ? 255 : 0
    return '#' + [r, g, b].map((c) => Math.round(c + (to - c) * t).toString(16).padStart(2, '0')).join('')
  }
  const ink = dark
    ? (lum < 0.45 ? mix(0.42, 'white') : colour)
    : (lum > 0.62 ? mix(0.34, 'black') : colour)
  const root = document.documentElement.style
  root.setProperty('--accent', colour)
  root.setProperty('--on-accent', lum > 0.58 ? '#101010' : '#ffffff')
  root.setProperty('--accent-ink', ink)
}

function rebuild() {
  const cfg = currentConfig()
  live.setAttribute('emblem', $('emblem').value)
  if ($('look').checked) live.removeAttribute('flat')
  else live.setAttribute('flat', '')
  if ($('aura').checked) live.removeAttribute('no-aura')
  else live.setAttribute('no-aura', '')
  live.setAttribute('seed', cfg.seed)
  live.setAttribute('kind', cfg.kind)
  live.setAttribute('color', cfg.color)
  if (cfg.gender) live.setAttribute('gender', cfg.gender)
  else live.removeAttribute('gender')
  if (cfg.age) live.setAttribute('age', String(cfg.age))
  else live.removeAttribute('age')
  if (cfg.skull) live.setAttribute('skull', cfg.skull)
  else live.removeAttribute('skull')
  for (const slot of SLOTS) {
    if (cfg.selections[slot]) live.setAttribute(slot, cfg.selections[slot])
    else live.removeAttribute(slot)
  }

  // Mirror everything onto the light twin except the theme itself.
  mirror('emblem', $('emblem').value)
  mirror('flat', $('look').checked ? null : '')
  mirror('seed', cfg.seed)
  mirror('kind', cfg.kind)
  mirror('color', cfg.color)
  mirror('gender', cfg.gender ?? null)
  mirror('age', cfg.age ? String(cfg.age) : null)
  mirror('skull', cfg.skull || null)
  for (const slot of SLOTS) mirror(slot, cfg.selections[slot] ?? null)

  // The component rebuilds itself on those attribute changes; re-apply the
  // sliders afterwards so the fresh engine starts where the UI says it is.
  applyControls()

  const built = buildAvatar(cfg)
  // An agent's signature colour IS its skin; a person has none, so the hair is
  // the one colour that is theirs and not everybody's.
  paintAccent(cfg.kind === 'agent' ? cfg.color : built.colors.hair)
  $('r-cut').textContent = String(built.strippedEyes)
  const sk = SKULL_SHAPES[built.skull]
  $('skull-note').textContent =
    cfg.kind === 'customer'
      ? 'People always keep the head the illustrator drew. Only agents get a generated one.'
      : built.skull === 'round'
        ? 'Round — the drawn head, unchanged.'
        : `${sk?.label || built.skull} — ${sk?.note || ''} The hair is untouched; it is the face inside it that changes.`
  $('kind-note').textContent =
    cfg.kind === 'customer'
      ? 'A person: the eyes stay stuck on the face and only slide a little. No spinning, no tool bubbles, natural eye size.'
      : 'An AI: taller drawn eyes, the full head rotation, and tool calls that put glasses on and run the outfit colour.'
  $('turn').min = cfg.kind === 'customer' ? '-14' : '-110'
  $('turn').max = cfg.kind === 'customer' ? '14' : '110'
  $('gaze-note').textContent =
    `Gaze range on this face: ±${built.face.gazeXMax.toFixed(2)} horizontally, ` +
    `±${built.face.gazeYMax.toFixed(2)} vertically — kept as the gist's ratio of eye separation (${built.face.separation.toFixed(2)}).`
  const frontDeg = (-(built.face.slots[0].baseLongitude + built.face.slots[1].baseLongitude) / 2 * 180) / Math.PI
  $('front-angle').textContent = `${frontDeg > 0 ? '+' : ''}${frontDeg.toFixed(0)}°`
}

// ── Controls ────────────────────────────────────────────────────────────────
function applyControls() {
  both((av) => {
    const e = av.engine
    if (!e) return
    e.stiffness = Number($('spring').value)
    e.manualGaze = { x: Number($('gx').value), y: Number($('gy').value) }
    // The demo drives the turn itself; do not overwrite it from the slider.
    if (!live.hasAttribute('demo')) e.manualTurn = (Number($('turn').value) * Math.PI) / 180
    e.eyeScale = Number($('scale').value)
    e.emphasis = $('emphasis').checked
    e.autoBlink = $('auto-blink').checked
    e.autoExpression = $('auto-expr').checked
    e.autoMotion = $('auto-motion').checked
  })
  if ($('mouse').checked) both((a) => a.setAttribute('mouse-interactive', ''))
  else both((a) => a.removeAttribute('mouse-interactive'))

  $('o-spring').textContent = Number($('spring').value).toFixed(1)
  $('o-gx').textContent = Number($('gx').value).toFixed(2)
  $('o-gy').textContent = Number($('gy').value).toFixed(2)
  $('o-turn').textContent = `${$('turn').value}°`
  $('o-scale').textContent = `${Number($('scale').value).toFixed(2)}×`
}

for (const id of ['spring', 'gx', 'gy', 'turn', 'scale', 'emphasis', 'auto-blink', 'auto-expr', 'auto-motion', 'mouse']) {
  $(id).addEventListener('input', applyControls)
}
for (const id of ['seed', 'kind', 'color', 'gender', 'age', 'emblem', 'look', 'aura']) {
  $(id).addEventListener('input', rebuild)
}

let toolIndex = 0

// ── Live microphone ─────────────────────────────────────────────────────────
// The real test of the speech path: speak, and both avatars mouth it. The
// stream goes in exactly where a LiveKit track would, so if this works, that
// works.
let micStream = null
$('btn-mic').onclick = async () => {
  const on = $('btn-mic').getAttribute('aria-pressed') === 'true'
  if (on) {
    micStream?.getTracks().forEach((t) => t.stop())
    micStream = null
    both((a) => a.send({ type: 'speech.stop' }))
    $('btn-mic').setAttribute('aria-pressed', 'false')
    $('btn-mic').textContent = 'Speak into it'
    $('mic-level').style.width = '0%'
    return
  }
  try {
    // The click IS the user gesture browsers require before opening a mic or
    // starting an AudioContext.
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (err) {
    $('mic-note').textContent = `Microphone refused: ${err.message}. It needs permission, and a secure context — localhost counts.`
    return
  }
  both((a) => {
    a.send({ type: 'speech.attach', stream: micStream })
    a.setState('dictating')
  })
  $('btn-mic').setAttribute('aria-pressed', 'true')
  $('btn-mic').textContent = '■ Stop microphone'
  $('mic-note').textContent = 'Listening — talk, and watch the mouths.'
}

// Level meter, so it is obvious whether audio is actually arriving.
setInterval(() => {
  if (!micStream) return
  const lvl = live.speech?.level ?? 0
  $('mic-level').style.width = `${Math.min(100, lvl * 130).toFixed(0)}%`
}, 60)

// ── Auto demo ───────────────────────────────────────────────────────────────
// While the demo runs it owns the state and the turn, so the manual controls
// for those would just fight it — they are disabled and the sliders follow.
// Declared up here, not beside the tour below: `setDemo` reads it, and a `let`
// is unreachable before its own line runs.
let eyeTour = null
let actTour = null

// The demo drives the CONTROLS, not the avatar behind their back. Every beat
// writes into the same inputs a hand would and fires their events, so the
// panels light up as it goes and the page teaches itself: you watch which
// switch moved, then stop it and move that switch yourself.
let demoTimer = 0

const pickFrom = (a) => a[Math.floor(Math.random() * a.length)]
/** A vivid spread — agents are not people and their colour says so. */
const AGENT_PALETTE = [
  '#3B82F6', '#16A34A', '#9333EA', '#E36F3D', '#0E7490', '#BE185D',
  '#EAB308', '#14B8A6', '#F43F5E', '#8B5CF6', '#06B6D4', '#84CC16',
]
const roll = (p) => Math.random() < p

/** Set a control and let its own listener do the work. */
function drive(id, value, kind = 'input') {
  const el = $(id)
  if (!el) return
  if (el.type === 'checkbox') el.checked = value
  else el.value = value
  el.dispatchEvent(new Event(kind, { bubbles: true }))
}

/** Move one thing in the Who row, so it is obvious which field owns what. */
function driveIdentity() {
  const agent = $('kind').value === 'agent'
  const fields = [
    () => drive('gender', pickFrom(['', 'female', 'male'])),
    () => drive('age', roll(0.25) ? '' : String(18 + Math.floor(Math.random() * 62))),
    () => drive('part-head', roll(0.2) ? '' : pickFrom(PARTS.head)),
    () => drive('part-body', roll(0.2) ? '' : pickFrom(PARTS.body)),
    () => drive('part-bottom', roll(0.2) ? '' : pickFrom(PARTS.bottom)),
    () => drive('part-item', roll(0.35) ? '' : pickFrom(PARTS.item)),
    () => drive('part-glasses', roll(0.5) ? '' : pickFrom(PARTS.glasses)),
    () => drive('kind', agent ? 'customer' : 'agent'),
  ]
  if (agent) {
    fields.push(() => drive('part-skull', roll(0.25) ? '' : pickFrom(SKULL_NAMES)))
    fields.push(() => drive('color', pickFrom(AGENT_PALETTE)))
  }
  pickFrom(fields)()
}

function demoBeat() {
  const agent = $('kind').value === 'agent'
  // Always something visible in the expression row.
  const expr = Math.floor(Math.random() * RINGS.length)
  both((a) => a.engine?.setExpression(expr))
  document.querySelectorAll('[data-expr]').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.expr) === expr)))

  // Then one or two knobs, so the eye has something to follow.
  if (roll(0.55)) drive('spring', (4 + Math.random() * 8).toFixed(1))
  if (roll(0.5)) { drive('gx', (Math.random() * 2 - 1).toFixed(2)); drive('gy', (Math.random() * 2 - 1).toFixed(2)) }
  if (roll(0.35)) drive('scale', (0.6 + Math.random() * 1.1).toFixed(2))
  if (roll(0.25)) drive('emphasis', roll(0.5))
  if (roll(0.2)) drive('mouse', roll(0.5))
  if (roll(0.18)) drive('look', roll(0.7))
  if (roll(0.15) && agent) drive('aura', roll(0.7))
  if (roll(0.15)) drive('emblem', pickFrom(['icon', 'item', 'off']))
  if (roll(0.2)) drive('auto-blink', roll(0.85))
  if (roll(0.2)) drive('auto-motion', roll(0.85))

  // The buttons that used to sit under the stage are beats now.
  if (roll(0.4)) {
    const act = pickFrom(EYE_ACTS)
    both((a) => a.playAct(act.id))
    document.querySelectorAll('[data-act]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.act === act.id)))
  }
  if (roll(0.18)) both((a) => a.blink())
  if (roll(0.1) && agent) both((a) => a.spin(1))
  if (roll(0.08)) both((a) => a.remount())
  if (roll(0.3) && agent) both((a) => a.runTool(TOOL_SCRIPTS[toolIndex++ % TOOL_SCRIPTS.length], 4200))

  // Who changes too, one field at a time. A whole new stranger every beat is
  // just a slideshow; moving ONE dropdown and leaving the rest is what shows
  // which dropdown did what.
  if (roll(0.5)) driveIdentity()
  if (roll(0.1)) newPerson()

  demoTimer = setTimeout(demoBeat, 1800 + Math.random() * 1800)
}

function setDemo(on) {
  if (on && eyeTour) stopEyeTour()
  if (on && actTour) stopActTour()
  $('btn-demo').setAttribute('aria-pressed', String(on))
  $('btn-demo').textContent = on ? 'Stop demo' : 'Auto demo'
  $('turn').disabled = on
  clearTimeout(demoTimer)
  if (on) {
    live.startDemo()
    demoTimer = setTimeout(demoBeat, 700)
  } else {
    live.stopDemo()
    $('demo-note').textContent = ''
    applyControls()
  }
}
$('btn-demo').onclick = () => setDemo($('btn-demo').getAttribute('aria-pressed') !== 'true')
live.addEventListener('demobeat', (ev) => {
  // The demo swaps the person between beats — carry that onto the light twin so
  // the two panels never drift apart.
  syncTwin()
  applyControls()
  $('demo-note').textContent = ev.detail.note
  document.querySelectorAll('[data-state]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === ev.detail.state)))
})

// ── Test eyes ───────────────────────────────────────────────────────────────
// Walks EVERY eye type in order, both sets, and says which one is on screen.
// The point is that the catalogue is long enough that a grid of buttons does
// not tell you what you have — you have to watch them go past, and watch the
// springs carry one shape into the next.
function stopEyeTour() {
  if (eyeTour) clearInterval(eyeTour)
  eyeTour = null
  $('demo-note').textContent = ''
  applyControls()
}
function startEyeTour() {
  setDemo(false)
  // The tour IS the expression driver for its duration; leaving the automatic
  // one on would have the two fighting over the same face.
  $('auto-expr').checked = false
  applyControls()
  let i = -1
  const show = () => {
    i++
    if (i >= RINGS.length) return stopEyeTour()
    both((a) => a.setExpression(i))
    const set = i < BLOUB_FIRST ? 'generated set' : 'bloub set'
    $('demo-note').textContent =
      `${String(i + 1).padStart(2, '0')} / ${RINGS.length} · ${EXPRESSION_NAMES[i]} · ${set}`
    document
      .querySelectorAll('[data-expr]')
      .forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.expr) === i)))
    // Keep the running expression visible in a long grid.
    document.querySelector(`[data-expr="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  }
  show()
  eyeTour = setInterval(show, 1150)
}

// ── Eye animations ──────────────────────────────────────────────────────────
// One button per act, plus a runner that plays the lot back to back. The note
// under the grid says what each one is FOR, because "orbit" and "narrow" mean
// nothing until you have seen them once.
$('act-grid').innerHTML = EYE_ACTS.map(
  (a) => `<button data-act="${a.id}" title="${a.label}">${a.id}</button>`,
).join('')

function playAct(a) {
  $('act-note').textContent = `${a.label} · ${a.dur.toFixed(1)} s — ${a.note}`
  // Also on the stage caption, so it reads while you are watching the avatars
  // rather than making you look away to find out what is playing.
  $('demo-note').textContent = `▶ ${a.label}`
  document.querySelectorAll('[data-act]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.act === a.id)))
  both((av) => av.playAct(a.id))
}
$('act-grid').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-act]')
  if (!btn) return
  stopActTour()
  playAct(ACT_BY_ID.get(btn.dataset.act))
})

function stopActTour() {
  if (actTour) clearTimeout(actTour)
  actTour = null
  $('btn-acts').setAttribute('aria-pressed', 'false')
  $('btn-acts').textContent = '▶ Play all animations'
  $('demo-note').textContent = ''
  document.querySelectorAll('[data-act]').forEach((b) => b.setAttribute('aria-pressed', 'false'))
}
function startActTour() {
  setDemo(false)
  stopEyeTour()
  $('btn-acts').setAttribute('aria-pressed', 'true')
  $('btn-acts').textContent = '■ Stop'
  let i = 0
  const step = () => {
    if (i >= EYE_ACTS.length) return stopActTour()
    const a = EYE_ACTS[i++]
    playAct(a)
    // A short gap after each act, so you see it end rather than be cut off.
    actTour = setTimeout(step, a.dur * 1000 + 420)
  }
  step()
}
$('btn-acts').onclick = () => (actTour ? stopActTour() : startActTour())
// The same runner, on a button that sits with the stage rather than 2,000 px
// down the page. The animations are the part people come to see; burying them
// under the expression grid meant nobody found them.

$('btn-reset').onclick = () => {
  stopEyeTour()
  stopActTour()
  both((a) => a.stopAct())
  setDemo(false)
  for (const [id, v] of [['spring', 7], ['gx', 0], ['gy', 0], ['turn', 0], ['scale', 1]]) $(id).value = String(v)
  for (const id of ['emphasis', 'mouse']) $(id).checked = false
  for (const id of ['auto-blink', 'auto-expr', 'auto-motion']) $(id).checked = true
  applyControls()
}
// ── Adopt ───────────────────────────────────────────────────────────────────
// Click a face anywhere on the page and it becomes the person on the stage,
// with every control set to the values that built them. The panel is then a
// readout of that character, which is the only way to answer "how was this one
// made" without guessing.
function adopt(v) {
  setDemo(false)
  $('seed').value = v.seed || ''
  $('kind').value = v.kind || 'agent'
  if (v.color) $('color').value = v.color
  $('gender').value = v.gender || ''
  $('age').value = v.age ? String(v.age) : ''
  if ($('part-skull')) $('part-skull').value = v.skull || ''
  for (const slot of SLOTS) {
    const el = $(`part-${slot}`)
    if (el) el.value = v[slot] || ''
  }
  rebuild()
}

/** A fresh stranger on the stage, controls and all. */
function newPerson() {
  adopt(randomVariation({}, { pinParts: true }))
}

$('btn-random').onclick = () => newPerson()

// ── New head + colours ──────────────────────────────────────────────────────
// One button that walks the whole agent LOOK: a different generated skull, a
// different signature colour (which is the skin), and a fresh seed so the hair,
// outfit and face proportions move with it.
//
// Stepping the skull rather than picking at random guarantees you SEE every
// shape if you keep pressing — a random pick repeats and hides the rare ones,
// which is exactly how you end up thinking a feature is not implemented.
let headStep = 0
$('btn-head').onclick = () => {
  if ($('kind').value !== 'agent') {
    $('kind').value = 'agent'
  }
  const shapes = SKULL_NAMES
  headStep = (headStep + 1) % shapes.length
  $('part-skull').value = shapes[headStep]
  $('color').value = pickFrom(AGENT_PALETTE)
  $('seed').value = `agent:${Math.random().toString(36).slice(2, 9)}`
  for (const slot of SLOTS) $(`part-${slot}`).value = ''
  rebuild()
  $('demo-note').textContent = `head: ${shapes[headStep]}`
}

// ── Part pickers ────────────────────────────────────────────────────────────
// ── Skull picker ────────────────────────────────────────────────────────────
// Agents only, by design: an AI may have a head no person has, a person may not.
$('part-pickers').insertAdjacentHTML(
  'beforebegin',
  `<label class="control">
     <span class="control-head"><span>skull (agents only)</span></span>
     <select id="part-skull">
       <option value="">from seed</option>
       <option value="none">none — keep the drawn head</option>
       ${SKULL_NAMES.map((n) => `<option value="${n}">${n}</option>`).join('')}
     </select>
   </label>
   <p class="note" id="skull-note" style="margin-top:-4px"></p>`,
)

$('part-pickers').innerHTML = SLOTS.map(
  (slot) => `<label class="control">
      <span class="control-head"><span>${slot}</span></span>
      <select id="part-${slot}">
        <option value="">from seed</option>
        ${PARTS[slot].map((n) => `<option value="${n}">${n}</option>`).join('')}
      </select>
    </label>`,
).join('')
for (const slot of SLOTS) $(`part-${slot}`).addEventListener('input', rebuild)
$('part-skull').addEventListener('input', rebuild)

// ── Expression grid ─────────────────────────────────────────────────────────
$('expr-grid').innerHTML = RINGS.map((_, i) => {
  // The bloub entries move the head as well as the eyes, so they are marked —
  // otherwise it looks like the avatar wanders off on its own for sixteen of
  // the forty-one.
  const tag = i >= BLOUB_FIRST ? ' ✦' : ''
  return `<button data-expr="${i}" aria-pressed="${i === 0}" title="${EXPRESSION_NAMES[i]}${
    i >= BLOUB_FIRST ? ' — bloub set: moves the head too' : ''
  }">${String(i).padStart(2, '0')} ${EXPRESSION_NAMES[i].replace(/^bloub /, '')}${tag}</button>`
}).join('')
$('expr-grid').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-expr]')
  if (!btn) return
  const i = Number(btn.dataset.expr)
  stopEyeTour()
  $('auto-expr').checked = false
  applyControls()
  both((a) => a.setExpression(i))
  document.querySelectorAll('[data-expr]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.expr) === i)))
})

// ── State picker ────────────────────────────────────────────────────────────
// Each chip carries the symbol that state puts over the head. It used to be a
// separate reference sheet in its own tab, which meant reading the answer in
// one place and pressing the button in another.
$('state-groups').innerHTML = STATE_GROUPS.map(
  (g) => `<div>
      <div class="group-label">${g.label}</div>
      <div class="chips">${g.states
        .map((s) => {
          const [icon] = emblemFor(s)
          return `<button data-state="${s}" aria-pressed="${s === 'idle'}">${
            icon ? iconSvg(icon, { size: 13 }) : ''
          }${s}</button>`
        })
        .join('')}</div>
    </div>`,
).join('')

function selectState(state) {
  if (live.hasAttribute('demo')) setDemo(false)
  both((a) => a.setState(state))
  document.querySelectorAll('[data-state]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === state)))
  const fmt = (v) => (v ? `${(v[0] / 1000).toFixed(1)}–${(v[1] / 1000).toFixed(1)} s` : 'off')
  const m = MOTION[state]
  $('sd-title').textContent = state
  $('sd-note').textContent = STATE_NOTES[state] || ''
  $('sd-pool').textContent = POOLS[state].map((i) => `${i} ${EXPRESSION_NAMES[i]}`).join(' · ')
  $('sd-expr').textContent = fmt(EXPR_CADENCE[state])
  $('sd-blink').textContent = fmt(BLINK[state])
  $('sd-motion').textContent = `breathe ${m.breathe} · sway ${m.sway}° · nod ${m.nod} · bounce ${m.bounce} · gaze ${m.gaze}`
}
$('state-groups').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-state]')
  if (btn) selectState(btn.dataset.state)
})

// ── Readout ─────────────────────────────────────────────────────────────────
// The frame counter is the honest part of the claim that this is cheap: it
// counts real frames on a page that is animating every avatar you can see.
let frames = 0
let fpsMark = performance.now()
let fps = 0
;(function count() {
  frames++
  const now = performance.now()
  if (now - fpsMark > 500) {
    fps = Math.round((frames * 1000) / (now - fpsMark))
    frames = 0
    fpsMark = now
  }
  requestAnimationFrame(count)
})()

setInterval(() => {
  const e = live.engine
  if (!e) return
  $('r-state').textContent = e.state
  $('r-expr').textContent = String(e.expression).padStart(2, '0')
  $('r-turn').textContent = `${((e.turn * 180) / Math.PI).toFixed(0)}°`
  $('r-fps').textContent = String(fps)
  $('r-active').textContent = String(activeCount())
  $('r-total').textContent = String(totalCount())
  $('r-aura').textContent = String(
    [...document.querySelectorAll('avatar-motion')].filter((a) => a.engine?.auraSlot).length,
  )
}, 400)

// ── Tabs ────────────────────────────────────────────────────────────────────
document.querySelector('.tabs').addEventListener('click', (ev) => {
  const tab = ev.target.closest('.tab')
  if (!tab) return
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)))
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.hidden = p.id !== `tab-${tab.dataset.tab}`
  })
})

// ── Crowd — fifty at a time, forever ────────────────────────────────────────
//
// A fixed set of twelve showed that the engine runs. It could not show the one
// thing a variation system has to prove: that it does not repeat. So this
// generates fifty new people per page and the pager never ends.
//
// Pages are remembered once made, so going back to page 2 shows the same fifty
// rather than a fresh fifty — a crowd that reshuffles when you glance away is
// not a crowd, it is a screensaver.

const gallery = $('gallery')
const PER_PAGE = 50
/** page number → the fifty variations that page holds */
const pages = new Map()
let page = 1

function crowdTile(v) {
  const fig = document.createElement('figure')
  fig.className = 'figure'
  const box = document.createElement('div')
  box.className = 'box'
  const el = document.createElement('avatar-motion')
  el.style.cssText = 'width:100%;height:100%'
  applyVariation(el, v)
  el.setAttribute('emblem', 'icon')
  // The WebGL pool is three deep for the whole page; a crowd must never try to
  // claim one.
  el.setAttribute('no-aura', '')
  box.appendChild(el)
  box.addEventListener('pointerenter', () => el.setAttribute('mouse-interactive', ''))
  box.addEventListener('pointerleave', () => el.removeAttribute('mouse-interactive'))
  box.style.cursor = 'pointer'
  box.addEventListener('click', () => {
    adopt(v)
    document.querySelector('.tab[data-tab="drive"]')?.click()
    document.querySelector('.stage')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
  // Fifty at once means the tile is small, and a caption under a small tile is
  // two lines of wrapped type per face. The detail moves to the tooltip so the
  // grid is faces and nothing else.
  fig.title = v.kind === 'agent' ? `${v.state} · ${v.skull} · ${v.seed}` : `${v.state}${v.age ? ` · ${v.age}` : ''} · ${v.seed}`
  fig.append(box)
  return fig
}

function peopleFor(n) {
  if (!pages.has(n)) {
    pages.set(n, Array.from({ length: PER_PAGE }, () => randomVariation({}, { pinParts: true })))
  }
  return pages.get(n)
}

/**
 * The pager.
 *
 * There is no last page, so there is no "of 12" to print. It shows where you
 * are, a few either side, and a next — which is all a reader can act on.
 */
function drawPager() {
  const nav = $('crowd-pager')
  if (!nav) return
  const near = []
  for (let n = Math.max(1, page - 2); n <= page + 2; n++) near.push(n)
  nav.innerHTML = [
    `<button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>&larr;</button>`,
    page > 3 ? `<button data-page="1">1</button><span class="gap">…</span>` : '',
    ...near.map((n) => `<button data-page="${n}" aria-pressed="${n === page}">${n}</button>`),
    `<span class="gap">…</span>`,
    `<button data-page="${page + 1}">&rarr;</button>`,
  ].join('')
  const count = $('crowd-count')
  if (count) count.textContent = `page ${page} · ${pages.size * PER_PAGE} people made so far`
}

function showPage(n) {
  page = Math.max(1, n)
  const frag = document.createDocumentFragment()
  for (const v of peopleFor(page)) frag.appendChild(crowdTile(v))
  gallery.replaceChildren(frag)
  drawPager()
}

$('crowd-pager')?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-page]')
  if (!btn || btn.disabled) return
  showPage(Number(btn.dataset.page))
  gallery.scrollIntoView({ block: 'start', behavior: 'smooth' })
})

showPage(1)

// ── Go ──────────────────────────────────────────────────────────────────────
rebuild()
selectState('idle')

// ── Bridge (opt-in) ─────────────────────────────────────────────────────────
// Add ?bridge to the URL and this page joins the local bridge, so the CLI and
// the MCP server can drive the avatar on screen. Opt-in on purpose: a page that
// silently accepts commands from a local port is a surprise nobody wants.
if (new URLSearchParams(location.search).has('bridge')) {
  import('./bridge-client.js').then(({ connectBridge }) => {
    // A getter, not the element: the lab rebuilds its avatar on every identity
    // change, so the connection has to follow the current one.
    connectBridge(() => document.querySelector('#box-live avatar-motion'), { name: 'stage' })
    connectBridge(() => document.querySelector('#box-light avatar-motion'), { name: 'light' })
    const note = $('demo-note')
    if (note) note.textContent = 'bridged — try: bun bin/avatar.js state listening'
  })
}
