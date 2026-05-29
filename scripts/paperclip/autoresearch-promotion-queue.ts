import { readFileSync } from "node:fs";

type FailureSignatureCategory =
  | "shared_prompt_guardrail"
  | "route_contract"
  | "auth_or_env"
  | "tooling_gap"
  | "runtime_capacity"
  | "agent_logic"
  | "unknown";

type FailureSignature = {
  key: string;
  title: string;
  category: FailureSignatureCategory;
  fixLayer?: string;
  matchedBy?: string;
  blockerId?: string;
};

type ClassifiedFailureCluster = {
  signature: FailureSignature;
  count: number;
  stalledCount?: number;
  failedCount?: number;
  timedOutCount?: number;
  agents?: string[];
  agentKeys?: string[];
  runIds?: string[];
  issueIdentifiers?: string[];
};

export type AutoResearchPromotionLane =
  | "autoagent_eval"
  | "prompt_patch"
  | "policy_patch"
  | "closeout_rule_patch";

export type AutoResearchPromotionQueueItem = {
  id: string;
  priority: number;
  lane: AutoResearchPromotionLane;
  sourceFailureFamily: string;
  failureFamilyTitle: string;
  owner: string;
  targetFile: string;
  expectedNegativeControl: string;
  validationCommand: string;
  promotionThreshold: string;
  rollbackCondition: string;
  residualRisk: string;
  observedCount: number;
  observedAgents: string[];
  proofPaths: string;
  blockedClaims: string[];
};

type QueueRule = {
  lane: AutoResearchPromotionLane;
  owner: string;
  targetFile: string;
  expectedNegativeControl: string;
  validationCommand: string;
  promotionThreshold: string;
  rollbackCondition: string;
  residualRisk: string;
  blockedClaims: string[];
};

const PROMOTION_QUEUE_SCOPE =
  "Repo-local candidate queue only. Does not mutate Paperclip, Hermes, providers, Firebase, Notion, Stripe, Render, or production behavior.";

