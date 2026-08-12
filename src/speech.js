// ---------------------------------------------------------------------------
// Speech — the mouth driven by the audio the agent is actually producing.
//
// This is the part that matters for a voice agent. A mouth flapping on a timer
// desynchronises from the voice within a sentence and the whole illusion goes;
// a mouth driven by the real waveform stays locked to it forever, for free, in
// any language, with no phoneme model and no alignment step.
//
// HOW IT READS SHAPE FROM SOUND
//
// Full viseme recognition needs a phoneme aligner. But you do not need to know
// WHICH vowel is being said to draw a convincing mouth — you need how OPEN it
// is and how WIDE. Two cheap numbers off an FFT give both:
//
//   loudness         → how far the jaw drops.
//   spectral centroid → where the energy sits in the spectrum. Open back
//                       vowels ("aa", "oh") put their energy low; front vowels
//                       and sibilants ("ee", "s") put it high. Low centroid →
//                       round and open; high centroid → wide and flat.
//
// That maps onto the mouth's own two parameters — `open` and `w` — and lands
// close enough that people read it as lip sync.
//
// Consonant closures matter as much as the vowels: real speech snaps shut on
// every p, b and m, and a mouth that never fully closes looks like a puppet. A
// fast drop in loudness closes it hard, and the release is slower than the
// closure, which is how a mouth actually moves.
//
// Sources it accepts: a MediaStream (LiveKit / WebRTC track), an
// HTMLAudioElement, an AudioBuffer source node, or nothing at all — call
// `pushLevel()` yourself if the audio lives somewhere this cannot reach, such
// as another process or a server-side TTS meter.
// ---------------------------------------------------------------------------

const FFT = 512

export class SpeechEngine {
  constructor() {
    this.ctx = null
    this.analyser = null
    this.source = null
    this.freq = null
    this.time = null

    /** 0..1 — how far the mouth is open right now. */
    this.open = 0
    /** 0..1 — 0 is round and pursed, 1 is wide and flat. */
    this.wide = 0.5
    /** 0..1 — smoothed loudness, used for emphasis elsewhere. */
    this.level = 0
    /** True while there is voice; false in the gaps between phrases. */
    this.voiced = false

    this.openV = 0
    this.silence = 0
    this.since = 0
    this.externalLevel = null
    this.onPhrase = null
  }

  // ── Sources ───────────────────────────────────────────────────────────────

  /** Attach a live microphone or WebRTC track. */
  attachStream(stream) {
    this.ensureContext()
    this.detachSource()
    this.source = this.ctx.createMediaStreamSource(stream)
    this.source.connect(this.analyser)
    return this
  }

  /**
   * Attach an <audio> element. It is also routed to the speakers, because a
   * MediaElementSource silences the element the moment you tap it — an easy
   * way to end up with a perfectly animated mouth and no sound.
   */
  attachElement(el) {
    this.ensureContext()
    this.detachSource()
    this.source = this.ctx.createMediaElementSource(el)
    this.source.connect(this.analyser)
    this.source.connect(this.ctx.destination)
    return this
  }

  /**
   * Attach any Web Audio node you already have.
   *
   * Nodes cannot cross AudioContexts, and an app that already has an audio
   * graph will be handing us a node from ITS context — so we adopt that context
   * rather than making the caller rebuild their graph in ours. A MediaStream
   * has no such problem, which is why `attachStream` is the easier path and the
   * one a LiveKit track takes.
   */
  attachNode(node) {
    if (!this.ctx) this.adoptContext(node.context)
    else if (this.ctx !== node.context) {
      throw new Error(
        'that node belongs to a different AudioContext — pass its MediaStream instead, or create the node in avatar.speech.ctx',
      )
    }
    this.detachSource()
    this.source = node
    node.connect(this.analyser)
    return this
  }

  /** Build our analyser inside someone else's AudioContext. */
  adoptContext(ctx) {
    this.ctx = ctx
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = FFT
    this.analyser.smoothingTimeConstant = 0.55
    this.freq = new Uint8Array(this.analyser.frequencyBinCount)
    this.time = new Uint8Array(this.analyser.fftSize)
  }

  /**
   * Drive the mouth from outside, when the audio is not reachable from here —
   * a server-side TTS meter, a native player, another worker.
   *
   * @param {number} level  0..1 loudness
   * @param {number} [tone] 0..1 brightness; 0.5 when you do not know
   */
  pushLevel(level, tone = 0.5) {
    this.externalLevel = { level: Math.max(0, Math.min(1, level)), tone }
  }

