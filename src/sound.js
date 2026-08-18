// ---------------------------------------------------------------------------
// sound.js — one tap when a face is made.
//
// The tap is an "exotic tap" exported from https://procedural-sounds.vercel.app
// (MIT). Two things came from there and neither is edited: `playSound`, their
// ~4 kB player, and `EXOTIC_TAP`, the recipe it plays. Nothing is downloaded at
// runtime — the sound is synthesised in the browser from the numbers below.
//
// Everything this file adds is around the edges: a master volume, a floor on
// how often the tap may fire, and the fact that a browser will not let any of
// it make a noise until the visitor has clicked something.
// ---------------------------------------------------------------------------

/** How loud, against the recipe's own level. */
export const VOLUME = 0.2

/** The exported recipe, verbatim. */
const EXOTIC_TAP = {
  source: { type: 'sine', frequency: 660, fm: { ratio: 2.76, depth: 180 } },
  envelope: { attack: 0, decay: 0.2, sustain: 0, release: 0.08, curve: 'ramp' },
  effects: [{ type: 'reverb', decay: 0.4, damping: 0.6, mix: 0.08 }],
  gain: 0.147,
}

// --- procedural-sounds player, MIT, unmodified ------------------------------
function playSound(patch, context) {
  const ctx = context || playSound.ctx || (playSound.ctx = new (window.AudioContext || window.webkitAudioContext)());
  if (ctx.state === "suspended") ctx.resume();
  const S = 0.0001;
  const t0 = ctx.currentTime;

  function noiseBuffer(seconds, color) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (color === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else if (color === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function reverb(o) {
    const decay = o.decay == null ? 0.5 : o.decay;
    const mix = o.mix == null ? 0.3 : o.mix;
    const damping = o.damping == null ? 0 : o.damping;
    const input = ctx.createGain(), output = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 1 - mix;
    input.connect(dry); dry.connect(output);
    const wet = ctx.createGain(); wet.gain.value = mix; input.connect(wet);
    const wetOut = ctx.createGain(); wetOut.connect(output);
    const len = Math.ceil(ctx.sampleRate * decay * (o.roomSize == null ? 1 : o.roomSize));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
      if (damping > 0) {
        const c = Math.min(damping, 0.99);
        let prev = 0;
        for (let i = 0; i < len; i++) { prev = d[i] * (1 - c) + prev * c; d[i] = prev; }
      }
    }
    const conv = ctx.createConvolver(); conv.buffer = buf;
    const pre = o.preDelay == null ? 0 : o.preDelay;
    if (pre > 0) {
      const pd = ctx.createDelay(Math.max(pre + 0.01, 1));
      pd.delayTime.value = pre;
      wet.connect(pd); pd.connect(conv);
    } else {
      wet.connect(conv);
    }
    conv.connect(wetOut);
    return { input: input, output: output };
  }

  function shimmer(o) {
    const input = ctx.createGain(), output = ctx.createGain();
    input.connect(output);
    const delay = ctx.createDelay(1); delay.delayTime.value = o.delay;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.lowpass == null ? 4000 : o.lowpass;
    const fb = ctx.createGain(); fb.gain.value = o.feedback;
    const wet = ctx.createGain(); wet.gain.value = o.wet;
    input.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
    lp.connect(wet); wet.connect(output);
    return { input: input, output: output };
  }

  for (const layer of (patch.layers || [patch])) {
    const t = t0 + (layer.delay || 0);
    const gain = layer.gain == null ? 0.5 : layer.gain;
    const env = layer.envelope;
    const a = env ? env.attack || 0 : 0;
    const d = env ? env.decay : 0;
    const sus = env ? env.sustain || 0 : 0;
    const rel = env ? env.release || 0 : 0;
    const dur = env ? a + d + rel : 0.5;

    const g = ctx.createGain();
    if (!env) {
      g.gain.setValueAtTime(gain, t);
      g.gain.setTargetAtTime(S, t, 0.15);
    } else if (env.curve === "ramp") {
      const peak = Math.max(gain, S);
      g.gain.setValueAtTime(S, t);
      if (a > 0) g.gain.exponentialRampToValueAtTime(peak, t + a);
      else g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(S, t + a + d);
    } else {
      g.gain.setValueAtTime(S, t);
      if (a > 0) g.gain.linearRampToValueAtTime(gain, t + a);
      else g.gain.setValueAtTime(gain, t);
      if (sus > 0) {
        g.gain.setTargetAtTime(Math.max(sus * gain, S), t + a, d / 3);
        if (rel > 0) g.gain.setTargetAtTime(S, t + a + d, rel / 3);
      } else {
        g.gain.setTargetAtTime(S, t + a, d / 3);
      }
    }

    let src;
    const s = layer.source;
    if (s.type === "noise") {
      src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur + 0.1, s.color);
    } else {
      src = ctx.createOscillator();
      src.type = s.type;
      const f = s.frequency;
      if (typeof f === "number") {
        src.frequency.setValueAtTime(f, t);
      } else {
        src.frequency.setValueAtTime(f.start, t);
        src.frequency.exponentialRampToValueAtTime(Math.max(f.end, 1), t + Math.min(f.time == null ? dur : f.time, dur));
      }
      if (s.detune) src.detune.value = s.detune;
      if (s.fm) {
        const carrier = typeof f === "number" ? f : f.start;
        const mod = ctx.createOscillator();
        mod.type = "sine";
        mod.frequency.value = carrier * s.fm.ratio;
        const mg = ctx.createGain();
        mg.gain.value = s.fm.depth;
        mod.connect(mg); mg.connect(src.frequency);
        mod.start(t); mod.stop(t + dur + 0.1);
      }
    }
    src.start(t); src.stop(t + dur + 0.1);

    let node = src;
    const filters = !layer.filter ? [] : (Array.isArray(layer.filter) ? layer.filter : [layer.filter]);
    for (const f of filters) {
      const bq = ctx.createBiquadFilter();
      bq.type = f.type;
      bq.frequency.setValueAtTime(f.frequency, t);
      bq.Q.value = f.Q == null ? (f.resonance == null ? 1 : f.resonance) : f.Q;
      if (f.envelope) {
        const peakAt = t + (f.envelope.attack || 0);
        bq.frequency.linearRampToValueAtTime(f.envelope.peak, peakAt);
        bq.frequency.exponentialRampToValueAtTime(Math.max(f.frequency, 1), peakAt + f.envelope.decay);
      }
      node.connect(bq); node = bq;
    }
    node.connect(g);

    let out = g;
    for (const fx of (layer.effects || [])) {
      const built = fx.type === "reverb" ? reverb(fx) : fx.type === "delay" ? shimmer(fx) : null;
      if (!built) continue;
      out.connect(built.input); out = built.output;
    }
    out.connect(ctx.destination);
  }
}// --- end of the vendored player ---------------------------------------------

