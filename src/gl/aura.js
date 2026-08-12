// ---------------------------------------------------------------------------
// Aura — the one genuinely shader-driven layer, kept deliberately small.
//
// A fragment shader behind an agent's head sells "this is a machine thinking"
// in a way no amount of SVG can. It is also the easiest way to ruin a page: a
// browser allows only a handful of WebGL contexts, and a full-size animated
// shader per avatar in a fifty-row list would be a disaster.
//
// So the cost is bounded on every axis, up front:
//
//   • at most POOL_SIZE live contexts on the page, handed out and returned
//   • 144 x 144 backing store regardless of how large the avatar is drawn
//   • 30 fps, not display rate
//   • skipped entirely when the intensity is flat and nothing has changed
//   • off-screen avatars release their context to whoever needs it
//   • no context available, no WebGL, or reduced-motion → the avatar simply
//     renders without an aura, and nothing else changes
//
// Worst case for the whole page is three 144x144 surfaces at 30 fps: about
// 1.9 megapixels a second, which is under one percent of a 60 Hz 1080p frame
// budget.
// ---------------------------------------------------------------------------

const POOL_SIZE = 3
const SIZE = 144
const FPS = 30

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`

// Cheap value noise: one hash, two octaves. No texture reads, no loops beyond
// what unrolls, so it compiles small and runs fast on integrated GPUs.
const FRAG = `
precision mediump float;
varying vec2 uv;
uniform float uTime;
uniform float uIntensity;
uniform vec3  uColor;
uniform float uMode;      // 0 idle breathing, 1 thinking orbit, 2 tool scan

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  // Centred on the HEAD, not on the tile. The figure stands in the lower two
  // thirds of the frame, so a tile-centred glow would sit on its chest.
  vec2 c = uv - vec2(0.5, 0.62);
  float r = length(c) * 2.0;
  float ang = atan(c.y, c.x);

  // Soft ring that lives just outside the head silhouette.
  float ring = smoothstep(0.98, 0.6, r) * smoothstep(0.26, 0.52, r);

  // Flowing field. Two octaves is plenty once it is masked by the ring.
  vec2 flow = c * 3.2 + vec2(uTime * 0.11, uTime * -0.07);
  float n = noise(flow) * 0.62 + noise(flow * 2.3 + 4.0) * 0.38;

  float energy = ring * (0.45 + n * 0.75);

  // Thinking: a bright arc orbiting the head, the way a progress ring reads.
  float orbit = 0.0;
  if (uMode > 0.5) {
    float head = ang + uTime * 2.1;
    orbit = pow(max(0.0, cos(head)), 26.0) * ring * 1.9;
  }

  // Tool call: horizontal scan lines sweeping upward through the field.
  float scan = 0.0;
  if (uMode > 1.5) {
    scan = smoothstep(0.72, 1.0, sin((uv.y - uTime * 0.55) * 42.0)) * ring * 0.55;
  }

  // Slow swell so an idle agent is never perfectly static.
  float breath = 0.82 + 0.18 * sin(uTime * 0.9);

  float a = (energy * breath + orbit + scan) * uIntensity;
  a = clamp(a, 0.0, 1.0);

  // Hotter towards the core of the glow, so it does not read as flat colour.
  vec3 col = mix(uColor, vec3(1.0), pow(a, 2.4) * 0.55);
  gl_FragColor = vec4(col * a, a);
}`

class Slot {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = SIZE
    // Composited normally, not screened. The aura sits between a light backdrop
    // and the figure, and `screen` against a pale background is very close to
    // invisible — a straight alpha halo is what actually reads.
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    this.gl = null
    this.owner = null
    this.lastDraw = 0
    this.lastIntensity = -1
  }

  init() {
    if (this.gl) return true
    const gl =
      this.canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: true }) ||
      this.canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false })
    if (!gl) return false

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[aura] shader failed:', gl.getShaderInfoLog(s))
        return null
      }
      return s
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return false

    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[aura] link failed:', gl.getProgramInfoLog(prog))
      return false
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    gl.viewport(0, 0, SIZE, SIZE)
    gl.clearColor(0, 0, 0, 0)

    this.gl = gl
    this.u = {
      time: gl.getUniformLocation(prog, 'uTime'),
      intensity: gl.getUniformLocation(prog, 'uIntensity'),
      color: gl.getUniformLocation(prog, 'uColor'),
      mode: gl.getUniformLocation(prog, 'uMode'),
    }
    return true
  }

  draw(t, intensity, rgb, mode) {
    // Nothing to say and nothing changed — do not touch the GPU at all.
    if (intensity < 0.015 && this.lastIntensity < 0.015) return
    if (t - this.lastDraw < 1 / FPS) return
    this.lastDraw = t
    this.lastIntensity = intensity

    const gl = this.gl
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(this.u.time, t)
    gl.uniform1f(this.u.intensity, intensity)
    gl.uniform3f(this.u.color, rgb[0], rgb[1], rgb[2])
    gl.uniform1f(this.u.mode, mode)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}

const pool = []
let poolReady = false

function ensurePool() {
  if (poolReady) return
  poolReady = true
  for (let i = 0; i < POOL_SIZE; i++) {
    const slot = new Slot()
    if (slot.init()) pool.push(slot)
    else break // no WebGL here; every avatar quietly goes without
  }
}

/**
 * Ask for an aura surface. Returns a canvas to mount, or null when the pool is
 * exhausted — callers must handle null, because on a busy page it is normal.
 */
export function acquire(owner) {
  ensurePool()
  for (const slot of pool) {
    if (!slot.owner) {
      slot.owner = owner
      slot.lastIntensity = -1
      return slot
    }
  }
  return null
}

export function release(slot, owner) {
  if (slot && slot.owner === owner) {
    slot.owner = null
    slot.canvas.remove()
  }
}

export const auraAvailable = () => {
  ensurePool()
  return pool.length > 0
}

/** '#3B82F6' → [0.23, 0.51, 0.96] */
export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
