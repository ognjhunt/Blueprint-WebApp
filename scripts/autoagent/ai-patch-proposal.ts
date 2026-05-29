import { spawn } from "node:child_process";
import path from "node:path";

import { type PromotionGateEvaluation } from "./prompt-policy-promotion-gate.ts";

export type AiPatchProposalLane = "support_triage" | "agent_failure_promotion";

export type AiPatchProposal = {
  proposal_id: string;
  lane: AiPatchProposalLane;
  risk_tier: "low";
  changed_files: string[];
  intended_behavior: string;
  failure_family_addressed: string;
  expected_eval_improvement: string;
  rollback_plan: string;
  unified_diff?: string;
};

export type AiPatchProposalRequest = {
  cwd: string;
  failureFamily: string;
  generatedFixturePaths: string[];
  promotionDecision: string;
  prompt: string;
  schema: typeof AI_PATCH_PROPOSAL_RESPONSE_SCHEMA;
};

export type AiPatchProposalInvoker = (
  request: AiPatchProposalRequest,
) => Promise<string>;

export type AiPatchProposalStatus =
  | "not_proposed"
  | "fallback_ai_unavailable"
  | "accepted"
  | "rejected";

export type AiPatchProposalSummary = {
  schema: "blueprint/autoagent-patch-proposal-summary/v1";
  generated_at: string;
  status: AiPatchProposalStatus;
  ai_used: boolean;
  proposal_id: string | null;
  lane: string | null;
  risk_tier: string | null;
  changed_files: string[];
  intended_behavior: string | null;
  failure_family_addressed: string | null;
  expected_eval_improvement: string | null;
  rollback_plan: string | null;
  required_validation_commands: string[];
  deterministic_gate_reason: string;
  reasons: string[];
};

export type RunAiPatchProposalOptions = {
  cwd?: string;
  enabled?: boolean;
  failureFamily: string;
  generatedFixturePaths: string[];
  offlineEval: {
    status: "passed" | "failed" | "not_run";
    total_failed: number;
    negative_controls_blocked: boolean;
  };
  promotionGate: PromotionGateEvaluation;
  sampleCount: number;
  invoker?: AiPatchProposalInvoker;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  now?: Date;
};

const DEFAULT_TIMEOUT_MS = 45_000;

const LOW_RISK_PATCH_LANES = new Set<string>([
  "support_triage",
  "agent_failure_promotion",
]);

const ALLOWED_PATCH_PATH_PREFIXES = [
  "labs/autoagent/tasks/",
  "docs/autoresearch/",
] as const;

const ALLOWED_PATCH_PATHS = new Set<string>([
  "labs/autoagent/README.md",
  "labs/autoagent/tasks/README.md",
  "docs/architecture/autoagent-autoresearch-operating-policy.md",
  "ops/paperclip/blueprint-company/tasks/recursive-agent-improvement-loop/TASK.md",
  "scripts/autoagent/ai-fixture-drafter.ts",
  "scripts/autoagent/ai-patch-proposal.ts",
  "scripts/autoagent/build-harbor-tasks.ts",
  "scripts/autoagent/local-evaluator.ts",
  "scripts/autoagent/local-evaluator.test.ts",
  "scripts/autoagent/prompt-policy-promotion-gate.ts",
  "scripts/autoagent/prompt-policy-promotion-gate.test.ts",
  "scripts/autoagent/run-recursive-improvement-loop.ts",
  "scripts/autoagent/run-recursive-improvement-loop.test.ts",
  "scripts/autoagent/seed-canonical-cases.ts",
  "scripts/autoagent/write-autoresearch-fixture.ts",
  "scripts/autoagent/write-autoresearch-fixture.test.ts",
]);

