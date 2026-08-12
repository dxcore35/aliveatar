// ---------------------------------------------------------------------------
// FaceEngine — the motion half.
//
// The core is still the GrokBot teardown: springs between eye shapes, a blink
// curve that closes faster than it opens, eyes projected onto a head sphere,
// and a state machine of expression pools and cadences. What has been added is
// everything that stops a loop from reading as a loop.
//
// SIMULATION AND DRAWING ARE SEPARATE.
//   fixed(dt, t)  runs at a fixed 120 Hz from the shared ticker, so a spring
//                 settles identically on a 60 Hz laptop and a 144 Hz monitor.
//   draw(t)       runs once per real frame and only writes attributes.
// Nothing here owns a requestAnimationFrame; the page owns one, for everybody.
//
// Layers of motion, roughly in order of how much they matter:
//   saccadic gaze      eyes jump and hold — never glide (see motion/gaze.js)
//   blink variety      singles, doubles, half-lids, clustered intervals
//   breath             asymmetric curve, not a sine
//   head lag           the head follows a look and the eyes then recentre
//   lid follow         looking down lowers the upper lid
//   weight shift       a very slow lean, on its own clock
//   squash and stretch on hops, so mass reads
//   agent theatrics    glasses, hue runs, and the WebGL aura
// ---------------------------------------------------------------------------
import { RINGS, MOUTH_RINGS } from './expressions.js'
import {
  POOLS, BLINK, EXPR_CADENCE, MOTION, TALK, KIND_PROFILE, TOOL_STATES,
  SKIN_MOOD, WARDROBE_STEP_MS, LASER_POSTURE,
} from './states.js'
import { ageProfile, readableSkin } from './humation.js'
import { Gaze } from './motion/gaze.js'
import { Blinker, WeightShift, breathCurve } from './motion/body.js'
import { acquire, release, hexToRgb } from './gl/aura.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t
const rand = (lo, hi) => lo + Math.random() * (hi - lo)

export class FaceEngine {
  constructor(slot, face, opts = {}) {
    this.slot = slot
    this.face = face
    this.faceGlassed = opts.faceGlassed || null
    this.variation = face.variation || {}
    this.profile = KIND_PROFILE[opts.kind === 'customer' ? 'customer' : 'agent']
    this.kind = opts.kind === 'customer' ? 'customer' : 'agent'
    // Older people move a little less and a little slower; younger ones more.
    this.age = ageProfile(opts.age)

    this.root = opts.root || null
    this.toolGlasses = opts.toolGlasses || null
    this.baseClothes = opts.baseClothes || null
    // The colour the face is ACTUALLY painted, already floored into a readable
    // range — never the raw attribute.
    this.baseColor = opts.resolvedSkin || readableSkin(opts.color || '#3B82F6')
    this.auraColor = opts.color || '#3B82F6'
    this.headShift = opts.headShift || null
    this.faceShift = opts.faceShift || null
    this.bodyShift = opts.bodyShift || null
    this.neckShift = opts.neckShift || null
    this.rootShift = opts.rootShift || null
    this.shadowEl = opts.shadowEl || null
    this.auraHost = opts.auraHost || null
    this.onTool = opts.onTool || null
    this.onState = opts.onState || null

    const svgEl = (cls) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      p.setAttribute('class', cls)
      slot.appendChild(p)
      return p
    }
    // Beams go UNDER the eyes, so an eye always sits on top of its own beam.
    this.laserGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    this.laserGroup.setAttribute('class', 'am-laser')
    this.laserGroup.style.display = 'none'
    slot.appendChild(this.laserGroup)
    this.laserEls = []
    for (let i = 0; i < 6; i++) {
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      // glow / body / core, per eye
      ln.setAttribute('stroke', ['var(--am-laser, #ff2d2d)', 'var(--am-laser, #ff2d2d)', '#fff6f6'][i % 3])
      ln.setAttribute('stroke-linecap', 'round')
      this.laserGroup.appendChild(ln)
      this.laserEls.push(ln)
    }

    this.mouthPath = svgEl('am-mouth')
    this.paths = [svgEl('am-eye'), svgEl('am-eye')]

    this.petEyes = opts.petEyes || []
    this.petBlinker = new Blinker()

    // Expression morph.
    this.expression = 0
    this.current = RINGS[0].map((r) => r.map((p) => [p[0], p[1]]))
    this.target = RINGS[0]
    this.currentMouth = MOUTH_RINGS[0].map((p) => [p[0], p[1]])
    this.targetMouth = MOUTH_RINGS[0]
    this.morph = 1
    this.velocity = 0
    this.stiffness = 7

