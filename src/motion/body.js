// ---------------------------------------------------------------------------
// Body — breathing, weight shift, and the blink that is not a metronome.
//
// A sine wave is the wrong shape for every one of these. Breath is asymmetric:
// the inhale is quick, the exhale is longer, and there is a pause at the bottom.
// Weight shift is slower than breath and unrelated to it. Blinks come in
// singles, doubles and half-lidded flutters, and the intervals between them are
// clustered, not uniform.
//
// Each of these is a few lines, and together they are most of the difference
// between an avatar that loops and one you stop noticing is animated.
// ---------------------------------------------------------------------------

const rand = (lo, hi) => lo + Math.random() * (hi - lo)

/**
 * Breath, as a 0..1 curve over one cycle.
 *
 *   0.00–0.34  inhale   — quick, eased out at the top of the lungs
 *   0.34–0.42  hold     — the small catch at full
 *   0.42–0.86  exhale   — slower than the inhale
 *   0.86–1.00  pause    — empty, before the next breath
 */
export function breathCurve(p) {
  const t = p - Math.floor(p)
  if (t < 0.34) {
    const u = t / 0.34
    return 1 - Math.pow(1 - u, 2.2)
  }
  if (t < 0.42) return 1
  if (t < 0.86) {
    const u = (t - 0.42) / 0.44
    return 1 - (u * u * (3 - 2 * u))
  }
  return 0
}

/**
 * Blinks.
 *
 * Real blink intervals are clustered — a run of quick ones, then a long gap —
 * so the gap is drawn from a mixture rather than a flat range. Roughly one in
 * eight is a double, and one in six is a half-blink that never fully closes,
 * which is what stops a face looking like it is signalling every time.
 */
export class Blinker {
  constructor() {
    this.start = null
    this.duration = 0.32
    this.depth = 1
    this.next = 0
    this.queued = 0
    this.t = 0
  }

  schedule(cadence) {
    if (!cadence) {
      this.next = Infinity
      return
    }
    const [lo, hi] = cadence
    // Two thirds of the time the next blink comes early in the window; the rest
    // of the time it takes the long tail. That clustering is what reads as real.
    const quick = Math.random() < 0.66
    const ms = quick ? rand(lo * 0.45, lo * 1.1) : rand(lo, hi)
    this.next = this.t + ms / 1000
  }

  /** Blink now. `depth` 1 = full close, lower = a half-lidded flicker. */
  fire(depth = 1, duration = 0.32) {
    this.start = this.t
    this.depth = depth
    this.duration = duration
  }

  step(dt, cadence, auto) {
    this.t += dt
    if (!auto) return
    if (this.next === 0) this.schedule(cadence)
    if (this.t >= this.next) {
      const roll = Math.random()
      if (roll < 0.14) {
        this.fire(1, 0.28)
        this.queued = 1 // a double blink: one more, right behind it
      } else if (roll < 0.3) {
        this.fire(0.55, 0.24) // half blink
      } else {
        this.fire(1, rand(0.28, 0.38))
      }
      this.schedule(cadence)
    }
    if (this.queued && this.start !== null && this.t - this.start > this.duration) {
      this.queued--
      this.fire(1, 0.26)
    }
  }

  /**
   * Lid opening, 1 = wide, 0 = shut. Closing is faster than opening — the
   * 42/58 split measured in the original engine, kept because it is right.
   */
  value() {
    if (this.start === null) return 1
    const p = (this.t - this.start) / this.duration
    if (p >= 1) {
      this.start = null
      return 1
    }
    const shape = p < 0.42 ? 1 - p / 0.42 : (p - 0.42) / 0.58
    return 1 - (1 - Math.max(shape, 0.02)) * this.depth
  }
}

/**
 * Weight shift — the very slow lateral lean people do when standing.
 *
 * Much slower than breath, and on its own clock, so the two never line up into
 * a single obvious loop. Returns −1..1.
 */
export class WeightShift {
  constructor() {
    this.value = 0
    this.v = 0
    this.target = 0
    this.next = rand(3, 7)
    this.t = 0
  }

  step(dt, amount) {
    this.t += dt
    if (this.t > this.next) {
      this.next = this.t + rand(4, 11)
      this.target = rand(-1, 1) * amount
    }
    const k = 1.6
    this.v += (-2 * k * this.v - k * k * (this.value - this.target)) * dt
    this.value += this.v * dt
  }
}
