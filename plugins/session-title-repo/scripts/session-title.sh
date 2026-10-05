#!/usr/bin/env bash
# SessionStart hook: set the session title to the main repository's name.
# In a cloud session (CLAUDE_CODE_REMOTE=true) it also asks the model to set
# "<repo>: <summary>" through set_session_title, since sessionTitle alone does
# not reach claude.ai there. Prints nothing outside a git repository.
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

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","sessionTitle":"%s"}}\n' "$repo"
  exit 0
fi

# Cloud sessions keep the title claude.ai generated from the first message and
# do not pick up sessionTitle, so ask the model to rename the session itself
# through the claude-code-remote MCP server.
context="Session title: this is a cloud session, and its title in the claude.ai session list does not include the repository name. In your first turn, before replying, rename the session to \\\"${repo}: <summary>\\\", where <summary> is a few words summarizing the user's first request, in the user's language. Call get_session (claude-code-remote MCP server) with session_id omitted to learn this session's ID, then set_session_title with that ID and the title. Load the tools with ToolSearch if they are deferred. If the claude-code-remote tools are not available, skip this. Do this once; do not rename the session again later, and do not mention it unless the user asks."
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","sessionTitle":"%s","additionalContext":"%s"}}\n' "$repo" "$context"