    // Natural motion.
    this.gaze = new Gaze()
    this.blinker = new Blinker()
    this.weight = new WeightShift()
    this.breathPhase = Math.random()
    this.clock = 0
    this.exprTimer = 0
    this.exprNext = 0

    // Controls.
    this.state = 'idle'
    this.autoExpression = true
    this.autoBlink = true
    this.autoMotion = true
    this.manualGaze = { x: 0, y: 0 }
    this.manualTurn = 0
    this.eyeScale = 1
    this.emphasis = false
    this.reduced = false
    this.auraEnabled = true

    // Turn: a lagged spring, so the head has weight instead of snapping.
    this.turn = 0
    this.turnV = 0
    // Secondary motion: the head trails the body's movement by a beat, and
    // catches up with a little overshoot. Rigid figures read as puppets; this
    // one lag term is most of what makes the motion feel fluid instead.
    this.headLag = 0
    this.headLagV = 0
    this.prevTurn = 0
    this.spinFrom = 0
    this.spinTurns = 0
    this.spinT = 1

    // Mount / tool.
    this.mountT = 1
    this.tool = null
    this.toolLevel = 0
    this.toolVel = 0
    this.auraSlot = null
    this.auraIntensity = 0
    this.clothesSet = 0 // forces one reset write on the first idle frame
    this.mood = [0, 1, 1] // hue shift, saturation ×, lightness × — eased, not switched
    this.moodSet = false

    // Search does not put glasses on — it fires the eyes. Ramped rather than
    // switched so the beams charge up and fade out. (The beam elements
    // themselves are built above, with the rest of the face.)
    this.laser = 0
    this.glassesLocked = false

    // Speech drives the mouth when it is running; nothing changes when it is not.
    this.speech = opts.speech || null
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onReducedMotion(reduced) {
    this.reduced = reduced
    if (reduced) this.releaseAura()
  }

  /** Called by the ticker when the avatar scrolls out of view. */
  onHidden() {
    this.releaseAura()
  }

  destroy() {
    this.releaseAura()
  }

