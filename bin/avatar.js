#!/usr/bin/env bun
// ---------------------------------------------------------------------------
// avatar — drive a running avatar from a shell.
//
//   bun bin/avatar.js state listening
//   bun bin/avatar.js tool.start name=kb.search args='{ q: "hours" }'
//   bun bin/avatar.js act.play id=wink
//   bun bin/avatar.js kind kind=customer
//   bun bin/avatar.js identity seed=agent:reception-01 color=#16A34A age=34
//   bun bin/avatar.js manifest            # every command, from the avatar itself
//   bun bin/avatar.js avatars             # who is connected
//
//   --target=stage   send to one avatar by name (default: all)
//
// The first bare word after the command is a shorthand for that command's main
// argument — `state listening` rather than `state state=listening` — because
// the whole point of a CLI here is to try something in one line.
// ---------------------------------------------------------------------------
const URL_ = process.env.BRIDGE_URL || 'ws://localhost:4332'

const argv = process.argv.slice(2)
if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
  console.log(`avatar <command> [key=value ...] [--target=name]

  state <name>              what the avatar is doing
  emotion <name>            alias of state
  expression <index>        force one face
  act.play <id>             play an eye act
  act.stop                  drop the running act
  kind <agent|customer>     what this avatar IS
  tool.start name=... [args=...] [result=...] [act=...]
  tool.end
  say text="[happy] hello"
  blink | spin | mount | look x=.. y=..
  identity seed=.. kind=.. color=.. gender=.. age=..
  theme <light|dark>
  manifest                  the full command list, from the avatar
  avatars                   who is connected to the bridge

Bridge: ${URL_}   (start it with: bun tools/bridge.js)`)
  process.exit(0)
}

// The main argument of each command, for the bare-word shorthand.
const MAIN = {
  state: 'state', emotion: 'emotion', expression: 'index', theme: 'theme',
  kind: 'kind', 'act.play': 'id', say: 'text', spin: 'turns', blink: 'depth',
}

const type = argv[0]
const cmd = { type }
let target = '*'

for (const arg of argv.slice(1)) {
  if (arg.startsWith('--target=')) {
    target = arg.slice(9)
    continue
  }
  const eq = arg.indexOf('=')
  if (eq > 0) {
    const key = arg.slice(0, eq)
    let value = arg.slice(eq + 1)
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (value !== '' && !Number.isNaN(Number(value)) && !/^#/.test(value)) value = Number(value)
    cmd[key] = value
  } else if (MAIN[type] && cmd[MAIN[type]] === undefined) {
    // Bare word → that command's main argument.
    const n = Number(arg)
    cmd[MAIN[type]] = Number.isNaN(n) ? arg : n
  }
}

const ws = new WebSocket(URL_)
const done = (code) => {
  try { ws.close() } catch {}
  process.exit(code)
}

const timer = setTimeout(() => {
  console.error(`no answer from the bridge at ${URL_} within 5s`)
  done(1)
}, 5000)

ws.addEventListener('error', () => {
  console.error(`cannot reach the bridge at ${URL_}\nstart it with:  bun tools/bridge.js`)
  done(1)
})

ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, target, cmd })))

ws.addEventListener('message', (ev) => {
  clearTimeout(timer)
  const msg = JSON.parse(ev.data)
  if (msg.error) {
    console.error(msg.error)
    return done(1)
  }
  for (const r of msg.results ?? []) {
    console.log(`${r.avatar}: ${JSON.stringify(r.result)}`)
  }
  if (!msg.results?.length) console.error('no avatar answered')
  done(msg.results?.length ? 0 : 1)
})
