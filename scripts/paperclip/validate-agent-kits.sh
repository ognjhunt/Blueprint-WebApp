#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="${BLUEPRINT_WEBAPP_ROOT:-/Users/nijelhunt_1/workspace/Blueprint-WebApp}"
AGENTS_ROOT="${WORKSPACE_ROOT}/ops/paperclip/blueprint-company/agents"

# Every role was retired on 2026-11-12 (AUTONOMOUS_ORG.md). A running agent reads these files by
# path, so each must say "do nothing" and carry no working instruction.
RETIRED_LINE="This role is retired as of 2026-11-12. Do nothing: start no work, send nothing, change nothing."

required_files=(
  "AGENTS.md"
  "Soul.md"
  "Tools.md"
  "Heartbeat.md"
)

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

  for file_name in "${required_files[@]}"; do
    kit_file="${agent_dir}/${file_name}"
    require_literal "$kit_file" "$RETIRED_LINE" "the retirement line"
    if grep -Eq 'PAPERCLIP_API_KEY|PATCH /api/issues|^## (Triggered Runs|Scheduled Runs|Primary Sources|Actions You Own|Why You Exist)|Primary scope:' "$kit_file"; then
      fail "${kit_file} is retired but still carries a working instruction"
    fi
  done
done < <(find "$AGENTS_ROOT" -mindepth 1 -maxdepth 1 -type d | sort)

echo "Agent kit validation passed."
