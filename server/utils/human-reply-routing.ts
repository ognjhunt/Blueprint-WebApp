export const APPROVED_HUMAN_REPLY_EMAIL = "ohstnhunt@gmail.com";
export const DISALLOWED_HUMAN_REPLY_EMAIL = "hlfabhunt@gmail.com";
export const DEFAULT_HUMAN_REPLY_ROUTING_OWNER = "blueprint-chief-of-staff";
export const DEFAULT_TECHNICAL_EXECUTION_OWNER = "webapp-codex";
export const DEFAULT_TECHNICAL_ESCALATION_OWNER = "blueprint-cto";
export const DEFAULT_OPS_EXECUTION_OWNER = "ops-lead";

export type HumanReplyChannel = "email" | "slack";
export type HumanBlockerKind = "technical" | "ops_commercial";
export type HumanReplyClassification =
  | "approval"
  | "clarification"
  | "credential_env_confirmation"
  | "logs_evidence"
  | "ambiguous";
export type HumanReplyResolution = "resolved_input" | "ambiguous_input";
export type HumanBlockerThreadStatus =
  | "awaiting_reply"
  | "reply_recorded"
  | "ambiguous"
  | "routed"
  | "resolved"
  | "blocked";
export type HumanResumeActionKind =
  | "rerun_launch_smoke"
  | "inspect_logs"
  | "manual_followup"
  | "ops_followup";

export type HumanReplyRouteDecision = {
  classification: HumanReplyClassification;
  resolution: HumanReplyResolution;
  routing_owner: string;
  execution_owner: string;
  escalation_owner: string | null;
  should_resume_now: boolean;
  reason: string;
};

export type HumanBlockerCorrelation = {
  blocker_id: string;
  outbound_subject?: string | null;
  gmail_thread_id?: string | null;
  gmail_message_id?: string | null;
  slack_thread_id?: string | null;
  external_message_id?: string | null;
};

export type HumanBlockerRoutingContext = {
  blocker_kind: HumanBlockerKind;
  routing_owner?: string | null;
  execution_owner?: string | null;
  escalation_owner?: string | null;
};

function trimLower(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function compactWhitespace(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function buildHumanBlockerSubjectTag(blockerId: string) {
  return `[Blueprint Blocker ID: ${blockerId}]`;
}

export function buildHumanBlockerChannelTag(
  blockerId: string,
  channel: HumanReplyChannel,
) {
  return `[Blueprint ${channel.toUpperCase()} Reply ID: ${blockerId}]`;
}

export function renderHumanBlockerCorrelationSection(blockerId: string) {
  const tag = buildHumanBlockerSubjectTag(blockerId);
  return [
    "Correlation",
    `- Blocker id: ${blockerId}`,
    `- Reply tag: ${tag}`,
  ].join("\n");
}

export function extractHumanBlockerIdFromText(value: string | null | undefined) {
  const match = String(value || "").match(
    /\[Blueprint (?:Blocker|EMAIL Reply|SLACK Reply) ID:\s*([A-Za-z0-9._:-]+)\]/i,
  );
  return match?.[1]?.trim() || null;
}

export function normalizeCorrelationSubject(value: string | null | undefined) {
  let normalized = compactWhitespace(value);
  while (/^(re|fw|fwd)\s*:\s*/i.test(normalized)) {
    normalized = normalized.replace(/^(re|fw|fwd)\s*:\s*/i, "").trim();
  }
  return normalized.replace(/\s+/g, " ").trim().toLowerCase();
}

export function subjectsMatchForCorrelation(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeCorrelationSubject(left);
  const normalizedRight = normalizeCorrelationSubject(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function classifyHumanReply(
  body: string | null | undefined,
  context: HumanBlockerRoutingContext,
): HumanReplyRouteDecision {
  const normalized = trimLower(body);
  const executionOwner =
    context.execution_owner?.trim()
    || (context.blocker_kind === "technical"
      ? DEFAULT_TECHNICAL_EXECUTION_OWNER
      : DEFAULT_OPS_EXECUTION_OWNER);
  const routingOwner =
    context.routing_owner?.trim() || DEFAULT_HUMAN_REPLY_ROUTING_OWNER;
  const escalationOwner =
    context.escalation_owner?.trim()
    || (context.blocker_kind === "technical" ? DEFAULT_TECHNICAL_ESCALATION_OWNER : null);

  if (!normalized) {
    return {
      classification: "ambiguous",
      resolution: "ambiguous_input",
      routing_owner: routingOwner,
      execution_owner: executionOwner,
      escalation_owner: escalationOwner,
      should_resume_now: false,
      reason: "Reply body was empty after normalization.",
    };
  }

  const credentialConfirmation = includesAny(normalized, [
    "field_encryption_master_key",
    "field_encryption_kms_key_name",
    "i added",
    "i set",
    "i configured",
    "it's configured",
    "its configured",
    "env is set",
    "secret is set",
    "added the key",
    "set the key",
    "redeployed",
    "restarted the service",
  ]);

  if (credentialConfirmation) {
    return {
      classification: "credential_env_confirmation",
      resolution: "resolved_input",
      routing_owner: routingOwner,
      execution_owner: executionOwner,
      escalation_owner: escalationOwner,
      should_resume_now: true,
      reason: "Reply confirms an environment or credential change the execution lane can verify.",
    };
  }

  const logsEvidence = includesAny(normalized, [
    "here are the logs",
    "stack trace",
    "exception",
    "traceback",
    "request id",
    "error:",
    "logs:",
    "render log",
    "production logs",
  ]);

  if (logsEvidence) {
    return {
      classification: "logs_evidence",
      resolution: "resolved_input",
      routing_owner: routingOwner,
      execution_owner: executionOwner,
      escalation_owner: escalationOwner,
      should_resume_now: true,
      reason: "Reply includes diagnostic evidence the execution lane can inspect immediately.",
    };
  }

  const approval = includesAny(normalized, [
    "approved",
    "go ahead",
    "proceed",
    "yes",
    "looks good",
    "ship it",
    "do it",
    "ok to",
    "okay to",
  ]);

  if (approval) {
    return {
      classification: "approval",
      resolution: "resolved_input",
      routing_owner: routingOwner,
      execution_owner: executionOwner,
      escalation_owner: escalationOwner,
      should_resume_now: true,
      reason: "Reply gives direct approval for the named next action.",
    };
  }

  const clarification = normalized.includes("?")
    || includesAny(normalized, [
      "what exactly",
      "which one",
      "can you clarify",
      "what do you need",
      "not sure",
      "unclear",
      "need more context",
    ]);

  if (clarification) {
    return {
      classification: "clarification",
      resolution: "ambiguous_input",
      routing_owner: routingOwner,
      execution_owner: executionOwner,
      escalation_owner: escalationOwner,
      should_resume_now: false,
      reason: "Reply asks for clarification instead of unblocking the named next action.",
    };
  }

  return {
    classification: "ambiguous",
    resolution: "ambiguous_input",
    routing_owner: routingOwner,
    execution_owner: executionOwner,
    escalation_owner: escalationOwner,
    should_resume_now: false,
    reason: "Reply did not match a safe unblock pattern.",
  };
}
