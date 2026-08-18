// Wiring for the draft page. No framework — the point of the draft is that the
// merged avatar is a plain custom element you can drop anywhere.
import './alive-avatar.js'
import { buildAvatar, PARTS } from './humation.js'
import { EXPRESSION_NAMES, RINGS, BLOUB_FIRST } from './expressions.js'
import { EYE_ACTS, ACT_BY_ID } from './motion/eyeacts.js'
import { SKULL_NAMES } from './render/skull.js'
import { POOLS, BLINK, EXPR_CADENCE, MOTION, STATE_GROUPS, STATE_NOTES, TOOL_SCRIPTS } from './states.js'
import { STATES } from './states.js'
import { activeCount, totalCount } from './core/ticker.js'
import { iconSvg } from './render/icons.js'
import { emblemFor } from './render/emblem.js'
import { randomVariation, applyVariation, SPACE } from './variation.js'
import { nameFor } from './names.js'

const $ = (id) => document.getElementById(id)
const SLOTS = ['head', 'body', 'bottom', 'item', 'glasses']

// ── The two stage avatars ───────────────────────────────────────────────────
// Two avatars, same seed, same state, one per theme — driven as a pair so a
// bug that only shows in one theme cannot hide.
const live = document.createElement('alive-avatar')
live.style.cssText = 'width:100%;height:100%'
live.setAttribute('theme', 'dark')
// The fade between people is the transition; an arrival animation on top of it
// makes the two panels look out of step.
live.setAttribute('no-mount', '')
$('box-live').appendChild(live)

const lightTwin = document.createElement('alive-avatar')
lightTwin.style.cssText = 'width:100%;height:100%'
lightTwin.setAttribute('theme', 'light')
lightTwin.setAttribute('no-mount', '')
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

// ── Who, as data ────────────────────────────────────────────────────────────
// One object, not eleven form controls. The pills read it and write to it, the
// demo writes to it, the gallery writes to it — and the seed never appears on
// screen, because a name is a better handle for a person than an id is.
const who = {
  seed: 'agent:reception-01',
  kind: 'agent',
  color: '#3B82F6',
  gender: '',
  age: '',
  skull: '',
  head: '', body: '', bottom: '', item: '', glasses: '',
}

function currentConfig() {
  const cfg = {
    seed: who.seed || 'avatar',
    kind: who.kind,
    color: who.color,
    gender: who.gender || undefined,
    age: who.age ? Number(who.age) : undefined,
    skull: who.skull,
    selections: {},
  }
  for (const slot of SLOTS) if (who[slot]) cfg.selections[slot] = who[slot]
  return cfg
}

/** Set one slot and let everything downstream follow. */
function setWho(slot, value) {
  who[slot] = value == null ? '' : String(value)
  paintVisuals()
  rebuild()
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
  // A pill filled with a near-black brown disappears into a near-black page,
  // so a fill that is too close to the page gets lifted off it first. The ink
  // is then chosen against the FILL, not against the raw colour.
  const fill = dark ? (lum < 0.3 ? mix(0.45, 'white') : colour) : lum > 0.82 ? mix(0.3, 'black') : colour
  const fillLum = (() => {
    const [fr, fg, fb] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16))
    return (0.299 * fr + 0.587 * fg + 0.114 * fb) / 255
  })()
  const root = document.documentElement.style
  root.setProperty('--accent', fill)
  root.setProperty('--on-accent', fillLum > 0.58 ? '#101010' : '#ffffff')
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
  // The slider takes the range the FACE allows, measured from where its eyes
  // sit on the sphere. A person turns less than an agent, so their share of it
  // is smaller — but both numbers come from the drawing, not from a constant.
  const share = cfg.kind === 'customer' ? 0.55 : 1
  const deg = (r) => Math.round((r * 180) / Math.PI * share)
  $('turn').min = String(deg(built.face.turnMin))
  $('turn').max = String(deg(built.face.turnMax))
  if (Number($('turn').value) > Number($('turn').max)) $('turn').value = $('turn').max
  if (Number($('turn').value) < Number($('turn').min)) $('turn').value = $('turn').min
  // The name is the only handle on screen, so it is painted from the same
  // config that drew the face — never from a stale copy.
  $('avatar-name').textContent = nameFor(cfg.seed, { kind: cfg.kind, gender: cfg.gender })
  $('gaze-note').textContent =
    `Gaze range on this face: ±${built.face.gazeXMax.toFixed(2)} horizontally, ` +
    `±${built.face.gazeYMax.toFixed(2)} vertically — kept as the gist's ratio of eye separation (${built.face.separation.toFixed(2)}).`
  const frontDeg = (-(built.face.slots[0].baseLongitude + built.face.slots[1].baseLongitude) / 2 * 180) / Math.PI
  $('front-angle').textContent = `${frontDeg > 0 ? '+' : ''}${frontDeg.toFixed(0)}°`
}

