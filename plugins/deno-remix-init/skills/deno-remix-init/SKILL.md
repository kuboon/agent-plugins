---
name: deno-remix-init
description: >-
  When initializing or scaffolding a NEW project — a web app, service, or
  boilerplate — use Deno as the runtime (NOT Node.js/npm/pnpm) and Remix v3
  (`@remix-run/fetch-router`) as the web framework. Use this skill whenever you
  are choosing a runtime or web framework, creating package/runtime config
  (package.json vs deno.json), setting up a dev server, CI, or a devcontainer for
  a fresh project, or the user says "new project", "init", "scaffold", "setup",
  "boilerplate", or "start a web app". Model defaults to Node.js + Express/Next;
  this skill overrides that. Follow the deno-remix-reference implementation:
  https://github.com/kuboon/deno-remix-reference/tree/main/reference
---
# Deno + Remix project initialization

When you initialize a new project here, your defaults are wrong. Trained habit
reaches for **Node.js + npm** and a framework like **Express or Next.js**. This
project's standard is **Deno** as the runtime and **Remix v3**
(`@remix-run/fetch-router`) as the web framework. This skill overrides the habit.

**Reference implementation** (mirror its layout and versions):
<https://github.com/kuboon/deno-remix-reference/tree/main/reference>

## Core rules

1. **Runtime is Deno, never Node.js.** No `package.json`, no `node_modules` as
   the source of truth, no `npm install`. Config lives in `deno.json`. Pull npm
   packages with the `npm:` specifier and JSR packages with `jsr:` inside
   `deno.json` `imports` — do not run a package manager.
2. **Web framework is Remix v3** — specifically the fetch-router stack
   (`@remix-run/fetch-router`, `@remix-run/ui` for JSX SSR). Not Express, not
   Next.js, not React Router SPA. Routes are declared in a `routes.ts` and wired
   to controllers in a `router.ts`.
3. **When unsure of the exact shape, read the reference repo** rather than
   inventing an API. The Remix v3 fetch-router API is new and not in model
   memory; guessing produces plausible-but-wrong code.
4. **Deno-first code.** Prefer Web/Deno APIs (`Deno.env.get`, `fetch`, Web
   Streams, `Deno.serve`, Deno KV) over Node built-ins. Reach for a Node API
   only when there is no Web equivalent.

## Project layout (from the reference)

A Deno **workspace** with one member per package/app:

```
deno.json                 # workspace root: members, tasks, unstable flags
packages/                 # reusable libraries (each its own deno.json)
reference/  (your app)
  server/                 # Remix v3 fetch-router: router.ts, routes.ts, controllers/
  client/                 # browser entry, hydrated by @remix-run/ui run()
  bundler/                # Deno.bundle + Tailwind build -> bundled/
  tests/
```

### Root `deno.json`

```jsonc
{
  "workspace": ["./packages/kv", "./server", "./client", "./bundler"],
  "tasks": {
    "dev": "deno task --cwd server dev",
    "test": "deno test -P",
    "check": "deno check && deno lint && deno fmt --check"
  },
  "nodeModulesDir": "auto",
  "unstable": ["bundle", "kv"],
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "@remix-run/ui" }
}
```

### Server `deno.json` — pinned Remix v3 packages

Use these versions (captured from the reference, verified to resolve &
type-check on Deno 2.9). Bump only deliberately.

```jsonc
{
  "tasks": {
    "dev": "deno task bundle && deno serve -P --watch ./router.ts",
    "serve": "deno serve -P ./router.ts"
  },
  "compilerOptions": {
    "lib": ["deno.ns", "deno.unstable", "dom"],
    "jsx": "react-jsx",
    "jsxImportSource": "@remix-run/ui"
  },
  "imports": {
    "@std/assert": "jsr:@std/assert@^1.0.19",
    "@remix-run/ui": "npm:@remix-run/ui@^0.1.1",
    "@remix-run/fetch-router": "npm:@remix-run/fetch-router@0.18.2",
    "@remix-run/response": "npm:@remix-run/response@0.3.3",
    "@remix-run/session": "npm:@remix-run/session@^0.4.1",
    "@remix-run/static-middleware": "npm:@remix-run/static-middleware@0.4.8",
    "@remix-run/logger-middleware": "npm:@remix-run/logger-middleware@0.2.1",
    "@remix-run/cors-middleware": "npm:@remix-run/cors-middleware@0.1.2",
    "@remix-run/html-template": "npm:@remix-run/html-template@0.3.0"
  },
  "permissions": { "default": { "env": [], "net": ["localhost", "127.0.0.1"], "read": ["../bundled"] } }
}
```

