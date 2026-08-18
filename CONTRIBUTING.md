# Contributing

## Run it

```bash
bun run dev
```

Open <http://localhost:4330>. That's the landing page. `/lab.html` is the
workbench — every one of the 39 states, all the eye types, the spring
parameters, a crowd of avatars at once. Change a file under `src/`, reload,
see it move. There is no build step to wait on.

## Where the code lives

- `src/avatar-motion.js` — the `<avatar-motion>` custom element itself.
- `src/humation.js` — composes a person from the seed, cuts the eyes out,
  measures the head as a sphere.
- `src/engine.js` — the simulation and the draw pass.
- `src/motion/` — gaze, blinking, breathing, the eye-sphere geometry.
- `src/render/` — the paint pass: gradients, texture, icons, emblems.
- `src/states.js` / `src/expressions.js` — the 39 states and the expression
  data that drive them.
- `src/control.js` — the app-facing command API (`avatar.send()`).
- `mcp/server.js` and `bin/avatar.js` — the MCP server and CLI, generated
  from the same command manifest as `src/control.js`.

The full file-by-file map is in the [README](README.md#files).

## House style

- Plain ES modules. No framework, no bundler, no transpiler.
- No dependencies — this project ships to a browser as-is, and every
  dependency added is a dependency someone else has to trust.
- No build step. If a change needs one, it is very likely the wrong change.
- Comments explain **why**, not what. The code already says what it does;
  a comment earns its place by saying why it does it that way — a constant
  measured off real footage, a browser quirk worked around, a trade-off that
  was made on purpose.

## Proposing a change

Open an issue or a pull request against `main`. For anything beyond a small
fix, open an issue first describing what you want to change and why — the
Humation artwork and the eye-motion geometry are both load-bearing on
measured constants, so a change to either needs to say what it's trading off.

Before sending a pull request, run the same check CI runs:

```bash
bun build src/avatar-motion.js src/site.js src/lab.js src/control.js src/variation.js --target=browser --outdir=/tmp/ci-build
```

There is no test suite yet — this is the only automated gate.
