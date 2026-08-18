#!/usr/bin/env bun
// ---------------------------------------------------------------------------
// MCP server — lets any AI agent drive the avatar.
//
// The control API was built for an app that already knows what it wants. An
// AI agent does not: it has to DISCOVER what is possible and then call it. That
// is exactly the gap MCP fills, and the manifest was already the right shape
// for it — every command carries a doc string and typed arguments, so the tool
// list below is generated rather than written twice and cannot drift from the
// implementation.
//
//   claude mcp add avatar -- bun /abs/path/to/mcp/server.js
//
// It speaks JSON-RPC 2.0 over stdio, hand-rolled rather than pulled from the
// SDK: the whole surface an agent needs is four methods, and this project has
// no dependencies at all, which is worth keeping for something a person will
// clone and run.
//
// Commands travel to the browser over the same bridge the CLI uses, so an agent
// and a person driving the same avatar cannot get different behaviour.
// ---------------------------------------------------------------------------
import { MANIFEST } from '../src/control.js'

const BRIDGE = process.env.BRIDGE_URL || 'ws://localhost:4332'
const PROTOCOL = '2024-11-05'

// ── Tools, generated from the manifest ──────────────────────────────────────

/** A manifest arg spec → a JSON Schema property. */
function toSchema(spec) {
  const base = { description: [spec.note, spec.default !== undefined ? `default: ${spec.default}` : null].filter(Boolean).join(' — ') || undefined }
  switch (spec.type) {
    case 'enum': return { ...base, type: 'string', enum: spec.values }
    case 'int': return { ...base, type: 'integer' }
    case 'float': return { ...base, type: 'number' }
    case 'boolean': return { ...base, type: 'boolean' }
    // MediaStream / AudioNode cannot cross a process boundary. They stay in the
    // list so an agent can see they exist, typed as the string they are not, and
    // the doc says why.
    case 'MediaStream':
    case 'HTMLAudioElement':
    case 'AudioNode': return { ...base, type: 'string', description: 'browser-only; not reachable over MCP' }
    default: return { ...base, type: 'string' }
  }
}

const TOOLS = MANIFEST.commands
  // A tool an agent cannot actually invoke from another process is noise in
  // its tool list, and a tool list is a budget.
  .filter((c) => c.type !== 'speech.attach')
  .map((c) => {
    const props = {}
    const required = []
    for (const [name, spec] of Object.entries(c.args || {})) {
      props[name] = toSchema(spec)
      if (!spec.optional) required.push(name)
    }
    props.target = { type: 'string', description: 'which connected avatar, by name. Omit for all.' }
    return {
      name: `avatar_${c.type.replace(/\./g, '_')}`,
      description: c.doc,
      inputSchema: { type: 'object', properties: props, required },
      _type: c.type,
    }
  })

TOOLS.push({
  name: 'avatar_list',
  description: 'List the avatars currently connected to the bridge, by name. Call this first if you do not know what is running.',
  inputSchema: { type: 'object', properties: {} },
  _type: 'avatars',
})

// ── The bridge, as a promise-per-call ───────────────────────────────────────

let ws = null
let ready = null
let nextId = 1
const waiting = new Map()

function connect() {
  if (ready) return ready
  ready = new Promise((resolve, reject) => {
    ws = new WebSocket(BRIDGE)
    ws.addEventListener('open', () => resolve())
    ws.addEventListener('error', () => {
      ready = null
      reject(new Error(`cannot reach the avatar bridge at ${BRIDGE} — start it with: bun tools/bridge.js`))
    })
    ws.addEventListener('close', () => { ready = null; ws = null })
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      const w = waiting.get(msg.id)
      if (!w) return
      waiting.delete(msg.id)
      w(msg)
    })
  })
  return ready
}

async function callBridge(cmd, target) {
  await connect()
  const id = nextId++
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id)
      resolve({ error: 'the avatar did not answer within 5s' })
    }, 5000)
    waiting.set(id, (msg) => { clearTimeout(timer); resolve(msg) })
    ws.send(JSON.stringify({ id, target: target || '*', cmd }))
  })
}

// ── JSON-RPC over stdio ─────────────────────────────────────────────────────

function write(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

async function handle(req) {
  const { id, method, params } = req

  if (method === 'initialize') {
    return write({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'avatar-motion', version: '1.0.0' },
      },
    })
  }

  if (method === 'notifications/initialized') return // a notification: no reply
  if (method === 'ping') return write({ jsonrpc: '2.0', id, result: {} })

  if (method === 'tools/list') {
    return write({
      jsonrpc: '2.0', id,
      result: { tools: TOOLS.map(({ _type, ...t }) => t) },
    })
  }

  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) {
      return write({ jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool "${params?.name}"` } })
    }
    const { target, ...args } = params.arguments || {}
    const answer = await callBridge({ type: tool._type, ...args }, target)
    const text = answer.error
      ? `error: ${answer.error}`
      : (answer.results || []).map((r) => `${r.avatar}: ${JSON.stringify(r.result)}`).join('\n') || 'no avatar answered'
    return write({
      jsonrpc: '2.0', id,
      result: { content: [{ type: 'text', text }], isError: !!answer.error },
    })
  }

  if (id !== undefined) {
    write({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } })
  }
}

// stdio framing: one JSON object per line.
let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    try {
      await handle(JSON.parse(line))
    } catch (err) {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: String(err?.message || err) } })
    }
  }
})
