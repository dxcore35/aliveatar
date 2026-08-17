// ---------------------------------------------------------------------------
// Eye acts — bloub's ANIMATED states, as performances the face can play.
//   Ported from bloub (MIT, Jérémy Perret) — reference/bloub/src/bot/states.ts
//   and src/ui/gaze.ts. Numbers there were measured frame by frame off video.
//
// WHAT THIS IS, AND WHY IT IS NOT AN EXPRESSION
//
// An expression is a POSE: a shape the face springs to and then holds. Every
// one of the forty-one in expressions.js is that. bloub's states are something
// else — they are PERFORMANCES, with a length and a shape over time: the eyes
// tear around the head three times faster than the body and come back; one eye
// snaps into a dash and back; the pair narrows as if squeezed; the face turns
// away from something and returns.
//
// You cannot express that as a pose, and springing between poses cannot fake
// it, because the interesting part is the middle — where it goes and how fast,
// not where it ends. Hence a separate mechanism: an act runs on its own clock,
// on TOP of whatever expression is showing, and hands the face back untouched.
//
// THREE THINGS HAD TO CHANGE TO FIT A REAL FACE
//
// 1. Poses are DELTAS. bloub's rest is yaw +28.5° looking right; ours is
//    recovered from the Humation artwork at about −29°, looking left. Absolute
//    angles would spin every face round the wrong way, so each act stores its
//    offset from bloub's own neutral instead.
//
// 2. Sizes are MULTIPLIERS. bloub's eye is a capsule of 0.186 × 0.412 in ball
//    units, aspect 2.2. Ours is the box Humation drew, aspect about 1.2. A raw
//    size would redraw the eye as a lozenge; a multiple of neutral transfers
//    what the act MEANT — wider, flatter, rounder.
//
// 3. People get less of it. `human` on each act is the fraction a person takes.
//    A machine may fling its eyes round its skull; a person turning their head
//    hard and sweeping their eyes is the same beat played on an instrument that
//    cannot do the trick. Nothing is skipped — it is scaled.
//
// What is deliberately NOT ported: everything that is about bloub's BODY. The
// blob collapsing into three dots, the travelling "!", the orbiting rings, the
// comet. Those belong to a shape that is one circle; we have a person with
// shoulders and hair. Where such a state also did something to the eyes — and
// most did — that part is here.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2
const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
const D = Math.PI / 180

/** bloub's neutral — the origin every number below is measured from. */
const B = { yaw: 28.49, pitch: 28.62, roll: -13, w: 0.186, h: 0.412, split: 15.46 }

const easeOutCubic = (t) => 1 - (1 - t) ** 3
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutQuint = (t) => 1 - (1 - t) ** 5

/** A head pose written the way bloub writes it, returned as an offset. */
const gaze = (yaw, pitch, roll) => ({
  dYaw: (yaw - B.yaw) * D,
  dPitch: (pitch - B.pitch) * D,
  dRoll: (roll - B.roll) * D,
})

/** One of bloub's absolute eye sizes, as a multiple of its neutral. */
const size = (w, h) => ({ w: w / B.w, h: h / B.h })

/** The identity act frame — what "nothing is happening" looks like. */
export const NEUTRAL_ACT = {
  dYaw: 0, dPitch: 0, dRoll: 0, splitScale: 1,
  w: [1, 1], h: [1, 1], tilt: [0, 0], lid: [1, 1], alpha: 1,
}

/** Build a frame, filling in whatever the act did not say. */
const frame = (o = {}) => ({ ...NEUTRAL_ACT, ...o })

/** Ease a frame in and out so an act never starts or ends with a jump. */
function envelope(f, k) {
  if (k >= 1) return f
  return {
    dYaw: f.dYaw * k,
    dPitch: f.dPitch * k,
    dRoll: f.dRoll * k,
    splitScale: 1 + (f.splitScale - 1) * k,
    w: [1 + (f.w[0] - 1) * k, 1 + (f.w[1] - 1) * k],
    h: [1 + (f.h[0] - 1) * k, 1 + (f.h[1] - 1) * k],
    tilt: [f.tilt[0] * k, f.tilt[1] * k],
    lid: [1 + (f.lid[0] - 1) * k, 1 + (f.lid[1] - 1) * k],
    alpha: 1 + (f.alpha - 1) * k,
  }
}

// ── The acts ────────────────────────────────────────────────────────────────

