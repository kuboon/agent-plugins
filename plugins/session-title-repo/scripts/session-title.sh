#!/usr/bin/env bash
# SessionStart hook: set the session title to the main repository's name.
# Prints nothing (leaves the title alone) outside a git repository.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# Prefer the origin remote's name; fall back to the main worktree's directory,
# which --git-common-dir resolves to even from inside a linked worktree.
url=$(git remote get-url origin 2>/dev/null)
if [ -n "$url" ]; then
  repo=$(basename "${url%/}" .git)
else
  common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
  repo=$(basename "$(dirname "$common")")
fi
[ -n "$repo" ] || exit 0

# JSON-escape backslashes and double quotes without depending on jq.
repo=${repo//\\/\\\\}
repo=${repo//\"/\\\"}
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","sessionTitle":"%s"}}\n' "$repo"