/** A vivid spread — agents are not people and their colour says so. */
const AGENT_PALETTE = [
  '#3B82F6', '#16A34A', '#9333EA', '#E36F3D', '#0E7490', '#BE185D',
  '#EAB308', '#14B8A6', '#F43F5E', '#8B5CF6', '#06B6D4', '#84CC16',
]

// ── One field for every setting ─────────────────────────────────────────────
// Kind, gender, age, colour, the wardrobe, the states, the expressions, the eye
// moves and the switches all live in ONE flowing row. A group is its label plus
// its pills; the only thing separating one group from the next is a wider gap
// before the label. Nothing gets a line of its own, so the settings fill the
// width instead of the height and the avatars stay in view.
const VISUAL_ROWS = [
  { slot: 'kind', label: 'kind', values: [['agent', 'agent'], ['customer', 'person']] },
  { slot: 'gender', label: 'gender', values: [['', 'any'], ['female', 'female'], ['male', 'male']] },
  { slot: 'age', label: 'age', values: [['', 'any'], ['22', '22'], ['31', '31'], ['44', '44'], ['57', '57'], ['68', '68'], ['79', '79']] },
  { slot: 'color', label: 'colour', swatches: true, values: AGENT_PALETTE.map((c) => [c, c]) },
  { slot: 'skull', label: 'skull', values: [['', 'any'], ...SKULL_NAMES.map((n) => [n, n])] },
  { slot: 'head', label: 'hair', values: [['', 'any'], ...PARTS.head.map((n) => [n, n])] },
  { slot: 'body', label: 'top', values: [['', 'any'], ...PARTS.body.map((n) => [n, n])] },
  { slot: 'bottom', label: 'bottom', values: [['', 'any'], ...PARTS.bottom.map((n) => [n, n])] },
  { slot: 'item', label: 'item', values: [['', 'any'], ...PARTS.item.map((n) => [n, n])] },
  { slot: 'glasses', label: 'glasses', values: [['', 'any'], ...PARTS.glasses.map((n) => [n, n])] },
]

const SWITCHES = [
  ['mouse', 'eye', 'follow pointer'],
  ['emphasis', 'spark', 'bigger eyes'],
  ['look', 'sun', 'light + texture'],
  ['aura', 'orbit', 'aura'],
  ['auto-blink', 'ear', 'auto blink'],
  ['auto-expr', 'star', 'auto expression'],
  ['auto-motion', 'signal', 'auto motion'],
]

const group = (name, label, inner) =>
  `<span class="grp" data-row="${name}"><span class="group-label">${label}</span>${inner}</span>`

$('controls').innerHTML = [
  ...VISUAL_ROWS.map((row) =>
    group(row.slot, row.label, row.values.map(([value, label]) =>
      row.swatches
        ? `<button class="swatch" data-who="${row.slot}" data-val="${value}" title="${label}" style="--swatch:${value}"></button>`
        : `<button data-who="${row.slot}" data-val="${value}">${label}</button>`).join('')),
  ),
  ...STATE_GROUPS.map((g) =>
    group(`state-${g.label}`, g.label, g.states.map((st) => {
      const [icon] = emblemFor(st)
      return `<button data-state="${st}" aria-pressed="${st === 'idle'}">${icon ? iconSvg(icon, { size: 13 }) : ''}${st}</button>`
    }).join('')),
  ),
  group('expr-generated', 'faces', RINGS.slice(0, BLOUB_FIRST).map((_, i) =>
    `<button data-expr="${i}" aria-pressed="${i === 0}" title="${EXPRESSION_NAMES[i]}">${EXPRESSION_NAMES[i]}</button>`).join('')),
  group('expr-bloub', 'bloub faces', RINGS.slice(BLOUB_FIRST).map((_, k) => {
    const i = BLOUB_FIRST + k
    return `<button data-expr="${i}" title="${EXPRESSION_NAMES[i]}">${EXPRESSION_NAMES[i].replace(/^bloub /, '')}</button>`
  }).join('')),
  group('acts', 'eye moves', EYE_ACTS.map((a) => `<button data-act="${a.id}" title="${a.label}">${a.id}</button>`).join('')),
  group('switches', 'switches', SWITCHES.map(([id, icon, label]) =>
    `<label class="pill">${iconSvg(icon, { size: 12 })}<input type="checkbox" id="${id}"${
      id.startsWith('auto') || id === 'look' || id === 'aura' ? ' checked' : ''
    } /><span>${label}</span></label>`).join('')),
  group('emblem', 'emblem',
    `<select id="emblem"><option value="icon">icon</option><option value="item">hat / pet</option><option value="off">none</option></select>`),
].join('')

