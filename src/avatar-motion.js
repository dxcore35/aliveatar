// ---------------------------------------------------------------------------
// <avatar-motion> — the element you drop in a page.
//
//   <avatar-motion seed="agent:reception-01" kind="agent" color="#3B82F6"
//                  state="listening" emblem="auto" mouse-interactive>
//   </avatar-motion>
//
// Attributes
//   seed               stable id → the same person every time
//   kind               'agent' (AI mascot) | 'customer' (person)
//   color              agent signature colour, becomes the skin
//   gender             'male' | 'female' | omitted
//   state              any key of POOLS in states.js
//   head/body/bottom/item/glasses   force a Humation part by name
//   emblem             'auto' state symbol over the head | 'item' keep the
//                      Humation hat/pet | 'off'
//   mouse-interactive  the eyes track the pointer (smooth pursuit)
//   no-aura            never claim a WebGL surface
//   flat               skip the shading and texture pass
//   demo               run the scripted demo on a loop
//   no-mount           skip the arrival animation
//   transparent-bg     do not paint the avatar's own background
//
// It does NOT own a requestAnimationFrame. It registers with the shared ticker,
// which drives every avatar on the page from one loop and stops entirely when
// they are all off-screen or the tab is hidden.
// ---------------------------------------------------------------------------
import { buildAvatar, PARTS } from './humation.js'
import { FaceEngine } from './engine.js'
import { DemoDirector } from './demo.js'
import { join, prefersReducedMotion } from './core/ticker.js'
import { emblemFor, emblemMotion, tintedEmoji } from './render/emblem.js'
import { iconSvg } from './render/icons.js'
import { grainTexture } from './render/textures.js'
import { SpeechEngine } from './speech.js'
import { handle, MANIFEST, clearCues } from './control.js'

const SLOTS = ['head', 'body', 'bottom', 'item', 'glasses']

