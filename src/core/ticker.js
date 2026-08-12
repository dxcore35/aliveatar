// ---------------------------------------------------------------------------
// Ticker — ONE requestAnimationFrame for the whole page.
//
// A list view can hold fifty avatars. Fifty independent rAF loops means fifty
// callbacks, fifty layout reads and fifty chances to miss a frame; one loop that
// walks a set costs the same as one avatar. This is the single biggest
// difference between a demo and something you can ship on a dashboard.
//
// It also owns the three things every animation on a real product has to
// respect:
//
//   • off-screen avatars do not animate      (IntersectionObserver)
//   • a hidden tab does not animate          (visibilitychange)
//   • prefers-reduced-motion is obeyed       (and watched, not read once)
//
// Physics runs on a FIXED 120 Hz step regardless of display refresh, so a
// spring settles identically on a 60 Hz laptop and a 120 Hz phone. Rendering
// still happens once per real frame.
// ---------------------------------------------------------------------------

const STEP = 1 / 120
const MAX_CATCHUP = 0.25 // never simulate more than a quarter second at once

const members = new Set()
let raf = null
let last = 0
let accumulator = 0

const reducedQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
let reduced = reducedQuery ? reducedQuery.matches : false
reducedQuery?.addEventListener?.('change', (e) => {
  reduced = e.matches
  members.forEach((m) => m.onReducedMotion?.(reduced))
})

/** True when the user has asked the system for less animation. */
export const prefersReducedMotion = () => reduced

// One observer for every avatar on the page.
const visibility =
  typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const member = entry.target.__amMember
            if (!member) continue
            const was = member.visible
            member.visible = entry.isIntersecting
            // Leaving the viewport is the moment to give up scarce resources —
            // a WebGL context an on-screen avatar could be using.
            if (was && !member.visible) member.onHidden?.()
          }
          pump()
        },
        { rootMargin: '96px', threshold: 0 },
      )
    : null

let pageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden'
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState !== 'hidden'
    // Do not simulate the time spent in another tab — just resume cleanly.
    last = 0
    accumulator = 0
    pump()
  })
}

function frame(now) {
  raf = null
  const t = now / 1000
  if (!last) last = t
  let dt = t - last
  last = t
  if (dt > MAX_CATCHUP) dt = MAX_CATCHUP

  accumulator += dt
  let steps = 0
  while (accumulator >= STEP && steps < 30) {
    for (const m of members) if (m.visible) m.fixed(STEP, t)
    accumulator -= STEP
    steps++
  }
  // Leftover time never accumulates into a lurch.
  if (steps === 30) accumulator = 0

  for (const m of members) if (m.visible) m.draw(t, dt)

  pump()
}

function pump() {
  if (raf !== null) return
  if (!pageVisible) return
  let any = false
  for (const m of members) {
    if (m.visible) {
      any = true
      break
    }
  }
  if (!any) {
    last = 0
    return
  }
  raf = requestAnimationFrame(frame)
}

/**
 * Register an animating member.
 *
 * @param {object} member  { el, fixed(dt, t), draw(t, dt), onReducedMotion? }
 * @returns {() => void}   unsubscribe
 */
export function join(member) {
  member.visible = !visibility // no observer → assume visible
  members.add(member)
  if (visibility && member.el) {
    member.el.__amMember = member
    visibility.observe(member.el)
  }
  member.onReducedMotion?.(reduced)
  pump()
  return () => {
    members.delete(member)
    if (visibility && member.el) {
      visibility.unobserve(member.el)
      delete member.el.__amMember
    }
  }
}

/** How many members are currently animating — used by the lab's perf readout. */
export function activeCount() {
  let n = 0
  for (const m of members) if (m.visible) n++
  return n
}

export function totalCount() {
  return members.size
}