/** Light the pill that matches the current value, in every wardrobe group. */
function paintVisuals() {
  for (const b of $('controls').querySelectorAll('[data-who]')) {
    b.setAttribute('aria-pressed', String((who[b.dataset.who] || '') === b.dataset.val))
  }
  // A person keeps the head the illustrator drew and has no signature colour.
  // Those two groups used to vanish, which moved every pill after them and made
  // the colours look like they came and went. They stay put and go quiet.
  for (const row of ['skull', 'color']) {
    const grp = $('controls').querySelector(`[data-row="${row}"]`)
    if (grp) grp.classList.toggle('muted', who.kind !== 'agent')
  }
}

// One listener for the whole field: which kind of pill it was is a data
// attribute, not a separate wiring.
$('controls').addEventListener('click', (ev) => {
  const slot = ev.target.closest('[data-who]')
  if (slot) return setWho(slot.dataset.who, slot.dataset.val)

  const state = ev.target.closest('[data-state]')
  if (state) return selectState(state.dataset.state)

  const expr = ev.target.closest('[data-expr]')
  if (expr) {
    const i = Number(expr.dataset.expr)
    stopEyeTour()
    drive('auto-expr', false)
    both((a) => a.setExpression(i))
    document.querySelectorAll('[data-expr]').forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.expr) === i)))
    return
  }

  const act = ev.target.closest('[data-act]')
  if (act) {
    stopActTour()
    playAct(ACT_BY_ID.get(act.dataset.act))
  }
})

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
// The identity moved into `who` and its pills; only these three still live in
// a control of their own.
for (const id of ['emblem', 'look', 'aura']) {
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
const roll = (p) => Math.random() < p

/**
 * Change who is on the stage behind a fade.
 *
 * Rebuilding the avatar swaps the whole drawing at once, which reads as a
 * flicker. Both panels fade out together, change together, and come back
 * together — so the dark and the light one are never a frame apart, and the
 * arrival animation never fires mid-demo.
 */
let fading = false
function fadeSwap(change) {
  const stage = document.querySelector('.stage-avatars')
  if (!stage || fading) return change()
  fading = true
  stage.style.opacity = '0'
  setTimeout(() => {
    change()
    // Two frames: one for the rebuild to land, one for the paint.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      stage.style.opacity = '1'
      fading = false
    }))
  }, 260)
}

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
  const agent = who.kind === 'agent'
  const fields = [
    () => setWho('gender', pickFrom(['', 'female', 'male'])),
    () => setWho('age', roll(0.25) ? '' : pickFrom(['22', '31', '44', '57', '68', '79'])),
    () => setWho('head', roll(0.2) ? '' : pickFrom(PARTS.head)),
    () => setWho('body', roll(0.2) ? '' : pickFrom(PARTS.body)),
    () => setWho('bottom', roll(0.2) ? '' : pickFrom(PARTS.bottom)),
    () => setWho('item', roll(0.35) ? '' : pickFrom(PARTS.item)),
    () => setWho('glasses', roll(0.5) ? '' : pickFrom(PARTS.glasses)),
    () => setWho('kind', agent ? 'customer' : 'agent'),
  ]
  if (agent) {
    fields.push(() => setWho('skull', roll(0.25) ? '' : pickFrom(SKULL_NAMES)))
    fields.push(() => setWho('color', pickFrom(AGENT_PALETTE)))
  }
  pickFrom(fields)()
}

function demoBeat() {
  const agent = who.kind === 'agent'
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
  if (roll(0.4)) drive('emblem', pickFrom(['icon', 'item', 'off']))
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
  fadeSwap(() => {
    driveIdentity()
    if (roll(0.5)) driveIdentity()
    if (roll(0.1)) newPerson({ keepDemo: true })
  })

  // At least four seconds on screen: a change you cannot finish looking at
  // is a change you did not see.
  demoTimer = setTimeout(demoBeat, 4000 + Math.random() * 1600)
}

// ── Expressions only ────────────────────────────────────────────────────────
// The same character, over and over, doing different things. Nothing about WHO
// they are moves — no seed, no parts, no colour — so what you are watching is
// the range of the face rather than the range of the wardrobe.
let facesTimer = 0

