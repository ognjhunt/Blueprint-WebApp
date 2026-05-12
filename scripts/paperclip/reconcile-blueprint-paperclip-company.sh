#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
REPO_ROOT="$WORKSPACE_ROOT/Blueprint-WebApp"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./paperclip-api.sh
source "$SCRIPT_DIR/paperclip-api.sh"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-$WORKSPACE_ROOT/.paperclip-blueprint}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE:-auto}"
BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES="${BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES:-0}"
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL:-gpt-5.4-mini}"
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT:-medium}"
BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL="${BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL:-deepseek/deepseek-v4-flash}"
BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL="${BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL:-deepseek/deepseek-v4-pro}"
BLUEPRINT_PAPERCLIP_HERMES_PROVIDER="${BLUEPRINT_PAPERCLIP_HERMES_PROVIDER:-openrouter}"
BLUEPRINT_PAPERCLIP_HERMES_BASE_URL="${BLUEPRINT_PAPERCLIP_HERMES_BASE_URL:-https://api.deepseek.com/anthropic}"
BLUEPRINT_PAPERCLIP_HERMES_INCLUDE_OPENROUTER_FALLBACKS="${BLUEPRINT_PAPERCLIP_HERMES_INCLUDE_OPENROUTER_FALLBACKS:-0}"
BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ONLY="${BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ONLY:-deepseek,atlas-cloud/fp8,novita,siliconflow/fp8}"
BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ORDER="${BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ORDER:-deepseek,atlas-cloud/fp8,novita,siliconflow/fp8}"
BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_IGNORE="${BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_IGNORE:-parasail,parasail/fp8,akashml,akashml/fp8,deepinfra,deepinfra/fp4}"
BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_ALLOW_FALLBACKS="${BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_ALLOW_FALLBACKS:-1}"

if RESOLVED_API_URL="$(paperclip_resolve_api_url "$PAPERCLIP_API_URL" "$PAPERCLIP_HOME" "$PAPERCLIP_HOST")"; then
  PAPERCLIP_API_URL="$RESOLVED_API_URL"
fi

export \
  PAPERCLIP_API_URL \
  PAPERCLIP_HOST \
  PAPERCLIP_PORT \
  PAPERCLIP_HOME \
  COMPANY_NAME \
  REPO_ROOT \
  BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE \
  BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES \
  BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL \
  BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL \
  BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL \
  BLUEPRINT_PAPERCLIP_HERMES_PROVIDER \
  BLUEPRINT_PAPERCLIP_HERMES_BASE_URL \
  BLUEPRINT_PAPERCLIP_HERMES_INCLUDE_OPENROUTER_FALLBACKS \
  BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ONLY \
  BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ORDER \
  BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_IGNORE \
  BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_ALLOW_FALLBACKS \
  BLUEPRINT_PAPERCLIP_FORCE_ADAPTER_SYNC \
  BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT

node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const paperclipApiUrl = process.env.PAPERCLIP_API_URL;
const companyName = process.env.COMPANY_NAME;
const repoRoot = process.env.REPO_ROOT;
const require = createRequire(pathToFileURL(path.join(repoRoot, "package.json")).href);
const yaml = require("js-yaml");
const requestedClaudeLaneMode = normalizeClaudeLaneMode(
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE,
);
const forceCodexClaudeLanes = /^(1|true|yes)$/i.test(
  process.env.BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES ?? "",
);
const fallbackCodexModel =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL ?? "gpt-5.4-mini";
const fallbackCodexReasoningEffort =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT ?? "medium";
const DEFAULT_HERMES_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_HERMES_FALLBACK_MODEL = "deepseek/deepseek-v4-pro";
const DEFAULT_HERMES_PROVIDER = "openrouter";
const DEFAULT_HERMES_DIRECT_PROVIDER = "anthropic";
const DEFAULT_HERMES_BASE_URL = "https://api.deepseek.com/anthropic";
const DEFAULT_HERMES_OPENROUTER_PROVIDER_ORDER = [
  "deepseek",
  "atlas-cloud/fp8",
  "novita",
  "siliconflow/fp8",
];
const DEFAULT_HERMES_OPENROUTER_PROVIDER_IGNORE = [
  "parasail",
  "parasail/fp8",
  "akashml",
  "akashml/fp8",
  "deepinfra",
  "deepinfra/fp4",
];
const allowPaidHermesModels = /^(1|true|yes)$/i.test(
  process.env.BLUEPRINT_PAPERCLIP_HERMES_ALLOW_PAID_MODELS ?? "",
);
const includeLegacyOpenRouterHermesFallbacks = /^(1|true|yes)$/i.test(
  process.env.BLUEPRINT_PAPERCLIP_HERMES_INCLUDE_OPENROUTER_FALLBACKS ?? "",
);
const DISALLOWED_HERMES_MODEL_RE =
  /^(?:(?:anthropic\/)?claude(?:[-/].*)?|openrouter\/free|(?:openrouter\/)?arcee-ai\/trinity-large-preview(?::free)?|(?:openrouter\/)?nvidia\/nemotron-3-super(?::free)?|(?:openrouter\/)?(?:qwen\/)?qwen3\.6-plus(?:-preview)?(?::free)?|(?:openrouter\/)?inclusionai\/ling-2\.6-(?:flash|1t)(?::free)?|(?:openrouter\/)?stepfun\/step-3\.5-flash(?::free)?)$/i;
const LEGACY_OPENROUTER_HERMES_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "tencent/hy3-preview:free",
  "minimax/minimax-m2.5:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
];
const hermesPrimaryModel = sanitizeHermesModel(
  process.env.BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL,
  DEFAULT_HERMES_MODEL,
);
const hermesFallbackModel = sanitizeHermesModel(
  process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL,
  DEFAULT_HERMES_FALLBACK_MODEL,
);
const hermesProvider =
  typeof process.env.BLUEPRINT_PAPERCLIP_HERMES_PROVIDER === "string"
    && process.env.BLUEPRINT_PAPERCLIP_HERMES_PROVIDER.trim().length > 0
    ? process.env.BLUEPRINT_PAPERCLIP_HERMES_PROVIDER.trim()
    : DEFAULT_HERMES_PROVIDER;
const configuredHermesProvider = hermesProvider.toLowerCase();
const hermesDirectProvider =
  configuredHermesProvider.length > 0
    && configuredHermesProvider !== DEFAULT_HERMES_PROVIDER
    ? process.env.BLUEPRINT_PAPERCLIP_HERMES_PROVIDER.trim()
    : DEFAULT_HERMES_DIRECT_PROVIDER;
const hermesBaseUrl =
  typeof process.env.BLUEPRINT_PAPERCLIP_HERMES_BASE_URL === "string"
    && process.env.BLUEPRINT_PAPERCLIP_HERMES_BASE_URL.trim().length > 0
    ? process.env.BLUEPRINT_PAPERCLIP_HERMES_BASE_URL.trim()
    : DEFAULT_HERMES_BASE_URL;
