// ---------------------------------------------------------------------------
// DemoDirector — drives an avatar through a scripted run, hands-free.
//
// A state on its own already animates, but a still viewer never sees the range:
// the turn, the blink, the spin, the swing from sleeping to laughing. The
// director plays that range on a loop and reports what it is doing, so the
// prototype demonstrates itself.
// ---------------------------------------------------------------------------

/**
 * Each beat: a state to sit in, how long, and an optional flourish.
 *   turn   sweep the head to this angle (degrees) and back over the beat
 *   act    'blink' | 'spin' | 'remount'
 */
import { TOOL_SCRIPTS } from './states.js'

export const SCRIPT = [
  { state: 'sleeping', ms: 2800, note: 'asleep — no blinking, slow deep breathing, the pet naps too' },
  { state: 'waking', ms: 1500, note: 'waking up' },
  { state: 'idle', ms: 3400, note: 'idle — watch the eyes: they hold, then JUMP. Never a glide.', act: 'blink' },
  { state: 'listening', ms: 3000, note: 'listening — small nods, steady gaze, the head lags the eyes' },
  { state: 'thinking', ms: 3200, note: 'thinking — gaze up and away, and the aura starts to turn over' },
  { state: 'working', ms: 5000, note: 'running a tool — glasses on, bubble out, the outfit runs hot', act: 'tool' },
  { state: 'searching', ms: 3000, note: 'searching — fast saccades, one every few hundred milliseconds', turn: 46 },
  { state: 'confused', ms: 2400, note: 'confused — one eye open wider than the other' },
  { state: 'happy', ms: 2200, note: 'happy' },
  { state: 'laughing', ms: 2400, note: 'laughing — squash and stretch, and the mouth talks' },
  { state: 'excited', ms: 2800, note: 'excited — bouncing, and the shadow tightens as the feet leave the ground', act: 'spin' },
  { state: 'surprised', ms: 1800, note: 'surprised' },
  { state: 'suspicious', ms: 2600, note: 'suspicious — narrowed, tilted eyes', turn: -34 },
  { state: 'uploading', ms: 2600, note: 'uploading' },
  { state: 'alerting', ms: 2200, note: 'alerting' },
  { state: 'powering-down', ms: 2800, note: 'powering down, then arriving again', act: 'remount' },
]

/**
 * The cast the shuffled demo draws from.
 *
 * One avatar cycling through 16 states shows the STATES but hides the range —
 * you cannot tell whether the variety is real or whether it is the same face
 * every time. Swapping the person out as the demo runs is the only way to see
 * that the hair, the outfit, the face proportions and the colours genuinely
 * differ from seed to seed.
 */
export const CAST = [
  { seed: 'agent:reception-01', kind: 'agent', color: '#3B82F6' },
  { seed: 'agent:triage-02', kind: 'agent', color: '#16A34A' },
  { seed: 'agent:booking-03', kind: 'agent', color: '#9333EA' },
  { seed: 'agent:sales-04', kind: 'agent', color: '#E36F3D' },
  { seed: 'agent:night-05', kind: 'agent', color: '#0E7490' },
  { seed: 'agent:alarm-06', kind: 'agent', color: '#BE185D' },
  { seed: 'agent:lab-07', kind: 'agent', color: '#EAB308' },
  { seed: 'agent:ops-08', kind: 'agent', color: '#14B8A6' },
  { seed: 'customer:1042', kind: 'customer' },
  { seed: 'customer:2277', kind: 'customer' },
  { seed: 'customer:3391', kind: 'customer' },
  { seed: 'customer:4810', kind: 'customer' },
  { seed: 'customer:5523', kind: 'customer' },
  { seed: 'customer:6634', kind: 'customer' },
]

export class DemoDirector {
  /**
   * @param {object} avatar    an <avatar-motion> element
   * @param {(beat, index) => void} [onBeat]  called when each beat starts
   * @param {object} [opts]    { shuffle: boolean } — swap the person per beat
   */
  constructor(avatar, onBeat, opts = {}) {
    this.avatar = avatar
    this.onBeat = onBeat
    this.shuffle = opts.shuffle !== false
    this.index = -1
    this.castIndex = -1
    this.timer = null
    this.raf = null
  }

  start() {
    if (this.timer || this.raf) this.stop()
    this.index = -1
    this.next()
  }

  stop() {
    clearTimeout(this.timer)
    cancelAnimationFrame(this.raf)
    this.timer = null
    this.raf = null
    const e = this.avatar.engine
    if (e) e.manualTurn = 0
  }

  next() {
    this.index = (this.index + 1) % SCRIPT.length
    const beat = SCRIPT[this.index]

    // A new person every other beat. Stepping by 5 through a 14-strong cast
    // means you see agents and people interleaved rather than in runs, and the
    // whole cast appears before anyone repeats.
    if (this.shuffle && this.index % 2 === 0) {
      this.castIndex = (this.castIndex + 5) % CAST.length
      const who = CAST[this.castIndex]
      this.avatar.setAttribute('seed', who.seed)
      this.avatar.setAttribute('kind', who.kind)
      if (who.color) this.avatar.setAttribute('color', who.color)
      // The element rebuilds itself on those attributes, so the engine below is
      // a NEW one — read it after, never before.
    }

    const e = this.avatar.engine
    if (!e) return

    this.avatar.setState(beat.state)
    this.onBeat?.({ ...beat, who: CAST[this.castIndex] }, this.index)

    if (beat.act === 'blink') setTimeout(() => this.avatar.blink(), 700)
    if (beat.act === 'spin') setTimeout(() => this.avatar.spin(1), 600)
    if (beat.act === 'remount') setTimeout(() => e.mount(), beat.ms - 700)
    if (beat.act === 'tool') {
      this.tool = ((this.tool || 0) + 1) % TOOL_SCRIPTS.length
      setTimeout(() => this.avatar.runTool(TOOL_SCRIPTS[this.tool], beat.ms - 900), 300)
    }

    // Head sweep: out and back across the beat, so the turn is shown rather
    // than just available.
    const started = performance.now()
    const sweep = (beat.turn || 0) * (Math.PI / 180)
    const tick = (now) => {
      const p = Math.min(1, (now - started) / beat.ms)
      e.manualTurn = sweep * Math.sin(p * Math.PI)
      if (p < 1) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)

    this.timer = setTimeout(() => this.next(), beat.ms)
  }
}
