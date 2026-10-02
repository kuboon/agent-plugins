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
  this skill overrides that. Follow the deno-remix-tmpl template:
  https://github.com/kuboon/deno-remix-tmpl/tree/main/web
---
# Deno + Remix project initialization

When you initialize a new project here, your defaults are wrong. Trained habit
reaches for **Node.js + npm** and a framework like **Express or Next.js**. This
project's standard is **Deno** as the runtime and **Remix v3**
(`@remix-run/fetch-router`) as the web framework. This skill overrides the habit.

**Reference implementation** (mirror its layout and versions) is the GitHub
template [`kuboon/deno-remix-tmpl`](https://github.com/kuboon/deno-remix-tmpl);
the app is under
[`web/`](https://github.com/kuboon/deno-remix-tmpl/tree/main/web). Prefer
creating the project **from that template** and following its `TEMPLATE.md`
(static vs. server mode, then the two init stages) over scaffolding by hand.

## Core rules

1. **Runtime is Deno, never Node.js.** No `package.json`, no `node_modules` as
   the source of truth, no `npm install`. Config lives in `deno.json`. Pull npm
   packages with the `npm:` specifier and JSR packages with `jsr:` inside
   `deno.json` `imports` — do not run a package manager.
2. **Web framework is Remix v3** — specifically the fetch-router stack
   (`@remix-run/fetch-router`, `@remix-run/ui` for JSX SSR). Not Express, not
   Next.js, not React Router SPA. Routes are declared in a `routes.ts` and wired
   to controllers in a `router.tsx`.
3. **When unsure of the exact shape, read the reference repo** rather than
   inventing an API. The Remix v3 fetch-router API is new and not in model
   memory; guessing produces plausible-but-wrong code.
4. **Deno-first code.** Prefer Web/Deno APIs (`Deno.env.get`, `fetch`, Web
   Streams, `Deno.serve`, Deno KV) over Node built-ins. Reach for a Node API
   only when there is no Web equivalent.

## Project layout (from the template)

A Deno **workspace**; the app is two members, one for each side of the wire:

```
deno.json                 # workspace root: members, tasks, imports (all of them), unstable flags
packages/                 # reusable libraries (each its own deno.json)
web/
  client/                 # everything the browser is given: routes.ts, pages/, islands/, layout.tsx,
                          #   static/ — type-checked WITHOUT deno.ns, so no `Deno.` in here
  server/                 # router.tsx, assets.ts (Deno.bundle of client/), controllers/, config.ts
  tests/                  # browser smoke tests
```

`server/router.tsx` default-exports a plain `@remix-run/fetch-router` router.
`deno serve` runs it live (Deno Deploy); `@remix-kbn/ssg` can crawl the same
object into static HTML for GitHub Pages. Imports are declared once, in the root
`deno.json` — the members have none.

**Pin exactly what the template pins.** Several Remix v3 packages break silently
when floated (for example `@remix-run/render-middleware@0.3.3` renders an empty
`<body>` with `@remix-run/ui@0.11`). Copy the root `deno.json` `imports` from the
template instead of choosing versions.

## Minimal server (verified: boots and serves HTTP 200)

`client/routes.ts` (routes live in `client/` because pages link with `routes.x.href()`):

```ts
import { get, route } from "@remix-run/fetch-router/routes";
export const routes = route({ home: get("/") });
```

`server/router.tsx`:

```ts
import { createRouter } from "@remix-run/fetch-router";
import { routes } from "../client/routes.ts";

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
deno serve -P ./server/router.tsx    # default: http://0.0.0.0:8000/
```

`deno serve` expects the module to `export default` a router (which is a fetch
handler). Real pages are `client/pages/*.tsx` components mapped by a
`createController(routes, …)` in `server/router.tsx`; see the template's
`web/server/router.tsx` for the full wiring (assets, rendering, static files).

## UI: `@remix-run/ui`, SSR-first

- JSX is server-rendered through the `render({ assets })` middleware
  (`@remix-run/render-middleware`), then hydrated in the browser by `run()` from
  `@remix-run/ui`. Interactive pieces are islands: `clientEntry(import.meta.url,
  function Name…)` files under `web/client/islands/`, compiled as one code-split
  graph by `@remix-kbn/assets-deno`.
- Styling is `css()` mixins from `@remix-run/ui` plus the design tokens in
  `web/client/tokens.ts` and `static/app.css` — no Tailwind, no daisyUI, no
  separate bundler package.
- Use `class=` (not `className=`) in JSX — `@remix-run/ui` uses HTML attribute
  names — and `mix={[…]}` for mixins and event handlers.

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
    timeout-minutes: 10
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
- The Remix v3 fetch-router / `@remix-run/ui` APIs are pre-1.0 and pinned in the
  template. Do not float them to a guessed newer version — copy the pins from the
  template's root `deno.json`.
