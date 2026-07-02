---
name: run-agent-plugins
description: >-
  Build, validate, run, and smoke-test the agent-plugins Claude Code plugin
  marketplace. Use when asked to run, launch, test, validate, verify, or
  screenshot this repo, to check that the marketplace and its plugins load in
  Claude Code, or after editing any marketplace.json, plugin.json, or SKILL.md.
---
# Run: agent-plugins

This repo is **not** a server or GUI app — it is a **Claude Code plugin
marketplace** (a `.claude-plugin/marketplace.json` at the root plus one or more
plugins under `plugins/*/`). There is nothing to `npm start`. The way you "run"
it is to make the `claude` CLI **validate the manifests** and **actually load,
install, and inventory the plugins** — the plugin `details` inventory is the
analog of a screenshot here (it proves Claude Code discovered the skill).

The harness is [`.claude/skills/run-agent-plugins/driver.sh`](driver.sh). Run it
from the repo root.

> Paths below are relative to the repo root (`<unit>/`).

## Prerequisites

- The `claude` CLI on `PATH` (this environment has it at `/opt/node22/bin/claude`,
  v2.1.197). `claude --version` should print.
- `python3` (used by the driver to read manifest JSON). Already present.

No `apt-get` packages were needed — headless, no display, no browser.

## Run (agent path) — the driver

Default mode validates every manifest in strict mode and mutates nothing:

```bash
.claude/skills/run-agent-plugins/driver.sh            # == validate
```

Full round-trip: add the marketplace to Claude Code, install every plugin it
declares, print each plugin's component inventory, then uninstall + remove so
nothing is left behind (it self-cleans even on failure):

```bash
.claude/skills/run-agent-plugins/driver.sh roundtrip
```

Do both in order:

```bash
.claude/skills/run-agent-plugins/driver.sh all
```

A green `roundtrip` prints, for each plugin, an inventory like:

```
Component inventory
  Skills (1)  github-actions-versions
  Agents (0)
  ...
```

`Skills (1)` (a non-zero component count) is the proof the plugin loaded — the
driver fails the run if a plugin installs with zero components.

## Run it by hand (what the driver automates)

```bash
claude plugin validate . --strict                          # marketplace manifest
claude plugin validate ./plugins/github-actions-versions --strict   # each plugin

claude plugin marketplace add ./                           # NOTE: needs ./ , not bare .
claude plugin install github-actions-versions@agent-plugins
claude plugin details github-actions-versions              # component inventory
claude plugin uninstall github-actions-versions@agent-plugins
claude plugin marketplace remove agent-plugins
```

## Test

There is no unit-test suite. `driver.sh all` is the test: strict validation plus
a full load/install/inventory round-trip.

## Gotchas

- **`claude plugin marketplace add .` is rejected** with "Invalid marketplace
  source format." It wants a path that looks like a path — use `./` (or an
  absolute path, or `owner/repo`). The driver uses `./`.
- **Validating the marketplace does NOT recurse into plugins.**
  `claude plugin validate .` only checks `marketplace.json`; a broken
  `plugins/*/plugin.json` passes. You must validate each plugin dir separately —
  the driver loops over every `plugins/*/.claude-plugin/plugin.json`.
- **`--strict` turns warnings into failures.** Unknown/misspelled manifest
  fields are warnings without it (exit 0, "passed with warnings") and hard
  errors with it (exit 1). Always use `--strict` here so typos don't slip
  through.
- **Install/marketplace state is global user state**, not repo-local — it lands
  in user settings under your home dir, so it leaks across repos. Always tear
  down (the driver's `roundtrip` does this automatically via an EXIT trap).
- **A skill needs the `plugins/<plugin>/skills/<skill>/SKILL.md` layout** with
  valid `name:`/`description:` frontmatter to be counted. If `details` shows
  `Skills (0)`, the file is misplaced or the frontmatter is malformed — the
  manifest can still validate fine, so `details` is the real check.

## Troubleshooting

- `Invalid marketplace source format` on `add` → you passed bare `.`; use `./`.
- `Validation failed (--strict treats warnings as errors)` → read the listed
  `path.to.field: Unknown field` warnings and fix or remove those keys.
- Plugin installs but `details` shows all-zero components → the skill/agent
  files aren't where the plugin manifest expects; check the
  `skills/<name>/SKILL.md` path and frontmatter.