const BLOCKED_PATCH_SCOPES: Array<{
  label: string;
  matches: (filePath: string) => boolean;
}> = [
  {
    label: "payment/payout code",
    matches: (filePath) =>
      /^server\/routes\/(?:stripe|stripe-webhooks|marketplace|marketplace-entitlements)\b/.test(filePath)
      || /^server\/utils\/accounting\b/.test(filePath)
      || /^client\/src\/hooks\/useStripeCheckout\.ts$/.test(filePath)
      || /\b(?:stripe|checkout|payment|payout)\b/i.test(filePath),
  },
  {
    label: "provider execution",
    matches: (filePath) =>
      /^server\/agents\/(?:runtime|provider-config)\.ts$/.test(filePath)
      || /^scripts\/gemini\//.test(filePath)
      || /\bprovider[-_/]?execution\b/i.test(filePath),
  },
  {
    label: "live Paperclip mutation",
    matches: (filePath) =>
      /^ops\/paperclip\/blueprint-company\/\.paperclip\.yaml$/.test(filePath)
      || /^ops\/paperclip\/plugins\//.test(filePath)
      || (/^scripts\/paperclip\//.test(filePath) && filePath !== "scripts/paperclip/agent-improvement-observer.ts"),
  },
  {
    label: "city launch",
    matches: (filePath) =>
      /^scripts\/city-launch\//.test(filePath)
      || /^server\/routes\/city-launch\.ts$/.test(filePath)
      || /^server\/utils\/cityLaunch/.test(filePath)
      || /^client\/src\/pages\/City/.test(filePath),
  },
  {
    label: "rights/privacy/legal",
    matches: (filePath) =>
      /^docs\/company\//.test(filePath)
      || /\b(?:rights|privacy|legal|consent)\b/i.test(filePath),
  },
  {
    label: "hosted-session fulfillment",
    matches: (filePath) =>
      /^server\/routes\/site-world-sessions\.ts$/.test(filePath)
      || /^server\/types\/hosted-session\.ts$/.test(filePath)
      || /^client\/src\/(?:pages\/HostedSession|lib\/hostedSession|types\/hostedSession)/.test(filePath),
  },
  {
    label: "customer claims",
    matches: (filePath) =>
      /^client\/src\/(?:pages|data)\//.test(filePath)
      || /\b(?:customer|testimonial|logo|case-study)\b/i.test(filePath),
  },
  {
    label: "production deployment config",
    matches: (filePath) =>
      filePath === "render.yaml"
      || filePath === "DEPLOYMENT.md"
      || filePath === "package.json"
      || /^\.github\/workflows\//.test(filePath)
      || /^scripts\/render\//.test(filePath),
  },
];

export const AI_PATCH_PROPOSAL_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "proposal_id",
    "lane",
    "risk_tier",
    "changed_files",
    "intended_behavior",
    "failure_family_addressed",
    "expected_eval_improvement",
    "rollback_plan",
  ],
  properties: {
    proposal_id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{7,96}$" },
    lane: { type: "string", enum: ["support_triage", "agent_failure_promotion"] },
    risk_tier: { type: "string", enum: ["low"] },
    changed_files: { type: "array", minItems: 1, items: { type: "string" } },
    intended_behavior: { type: "string", minLength: 24 },
    failure_family_addressed: { type: "string", minLength: 3 },
    expected_eval_improvement: { type: "string", minLength: 16 },
    rollback_plan: { type: "string", minLength: 16 },
    unified_diff: { type: "string" },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function cleanRepoPath(value: string) {
  return value.replace(/^\.?\//, "").trim();
}

function isUnsafePathSyntax(filePath: string) {
  return (
    path.isAbsolute(filePath)
    || filePath.includes("\0")
    || filePath.split(/[\\/]+/).includes("..")
  );
}

function isAllowedPatchPath(filePath: string) {
  return (
    ALLOWED_PATCH_PATHS.has(filePath)
    || ALLOWED_PATCH_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

function blockedScopeReasons(filePath: string) {
  return BLOCKED_PATCH_SCOPES
    .filter((scope) => scope.matches(filePath))
    .map((scope) => `blocked patch scope ${scope.label}: ${filePath}`);
}

function diffPaths(unifiedDiff: string | undefined) {
  if (!unifiedDiff?.trim()) {
    return [];
  }
  const paths = new Set<string>();
  const gitPattern = /^diff --git a\/(.+?) b\/(.+)$/gm;
  const targetPattern = /^\+\+\+ b\/(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = gitPattern.exec(unifiedDiff))) {
    paths.add(cleanRepoPath(match[1]));
    paths.add(cleanRepoPath(match[2]));
  }
  while ((match = targetPattern.exec(unifiedDiff))) {
    if (match[1] !== "/dev/null") {
      paths.add(cleanRepoPath(match[1]));
    }
  }
  return [...paths];
}

function requiredCommandsForFile(filePath: string) {
  if (/^scripts\/autoagent\/local-evaluator\.ts$/.test(filePath)) {
    return ["npm exec -- vitest run scripts/autoagent/local-evaluator.test.ts"];
  }
  if (/^scripts\/autoagent\/run-recursive-improvement-loop\.ts$/.test(filePath)) {
    return ["npm exec -- vitest run scripts/autoagent/run-recursive-improvement-loop.test.ts"];
  }
  if (/^scripts\/autoagent\/prompt-policy-promotion-gate\.ts$/.test(filePath)) {
    return ["npm exec -- vitest run scripts/autoagent/prompt-policy-promotion-gate.test.ts"];
  }
  if (/^scripts\/autoagent\/(?:write-autoresearch-fixture|seed-canonical-cases|build-harbor-tasks)\.ts$/.test(filePath)) {
    return ["npm exec -- vitest run scripts/autoagent/write-autoresearch-fixture.test.ts scripts/autoagent/local-evaluator.test.ts"];
  }
  if (/^scripts\/autoagent\/ai-fixture-drafter\.ts$/.test(filePath)) {
    return ["npm exec -- vitest run scripts/autoagent/run-recursive-improvement-loop.test.ts"];
  }
  if (/^scripts\/autoagent\/ai-patch-proposal\.ts$/.test(filePath)) {
    return ["npm exec -- vitest run scripts/autoagent/run-recursive-improvement-loop.test.ts"];
  }
  if (/^scripts\/autoagent\/.+\.test\.ts$/.test(filePath)) {
    return [`npm exec -- vitest run ${filePath}`];
  }
  return [];
}

export function requiredValidationCommandsForPatch(changedFiles: string[]) {
  return unique([
    ...changedFiles.flatMap(requiredCommandsForFile),
    "npm run autoagent:run -- --sample 3",
    "npm run autoagent:promotion-gate -- --candidate <candidate> --sample 3",
  ]);
}

function buildPrompt(input: {
  failureFamily: string;
  generatedFixturePaths: string[];
  promotionDecision: string;
}) {
  return [
    "You are proposing one repo-local Blueprint AutoAgent patch.",
    "Return JSON only. No markdown, prose, comments, or code fences.",
    "The JSON must match this schema exactly:",
    JSON.stringify(AI_PATCH_PROPOSAL_RESPONSE_SCHEMA),
    "",
    "Allowed patch scope:",
    "- AutoAgent prompt fixtures under labs/autoagent/tasks/",
    "- local evaluator rules in scripts/autoagent/local-evaluator.ts",
    "- recursive-loop routing metadata in the AutoAgent recursive-improvement scripts or task metadata",
    "- docs for repo-local AutoAgent behavior",
    "",
    "Forbidden patch scope:",
    "- payment/payout code",
    "- provider execution",
    "- live Paperclip mutation",
    "- city launch",
    "- rights/privacy/legal",
    "- hosted-session fulfillment",
    "- customer claims",
    "- production deployment config",
    "",
    "Every proposal must include changed_files, intended_behavior, failure_family_addressed, expected_eval_improvement, and rollback_plan.",
    "Do not claim production automation quality or live Paperclip/Hermes readiness.",
    "",
    `Validated failure family: ${input.failureFamily}`,
    `Generated fixture paths: ${input.generatedFixturePaths.join("; ") || "none"}`,
    `Current promotion gate decision: ${input.promotionDecision}`,
  ].join("\n");
}

function parseArgsJson(value: string | undefined) {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("BLUEPRINT_AUTORESEARCH_AI_PATCH_PROPOSAL_ARGS_JSON must be a JSON array of strings");
  }
  return parsed as string[];
}

function commandInvokerFromEnv(
  env: Record<string, string | undefined>,
  timeoutMs: number,
): AiPatchProposalInvoker | null {
  const command = env.BLUEPRINT_AUTORESEARCH_AI_PATCH_PROPOSAL_BIN;
  if (!command) return null;
  const args = parseArgsJson(env.BLUEPRINT_AUTORESEARCH_AI_PATCH_PROPOSAL_ARGS_JSON);

  return async (request) => runProposalCommand({
    cwd: request.cwd,
    command,
    args,
    input: request.prompt,
    timeoutMs,
    env,
  });
}

async function runProposalCommand(input: {
  cwd: string;
  command: string;
  args: string[];
  input: string;
  timeoutMs: number;
  env: Record<string, string | undefined>;
}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...input.env,
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`AI patch proposal command timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`AI patch proposal command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(input.input);
  });
}