const DEFAULT_RULES: Record<AutoResearchPromotionLane, QueueRule> = {
  autoagent_eval: {
    lane: "autoagent_eval",
    owner: "webapp-codex",
    targetFile: "labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md",
    expectedNegativeControl:
      "A schema-valid candidate that omits owner, target file, negative control, validation command, promotion threshold, rollback condition, or residual risk must be rejected.",
    validationCommand:
      "npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts",
    promotionThreshold:
      "Promote only after a local fixture proves the unsafe candidate is blocked and the expected queue item remains repo-local with every required field present.",
    rollbackCondition:
      "Rollback if the eval accepts a queue item that lacks required fields, claims live readiness, or points directly at production mutation.",
    residualRisk:
      "The eval proves queue discipline only; it does not prove the underlying Paperclip or Hermes runtime has recovered.",
    blockedClaims: [
      "live Paperclip readiness",
      "Hermes/provider recovery",
      "production promotion",
    ],
  },
  prompt_patch: {
    lane: "prompt_patch",
    owner: "blueprint-chief-of-staff",
    targetFile: "ops/paperclip/blueprint-company/hermes-profiles/orchestrator-task-template.md",
    expectedNegativeControl:
      "An issue-bound wake that broadens into /api/runs discovery, ad hoc jq probing, or queue-wide exploration must be classified as blocked prompt behavior.",
    validationCommand:
      "npm exec -- vitest run scripts/paperclip/sweep-agent-run-failures.test.ts scripts/paperclip/autoresearch-promotion-queue.test.ts",
    promotionThreshold:
      "Promote only after at least two unsuppressed runs share the family, or one issue-bound fixture reproduces the unsafe scope-widening before the prompt patch.",
    rollbackCondition:
      "Rollback if agents lose the issue-bound read path, suppress legitimate run evidence, or the negative control no longer blocks queue-wide probing.",
    residualRisk:
      "Prompt guidance can reduce repeated exploration tax but cannot guarantee live runtime route availability.",
    blockedClaims: [
      "queue-wide Paperclip authority",
      "live Hermes Kanban sync",
      "production Paperclip mutation",
    ],
  },
  policy_patch: {
    lane: "policy_patch",
    owner: "blueprint-cto",
    targetFile: "docs/ai-skills-governance-2026-04-07.md",
    expectedNegativeControl:
      "A failure caused by provider auth, quota, missing env, or capacity may not be rewritten as product readiness, buyer fulfillment, or a production recovery claim.",
    validationCommand:
      "npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts",
    promotionThreshold:
      "Promote only when the recurring family has no later same-scope recovery and the patch preserves repo/Paperclip/provider source-of-truth boundaries.",
    rollbackCondition:
      "Rollback if the policy lets agents bypass provider/account blockers, hides auth failures, or implies runtime recovery without owning-system proof.",
    residualRisk:
      "A policy patch can improve classification and escalation discipline; live credentials, quotas, and service health remain external proof requirements.",
    blockedClaims: [
      "provider auth repaired",
      "quota reset",
      "operational launch readiness",
    ],
  },
  closeout_rule_patch: {
    lane: "closeout_rule_patch",
    owner: "webapp-codex",
    targetFile: "server/agents/goal-closeout-contract.ts",
    expectedNegativeControl:
      "A succeeded run with terminal provider errors, a failed run with clean turn completion, or a stalled run without proof may not close as done without explicit residual risk.",
    validationCommand:
      "npm exec -- vitest run scripts/paperclip/sweep-agent-run-failures.test.ts scripts/paperclip/autoresearch-promotion-queue.test.ts",
    promotionThreshold:
      "Promote only after a local classifier or closeout fixture reproduces the bad state transition and the patch forces done, blocked, or awaiting_human_decision evidence fields.",
    rollbackCondition:
      "Rollback if closeouts become noisier without blocking false completion, or if adapter success can again stand in for proof paths and command outputs.",
    residualRisk:
      "Closeout-rule patches improve evidence discipline but do not repair upstream provider capacity, tool availability, or Paperclip service health.",
    blockedClaims: [
      "adapter success equals completion",
      "provider failure recovered",
      "production closeout readiness",
    ],
  },
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function ruleForSignature(signature: FailureSignature): QueueRule {
  const key = normalizeKey(signature.key);

  if (
    key.includes("marked_succeeded")
    || key.includes("exit_zero_provider_logical_failure")
    || key.includes("codex_local_exec_tooling_unavailable")
    || key.includes("stalled_run_without_output")
  ) {
    return DEFAULT_RULES.closeout_rule_patch;
  }

  if (
    key.includes("paperclip_runs_probe")
    || key.includes("invalid_jq")
    || key.includes("issue_bound_wake_widened_scope")
  ) {
    return DEFAULT_RULES.prompt_patch;
  }

  if (
    key.includes("provider_quota")
    || key.includes("openrouter_provider_auth")
    || key.includes("paperclip_auth_or_env")
    || key.includes("codex_usage_limit")
    || key.includes("provider_or_model_timeout")
    || key.includes("process_loss")
    || key.includes("runtime_context_or_output_limit")
    || key.includes("provider_model_contract_failure")
  ) {
    return DEFAULT_RULES.policy_patch;
  }

  if (signature.category === "shared_prompt_guardrail" || signature.category === "route_contract") {
    return DEFAULT_RULES.prompt_patch;
  }

  if (signature.category === "auth_or_env" || signature.category === "runtime_capacity") {
    return DEFAULT_RULES.policy_patch;
  }

  if (signature.category === "tooling_gap" || signature.category === "agent_logic") {
    return DEFAULT_RULES.closeout_rule_patch;
  }

  return DEFAULT_RULES.autoagent_eval;
}

function proofPathsForCluster(cluster: ClassifiedFailureCluster, paperclipApiUrl?: string | null) {
  const runIds = cluster.runIds?.slice(0, 8).join(", ") || "none";
  const issueIdentifiers = cluster.issueIdentifiers?.slice(0, 8).join(", ") || "none";
  const source = paperclipApiUrl || "classified sweep JSON";
  return `runs=${runIds}; issues=${issueIdentifiers}; source=${source}`;
}

function stableQueueId(lane: AutoResearchPromotionLane, signatureKey: string) {
  return `autoresearch:${lane}:${signatureKey.replace(/[^a-zA-Z0-9:_-]+/g, "-")}`;
}

export function buildAutoResearchPromotionQueue(input: {
  clusters: ClassifiedFailureCluster[];
  paperclipApiUrl?: string | null;
  maxItems?: number;
}) {
  const sortedClusters = input.clusters
    .filter((cluster) => cluster.count > 0 && cluster.signature?.key)
    .slice()
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.signature.key.localeCompare(right.signature.key);
    });

  const limitedClusters = Number.isFinite(input.maxItems)
    ? sortedClusters.slice(0, Math.max(0, input.maxItems ?? sortedClusters.length))
    : sortedClusters;

  return limitedClusters.map((cluster, index): AutoResearchPromotionQueueItem => {
    const rule = ruleForSignature(cluster.signature);
    return {
      id: stableQueueId(rule.lane, cluster.signature.key),
      priority: index + 1,
      lane: rule.lane,
      sourceFailureFamily: cluster.signature.key,
      failureFamilyTitle: cluster.signature.title,
      owner: rule.owner,
      targetFile: rule.targetFile,
      expectedNegativeControl: rule.expectedNegativeControl,
      validationCommand: rule.validationCommand,
      promotionThreshold: rule.promotionThreshold,
      rollbackCondition: rule.rollbackCondition,
      residualRisk: rule.residualRisk,
      observedCount: cluster.count,
      observedAgents: (cluster.agentKeys ?? cluster.agents ?? []).slice().sort(),
      proofPaths: proofPathsForCluster(cluster, input.paperclipApiUrl),
      blockedClaims: rule.blockedClaims,
    };
  });
}

