#!/usr/bin/env bash
# Driver for the agent-plugins marketplace.
#
# There is no server or GUI here — the "app" is a Claude Code plugin
# marketplace, and the way you drive it is the `claude plugin` CLI.
# This script is the harness: it validates every manifest and (in
# roundtrip mode) makes Claude Code actually load, install, and
# inventory the plugins, then cleans up after itself.
#
# Usage:
#   driver.sh                 # validate: strict-validate marketplace + all plugins (non-mutating)
#   driver.sh validate        # same as above
#   driver.sh roundtrip       # add -> install -> details -> uninstall -> remove (mutates user settings, self-cleans)
#   driver.sh all             # validate, then roundtrip
#
# Run from the repo root. Exits non-zero on the first failure.
set -uo pipefail

# Resolve repo root as the dir two levels up from this script's skill dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$ROOT"

MARKET_NAME="$(python3 -c "import json;print(json.load(open('.claude-plugin/marketplace.json'))['name'])")"

log()  { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
fail() { printf '\033[31mFAIL:\033[0m %s\n' "$*" >&2; exit 1; }

validate() {
  log "Validate marketplace manifest (strict)"
  claude plugin validate . --strict || fail "marketplace manifest invalid"

  # NOTE: validating the marketplace does NOT recurse into plugins.
  # Validate each plugin dir (anything with .claude-plugin/plugin.json) separately.
  local found=0
  while IFS= read -r manifest; do
    found=1
    local dir; dir="$(dirname "$(dirname "$manifest")")"
    log "Validate plugin: $dir (strict)"
    claude plugin validate "$dir" --strict || fail "plugin manifest invalid: $dir"
  done < <(find plugins -name plugin.json -path '*/.claude-plugin/*' 2>/dev/null | sort)
  [ "$found" -eq 1 ] || fail "no plugins found under plugins/*/.claude-plugin/plugin.json"

  log "All manifests valid ✔"
}

roundtrip() {
  # Ensure we always tear down, even on failure.
  cleanup() {
    claude plugin uninstall "github-actions-versions@${MARKET_NAME}" >/dev/null 2>&1
    claude plugin marketplace remove "$MARKET_NAME" >/dev/null 2>&1
  }
  trap cleanup EXIT

  log "Add marketplace from local path (note: needs ./ prefix, bare '.' is rejected)"
  claude plugin marketplace add ./ || fail "marketplace add failed"

  log "Install each plugin declared in the marketplace"
  # Read plugin names straight from the marketplace manifest.
  while IFS= read -r name; do
    claude plugin install "${name}@${MARKET_NAME}" || fail "install failed: $name"
    log "Component inventory for $name"
    claude plugin details "$name" || fail "details failed: $name"
    # A plugin with zero components almost certainly means a broken skills/ layout.
    claude plugin details "$name" | grep -Eq 'Skills \([1-9]|Agents \([1-9]|Hooks \([1-9]|MCP servers \([1-9]' \
      || fail "$name loaded with ZERO components — check skills/<name>/SKILL.md layout"
  done < <(python3 -c "import json;[print(p['name']) for p in json.load(open('.claude-plugin/marketplace.json'))['plugins']]")

  log "Roundtrip OK — Claude Code loaded, installed, and inventoried every plugin ✔"
}

case "${1:-validate}" in
  validate) validate ;;
  roundtrip) roundtrip ;;
  all) validate; roundtrip ;;
  *) fail "unknown mode: $1 (use: validate | roundtrip | all)" ;;
esac
