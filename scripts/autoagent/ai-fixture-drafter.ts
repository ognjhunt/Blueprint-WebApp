import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
  isDatasetSplit,
  isEvalLane,
  requiredFieldsForLane,
  type DatasetSplit,
  type EvalLane,
} from "./local-evaluator.ts";

export type AiFixtureDraftFailureFamily = {
  failure_family: string;
  severity: string;
  recurrence_count: number;
  evidence_paths: string[];
  recommended_eval_or_policy_change: string;
  blocked_claims: string[];
  affected_lane?: string;
  risk_tier?: string;
  source?: string;
};

export type AiFixtureNegativeControl = {
  id: string;
  description?: string;
  candidate: Record<string, unknown>;
  must_fail_because?: string;
};

export type AiFixtureDraft = {
  fixture_id: string;
  lane: EvalLane;
  split: DatasetSplit;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  labels: Record<string, unknown>;
  negative_controls: AiFixtureNegativeControl[];
  proof_requirements: string[];
  disallowed_claims: string[];
};

export type AiFixtureEvidenceSnippet = {
  path: string;
  resolved_path: string;
  exists: boolean;
  text: string;
};

export type AiFixtureDrafterRequest = {
  cwd: string;
  failureFamily: AiFixtureDraftFailureFamily;
  evidenceSnippets: AiFixtureEvidenceSnippet[];
  prompt: string;
  schema: typeof AI_FIXTURE_DRAFTER_RESPONSE_SCHEMA;
};

export type AiFixtureDrafterInvoker = (
  request: AiFixtureDrafterRequest,
) => Promise<string>;

export type AiFixtureDrafterBlockedAttempt = {
  fixture_id: string | null;
  failure_family: string;
  reasons: string[];
};

export type AiFixtureDrafterStatus =
  | "fallback_no_ai"
  | "fallback_ai_unavailable"
  | "accepted"
  | "rejected";

export type AiFixtureDrafterSummary = {
  status: AiFixtureDrafterStatus;
  ai_used: boolean;
  accepted_fixture_id: string | null;
  rejected_count: number;
  blocked_attempts: AiFixtureDrafterBlockedAttempt[];
  fallback_reason?: string;
};

export type AiFixtureDrafterResult = {
  summary: AiFixtureDrafterSummary;
  draft: AiFixtureDraft | null;
  evidence_snippets: AiFixtureEvidenceSnippet[];
  raw_output: string | null;
  prompt: string | null;
};