  releaseAura() {
    if (this.auraSlot) {
      release(this.auraSlot, this)
      this.auraSlot = null
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────

  setState(state) {
    if (!POOLS[state]) return
    this.state = state
    this.setExpression(POOLS[state][0])
    this.exprNext = 0
    this.blinker.next = 0
    this.onState?.(state)
  }

  setExpression(index) {
    if (!RINGS[index]) return
    this.current = this.displayedRings()
    this.currentMouth = this.displayedMouth()
    this.target = RINGS[index]
    this.targetMouth = MOUTH_RINGS[index]
    this.expression = index
    this.morph = 0
    this.velocity = 0
  }

  blink(depth = 1) {
    this.blinker.fire(depth)
  }

  mount() {
    this.mountT = 0
    this.setExpression(13)
    this.morph = 1
    this.mountOpened = false
  }

  spin(turns = 1) {
    if (this.profile.turnMode !== 'sphere') return
    this.spinTurns = turns || 1
    this.spinT = 0
  }

  startTool(call, ms = 3600) {
    if (!this.profile.fx || !call) return
    this.tool = { ...call, t: 0, ms, done: false }
    if (!TOOL_STATES.includes(this.state)) this.setState('thinking')
    this.onTool?.(this.tool)
  }

  endTool() {
    if (!this.tool) return
    this.tool = null
    this.onTool?.(null)
  }

  // ── Simulation, fixed 120 Hz ──────────────────────────────────────────────

  fixed(dt, t) {
    this.clock += dt
    this.speech?.step(dt)
    const motion = this.motionNow()
    const v = this.variation
    const energy = this.reduced ? 0 : (v.energy || 1)

    // Expression morph spring.
    const w = this.stiffness
    this.velocity += (-2 * w * this.velocity - w * w * (this.morph - 1)) * dt
    this.morph = clamp(this.morph + this.velocity * dt, -0.3, 1.3)
    if (!Number.isFinite(this.morph)) {
      this.morph = 1
      this.velocity = 0
    }

    // Firing holds ONE hard expression. Cycling faces mid-stare would break it
    // completely — the whole effect is that nothing about the face is moving
    // except the beams.
    if (this.laser > 0.45) {
      if (this.expression !== LASER_POSTURE.expression) this.setExpression(LASER_POSTURE.expression)
    } else if (this.autoExpression && !this.reduced) {
      const cadence = EXPR_CADENCE[this.state]
      const pool = POOLS[this.state]
      if (cadence && pool && pool.length > 1) {
        this.exprTimer += dt
        if (!this.exprNext) this.exprNext = rand(cadence[0], cadence[1]) / 1000
        if (this.exprTimer > this.exprNext) {
          this.exprTimer = 0
          this.exprNext = rand(cadence[0], cadence[1]) / 1000
          const next = pool.filter((i) => i !== this.expression)
          this.setExpression(next[Math.floor(Math.random() * next.length)] ?? pool[0])
        }
      }
    }

    // Gaze. Pointer tracking is real smooth pursuit; everything else saccades.
    this.gaze.step(dt, motion.gaze * energy, this.autoMotion && !this.reduced ? motion.gazeRate : 0)
    if (this.gaze.takeBlink() && this.autoBlink) this.blinker.fire(1, 0.26)

    // Blink, on this face's own rate.
    // A person ALWAYS blinks, unless their eyes are actually shut. Several
    // states carry `null` in BLINK — right for a machine holding a scan, wrong
    // for a human being, who does not simply stop blinking because they are
    // uploading something. Only genuine sleep keeps the eyes closed.
    const eyesClosed = this.state === 'sleeping' || this.state === 'drowsy' || this.state === 'powering-down'
    let cadence = BLINK[this.state]
    if (!cadence && this.kind === 'customer' && !eyesClosed) cadence = [4000, 9000]
    // Two scalings: the kind (people blink far more than the robot the original
    // cadences were tuned for) and this individual's own rate.
    const rate = (v.blinkRate || 1) / (this.profile.blinkScale || 1)
    const scaled = cadence ? [cadence[0] / rate, cadence[1] / rate] : cadence
    this.blinker.step(dt, scaled, this.autoBlink && !this.reduced)
    this.petBlinker.step(dt, this.petAsleep() ? null : [1800, 5200], this.autoBlink && !this.reduced)

    // Breath and weight.
    this.breathPhase += dt / (motion.breatheMs / 1000)
    this.weight.step(dt, this.reduced ? 0 : 1)

    // Head turn — sway plus the gaze's own head follow, reached with lag.
    let want = this.manualTurn
    if (this.autoMotion && !this.reduced) {
      want +=
        (Math.sin((this.clock * 2 * Math.PI) / (motion.swayMs / 1000)) * motion.sway * this.profile.swayScale * Math.PI) /
          180 +
        this.gaze.headX * 0.5 * this.profile.swayScale
    }
    want = clamp(want, -this.profile.turnLimit, this.profile.turnLimit)
    // The head turns slowly and heavily while the beams are up — menace is a
    // matter of pace, and a fast head turn cannot carry it.
    const k = 6.5 + (LASER_POSTURE.turnStiffness - 6.5) * this.laser
    this.turnV += (-2 * k * this.turnV - k * k * (this.turn - want)) * dt
    this.turn += this.turnV * dt

    // Follow-through: an underdamped spring chasing the head's velocity. It
    // overshoots and settles, so a movement ends with a small sway instead of
    // stopping dead — the difference between a puppet and something with mass.
    const impulse = (this.turn - this.prevTurn) / Math.max(dt, 1e-4)
    this.prevTurn = this.turn
    const lk = 7.5
    const damping = 0.42 // deliberately low, so it wobbles
    this.headLagV += (-2 * damping * lk * this.headLagV - lk * lk * (this.headLag - impulse * 0.08)) * dt
    this.headLag = clamp(this.headLag + this.headLagV * dt, -1.2, 1.2)

    if (this.spinT < 1) this.spinT = Math.min(1, this.spinT + dt / (0.9 * Math.abs(this.spinTurns || 1)))
    if (this.mountT < 1) {
      this.mountT = Math.min(1, this.mountT + dt / 0.76)
      if (!this.mountOpened && this.mountT > 0.42) {
        this.mountOpened = true
        this.setExpression((POOLS[this.state] || [0])[0])
      }
    }

    // Tool call.
    if (this.tool) {
      this.tool.t += dt
      // Around three quarters of the way through, the call "returns" — the
      // result lands in the bubble and the face brightens before the glasses
      // come off, which is the order it happens in for a person too.
      if (!this.tool.done && this.tool.t * 1000 > this.tool.ms * 0.72) {
        this.tool.done = true
        this.setExpression(15)
        this.onTool?.(this.tool)
      }
      if (this.tool.t * 1000 >= this.tool.ms) this.endTool()
    }
    const wantTool = this.tool ? 1 : 0
    const tk = 9
    this.toolVel += (-2 * tk * this.toolVel - tk * tk * (this.toolLevel - wantTool)) * dt
    this.toolLevel = clamp(this.toolLevel + this.toolVel * dt, -0.2, 1.25)

    // Latch the glasses off for the WHOLE of a search, decay included.
    // Gating on "is searching right now" was not enough: the moment a search
    // call ended, isSearching() went false while the tool level was still near
    // one, so the glasses appeared for half a second and faded out — a pair of
    // glasses arriving exactly when the work finished.
    if (this.isSearching()) this.glassesLocked = true
    else if (this.toolLevel < 0.02) this.glassesLocked = false

    // Lasers charge while searching, and only for agents.
    const wantLaser = this.profile.fx && !this.reduced && this.isSearching() ? 1 : 0
    this.laser += (wantLaser - this.laser) * Math.min(1, dt * (wantLaser ? 4.5 : 6))

    // Aura intensity: idle simmer, thinking, tool call — but NOT during a
    // search. The beams are the whole statement there, and an orbiting ring
    // behind them just competes with it. The ring stays for every other call.
    const hot = this.tool ? 1 : TOOL_STATES.includes(this.state) ? 0.62 : this.state === 'idle' ? 0.16 : 0.26
    const target = hot * (1 - this.laser)
    this.auraIntensity += (target - this.auraIntensity) * Math.min(1, dt * 3)
  }

  // ── Drawing, once per real frame ──────────────────────────────────────────

  draw(t) {
    const prof = this.profile
    const v = this.variation
    const f = this.toolLevel > 0.5 && this.faceGlassed ? this.faceGlassed : this.face
    const motion = MOTION[this.state] || MOTION.idle
    const breath = this.reduced ? 0.5 : breathCurve(this.breathPhase)

    // ── Gaze in face units ────────────────────────────────────────────────
    const gx = clamp(this.gaze.relX + this.manualGaze.x, -1.2, 1.2)
    const gy = clamp(this.gaze.outY + this.manualGaze.y, -1.2, 1.2)
    const gazeX = gx * f.gazeXMax
    const gazeY = gy * f.gazeYMax

    // ── Turn, with the spin ridden on top ─────────────────────────────────
    let turn = this.turn
    if (this.spinT < 1) {
      const p = this.spinT
      // Anticipation: wind back a little before the throw.
      const anticipate = p < 0.16 ? -Math.sin((p / 0.16) * Math.PI) * 0.22 : 0
      const eased = p * p * (3 - 2 * p)
      turn += this.spinTurns * 2 * Math.PI * eased + anticipate
    }

    // ── Eyes ──────────────────────────────────────────────────────────────
    const blink = this.blinker.value()
    const baseScale = this.eyeScale * (this.emphasis ? 1.18 : 1)
    const rings = this.displayedRings()

    // Looking down closes the upper lid a little, looking up opens it. Eyelids
    // ride the eye in people; without this a downward glance looks like staring.
    const lidFollow = clamp(1 - gy * 0.22 - (v.lidBias || 0), 0.55, 1.25)

    for (let i = 0; i < rings.length; i++) {
      const slot = f.slots[i]
      const longitude = slot.baseLongitude + turn
      const depth = Math.cos(longitude)
      const perspective = Math.max(depth, 0.02) / Math.max(Math.cos(slot.baseLongitude), 0.02)

      let x
      let squeeze
      if (prof.turnMode === 'slide') {
        x = slot.x + f.radius * (Math.sin(longitude) - Math.sin(slot.baseLongitude)) * 0.45 + gazeX
        squeeze = 1
      } else {
        x = f.cx + f.radius * Math.sin(longitude) + gazeX
        squeeze = perspective
      }
      const y = slot.y + gazeY
      const gainW = slot.fitted ? 1 : prof.eyeW
      const gainH = slot.fitted ? 1 : prof.eyeH
      // Firing pulls the eyes down to small hard points — the emitter the beam
      // leaves from. Not shut, because a beam out of a closed eye reads as a
      // mistake; small and open, so you can see where it comes from.
      const aim = 1 - this.laser * 0.62
      const sx = clamp(squeeze * baseScale, 0.02, 2.4) * slot.halfW * gainW * aim
      const sy = clamp(blink * baseScale * lidFollow, 0.02, 2.4) * slot.halfH * gainH * (1 - this.laser * 0.72)
      const tilt = slot.tilt || 0

      const el = this.paths[i]
      el.setAttribute('d', toPath(rings[i]))
      el.setAttribute(
        'transform',
        `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${tilt.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`,
      )
      el.style.opacity = prof.turnMode === 'slide' || depth > 0.02 ? '1' : '0'
    }

    this.drawLaser(f, turn, gazeY)

    // ── Mouth ─────────────────────────────────────────────────────────────
    if (this.mouthPath) {
      const mo = f.mouth
      const longitude = mo.baseLongitude + turn
      const depth = Math.cos(longitude)
      const perspective = Math.max(depth, 0.02) / Math.max(Math.cos(mo.baseLongitude), 0.02)
      // Real audio wins over the idle talk oscillation. When speech is driving
      // the mouth, the expression's own shape is blended out in proportion to
      // how open the mouth is — so a smile survives quiet moments and the jaw
      // takes over on the loud ones.
      const speech = this.speech?.shape()
      const talk = TALK[this.state]
      let open
      let widen = 1
      if (speech && speech.blend > 0.01) {
        open = 1 + speech.open * 3.4
        widen = speech.w
      } else {
        open =
          this.autoMotion && talk && !this.reduced
            ? 1 + Math.abs(Math.sin((this.clock * 2 * Math.PI) / (talk[1] / 1000))) * talk[0] * 2.2
            : 1
      }
      const x =
        prof.turnMode === 'slide'
          ? mo.x + f.radius * (Math.sin(longitude) - Math.sin(mo.baseLongitude)) * 0.45 + gazeX * 0.3
          : f.cx + f.radius * Math.sin(longitude) + gazeX * 0.35
      const y = mo.y + gazeY * 0.3 + breath * 0.12
      this.mouthPath.setAttribute('d', toPath(this.displayedMouth()))
      this.mouthPath.setAttribute(
        'transform',
        `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${(clamp(prof.turnMode === 'slide' ? 1 : perspective, 0.02, 2.4) * mo.halfW * widen).toFixed(4)} ${(mo.halfH * open).toFixed(4)})`,
      )
      this.mouthPath.style.opacity = prof.turnMode === 'slide' || depth > 0.08 ? '1' : '0'
    }

    // ── Companion animal ──────────────────────────────────────────────────
    if (this.petEyes.length) {
      const s = this.petAsleep() ? 0.12 : this.petBlinker.value()
      for (const g of this.petEyes) {
        const cx = g.dataset.cx
        const cy = g.dataset.cy
        g.setAttribute('transform', `translate(${cx} ${cy}) scale(1 ${s.toFixed(4)}) translate(${-cx} ${-cy})`)
      }
    }

    // ── Head and figure ───────────────────────────────────────────────────
    const lean = this.weight.value * 0.9
    const chestRise = (breath - 0.5) * motion.breathe
    // Speaking moves more than the mouth. Loud syllables push the head with
    // them — the small emphatic nods people make on stressed words. Without
    // this a talking avatar is a moving mouth on a still head, which is most of
    // what makes cheap lip sync look cheap.
    const emphasis = this.speech?.voiced ? this.speech.level : 0
    const headBob =
      chestRise * 0.7 +
      Math.sin(this.clock * 1.9) * motion.nod * 0.35 -
      emphasis * 0.55

    // The head ROTATES on the neck. It used to slide sideways, which opened a
    // visible seam where it met the collar on every turn. Rotating about the
    // neck joint keeps that join closed and is what a neck actually does.
    // `lag` is the secondary motion — the head arrives a beat after the body,
    // which is what makes the whole figure feel like it has weight in it
    // rather than being one rigid piece.
    const neck = f.neck || { x: f.cx, y: f.cy + f.radius }
    const tiltDeg = (Math.sin(turn) * 9 + this.headLag * 5).toFixed(3)
    // Rotation about the neck joint, plus a small NOD. No sideways translate:
    // the neck is a fixed column now, so any lateral movement of the head just
    // slides the chin off it. Everything the head does is a pivot on that
    // joint, which is also what a neck actually allows.
    const headTransform =
      `rotate(${tiltDeg} ${neck.x.toFixed(2)} ${neck.y.toFixed(2)})` +
      ` translate(0 ${(headBob + chestRise * 0.5).toFixed(3)})`
    this.headShift?.setAttribute('transform', headTransform)
    this.faceShift?.setAttribute('transform', headTransform)
    // The neck STAYS PUT. It is the fixed column the head turns on top of —
    // moving it with the head just carried the seam along instead of closing
    // it. It only breathes, very slightly, with the chest.
    this.neckShift?.setAttribute(
      'transform',
      `translate(0 ${(chestRise * 0.25).toFixed(3)})`,
    )

    // Clothes breathe. The chest rises and widens a little; the shoulders lift
    // less than the middle does, so it reads as a torso and not as a balloon.
    if (this.bodyShift) {
      // Pivot at the NECK, not the waist. Scaling about the waist moved the
      // shoulders and the collar up and down under a head that was not moving
      // with them, which opened the join every breath. Pivoting here means the
      // top of the chest is the fixed point and the torso expands downward.
      // These were 0.05 / 0.018, which came to about half a percent of scale —
      // real, measurable, and completely invisible. Breathing you cannot see is
      // not breathing. The chest now rises about two percent and narrows very
      // slightly as it does, which reads without looking like a bellows.
      const sy = 1 + chestRise * 0.17
      const sx = 1 - chestRise * 0.05
      this.bodyShift.setAttribute(
        'transform',
        `translate(${(lean * 0.6).toFixed(3)} ${neck.y.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 ${(-neck.y).toFixed(2)})`,
      )
    }

    if (this.rootShift) {
      // Hop with squash and stretch: stretched going up, squashed on landing.
      const hopRaw =
        this.autoMotion && motion.bounce && !this.reduced
          ? Math.abs(Math.sin((this.clock * Math.PI) / (motion.bounceMs / 1000)))
          : 0
      const hop = -hopRaw * motion.bounce * f.separation
      const squash = 1 + hopRaw * motion.bounce * 0.22
      const chest = 1 + breath * 0.012

      const m = this.mountT
      const e = m >= 1 ? 1 : 1 - Math.pow(1 - m, 3)
      const arrive = m >= 1 ? 1 : 0.62 + 0.38 * e + Math.sin(m * Math.PI) * 0.05
      const rise = m >= 1 ? 0 : (1 - e) * 9

      const scaleX = arrive * (v.headScale || 1) * (2 - squash) * (2 - chest)
      const scaleY = arrive * (v.headScale || 1) * squash * chest
      const px = f.cx
      const py = f.cy + f.radius * 1.6
      this.rootShift.setAttribute(
        'transform',
        `translate(${(px + lean).toFixed(3)} ${(py + hop + rise).toFixed(3)}) scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)}) translate(${-px} ${-py})`,
      )
      if (m < 1) this.rootShift.style.opacity = String(Math.min(1, m * 3))
      else if (this.rootShift.style.opacity !== '') this.rootShift.style.opacity = ''

      // The contact shadow tightens as the figure leaves the ground.
      this.shadowEl?.setAttribute(
        'transform',
        `translate(${(lean * 0.4).toFixed(2)} 0) scale(${(1 - hopRaw * 0.22).toFixed(3)} ${(1 - hopRaw * 0.34).toFixed(3)})`,
      )
      if (this.shadowEl) this.shadowEl.style.transformOrigin = `${f.cx}px 83.5px`
    }

    if (prof.fx) {
      this.drawMood()
      this.drawFx(t)
    }
  }

  // ── Agent theatrics ───────────────────────────────────────────────────────

  /**
   * Mood colour. An agent's skin IS its signature colour, so the whole face can
   * flush with anger or drain while powering down — a channel a person-shaped
   * avatar does not have. Eased towards the target rather than switched, so a
   * state change is a mood settling, not a light flicking on.
   */
  /**
   * THE BLACK-SKIN BUG, for the record.
   *
   * `agentColors()` floors the signature colour into a readable range before
   * using it as skin. This function was then writing `--hm-skin` from the RAW
   * signature instead, so any dark brand colour came straight back — but only
   * in states that HAVE a mood entry, which is why it looked intermittent and
   * why three previous fixes to the palette never touched it. The mood now
   * starts from the floored colour and is floored again afterwards.
   */
  drawMood() {
    if (!this.root || !this.baseColor) return
    const want = SKIN_MOOD[this.state] || [0, 1, 1]
    const m = this.mood
    const k = 0.045
    m[0] += (want[0] - m[0]) * k
    m[1] += (want[1] - m[1]) * k
    m[2] += (want[2] - m[2]) * k
    const near = Math.abs(m[0]) < 0.4 && Math.abs(m[1] - 1) < 0.01 && Math.abs(m[2] - 1) < 0.01
    if (near) {
      if (this.moodSet) {
        this.root.style.removeProperty('--hm-skin')
        this.moodSet = false
      }
      return
    }
    this.root.style.setProperty('--hm-skin', readableSkin(shiftHsl(this.baseColor, m[0], m[1], m[2])))
    this.moodSet = true
  }

  drawFx(t) {
    if (this.toolGlasses) {
      // Searching fires the eyes instead of putting glasses on. Gated on the
      // SEARCH itself, not on the laser ramp — the two ramps run at different
      // speeds, so gating on the ramp let the glasses flash on and then fade
      // out again at the start of every search.
      const level = this.glassesLocked ? 0 : Math.max(0, this.toolLevel)
      this.toolGlasses.setAttribute('transform', `translate(0 ${(-16 * (1 - level)).toFixed(3)})`)
      this.toolGlasses.setAttribute('opacity', clamp(level * 1.4, 0, 1).toFixed(3))
    }

    // Wardrobe: while a tool runs, the agent tries outfit colours in discrete
    // steps — visibly SEARCHING, rather than smoothly sweeping, which just
    // looks like a rendering fault.
    if (this.root && this.baseClothes) {
      const heat = Math.max(0, this.toolLevel)
      if (heat < 0.02) {
        if (this.clothesSet !== null) {
          this.root.style.setProperty('--hm-clothes', this.baseClothes)
          this.clothesSet = null
        }
      } else {
        const step = Math.floor((this.clock * 1000) / WARDROBE_STEP_MS)
        if (step !== this.clothesSet) {
          this.clothesSet = step
          // A big irrational-ish stride so consecutive steps are never close.
          this.root.style.setProperty('--hm-clothes', rotateHue(this.baseClothes, ((step * 97) % 360) * heat))
        }
      }
    }

    // Aura: claim a shader surface only while there is something to show.
    if (!this.auraEnabled || this.reduced) {
      this.releaseAura()
      return
    }
    if (!this.auraSlot && this.auraIntensity > 0.1 && this.auraHost) {
      this.auraSlot = acquire(this)
      if (this.auraSlot) this.auraHost.prepend(this.auraSlot.canvas)
    }
    if (this.auraSlot) {
      const mode = this.tool ? 2 : TOOL_STATES.includes(this.state) ? 1 : 0
      this.auraSlot.draw(t, this.auraIntensity, hexToRgb(this.auraColor), mode)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  petAsleep() {
    return this.state === 'sleeping' || this.state === 'drowsy' || this.state === 'powering-down'
  }

  /**
   * The motion profile in force right now — the state's own, blended towards
   * the laser posture as the beams charge. Blending rather than switching is
   * what makes the avatar SETTLE into the stare instead of snapping into it.
   */
  motionNow() {
    const raw = MOTION[this.state] || MOTION.idle
    // Age slows the clock and takes a little off the amplitude. Breathing is
    // deliberately NOT reduced — an older person breathes as much, just slower.
    const pace = this.age?.pace ?? 1
    const base =
      pace === 1
        ? raw
        : {
            ...raw,
            breatheMs: raw.breatheMs / pace,
            swayMs: raw.swayMs / pace,
            nodMs: raw.nodMs / pace,
            sway: raw.sway * (0.6 + 0.4 * pace),
            nod: raw.nod * (0.6 + 0.4 * pace),
            gazeRate: (raw.gazeRate || 2000) / pace,
          }
    if (this.laser < 0.02) return base
    const k = this.laser
    const mix = (a, b) => a + (b - a) * k
    return {
      breathe: mix(base.breathe, LASER_POSTURE.breathe),
      breatheMs: mix(base.breatheMs, LASER_POSTURE.breatheMs),
      sway: mix(base.sway, LASER_POSTURE.sway),
      swayMs: mix(base.swayMs, LASER_POSTURE.swayMs),
      nod: mix(base.nod, LASER_POSTURE.nod),
      nodMs: mix(base.nodMs, LASER_POSTURE.nodMs),
      bounce: mix(base.bounce, LASER_POSTURE.bounce),
      bounceMs: mix(base.bounceMs || 1, LASER_POSTURE.bounceMs || 1),
      gaze: mix(base.gaze, LASER_POSTURE.gaze),
      gazeRate: mix(base.gazeRate || 2000, LASER_POSTURE.gazeRate),
    }
  }

  /** Searching, by state or by the name of the running tool. */
  isSearching() {
    if (this.state === 'searching' || this.state === 'radar') return true
    return !!this.tool && /search|find|lookup|scan|query/i.test(this.tool.name || '')
  }

  /**
   * Laser eyes.
   *
   * Two beams fired from the eye slots, in the direction the head is facing.
   * Built out of three stacked strokes — a wide soft glow, a mid body and a
   * white-hot core — because that layering is what makes a flat SVG line read
   * as light rather than as a coloured stick. The tips flare, and the whole
   * thing flickers on a fast noise so it never looks like a static wedge.
   */
  drawLaser(f, turn, gazeY) {
    if (!this.laserGroup) return
    if (this.laser < 0.01) {
      if (this.laserGroup.style.display !== 'none') this.laserGroup.style.display = 'none'
      return
    }
    this.laserGroup.style.display = ''

    // Flicker: two out-of-phase waves so it never settles into a pulse.
    const flick = 0.82 + Math.sin(this.clock * 47) * 0.1 + Math.sin(this.clock * 23.3) * 0.08
    const power = this.laser * flick

    // Fire where the FACE is pointing. The head is drawn in three-quarter view
    // looking left, so "forward" is the average of the two eyes' resting
    // longitudes plus whatever the head has turned — not straight out of the
    // screen, and definitely not upward.
    const facing = (f.slots[0].baseLongitude + f.slots[1].baseLongitude) / 2 + turn + this.gaze.outX * 0.3
    const dx = Math.sin(facing)
    // Level with the eyes, with a slow scan drifting the beam up and down. A
    // beam pinned exactly flat looks switched on; one that sweeps looks like it
    // is searching for something.
    const dy = Math.sin(this.clock * 0.55) * 0.13 + gazeY * 0.06

    for (let i = 0; i < 2; i++) {
      const slot = f.slots[i]
      const ox = f.cx + f.radius * Math.sin(slot.baseLongitude + turn)
      const oy = slot.y + gazeY
      // Stop just inside the frame rather than running off into nowhere: the
      // beam should reach the edge of the avatar's box and end there.
      const len = rayToBox(ox, oy, dx, dy) * 0.96 * this.laser
      const ex = ox + dx * len
      const ey = oy + dy * len
      for (let layer = 0; layer < 3; layer++) {
        const el = this.laserEls[i * 3 + layer]
        el.setAttribute('x1', ox.toFixed(2))
        el.setAttribute('y1', oy.toFixed(2))
        el.setAttribute('x2', ex.toFixed(2))
        el.setAttribute('y2', ey.toFixed(2))
        el.setAttribute('stroke-opacity', (power * [0.26, 0.55, 0.95][layer]).toFixed(3))
        el.setAttribute('stroke-width', ([3.0, 1.35, 0.55][layer] * this.laser).toFixed(2))
      }
    }
  }

  displayedRings() {
    const t = clamp(this.morph, 0, 1)
    return this.current.map((ring, eye) =>
      ring.map((p, i) => [lerp(p[0], this.target[eye][i][0], t), lerp(p[1], this.target[eye][i][1], t)]),
    )
  }

  displayedMouth() {
    const t = clamp(this.morph, 0, 1)
    return this.currentMouth.map((p, i) => [
      lerp(p[0], this.targetMouth[i][0], t),
      lerp(p[1], this.targetMouth[i][1], t),
    ])
  }
}

/**
 * Distance from (ox, oy) along (dx, dy) to the edge of the avatar's 88-unit
 * viewBox. Slab method: the nearest positive crossing of each pair of walls.
 */
function rayToBox(ox, oy, dx, dy) {
  const X0 = -4
  const Y0 = -4.5
  const X1 = 84
  const Y1 = 83.5
  let best = Infinity
  if (Math.abs(dx) > 1e-6) {
    const tx = dx > 0 ? (X1 - ox) / dx : (X0 - ox) / dx
    if (tx > 0) best = Math.min(best, tx)
  }
  if (Math.abs(dy) > 1e-6) {
    const ty = dy > 0 ? (Y1 - oy) / dy : (Y0 - oy) / dy
    if (ty > 0) best = Math.min(best, ty)
  }
  return Number.isFinite(best) ? best : 0
}

/** Hue rotate plus saturation and lightness scaling, in one pass. */
function shiftHsl(hex, deg, satMul = 1, lightMul = 1) {
  return rotateHue(hex, deg, satMul, lightMul)
}

/** Walk a hex colour around the hue wheel by `deg`, keeping S and L. */
function rotateHue(hex, deg, satMul = 1, lightMul = 1) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  let l = (mx + mn) / 2
  const d = mx - mn
  let h = 0
  if (d !== 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6)
    else if (mx === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  h = (((h + deg) % 360) + 360) % 360
  s = clamp(s * satMul, 0, 1)
  l = clamp(l * lightMul, 0.04, 0.96)
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = l - c / 2
  const tr = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const to = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0')
  return `#${to(tr[0])}${to(tr[1])}${to(tr[2])}`
}

/** 48 points → an SVG path. The ring is closed, so shapes never leak. */
function toPath(ring) {
  let d = 'M'
  for (let i = 0; i < ring.length; i++) {
    d += `${ring[i][0].toFixed(3)} ${ring[i][1].toFixed(3)}${i < ring.length - 1 ? 'L' : ''}`
  }
  return d + 'Z'
}
