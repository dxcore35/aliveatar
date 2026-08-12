// ---------------------------------------------------------------------------
// Gaze — the single biggest thing that separates "animated" from "alive".
//
// The original engine springs the eyes smoothly towards wherever you point.
// Real eyes do not do that. They are still, then they JUMP, then they are still
// again. A saccade takes 30–80 ms and reaches 400°/s; between saccades the eye
// holds a fixation and only trembles. Smoothly gliding eyes read as a puppet,
// and it is uncanny in a way most people feel without being able to name.
//
// This models the real thing:
//
//   fixation   200–700 ms holding a target, with microsaccades and slow drift
//   saccade    a fast ballistic jump, duration scaling with distance
//   pursuit    smooth ONLY when following something that is actually moving
//              (the pointer) — which is the one case where eyes really do glide
//   coupling   a large gaze shift pulls the head after it, and the eyes then
//              roll back towards centre as the head arrives (vestibulo-ocular)
//   blink link a blink rides along with big saccades, as it does in people
// ---------------------------------------------------------------------------

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export class Gaze {
  constructor() {
    // Where the eye is, and where it is going, in normalised −1..1 face units.
    this.x = 0
    this.y = 0
    this.fromX = 0
    this.fromY = 0
    this.toX = 0
    this.toY = 0

    this.phase = 'fixate'
    this.t = 0 // seconds inside the current phase
    this.hold = 0.6 // how long this fixation lasts
    this.duration = 0.05 // how long this saccade lasts

    // Microsaccade + drift, added on top of the fixation point.
    this.microX = 0
    this.microY = 0
    this.microNext = 0
    this.driftX = 0
    this.driftY = 0
    this.driftPhase = rand(0, 6.283)

    // Head follow — the head lags the eyes and then the eyes come back.
    this.headX = 0
    this.headV = 0

    /** Set by the engine when a saccade should trigger a blink. */
    this.blinkRequest = false
    /** A pointer target, when the avatar is tracking the mouse. */
    this.pursuit = null
  }

  /** Aim somewhere new. Large moves take longer, exactly as real saccades do. */
  saccadeTo(x, y) {
    this.fromX = this.x
    this.fromY = this.y
    this.toX = clamp(x, -1, 1)
    this.toY = clamp(y, -1, 1)
    const amp = Math.hypot(this.toX - this.fromX, this.toY - this.fromY)
    if (amp < 0.02) return
    // Main-sequence relationship: ~25 ms base plus ~45 ms per unit of amplitude.
    this.duration = 0.025 + amp * 0.045
    this.phase = 'saccade'
    this.t = 0
    // People blink through big gaze shifts far more often than at rest.
    if (amp > 0.55 && Math.random() < 0.35) this.blinkRequest = true
  }

  /**
   * @param {number} dt      fixed timestep
   * @param {number} range   0..1, how far this state lets the eyes roam
   * @param {number} rateMs  average milliseconds between fixations
   */
  step(dt, range, rateMs) {
    // Following the pointer is genuine smooth pursuit — the one case where a
    // spring is the right model, because the target is really moving.
    if (this.pursuit) {
      const k = 14
      this.x += (this.pursuit.x - this.x) * Math.min(1, k * dt)
      this.y += (this.pursuit.y - this.y) * Math.min(1, k * dt)
      this.stepHead(dt, this.x)
      return
    }

    this.t += dt

    if (this.phase === 'saccade') {
      const p = clamp(this.t / this.duration, 0, 1)
      // Ballistic: fast out of the gate, hard stop. Not an ease-in-out.
      const e = p < 1 ? 1 - Math.pow(1 - p, 2.6) : 1
      this.x = this.fromX + (this.toX - this.fromX) * e
      this.y = this.fromY + (this.toY - this.fromY) * e
      if (p >= 1) {
        this.phase = 'fixate'
        this.t = 0
        this.hold = rateMs ? rand(rateMs * 0.45, rateMs * 1.35) / 1000 : 1e9
        this.microNext = rand(0.18, 0.62)
      }
    } else {
      // Fixation. The eye is nominally still, and never actually still.
      if (this.t > this.microNext) {
        this.microNext = this.t + rand(0.2, 0.75)
        this.microX = rand(-1, 1) * 0.022
        this.microY = rand(-1, 1) * 0.016
      }
      this.driftPhase += dt * 0.9
      this.driftX = Math.sin(this.driftPhase) * 0.012
      this.driftY = Math.cos(this.driftPhase * 0.73) * 0.009
      this.x += (this.toX - this.x) * Math.min(1, 8 * dt)
      this.y += (this.toY - this.y) * Math.min(1, 8 * dt)

      if (rateMs && this.t > this.hold) {
        // Real gaze is not uniformly distributed: it returns to centre often,
        // and it favours horizontal moves over vertical ones.
        const centreBias = Math.random() < 0.34
        const nx = centreBias ? rand(-0.15, 0.15) : rand(-1, 1) * range
        const ny = centreBias ? rand(-0.1, 0.1) : rand(-1, 1) * range * 0.62
        this.saccadeTo(nx, ny)
      }
    }

    this.stepHead(dt, this.toX)
  }

  /**
   * The head chases the gaze, and lags it. That lag is what makes a look read
   * as intentional rather than as two eyes sliding in a mask.
   */
  stepHead(dt, target) {
    const want = target * 0.42
    const k = 5.5
    this.headV += (-2 * k * this.headV - k * k * (this.headX - want)) * dt
    this.headX += this.headV * dt
  }

  /** Eye position to render: fixation point plus the tremor that is always on. */
  get outX() {
    return clamp(this.x + this.microX + this.driftX, -1.15, 1.15)
  }

  get outY() {
    return clamp(this.y + this.microY + this.driftY, -1.15, 1.15)
  }

  /**
   * How far the eyes sit from the head's own direction. As the head catches up
   * with a look, the eyes roll back towards centre — so a big glance ends with
   * the head turned and the eyes relaxed, not straining sideways forever.
   */
  get relX() {
    return this.outX - this.headX * 0.72
  }

  takeBlink() {
    const b = this.blinkRequest
    this.blinkRequest = false
    return b
  }
}