export type RunAiFixtureDrafterOptions = {
  cwd?: string;
  failureFamily: AiFixtureDraftFailureFamily;
  invoker?: AiFixtureDrafterInvoker;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_SNIPPET_BYTES = 8_000;

const REQUIRED_DRAFT_FIELDS = [
  "fixture_id",
  "lane",
  "split",
  "input",
  "expected",
  "labels",
  "negative_controls",
  "proof_requirements",
  "disallowed_claims",
] as const;

const REQUIRED_DRAFT_FIELD_SET = new Set<string>(REQUIRED_DRAFT_FIELDS);

export const AI_FIXTURE_DRAFTER_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...REQUIRED_DRAFT_FIELDS],
  properties: {
    fixture_id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{7,96}$" },
    lane: {
      type: "string",
      enum: [
        "waitlist_triage",
        "support_triage",
        "preview_diagnosis",
        "agent_failure_promotion",
      ],
    },
    split: { type: "string", enum: ["dev", "holdout", "shadow"] },
    input: { type: "object" },
    expected: { type: "object" },
    labels: { type: "object" },
    negative_controls: { type: "array", minItems: 1 },
    proof_requirements: { type: "array", minItems: 1 },
    disallowed_claims: { type: "array", minItems: 1 },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeEvidencePath(value: string) {
  return value.replace(/:\d+(?::\d+)?$/, "");
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readFilePrefix(filePath: string, maxBytes: number) {
  const handle = await fs.open(filePath, "r");
  try {
    const stats = await handle.stat();
    const bytesToRead = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, 0);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

async function resolveEvidencePath(cwd: string, evidencePath: string) {
  const normalized = normalizeEvidencePath(evidencePath);
  const candidates = unique([
    evidencePath,
    normalized,
    path.resolve(cwd, evidencePath),
    path.resolve(cwd, normalized),
  ]);
  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
    if (await fileExists(resolved)) {
      return resolved;
    }
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(cwd, normalized);
}

export async function collectAiFixtureEvidenceSnippets(
  cwd: string,
  failureFamily: AiFixtureDraftFailureFamily,
) {
  const snippets: AiFixtureEvidenceSnippet[] = [];
  for (const evidencePath of failureFamily.evidence_paths) {
    const resolved = await resolveEvidencePath(cwd, evidencePath);
    const exists = await fileExists(resolved);
    snippets.push({
      path: evidencePath,
      resolved_path: resolved,
      exists,
      text: exists ? await readFilePrefix(resolved, MAX_SNIPPET_BYTES) : "",
    });
  }
  return snippets;
}

function conciseText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildPrompt(input: {
  failureFamily: AiFixtureDraftFailureFamily;
  evidenceSnippets: AiFixtureEvidenceSnippet[];
}) {
  const lines = [
    "You are drafting one Blueprint AutoAgent eval fixture from a validated AutoResearch failure-family object.",
    "Return JSON only. No markdown, prose, comments, or code fences.",
    "The JSON must match this schema exactly:",
    JSON.stringify(AI_FIXTURE_DRAFTER_RESPONSE_SCHEMA),
    "",
    "Required policy boundaries:",
    "- The draft is advisory only; deterministic validators decide whether it can enter the offline corpus.",
    "- Use only the validated failure-family object and local evidence snippets below.",
    "- Negative controls must target concrete forbidden behavior.",
    "- Do not invent live readiness, hosted-session fulfillment, customer, city, rights, payment, payout, provider execution, Paperclip, Notion, or production automation proof.",
    "- Public-copy polish cannot become operational proof.",
    "- No-change churn must catch false progress unless the local evidence shows real changed movement.",
    "",
    "Validated failure-family object:",
    JSON.stringify(input.failureFamily, null, 2),
    "",
    "Local evidence snippets:",
  ];

  for (const snippet of input.evidenceSnippets) {
    lines.push("");
    lines.push(`### ${snippet.path}`);
    lines.push(snippet.exists ? conciseText(snippet.text) : "(missing local evidence path)");
  }

  return lines.join("\n");
}

function parseArgsJson(value: string | undefined) {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("BLUEPRINT_AUTORESEARCH_AI_FIXTURE_DRAFTER_ARGS_JSON must be a JSON array of strings");
  }
  return parsed as string[];
}

function commandInvokerFromEnv(
  env: Record<string, string | undefined>,
  timeoutMs: number,
): AiFixtureDrafterInvoker | null {
  const command = env.BLUEPRINT_AUTORESEARCH_AI_FIXTURE_DRAFTER_BIN;
  if (!command) return null;
  const args = parseArgsJson(env.BLUEPRINT_AUTORESEARCH_AI_FIXTURE_DRAFTER_ARGS_JSON);

  return async (request) => runDrafterCommand({
    cwd: request.cwd,
    command,
    args,
    input: request.prompt,
    timeoutMs,
    env,
  });
}

async function runDrafterCommand(input: {
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
      reject(new Error(`AI fixture drafter command timed out after ${input.timeoutMs}ms`));
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
        reject(new Error(`AI fixture drafter command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(input.input);
  });
}

function blockedAttempt(
  failureFamily: AiFixtureDraftFailureFamily,
  fixtureId: string | null,
  reasons: string[],
): AiFixtureDrafterBlockedAttempt {
  return {
    fixture_id: fixtureId,
    failure_family: failureFamily.failure_family,
    reasons: unique(reasons),
  };
}

function summary(
  status: AiFixtureDrafterStatus,
  aiUsed: boolean,
  failureFamily: AiFixtureDraftFailureFamily,
  fixtureId: string | null,
  reasons: string[] = [],
  fallbackReason?: string,
): AiFixtureDrafterSummary {
  const blockedAttempts = status === "rejected"
    ? [blockedAttempt(failureFamily, fixtureId, reasons)]
    : [];
  return {
    status,
    ai_used: aiUsed,
    accepted_fixture_id: status === "accepted" ? fixtureId : null,
    rejected_count: blockedAttempts.length,
    blocked_attempts: blockedAttempts,
    ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
  };
}

function unknownTopLevelKeys(draft: Record<string, unknown>) {
  return Object.keys(draft).filter((key) => !REQUIRED_DRAFT_FIELD_SET.has(key));
}

function textOf(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function positiveProofText(value: unknown) {
  return textOf(value).replace(/\s+/g, " ").trim();
}

function containsPublicCopyOperationalProof(value: unknown) {
  const text = positiveProofText(value);
  return (
    /\b(public[-\s]?copy|copy polish|public polish)\b[\s\S]{0,140}\b(proves?|counts as|is enough for|confirms?)\b[\s\S]{0,100}\b(operational proof|operational readiness|operational launch readiness)\b/i.test(text)
    || /\b(operational proof|operational readiness|operational launch readiness)\b[\s\S]{0,140}\b(proves?|counts as|is enough for|confirms?)\b[\s\S]{0,100}\b(public[-\s]?copy|copy polish|public polish)\b/i.test(text)
  );
}

function hasNegatedProofContext(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 100), index).toLowerCase();
  return /\b(no|not|cannot|must not|do not|does not|without|missing|blocked?|disallow(?:ed)?|unverified|requires?|unless)\b/.test(before);
}

function containsInventedOperationalProof(value: unknown) {
  const text = positiveProofText(value);
  const patterns: Array<[RegExp, string]> = [
    [/\bhosted[-\s]?session\b[\s\S]{0,140}\b(fulfillment|package access|access)\b[\s\S]{0,140}\b(completed|fulfilled|ready|open|available|proved|proven|confirmed)\b/i, "hosted-session fulfillment proof cannot be invented"],
    [/\b(customer|real customer|testimonial|logo)\b[\s\S]{0,120}\b(proved|proven|confirmed|exists|active|live)\b/i, "customer proof cannot be invented"],
    [/\bcity\b[\s\S]{0,120}\b(live|active|covered|coverage confirmed|launched)\b/i, "city-live proof cannot be invented"],
    [/\bright[s]?\b[\s\S]{0,120}\b(cleared|approved|confirmed|unrestricted)\b/i, "rights proof cannot be invented"],
    [/\b(payment|checkout)\b[\s\S]{0,120}\b(completed|paid|successful|confirmed|proved|proven)\b/i, "payment proof cannot be invented"],
    [/\bpayout\b[\s\S]{0,120}\b(completed|paid|successful|confirmed|proved|proven)\b/i, "payout proof cannot be invented"],
    [/\bprovider\b[\s\S]{0,120}\b(executed|execution completed|run completed|fixed|ready|proved|proven|confirmed)\b/i, "provider execution proof cannot be invented"],
    [/\b(live readiness|operational launch ready|operational readiness proved|operational launch readiness proved)\b/i, "live or operational readiness proof cannot be invented"],
  ];

  const reasons: string[] = [];
  for (const [pattern, reason] of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && !hasNegatedProofContext(text, match.index)) {
      reasons.push(reason);
    }
  }
  return reasons;
}

function negativeControlTargetsConcreteBehavior(
  control: AiFixtureNegativeControl,
  lane: EvalLane,
  failureFamily: AiFixtureDraftFailureFamily,
) {
  const requiredFields = requiredFieldsForLane(lane);
  const candidateMissingCoreFields = requiredFields.every((field) => control.candidate[field] === undefined);
  if (candidateMissingCoreFields) {
    return false;
  }

  const controlText = positiveProofText([
    control.id,
    control.description ?? "",
    control.must_fail_because ?? "",
    control.candidate,
    ...failureFamily.blocked_claims,
  ]);
  return /\b(false progress|completed movement|no changed artifact|no new proof|public[-\s]?copy|operational proof|hosted[-\s]?session|provider|rights|payment|payout|customer|city|live readiness|unsafe auto-clear|auto[-\s]?invite|wrong queue|unsupported claim)\b/i.test(controlText);
}

function noChangeControlCatchesFalseProgress(draft: AiFixtureDraft) {
  return draft.negative_controls.some((control) => {
    const controlText = positiveProofText([
      control.id,
      control.description ?? "",
      control.must_fail_because ?? "",
      control.candidate,
    ]);
    return (
      /\b(false progress|completed movement|no changed artifact|no new proof|durable movement)\b/i.test(controlText)
      && /\b(completed|complete|done|close)\b/i.test(controlText)
    );
  });
}

function parseDraftFromJson(rawJson: unknown): {
  draft: AiFixtureDraft | null;
  fixtureId: string | null;
  reasons: string[];
} {
  if (!isRecord(rawJson)) {
    return { draft: null, fixtureId: null, reasons: ["AI fixture drafter response must be a JSON object"] };
  }

  const fixtureId = typeof rawJson.fixture_id === "string" ? rawJson.fixture_id : null;
  const reasons: string[] = [];
  const unknownKeys = unknownTopLevelKeys(rawJson);
  if (unknownKeys.length > 0) {
    reasons.push(`unknown top-level fields are not allowed: ${unknownKeys.join(", ")}`);
  }
  for (const field of REQUIRED_DRAFT_FIELDS) {
    if (!(field in rawJson)) {
      reasons.push(`missing required field: ${field}`);
    }
  }

  if (!fixtureId || !/^[a-z0-9][a-z0-9-]{7,96}$/.test(fixtureId)) {
    reasons.push("fixture_id must be stable lowercase kebab case and at least 8 characters");
  }
  if (!isEvalLane(rawJson.lane)) {
    reasons.push("lane must be a known AutoAgent eval lane");
  }
  if (!isDatasetSplit(rawJson.split)) {
    reasons.push("split must be one of dev, holdout, or shadow");
  }
  if (!isRecord(rawJson.input)) {
    reasons.push("input must be an object");
  }
  if (!isRecord(rawJson.expected)) {
    reasons.push("expected must be an object");
  }
  if (!isRecord(rawJson.labels)) {
    reasons.push("labels must be an object");
  }

  const negativeControls = Array.isArray(rawJson.negative_controls)
    ? rawJson.negative_controls
    : [];
  if (negativeControls.length === 0) {
    reasons.push("negative_controls must contain at least one concrete forbidden behavior");
  }

  const proofRequirements = stringArray(rawJson.proof_requirements);
  if (proofRequirements.length === 0) {
    reasons.push("proof_requirements must contain at least one local proof requirement");
  }
  if (proofRequirements.some((entry) => entry.trim().length < 8 || /^(be careful|verify|proof|evidence)$/i.test(entry.trim()))) {
    reasons.push("proof_requirements must be concrete and source-bound");
  }

  const disallowedClaims = stringArray(rawJson.disallowed_claims);
  if (disallowedClaims.length === 0) {
    reasons.push("disallowed_claims must contain at least one blocked claim");
  }
  if (disallowedClaims.some((entry) => entry.trim().length < 8 || /^(bad|unsafe|wrong|claim)$/i.test(entry.trim()))) {
    reasons.push("disallowed_claims must name concrete forbidden behavior");
  }

  if (reasons.length > 0) {
    return { draft: null, fixtureId, reasons };
  }

  return {
    draft: {
      fixture_id: fixtureId!,
      lane: rawJson.lane as EvalLane,
      split: rawJson.split as DatasetSplit,
      input: rawJson.input as Record<string, unknown>,
      expected: rawJson.expected as Record<string, unknown>,
      labels: rawJson.labels as Record<string, unknown>,
      negative_controls: negativeControls as AiFixtureNegativeControl[],
      proof_requirements: proofRequirements,
      disallowed_claims: disallowedClaims,
    },
    fixtureId,
    reasons,
  };
}

export function validateAiFixtureDraft(input: {
  draft: AiFixtureDraft;
  failureFamily: AiFixtureDraftFailureFamily;
  evidenceSnippets: AiFixtureEvidenceSnippet[];
}) {
  const reasons: string[] = [];
  const { draft, failureFamily } = input;

  for (const snippet of input.evidenceSnippets) {
    if (!snippet.exists) {
      reasons.push(`evidence path does not exist locally: ${snippet.path}`);
    }
  }
  if (input.evidenceSnippets.length === 0) {
    reasons.push("failure family must provide at least one local evidence path");
  }

  for (const field of requiredFieldsForLane(draft.lane)) {
    if (field === "blocked_claims") {
      if (!Array.isArray(draft.expected.blocked_claims)) {
        reasons.push("expected.blocked_claims must be an array");
      }
      continue;
    }
    if (
      draft.expected[field] === undefined
      || draft.expected[field] === null
      || (typeof draft.expected[field] === "string" && draft.expected[field].trim().length === 0)
    ) {
      reasons.push(`expected output missing required field: ${field}`);
    }
  }

  for (const control of draft.negative_controls) {
    if (!isRecord(control) || typeof control.id !== "string" || !isRecord(control.candidate)) {
      reasons.push("negative_controls entries must include id and candidate object");
      continue;
    }
    if (control.id.trim().length < 8) {
      reasons.push(`negative control id is too vague: ${control.id}`);
    }
    if (!negativeControlTargetsConcreteBehavior(control, draft.lane, failureFamily)) {
      reasons.push(`negative control ${control.id} must target concrete forbidden behavior`);
    }
  }

  const expectedAndProofRequirements = {
    expected: draft.expected,
    proof_requirements: draft.proof_requirements,
  };
  if (containsPublicCopyOperationalProof(expectedAndProofRequirements)) {
    reasons.push("public-copy polish cannot become operational proof");
  }
  reasons.push(...containsInventedOperationalProof(expectedAndProofRequirements));

  if (/no[_\s-]?change|closeout[_\s-]?churn/i.test(failureFamily.failure_family)) {
    if (!noChangeControlCatchesFalseProgress(draft)) {
      reasons.push("no-change churn fixture must catch false progress before it can be accepted");
    }
  }

  return unique(reasons);
}

export async function parseAndValidateAiFixtureDraft(input: {
  cwd: string;
  rawJson: unknown;
  failureFamily: AiFixtureDraftFailureFamily;
  evidenceSnippets: AiFixtureEvidenceSnippet[];
}) {
  const parsed = parseDraftFromJson(input.rawJson);
  if (!parsed.draft) {
    return parsed;
  }
  const reasons = validateAiFixtureDraft({
    draft: parsed.draft,
    failureFamily: input.failureFamily,
    evidenceSnippets: input.evidenceSnippets,
  });
  return {
    draft: reasons.length === 0 ? parsed.draft : null,
    fixtureId: parsed.fixtureId,
    reasons,
  };
}

export async function runAiFixtureDrafter(
  options: RunAiFixtureDrafterOptions,
): Promise<AiFixtureDrafterResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const evidenceSnippets = await collectAiFixtureEvidenceSnippets(cwd, options.failureFamily);
  const prompt = buildPrompt({
    failureFamily: options.failureFamily,
    evidenceSnippets,
  });
  const invoker = options.invoker ?? commandInvokerFromEnv(env, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (!invoker) {
    return {
      summary: summary(
        "fallback_no_ai",
        false,
        options.failureFamily,
        null,
        [],
        "No AI fixture drafter command or session was configured.",
      ),
      draft: null,
      evidence_snippets: evidenceSnippets,
      raw_output: null,
      prompt,
    };
  }

  let rawOutput: string;
  try {
    rawOutput = await invoker({
      cwd,
      failureFamily: options.failureFamily,
      evidenceSnippets,
      prompt,
      schema: AI_FIXTURE_DRAFTER_RESPONSE_SCHEMA,
    });
  } catch (error) {
    return {
      summary: summary(
        "fallback_ai_unavailable",
        false,
        options.failureFamily,
        null,
        [],
        error instanceof Error ? error.message : String(error),
      ),
      draft: null,
      evidence_snippets: evidenceSnippets,
      raw_output: null,
      prompt,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    const reasons = ["AI fixture drafter returned non-JSON output"];
    return {
      summary: summary("rejected", true, options.failureFamily, null, reasons),
      draft: null,
      evidence_snippets: evidenceSnippets,
      raw_output: rawOutput,
      prompt,
    };
  }

  const validation = await parseAndValidateAiFixtureDraft({
    cwd,
    rawJson: parsed,
    failureFamily: options.failureFamily,
    evidenceSnippets,
  });

  if (!validation.draft) {
    return {
      summary: summary(
        "rejected",
        true,
        options.failureFamily,
        validation.fixtureId,
        validation.reasons,
      ),
      draft: null,
      evidence_snippets: evidenceSnippets,
      raw_output: rawOutput,
      prompt,
    };
  }

  return {
    summary: summary("accepted", true, options.failureFamily, validation.draft.fixture_id),
    draft: validation.draft,
    evidence_snippets: evidenceSnippets,
    raw_output: rawOutput,
    prompt,
  };
}
