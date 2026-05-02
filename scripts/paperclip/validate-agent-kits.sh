#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace/Blueprint-WebApp"
AGENTS_ROOT="${WORKSPACE_ROOT}/ops/paperclip/blueprint-company/agents"

STRICT_SECTION_AGENTS=(
  "blueprint-ceo"
  "blueprint-chief-of-staff"
  "blueprint-cto"
  "ops-lead"
  "growth-lead"
  "solutions-engineering-agent"
  "security-procurement-agent"
  "revenue-ops-pricing-agent"
  "webapp-codex"
  "webapp-review"
  "pipeline-codex"
  "pipeline-review"
  "capture-codex"
  "capture-review"
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

require_frontmatter_skill_sync() {
  node --input-type=module - "$WORKSPACE_ROOT" <<'NODE'
import fs from 'fs';
import yaml from 'js-yaml';

const workspaceRoot = process.argv[2];
const companyRoot = `${workspaceRoot}/ops/paperclip/blueprint-company`;
const config = yaml.load(fs.readFileSync(`${companyRoot}/.paperclip.yaml`, 'utf8'));
const failures = [];

for (const [slug, agent] of Object.entries(config.agents ?? {})) {
  const desiredSkills = agent?.adapter?.config?.paperclipSkillSync?.desiredSkills ?? [];
  if (!Array.isArray(desiredSkills) || desiredSkills.length === 0) {
    continue;
  }

  const agentFile = `${companyRoot}/agents/${slug}/AGENTS.md`;
  if (!fs.existsSync(agentFile)) {
    continue;
  }

  const text = fs.readFileSync(agentFile, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    failures.push(`${slug} AGENTS.md is missing YAML frontmatter`);
    continue;
  }

  const frontmatter = yaml.load(match[1]) ?? {};
  const frontmatterSkills = Array.isArray(frontmatter.skills) ? frontmatter.skills : [];
  const missingFromFrontmatter = desiredSkills.filter((skill) => !frontmatterSkills.includes(skill));
  const missingFromRuntime = frontmatterSkills.filter((skill) => !desiredSkills.includes(skill));

  if (missingFromFrontmatter.length > 0 || missingFromRuntime.length > 0) {
    failures.push(
      `${slug} skill drift: missing from AGENTS.md [${missingFromFrontmatter.join(', ')}]; missing from .paperclip.yaml [${missingFromRuntime.join(', ')}]`,
    );
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
NODE
}

require_frontmatter_skill_sync || fail "agent AGENTS.md frontmatter skills drifted from .paperclip.yaml runtime desiredSkills"

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

  agents_file="${agent_dir}/AGENTS.md"
  if grep -Fq "## Paperclip Runtime Safety" "$agents_file"; then
    require_literal "$agents_file" 'npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain' "the shared Paperclip read fallback"
    require_literal "$agents_file" 'npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --heartbeat-context --issue-id "$PAPERCLIP_TASK_ID" --plain' "the shared Paperclip issue-context fallback"
    require_literal "$agents_file" 'Do not invent ad hoc `/api/runs` probes or hand-written `jq` filters.' "the no-ad-hoc-run-probe rule"
  fi

  if [[ "$agent_slug" =~ ^(${strict_agents_regex})$ ]]; then
    soul_file="${agent_dir}/Soul.md"
    tools_file="${agent_dir}/Tools.md"
    heartbeat_file="${agent_dir}/Heartbeat.md"

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