const forceAdapterSync = /^(1|true|yes)$/i.test(
  process.env.BLUEPRINT_PAPERCLIP_FORCE_ADAPTER_SYNC ?? "",
);
const hermesFreeModels = normalizeHermesModelList([
  hermesPrimaryModel,
  ...parseModelList(process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS),
  hermesFallbackModel,
  DEFAULT_HERMES_MODEL,
  DEFAULT_HERMES_FALLBACK_MODEL,
  ...(includeLegacyOpenRouterHermesFallbacks ? LEGACY_OPENROUTER_HERMES_MODELS : []),
]);
const hermesPaidModels = normalizeHermesModelList([
  ...(allowPaidHermesModels ? parseModelList(process.env.BLUEPRINT_PAPERCLIP_HERMES_PAID_MODELS) : []),
]);
const hermesModelLadder = normalizeHermesModelList([
  ...hermesFreeModels,
  ...hermesPaidModels,
]);
const legacyHermesModel = "gpt-5.4-mini";
const HERMES_MODEL_LADDER_CONFIG_KEY = "blueprintHermesModelLadder";
const BLUEPRINT_HERMES_PROMPT_TEMPLATE = String.raw`You are "{{agentName}}", an AI agent employee in a Paperclip-managed company.

Use the terminal tool for Paperclip API calls against {{paperclipApiUrl}}.
Authentication env vars are already injected: PAPERCLIP_API_KEY, PAPERCLIP_RUN_ID, PAPERCLIP_AGENT_ID, and when present PAPERCLIP_TASK_ID.

Hard rules:
- Never pipe curl output into Python, Node, bash, or any other interpreter.
- Do not use the Hermes Python/execute_code tool for Paperclip API reads, auth/env discovery, or JSON parsing. Use the terminal fallback scripts or Paperclip CLI commands below.
- Never inspect, print, cat, grep, or find Paperclip secret/env/config files while debugging auth. Checking whether auth exists means testing whether PAPERCLIP_API_KEY is non-empty, not exposing or searching secrets.
- Prefer plain curl for reads, or the deterministic TypeScript fallback scripts when you need local parsing.
- Hermes terminal commands do not expand $ENV vars unless you invoke a shell. For auth-backed curl calls, run them through bash -lc so $PAPERCLIP_API_KEY and related vars expand before curl runs.
- If PAPERCLIP_TASK_ID is present, treat it as the sole execution scope for this wake. Do not start with inbox discovery or broader queue scanning.
- If the wake reason or payload points at a specific issue/comment but PAPERCLIP_TASK_ID is missing, treat that as a binding failure. Do not compensate by scanning the inbox or backlog.
- Use direct issue routes for issue reads and mutations: /issues/$ISSUE_ID, /issues/$ISSUE_ID/heartbeat-context, /issues/$ISSUE_ID/comments, /issues/$ISSUE_ID/checkout.
- Do not invent company-scoped issue detail routes like /companies/$PAPERCLIP_COMPANY_ID/issues/$ISSUE_ID. They do not exist.
- In inbox results, the id field is the API issue id to use in /issues/:id routes. The identifier field (for example BLU-3621) is only the human label.
- Prefer GET {{paperclipApiUrl}}/agents/me/inbox-lite for assignment checks.
- Hermes-safe read fallback: 'npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain'
- Hermes-safe issue-context fallback: 'npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --heartbeat-context --issue-id "$PAPERCLIP_TASK_ID" --plain'
- If PAPERCLIP_API_KEY is missing on this trusted host and PAPERCLIP_TASK_ID is present, stop using auth-backed curl and switch to 'npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue get|checkout|update|comment "$PAPERCLIP_TASK_ID" ...' for the bound issue.
- If the safe fallback script fails, report that failure and stop. Do not invent ad hoc '/api/runs' probes or hand-written 'jq' filters.
- If PAPERCLIP_API_KEY is missing or an auth call returns 401/403, stop retrying auth-backed curl. For issue-bound wakes, use the trusted-host CLI fallback for that exact issue. For unbound wakes, run 'npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain', summarize assigned open work, and exit without retries.
- Never look for unassigned work.
- Never self-assign from backlog.
- For mutating calls, include Authorization: Bearer $PAPERCLIP_API_KEY and X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID.
- For checkout, release, status updates, and comments, prefer 'npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue ...' so the CLI serializes JSON safely and forwards PAPERCLIP_RUN_ID automatically.
- Issue checkout is a POST to /issues/$ISSUE_ID/checkout with JSON body {"agentId":"$PAPERCLIP_AGENT_ID","expectedStatuses":["todo","backlog","blocked"]}. Do not fake checkout by PATCHing /issues/$ISSUE_ID with checkoutRunId.
- If an assigned issue is already in_progress and assigned to you, never call /issues/$ISSUE_ID/checkout again for that run. Read /issues/$ISSUE_ID and /issues/$ISSUE_ID/heartbeat-context, continue the work, and leave the final status patch only when the work is actually done or blocked.
- A checkout request that omits agentId, expectedStatuses, or Content-Type: application/json will 400. Do not shorten or improvise the checkout command.
- Issue comments are a POST to /issues/$ISSUE_ID/comments with JSON body {"body":"..."}.
- Comment writes also require Authorization: Bearer $PAPERCLIP_API_KEY, X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID, and Content-Type: application/json.
- Never send {"content":"..."} to /issues/$ISSUE_ID/comments.
- If nothing is assigned to you, report what you checked and exit.

Mandatory preflight (run first on every wake):
1. Check whether PAPERCLIP_API_KEY is present and non-empty with this exact command. Do not print the key or read env/secret files:
   bash -lc 'test -n "$PAPERCLIP_API_KEY" && echo PAPERCLIP_API_KEY_PRESENT || echo PAPERCLIP_API_KEY_MISSING'
2. If PAPERCLIP_API_KEY is missing/empty and PAPERCLIP_TASK_ID is present, do not call authenticated curl routes. Switch immediately to the trusted-host CLI fallback for that exact issue:
   - Read the bound issue:
     npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue get "$PAPERCLIP_TASK_ID" --json
   - If the issue status is todo, backlog, or blocked, use the exact checkout command:
     npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue checkout "$PAPERCLIP_TASK_ID" --agent-id "$PAPERCLIP_AGENT_ID"
   - Continue the work on that exact issue only, and finish with the Paperclip CLI issue comment/update commands instead of auth-backed curl.
3. If PAPERCLIP_API_KEY is missing/empty and PAPERCLIP_TASK_ID is not present, do not call authenticated routes (/agents/me/*, /issues/*/checkout, PATCH issue routes).
4. Instead, run read-only fallback immediately:
   npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain
5. Summarize only assigned open work returned by the fallback. Do not parse raw Paperclip JSON with Python/execute_code.
6. Exit after the brief proof-bearing summary. Do not retry auth calls in this run.

{{#taskId}}
Assigned task:
- Issue ID: {{taskId}}
- Title: {{taskTitle}}

If PAPERCLIP_API_KEY is missing/empty, do not use the auth-backed curl steps below. Start with the trusted-host CLI fallback for this exact issue instead:
1. Read issue metadata:
   npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue get "{{taskId}}" --json
2. If the current issue status is todo, backlog, or blocked, use the exact checkout command:
   npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue checkout "{{taskId}}" --agent-id "$PAPERCLIP_AGENT_ID"
3. Continue the work on this exact issue only, and finish with:
   - Comment:
     npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue comment "{{taskId}}" --body "What changed, what you verified, and any remaining blocker."
   - Status update:
     npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue update "{{taskId}}" --status done --comment "What changed, how you verified it, and any remaining risk."
4. Only use the auth-backed curl steps below when PAPERCLIP_API_KEY is present.

Start with:
1. Read issue metadata:
   bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/issues/{{taskId}}"'
2. Read compact context:
   bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/issues/{{taskId}}/heartbeat-context"'
3. If this wake came from a comment:
   bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/issues/{{taskId}}/comments/{{commentId}}"'
4. Checkout rules:
   - If the current issue status is todo, backlog, or blocked, use the exact checkout command:
     bash -lc 'npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue checkout "{{taskId}}" --agent-id "$PAPERCLIP_AGENT_ID"'
   - If the current issue is already in_progress and assigned to you, never call /issues/{{taskId}}/checkout again for that run. Read /heartbeat-context and continue the work.

After doing the work:
- Mark done with a proof-bearing comment:
  bash -lc 'npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue update "{{taskId}}" --status done --comment "What changed, how you verified it, and any remaining risk."'
- If blocked, patch the issue to status blocked with a blocker comment before exiting.
{{/taskId}}

{{#commentId}}
If you need the full comment thread, use:
bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/issues/{{taskId}}/comments"'
{{/commentId}}

{{#noTask}}
Heartbeat wake:
1. If PAPERCLIP_API_KEY is missing/empty, skip inbox auth calls and execute the mandatory preflight fallback above.
2. Check your assigned inbox:
   bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/agents/me/inbox-lite"'
3. If the inbox is empty, do not inspect backlog or unassigned issues. Exit after a brief summary.
4. If the inbox has assigned issues, choose the target issue from the returned rows and store its id as ISSUE_ID. Use that UUID for every /issues/:id route.
5. Read the selected issue through the direct issue routes:
   - Metadata:
     bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/issues/$ISSUE_ID"'
   - Compact work context:
     bash -lc 'curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "{{paperclipApiUrl}}/issues/$ISSUE_ID/heartbeat-context"'
6. Checkout rules:
   - If the selected issue status is todo, backlog, or blocked, copy this exact checkout command and only replace ISSUE_ID:
     bash -lc 'ISSUE_ID="$ISSUE_ID"; npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue checkout "$ISSUE_ID" --agent-id "$PAPERCLIP_AGENT_ID"'
   - If the selected issue is already in_progress and assigned to you, do not PATCH it just to simulate checkout. Read /heartbeat-context and continue the work.
7. If step 2 fails with 401/403, run auth-regression fallback instead of retrying:
   - Assigned-open fallback:
     npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain
   - Restrict the run to the assigned open work returned by that script.
   - Do not self-assign, do not inspect unassigned backlog, and do not attempt mutating routes without auth.
   - Leave a brief proof-bearing summary of assigned open issues you found (or none) and exit cheaply.
{{/noTask}}`;
const HERMES_SAFETY_BUNDLE_SECTION = `

## Paperclip Runtime Safety

- Prefer \`GET /agents/me/inbox-lite\` for assignment checks.
- Hermes-safe read fallback: \`npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain\`
- Hermes-safe issue-context fallback: \`npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --heartbeat-context --issue-id "$PAPERCLIP_TASK_ID" --plain\`
- If \`PAPERCLIP_API_KEY\` is missing on this trusted host and \`PAPERCLIP_TASK_ID\` is present, switch to \`npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue get|checkout|update|comment "$PAPERCLIP_TASK_ID" ...\` instead of auth-backed \`curl\`.
- If the safe fallback script fails, report that failure and stop. Do not invent ad hoc \`/api/runs\` probes or hand-written \`jq\` filters.
- If \`/agents/me/inbox-lite\` returns \`401\` or \`403\`, stop retrying auth-backed \`curl\`. For issue-bound wakes, use the trusted-host CLI fallback for that exact issue. For unbound wakes, run \`npm exec tsx -- scripts/paperclip/paperclip-heartbeat-snapshot.ts --assigned-open --plain\`, summarize, and exit without retries.
- Do not use \`curl | python\`, \`curl | node\`, \`curl | bash\`, or any other pipe-to-interpreter pattern for localhost Paperclip reads.
- Do not use the Hermes Python/execute_code tool for Paperclip API reads, auth/env discovery, or JSON parsing.
- Never inspect, print, cat, grep, or find Paperclip secret/env/config files while debugging auth. Checking whether auth exists means testing whether \`PAPERCLIP_API_KEY\` is non-empty, not exposing or searching secrets.
- Do not inspect unassigned backlog as part of heartbeat work discovery.
- Do not self-assign from backlog.
- For mutating Paperclip calls, include both \`Authorization: Bearer $PAPERCLIP_API_KEY\` and \`X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID\`.
- For checkout, release, status updates, and comments, prefer \`npm --prefix /Users/nijelhunt_1/workspace/paperclip run --silent paperclipai -- issue ...\` so the CLI serializes JSON safely and forwards \`PAPERCLIP_RUN_ID\` automatically.
- If an assigned issue is already \`in_progress\` and assigned to you, never call \`/issues/$ISSUE_ID/checkout\` again for that run. Read \`/issues/$ISSUE_ID\` and \`/issues/$ISSUE_ID/heartbeat-context\`, continue the work, and leave the final status patch only when the work is actually done or blocked.
- Issue comments are a \`POST\` to \`/issues/$ISSUE_ID/comments\` with JSON body \`{"body":"..."}\`.
- Comment writes also require \`Authorization: Bearer $PAPERCLIP_API_KEY\`, \`X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID\`, and \`Content-Type: application/json\`.
- Never send \`{"content":"..."}\` to \`/issues/$ISSUE_ID/comments\`.
- If nothing is assigned, leave a brief proof-bearing note about what you checked and exit cheaply.
`;
const paperclipConfigPath = path.join(
  repoRoot,
  "ops/paperclip/blueprint-company/.paperclip.yaml",
);

