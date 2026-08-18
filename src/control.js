// ---------------------------------------------------------------------------
// Control — one documented way to drive the avatar from an application.
//
// Not MCP, and deliberately not. MCP exists so a MODEL can discover and call
// tools; this is a UI component being driven by an app that already knows what
// it wants. What that app actually needs is much smaller:
//
//   • ONE entry point, so there is no API surface to learn
//   • plain JSON in, so it works across a postMessage, a WebSocket, a Rivet
//     node or a LiveKit data channel without adapters
//   • events out, so the app can react to what the avatar did
//   • a MANIFEST it can read at runtime to discover what is possible
//
// So: `avatar.send({ type, ...args })` in, `avatar-event` out, and MANIFEST
// describing every command. If MCP is ever wanted on top, MANIFEST is already
// the tool list — generating a server from it is a mechanical step, and this
// stays usable without one.
//
//   avatar.send({ type: 'state', state: 'listening' })
//   avatar.send({ type: 'tool.start', name: 'kb.search', args: '{ q: "hours" }' })
//   avatar.send({ type: 'speech.attach', stream: mediaStream })
//   avatar.send({ type: 'say', text: '[happy] Found it! [thinking] one moment' })
//
// Every command is idempotent and safe to send at any time. Unknown commands
// are reported back as an error event rather than thrown, because a control
// channel that can crash the UI is not a control channel.
// ---------------------------------------------------------------------------
import { parseEmotionTags } from './speech.js'
import { STATES, TOOL_STATES, TOOL_ACTS } from './states.js'
import { EXPRESSION_NAMES } from './expressions.js'
import { EYE_ACTS } from './motion/eyeacts.js'

/** Every eye act id, for validation and for the manifest. */
const ACT_IDS = EYE_ACTS.map((a) => a.id)

/**
 * Every command, with enough detail for an app — or a generator — to use it
 * without reading this file.
 */
