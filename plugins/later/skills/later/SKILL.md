---
name: later
description: >-
  /later <idea> — park a next-task idea that came up mid-session so it is not
  forgotten, without derailing the current work. Turns the idea into a
  Suggested task card (the spawn_task tool) whose prompt stands on its own, so
  it can be started later as a fresh session with one click. Invoke only when
  the user types /later (or explicitly asks to "park this for later" /
  「後でやる」「あとで」として残して); never on your own initiative.
argument-hint: <やりたいこと / what to do later>
disable-model-invocation: true
---

# /later — park a task for later

The user had an idea for a **next** task while you are in the middle of
something else. They want it written down durably, **not done now**.

The idea is in the arguments: `$ARGUMENTS`

## Rules

1. **Do not start the parked task.** No investigation, no edits, no commands
   for it beyond the few needed to write a good prompt (step 2).
2. **Do not drop the current work.** After parking, carry on exactly where you
   were. If you were mid-turn, resume; if you were idle, say it is parked and
   stop.
3. If `$ARGUMENTS` is empty, ask in one line what to park, and nothing else.

## Steps

### 1. Find the tool

The card is made by the `spawn_task` tool (usually
`mcp__ccd_session__spawn_task`). It may be deferred: if it is not loaded, run
ToolSearch with `spawn_task` first. It exists only where the Claude app can
show task cards, so it may be missing — see step 4.

The user explicitly asked for this task to be queued, so calling `spawn_task`
for it is correct even though its own description discourages queuing things
the user asked for: that caveat is about splitting off parts of the current
task, not about an explicit /later.

### 2. Write a standalone prompt

A card starts a **new session from the prompt alone**, possibly on a fresh
checkout without this session's uncommitted changes, and possibly days later.
So the prompt must carry everything the idea depends on:

- **Goal** — the user's idea, faithfully. Keep their wording (and language);
  do not inflate the scope or add requirements they did not state. Mark your
  own guesses as guesses.
- **Where** — the repository (`owner/repo` from `git remote get-url origin`)
  and, if relevant, the branch / PR it builds on. Files by
  **repository-relative path** only; absolute paths of this container won't
  exist there.
- **Context from this conversation** that the idea leans on: what "it" or
  "that bug" refers to, decisions already made, what was ruled out, relevant
  PR / issue links (full URLs). Only what the task needs — a short paragraph
  or a few bullets, not a transcript.
- **Done when** — one line on what finished looks like, if it is clear. If it
  is not, say the first step is to clarify scope with the user.
- Never copy secrets or tokens; say where they live instead.

Resolve vague references using the conversation (e.g. "the flaky test" →
which test, which file). A quick `git remote` / `git branch --show-current`
is fine; anything heavier is doing the task, not parking it.

### 3. Call spawn_task

- `title`: imperative phrase, under 60 characters, in the user's language
  (e.g. 「ログイン画面に passkey を追加」, "Add passkey login").
- `tldr`: one or two plain sentences — what and why. No paths.
- `prompt`: the standalone prompt from step 2.

Then reply in **one or two lines**: that it is parked, its title, and that you
are going back to the current work. Don't restate the prompt.

### 4. If spawn_task is unavailable

Don't silently drop it and don't substitute a different store unasked.
Say in one line that the card tool isn't available in this session, then
output the title and prompt in a single fenced block so the user can copy it
into a new session or their notes:

````markdown
```text
# <title>

<standalone prompt>
```
````

Then resume the current work.
