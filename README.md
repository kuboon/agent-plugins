# agent-plugins

A [Claude Code](https://code.claude.com) plugin marketplace.

## Installation

Inside a Claude Code session, add this marketplace and install the plugin you
want:

```
/plugin marketplace add kuboon/agent-plugins
/plugin install github-actions-versions@agent-plugins
/plugin install deno-remix-init@agent-plugins
/plugin install browser-how-to@agent-plugins
```

Or from a shell, using the `claude` CLI (the non-interactive equivalent):

```bash
claude plugin marketplace add kuboon/agent-plugins
claude plugin install github-actions-versions@agent-plugins
claude plugin install deno-remix-init@agent-plugins
claude plugin install browser-how-to@agent-plugins
```

No global install? Drive the same CLI through `npx`:

```bash
npx @anthropic-ai/claude-code plugin marketplace add kuboon/agent-plugins
npx @anthropic-ai/claude-code plugin install github-actions-versions@agent-plugins
npx @anthropic-ai/claude-code plugin install deno-remix-init@agent-plugins
npx @anthropic-ai/claude-code plugin install browser-how-to@agent-plugins
```

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