export const MANIFEST = {
  version: '1.0',
  events: [
    { name: 'ready', when: 'the avatar has built and is animating' },
    { name: 'state', when: 'the state changed', payload: { state: 'string' } },
    { name: 'tool.start', when: 'a tool call began', payload: { name: 'string' } },
    { name: 'tool.result', when: 'a tool call returned', payload: { name: 'string', result: 'string' } },
    { name: 'tool.end', when: 'a tool call finished and the avatar settled' },
    { name: 'speech.start', when: 'the avatar started producing sound' },
    { name: 'speech.end', when: 'the avatar stopped producing sound' },
    { name: 'error', when: 'a command could not be handled', payload: { message: 'string' } },
  ],
  commands: [
    {
      type: 'state',
      doc: 'Set what the avatar is doing. This is the main control.',
      args: { state: { type: 'enum', values: STATES } },
    },
    {
      type: 'emotion',
      doc: 'Alias of `state`, for the subset that reads as a feeling.',
      args: { emotion: { type: 'string', note: 'happy, sad, angry, excited, thinking, …' } },
    },
    {
      type: 'expression',
      doc: 'Force one face. Normally the state picks these for you.',
      args: { index: { type: 'int', range: [0, EXPRESSION_NAMES.length - 1] } },
    },
    {
      type: 'tool.start',
      doc: 'The agent began a tool call. A name matching search/find/lookup/scan/query fires the laser eyes; anything else puts glasses on and runs the outfit colour.',
      args: {
        name: { type: 'string' },
        args: { type: 'string', optional: true },
        result: { type: 'string', optional: true, note: 'shown when the call returns' },
        ms: { type: 'int', optional: true, default: 3600 },
        act: {
          type: 'enum',
          values: ACT_IDS,
          optional: true,
          note: 'eye act to perform. Omit and one is chosen from the tool name; pass false to leave the eyes alone.',
        },
      },
    },
    { type: 'tool.end', doc: 'End the running tool call early.' },
    {
      type: 'speech.attach',
      doc: 'Drive the mouth from real audio. Pass ONE of these.',
      args: {
        stream: { type: 'MediaStream', optional: true, note: 'a LiveKit / WebRTC track' },
        element: { type: 'HTMLAudioElement', optional: true },
        node: { type: 'AudioNode', optional: true },
      },
    },
    {
      type: 'speech.level',
      doc: 'Drive the mouth by hand, when the audio is not reachable from the browser.',
      args: {
        level: { type: 'float', range: [0, 1] },
        tone: { type: 'float', range: [0, 1], optional: true, note: '0 round and dark, 1 wide and bright' },
      },
    },
    { type: 'speech.stop', doc: 'Stop speech driving the mouth and close it.' },
    {
      type: 'say',
      doc: 'Schedule emotion cues from a tagged script. Returns the clean text to send to your TTS. Tags look like [happy] or [thinking].',
      args: {
        text: { type: 'string' },
        ms: { type: 'int', optional: true, note: 'utterance duration, if known — cues are spread across it' },
      },
      returns: { clean: 'string', cues: 'array' },
    },
    { type: 'blink', doc: 'Blink now.', args: { depth: { type: 'float', optional: true, default: 1 } } },
    { type: 'spin', doc: 'Spin the head. Agents only.', args: { turns: { type: 'int', optional: true, default: 1 } } },
    { type: 'mount', doc: 'Replay the arrival animation.' },
    { type: 'look', doc: 'Look at a point, in normalised −1..1 face units.', args: { x: { type: 'float' }, y: { type: 'float' } } },
    { type: 'identity', doc: 'Change who this is. Everything is deterministic from the seed.',
      args: {
        seed: { type: 'string', optional: true },
        kind: { type: 'enum', values: ['agent', 'customer'], optional: true },
        color: { type: 'hex', optional: true },
        gender: { type: 'enum', values: ['male', 'female'], optional: true },
        age: { type: 'int', optional: true, note: 'drives greying, reading glasses, clothing and pace' },
      } },
    {
      type: 'act.play',
      doc:
        'Play one EYE ACT — a short performance the eyes give on top of whatever ' +
        'expression is showing, then hand back. This is the animation layer other ' +
        'apps most often want: it is what makes an avatar react to something ' +
        'without changing what it IS.',
      args: { id: { type: 'enum', values: ACT_IDS } },
      returns: { ok: 'boolean' },
    },
    { type: 'act.stop', doc: 'Drop the running eye act and return to the expression underneath.' },
    {
      type: 'kind',
      doc:
        'Explicitly choose what this avatar IS. An agent gets the taller drawn ' +
        'eyes, the full head rotation, a generated skull and the tool-call ' +
        'theatrics; a person gets none of them and keeps natural proportions. ' +
        'The same thing can be set through `identity`, but a caller that only ' +
        'wants to switch between a person and an AI should not have to send an ' +
        'identity change to do it.',
      args: { kind: { type: 'enum', values: ['agent', 'customer'] } },
    },
    { type: 'theme', doc: 'Light or dark.', args: { theme: { type: 'enum', values: ['light', 'dark'] } } },
  ],
  notes: {
    toolStates: TOOL_STATES,
    expressions: EXPRESSION_NAMES,
    /** Every eye act, so an app can discover them rather than hardcode a list. */
    acts: ACT_IDS,
    /** Which act a tool call plays when none is named. */
    toolActs: TOOL_ACTS,
  },
}

/**
 * Handle one command against an <avatar-motion> element.
 *
 * @param {HTMLElement} avatar
 * @param {object} msg
 * @returns {any} whatever that command returns, or an {error} object
 */
