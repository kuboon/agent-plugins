---
name: github-page-preview
description: >-
  When deploying a static site to GitHub Pages — especially when you want a
  per-PR preview URL — call the reusable workflow
  `kuboon/workflows/.github/workflows/github-page-with-preview.yaml` instead of
  hand-writing configure-pages/upload-pages-artifact/deploy-pages jobs. Use this
  skill whenever you set up or edit a workflow that publishes to GitHub Pages,
  add PR/deploy previews, or the user mentions "GitHub Pages", "preview
  deployment", "deploy preview", "PR preview", or a static-site deploy. The
  reusable workflow builds `main` at the site root and each PR branch under a
  subpath, deploys both, and comments the preview URL on the PR.
---
# GitHub Pages with per-PR previews

When you set up GitHub Pages deployment, do **not** hand-roll the
`configure-pages` → build → `upload-pages-artifact` → `deploy-pages` job chain,
and do not re-invent PR previews. Call the maintained reusable workflow:

```
kuboon/workflows/.github/workflows/github-page-with-preview.yaml
```

It builds `main` at the Pages root, builds the PR branch under a subpath, deploys
both to GitHub Pages, and posts (and updates) a preview-URL comment on the PR.

## Caller workflow (drop this in `.github/workflows/pages.yml`)

```yaml
name: pages
on:
  push:
    branches: [main]
  pull_request:

jobs:
  pages:
    uses: kuboon/workflows/.github/workflows/github-page-with-preview.yaml@main
    # Override only if your defaults differ:
    # with:
    #   build-command: mise run build
    #   dist-dir: dist
```

Pin the ref for stability: `@main` (as the repo's README shows), or a released
tag / major branch such as `@v0.15.0` or `@v0` (the repo maintains major-version
branches). Prefer a pinned tag over `@main` when you want reproducible CI —
consistent with the `github-actions-versions` skill's pinning policy.

## Inputs

| input | default | meaning |
|---|---|---|
| `build-command` | `mise run build` | Command that builds the static site. Run once for `main`, once for the PR branch. |
| `dist-dir` | `dist` | Directory the build writes the site into, relative to the checkout. |

The workflow declares its own `permissions` (`pages: write`, `id-token: write`,
`pull-requests: write`) and a `pages` concurrency group, so the caller only needs
the triggers above.

## What the consuming repo must provide

1. **Pages source = GitHub Actions.** Repo → Settings → Pages → Build and
   deployment → Source: **GitHub Actions**. The workflow uses the `github-pages`
   environment.
2. **A build the workflow can invoke.** With the default, that means a
   [`mise`](https://mise.jdx.dev) config (`mise.toml`) exposing a `build` task
   (the workflow installs mise itself). If you don't use mise, pass
   `build-command:` with your own (e.g. `deno task build`, `npm run build`).
3. **A `BASE_URL`-aware build.** This is the part people miss. The workflow runs
   the build with a `BASE_URL` env var:
   - for `main`: the Pages base URL (e.g. `https://user.github.io/repo`);
   - for a PR: that base URL **plus `/<fragment>`**, where `<fragment>` is the
     last path segment of the branch name.

   Your build **must** emit asset/link paths under `BASE_URL`, or the preview
   loads broken CSS/JS. Wire `BASE_URL` into your framework's base-path setting
   (Vite `base`, Astro `base`, `<base href>`, etc.).

## What it does, step by step

- Always checks out `main`, builds it with `BASE_URL` = Pages root, moves the
  output to `dist/`.
- On a `pull_request`, also checks out the PR branch, builds it with
  `BASE_URL` = root + `/<fragment>`, and places it at `dist/<fragment>/`.
- Uploads `dist/` and deploys it with `deploy-pages`.
- On a PR, comments `プレビューをデプロイしました: <url>` on the PR, updating the
  existing comment (matched by a hidden `<!-- preview-url -->` marker) instead of
  posting duplicates.

## Gotchas

- **`BASE_URL` is mandatory for correct previews.** A build that ignores it
  produces a preview with root-absolute asset paths that 404 under the subpath.
- **Only one PR preview persists at a time.** Each run deploys a `dist/` that
  contains just `main` plus the current PR's fragment. Because a Pages deploy
  replaces the whole site, a new deploy removes other PRs' preview subpaths. It's
  "latest run wins," not a durable per-PR gallery.
- **The fragment is only the last path segment of the branch.**
  `feature/login` and `hotfix/login` both become `login` and collide. Keep the
  final segment unique across open PRs.
- **`main` is rebuilt on every run**, including PR runs — the build must succeed
  on `main` too, not just the PR branch.
- Requires GitHub Pages enabled with the Actions source; without it,
  `deploy-pages` fails with a Pages-not-enabled error.