function normalizeClaudeLaneMode(value) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "claude":
    case "primary":
      return "claude";
    case "codex":
    case "fallback":
      return "codex";
    case "hermes":
      return "hermes";
    case "auto":
    case "":
      return "auto";
    default:
      console.warn(
        `Unknown BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE=${value}; defaulting to auto`,
      );
      return "auto";
  }
}

function parseModelList(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeModelList(values) {
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function envList(envKey, fallback) {
  const raw = process.env[envKey];
  if (typeof raw !== "string" || raw.trim().length === 0) return [...fallback];
  const parsed = normalizeModelList(raw.split(","));
  return parsed.length > 0 ? parsed : [...fallback];
}

function envBoolean(envKey, fallback) {
  const raw = process.env[envKey];
  if (typeof raw !== "string" || raw.trim().length === 0) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function buildOpenRouterProviderRouting() {
  const order = envList(
    "BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ORDER",
    DEFAULT_HERMES_OPENROUTER_PROVIDER_ORDER,
  );
  return {
    only: envList("BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ONLY", order),
    order,
    ignore: envList(
      "BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_IGNORE",
      DEFAULT_HERMES_OPENROUTER_PROVIDER_IGNORE,
    ),
    allow_fallbacks: envBoolean(
      "BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_ALLOW_FALLBACKS",
      true,
    ),
  };
}

function withOpenRouterProviderEnv(existingEnv, routing) {
  const only = Array.isArray(routing.only) ? routing.only.filter((entry) => typeof entry === "string") : [];
  const order = Array.isArray(routing.order) ? routing.order.filter((entry) => typeof entry === "string") : [];
  const ignore = Array.isArray(routing.ignore) ? routing.ignore.filter((entry) => typeof entry === "string") : [];
  return {
    ...existingEnv,
    OPENROUTER_PROVIDER_ONLY: only.join(","),
    OPENROUTER_PROVIDER_ORDER: order.join(","),
    OPENROUTER_PROVIDER_IGNORE: ignore.join(","),
    OPENROUTER_ALLOW_FALLBACKS: routing.allow_fallbacks === false ? "0" : "1",
  };
}

function isDisallowedHermesModel(value) {
  return typeof value === "string" && DISALLOWED_HERMES_MODEL_RE.test(value.trim());
}

function isDeepSeekHermesModel(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  return /^deepseek-v4-(?:flash|pro)(?:\[[^\]]+\])?$/.test(trimmed)
    || trimmed === "deepseek-chat"
    || trimmed === "deepseek-reasoner";
}

function isOpenRouterDeepSeekHermesModel(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  return /^deepseek\/deepseek-v4-(?:flash|pro)$/.test(trimmed);
}

function isHermesFreeModel(value) {
  return typeof value === "string" && value.trim().toLowerCase().endsWith(":free");
}

function isApprovedHermesModel(value) {
  return isOpenRouterDeepSeekHermesModel(value)
    || isDeepSeekHermesModel(value)
    || (includeLegacyOpenRouterHermesFallbacks && isHermesFreeModel(value))
    || allowPaidHermesModels;
}

function providerForHermesModel(model) {
  if (isOpenRouterDeepSeekHermesModel(model)) {
    return "openrouter";
  }
  if (isDeepSeekHermesModel(model)) {
    return hermesDirectProvider;
  }
  return "openrouter";
}

function sanitizeHermesModel(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed || isDisallowedHermesModel(trimmed) || !isApprovedHermesModel(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function normalizeHermesModelList(values) {
  return normalizeModelList(
    values.filter(
      (value) =>
        typeof value === "string"
        && !isDisallowedHermesModel(value)
        && isApprovedHermesModel(value),
    ),
  );
}

async function fetchJson(resourcePath, init = {}) {
  const attempts = Number(process.env.PAPERCLIP_FETCH_ATTEMPTS || "3");
  const delayMs = Number(process.env.PAPERCLIP_FETCH_DELAY_MS || "500");
  const { timeoutMs: requestTimeoutMs, ...fetchInit } = init;
  const timeoutMs = Number(
    requestTimeoutMs ?? process.env.PAPERCLIP_FETCH_TIMEOUT_MS ?? "30000",
  );
  let lastError = `Empty response for ${resourcePath}`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    timeout?.unref?.();
    try {
      const response = await fetch(`${paperclipApiUrl}${resourcePath}`, {
        headers: { "Content-Type": "application/json", ...(fetchInit.headers ?? {}) },
        ...fetchInit,
        signal: fetchInit.signal ?? controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${fetchInit.method ?? "GET"} ${resourcePath} failed: ${response.status} ${text}`);
      }
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        lastError = `Empty response for ${resourcePath}`;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        continue;
      }
      try {
        return JSON.parse(text);
      } catch (parseError) {
        lastError = `Invalid JSON from ${resourcePath}: ${text.slice(0, 200)}`;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        continue;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Blueprint Paperclip API unavailable at ${paperclipApiUrl}${resourcePath}: ${lastError}`);
}

async function fetchJsonWithConflictRetry(resourcePath, init = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchJson(resourcePath, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isConflict = message.includes("409") || message.includes("conflict") || message.includes("duplicate");
      if (!isConflict || attempt >= maxRetries) {
        throw error;
      }
      const backoffMs = 200 * Math.pow(2, attempt);
      console.warn(`[paperclip] Conflict on ${resourcePath}, retry ${attempt}/${maxRetries} after ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw new Error(`All conflict retries exhausted for ${resourcePath}`);
}

function hasSuffix(value) {
  return typeof value === "string" && /(?:-\d+| \d+)$/.test(value);
}

const AGENT_KEY_ALIASES = {
  "docs-agent": ["documentation-agent"],
};

function pickCanonical(rows, exactKey) {
  const aliases = AGENT_KEY_ALIASES[exactKey] ?? [];
  const matches = rows.filter((row) => {
    const urlKey = typeof row.urlKey === "string" ? row.urlKey : "";
    return urlKey === exactKey
      || aliases.includes(urlKey)
      || (!hasSuffix(urlKey) && !hasSuffix(row.name) && urlKey.startsWith(exactKey));
  });
  const preferred = matches.find((row) => row.urlKey === exactKey);
  const aliasPreferred = matches.find((row) => aliases.includes(row.urlKey));
  return preferred
    ?? aliasPreferred
    ?? matches.find((row) => !hasSuffix(row.urlKey) && !hasSuffix(row.name))
    ?? matches[0]
    ?? null;
}

function pickMatching(rows, exactKey) {
  const aliases = AGENT_KEY_ALIASES[exactKey] ?? [];
  return rows.filter((row) => {
    const urlKey = typeof row.urlKey === "string" ? row.urlKey : "";
    return urlKey === exactKey
      || aliases.includes(urlKey)
      || urlKey.startsWith(`${exactKey}-`)
      || aliases.some((alias) => urlKey.startsWith(`${alias}-`));
  });
}

function normalizeLookupKey(value) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, "")
    : "";
}

function resolvePrimaryWorkspaceConfig(projectConfig) {
  const workspaceEntries = Object.entries(projectConfig?.workspaces ?? {});
  const primaryWorkspace = workspaceEntries.find(([, workspace]) => workspace?.isPrimary)
    ?? workspaceEntries[0]
    ?? null;
  return primaryWorkspace?.[1] ?? null;
}

function expectedProjectName(projectKey, projectConfig) {
  const workspaceConfig = resolvePrimaryWorkspaceConfig(projectConfig);
  return typeof workspaceConfig?.name === "string" && workspaceConfig.name.trim().length > 0
    ? workspaceConfig.name.trim()
    : projectKey.split("-").map(titleizeToken).join(" ");
}

function projectWorkspaceMatches(project, workspaceConfig) {
  if (!workspaceConfig) return false;
  const workspaces = Array.isArray(project?.workspaces) ? project.workspaces : [];
  return workspaces.some((workspace) => {
    const cwdMatches =
      typeof workspaceConfig.cwd === "string"
      && typeof workspace?.cwd === "string"
      && workspace.cwd === workspaceConfig.cwd;
    const repoMatches =
      typeof workspaceConfig.repoUrl === "string"
      && typeof workspace?.repoUrl === "string"
      && workspace.repoUrl === workspaceConfig.repoUrl;
    return cwdMatches || repoMatches;
  });
}

function pickCanonicalProject(projects, projectKey, projectConfig) {
  const direct = pickCanonical(projects, projectKey);
  if (direct) return direct;

  const workspaceConfig = resolvePrimaryWorkspaceConfig(projectConfig);
  const normalizedProjectKey = normalizeLookupKey(projectKey);
  const normalizedProjectName = normalizeLookupKey(expectedProjectName(projectKey, projectConfig));
  const normalizedWorkspaceName = normalizeLookupKey(workspaceConfig?.name);
  const normalizedKeys = new Set(
    [normalizedProjectKey, normalizedProjectName, normalizedWorkspaceName].filter(Boolean),
  );

  const byNormalizedKey = projects.find((project) => {
    if (hasSuffix(project?.urlKey) || hasSuffix(project?.name)) return false;
    return normalizedKeys.has(normalizeLookupKey(project?.urlKey))
      || normalizedKeys.has(normalizeLookupKey(project?.name));
  });
  if (byNormalizedKey) return byNormalizedKey;

  const byWorkspace = projects.find((project) =>
    !hasSuffix(project?.urlKey)
    && !hasSuffix(project?.name)
    && projectWorkspaceMatches(project, workspaceConfig),
  );
  if (byWorkspace) return byWorkspace;

  return null;
}

async function cancelOpenRunsForAgent(companyId, agentId) {
  const runs = await fetchJson(`/api/companies/${companyId}/heartbeat-runs?agentId=${agentId}&limit=200`);
  const openRuns = runs.filter((run) => run.status === "queued" || run.status === "running");
  for (const run of openRuns) {
    await fetchJson(`/api/heartbeat-runs/${run.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }).catch(() => undefined);
  }
}

function toPaperclipAgentKey(agentKey) {
  return agentKey;
}

function titleizeToken(token) {
  const overrides = {
    ceo: "CEO",
    cto: "CTO",
    qa: "QA",
    webapp: "WebApp",
  };
  return overrides[token] ?? `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

const ROUTINE_TITLE_OVERRIDES = {
  "ceo-daily-review": "CEO Daily Review",
  "chief-of-staff-continuous-loop": "Chief of Staff Continuous Loop",
  "cto-cross-repo-triage": "CTO Cross-Repo Triage",
  "webapp-autonomy-loop": "WebApp Autonomy Loop",
  "webapp-review-loop": "WebApp Review Loop",
  "pipeline-autonomy-loop": "Pipeline Autonomy Loop",
  "pipeline-review-loop": "Pipeline Review Loop",
  "capture-autonomy-loop": "Capture Autonomy Loop",
  "capture-review-loop": "Capture Review Loop",
  "ops-lead-morning": "Ops Lead Morning",
  "ops-lead-afternoon": "Ops Lead Afternoon",
  "intake-agent-hourly": "Intake Agent Hourly",
  "capture-qa-daily": "Capture QA Daily",
  "field-ops-daily": "Field Ops Daily",
  "finance-support-daily": "Finance Support Daily",
  "growth-lead-daily": "Growth Lead Daily",
  "growth-lead-weekly": "Growth Lead Weekly",
  "analytics-daily": "Analytics Daily",
  "analytics-weekly": "Analytics Weekly",
  "founder-morning-brief": "Founder Morning Brief",
  "founder-daily-accountability-report": "Founder Daily Accountability Report",
  "founder-eod-brief": "Founder EoD Brief",
  "founder-friday-operating-recap": "Founder Friday Operating Recap",
  "founder-weekly-gaps-report": "Founder Weekly Gaps Report",
  "notion-manager-reconcile-sweep": "Notion Manager Reconcile Sweep",
  "notion-manager-stale-audit": "Notion Manager Stale Audit",
  "notion-manager-weekly-structure-sweep": "Notion Manager Weekly Structure Sweep",
  "notion-reconciler-daily": "Notion Reconciler Daily",
  "notion-reconciler-weekly": "Notion Reconciler Weekly",
  "investor-relations-monthly": "Investor Relations Monthly",
  "community-updates-weekly": "Community Updates Weekly",
  "metrics-reporter-daily": "Metrics Reporter Daily",
  "metrics-reporter-weekly": "Metrics Reporter Weekly",
  "workspace-digest-weekly": "Workspace Digest Weekly",
  "conversion-weekly": "Conversion Weekly",
  "market-intel-daily": "Market Intel Daily",
  "market-intel-weekly": "Market Intel Weekly",
  "supply-intel-daily": "Supply Intel Daily",
  "supply-intel-weekly": "Supply Intel Weekly",
  "capturer-growth-weekly": "Capturer Growth Weekly",
  "capturer-growth-refresh": "Capturer Growth Refresh",
  "city-launch-weekly": "City Launch Weekly",
  "city-launch-refresh": "City Launch Refresh",
  "demand-intel-daily": "Demand Intel Daily",
  "demand-intel-weekly": "Demand Intel Weekly",
  "robot-team-growth-weekly": "Robot Team Growth Weekly",
  "robot-team-growth-refresh": "Robot Team Growth Refresh",
  "site-operator-partnership-weekly": "Site Operator Partnership Weekly",
  "site-operator-partnership-refresh": "Site Operator Partnership Refresh",
  "city-demand-weekly": "City Demand Weekly",
  "city-demand-refresh": "City Demand Refresh",
};

function titleizeRoutineKey(routineKey) {
  return ROUTINE_TITLE_OVERRIDES[routineKey]
    ?? routineKey.split("-").map(titleizeToken).join(" ");
}

function countEnabledScheduleTriggers(routine) {
  return (routine.triggers ?? []).filter(
    (trigger) => trigger.kind === "schedule" && trigger.enabled !== false,
  ).length;
}

function sameNullableValue(left, right) {
  return (left ?? null) === (right ?? null);
}

function pickPreferredRoutine(matching, projectId, agentId) {
  if (!matching.length) return null;
  return [...matching].sort((left, right) => {
    const leftProjectAgent = left.projectId === projectId && left.assigneeAgentId === agentId ? 1 : 0;
    const rightProjectAgent = right.projectId === projectId && right.assigneeAgentId === agentId ? 1 : 0;
    if (leftProjectAgent !== rightProjectAgent) return rightProjectAgent - leftProjectAgent;

    const leftActive = left.status === "active" ? 1 : 0;
    const rightActive = right.status === "active" ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;

    const leftEnabledSchedules = countEnabledScheduleTriggers(left);
    const rightEnabledSchedules = countEnabledScheduleTriggers(right);
    if (leftEnabledSchedules !== rightEnabledSchedules) return leftEnabledSchedules - rightEnabledSchedules;

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0] ?? null;
}

function inferRoutineAgentKey(routineKey, routineConfig) {
  if (typeof routineConfig.agent === "string" && routineConfig.agent.length > 0) {
    return toPaperclipAgentKey(routineConfig.agent);
  }

  const mappings = [
    [/^ceo-/, "blueprint-ceo"],
    [/^cto-/, "blueprint-cto"],
    [/^webapp-autonomy-loop$/, "webapp-codex"],
    [/^webapp-review-loop$/, "webapp-review"],
    [/^pipeline-autonomy-loop$/, "pipeline-codex"],
    [/^pipeline-review-loop$/, "pipeline-review"],
    [/^capture-autonomy-loop$/, "capture-codex"],
    [/^capture-review-loop$/, "capture-review"],
  ];

  const match = mappings.find(([pattern]) => pattern.test(routineKey));
  return match ? match[1] : null;
}

const AGENT_DEFAULT_PROJECT_KEYS = {
  "blueprint-ceo": "blueprint-executive-ops",
  "blueprint-chief-of-staff": "blueprint-executive-ops",
  "notion-manager-agent": "blueprint-executive-ops",
  "notion-reconciler": "blueprint-executive-ops",
  "blueprint-cto": "blueprint-webapp",
  "webapp-codex": "blueprint-webapp",
  "webapp-review": "blueprint-webapp",
  "pipeline-codex": "blueprint-capture-pipeline",
  "pipeline-review": "blueprint-capture-pipeline",
  "capture-codex": "blueprint-capture",
  "capture-review": "blueprint-capture",
  "ops-lead": "blueprint-executive-ops",
  "intake-agent": "blueprint-webapp",
  "capture-qa-agent": "blueprint-capture-pipeline",
  "field-ops-agent": "blueprint-capture",
  "finance-support-agent": "blueprint-webapp",
  "growth-lead": "blueprint-executive-ops",
  "conversion-agent": "blueprint-webapp",
  "analytics-agent": "blueprint-webapp",
  "metrics-reporter": "blueprint-webapp",
  "investor-relations-agent": "blueprint-executive-ops",
  "community-updates-agent": "blueprint-webapp",
  "workspace-digest-publisher": "blueprint-webapp",
  "market-intel-agent": "blueprint-webapp",
  "supply-intel-agent": "blueprint-executive-ops",
  "capturer-growth-agent": "blueprint-webapp",
  "public-space-review-agent": "blueprint-webapp",
  "city-launch-agent": "blueprint-executive-ops",
  "demand-intel-agent": "blueprint-executive-ops",
  "robot-team-growth-agent": "blueprint-webapp",
  "site-operator-partnership-agent": "blueprint-executive-ops",
  "city-demand-agent": "blueprint-executive-ops",
  "buyer-solutions-agent": "blueprint-webapp",
  "solutions-engineering-agent": "blueprint-webapp",
  "rights-provenance-agent": "blueprint-capture-pipeline",
  "security-procurement-agent": "blueprint-executive-ops",
  "capturer-success-agent": "blueprint-capture",
  "site-catalog-agent": "blueprint-webapp",
  "outbound-sales-agent": "blueprint-webapp",
  "buyer-success-agent": "blueprint-webapp",
  "revenue-ops-pricing-agent": "blueprint-executive-ops",
  "docs-agent": "blueprint-executive-ops",
};

function resolveInstructionSource(agentKey) {
  const agentPath = path.join(repoRoot, "ops/paperclip/blueprint-company/agents", agentKey, "AGENTS.md");
  const skillAgentKey = agentKey.replace(/^blueprint-/, "");
  const skillPath = path.join(repoRoot, "ops/paperclip/skills", `${skillAgentKey}.md`);
  return fs.access(agentPath).then(() => agentPath).catch(() => fs.access(skillPath).then(() => skillPath).catch(() => null));
}

async function ensureCanonicalProject(companyId, projects, projectKey, projectConfig) {
  const existing = pickCanonicalProject(projects, projectKey, projectConfig);
  if (existing) {
    return existing;
  }

  const workspaceConfig = resolvePrimaryWorkspaceConfig(projectConfig);
  const projectName = expectedProjectName(projectKey, projectConfig);
  const normalizedProjectStatus =
    projectConfig?.status === "active"
      ? "in_progress"
      : projectConfig?.status ?? "in_progress";

  const created = await fetchJson(`/api/companies/${companyId}/projects`, {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      status: normalizedProjectStatus,
      color: projectConfig?.color ?? "blue",
      workspace: workspaceConfig ? {
        name: workspaceConfig.name ?? projectName,
        sourceType: workspaceConfig.sourceType ?? "git_repo",
        cwd: workspaceConfig.cwd,
        repoUrl: workspaceConfig.repoUrl,
        repoRef: workspaceConfig.repoRef,
        defaultRef: workspaceConfig.defaultRef,
        visibility: workspaceConfig.visibility,
        setupCommand: workspaceConfig.setupCommand,
        isPrimary: workspaceConfig.isPrimary !== false,
      } : undefined,
    }),
  });
  projects.push(created);
  console.log(`[paperclip] Created missing canonical project ${projectKey}`);
  return created;
}

function buildAnalyticsRoutineDescription(cadence) {
  return [
    "Investigate repo, CI, and Blueprint plugin state first, then synthesize the findings into headline, summaryBullets, workflowFindings, risks, and recommendedFollowUps.",
    "Every recommendedFollowUp will be turned into a routed Paperclip follow-up issue by the deterministic writer, so keep those items concrete and owner-ready.",
    "Use structured followUpIssues only when you need to override the default title, assignee, project, priority, or blocker-vs-owner_ready classification.",
    "Do not place monitor-only or informational notes in recommendedFollowUps; keep those in summaryBullets, workflowFindings, or risks instead.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/analytics-report with JSON body {"params":{"cadence":"${cadence}"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id. Do not waste time resolving the plugin id. Do not send the agent bearer token to the plugin action route if it returns Board access required.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state always contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildMarketIntelRoutineDescription(cadence) {
  return [
    "Read the steering file at ops/paperclip/programs/market-intel-program.md for current research priorities.",
    "Scan web sources using the web-search tool for competitor, technology, market, and regulatory signals.",
    "Score each signal using the relevance/urgency/actionability formula from the contract.",
    "Synthesize findings into headline, signals, competitorUpdates, technologyFindings, and recommendedActions.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/market-intel-report with JSON body {"params":{"cadence":"${cadence}"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state always contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildInvestorRelationsRoutineDescription() {
  return [
    "Read ops/paperclip/programs/investor-relations-agent-program.md and the humanizer skill before drafting.",
    "Ground on the current issue and gather real month-over-month metrics from Stripe, Firestore, analytics, Paperclip, and Firehose where relevant.",
    "Draft the full investor update with notion-write-knowledge and create the tracking artifact with notion-write-work-queue.",
    "When the active SendGrid-backed email draft path is configured, maintain the monthly investor draft. Do not live send or publish.",
    "When Slack is configured, post an internal #paperclip-exec digest announcing the draft is ready for review.",
    "PATCH the current issue to done only when the metrics are sourced, the draft artifacts exist, and the copy has passed the humanizer anti-AI pass. Otherwise PATCH it to blocked with the exact missing artifact or source-of-truth failure.",
  ].join(" ");
}

function buildCommunityUpdatesRoutineDescription() {
  return [
    "Read ops/paperclip/programs/community-updates-agent-program.md and the humanizer skill before drafting.",
    "Investigate the just-finished week first, then synthesize the findings into headline, shippedThisWeek, byTheNumbers, whatWeLearned, and whatIsNext.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/community-updates-report with JSON body {"params":{"cadence":"weekly"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id. Do not waste time resolving the plugin id. Do not send the agent bearer token to the plugin action route if it returns Board access required.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state always contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildNotionReconcilerRoutineDescription(mode) {
  return [
    "Inspect Blueprint Hub state first across Work Queue, Knowledge, Skills, Agents, and Agent Runs.",
    "Repair only clear metadata drift, stale flags, doctrine status, relation repair, and safe duplicates on Blueprint-managed pages.",
    "Do not guess across ambiguous page identity or unsafe archive/move decisions.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/notion-reconciler-run with JSON body {"params":{"mode":"${mode}"...}} after the sweep is complete so Agent Runs mirrors the work under Notion Manager ownership.`,
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state carries the repair counts and escalations.",
  ].join(" ");
}

function buildMetricsReporterRoutineDescription(cadence) {
  return [
    "Investigate analytics, Growth Studio, Work Queue, and Knowledge first, then synthesize the report into headline, executiveSummary, metricHighlights, anomalies, and recommendedFollowUps.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/metrics-reporter-report with JSON body {"params":{"cadence":"${cadence}"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildWorkspaceDigestRoutineDescription() {
  return [
    "Investigate Blueprint Knowledge, Growth Studio context, and selected Work Queue views before drafting.",
    "Synthesize the digest into headline, roundup, highlights, risks, nextActions, and optional followUpWorkItems.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/workspace-digest-report with JSON body {"params":{"cadence":"weekly"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state contains the draft artifact links or the exact failure reason.",
  ].join(" ");
}

function buildRoutineDescription(routineKey) {
  if (routineKey === "analytics-daily") return buildAnalyticsRoutineDescription("daily");
  if (routineKey === "analytics-weekly") return buildAnalyticsRoutineDescription("weekly");
  if (routineKey === "notion-reconciler-daily") return buildNotionReconcilerRoutineDescription("daily");
  if (routineKey === "notion-reconciler-weekly") return buildNotionReconcilerRoutineDescription("weekly");
  if (routineKey === "investor-relations-monthly") return buildInvestorRelationsRoutineDescription();
  if (routineKey === "community-updates-weekly") return buildCommunityUpdatesRoutineDescription();
  if (routineKey === "metrics-reporter-daily") return buildMetricsReporterRoutineDescription("daily");
  if (routineKey === "metrics-reporter-weekly") return buildMetricsReporterRoutineDescription("weekly");
  if (routineKey === "workspace-digest-weekly") return buildWorkspaceDigestRoutineDescription();
  if (routineKey === "market-intel-daily") return buildMarketIntelRoutineDescription("daily");
  if (routineKey === "market-intel-weekly") return buildMarketIntelRoutineDescription("weekly");
  return undefined;
}

function buildClaudeProbeConfigs(yamlAgents) {
  const seen = new Set();
  return Object.values(yamlAgents).flatMap((agentConfig) => {
    if (agentConfig?.adapter?.type !== "claude_local" || !agentConfig?.adapter?.config) {
      return [];
    }

    const adapterConfig = agentConfig.adapter.config;
    const probeConfig = {
      cwd: adapterConfig.cwd,
      model: adapterConfig.model || "claude-sonnet-4-6",
      dangerouslySkipPermissions:
        adapterConfig.dangerouslySkipPermissions !== false,
    };
    const fingerprint = JSON.stringify(probeConfig);
    if (seen.has(fingerprint)) {
      return [];
    }
    seen.add(fingerprint);
    return [probeConfig];
  });
}

function buildCodexProbeConfigs(yamlAgents) {
  const seen = new Set();
  return Object.values(yamlAgents).flatMap((agentConfig) => {
    if (agentConfig?.adapter?.type !== "codex_local" || !agentConfig?.adapter?.config) {
      return [];
    }

    const adapterConfig = agentConfig.adapter.config;
    const probeConfig = {
      cwd: adapterConfig.cwd,
      model: adapterConfig.model || fallbackCodexModel,
      modelReasoningEffort:
        adapterConfig.modelReasoningEffort || fallbackCodexReasoningEffort,
      dangerouslyBypassApprovalsAndSandbox:
        adapterConfig.dangerouslyBypassApprovalsAndSandbox !== false,
    };
    const fingerprint = JSON.stringify(probeConfig);
    if (seen.has(fingerprint)) {
      return [];
    }
    seen.add(fingerprint);
    return [probeConfig];
  });
}

function buildHermesProbeConfig(adapterConfig) {
  const normalized = buildHermesAdapterConfig(adapterConfig);
  return {
    cwd: normalized.cwd,
    ...(typeof normalized.instructionsFilePath === "string"
      && normalized.instructionsFilePath.trim().length > 0
      ? { instructionsFilePath: normalized.instructionsFilePath }
      : {}),
    ...(typeof normalized.model === "string" && normalized.model.trim().length > 0
      ? { model: normalized.model }
      : {}),
    ...(typeof normalized.provider === "string" && normalized.provider.trim().length > 0
      ? { provider: normalized.provider }
      : {}),
    ...(normalized.env && typeof normalized.env === "object" && !Array.isArray(normalized.env)
      ? { env: normalized.env }
      : {}),
    ...(typeof normalized.timeoutSec === "number" ? { timeoutSec: normalized.timeoutSec } : {}),
  };
}

function buildClaudeAdapterConfig(adapterConfig) {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslyBypassApprovalsAndSandbox;
  delete next.modelReasoningEffort;
  return {
    ...next,
    model:
      typeof adapterConfig?.model === "string" && adapterConfig.model.trim().length > 0
        ? adapterConfig.model
        : "claude-sonnet-4-6",
    dangerouslySkipPermissions: adapterConfig?.dangerouslySkipPermissions !== false,
  };
}

function buildCodexAdapterConfig(adapterConfig) {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslySkipPermissions;
  return {
    ...next,
    model:
      typeof adapterConfig?.model === "string" && adapterConfig.model.trim().length > 0
        ? adapterConfig.model
        : fallbackCodexModel,
    modelReasoningEffort:
      typeof adapterConfig?.modelReasoningEffort === "string" && adapterConfig.modelReasoningEffort.trim().length > 0
        ? adapterConfig.modelReasoningEffort
        : fallbackCodexReasoningEffort,
    dangerouslyBypassApprovalsAndSandbox:
      adapterConfig?.dangerouslyBypassApprovalsAndSandbox !== false,
  };
}

function buildHermesAdapterConfig(adapterConfig) {
  const next = { ...(adapterConfig ?? {}) };
  delete next[HERMES_MODEL_LADDER_CONFIG_KEY];
  delete next.base_url;
  delete next.baseUrl;
  delete next.api_key;
  delete next.api_key_env;
  const configuredModel = sanitizeHermesModel(
    typeof adapterConfig?.model === "string" ? adapterConfig.model : "",
    "",
  );
  const ladder = normalizeHermesModelList([
    ...(configuredModel.length > 0 && configuredModel !== legacyHermesModel ? [configuredModel] : []),
    ...hermesModelLadder,
  ]);
  const model =
    configuredModel.length > 0 && configuredModel !== legacyHermesModel
      ? configuredModel
      : hermesPrimaryModel;
  const provider = providerForHermesModel(model);
  const existingEnv =
    next.env && typeof next.env === "object" && !Array.isArray(next.env)
      ? next.env
      : {};
  const openRouterProviderRouting =
    provider === DEFAULT_HERMES_PROVIDER ? buildOpenRouterProviderRouting() : null;
  const env = provider === hermesDirectProvider
    ? {
        ...existingEnv,
        ANTHROPIC_BASE_URL: hermesBaseUrl,
      }
    : openRouterProviderRouting
      ? withOpenRouterProviderEnv(existingEnv, openRouterProviderRouting)
    : existingEnv;

  return {
    ...next,
    model,
    provider,
    [HERMES_MODEL_LADDER_CONFIG_KEY]: ladder,
    ...(openRouterProviderRouting
      ? {
          providerRouting: openRouterProviderRouting,
          openrouterProviderRouting: openRouterProviderRouting,
          openrouterProviderStrategy: "cache_read_cost_primary_avoid_parasail",
        }
      : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    paperclipApiUrl,
    promptTemplate:
      typeof adapterConfig?.promptTemplate === "string" && adapterConfig.promptTemplate.trim().length > 0
        ? adapterConfig.promptTemplate
        : BLUEPRINT_HERMES_PROMPT_TEMPLATE,
    modelReasoningEffort:
      typeof adapterConfig?.modelReasoningEffort === "string" && adapterConfig.modelReasoningEffort.trim().length > 0
        ? adapterConfig.modelReasoningEffort
        : "max",
    timeoutSec: typeof adapterConfig?.timeoutSec === "number" ? adapterConfig.timeoutSec : 1800,
  };
}

function hermesFreeFallbackFor(desired, baseAdapterConfig = desired.adapterConfig ?? {}) {
  const fallbackModel = hermesFreeModels[0] ?? hermesFallbackModel;
  const adapterConfig = buildHermesAdapterConfig({
    ...(baseAdapterConfig ?? {}),
    model: fallbackModel,
    [HERMES_MODEL_LADDER_CONFIG_KEY]: hermesModelLadder,
  });
  const cwd = typeof adapterConfig.cwd === "string" ? adapterConfig.cwd : "";
  if (!cwd) return null;
  return {
    adapterType: "hermes_local",
    adapterConfig: {
      ...adapterConfig,
      cwd,
    },
  };
}

function summarizeProbeFailure(result, fallbackMessage) {
  return result?.checks?.map?.((check) => check.message).filter(Boolean).join("; ") || fallbackMessage;
}

async function probeAdapter(companyId, adapterType, adapterConfig) {
  try {
    const timeoutMs = Number(process.env.PAPERCLIP_ADAPTER_PROBE_TIMEOUT_MS || "10000");
    const result = await fetchJson(
      `/api/companies/${companyId}/adapters/${adapterType}/test-environment`,
      {
        method: "POST",
        body: JSON.stringify({ adapterConfig }),
        timeoutMs,
      },
    );
    return {
      status:
        result?.status === "pass"
          ? "pass"
          : result?.status === "warn"
            ? "warn"
            : "fail",
      reason:
        result?.status === "pass"
          ? `${adapterType} probe passed`
          : result?.status === "warn"
            ? summarizeProbeFailure(result, `${adapterType} probe warned`)
          : summarizeProbeFailure(result, `${adapterType} probe failed`),
    };
  } catch (error) {
    return {
      status: "fail",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildWorkspaceProbeMatrix(yamlAgents) {
  const byCwd = new Map();
  for (const agentConfig of Object.values(yamlAgents)) {
    const adapterType = agentConfig?.adapter?.type;
    const adapterConfig = agentConfig?.adapter?.config;
    const cwd = typeof adapterConfig?.cwd === "string" ? adapterConfig.cwd : "";
    if (!cwd) continue;
    if (!byCwd.has(cwd)) {
      byCwd.set(cwd, {});
    }
    const entry = byCwd.get(cwd);
    if (adapterType === "claude_local" && !entry.claude_local) {
      entry.claude_local = {
        cwd,
        model: adapterConfig.model || "claude-sonnet-4-6",
        dangerouslySkipPermissions: adapterConfig.dangerouslySkipPermissions !== false,
      };
    }
    if (adapterType === "codex_local" && !entry.codex_local) {
      entry.codex_local = {
        cwd,
        model: adapterConfig.model || fallbackCodexModel,
        modelReasoningEffort:
          adapterConfig.modelReasoningEffort || fallbackCodexReasoningEffort,
        dangerouslyBypassApprovalsAndSandbox:
          adapterConfig.dangerouslyBypassApprovalsAndSandbox !== false,
      };
    }
    if (adapterType === "hermes_local" && !entry.hermes_local) {
      entry.hermes_local = buildHermesProbeConfig(adapterConfig);
    }
    // Probe hermes_local for every cwd — it is the secondary-free fallback for claude/codex agents
    if (!entry.hermes_local) {
      entry.hermes_local = { cwd };
    }
  }
  return byCwd;
}

async function resolveWorkspaceAvailability(companyId, yamlAgents) {
  const workspaceMatrix = buildWorkspaceProbeMatrix(yamlAgents);
  const availability = {};
  for (const [cwd, probeConfigs] of workspaceMatrix.entries()) {
    availability[cwd] = {};
    if (probeConfigs.claude_local) {
      availability[cwd].claude_local = await probeAdapter(
        companyId,
        "claude_local",
        probeConfigs.claude_local,
      );
    }
    if (probeConfigs.codex_local) {
      availability[cwd].codex_local = await probeAdapter(
        companyId,
        "codex_local",
        probeConfigs.codex_local,
      );
    }
    if (probeConfigs.hermes_local) {
      availability[cwd].hermes_local = await probeAdapter(
        companyId,
        "hermes_local",
        probeConfigs.hermes_local,
      );
    }
  }
  return availability;
}

function fallbackAdapterFor(desired) {
  const adapterConfig = desired.adapterConfig ?? {};
  if (desired.adapterType === "claude_local") {
    return {
      adapterType: "codex_local",
      adapterConfig: buildCodexAdapterConfig({
        ...adapterConfig,
        model: fallbackCodexModel,
        modelReasoningEffort: fallbackCodexReasoningEffort,
      }),
    };
  }

  if (desired.adapterType === "hermes_local") {
    // hermes has no tier-2 equivalent; direct tertiary fallback is handled in chooseAdapterForAgent
    return null;
  }

  if (desired.adapterType !== "codex_local") {
    return null;
  }

  return {
    adapterType: "claude_local",
    adapterConfig: buildClaudeAdapterConfig({
      ...adapterConfig,
      model: "claude-sonnet-4-6",
    }),
  };
}

function buildExecutionPolicyForAgent(agentConfig, requestedMode, effectiveAdapterType = null) {
  const authoredAdapterType = agentConfig?.adapter?.type;
  const authoredAdapterConfig = agentConfig?.adapter?.config ?? {};
  if (!authoredAdapterType || !authoredAdapterConfig) {
    return {};
  }

  const perAdapterConfig = {
    claude_local: buildClaudeAdapterConfig(authoredAdapterConfig),
    codex_local: buildCodexAdapterConfig({
      ...authoredAdapterConfig,
      model: fallbackCodexModel,
      modelReasoningEffort: fallbackCodexReasoningEffort,
    }),
    hermes_local:
      authoredAdapterType === "hermes_local"
        ? buildHermesAdapterConfig(authoredAdapterConfig)
        : hermesFreeFallbackFor(
          { adapterType: authoredAdapterType, adapterConfig: authoredAdapterConfig },
          authoredAdapterConfig,
        )?.adapterConfig ?? undefined,
  };

  if (effectiveAdapterType === "hermes_local" || authoredAdapterType === "hermes_local") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["hermes_local", "codex_local"],
      preferredAdapterTypes: ["hermes_local", "codex_local"],
      perAdapterConfig: {
        codex_local: perAdapterConfig.codex_local,
        hermes_local: perAdapterConfig.hermes_local,
      },
    };
  }

  if (authoredAdapterType === "codex_local") {
    return {
      mode: "fixed",
      compatibleAdapterTypes: ["codex_local"],
      preferredAdapterTypes: ["codex_local"],
      perAdapterConfig: {
        codex_local: perAdapterConfig.codex_local,
      },
    };
  }

  if (requestedMode === "codex") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["codex_local", "hermes_local", "claude_local"],
      preferredAdapterTypes: ["codex_local", "hermes_local", "claude_local"],
      perAdapterConfig,
    };
  }

  if (authoredAdapterType === "claude_local") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["claude_local", "hermes_local", "codex_local"],
      preferredAdapterTypes: ["claude_local", "hermes_local", "codex_local"],
      perAdapterConfig,
    };
  }

  return {};
}

function chooseAdapterForAgent(desired, requestedMode, workspaceAvailability) {
  // Codex-authored implementation/review/creative lanes are fixed primary
  // adapter lanes during reconcile. A transient probe timeout is a verifier
  // blocker, not a reason to demote the live primary adapter to Hermes.
  if (desired.adapterType === "codex_local") {
    return desired;
  }

  // hermes mode: force all agents to hermes_local when it is available
  if (requestedMode === "hermes") {
    const hermesFree = hermesFreeFallbackFor(desired);
    if (hermesFree && workspaceAvailability?.hermes_local?.status === "pass") return hermesFree;
    return desired;
  }

  // hermes_local: probe hermes, then fall back to the paid local adapters
  if (desired.adapterType === "hermes_local") {
    if (requestedMode === "codex") {
      const codex = {
        adapterType: "codex_local",
        adapterConfig: buildCodexAdapterConfig(desired.adapterConfig),
      };
      if (workspaceAvailability?.codex_local?.status === "pass") return codex;
    }
    const hermesStatus = workspaceAvailability?.hermes_local?.status;
    if (hermesStatus === "pass") return desired;
    const codex = {
      adapterType: "codex_local",
      adapterConfig: buildCodexAdapterConfig(desired.adapterConfig),
    };
    if (workspaceAvailability?.codex_local?.status === "pass") return codex;
    return desired;
  }

  // claude_local and codex_local only from here
  if (desired.adapterType !== "claude_local" && desired.adapterType !== "codex_local") {
    return desired;
  }

  const fallback = fallbackAdapterFor(desired);

  if (requestedMode === "claude") {
    return desired.adapterType === "claude_local" ? desired : (fallback ?? desired);
  }
  if (requestedMode === "codex") {
    return desired.adapterType === "codex_local" ? desired : (fallback ?? desired);
  }

  // auto mode: 3-tier probe chain
  const desiredStatus = workspaceAvailability?.[desired.adapterType]?.status;
  if (desiredStatus === "pass") return desired;

  if (fallback) {
    const fallbackStatus = workspaceAvailability?.[fallback.adapterType]?.status;
    if (fallbackStatus === "pass") return fallback;
  }

  // Tier 3: hermes_local with the free ladder
  const hermesFree = hermesFreeFallbackFor(desired);
  if (hermesFree && workspaceAvailability?.hermes_local?.status === "pass") return hermesFree;

  return desired;
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function shouldPreserveFixedLiveAdapter(agent, workspaceAvailability) {
  if (forceAdapterSync) return false;
  const runtimeConfig = asPlainObject(agent?.runtimeConfig);
  const executionPolicy = asPlainObject(runtimeConfig.executionPolicy);
  if (executionPolicy.mode !== "fixed") return false;

  const adapterType = typeof agent?.adapterType === "string" ? agent.adapterType : "";
  if (!adapterType) return false;
  if (
    adapterType === "hermes_local"
    && (
      (Array.isArray(executionPolicy.preferredAdapterTypes) && executionPolicy.preferredAdapterTypes.includes("claude_local"))
      || (Array.isArray(executionPolicy.compatibleAdapterTypes) && executionPolicy.compatibleAdapterTypes.includes("claude_local"))
    )
  ) {
    return false;
  }

  const availability = workspaceAvailability?.[adapterType];
  if (!availability) return true;
  return availability.status === "pass" || availability.status === "warn";
}

const config = yaml.load(await fs.readFile(paperclipConfigPath, "utf8")) ?? {};
const yamlAgents = config.agents ?? {};
const yamlRoutines = config.routines ?? {};
const yamlProjects = config.projects ?? {};

const companies = await fetchJson("/api/companies");
const company = companies.find((entry) => entry.name === companyName);
if (!company) {
  throw new Error(`Company not found: ${companyName}`);
}

const [agents, projects, routines] = await Promise.all([
  fetchJson(`/api/companies/${company.id}/agents`),
  fetchJson(`/api/companies/${company.id}/projects`),
  fetchJson(`/api/companies/${company.id}/routines`),
]);
const effectiveRequestedMode = forceCodexClaudeLanes ? "codex" : requestedClaudeLaneMode;
const workspaceAvailability = await resolveWorkspaceAvailability(company.id, yamlAgents);
for (const [cwd, adapters] of Object.entries(workspaceAvailability)) {
  const claudeReason = adapters.claude_local?.reason ?? "not configured";
  const codexReason = adapters.codex_local?.reason ?? "not configured";
  const hermesReason = adapters.hermes_local?.reason ?? "not configured";
  console.log(
    `[paperclip] ${cwd} -> claude=${adapters.claude_local?.status ?? "n/a"} (${claudeReason}) | codex=${adapters.codex_local?.status ?? "n/a"} (${codexReason}) | hermes=${adapters.hermes_local?.status ?? "n/a"} (${hermesReason})`,
  );
}

const desiredAgents = Object.fromEntries(
  Object.entries(yamlAgents).flatMap(([yamlAgentKey, agentConfig]) => {
    const paperclipAgentKey = toPaperclipAgentKey(yamlAgentKey);
    const adapterType = agentConfig?.adapter?.type;
    const authoredAdapterConfig = agentConfig?.adapter?.config;
    const adapterConfig =
      adapterType === "hermes_local"
        ? buildHermesAdapterConfig(authoredAdapterConfig)
        : authoredAdapterConfig;
    if (!adapterType || !adapterConfig) {
      console.warn(`Skipping ${paperclipAgentKey}: missing adapter config in .paperclip.yaml`);
      return [];
    }
    return [[
      paperclipAgentKey,
      chooseAdapterForAgent(
        { adapterType, adapterConfig },
        effectiveRequestedMode,
        workspaceAvailability[adapterConfig.cwd] ?? {},
      ),
    ]];
  }),
);

for (const [agentKey, desired] of Object.entries(desiredAgents)) {
  const agent = pickCanonical(agents, agentKey);
  const yamlAgentConfig = yamlAgents[agentKey];
  if (!agent) {
    console.warn(`Agent not found in Paperclip: ${agentKey}`);
    continue;
  }
  const currentAdapterConfig = asPlainObject(agent.adapterConfig);
  const existingRuntimeConfig = asPlainObject(agent.runtimeConfig);
  const preserveFixedLiveAdapter =
    agent.adapterType === desired.adapterType
    && shouldPreserveFixedLiveAdapter(
      agent,
      workspaceAvailability[currentAdapterConfig.cwd ?? desired.adapterConfig.cwd] ?? {},
    );
  const effectiveDesired = preserveFixedLiveAdapter
    ? {
      adapterType: agent.adapterType,
      adapterConfig: currentAdapterConfig,
    }
    : desired;

  const nextRuntimeConfig = preserveFixedLiveAdapter
    ? existingRuntimeConfig
    : {
      ...existingRuntimeConfig,
      executionPolicy: buildExecutionPolicyForAgent(
        yamlAgentConfig,
        effectiveRequestedMode,
        effectiveDesired.adapterType,
      ),
    };
  if (!preserveFixedLiveAdapter) {
    delete nextRuntimeConfig.executionProfile;
  }

  const agentNeedsPatch =
    agent.adapterType !== effectiveDesired.adapterType
    || stableStringify(currentAdapterConfig) !== stableStringify(effectiveDesired.adapterConfig)
    || stableStringify(existingRuntimeConfig) !== stableStringify(nextRuntimeConfig);

  if (agentNeedsPatch) {
    await fetchJson(`/api/agents/${agent.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        adapterType: effectiveDesired.adapterType,
        replaceAdapterConfig: true,
        adapterConfig: effectiveDesired.adapterConfig,
        runtimeConfig: nextRuntimeConfig,
      }),
    });
  } else if (preserveFixedLiveAdapter) {
    console.log(
      `[paperclip] Preserved fixed live adapter override for ${agentKey} -> ${agent.adapterType}`,
    );
  }

  if (agentNeedsPatch && agent.adapterType !== effectiveDesired.adapterType) {
    await fetchJson(`/api/agents/${agent.id}/runtime-state/reset-session`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }
  const desiredBudgetMonthlyCents =
    typeof yamlAgentConfig?.budgetMonthlyCents === "number"
      ? yamlAgentConfig.budgetMonthlyCents
      : 0;
  if (agent.budgetMonthlyCents !== desiredBudgetMonthlyCents) {
    await fetchJson(`/api/agents/${agent.id}/budgets`, {
      method: "PATCH",
      body: JSON.stringify({
        budgetMonthlyCents: desiredBudgetMonthlyCents,
      }),
    });
  }
  if (agent.status === "paused") {
    await fetchJson(`/api/agents/${agent.id}/resume`, { method: "POST" });
  }

  const duplicateAgents = pickMatching(agents, agentKey)
    .filter((candidate) => candidate.id !== agent.id);
  for (const duplicate of duplicateAgents) {
    if ((duplicate.budgetMonthlyCents ?? 0) !== 0) {
      await fetchJson(`/api/agents/${duplicate.id}/budgets`, {
        method: "PATCH",
        body: JSON.stringify({
          budgetMonthlyCents: 0,
        }),
      }).catch(() => undefined);
    }
    await cancelOpenRunsForAgent(company.id, duplicate.id);
    if (duplicate.status !== "terminated") {
      await fetchJson(`/api/agents/${duplicate.id}/terminate`, {
        method: "POST",
      }).catch(() => undefined);
    }
  }
}

const canonicalProjectEntries = await Promise.all(
  Object.entries(yamlProjects).map(async ([projectKey, projectConfig]) => [
    projectKey,
    await ensureCanonicalProject(company.id, projects, projectKey, projectConfig),
  ]),
);
const canonicalProjects = Object.fromEntries(canonicalProjectEntries);

const canonicalAgents = Object.fromEntries(
  Object.keys(desiredAgents).map((agentKey) => [agentKey, pickCanonical(agents, agentKey)]),
);

async function syncAgentInstructions(agent, sourcePath) {
  if (!agent || !sourcePath) return;
  const sourceDir = path.dirname(sourcePath);
  const sourceBase = path.basename(sourcePath);
  const bundleFiles = [];

  if (sourceBase === "AGENTS.md") {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    const markdownFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort((a, b) => {
        if (a === "AGENTS.md") return -1;
        if (b === "AGENTS.md") return 1;
        return a.localeCompare(b);
      });

    for (const filename of markdownFiles) {
      bundleFiles.push({
        path: filename,
        content: await fs.readFile(path.join(sourceDir, filename), "utf8"),
      });
    }
  } else {
    bundleFiles.push({
      path: "AGENTS.md",
      content: await fs.readFile(sourcePath, "utf8"),
    });
  }

  if (agent.adapterType === "hermes_local") {
    for (const file of bundleFiles) {
      if (file.path !== "AGENTS.md") continue;
      if (file.content.includes("## Paperclip Runtime Safety")) {
        file.content = file.content.replace(
          /\n## Paperclip Runtime Safety[\s\S]*$/m,
          `${HERMES_SAFETY_BUNDLE_SECTION}\n`,
        );
        continue;
      }
      file.content = `${file.content.trimEnd()}${HERMES_SAFETY_BUNDLE_SECTION}\n`;
    }
  }

  await fetchJson(`/api/agents/${agent.id}/instructions-bundle`, {
    method: "PATCH",
    body: JSON.stringify({
      mode: "managed",
      entryFile: "AGENTS.md",
      clearLegacyPromptTemplate: true,
    }),
  });

  for (const file of bundleFiles) {
    await fetchJson(`/api/agents/${agent.id}/instructions-bundle/file`, {
      method: "PUT",
      body: JSON.stringify({
        path: file.path,
        content: file.content,
        clearLegacyPromptTemplate: true,
      }),
    });
  }
}

const instructionSourceEntries = await Promise.all(
  Object.keys(desiredAgents).map(async (agentKey) => [agentKey, await resolveInstructionSource(agentKey)]),
);
const instructionSources = Object.fromEntries(
  instructionSourceEntries.filter(([, sourcePath]) => Boolean(sourcePath)),
);

const desiredRoutines = Object.entries(yamlRoutines).flatMap(([routineKey, routineConfig]) => {
  const scheduleTrigger = Array.isArray(routineConfig?.triggers)
    ? routineConfig.triggers.find((trigger) => trigger.kind === "schedule" && typeof trigger.cronExpression === "string")
    : null;
  const agentKey = inferRoutineAgentKey(routineKey, routineConfig);
  const projectKey = agentKey ? AGENT_DEFAULT_PROJECT_KEYS[agentKey] : null;
  if (!scheduleTrigger || !agentKey || !projectKey) {
    console.warn(`Skipping routine ${routineKey}: missing schedule, agent inference, or project mapping`);
    return [];
  }

  return [{
    routineKey,
    title: titleizeRoutineKey(routineKey),
    project: canonicalProjects[projectKey] ?? null,
    agent: canonicalAgents[agentKey] ?? null,
    cronExpression: scheduleTrigger.cronExpression,
    timezone: scheduleTrigger.timezone ?? "America/New_York",
    description: buildRoutineDescription(routineKey),
    priority: routineConfig.priority ?? "medium",
    desiredStatus: routineConfig.status === "paused" ? "paused" : "active",
  }];
});

for (const desired of desiredRoutines) {
  const {
    routineKey,
    title,
    project,
    agent,
    cronExpression,
    timezone,
    description,
    priority,
    desiredStatus,
    concurrencyPolicy,
    catchUpPolicy,
  } = desired;
  if (!project || !agent) {
    console.warn(`Skipping routine ${title}: missing canonical project or agent`);
    continue;
  }

  const matching = routines.filter((routine) => routine.title === title);
  const preferred =
    pickPreferredRoutine(matching, project.id, agent.id) ??
    await fetchJsonWithConflictRetry(`/api/companies/${company.id}/routines`, {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        title,
        description,
        assigneeAgentId: agent.id,
        priority,
        status: desiredStatus,
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
      }),
    });

  const desiredConcurrencyPolicy = concurrencyPolicy ?? "coalesce_if_active";
  const desiredCatchUpPolicy = catchUpPolicy ?? "skip_missed";
  const routineNeedsPatch =
    preferred.projectId !== project.id
    || preferred.assigneeAgentId !== agent.id
    || !sameNullableValue(preferred.description, description)
    || preferred.status !== desiredStatus
    || preferred.priority !== priority
    || preferred.concurrencyPolicy !== desiredConcurrencyPolicy
    || preferred.catchUpPolicy !== desiredCatchUpPolicy;

  if (routineNeedsPatch) {
    await fetchJson(`/api/routines/${preferred.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        projectId: project.id,
        assigneeAgentId: agent.id,
        description,
        status: desiredStatus,
        priority,
        concurrencyPolicy: desiredConcurrencyPolicy,
        catchUpPolicy: desiredCatchUpPolicy,
      }),
    });
  }

  const preferredDetail = await fetchJson(`/api/routines/${preferred.id}`);
  const preferredScheduleTriggers = (preferredDetail.triggers ?? []).filter(
    (trigger) => trigger.kind === "schedule",
  );
  const scheduleTrigger = preferredScheduleTriggers[0] ?? null;
  if (!scheduleTrigger) {
    await fetchJson(`/api/routines/${preferred.id}/triggers`, {
      method: "POST",
      body: JSON.stringify({
        kind: "schedule",
        cronExpression,
        timezone,
        enabled: desiredStatus === "active",
      }),
    });
  } else if (
    scheduleTrigger.cronExpression !== cronExpression
    || scheduleTrigger.timezone !== timezone
    || scheduleTrigger.enabled !== (desiredStatus === "active")
  ) {
    await fetchJson(`/api/routine-triggers/${scheduleTrigger.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cronExpression,
        timezone,
        enabled: desiredStatus === "active",
      }),
    });
  }

  const refreshedPreferredDetail = await fetchJson(`/api/routines/${preferred.id}`);
  const refreshedScheduleTriggers = (refreshedPreferredDetail.triggers ?? []).filter(
    (trigger) => trigger.kind === "schedule",
  );
  const canonicalTrigger = refreshedScheduleTriggers[0] ?? null;
  if (!canonicalTrigger) {
    throw new Error(`Routine ${title} is missing a schedule trigger after reconcile`);
  }
  const shouldEnable = desiredStatus === "active";
  if (
    canonicalTrigger.cronExpression !== cronExpression
    || canonicalTrigger.timezone !== timezone
    || canonicalTrigger.enabled !== shouldEnable
  ) {
    await fetchJson(`/api/routine-triggers/${canonicalTrigger.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cronExpression,
        timezone,
        enabled: shouldEnable,
      }),
    });
  }
  for (const duplicateTrigger of refreshedScheduleTriggers.slice(1)) {
    await fetchJson(`/api/routine-triggers/${duplicateTrigger.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  for (const routine of matching) {
    if (routine.id === preferred.id) continue;
    await fetchJson(`/api/routines/${routine.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
    const duplicateDetail = await fetchJson(`/api/routines/${routine.id}`);
    for (const trigger of duplicateDetail.triggers ?? []) {
      if (trigger.kind === "schedule") {
        await fetchJson(`/api/routine-triggers/${trigger.id}`, { method: "DELETE" }).catch(() => undefined);
      } else if (trigger.enabled !== false) {
        await fetchJson(`/api/routine-triggers/${trigger.id}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: false }),
        }).catch(() => undefined);
      }
    }
  }

  console.log(
    `Reconciled routine ${routineKey} -> ${title} (${preferred.id}) [${desiredStatus}] ${cronExpression} ${timezone}`,
  );
}

for (const [agentKey, sourcePath] of Object.entries(instructionSources)) {
  const canonicalAgent = canonicalAgents[agentKey];
  if (canonicalAgent) {
    await syncAgentInstructions(canonicalAgent, sourcePath);
  }
}

console.log(
  `Reconciled ${Object.keys(desiredAgents).length} agents and ${desiredRoutines.length} routines from .paperclip.yaml (requested mode: ${effectiveRequestedMode})`,
);
NODE