function escapeMarkdownCell(value: string | number | string[]) {
  const normalized = Array.isArray(value) ? value.join(", ") : String(value);
  return normalized.replace(/\|/g, "/").replace(/\n/g, " ").trim();
}

export function buildAutoResearchPromotionQueueMarkdown(input: {
  generatedAt?: string;
  paperclipApiUrl?: string | null;
  queue: AutoResearchPromotionQueueItem[];
}) {
  const lines: string[] = [];
  lines.push("# AutoResearch Promotion Queue");
  lines.push("");
  lines.push(`- Scope: ${PROMOTION_QUEUE_SCOPE}`);
  lines.push(`- Generated at: ${input.generatedAt ?? new Date().toISOString()}`);
  if (input.paperclipApiUrl) {
    lines.push(`- Classified failure source: \`${input.paperclipApiUrl}\``);
  }
  lines.push(`- Queued items: ${input.queue.length}`);
  lines.push("");
  lines.push("Each item is a candidate for the next repo-local AutoAgent eval, prompt patch, policy patch, or closeout-rule patch. The queue does not authorize live sends, provider calls, production Paperclip mutation, Notion writes, Stripe/Firebase/Render changes, or operational launch claims.");
  lines.push("");

  if (input.queue.length === 0) {
    lines.push("No classified failure clusters were supplied.");
    return lines.join("\n");
  }

  lines.push("| Priority | Lane | Source family | Owner | Target file | Expected negative control | Validation command | Promotion threshold | Rollback condition | Residual risk |");
  lines.push("| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |");

  for (const item of input.queue) {
    lines.push(
      `| ${item.priority} | ${escapeMarkdownCell(item.lane)} | ${escapeMarkdownCell(item.sourceFailureFamily)} | ${escapeMarkdownCell(item.owner)} | \`${escapeMarkdownCell(item.targetFile)}\` | ${escapeMarkdownCell(item.expectedNegativeControl)} | \`${escapeMarkdownCell(item.validationCommand)}\` | ${escapeMarkdownCell(item.promotionThreshold)} | ${escapeMarkdownCell(item.rollbackCondition)} | ${escapeMarkdownCell(item.residualRisk)} |`,
    );
  }

  for (const item of input.queue) {
    lines.push("");
    lines.push(`## ${item.priority}. ${item.failureFamilyTitle}`);
    lines.push("");
    lines.push(`- Queue id: \`${item.id}\``);
    lines.push(`- Lane: ${item.lane}`);
    lines.push(`- Owner: ${item.owner}`);
    lines.push(`- Target file: \`${item.targetFile}\``);
    lines.push(`- Observed count: ${item.observedCount}`);
    lines.push(`- Observed agents: ${item.observedAgents.join(", ") || "unknown"}`);
    lines.push(`- Proof paths: ${item.proofPaths}`);
    lines.push(`- Expected negative control: ${item.expectedNegativeControl}`);
    lines.push(`- Validation command: \`${item.validationCommand}\``);
    lines.push(`- Promotion threshold: ${item.promotionThreshold}`);
    lines.push(`- Rollback condition: ${item.rollbackCondition}`);
    lines.push(`- Residual risk: ${item.residualRisk}`);
    lines.push(`- Blocked claims: ${item.blockedClaims.join(", ")}`);
  }

  return lines.join("\n");
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, value);
    index += 1;
  }
  return args;
}