export class AvatarMotion extends HTMLElement {
  static observedAttributes = [
    'seed', 'kind', 'color', 'gender', 'state', 'mouse-interactive', 'transparent-bg',
    'demo', 'no-mount', 'no-aura', 'flat', 'emblem', 'background', 'theme', 'age', 'skull', ...SLOTS,
  ]

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' })
    this.build()
  }

  disconnectedCallback() {
    this.teardown()
  }

  attributeChangedCallback(name) {
    if (!this.shadowRoot) return
    if (name === 'state') this.applyState(this.getAttribute('state') || 'idle')
    else if (name === 'mouse-interactive') this.syncPointer()
    else if (name === 'demo') this.syncDemo()
    else if (name === 'no-aura') { if (this.engine) this.engine.auraEnabled = !this.hasAttribute('no-aura') }
    else if (name === 'no-mount') { /* read at build time only */ }
    else this.build()
  }

  /** Full teardown — the element is going away. */
  teardown() {
    this.releaseEngine()
    this.demo?.stop()
    this.demo = null
    clearCues(this)
    this.speech?.stop()
    this.speech = null
  }

  /**
   * Teardown for a REBUILD. The demo director deliberately survives: it swaps
   * the avatar's seed between beats, which rebuilds the element, and if that
   * rebuild restarted the director it would shuffle again immediately and spin
   * forever. The director holds the element, not the engine, and reads
   * `avatar.engine` fresh on each beat, so it reconnects on its own.
   */
  releaseEngine() {
    this.leave?.()
    this.leave = null
    this.engine?.destroy()
    this.engine = null
    this.detachPointer()
  }

  build() {
    this.releaseEngine()

    // One speech engine per element, created lazily and kept across rebuilds so
    // an audio stream stays attached when the avatar changes appearance.
    if (!this.speech) {
      this.speech = new SpeechEngine()
      this.speech.onPhrase = (which) => this.emit(which === 'start' ? 'speech.start' : 'speech.end')
    }

    const selections = {}
    for (const slot of SLOTS) {
      const v = this.getAttribute(slot)
      if (v && PARTS[slot]?.includes(v)) selections[slot] = v
    }
    const emblemMode = this.getAttribute('emblem') || 'item'
    // The state symbol replaces the hat or pet — two things competing for the
    // space over the head just read as clutter.
    if (emblemMode === 'auto' || emblemMode === 'icon') selections.item = 'none'

    const kind = this.getAttribute('kind') || 'agent'
    const color = this.getAttribute('color') || '#3B82F6'
    // Explicit attribute wins; otherwise follow the page's own scheme, so an
    // avatar dropped into a dark dashboard tones itself with no wiring.
    const theme =
      this.getAttribute('theme') ||
      (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

    let built
    try {
      built = buildAvatar({
        seed: this.getAttribute('seed') || 'avatar',
        kind,
        color,
        gender: this.getAttribute('gender') || undefined,
        // Real data beats a random seed: age drives greying, reading glasses,
        // which clothes are likely, and how fast the person moves.
        age: this.hasAttribute('age') ? Number(this.getAttribute('age')) : undefined,
        // Generated head shape, agents only. Absent = pick one from the seed;
        // `none` = keep the head exactly as Humation drew it.
        skull: this.getAttribute('skull') === 'none' ? false : this.getAttribute('skull') || undefined,
        selections,
        // The SVG's own background rect is always left out. The colour lives on
        // the wrapper instead, so the aura canvas can sit BETWEEN the backdrop
        // and the figure — behind the character, in front of the ground. With
        // the rect in place the shader would be painted over and invisible.
        transparentBg: true,
        look: !this.hasAttribute('flat'),
        theme,
      })
    } catch (err) {
      this.shadowRoot.innerHTML = `<pre style="color:#c00;font:12px/1.4 monospace;white-space:pre-wrap">${err.message}</pre>`
      throw err
    }

    this.built = built
    this.emblemMode = emblemMode

    // Agents sit on the host page, not in a tinted tile. A coloured card behind
    // an AI mascot is a design decision the page should make, not the avatar —
    // so an agent is transparent unless a background is explicitly asked for,
    // and the aura provides whatever presence it needs. People keep their soft
    // tile, because it reads as a portrait.
    const wantsBg = this.hasAttribute('background') || (kind === 'customer' && !this.hasAttribute('transparent-bg'))
    this.bgColor = wantsBg ? built.colors.background : 'transparent'

    // Emblem ink: pulled towards the character's own colour so the badge
    // belongs to it — but the BASE it mixes into flips with the theme. A dark
    // ink emblem is perfect on a light page and invisible on a dark one, which
    // is exactly what it was doing.
    const dark = theme === 'dark'
    const inkBase = dark ? '#f2efe6' : built.colors.stroke
    const tintSource = kind === 'customer' ? (dark ? built.colors.hair : built.colors.stroke) : color
    this.emblemInk = mixInk(tintSource, inkBase, dark ? 0.38 : 0.55)
    // Emoji get repainted in the character's own colour too (see tintedEmoji),
    // lifted if the raw colour would disappear against a dark page.
    this.emojiInk = kind === 'customer' ? this.emblemInk : dark ? liftForDark(color) : color

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; line-height: 0; contain: layout paint; }
        .wrap {
          position: relative; width: 100%; height: 100%;
          container-type: inline-size; isolation: isolate;
          background: ${this.bgColor};
        }
        /* The same grain that runs over the figure, continued across the
           backdrop, so the two read as one printed surface. */
        .wrap::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image: ${!wantsBg || this.hasAttribute('flat') ? 'none' : `url(${grainTexture()})`};
          background-size: 16%; mix-blend-mode: overlay; opacity: 0.13;
        }
        .aura { position: absolute; inset: 0; pointer-events: none; }
        svg { position: relative; display: block; width: 100%; height: 100%; }
        .am-eye { fill: var(--am-eye, ${built.colors.stroke}); }
        .am-mouth { fill: var(--am-mouth, ${built.colors.stroke}); }

        /* Top RIGHT, not top centre. Humation hair is tall and centred, so a
           centred emblem lands in it on half the heads; the upper right corner
           is empty on every one of them. */
        .am-emblem {
          position: absolute; left: 76%; top: 4%;
          width: 20cqw; height: 20cqw;
          display: grid; place-items: center;
          font-size: clamp(9px, 15cqw, 44px); line-height: 1;
          will-change: transform; pointer-events: none;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.28));
          opacity: 0;
        }
        .am-emblem img { width: 100%; height: 100%; display: block; object-fit: contain; }
        .am-emblem svg { width: 100%; height: 100%; display: block; }
        .am-bubble {
          position: absolute; left: 46%; top: 2%; width: 62%;
          transform-origin: 0% 100%;
          background: ${built.colors.stroke}; color: #f6f5f4;
          border-radius: 10px; padding: 6px 8px;
          font: 500 clamp(6px, 3.1cqw, 13px)/1.35 ui-monospace, 'SF Mono', Menlo, monospace;
          letter-spacing: -0.01em; pointer-events: none;
          opacity: 0; transform: scale(0.6);
        }
        .am-bubble b { color: #8fb4ff; font-weight: 500; }
        .am-bubble i { color: #b9b6ad; font-style: normal; display: block; }
        .am-bubble u { color: #7ee0a8; text-decoration: none; display: block; }
        .am-bubble::after {
          content: ''; position: absolute; left: 12%; bottom: -6px;
          border: 5px solid transparent; border-top-color: ${built.colors.stroke}; border-bottom: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .am-emblem, .am-bubble { transition: none !important; }
        }
      </style>
      <div class="wrap">
        <div class="aura" part="aura"></div>
        ${built.svg}
        <div class="am-emblem" part="emblem"></div>
        <div class="am-bubble" part="bubble"></div>
      </div>`

    const sr = this.shadowRoot
    this.bubble = sr.querySelector('.am-bubble')
    this.emblemEl = sr.querySelector('.am-emblem')

    this.engine = new FaceEngine(sr.getElementById('face-slot'), built.face, {
      kind,
      color,
      faceGlassed: built.faceGlassed,
      root: sr.getElementById('am-root'),
      baseClothes: built.colors.clothes,
      // The RESOLVED skin, not the raw attribute — the mood shift starts from
      // the colour actually on the face.
      resolvedSkin: built.colors.skin,
      // The speech engine OUTLIVES a rebuild — an avatar that changes clothes
      // mid-sentence must not stop talking.
      speech: this.speech,
      toolGlasses: sr.getElementById('tool-glasses'),
      headShift: sr.getElementById('head-shift'),
      faceShift: sr.getElementById('face-shift'),
      bodyShift: sr.getElementById('body-shift'),
      neckShift: sr.getElementById('neck-shift'),
      rootShift: sr.getElementById('root-shift'),
      shadowEl: sr.querySelector('[id$="-shadow"]'),
      auraHost: this.hasAttribute('no-aura') ? null : sr.querySelector('.aura'),
      petEyes: [...sr.querySelectorAll('.am-pet-eye')],
      age: this.hasAttribute('age') ? Number(this.getAttribute('age')) : undefined,
      onTool: (t) => this.renderBubble(t),
    })
    this.engine.auraEnabled = !this.hasAttribute('no-aura')

    this.emblemLife = 0
    this.currentEmblem = null
    this.applyState(this.getAttribute('state') || 'idle', true)
    if (!this.hasAttribute('no-mount') && !prefersReducedMotion()) this.engine.mount()

    // One shared loop for every avatar on the page.
    this.leave = join({
      el: this,
      fixed: (dt) => this.engine.fixed(dt),
      draw: (t, dt) => {
        this.engine.draw(t)
        this.drawEmblem(t, dt)
      },
      onReducedMotion: (r) => this.engine.onReducedMotion(r),
      onHidden: () => this.engine.onHidden(),
    })

    this.syncPointer()
    this.syncDemo()
  }

  applyState(state, silent) {
    this.engine?.setState(state)
    const mode = this.emblemMode === 'icon' ? 'icon' : 'emoji'
    const active = this.emblemMode === 'auto' || this.emblemMode === 'icon'
    const [glyph, behaviour] = active ? emblemFor(state, mode) : [null, null]
    if (glyph !== this.currentEmblem) {
      this.currentEmblem = glyph
      this.emblemBehaviour = behaviour
      this.emblemLife = 0
      if (this.emblemEl) {
        // Icons are inline SVG tinted with the avatar's ink colour so they read
        // as part of the same drawing; emoji are just text.
        this.emblemEl.innerHTML = !glyph
          ? ''
          : mode === 'icon'
            ? iconSvg(glyph, { size: '100%', color: this.emblemInk })
            : `<img alt="" src="${tintedEmoji(glyph, this.emojiInk)}">`
        this.emblemEl.style.opacity = glyph ? '1' : '0'
      }
    }
    if (!silent) {
      this.dispatchEvent(new CustomEvent('statechange', { detail: state, bubbles: true }))
      this.emit('state', { state })
    }
  }

  /** The emblem's float/spin/shake, in the same frame as everything else. */
  drawEmblem(t, dt) {
    if (!this.emblemEl || !this.currentEmblem) return
    // The tool bubble occupies the same corner and says strictly more; the
    // emblem steps aside rather than stacking on top of it.
    const busy = !!this.engine?.tool
    if (busy !== this.emblemHidden) {
      this.emblemHidden = busy
      this.emblemEl.style.opacity = busy ? '0' : '1'
    }
    if (busy) return
    this.emblemLife += dt
    const m = emblemMotion(this.emblemBehaviour, t, this.emblemLife)
    this.emblemEl.style.transform =
      `translate(-50%, 0) translate(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px) rotate(${m.rot.toFixed(2)}deg) scale(${m.scale.toFixed(3)})`
  }

  renderBubble(tool) {
    if (!this.bubble) return
    if (!tool) {
      this.bubble.style.opacity = '0'
      this.bubble.style.transform = 'scale(0.6)'
      this.emit('tool.end')
      return
    }
    this.emit(tool.done ? 'tool.result' : 'tool.start', { name: tool.name, result: tool.result })
    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])
    this.bubble.innerHTML =
      `<b>▸ ${esc(tool.name)}</b>` +
      (tool.args ? `<i>${esc(tool.args)}</i>` : '') +
      (tool.done && tool.result ? `<u>✓ ${esc(tool.result)}</u>` : '')
    this.bubble.style.opacity = '1'
    this.bubble.style.transform = 'scale(1)'
    if (!prefersReducedMotion()) {
      this.bubble.animate(
        [{ transform: 'scale(0.6)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
        { duration: 340, easing: 'cubic-bezier(.2,1.4,.4,1)' },
      )
    }
  }

  syncDemo() {
    if (!this.hasAttribute('demo')) {
      this.demo?.stop()
      this.demo = null
      return
    }
    // Already running — a rebuild must not restart it.
    if (this.demo) return
    this.demo = new DemoDirector(
      this,
      (beat) => this.dispatchEvent(new CustomEvent('demobeat', { detail: beat, bubbles: true })),
      { shuffle: !this.hasAttribute('no-shuffle') },
    )
    this.demo.start()
  }

  syncPointer() {
    this.detachPointer()
    if (!this.hasAttribute('mouse-interactive') || !this.engine) return
    this.onPointer = (ev) => {
      const r = this.getBoundingClientRect()
      if (!r.width || !r.height) return
      // The same ±0.6 clamp the original engine uses, so the eyes never reach
      // the edge of the face however far away the pointer is.
      this.engine.gaze.pursuit = {
        x: Math.max(-0.6, Math.min(0.6, (ev.clientX - (r.left + r.width / 2)) / r.width)) / 0.6,
        y: Math.max(-0.6, Math.min(0.6, (ev.clientY - (r.top + r.height / 2)) / r.height)) / 0.6,
      }
    }
    window.addEventListener('pointermove', this.onPointer, { passive: true })
  }

  detachPointer() {
    if (this.onPointer) window.removeEventListener('pointermove', this.onPointer)
    this.onPointer = null
    if (this.engine) this.engine.gaze.pursuit = null
  }

  // ── Integration API ───────────────────────────────────────────────────────
  /**
   * The one entry point an application drives. Plain JSON in, events out —
   * see control.js for the full command list, or ask for it at runtime:
   *   avatar.send({ type: 'manifest' })
   */
  send(msg) { return handle(this, msg) }

  /** The command list, for an app that wants to discover what is possible. */
  static get manifest() { return MANIFEST }

  emit(name, payload) {
    this.dispatchEvent(new CustomEvent('avatar-event', { detail: { name, ...payload }, bubbles: true }))
  }

  // ── Public API ────────────────────────────────────────────────────────────
  runTool(call, ms) { this.engine?.startTool(call, ms) }
  blink(depth) { this.engine?.blink(depth) }
  spin(n = 1) { this.engine?.spin(n) }
  remount() { this.engine?.mount() }
  setState(s) { this.setAttribute('state', s) }
  setExpression(i) { this.engine?.setExpression(i) }
  /** Play one of bloub's animated eye states by id. See motion/eyeacts.js. */
  playAct(id) { return this.engine?.playAct(id) ?? false }
  stopAct() { this.engine?.stopAct() }
  startDemo() { this.setAttribute('demo', '') }
  stopDemo() { this.removeAttribute('demo') }
}

/**
 * Pull the ink towards the character's own colour.
 *
 * A pure-black badge on a bright agent looks bolted on. Mixing the signature
 * colour into the ink — but keeping it dark enough to read — makes the emblem
 * look like it was drawn by the same hand as the avatar. Emoji cannot be
 * recoloured without wrecking them, so they keep their own palette.
 */
/** Raise a colour until it reads against a dark page, keeping its hue. */
function liftForDark(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum >= 0.5) return hex
  const k = 0.5 / Math.max(lum, 0.06)
  const to = (v) => Math.round(Math.min(255, v * 255 * k)).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function mixInk(color, ink, w = 0.55) {
  const parse = (h) => {
    const n = parseInt(String(h).replace('#', ''), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const [r1, g1, b1] = parse(color)
  const [r2, g2, b2] = parse(ink)
  const to = (a, b) => Math.round(a * w + b * (1 - w)).toString(16).padStart(2, '0')
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`
}

if (!customElements.get('avatar-motion')) customElements.define('avatar-motion', AvatarMotion)