export const EYE_ACTS = [
  {
    id: 'orbit',
    label: 'orbit — the eyes lap the head',
    note: 'bloub\'s signature. The eyes run round the skull about three times faster than the body turns, crossing behind it and coming back, while the head lifts. On a person the head does the turning and the eyes sweep with it.',
    dur: 3.4,
    human: 0.42,
    fn(t) {
      // Measured: the eyes fly at sin(t·6.5) × 65°, and that swing dies away as
      // the body settles from 1.6 s onward. The die-away is the whole reason it
      // reads as landing rather than as being switched off.
      const back = easeInOutCubic(clamp((t - 1.6) / 0.9))
      const s = size(0.18, 0.34 + back * 0.07)
      return frame({
        dYaw: Math.sin(t * 6.5) * 65 * (1 - back) * D,
        dPitch: (-4 + back * 32 - B.pitch) * D,
        w: [s.w, s.w],
        h: [s.h, s.h],
      })
    },
  },

  {
    id: 'spin',
    label: 'spin — one full lap, lands exactly',
    note: 'A whole turn taken on the way to nowhere. It is free on a sphere and it always lands true, because −360° is the same angle as 0° — so it can be played at any moment without leaving the face somewhere new.',
    dur: 1.5,
    human: 0.34,
    fn(t) {
      // bloub's `tourLook`: ease-in-OUT, not the ease-out used everywhere else.
      // This is an object rotating, not a value settling — with an ease-out two
      // thirds of the turn is eaten in the first 0.3 s and it reads as a jolt.
      return frame({ dYaw: -360 * (1 - easeInOutCubic(clamp(t / 1.5))) * D })
    },
  },

  {
    id: 'wink',
    label: 'wink — the shut eye is a DASH',
    note: 'The measured surprise in bloub: a closed eye is not an open eye squashed. It is a horizontal dash almost twice as WIDE as the open one (0.447 against 0.236). Squashing instead leaves a thin sliver, which is why cheap winks look wrong.',
    dur: 1.6,
    human: 0.8,
    fn(t) {
      const hold = clamp(t / 0.16) * clamp((1.6 - t) / 0.3)
      const open = size(0.236, 0.464)
      const shut = size(0.447, 0.089)
      return envelope(
        frame({
          ...gaze(-5.37, 4.55, 6.7),
          splitScale: 16.25 / B.split,
          w: [open.w, shut.w],
          h: [open.h, shut.h],
        }),
        hold,
      )
    },
  },

  {
    id: 'wide',
    label: 'wide — chin up, eyes round',
    note: 'The head tips back hard and the eyes go round and tall. bloub measured the pitch at −22° off its neutral, which is a lot of head for one beat.',
    dur: 1.8,
    human: 0.55,
    fn(t) {
      const s = size(0.356, 0.875)
      return envelope(
        frame({ ...gaze(6.92, -21.96, 11.6), splitScale: 18.43 / B.split, w: [s.w, s.w], h: [s.h, s.h] }),
        clamp(t / 0.24) * clamp((1.8 - t) / 0.34),
      )
    },
  },

  {
    id: 'look-away',
    label: 'look away — something arrived',
    note: 'From bloub\'s notification state: the eyes go to the OPPOSITE side from whatever appeared, then come back. Looking straight at a badge reads as posing for it; looking away reads as having noticed it.',
    dur: 2.2,
    human: 0.75,
    fn(t) {
      // The pop is the badge's; what the face does is turn away and return.
      const p = clamp(t / 0.45)
      const away = p < 1 ? Math.sin(p * (Math.PI / 2)) : clamp((2.2 - t) / 0.6)
      const s = size(0.505, 0.498)
      return envelope(
        frame({ ...gaze(-21.94, -5.82, -12.2), splitScale: 18.89 / B.split, w: [s.w, s.w], h: [s.h, s.h] }),
        away,
      )
    },
  },

  {
    id: 'narrow',
    label: 'narrow — the eyes draw together',
    note: 'From the egg body: as the shape pinches, the eyes move CLOSER on the head — not smaller, closer. Spacing and size are separate levers and this is the one that is usually missed.',
    dur: 1.8,
    human: 0.7,
    fn(t) {
      const s = size(0.164, 0.385)
      return envelope(
        frame({ ...gaze(19.97, 26.01, -17.1), splitScale: 11.07 / B.split, w: [s.w, s.w], h: [s.h, s.h] }),
        clamp(t / 0.3) * clamp((1.8 - t) / 0.4),
      )
    },
  },

  {
    id: 'cock',
    label: 'cock — head tilted, small eyes',
    note: 'bloub\'s play state. Head down and rolled, eyes drawn small and level. It is the "go on then" beat.',
    dur: 2,
    human: 0.85,
    fn(t) {
      const s = size(0.18, 0.34)
      return envelope(
        frame({ ...gaze(12, -8, -6), splitScale: 15 / B.split, w: [s.w, s.w], h: [s.h, s.h] }),
        clamp(t / 0.35) * clamp((2.2 - t) / 0.5),
      )
    },
  },

  {
    id: 'squeeze',
    label: 'squeeze — the hexagon pinch',
    note: 'The same idea as narrow, played gentler and with the chin higher. Kept separate because bloub measured them separately and they do not read the same.',
    dur: 1.6,
    human: 0.8,
    fn(t) {
      const s = size(0.177, 0.411)
      return envelope(
        frame({ ...gaze(23.11, 24.42, -13.3), splitScale: 13.37 / B.split, w: [s.w, s.w], h: [s.h, s.h] }),
        clamp(t / 0.28) * clamp((1.6 - t) / 0.34),
      )
    },
  },

  {
    id: 'collapse',
    label: 'collapse — the face folds and returns',
    note: 'From bloub\'s burst. The eyes shut down to nothing on an ease-out over 0.7 s, hold gone, then grow back. The return uses a quintic ease, which is what makes it arrive soft instead of popping.',
    dur: 2.6,
    human: 0.9,
    fn(t) {
      const gone = 1 - 0.9 * easeOutQuint(clamp(t / 0.7))
      const regrow = easeOutQuint(clamp((t - 1.7) / 0.7))
      const k = gone + (1 - gone) * regrow
      return frame({ w: [k, k], h: [k, k], alpha: clamp(k * 3) })
    },
  },

  {
    id: 'fade',
    label: 'fade — the eyes leave, then come back',
    note: 'bloub drops the face entirely in its thinking, alert and sleep states — the blob has no face to keep. A person cannot lose their eyes, so here it is a fade to a closed lid and back, which is the same beat a face can actually do.',
    dur: 2.4,
    human: 1,
    fn(t) {
      const out = easeOutCubic(clamp(t / 0.3))
      const back = easeOutCubic(clamp((t - 1.8) / 0.45))
      const shut = out * (1 - back)
      return frame({ lid: [1 - shut, 1 - shut] })
    },
  },

  {
    id: 'flutter',
    label: 'flutter — a fast blink run',
    note: 'Not a bloub state — it is bloub\'s blink CURVE (fast down, slower up) fired in a run, which is the thing a real face does when it is processing and the original had no way to show.',
    dur: 1.9,
    human: 1,
    fn(t) {
      // Four blinks, each on bloub's own 45/55 close-to-open split.
      const k = (t % 0.42) / 0.18
      const lid = t > 1.68 ? 1 : k <= 1 ? (k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55) : 1
      return frame({ lid: [lid, lid] })
    },
  },

  {
    id: 'scan',
    label: 'scan — a slow sweep and back',
    note: 'The eyes travel the head end to end once, slowly, on the ease bloub uses for a value settling rather than an object turning. It is the searching beat, at a pace you can follow.',
    dur: 2.8,
    human: 0.5,
    fn(t) {
      const p = clamp(t / 2.8)
      return frame({
        dYaw: Math.sin(p * TAU) * 54 * D,
        dPitch: Math.sin(p * TAU * 2) * 7 * D,
      })
    },
  },
]

export const ACT_BY_ID = new Map(EYE_ACTS.map((a) => [a.id, a]))

/**
 * Sample an act, already scaled for the kind of face playing it.
 *
 * Returns null once the act is over, which is the engine's signal to let go —
 * an act that never ends would hold the face hostage.
 */
export function sampleAct(act, t, humanMix = 0) {
  if (!act || t >= act.dur) return null
  const f = act.fn(clamp(t, 0, act.dur))
  // `human` is how much of the act a person takes; humanMix is how much of a
  // person this face is. At humanMix 0 (a machine) the act plays whole.
  const g = 1 + (act.human - 1) * humanMix
  return g === 1 ? f : envelope(f, g)
}