function parsePatchProposal(rawJson: unknown): {
  proposal: AiPatchProposal | null;
  reasons: string[];
} {
  if (!isRecord(rawJson)) {
    return { proposal: null, reasons: ["AI patch proposal response must be a JSON object"] };
  }

  const reasons: string[] = [];
  const proposalId = typeof rawJson.proposal_id === "string" ? rawJson.proposal_id.trim() : "";
  const lane = typeof rawJson.lane === "string" ? rawJson.lane.trim() : "";
  const riskTier = typeof rawJson.risk_tier === "string" ? rawJson.risk_tier.trim() : "";
  const changedFiles = stringList(rawJson.changed_files).map(cleanRepoPath);
  const intendedBehavior = typeof rawJson.intended_behavior === "string" ? rawJson.intended_behavior.trim() : "";
  const failureFamily = typeof rawJson.failure_family_addressed === "string" ? rawJson.failure_family_addressed.trim() : "";
  const expectedEvalImprovement = typeof rawJson.expected_eval_improvement === "string" ? rawJson.expected_eval_improvement.trim() : "";
  const rollbackPlan = typeof rawJson.rollback_plan === "string" ? rawJson.rollback_plan.trim() : "";
  const unifiedDiff = typeof rawJson.unified_diff === "string" ? rawJson.unified_diff : undefined;

  const allowedKeys = new Set([
    "proposal_id",
    "lane",
    "risk_tier",
    "changed_files",
    "intended_behavior",
    "failure_family_addressed",
    "expected_eval_improvement",
    "rollback_plan",
    "unified_diff",
  ]);
  const unknownKeys = Object.keys(rawJson).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    reasons.push(`unknown top-level fields are not allowed: ${unknownKeys.join(", ")}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{7,96}$/.test(proposalId)) {
    reasons.push("proposal_id must be stable lowercase kebab case and at least 8 characters");
  }
  if (!LOW_RISK_PATCH_LANES.has(lane)) {
    reasons.push(`lane is not explicitly low-risk for AI patch proposals: ${lane || "missing"}`);
  }
  if (riskTier !== "low") {
    reasons.push(`risk_tier must be low; saw ${riskTier || "missing"}`);
  }
  if (changedFiles.length === 0) {
    reasons.push("changed_files must contain at least one repo-local path");
  }
  if (intendedBehavior.length < 24) {
    reasons.push("intended_behavior must describe the behavior change concretely");
  }
  if (failureFamily.length < 3) {
    reasons.push("failure_family_addressed is required");
  }
  if (expectedEvalImprovement.length < 16) {
    reasons.push("expected_eval_improvement must be concrete");
  }
  if (rollbackPlan.length < 16) {
    reasons.push("rollback_plan must be concrete");
  }

  if (reasons.length > 0) {
    return { proposal: null, reasons };
  }

  return {
    proposal: {
      proposal_id: proposalId,
      lane: lane as AiPatchProposalLane,
      risk_tier: "low",
      changed_files: changedFiles,
      intended_behavior: intendedBehavior,
      failure_family_addressed: failureFamily,
      expected_eval_improvement: expectedEvalImprovement,
      rollback_plan: rollbackPlan,
      ...(unifiedDiff ? { unified_diff: unifiedDiff } : {}),
    },
    reasons,
  };
}

export function validateAiPatchProposal(input: {
  proposal: AiPatchProposal;
  failureFamily: string;
  offlineEval: RunAiPatchProposalOptions["offlineEval"];
  promotionGate: PromotionGateEvaluation;
  sampleCount: number;
}) {
  const reasons: string[] = [];
  const changedFiles = unique(input.proposal.changed_files.map(cleanRepoPath));
  const diffFilePaths = diffPaths(input.proposal.unified_diff);
  const allFilePaths = unique([...changedFiles, ...diffFilePaths]);

  if (input.proposal.failure_family_addressed !== input.failureFamily) {
    reasons.push(
      `failure_family_addressed must match selected family ${input.failureFamily}; saw ${input.proposal.failure_family_addressed}`,
    );
  }

  for (const filePath of allFilePaths) {
    if (isUnsafePathSyntax(filePath)) {
      reasons.push(`changed file must be a safe repo-relative path: ${filePath}`);
      continue;
    }
    reasons.push(...blockedScopeReasons(filePath));
    if (!isAllowedPatchPath(filePath)) {
      reasons.push(`changed file is outside AI patch allowlist: ${filePath}`);
    }
  }

  for (const filePath of diffFilePaths) {
    if (!changedFiles.includes(filePath)) {
      reasons.push(`unified_diff path is missing from changed_files: ${filePath}`);
    }
  }
  if (input.proposal.unified_diff?.trim() && diffFilePaths.length === 0) {
    reasons.push("unified_diff did not expose any changed repo paths");
  }

  if (input.offlineEval.status !== "passed" || input.offlineEval.total_failed > 0) {
    reasons.push("offline AutoAgent sample must pass before AI patch proposal acceptance");
  }
  if (!input.offlineEval.negative_controls_blocked) {
    reasons.push("negative controls must remain fully blocked before AI patch proposal acceptance");
  }
  if (input.sampleCount < 3) {
    reasons.push(`offline AutoAgent sample must be at least 3; saw ${input.sampleCount}`);
  }
  if (!["canary", "promote"].includes(input.promotionGate.decision)) {
    reasons.push(`promotion gate must pass before AI patch proposal acceptance; saw ${input.promotionGate.decision}`);
  }

  return unique(reasons);
}

function summaryFor(input: {
  status: AiPatchProposalStatus;
  aiUsed: boolean;
  generatedAt: string;
  proposal?: AiPatchProposal | null;
  reasons?: string[];
  deterministicGateReason: string;
}) {
  const proposal = input.proposal ?? null;
  return {
    schema: "blueprint/autoagent-patch-proposal-summary/v1",
    generated_at: input.generatedAt,
    status: input.status,
    ai_used: input.aiUsed,
    proposal_id: proposal?.proposal_id ?? null,
    lane: proposal?.lane ?? null,
    risk_tier: proposal?.risk_tier ?? null,
    changed_files: proposal?.changed_files ?? [],
    intended_behavior: proposal?.intended_behavior ?? null,
    failure_family_addressed: proposal?.failure_family_addressed ?? null,
    expected_eval_improvement: proposal?.expected_eval_improvement ?? null,
    rollback_plan: proposal?.rollback_plan ?? null,
    required_validation_commands: proposal
      ? requiredValidationCommandsForPatch(proposal.changed_files)
      : [],
    deterministic_gate_reason: input.deterministicGateReason,
    reasons: unique(input.reasons ?? []),
  } satisfies AiPatchProposalSummary;
}

export function renderAiPatchProposalReport(summary: AiPatchProposalSummary) {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";

  return [
    "# AutoAgent AI Patch Proposal",
    "",
    `Generated: ${summary.generated_at}`,
    `Status: ${summary.status}`,
    `AI used: ${summary.ai_used}`,
    `Proposal id: ${summary.proposal_id ?? "none"}`,
    `Lane: ${summary.lane ?? "none"}`,
    `Risk tier: ${summary.risk_tier ?? "none"}`,
    "",
    "## Deterministic Gate",
    "",
    summary.deterministic_gate_reason,
    "",
    "## Reasons",
    "",
    list(summary.reasons),
    "",
    "## Changed Files",
    "",
    list(summary.changed_files),
    "",
    "## Intended Behavior",
    "",
    summary.intended_behavior ?? "none",
    "",
    "## Failure Family Addressed",
    "",
    summary.failure_family_addressed ?? "none",
    "",
    "## Expected Eval Improvement",
    "",
    summary.expected_eval_improvement ?? "none",
    "",
    "## Rollback Plan",
    "",
    summary.rollback_plan ?? "none",
    "",
    "## Required Validation Commands",
    "",
    list(summary.required_validation_commands),
    "",
  ].join("\n");
}

export async function runAiPatchProposal(
  options: RunAiPatchProposalOptions,
): Promise<{
  summary: AiPatchProposalSummary;
  raw_output: string | null;
  prompt: string;
}> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = (options.now ?? new Date()).toISOString();
  const prompt = buildPrompt({
    failureFamily: options.failureFamily,
    generatedFixturePaths: options.generatedFixturePaths,
    promotionDecision: options.promotionGate.decision,
  });

  if (options.enabled !== true) {
    return {
      summary: summaryFor({
        status: "not_proposed",
        aiUsed: false,
        generatedAt,
        deterministicGateReason:
          "not_proposed: AI patch proposal stage wrote a no-op report because no AI proposer was requested",
      }),
      raw_output: null,
      prompt,
    };
  }

  const env = options.env ?? process.env;
  const invoker = options.invoker ?? commandInvokerFromEnv(env, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!invoker) {
    return {
      summary: summaryFor({
        status: "not_proposed",
        aiUsed: false,
        generatedAt,
        deterministicGateReason:
          "not_proposed: no AI patch proposal command or session was configured",
      }),
      raw_output: null,
      prompt,
    };
  }

  let rawOutput: string;
  try {
    rawOutput = await invoker({
      cwd,
      failureFamily: options.failureFamily,
      generatedFixturePaths: options.generatedFixturePaths,
      promotionDecision: options.promotionGate.decision,
      prompt,
      schema: AI_PATCH_PROPOSAL_RESPONSE_SCHEMA,
    });
  } catch (error) {
    return {
      summary: summaryFor({
        status: "fallback_ai_unavailable",
        aiUsed: false,
        generatedAt,
        deterministicGateReason:
          `fallback_ai_unavailable: ${error instanceof Error ? error.message : String(error)}`,
      }),
      raw_output: null,
      prompt,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return {
      summary: summaryFor({
        status: "rejected",
        aiUsed: true,
        generatedAt,
        reasons: ["AI patch proposal returned non-JSON output"],
        deterministicGateReason:
          "rejected: AI patch proposal returned non-JSON output",
      }),
      raw_output: rawOutput,
      prompt,
    };
  }

  const parsedProposal = parsePatchProposal(parsed);
  if (!parsedProposal.proposal) {
    return {
      summary: summaryFor({
        status: "rejected",
        aiUsed: true,
        generatedAt,
        reasons: parsedProposal.reasons,
        deterministicGateReason:
          `rejected: ${parsedProposal.reasons[0] ?? "AI patch proposal failed schema validation"}`,
      }),
      raw_output: rawOutput,
      prompt,
    };
  }

  const reasons = validateAiPatchProposal({
    proposal: parsedProposal.proposal,
    failureFamily: options.failureFamily,
    offlineEval: options.offlineEval,
    promotionGate: options.promotionGate,
    sampleCount: options.sampleCount,
  });

  if (reasons.length > 0) {
    return {
      summary: summaryFor({
        status: "rejected",
        aiUsed: true,
        generatedAt,
        proposal: parsedProposal.proposal,
        reasons,
        deterministicGateReason: `rejected: ${reasons[0]}`,
      }),
      raw_output: rawOutput,
      prompt,
    };
  }

  return {
    summary: summaryFor({
      status: "accepted",
      aiUsed: true,
      generatedAt,
      proposal: parsedProposal.proposal,
      deterministicGateReason:
        "accepted: low-risk patch proposal stayed inside allowlisted AutoAgent scope and required deterministic eval/promotion gates passed",
    }),
    raw_output: rawOutput,
    prompt,
  };
}
