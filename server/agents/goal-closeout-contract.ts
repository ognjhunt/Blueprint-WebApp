export const PAPERCLIP_GOAL_CLOSEOUT_ALLOWED_STATES = [
  "done",
  "blocked",
  "awaiting_human_decision",
] as const;

export const PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS = [
  "Goal objective:",
  "Issue/run id:",
  "Budget/timeout context:",
  "Stage reached:",
  "State claimed:",
  "Owner:",
  "Blocker/decision id:",
  "Proof paths:",
  "Command outputs:",
  "Next action:",
  "Retry/resume condition:",
  "Residual risk:",
] as const;

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringifyValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value).trim();
}

function valueFromRecord(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = stringifyValue(record?.[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

export function readPaperclipGoalCloseoutMetadata(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function isTruthyPaperclipGoalFlag(value: unknown) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "enabled"].includes(value.trim().toLowerCase());
}

export function shouldAttachPaperclipGoalCloseoutContract(params: {
  prompt: string;
  metadata?: Record<string, unknown> | null;
}) {
  const metadata = params.metadata || {};
  return (
    isTruthyPaperclipGoalFlag(metadata.paperclipGoalPromptEnabled)
    || isTruthyPaperclipGoalFlag(metadata.paperclip_goal_prompt_enabled)
    || isTruthyPaperclipGoalFlag(metadata.goalStyle)
    || isTruthyPaperclipGoalFlag(metadata.goal_style)
    || isTruthyPaperclipGoalFlag(process.env.PAPERCLIP_GOAL_PROMPT_ENABLED)
    || /\bGoal:\s*\S/.test(params.prompt)
  );
}

export function buildPaperclipIssueRunContext(metadata: Record<string, unknown>, runId?: string | null) {
  const issueId =
    valueFromRecord(metadata, ["paperclipIssueId", "paperclip_issue_id", "issueId", "issue_id"])
    || cleanValue(process.env.PAPERCLIP_TASK_ID)
    || "unknown";
  const resolvedRunId =
    valueFromRecord(metadata, ["paperclipRunId", "paperclip_run_id", "runId", "run_id"])
    || cleanValue(process.env.PAPERCLIP_RUN_ID)
    || cleanValue(runId)
    || "unknown";

  return {
    issueId,
    runId: resolvedRunId,
    summary: `issue=${issueId}; run=${resolvedRunId}`,
  };
}

export function buildPaperclipBudgetTimeoutContext(params: {
  metadata?: Record<string, unknown> | null;
  timeoutMs?: number | null;
}) {
  const metadata = params.metadata || {};
  const explicitBudget = valueFromRecord(metadata, [
    "tokenBudget",
    "token_budget",
    "budget",
    "budgetContext",
    "budget_context",
  ]);
  const explicitTimeout =
    valueFromRecord(metadata, ["timeoutMs", "timeout_ms", "timeout", "timeoutContext", "timeout_context"])
    || (typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
      ? `${params.timeoutMs}ms timeout`
      : "");

  return [explicitBudget, explicitTimeout].filter(Boolean).join("; ")
    || "not supplied; state the missing budget or timeout context explicitly";
}

export function buildPaperclipGoalCloseoutPrompt(params: {
  objective?: string | null;
  stageReached?: string | null;
  issueRunContext: string;
  budgetTimeoutContext: string;
}) {
  const objective = cleanValue(params.objective) || "current goal objective";
  const stageReached = cleanValue(params.stageReached) || "current lifecycle stage";
  return [
    "Paperclip goal closeout contract:",
    "Before this goal-style branch claims done, blocked, or awaiting_human_decision, the Paperclip issue/run closeout must include every label below.",
    "State claimed must be exactly one of: done, blocked, awaiting_human_decision.",
    `Issue/run context: ${params.issueRunContext}`,
    `Budget/timeout context: ${params.budgetTimeoutContext}`,
    "Required closeout packet labels:",
    `- Goal objective: ${objective}`,
    `- Issue/run id: ${params.issueRunContext}`,
    `- Budget/timeout context: ${params.budgetTimeoutContext}`,
    `- Stage reached: ${stageReached}`,
    "- State claimed: one of done, blocked, awaiting_human_decision",
    "- Owner: responsible agent, human, repo, provider, or lane that owns the current next move",
    "- Blocker/decision id: durable blocker id, decision id, issue id, or none",
    "- Proof paths: exact file paths, ledger keys, issue ids, run ids, artifact URIs, or hosted ids",
    "- Command outputs: commands or inspections run, with observed output",
    "- Next action: owner, target repo or lane, and concrete action",
    "- Retry/resume condition: exact condition that allows safe retry, resume, or no-op suppression",
    "- Residual risk: what remains unverified or outside this lane",
    "Blocked closeouts must name the earliest hard stop, the owner, and the exact retry/resume condition.",
    "Awaiting-human closeouts must include the blocker/decision id, routing surface, watcher owner, and resume condition.",
    "Adapter success is not completion. Do not claim native /goal completion unless Codex CLI state or run artifacts prove it.",
  ].join("\n");
}

export function buildPaperclipGoalCloseoutArtifact(params: {
  enabled: boolean;
  objective?: string | null;
  stageReached?: string | null;
  issueRunContext?: string;
  budgetTimeoutContext?: string;
}) {
  const objective = cleanValue(params.objective) || "current goal objective";
  const stageReached = cleanValue(params.stageReached) || "current lifecycle stage";
  return {
    enabled: params.enabled,
    goal_objective: objective,
    stage_reached: stageReached,
    required_fields: [...PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS],
    allowed_states: [...PAPERCLIP_GOAL_CLOSEOUT_ALLOWED_STATES],
    ...(params.issueRunContext ? { issue_run_context: params.issueRunContext } : {}),
    ...(params.budgetTimeoutContext ? { budget_timeout_context: params.budgetTimeoutContext } : {}),
  };
}
