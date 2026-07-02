# agent-plugins

A [Claude Code](https://code.claude.com) plugin marketplace.

## Installation

Add this marketplace, then install the plugin you want:

```
/plugin marketplace add kuboon/agent-plugins
/plugin install github-actions-versions@agent-plugins
```

## Plugins

### `github-actions-versions`

Pins GitHub Actions to current, non-deprecated major versions when writing or
editing GitHub Actions workflows. Ships a skill that overrides the model's habit
of emitting stale `uses:` references (e.g. `actions/checkout@v4`) with a
maintained version table.