// A browser refuses to make a sound until the visitor has interacted with the
// page, so the audio context is only built on the first click or key. Before
// that `tap()` does nothing at all, which is correct rather than broken.
let ctx = null
let master = null
let armed = false
let muted = false
let last = 0

/** Smallest gap between two taps, in ms. Faces arrive faster than that. */
const FLOOR = 90

function arm() {
  if (ctx) return
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = VOLUME
  master.connect(ctx.destination)
}

/** Turn sound on. Must be called from a real click or key press. */
export function enableSound() {
  arm()
  if (!ctx) return false
  if (ctx.state === 'suspended') ctx.resume()
  armed = true
  muted = false
  return true
}

export function disableSound() {
  muted = true
  armed = false
}

export function soundOn() {
  return armed
}

/**
 * The node every tap passes through, and the context it lives in.
 *
 * Exposed so a host page can route the sound somewhere else, and so the
 * volume can be checked rather than assumed.
 */
export function output() {
  return { context: ctx, node: master, volume: master ? master.gain.value : null, state: ctx ? ctx.state : 'none' }
}

// A browser will not start audio without a gesture, but it does not care WHICH
// gesture. The first click or key anywhere on the page is enough, so sound
// starts by itself the moment somebody touches the page — no hunting for a
// button. Pressing the button off sets `muted`, and that decision sticks.
function firstGesture() {
  if (!muted) enableSound()
  onArmed?.()
}
for (const type of ['pointerdown', 'keydown', 'touchstart']) {
  addEventListener(type, firstGesture, { once: false, passive: true })
}

/** Called after the first gesture, so the page can update its own button. */
let onArmed = null
export function whenArmed(fn) {
  onArmed = fn
  // Some browsers hand out a running context before any gesture at all.
  if (ctx && ctx.state === 'running') fn()
}

/** One tap. Silent until enabled, and never more often than FLOOR. */
export function tap() {
  if (!armed || !ctx || document.hidden) return
  const now = performance.now()
  if (now - last < FLOOR) return
  last = now
  // The player writes to `ctx.destination`; the master gain is spliced in by
  // handing it a context whose destination IS the master gain.
  playSound(EXOTIC_TAP, audioProxy)
}

// A thin stand-in for the context: everything the player touches passes
// through, except `destination`, which becomes the volume control. Wrapping is
// the only way to set a master level without editing the vendored player.
const audioProxy = new Proxy(
  {},
  {
    get(_, key) {
      if (key === 'destination') return master
      const value = ctx[key]
      return typeof value === 'function' ? value.bind(ctx) : value
    },
  },
)
