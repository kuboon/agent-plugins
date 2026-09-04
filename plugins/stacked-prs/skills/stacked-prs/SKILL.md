---
name: stacked-prs
description: >-
  When a pull request is open and the next piece of work follows or depends on
  it, stack the next PR on top of that branch instead of waiting for the merge
  or restarting from the default branch. Use this skill whenever finishing a
  change while an earlier PR of yours is still unmerged, when the user says to
  stack / 積み上げる, when picking the base branch for a new PR, or when working
  with a PR that is already part of a stack (`gh stack`, a stack map in the
  merge box, retargeted base branches). Covers the layering rule, the `gh stack`
  commands, and bottom-up merge semantics.
---

# Stacked pull requests

## The rule

**An open PR of yours is not a reason to stop.** When the next task follows the
one under review, branch off that PR's head and open the next PR with its base
set to that branch.

Do **not** instead:

- wait for the merge before starting the next change;
- restart the next change from `main`, which either loses the earlier work or
  produces a diff that conflicts with it;
- pile the next change onto the open PR, which grows the diff under review.

The user merges the whole stack in one action, so a long stack is fine.

```text
   ┌── feat/frontend     → PR #3 (base: feat/api)   ← top
  ┌── feat/api           → PR #2 (base: feat/schema)
 ┌── feat/schema         → PR #1 (base: main)       ← bottom
main (trunk)
```

Each PR shows only its own layer's diff, so reviewers get small, focused
changes. **The layering rule:** if code in one layer depends on code in
another, the dependency must be in the same branch or a lower one — foundations
(shared types, schema) at the bottom, dependents (routes, UI) above. Start a new
layer when the concern changes, or when the current one is already big enough to
review.

## Doing it

Plain git plus PR creation is enough — the base branch is what makes it a stack:

```bash
git switch -c feat/api feat/schema     # branch off the open PR's head
# ... work, commit, push -u ...
# create the PR with base = feat/schema, not main
```

The `gh stack` extension (`gh extension install github/gh-stack`) manages the
chain instead:

| Command | Use |
| --- | --- |
| `gh stack init [branch]` | start a stack (`--base` for a non-default trunk) |
| `gh stack add -Am "msg"` | commit and add a layer on top (must be on the top branch) |
| `gh stack submit` | push every branch, open/update each PR, link them as a stack |
| `gh stack sync` | fetch, cascade-rebase, push, refresh PR state |
| `gh stack rebase` | cascade rebase only; `--continue` / `--abort` on conflict |
| `gh stack view --short` | see the chain and its PR numbers |
| `gh stack merge [<pr>]` | merge bottom-up through that PR, all-or-nothing |

`gh stack submit` starts a fresh stack automatically if every PR in the old one
already merged.

## Merge semantics

- PRs merge **bottom-up**. Merging the **top** PR brings everything below with
  it; merging a **mid-stack** PR merges the ones below and leaves the ones above
  open, automatically retargeted to the trunk.
- When the bottom merges, GitHub **cascade-rebases the rest** for you — that is
  the part that makes stacks worth using.
- Merge requirements come from the **bottom PR's base branch**. Branch
  protection and CI run on **every** layer, mid-stack included, so a red check
  anywhere blocks that layer.
- Merge commit, squash, and rebase all work, and stacks are merge-queue aware.
  The resulting history matches merging each PR individually from the bottom.
- **A draft cannot merge as part of a stack.** If the user intends to merge the
  stack, mark the layers ready for review.

## Limits

Stacked PRs are in public preview. **Not supported:** cross-fork PRs and GitHub
Desktop. Merging a stack through the API needs the *asynchronous* merge
endpoint, not the ordinary one. Available in the web UI, `gh`, mobile, and via
webhooks (a `stack` object on `pull_request` events), REST, and GraphQL.

Reference: [About stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[CLI commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands).