export function handle(avatar, msg) {
  if (!msg || typeof msg.type !== 'string') return fail(avatar, 'command needs a string `type`')
  const e = avatar.engine

  switch (msg.type) {
    case 'state':
    case 'emotion': {
      const state = msg.state || msg.emotion
      if (!STATES.includes(state)) return fail(avatar, `unknown state "${state}"`)
      avatar.setState(state)
      return { ok: true }
    }

    case 'expression':
      avatar.setExpression(Number(msg.index) || 0)
      return { ok: true }

    case 'tool.start':
      if (!msg.name) return fail(avatar, 'tool.start needs a `name`')
      // `act` rides along: it is how a caller names the eye act itself, or
      // passes false to leave the eyes out of it. Dropping it here meant the
      // override in the manifest silently did nothing.
      avatar.runTool({ name: msg.name, args: msg.args, result: msg.result, act: msg.act }, msg.ms)
      return { ok: true }

    case 'tool.end':
      e?.endTool()
      return { ok: true }

    case 'speech.attach': {
      const speech = avatar.speech
      if (!speech) return fail(avatar, 'no speech engine on this avatar')
      try {
        if (msg.stream) speech.attachStream(msg.stream)
        else if (msg.element) speech.attachElement(msg.element)
        else if (msg.node) speech.attachNode(msg.node)
        else return fail(avatar, 'speech.attach needs a stream, element or node')
        speech.resume()
      } catch (err) {
        return fail(avatar, `speech.attach failed: ${err.message}`)
      }
      return { ok: true }
    }

    case 'speech.level':
      avatar.speech?.pushLevel(Number(msg.level) || 0, msg.tone)
      return { ok: true }

    case 'speech.stop':
      avatar.speech?.stop()
      return { ok: true }

    case 'say': {
      const { clean, cues } = parseEmotionTags(String(msg.text || ''))
      // With a duration, the cues are spread across it; without one they fire
      // on a rough reading pace, which is better than firing them all at once.
      const ms = Number(msg.ms) || Math.max(1200, clean.length * 55)
      for (const cue of cues) {
        const at = cue.at * ms
        const timer = setTimeout(() => avatar.setState(cue.state), at)
        avatar._cueTimers = avatar._cueTimers || []
        avatar._cueTimers.push(timer)
      }
      return { clean, cues }
    }

    case 'blink':
      avatar.blink(msg.depth)
      return { ok: true }

    case 'spin':
      avatar.spin(Number(msg.turns) || 1)
      return { ok: true }

    case 'mount':
      avatar.remount()
      return { ok: true }

    case 'look':
      if (e) e.manualGaze = { x: Number(msg.x) || 0, y: Number(msg.y) || 0 }
      return { ok: true }

    case 'identity': {
      for (const key of ['seed', 'kind', 'color', 'gender', 'age']) {
        if (msg[key] !== undefined && msg[key] !== null) avatar.setAttribute(key, String(msg[key]))
      }
      return { ok: true }
    }

    case 'act.play': {
      if (!ACT_IDS.includes(msg.id)) return fail(avatar, `unknown eye act "${msg.id}"`)
      return { ok: avatar.playAct(msg.id) }
    }

    case 'act.stop':
      avatar.stopAct()
      return { ok: true }

    case 'kind': {
      const kind = msg.kind === 'customer' ? 'customer' : msg.kind === 'agent' ? 'agent' : null
      if (!kind) return fail(avatar, `kind must be "agent" or "customer", got "${msg.kind}"`)
      avatar.setAttribute('kind', kind)
      return { ok: true }
    }

    case 'theme':
      avatar.setAttribute('theme', msg.theme === 'dark' ? 'dark' : 'light')
      return { ok: true }

    case 'manifest':
      return MANIFEST

    default:
      return fail(avatar, `unknown command "${msg.type}"`)
  }
}

function fail(avatar, message) {
  avatar.dispatchEvent(new CustomEvent('avatar-event', { detail: { name: 'error', message }, bubbles: true }))
  return { error: message }
}

/** Cancel any emotion cues still pending from a `say`. */
export function clearCues(avatar) {
  for (const t of avatar._cueTimers || []) clearTimeout(t)
  avatar._cueTimers = []
}