  ensureContext() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    this.adoptContext(new Ctx())
  }

  detachSource() {
    try {
      this.source?.disconnect()
    } catch {
      /* already gone */
    }
    this.source = null
  }

  stop() {
    this.detachSource()
    this.externalLevel = null
    this.open = 0
    this.level = 0
    this.voiced = false
  }

  /** Browsers suspend an AudioContext until a user gesture. */
  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────

  /** @param {number} dt seconds */
  step(dt) {
    this.since += dt
    let level = 0
    let tone = 0.5

    if (this.externalLevel) {
      level = this.externalLevel.level
      tone = this.externalLevel.tone
    } else if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq)
      let sum = 0
      let weighted = 0
      // Only the speech band. Below ~120 Hz is room rumble and above ~5 kHz is
      // mostly noise; including either makes the mouth react to things that
      // are not the voice.
      const nyquist = this.ctx.sampleRate / 2
      const binHz = nyquist / this.freq.length
      const lo = Math.floor(120 / binHz)
      const hi = Math.min(this.freq.length, Math.ceil(5000 / binHz))
      for (let i = lo; i < hi; i++) {
        const v = this.freq[i] / 255
        sum += v
        weighted += v * i
      }
      const n = hi - lo
      level = Math.min(1, (sum / n) * 2.6)
      // Spectral centroid, normalised across the band.
      tone = sum > 0.0001 ? Math.min(1, Math.max(0, (weighted / sum - lo) / (hi - lo)) * 2.2) : 0.5
    }

    // Loudness: fast to rise, slower to fall, so syllables are crisp but the
    // mouth does not chatter between them.
    const rising = level > this.level
    this.level += (level - this.level) * Math.min(1, dt * (rising ? 34 : 13))

    const wasVoiced = this.voiced
    if (this.level > 0.06) {
      this.voiced = true
      this.silence = 0
    } else {
      this.silence += dt
      if (this.silence > 0.16) this.voiced = false
    }
    if (wasVoiced && !this.voiced) this.onPhrase?.('end')
    if (!wasVoiced && this.voiced) this.onPhrase?.('start')

    // Jaw. Sprung rather than tracked, so it has the overshoot a jaw has and
    // never snaps between frames.
    const targetOpen = this.voiced ? Math.pow(this.level, 0.72) : 0
    const k = 26
    this.openV += (-2 * 0.75 * k * this.openV - k * k * (this.open - targetOpen)) * dt
    this.open = Math.max(0, Math.min(1.15, this.open + this.openV * dt))

    // Bright sounds spread the mouth; dark ones round it.
    const targetWide = this.voiced ? Math.min(1, Math.max(0, tone)) : 0.5
    this.wide += (targetWide - this.wide) * Math.min(1, dt * 9)
  }

  /**
   * The mouth shape to draw, in the same units expressions.js uses.
   * `blend` is how much of the speaking mouth to use versus the expression's
   * own — so a smile stays a smile while it talks.
   */
  shape() {
    return {
      open: this.open * 0.85,
      // Wide and flat, or narrow and round.
      w: 0.78 + this.wide * 0.42,
      blend: Math.min(1, this.open * 2.2),
      level: this.level,
      voiced: this.voiced,
    }
  }
}

// ── Emotion tags ────────────────────────────────────────────────────────────
//
// TTS scripts routinely carry inline emotion markers, and they are the cheapest
// possible source of truth about how a line should be delivered — the copy
// already says it. `[happy] Great news! [thinking] give me a second...` drives
// the face without anyone wiring up sentiment analysis.

const TAG = /\[([a-z_-]{2,20})\]/gi

/** Map a written tag onto a state this engine knows. */
const TAG_STATE = {
  happy: 'happy', glad: 'happy', pleased: 'happy',
  sad: 'sad', sorry: 'sad', apologetic: 'sad',
  angry: 'angry', annoyed: 'angry', firm: 'angry',
  excited: 'excited', enthusiastic: 'excited',
  laughing: 'laughing', laugh: 'laughing', amused: 'laughing',
  thinking: 'thinking', pause: 'thinking', hmm: 'thinking',
  confused: 'confused', unsure: 'confused',
  surprised: 'surprised', shocked: 'surprised', wow: 'surprised',
  curious: 'curious', interested: 'curious',
  proud: 'proud', confident: 'proud',
  shy: 'shy', embarrassed: 'shy',
  scared: 'scared', worried: 'scared',
  suspicious: 'suspicious', doubtful: 'suspicious',
  listening: 'listening', neutral: 'idle', calm: 'idle',
  whisper: 'shy', warm: 'happy', celebrate: 'celebrate',
}

/**
 * Split a tagged script into timed cues.
 *
 * @returns {{clean:string, cues:{at:number,state:string,tag:string}[]}}
 *   `clean` is the text with tags removed — feed that to the TTS.
 *   `at` is a 0..1 position through the text, so a cue can be scheduled
 *   against the utterance's real duration once that is known.
 */
export function parseEmotionTags(script) {
  const cues = []
  let clean = ''
  let last = 0
  let match
  TAG.lastIndex = 0
  while ((match = TAG.exec(script))) {
    clean += script.slice(last, match.index)
    const state = TAG_STATE[match[1].toLowerCase()]
    if (state) cues.push({ at: clean.length, state, tag: match[1].toLowerCase() })
    last = match.index + match[0].length
  }
  clean += script.slice(last)
  const total = Math.max(1, clean.length)
  return { clean: clean.replace(/\s{2,}/g, ' ').trim(), cues: cues.map((c) => ({ ...c, at: c.at / total })) }
}

export { TAG_STATE }
