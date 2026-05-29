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

export type PaperclipGoalCloseoutAllowedState = (typeof PAPERCLIP_GOAL_CLOSEOUT_ALLOWED_STATES)[number];
export type PaperclipGoalCloseoutRequiredField = (typeof PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS)[number];

export type PaperclipGoalCloseoutValidationIssueCode =
  | "missing_required_field"
  | "invalid_state_claim"
  | "ambiguous_state_claim";

export interface PaperclipGoalCloseoutValidationIssue {
  code: PaperclipGoalCloseoutValidationIssueCode;
  field?: PaperclipGoalCloseoutRequiredField;
  value?: string;
  message: string;
}

export interface PaperclipGoalCloseoutValidationResult {
  valid: boolean;
  stateClaimed?: PaperclipGoalCloseoutAllowedState;
  missingRequiredFields: PaperclipGoalCloseoutRequiredField[];
  errors: PaperclipGoalCloseoutValidationIssue[];
}

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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requiredFieldRegex(field: PaperclipGoalCloseoutRequiredField) {
  return new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\d+[.)]\\s*)?${escapeRegex(field)}(?:\\s|$)`, "im");
}

function stateClaimLineRegex() {
  return new RegExp(
    `^\\s*(?:[-*]\\s*)?(?:\\d+[.)]\\s*)?${escapeRegex("State claimed:")}\\s*(.*?)\\s*$`,
    "gim",
  );
}

function cleanStateClaimValue(value: string) {
  return value
    .trim()
    .replace(/^`+/, "")
    .replace(/`+$/, "")
    .trim();
}

function collectStateClaimValues(packet: string) {
  const claims: string[] = [];
  const regex = stateClaimLineRegex();
  let match = regex.exec(packet);
  while (match) {
    claims.push(cleanStateClaimValue(match[1] || ""));
    match = regex.exec(packet);
  }
  return claims;
}

export function validatePaperclipGoalCloseoutPacket(packet: string): PaperclipGoalCloseoutValidationResult {
  const text = typeof packet === "string" ? packet : "";
  const missingRequiredFields = PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS.filter(
    (field) => !requiredFieldRegex(field).test(text),
  );
  const errors: PaperclipGoalCloseoutValidationIssue[] = missingRequiredFields.map((field) => ({
    code: "missing_required_field",
    field,
    message: `Missing required Paperclip goal closeout label: ${field}`,
  }));
  const stateClaims = collectStateClaimValues(text);
  let stateClaimed: PaperclipGoalCloseoutAllowedState | undefined;

  if (stateClaims.length > 1) {
    errors.push({
      code: "ambiguous_state_claim",
      field: "State claimed:",
      value: stateClaims.join(", "),
      message: "Paperclip goal closeout packet must include exactly one State claimed value.",
    });
  } else if (stateClaims.length === 1) {
    const [stateClaim] = stateClaims;
    if ((PAPERCLIP_GOAL_CLOSEOUT_ALLOWED_STATES as readonly string[]).includes(stateClaim)) {
      stateClaimed = stateClaim as PaperclipGoalCloseoutAllowedState;
    } else {
      errors.push({
        code: "invalid_state_claim",
        field: "State claimed:",
        value: stateClaim,
        message: `State claimed must be exactly one of: ${PAPERCLIP_GOAL_CLOSEOUT_ALLOWED_STATES.join(", ")}.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    stateClaimed,
    missingRequiredFields,
    errors,
  };
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
    || cleanValue(process.env.PAPERCLIP_TASK_ID);
  const resolvedRunId =
    valueFromRecord(metadata, ["paperclipRunId", "paperclip_run_id", "runId", "run_id"])
    || cleanValue(process.env.PAPERCLIP_RUN_ID)
    || cleanValue(runId);
  const missingContext = [
    issueId ? "" : "paperclip issue id",
    resolvedRunId ? "" : "paperclip run id",
  ].filter(Boolean);
  const normalizedIssueId = issueId || "unknown";
  const normalizedRunId = resolvedRunId || "unknown";

  return {
    issueId: normalizedIssueId,
    runId: normalizedRunId,
    missingContext,
    summary: `issue=${normalizedIssueId}; run=${normalizedRunId}`,
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
    "Repo-side closeout packets do not require a live Paperclip API or localhost:3100.",
    "If an issue id, run id, or budget is unavailable, state that gap in the packet instead of probing live Paperclip only to fill the label.",
    "Use Command outputs for repo checks and any attempted Paperclip health/read commands; unavailable live Paperclip is residual risk or retry context, not a reason to omit the packet.",
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
  issueId?: string | null;
  runId?: string | null;
  missingContext?: string[];
  issueRunContext?: string;
  budgetTimeoutContext?: string;
}) {
  const objective = cleanValue(params.objective) || "current goal objective";
  const stageReached = cleanValue(params.stageReached) || "current lifecycle stage";
  return {
    enabled: params.enabled,
    repo_safe_packet: true,
    requires_live_paperclip: false,
    requires_localhost_3100: false,
    goal_objective: objective,
    stage_reached: stageReached,
    issue_id: cleanValue(params.issueId) || "unknown",
    run_id: cleanValue(params.runId) || "unknown",
    missing_context: [...(params.missingContext || [])],
    required_fields: [...PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS],
    allowed_states: [...PAPERCLIP_GOAL_CLOSEOUT_ALLOWED_STATES],
    ...(params.issueRunContext ? { issue_run_context: params.issueRunContext } : {}),
    ...(params.budgetTimeoutContext ? { budget_timeout_context: params.budgetTimeoutContext } : {}),
  };
}
