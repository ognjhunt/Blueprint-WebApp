#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace/Blueprint-WebApp"
AGENTS_ROOT="${WORKSPACE_ROOT}/ops/paperclip/blueprint-company/agents"

STRICT_SECTION_AGENTS=(
  "webapp-codex"
  "webapp-claude"
  "pipeline-codex"
  "pipeline-claude"
  "capture-codex"
  "capture-claude"
)

required_files=(
  "AGENTS.md"
  "Soul.md"
  "Tools.md"
  "Heartbeat.md"
)

strict_agents_regex="$(printf '%s\n' "${STRICT_SECTION_AGENTS[@]}" | paste -sd'|' -)"

fail() {
  echo "Agent kit validation failed: $*" >&2
  exit 1
}

require_literal() {
  local file="$1"
  local needle="$2"
  local description="$3"

  if ! grep -Fq "$needle" "$file"; then
    fail "${file} is missing ${description}: ${needle}"
  fi
}

require_heading() {
  local file="$1"
  local heading="$2"

  if ! grep -Eq "^${heading}$" "$file"; then
    fail "${file} is missing required heading ${heading}"
  fi
}

while IFS= read -r agent_dir; do
  agent_slug="$(basename "$agent_dir")"

  case "$agent_slug" in
    ceo|cto)
      continue
      ;;
  esac

  for file_name in "${required_files[@]}"; do
    [ -f "${agent_dir}/${file_name}" ] || fail "${agent_slug} is missing ${file_name}"
  done

  if [[ "$agent_slug" =~ ^(${strict_agents_regex})$ ]]; then
    agents_file="${agent_dir}/AGENTS.md"
    soul_file="${agent_dir}/Soul.md"
    tools_file="${agent_dir}/Tools.md"
    heartbeat_file="${agent_dir}/Heartbeat.md"

    require_literal "$agents_file" "Read these sibling files before each substantial run:" "the sibling-file read instruction"
    require_literal "$agents_file" "Primary scope:" "the primary scope section"
    require_literal "$agents_file" "Default behavior:" "the default behavior section"
    require_literal "$agents_file" "What is NOT your job:" "the non-goals section"
    require_literal "$agents_file" "Software boundary:" "the software-boundary section"
    require_literal "$agents_file" "Delegation visibility rule:" "the delegation-visibility rule"

    require_heading "$soul_file" "## Why You Exist"
    require_heading "$soul_file" "## What You Care About"
    require_heading "$soul_file" "## Excellent Judgment In This Role"
    require_heading "$soul_file" "## Never Compromise"
    require_heading "$soul_file" "## Traps To Avoid"

    require_heading "$tools_file" "## Primary Sources"
    require_heading "$tools_file" "## Actions You Own"
    require_heading "$tools_file" "## Handoff Partners"
    require_heading "$tools_file" "## Trust Model"
    require_heading "$tools_file" "## Do Not Use Casually"

    require_heading "$heartbeat_file" "## Triggered Runs \\(Primary\\)"
    require_heading "$heartbeat_file" "## Scheduled Runs"
    require_heading "$heartbeat_file" "## Stage Model"
    require_heading "$heartbeat_file" "## Block Conditions"
    require_heading "$heartbeat_file" "## Escalation Conditions"
  fi
done < <(find "$AGENTS_ROOT" -mindepth 1 -maxdepth 1 -type d | sort)

echo "Agent kit validation passed."