function facesBeat() {
  const expr = Math.floor(Math.random() * RINGS.length)
  both((a) => a.engine?.setExpression(expr))
  document.querySelectorAll('[data-expr]').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.expr) === expr)))

  if (roll(0.55)) {
    const state = pickFrom(STATES)
    both((a) => a.setState(state))
    document.querySelectorAll('[data-state]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.state === state)))
  }
  // No tool calls here on purpose. This mode is the FACE: glasses, a bubble and
  // a running outfit colour are the machine talking, not the face.
  if (roll(0.5)) { drive('gx', (Math.random() * 2 - 1).toFixed(2)); drive('gy', (Math.random() * 2 - 1).toFixed(2)) }
  if (roll(0.2)) both((a) => a.blink())

  facesTimer = setTimeout(facesBeat, 4000 + Math.random() * 1600)
}

function setFaces(on) {
  if (on) setDemo(false)
  clearTimeout(facesTimer)
  $('btn-faces').setAttribute('aria-pressed', String(on))
  $('btn-faces').textContent = on ? 'Stop' : 'Play expressions'
  if (on) facesTimer = setTimeout(facesBeat, 400)
}
$('btn-faces').onclick = () => setFaces($('btn-faces').getAttribute('aria-pressed') !== 'true')

function setDemo(on) {
  if (on && eyeTour) stopEyeTour()
  if (on && actTour) stopActTour()
  $('btn-demo').setAttribute('aria-pressed', String(on))
  $('btn-demo').textContent = on ? 'Stop' : 'Demo'
  $('turn').disabled = on
  clearTimeout(demoTimer)
  if (on) {
    setFaces(false)
    live.startDemo()
    demoTimer = setTimeout(demoBeat, 700)
  } else {
    // Stop means freeze, not rewind: keep the person, the state and every
    // setting the demo left behind, and just stop changing them.
    const held = live.getAttribute('state') || 'idle'
    live.stopDemo()
    syncTwin()
    both((a) => a.setState(held))
    document.querySelectorAll('[data-state]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.state === held)))
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
function playAct(a) {
  $('act-note').textContent = `${a.label} · ${a.dur.toFixed(1)} s — ${a.note}`
  // Also on the stage caption, so it reads while you are watching the avatars
  // rather than making you look away to find out what is playing.
  $('demo-note').textContent = `▶ ${a.label}`
  document.querySelectorAll('[data-act]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.act === a.id)))
  both((av) => av.playAct(a.id))
}

function stopActTour() {
  if (actTour) clearTimeout(actTour)
  actTour = null
  $('btn-acts').setAttribute('aria-pressed', 'false')
  $('btn-acts').textContent = 'Play animations'
  $('demo-note').textContent = ''
  document.querySelectorAll('[data-act]').forEach((b) => b.setAttribute('aria-pressed', 'false'))
}
function startActTour() {
  setDemo(false)
  stopEyeTour()
  $('btn-acts').setAttribute('aria-pressed', 'true')
  $('btn-acts').textContent = 'Stop'
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
function adopt(v, { keepDemo = false } = {}) {
  if (!keepDemo) setDemo(false)
  who.seed = v.seed || who.seed
  who.kind = v.kind || 'agent'
  if (v.color) who.color = v.color
  who.gender = v.gender || ''
  who.age = v.age ? String(v.age) : ''
  who.skull = v.skull || ''
  for (const slot of SLOTS) who[slot] = v[slot] || ''
  paintVisuals()
  rebuild()
}

/** A fresh stranger on the stage, controls and all. */
function newPerson(opts) {
  adopt(randomVariation({}, { pinParts: true }), opts)
}

// Random is one throw of the whole machine: a new person AND a new state, a
// new expression, new dials, new switches. Half a shuffle is not a shuffle.
function randomiseEverything() {
  setDemo(false)
  setFaces(false)
  // No fade. The demo dissolves between people because it changes on its own
  // and a hard cut would look like a glitch. This one is a button: you pressed
  // it, so the answer belongs on screen now, not in a quarter of a second.
  ;(() => {
    newPerson()
    const state = pickFrom(STATES)
    both((a) => a.setState(state))
    document.querySelectorAll('[data-state]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.state === state)))
    const expr = Math.floor(Math.random() * RINGS.length)
    both((a) => a.engine?.setExpression(expr))
    document.querySelectorAll('[data-expr]').forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.expr) === expr)))
    drive('spring', (4 + Math.random() * 8).toFixed(1))
    drive('gx', (Math.random() * 2 - 1).toFixed(2))
    drive('gy', (Math.random() * 2 - 1).toFixed(2))
    drive('scale', (0.6 + Math.random() * 1.1).toFixed(2))
    drive('emphasis', roll(0.35))
    drive('mouse', roll(0.3))
    drive('look', roll(0.85))
    drive('aura', roll(0.7))
    drive('auto-blink', roll(0.9))
    drive('auto-motion', roll(0.9))
    drive('emblem', pickFrom(['icon', 'item', 'off']))
  })()
}
$('btn-random').onclick = randomiseEverything


// ── State picker ────────────────────────────────────────────────────────────
// One flowing row: a category label, its pills, the next label, its pills. The
// old version put every category on its own line, which pushed half the states
// off the screen for no reason but tidiness.
function selectState(state) {
  if (live.hasAttribute('demo')) setDemo(false)
  both((a) => a.setState(state))
  document.querySelectorAll('[data-state]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === state)))
}
$('controls').addEventListener('click', (ev) => {
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
    [...document.querySelectorAll('alive-avatar')].filter((a) => a.engine?.auraSlot).length,
  )
}, 400)


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
// How many fit, rather than a number somebody picked. The gallery fills the
// space it is given and not one row more, so opening it never makes the page
// taller and never scrolls anything.
const TILE = 72
const GAP = 4
let PER_PAGE = 120

function fitPage() {
  const box = gallery.getBoundingClientRect()
  const cols = Math.max(1, Math.floor((gallery.clientWidth + GAP) / (TILE + GAP)))
  // Leave the pager and its margin room at the bottom of the window.
  const room = window.innerHeight - box.top - 62
  const rows = Math.max(1, Math.floor((room + GAP) / (TILE + GAP)))
  return cols * rows
}
/** page number → the fifty variations that page holds */
const pages = new Map()
let page = 1

function crowdTile(v) {
  const fig = document.createElement('figure')
  fig.className = 'figure'
  const box = document.createElement('div')
  box.className = 'box'
  const el = document.createElement('alive-avatar')
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
    setGallery(false)
  })
  // Fifty at once means the tile is small, and a caption under a small tile is
  // two lines of wrapped type per face. The detail moves to the tooltip so the
  // grid is faces and nothing else.
  // The tooltip names them. A seed is an id; a name is a person, and the
  // gallery is where you are choosing one.
  const name = nameFor(v.seed, { kind: v.kind, gender: v.gender })
  fig.title = v.kind === 'agent'
    ? `${name} · ${v.state} · ${v.skull || 'any'} head`
    : `${name} · ${v.state}${v.age ? ` · ${v.age}` : ''}`
  fig.append(box)
  return fig
}