async function readStdinText() {
  if (process.stdin.isTTY) return "";
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
  }
  return text;
}

function printHelp() {
  console.log(`Usage: npm exec tsx -- scripts/paperclip/autoresearch-promotion-queue.ts [options]

Build a repo-local AutoResearch promotion queue from classified Paperclip/Hermes failure sweep JSON.

Options:
  --input <path>      Read JSON from a sweep report file. If omitted, stdin is used.
  --max-items <n>     Limit queue items after deterministic sorting.
  --json              Output JSON. Default is markdown.
  --markdown          Output markdown.
  --help              Show this message.

Example:
  npm run paperclip:sweep:run-failures -- --json --limit 250 > /tmp/paperclip-failures.json
  npm exec -- tsx scripts/paperclip/autoresearch-promotion-queue.ts --input /tmp/paperclip-failures.json --markdown
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.get("help") === "true") {
    printHelp();
    return;
  }

  const inputPath = args.get("input");
  const rawInput = inputPath ? readFileSync(inputPath, "utf8") : await readStdinText();
  if (!rawInput.trim()) {
    throw new Error("No classified failure sweep JSON provided. Pass --input <path> or pipe JSON on stdin.");
  }

  const parsed = JSON.parse(rawInput) as {
    generatedAt?: string;
    paperclipApiUrl?: string | null;
    clusters?: ClassifiedFailureCluster[];
  };
  const maxItemsRaw = args.get("max-items");
  const maxItems = maxItemsRaw ? Number.parseInt(maxItemsRaw, 10) : undefined;
  const queue = buildAutoResearchPromotionQueue({
    clusters: parsed.clusters ?? [],
    paperclipApiUrl: parsed.paperclipApiUrl,
    maxItems,
  });

  if (args.get("json") === "true") {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      scope: PROMOTION_QUEUE_SCOPE,
      sourceGeneratedAt: parsed.generatedAt ?? null,
      paperclipApiUrl: parsed.paperclipApiUrl ?? null,
      queue,
    }, null, 2));
    return;
  }

  console.log(buildAutoResearchPromotionQueueMarkdown({
    generatedAt: new Date().toISOString(),
    paperclipApiUrl: parsed.paperclipApiUrl,
    queue,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
