# agent-plugins

A [Claude Code](https://code.claude.com) plugin marketplace.

## Installation

Inside a Claude Code session, add this marketplace and install the plugin you
want:

```
/plugin marketplace add kuboon/agent-plugins
/plugin install github-actions-versions@agent-plugins
/plugin install deno-remix-init@agent-plugins
```

Or from a shell, using the `claude` CLI (the non-interactive equivalent):

```bash
claude plugin marketplace add kuboon/agent-plugins
claude plugin install github-actions-versions@agent-plugins
claude plugin install deno-remix-init@agent-plugins
```

No global install? Drive the same CLI through `npx`:

```bash
npx @anthropic-ai/claude-code plugin marketplace add kuboon/agent-plugins
npx @anthropic-ai/claude-code plugin install github-actions-versions@agent-plugins
npx @anthropic-ai/claude-code plugin install deno-remix-init@agent-plugins
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