function peopleFor(n) {
  const held = pages.get(n)
  if (held && held.length >= PER_PAGE) return held.slice(0, PER_PAGE)
  const grown = held || []
  while (grown.length < PER_PAGE) grown.push(randomVariation({}, { pinParts: true }))
  pages.set(n, grown)
  return grown
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
})

showPage(1)

// ── The gallery drawer ──────────────────────────────────────────────────────
// Not a tab. A tab makes the crowd a place you go; this makes it a thing you
// open, pick from, and close — which is what it is for.
const drawer = $('gallery-panel')
function setGallery(open) {
  // The gallery takes the whole lower half over. Leaving the dials visible
  // under a wall of faces makes you scroll past the faces to reach them, which
  // is worse than either thing on its own.
  drawer.hidden = !open
  $('tab-drive').hidden = open
  $('btn-gallery').setAttribute('aria-pressed', String(open))
  $('btn-gallery').textContent = open ? 'Close gallery' : 'Gallery'
  // Measure AFTER it is on screen — a hidden element has no width, and asking
  // one how many tiles fit gets you a single column.
  if (open) {
    PER_PAGE = fitPage()
    showPage(page)
  }
}

// The window changing size changes how many fit, so the page refills rather
// than leaving a gap or spilling over the fold.
addEventListener('resize', () => {
  if (drawer.hidden) return
  const next = fitPage()
  if (next === PER_PAGE) return
  PER_PAGE = next
  showPage(page)
})
$('btn-gallery').onclick = () => setGallery(drawer.hidden)

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
    connectBridge(() => document.querySelector('#box-live alive-avatar'), { name: 'stage' })
    connectBridge(() => document.querySelector('#box-light alive-avatar'), { name: 'light' })
    const note = $('demo-note')
    if (note) note.textContent = 'bridged — try: bun bin/avatar.js state listening'
  })
}
