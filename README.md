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
claude plugin install deno-min-dep-age@agent-plugins
claude plugin install remix-v3-upgrade@agent-plugins
claude plugin install remix-db-migrations-deno@agent-plugins
claude plugin install stacked-prs@agent-plugins
claude plugin install game-feel@agent-plugins
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
「一般 / admin」 view switch** for admin users — **defaulting to 一般**, so an
admin sees the regular UI and switches to admin only to use a privileged
feature. Ships a skill with the single-derived-flag shape (real role is admin
**and** view preference is admin), the stray `user.isAdmin` leak to grep for,
cookie-vs-localStorage persistence and the admin-mode indicator, and the hard
line that the backend never reads the toggle — it always authorizes on the real
role, so this tests layout, never authorization.

### `deno-min-dep-age`

When a Deno dependency bump is refused by **`minimumDependencyAge`** (24h by
default since Deno 2.9, even when unset), exempts the self-published
`@kuboon` scope with `minimumDependencyAge.exclude` instead of lowering the age
or passing `--min-dep-age 0` — scoped trust, not a disabled supply-chain delay.
Ships a skill with the error signature to recognize, the `jsr:@kuboon/*` scope
wildcard, and the exclude-entry rules verified against Deno 2.9.4 (the `jsr:`/
`npm:` prefix is mandatory, a version suffix is silently ignored, and exclusion
does not cascade to transitive dependencies).

### `remix-v3-upgrade`

Upgrades a **Remix v3** project across beta and rc boundaries — currently up to
`3.0.0-rc.1`. Ships a skill with the `@remix-run/*` version table for each hop
and a before/after diff for every breaking change.

Which release to land on is itself a trap: `beta.7` and `beta.8` were never
published, and **`beta.9` cannot install** — it pins a renamed
`@remix-run/static-files-middleware@^0.1.0` that only exists as a `0.0.0`
placeholder. Go `beta.6` → `beta.10` → `rc.1`.

`beta.10` → `rc.1` moves ten packages, and one of them breaks silently:
`ui@0.8.0` renames **every** `rmx-*` DOM attribute to `data-rmx-*`
(`rmx-document`, `rmx-target`, `rmx-src`, `rmx-history`, `rmx-reset-scroll`,
`rmx-preserve-dom`, plus `data-key` → `data-rmx-key`) with no alias and no
warning. TypeScript does not check hyphenated JSX attribute names, so the old
spelling still compiles and still renders — the only symptom is behavioral, such
as a nav link changing the URL without changing the view. The skill carries the
rename table, the grep that finds them, and the `addEventListeners` removal that
lands in the same bump.

`beta.6` → `beta.10` moves only three packages: `static-middleware@0.4.14`
finally widens its `fetch-router` range, so the `as unknown as Middleware` cast
on `staticFiles()` (and any package-manager override) can be deleted — verified
both ways with `deno check`; and `ui@0.7.0` gives `run()` a **default frame
resolver**, which means every `run()` call now intercepts same-origin link and
form navigation, even in apps that never passed a resolver.

The `beta.5` → `beta.6` section is the large one: data-table dropping adapters
for `create*Database()` and `DatabaseDriver`, the browser
`resolveFrame(src, options)` signature, `href()`/`createHref()` taking an options
object, delimiter-bounded route params that reject `/:year-:month`, session
cookies defaulting to `HttpOnly`, `createAssetServer`'s `allowFiles`/`denyFiles`,
and the removal of `remix-test`. It leads with the four that compile clean and
fail silently, since those are the ones a bump quietly ships to production.

### `remix-db-migrations-deno`

Runs **`@remix-run/data-table` migrations from Deno** with the Remix v3 CLI's
`remix db` commands. Ships a skill with the `remix.json` `db` config, the
`YYYYMMDDHHmmss_name/up.sql` + `down.sql` directory layout, `deno task` wiring
via `node_modules/.bin`, a rollback script for the one direction the CLI cannot
do, and the Deno-specific traps verified on Deno 2.9.4: bare `npm:remix`
resolving Remix **v2** (`Failed resolving binary export`), `node:sqlite` working
with no extra dependency while Postgres/MySQL need `pg`/`mysql2` added by hand,
the `--allow-sys` requirement, and the two different bases that relative paths
resolve against. For **Turso / libSQL** — which `remix.json` cannot describe at
all (`Expected one of: sqlite, postgres, mysql at db.adapter.type`) — it points
at the CLI shipped by
[`@kuboon/remix-data-table-sqlite-turso`](https://jsr.io/@kuboon/remix-data-table-sqlite-turso),
which wraps the same `runRemixDb()` the Remix CLI calls and adds the `rollback`
that CLI has no flag for.

> Sourced externally from
> [`kuboon/kuboon-remix-utils`](https://github.com/kuboon/kuboon-remix-utils/tree/main/plugins/remix-db-migrations-deno),
> so the skill stays next to the Turso package it documents — the marketplace
> entry points into that monorepo via a `git-subdir` source, and `apm.yml`
> depends on the same path.

### `stacked-prs`

When a PR is open and there is more work to do, **stacks the next PR on that
branch** instead of waiting for the merge or restarting from `main`. Ships a
skill with the layering rule (a dependency must live in the same branch or a
lower one), the plain-git form and the `gh stack` command table, and the merge
semantics that matter: PRs merge bottom-up, merging the top brings everything
below with it, merging mid-stack auto-retargets the layers above, branch
protection and CI run on **every** layer, and a draft cannot merge as part of a
stack.

### `game-feel`

Adds **game feel / "juice"** — screen shake, hit-stop/freeze frames, eased motion,
squash & stretch, knockback, and layered audio-visual feedback — as
engine-neutral techniques that pair with whatever tween, particle, and camera
APIs the detected engine provides. It adds polish on top of a mechanic that
already works; it does not implement the mechanic.

> **Not written here.** Redistributed from
> [`gamedev-skills/awesome-gamedev-agent-skills`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/game-feel)
> under the **Apache License 2.0** — copyright 2026 Abhishek Barali and the
> awesome-gamedev-agent-skills contributors. The upstream `LICENSE` and `NOTICE`
> ship alongside the copy in
> [`plugins/game-feel/`](plugins/game-feel/), and
> [`PROVENANCE.md`](plugins/game-feel/PROVENANCE.md) records the exact upstream
> commit, the one local modification (the dead `Related skills` section was
> dropped), and the re-copy procedure.
>
> Copied rather than linked so the content is pinned and reviewable: a skill is
> instructions loaded into the model's context, so tracking a third-party
> default branch would let upstream edits reach it without review. Note that this
> one plugin is Apache-2.0, while the rest of this repository is MIT.