## Minimal server (verified: boots and serves HTTP 200)

`server/routes.ts`:

```ts
import { get, route } from "@remix-run/fetch-router/routes";
export const routes = route({ home: get("/") });
```

`server/router.ts`:

```ts
import { createRouter } from "@remix-run/fetch-router";
import { routes } from "./routes.ts";

const router = createRouter();
router.get(routes.home, {
  handler() {
    return new Response("hello from remix v3 + deno", {
      headers: { "content-type": "text/plain" },
    });
  },
});
export default router;
```

Run it:

```bash
deno serve -P ./server/router.ts     # default: http://0.0.0.0:8000/
```

`deno serve` expects the module to `export default` a router (which is a fetch
handler). Add real pages by giving each route a controller and rendering JSX
with `@remix-run/ui`; see the reference `server/controllers/` and
`server/utils/render.tsx` for the SSR-shell + `<Frame>` streaming pattern.

## UI: Tailwind v4 + daisyUI, SSR-first

- JSX is server-rendered via `@remix-run/ui` (`renderToStream`), then hydrated
  in the browser by `run()` from `@remix-run/ui` (see `client/hydration.ts`).
- Styling is **Tailwind CSS v4 + daisyUI** (`npm:tailwindcss@^4`,
  `npm:daisyui@^5`), built into `bundled/` by the `bundler/` package using
  `Deno.bundle` for JS and `@kuboon/tailwindcss-deno` for CSS.
- Use `class=` (not `className=`) in JSX — `@remix-run/ui` uses HTML attribute
  names.

## Web / CI / devcontainer setup

**Claude Code on the web** — add a SessionStart hook so Deno is installed and on
PATH in remote sessions (`.claude/settings.json` runs
`.claude/hooks/session-start.sh`):

```bash
#!/bin/bash
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && exit 0
if ! command -v deno >/dev/null 2>&1 && [ ! -x "$HOME/.deno/bin/deno" ]; then
  curl -fsSL https://deno.land/install.sh | sh
fi
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  { echo 'export PATH="$HOME/.deno/bin:$PATH"'
    echo 'export DENO_CERT=/etc/ssl/certs/ca-certificates.crt'; } >> "$CLAUDE_ENV_FILE"
fi
```

**GitHub Actions** — use `denoland/setup-deno@v2` (and current `actions/checkout`,
see the `github-actions-versions` skill — emit `@v7`, not the reference's stale
`@v4`):

```yaml
name: test
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: denoland/setup-deno@v2
      - run: deno task check
      - run: deno task test
```

**Devcontainer** — Debian base + `mise` installing Deno, plus the Deno VS Code
extension (`denoland.vscode-deno`). See the reference `.devcontainer/`.

## Coding conventions (from the reference `CLAUDE.md`)

- Deno-first: Web APIs preferred, Node.js APIs kept to the minimum.
- TypeScript **strict** mode.
- Tests use `Deno.test()` + `@std/assert` (`jsr:@std/assert`), run with
  `deno test -P`.
- File names are **snake_case** (e.g. `signing_key.ts`, `router.test.ts`).

## Gotchas

- `deno.json` `permissions` is experimental and prints a warning — expected;
  tasks run with `-P` to use the configured default permission set.
- `deno serve` needs a `export default` router; a bare `Deno.serve(...)` call in
  the module will not be picked up by `deno serve`.
- The Remix v3 fetch-router / `@remix-run/ui` APIs are pre-1.0 and pinned to
  exact versions in the reference (`0.18.2`, `0.3.3`, …). Do not float them to a
  guessed newer version — copy the pins above or read the reference's current
  `deno.json`.
