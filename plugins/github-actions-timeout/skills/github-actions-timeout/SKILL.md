---
name: github-actions-timeout
description: >-
  Every job in a GitHub Actions workflow needs an explicit `timeout-minutes`,
  because the default is 360 — a hung job burns six hours of Actions quota
  before GitHub kills it. Use this skill whenever creating or editing a file
  under `.github/workflows/`, writing or reviewing CI/CD YAML, authoring a
  reusable workflow, or reviewing a workflow for cost and runaway safety —
  and when a job has overrun, a bill or free-minutes quota was consumed
  unexpectedly, or someone asks how long a job is allowed to run. Covers the
  value to pick, the two places the setting cannot go, and step-level timeouts.
---

# Always set `timeout-minutes`

## The rule

Every job gets an explicit `timeout-minutes`. **Default to `10`** — most of
kuboon's projects finish well inside that. Raise it deliberately for a job you
know is slower (a large matrix build, an e2e suite), and say why in a comment.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - run: deno task test
```

## Why: the default is six hours

From the workflow syntax reference, `jobs.<job_id>.timeout-minutes` is "the
maximum number of minutes to let a job run before GitHub automatically cancels
it. **Default: 360**."

So a job that hangs — a wedged test runner, a process waiting on stdin, a
watcher that never exits, a network call with no timeout of its own — does not
fail fast. It sits there for **six hours**, billing the whole time, until it
hits GitHub's hard cap for hosted runners: "Each job in a workflow can run for
up to 6 hours of execution time. If a job reaches this limit, the job is
terminated and fails." That cap is not adjustable.

Two things make it worse than it sounds:

- **A matrix multiplies it.** Six hours *per leg*, in parallel.
- **On self-hosted runners the limit is 5 days**, not 6 hours. A missing
  timeout there is two orders of magnitude worse.

Who pays: Actions is free for **public** repositories on standard GitHub-hosted
runners, and for self-hosted runners. **Private** repositories draw down the
account's included minutes. **Larger runners are always charged — even on public
repositories**, so "it's a public repo" is not a reason to skip the timeout.

## Two places it cannot go

**1. There is no workflow-wide default.** `defaults:` only carries
`defaults.run.shell` and `defaults.run.working-directory` — there is no
`defaults.timeout-minutes`, and no top-level one either. It goes on **every
job**, individually. Don't go looking for the one-line version; it doesn't
exist.

**2. Not on a job that calls a reusable workflow.** A `uses:` job accepts only
`uses`, `with`, `secrets`, `needs`, `if`, `name`, `permissions`, `strategy`,
`concurrency` and `cache-mode` — `timeout-minutes` is not among them:

```yaml
jobs:
  pages:
    uses: owner/repo/.github/workflows/build.yaml@v1
    timeout-minutes: 10   # ← not a valid key here
```

The timeout has to live on the jobs **inside the called workflow**. Which means:
when you author a reusable workflow, its jobs need timeouts more than anyone
else's, because no caller can add one afterwards.

## Step-level timeouts

`timeout-minutes` also exists per step, with **maximum 360** and no default of
its own — an un-timed step is bounded only by its job. Use it to isolate the one
step that can actually hang, so the rest of the job's budget isn't the thing
protecting you:

```yaml
      - run: ./scripts/wait-for-service.sh
        timeout-minutes: 2
```

A job timeout is the backstop; a step timeout is the diagnosis — the failed step
names itself in the log instead of leaving you with "the job timed out".

Fractional values are not supported; `timeout-minutes` must be a positive
integer.

## Reviewing an existing workflow

```bash
# every job that has no timeout-minutes
rg -n '^\s{2}[a-z_-]+:$' -A6 .github/workflows/ | rg -v 'timeout-minutes'
```

Read it as a budget question, not a style one: for each job, what is the longest
this should ever legitimately take, and what happens to the bill if it doesn't
finish? If a job genuinely needs hours, that is fine — write the number and the
reason, so the six-hour default is never what decides.

## Checklist

- [ ] Every `runs-on:` job has `timeout-minutes:`.
- [ ] The value is a deliberate number (10 unless there's a reason), not 360.
- [ ] Reusable workflows you author set it on their own jobs — callers can't.
- [ ] Any step that can hang on the network or a prompt has its own, tighter
      step timeout.
