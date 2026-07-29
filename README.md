# agent-plugins

A [Claude Code](https://code.claude.com) plugin marketplace.

## Installation

### Install every skill into user scope with APM

To install **all** skills in this repo into your user-level skills
(`~/.claude/skills/`) — so they load in every project, no per-session setup — use
[APM](https://github.com/microsoft/apm) and the root `apm.yml`. One command, no
`git clone` (APM fetches the repo for you):

```bash
pip install apm-cli                    # or: curl -sSL https://aka.ms/apm-unix | sh
apm install -g kuboon/agent-plugins
```

`-g` installs to user scope; the `apm.yml` here enumerates every skill, so all of
them land in `~/.claude/skills/`. Add a skill to the repo, add one line to
`apm.yml`, and the next `apm install -g` picks it up.

### Or per-plugin, using the `claude` CLI (the non-interactive equivalent)

```bash
claude plugin marketplace add kuboon/agent-plugins
claude plugin install github-actions-versions@agent-plugins
claude plugin install deno-remix-init@agent-plugins
claude plugin install browser-how-to@agent-plugins
claude plugin install github-page-preview@agent-plugins
claude plugin install uint8array-base64@agent-plugins
claude plugin install remix-ui-text-field-editable@agent-plugins
claude plugin install admin-view-toggle@agent-plugins
```

## Plugins

### `github-actions-versions`

Pins GitHub Actions to current, non-deprecated major versions when writing or
editing GitHub Actions workflows. Ships a skill that overrides the model's habit
of emitting stale `uses:` references (e.g. `actions/checkout@v4`) with a
maintained version table.

### `deno-remix-init`

When initializing a new project, uses **Deno** (not Node.js) as the runtime and
**Remix v3** (`@remix-run/fetch-router`) as the web framework. Ships a skill that
overrides the model's Node.js + Express/Next default with the pinned package set,
project layout, and CI/devcontainer setup from
[deno-remix-reference](https://github.com/kuboon/deno-remix-reference/tree/main/reference).

### `browser-how-to`

When integrating **Add to Home Screen** (a2hs), **passkeys**, or **web push**
into a web frontend, uses the
[`@kuboon/browser-how-to`](https://kuboon.github.io/browser-how-to/) library to
detect device/browser support, escape in-app browsers (Messenger, LINE, etc.),
and guide users — instead of hand-rolling UA sniffing. Ships a skill covering the
JSR install, tree-shakeable subpaths, `show*Guide()` UI vs. headless detection,
and the iOS-push-needs-a2hs ordering.

> Sourced externally from the library's own repo
> ([`kuboon/browser-how-to`](https://github.com/kuboon/browser-how-to)) so the
> skill stays next to the implementation — the marketplace entry points at it via
> a `github` source, and `apm.yml` depends on `kuboon/browser-how-to` directly.

### `github-page-preview`

When deploying a static site to **GitHub Pages** with **per-PR preview**
deployments, calls kuboon's reusable workflow
[`github-page-with-preview.yaml`](https://github.com/kuboon/workflows/blob/main/.github/workflows/github-page-with-preview.yaml)
instead of hand-writing the pages job chain. Ships a skill with the caller
workflow, its inputs, and the requirements (Pages source, a `mise`/custom build,
and the essential `BASE_URL`-aware build for correct preview subpaths).

### `uint8array-base64`

For base64 (and hex) in JavaScript, uses the native
`Uint8Array.fromBase64()` / `toBase64()` / `setFromBase64()` methods — binary-safe
and cross-runtime (Deno + browser) — instead of `btoa`/`atob` string juggling or
Node-only `Buffer`. Ships a skill with the API, base64url/omitPadding recipes,
`TextEncoder`/`TextDecoder` combos, and a feature-detect fallback.

### `remix-ui-text-field-editable`

When writing a freely-typed text input in `@remix-run/ui` (Remix v3), uses
`defaultValue=` instead of `value=`. Binding `value=` to state makes the field
uneditable — the framework's controlled-value reflection runs in a queued
microtask and reverts each keystroke unless the state write lands synchronously.
Ships a skill covering the failure mode, the `ref` mixin for reading values
outside handlers, and the `defaultChecked` equivalent.

### `admin-view-toggle`

When building a feature whose UI differs by privilege, ships a **frontend-only
「一般 / admin」 view switch** for admin users, so one account can eyeball both
UIs in the same tab while developing. Ships a skill with the single-derived-flag
shape (`isAdminView = actualIsAdmin && viewRole === "admin"`), the stray
`user.isAdmin` leak to grep for, cookie-vs-localStorage persistence and the
masked-mode indicator, and the hard line that the backend never reads the toggle
— it always authorizes on the real role, so this tests layout, never
authorization.
