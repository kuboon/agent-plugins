---
name: github-actions-versions
description: >-
  Pin GitHub Actions to current, non-deprecated major versions when writing or
  editing GitHub Actions workflows. Use this skill whenever creating or modifying
  a file under .github/workflows/, writing or reviewing CI/CD YAML, or adding/
  changing any `uses:` step — even when the user does not mention versions at all.
  Model training data lags behind real releases and tends to emit stale versions
  such as `actions/checkout@v4` or `actions/setup-node@v4`. Always consult the
  pinned version table in this skill instead of relying on remembered versions.
---
# GitHub Actions Versions
When you write or edit a GitHub Actions workflow, the `uses:` references you emit
from memory are frequently out of date — `actions/checkout@v4` is the classic
example. This skill exists to override that habit. Before producing any `uses:`
line, look it up in the table below and use the pinned major version.
## Core rule
For every `uses: owner/repo@<ref>` step:
1. If the action is in the **Pinned versions** table, use the exact major tag
   listed there (e.g. `actions/checkout@v7`).
2. If the action is **not** in the table, do not guess a version from memory.
   Either look it up (e.g. the action's GitHub releases page) or tell the user
   you are leaving it unpinned/unverified and why. Silently emitting a remembered
   version is the failure mode this skill prevents.
3. Never emit a version you know to be deprecated (`actions/checkout@v4`,
   `actions/upload-artifact@v3`, `actions/*-pages@vN` mismatches, Node 16/20-only
   majors, etc.) even if the surrounding file or the user's example uses it. If
   the user's existing file uses an old version, upgrade it and mention the bump.
## Pinned versions
**Last verified: 2026-06-23.** These are floating **major** tags. They move
forward automatically within a major version (patch/minor), which is the GitHub-
recommended default for readability. See "Pinning policy" for the stricter SHA
option.
### GitHub-official (`actions/*`)
| `uses:` | Pin | Notes |
|---|---|---|
| `actions/checkout` | `@v7` | Node24. v7 (2026-06) blocks fork PR checkout in `pull_request_target` by default. |
| `actions/setup-node` | `@v6` | Node24; auto-caches npm when `packageManager` is set in package.json. |
| `actions/setup-python` | `@v5` | |
| `actions/setup-go` | `@v5` | |
| `actions/cache` | `@v5` | Node24. |
| `actions/upload-artifact` | `@v7` | Immutable artifacts; `archive: false` allows unzipped single-file uploads. |
| `actions/download-artifact` | `@v8` | Pairs with upload-artifact v7 direct uploads. |
| `actions/configure-pages` | `@v5` | |
| `actions/upload-pages-artifact` | `@v3` | Must be deployed with `deploy-pages@v4` or newer. |
| `actions/deploy-pages` | `@v4` | Requires `id-token: write` + `pages: write` permissions. |
| `actions/github-script` | `@v8` | Node24. |
### Docker
| `uses:` | Pin | Notes |
|---|---|---|
| `docker/setup-qemu-action` | `@v4` | For multi-platform (arm64) emulation. |
| `docker/setup-buildx-action` | `@v4` | Run before `build-push-action` for cache + multi-platform. |
| `docker/login-action` | `@v4` | |
| `docker/metadata-action` | `@v6` | Generates tags/labels. |
| `docker/build-push-action` | `@v7` | |
### JS/TS runtimes & package managers
| `uses:` | Pin | Notes |
|---|---|---|
| `pnpm/action-setup` | `@v4` | The established pnpm installer. (A newer all-in-one `pnpm/setup@v1` also installs a runtime; only use it if the user asks.) |
| `oven-sh/setup-bun` | `@v2` | |
| `denoland/setup-deno` | `@v2` | Defaults to Deno v2.x; supports `cache: true`. |
### Deploy / release / coverage / security
| `uses:` | Pin | Notes |
|---|---|---|
| `cloudflare/wrangler-action` | `@v3` | Action major is v3; it defaults to installing Wrangler v4. Pin `wranglerVersion:` if a specific CLI is needed. |
| `softprops/action-gh-release` | `@v2` | Needs `contents: write`. |
| `codecov/codecov-action` | `@v7` | |
| `github/codeql-action` | `@v4` | The `init`/`analyze`/`autobuild` steps all share this version. |
### Rust
| `uses:` | Pin | Notes |
|---|---|---|
| `dtolnay/rust-toolchain` | `@stable` | This action is referenced by a **rolling channel tag** (`@stable`, `@nightly`, `@1.85.0`), not a `vN` major tag. Do not write `@v1`. |
| `Swatinem/rust-cache` | `@v2` | Place after the toolchain step. |
## Pinning policy
The table uses floating major tags (`@v7`). This is the default GitHub recommends
for readability and is what to emit unless the user asks for something stricter.
If the user wants **maximum supply-chain hardening**, pin to a full commit SHA with
the version in a trailing comment instead:
```yaml
- uses: actions/checkout@<40-char-sha> # v7.0.0
```
SHA pins do not auto-receive patch updates, so they need Dependabot/Renovate to
stay current. Offer this only when the user signals security sensitivity; don't
fabricate a SHA — if you don't have the real commit hash, emit the major tag and
say a SHA can be added later.
## Maintenance note
These pins were captured on the "Last verified" date and **will drift**. They are
a snapshot, deliberately not a live lookup, so workflow generation is fast and
deterministic. When a pin is clearly stale (a new major has shipped and the user
mentions it, or a deprecation warning is in play), say so and update, rather than
silently trusting the table forever. To refresh the whole table, re-check each
action's GitHub releases page (or `gh api repos/<owner>/<repo>/releases/latest`).
## Examples
**Example 1 — minimal Node CI (user said nothing about versions):**
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
```
**Example 2 — upgrading a stale file.** User pastes a workflow using
`actions/checkout@v4` and `actions/setup-node@v4`. Rewrite the `uses:` lines to
`@v7` / `@v6` and add a one-line note: "Bumped checkout v4→v7 and setup-node
v4→v6 (v4 of both is deprecated / runs on EOL Node)."
**Example 3 — Deno + Cloudflare deploy:**
```yaml
- uses: actions/checkout@v7
- uses: denoland/setup-deno@v2
  with:
    deno-version: v2.x
- run: deno test -A
- uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```
**Example 4 — action not in the table.** User adds `peter-evans/create-pull-request`.
It is not pinned here, so don't invent `@v6` from memory — either look up its
current release or write the step and flag: "I left create-pull-request unpinned;
confirm the current major (or I can look it up)."
