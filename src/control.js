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
import { STATES, TOOL_STATES } from './states.js'
import { EXPRESSION_NAMES } from './expressions.js'

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
    { type: 'theme', doc: 'Light or dark.', args: { theme: { type: 'enum', values: ['light', 'dark'] } } },
  ],
  notes: {
    toolStates: TOOL_STATES,
    expressions: EXPRESSION_NAMES,
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
      avatar.runTool({ name: msg.name, args: msg.args, result: msg.result }, msg.ms)
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
