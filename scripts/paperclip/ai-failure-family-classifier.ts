import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
  AUTOAGENT_LANE_POLICIES,
  type AutoAgentPromotionLane,
  type AutoAgentRiskTier,
} from "../../server/agents/autoagent-promotion-policy.ts";

export type AiFailureFamilyClassification = {
  family_id: string;
  title: string;
  failure_mode: string;
  evidence_paths: string[];
  affected_lane: AutoAgentPromotionLane;
  risk_tier: AutoAgentRiskTier;
  suggested_eval_intent: string;
  suggested_negative_controls: string[];
  disallowed_claims: string[];
  confidence: number;
  reasons: string[];
};

export type ValidatedAiFailureFamilyClassification =
  AiFailureFamilyClassification & {
    resolved_evidence_paths: string[];
    report_only: boolean;
    validation_reasons: string[];
  };

export type AiFailureFamilyClassificationRejection = {
  family_id: string | null;
  reasons: string[];
};

export type AiFailureFamilyValidationResult = {
  accepted: ValidatedAiFailureFamilyClassification[];
  rejected: AiFailureFamilyClassificationRejection[];
};

export type AiFailureFamilyClassifierStatus =
  | "fallback_no_ai"
  | "fallback_ai_unavailable"
  | "ai_accepted"
  | "ai_rejected"
  | "ai_no_candidates";

export type AiFailureFamilyClassifierSummary = {
  status: AiFailureFamilyClassifierStatus;
  ai_used: boolean;
  accepted_count: number;
  rejected_count: number;
  report_only_count: number;
  accepted_families: string[];
  report_only_families: string[];
  rejected: AiFailureFamilyClassificationRejection[];
  fallback_reason?: string;
};

export type AiFailureFamilyClassifierResult = AiFailureFamilyValidationResult & {
  summary: AiFailureFamilyClassifierSummary;
  artifact_paths: string[];
  raw_output: string | null;
  prompt: string | null;
};

export type AiFailureFamilyClassifierRequest = {
  cwd: string;
  artifactPaths: string[];
  prompt: string;
  schema: typeof AI_FAILURE_FAMILY_CLASSIFIER_RESPONSE_SCHEMA;
};

export type AiFailureFamilyClassifierInvoker = (
  request: AiFailureFamilyClassifierRequest,
) => Promise<string>;

export type RunAiFailureFamilyClassifierOptions = {
  cwd?: string;
  artifactPaths?: string[];
  existingFamilyIds?: string[];
  invoker?: AiFailureFamilyClassifierInvoker;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
};

const REQUIRED_CLASSIFICATION_FIELDS = [
  "family_id",
  "title",
  "failure_mode",
  "evidence_paths",
  "affected_lane",
  "risk_tier",
  "suggested_eval_intent",
  "suggested_negative_controls",
  "disallowed_claims",
  "confidence",
  "reasons",
] as const;

const CLASSIFICATION_FIELD_SET = new Set<string>(REQUIRED_CLASSIFICATION_FIELDS);

const TEXT_EXTENSIONS = new Set([
  ".csv",
  ".json",
  ".jsonl",
  ".log",
  ".md",
  ".txt",
  ".toml",
  ".yaml",
  ".yml",
]);

const SKIP_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "__pycache__",
]);

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_CLASSIFIER_ARTIFACTS = 24;
const MAX_PROMPT_BYTES_PER_FILE = 8_000;

export const AI_FAILURE_FAMILY_CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...REQUIRED_CLASSIFICATION_FIELDS],
  properties: {
    family_id: {
      type: "string",
      pattern: "^[a-z0-9][a-z0-9_-]{2,80}$",
    },
    title: { type: "string", minLength: 8 },
    failure_mode: { type: "string", minLength: 16 },
    evidence_paths: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string", minLength: 1 },
    },
    affected_lane: {
      type: "string",
      enum: Object.keys(AUTOAGENT_LANE_POLICIES),
    },
    risk_tier: {
      type: "string",
      enum: [...new Set(Object.values(AUTOAGENT_LANE_POLICIES).map((policy) => policy.riskTier))],
    },
    suggested_eval_intent: { type: "string", minLength: 16 },
    suggested_negative_controls: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string", minLength: 8 },
    },
    disallowed_claims: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string", minLength: 4 },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasons: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string", minLength: 8 },
    },
  },
} as const;

export const AI_FAILURE_FAMILY_CLASSIFIER_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["failure_families"],
  properties: {
    failure_families: {
      type: "array",
      maxItems: 8,
      items: AI_FAILURE_FAMILY_CLASSIFICATION_SCHEMA,
    },
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

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeEvidencePath(value: string) {
  return value.replace(/:\d+(?::\d+)?$/, "");
}

function pathIsInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveEvidencePath(cwd: string, evidencePath: string) {
  const candidates = [evidencePath, normalizeEvidencePath(evidencePath)];
  for (const candidate of unique(candidates)) {
    const resolved = path.resolve(cwd, candidate);
    if (!pathIsInside(cwd, resolved)) {
      return {
        resolved,
        exists: false,
        reason: "evidence path must stay inside the local repository",
      };
    }
    if (await fileExists(resolved)) {
      return { resolved, exists: true, reason: null };
    }
  }

  return {
    resolved: path.resolve(cwd, normalizeEvidencePath(evidencePath)),
    exists: false,
    reason: `evidence path does not exist locally: ${evidencePath}`,
  };
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

function conciseText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  const stopWords = new Set([
    "agent",
    "candidate",
    "classification",
    "failure",
    "family",
    "local",
    "proof",
    "the",
    "this",
    "with",
  ]);
  return unique(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 4 && !stopWords.has(token)),
  );
}

function evidenceSupportsClassification(
  classification: AiFailureFamilyClassification,
  evidenceText: string,
) {
  const normalizedEvidence = evidenceText.toLowerCase();
  const tokens = tokenize([
    classification.family_id,
    classification.title,
    classification.failure_mode,
  ].join(" "));
  const matches = tokens.filter((token) => normalizedEvidence.includes(token));
  return matches.length >= 2;
}

function classificationText(classification: AiFailureFamilyClassification) {
  return [
    classification.family_id,
    classification.title,
    classification.failure_mode,
    classification.suggested_eval_intent,
    classification.suggested_negative_controls.join(" "),
    classification.disallowed_claims.join(" "),
    classification.reasons.join(" "),
  ].join(" ");
}

function isBlockingIntent(value: string) {
  return /\b(block|reject|prevent|negative control|must not|cannot|fail closed)\b/i.test(value);
}

function hasRealMovementEvidence(evidenceText: string) {
  if (/\b(no changed artifact|no new proof|does not show completed movement)\b/i.test(evidenceText)) {
    return false;
  }
  return /\b(diff --git|files changed|generated fixture|source\.json|promotion packet|durable suppression|suppression rule|real movement|completed movement)\b/i.test(evidenceText);
}

function shouldRejectHostedSessionInference(
  classification: AiFailureFamilyClassification,
  evidenceText: string,
) {
  const text = classificationText(classification);
  if (!/\b(hosted[-\s]?session|hosted fulfillment|package access|runtime session)\b/i.test(text)) {
    return false;
  }

  const proofIntent =
    /\b(use|infer|treat|prove|proof|available|completed|fulfillment)\b/i.test(classification.suggested_eval_intent)
    && !isBlockingIntent(classification.suggested_eval_intent);
  const forbiddenEvidence =
    /\b(sample|demo|public copy|runtime-adjacent|runtime adjacent|runtime-near)\b/i.test(
      `${text} ${evidenceText}`,
    );
  const negatedOwnerProof =
    /\b(no|missing|without)\s+(?:entitlement|runtime session|session artifact|provider artifact|package manifest)\b/i.test(
      evidenceText,
    );
  const ownerProofPresent =
    /\bentitlement\b/i.test(evidenceText)
    && /\b(runtime session|session artifact|runtime\/session)\b/i.test(evidenceText)
    && /\b(provider artifact|package manifest|package artifact)\b/i.test(evidenceText)
    && !negatedOwnerProof;

  return proofIntent || (forbiddenEvidence && !ownerProofPresent && !isBlockingIntent(classification.suggested_eval_intent));
}

function shouldRejectPublicCopyOperationalProof(classification: AiFailureFamilyClassification) {
  const text = classificationText(classification);
  if (!/\b(public[-\s]?copy|copy polish|public polish)\b/i.test(text)) {
    return false;
  }
  if (!/\b(operational launch readiness|operational proof|operational readiness)\b/i.test(text)) {
    return false;
  }
  return !isBlockingIntent(classification.suggested_eval_intent);
}

function reject(familyId: string | null, reasons: string[]): AiFailureFamilyClassificationRejection {
  return {
    family_id: familyId,
    reasons: unique(reasons),
  };
}

function extractRawFamilies(rawJson: unknown) {
  if (Array.isArray(rawJson)) {
    return {
      families: rawJson,
      wrapperErrors: ["AI classifier response must be an object with failure_families"],
    };
  }

  if (!isRecord(rawJson)) {
    return {
      families: [],
      wrapperErrors: ["AI classifier response must be a JSON object"],
    };
  }

  const wrapperKeys = Object.keys(rawJson);
  const wrapperErrors = wrapperKeys.some((key) => key !== "failure_families")
    ? ["AI classifier response has unknown top-level fields"]
    : [];

  if (!Array.isArray(rawJson.failure_families)) {
    return {
      families: [],
      wrapperErrors: [...wrapperErrors, "failure_families must be an array"],
    };
  }

  return {
    families: rawJson.failure_families,
    wrapperErrors,
  };
}

function classificationFromRecord(record: Record<string, unknown>): AiFailureFamilyClassification {
  return {
    family_id: record.family_id as string,
    title: record.title as string,
    failure_mode: record.failure_mode as string,
    evidence_paths: stringArray(record.evidence_paths),
    affected_lane: record.affected_lane as AutoAgentPromotionLane,
    risk_tier: record.risk_tier as AutoAgentRiskTier,
    suggested_eval_intent: record.suggested_eval_intent as string,
    suggested_negative_controls: stringArray(record.suggested_negative_controls),
    disallowed_claims: stringArray(record.disallowed_claims),
    confidence: record.confidence as number,
    reasons: stringArray(record.reasons),
  };
}

export async function validateAiFailureFamilyClassifications(input: {
  cwd?: string;
  rawJson: unknown;
  existingFamilyIds?: string[];
}): Promise<AiFailureFamilyValidationResult> {
  const cwd = path.resolve(input.cwd ?? process.cwd());
  const { families, wrapperErrors } = extractRawFamilies(input.rawJson);
  const accepted: ValidatedAiFailureFamilyClassification[] = [];
  const rejected: AiFailureFamilyClassificationRejection[] = [];
  const seenFamilyIds = new Set(input.existingFamilyIds ?? []);
  const emittedFamilyIds = new Set<string>();

  if (wrapperErrors.length > 0) {
    rejected.push(reject(null, wrapperErrors));
  }

  for (const rawFamily of families) {
    if (!isRecord(rawFamily)) {
      rejected.push(reject(null, ["failure family entry must be a JSON object"]));
      continue;
    }

    const familyId = typeof rawFamily.family_id === "string" ? rawFamily.family_id : null;
    const reasons: string[] = [];
    const validationReasons: string[] = [];
    const keys = Object.keys(rawFamily);
    const unknownKeys = keys.filter((key) => !CLASSIFICATION_FIELD_SET.has(key));
    if (unknownKeys.length > 0) {
      reasons.push(`unknown fields are not allowed: ${unknownKeys.join(", ")}`);
    }
    for (const required of REQUIRED_CLASSIFICATION_FIELDS) {
      if (!(required in rawFamily)) {
        reasons.push(`missing required field: ${required}`);
      }
    }

    if (!familyId || !/^[a-z0-9][a-z0-9_-]{2,80}$/.test(familyId)) {
      reasons.push("family_id must be stable lowercase snake/kebab case");
    } else {
      if (/^(unknown|misc|general|other|issue|problem|failure)$/i.test(familyId)) {
        reasons.push("family_id is too vague");
      }
      if (emittedFamilyIds.has(familyId) || seenFamilyIds.has(familyId)) {
        reasons.push(`duplicate family_id is not allowed: ${familyId}`);
      }
      emittedFamilyIds.add(familyId);
    }

    if (typeof rawFamily.title !== "string" || rawFamily.title.trim().length < 8) {
      reasons.push("title is missing or too vague");
    }
    if (typeof rawFamily.failure_mode !== "string" || rawFamily.failure_mode.trim().length < 16) {
      reasons.push("failure_mode is missing or too vague");
    }
    if (
      typeof rawFamily.suggested_eval_intent !== "string"
      || rawFamily.suggested_eval_intent.trim().length < 16
    ) {
      reasons.push("suggested_eval_intent is missing or too vague");
    }

    const evidencePaths = stringArray(rawFamily.evidence_paths);
    if (evidencePaths.length === 0) {
      reasons.push("evidence_paths must contain at least one local path");
    }
    const negativeControls = stringArray(rawFamily.suggested_negative_controls);
    if (negativeControls.length === 0) {
      reasons.push("suggested_negative_controls must contain at least one control");
    }
    const disallowedClaims = stringArray(rawFamily.disallowed_claims);
    if (disallowedClaims.length === 0) {
      reasons.push("disallowed_claims must contain at least one blocked claim");
    }
    const reasonList = stringArray(rawFamily.reasons);
    if (reasonList.length === 0) {
      reasons.push("reasons must contain at least one evidence-backed reason");
    }
    if (typeof rawFamily.confidence !== "number" || !Number.isFinite(rawFamily.confidence)) {
      reasons.push("confidence must be a number");
    } else if (rawFamily.confidence < 0 || rawFamily.confidence > 1) {
      reasons.push("confidence must be between 0 and 1");
    }

    const lane = rawFamily.affected_lane;
    const policy =
      typeof lane === "string"
      && lane in AUTOAGENT_LANE_POLICIES
        ? AUTOAGENT_LANE_POLICIES[lane as AutoAgentPromotionLane]
        : null;
    if (!policy) {
      reasons.push("affected_lane must map to an existing AutoAgent policy lane");
    }

    if (typeof rawFamily.risk_tier !== "string") {
      reasons.push("risk_tier must map to an existing AutoAgent policy risk tier");
    } else if (policy && rawFamily.risk_tier !== policy.riskTier) {
      reasons.push(
        `risk_tier ${rawFamily.risk_tier} does not match policy risk tier ${policy.riskTier} for ${policy.lane}`,
      );
    }

    if (policy?.maxAutomaticDecision === "blocked") {
      reasons.push(`high-risk lane cannot be promoted by AI classifier: ${policy.lane}`);
    }

    const resolvedEvidencePaths: string[] = [];
    const evidenceTexts: string[] = [];
    for (const evidencePath of evidencePaths) {
      const resolved = await resolveEvidencePath(cwd, evidencePath);
      if (!resolved.exists) {
        reasons.push(resolved.reason ?? `evidence path does not exist locally: ${evidencePath}`);
        continue;
      }
      resolvedEvidencePaths.push(resolved.resolved);
      evidenceTexts.push(await readFilePrefix(resolved.resolved, 64_000));
    }

    const classification = classificationFromRecord(rawFamily);
    const combinedEvidenceText = evidenceTexts.join("\n");
    if (
      resolvedEvidencePaths.length > 0
      && !evidenceSupportsClassification(classification, combinedEvidenceText)
    ) {
      reasons.push("classification is unsupported by the cited local evidence");
    }

    let reportOnly = false;
    const noChangeChurn =
      /no[-_\s]?change|no changed artifact|no new proof|closeout churn/i.test(
        classificationText(classification),
      );
    if (noChangeChurn && !hasRealMovementEvidence(combinedEvidenceText)) {
      reportOnly = true;
      validationReasons.push("no-change churn is report-only without local evidence of real movement");
    }

    if (shouldRejectHostedSessionInference(classification, combinedEvidenceText)) {
      reasons.push(
        "hosted-session proof cannot be inferred from sample/demo/runtime-adjacent text",
      );
    }

    if (shouldRejectPublicCopyOperationalProof(classification)) {
      reasons.push("public-copy polish cannot become operational proof");
    }

    if (reasons.length > 0) {
      rejected.push(reject(familyId, reasons));
      continue;
    }

    accepted.push({
      ...classification,
      evidence_paths: evidencePaths,
      suggested_negative_controls: negativeControls,
      disallowed_claims: disallowedClaims,
      reasons: reasonList,
      resolved_evidence_paths: resolvedEvidencePaths,
      report_only: reportOnly,
      validation_reasons: validationReasons,
    });
  }

  return { accepted, rejected };
}

async function collectArtifactFiles(root: string, maxFiles: number) {
  const files: string[] = [];
  const queue = [root];

  while (queue.length > 0 && files.length < maxFiles) {
    const current = queue.shift();
    if (!current) continue;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORY_NAMES.has(entry.name)) queue.push(next);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      files.push(next);
      if (files.length >= maxFiles) break;
    }
  }

  return files;
}

export async function resolveAiClassifierArtifactPaths(
  cwd: string,
  artifactPaths: string[] = [],
) {
  const resolved: string[] = [];
  for (const artifactPath of artifactPaths) {
    const absolutePath = path.resolve(cwd, artifactPath);
    if (!pathIsInside(cwd, absolutePath)) {
      continue;
    }
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isFile() && TEXT_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
        resolved.push(absolutePath);
      } else if (stat.isDirectory()) {
        resolved.push(...await collectArtifactFiles(absolutePath, MAX_CLASSIFIER_ARTIFACTS - resolved.length));
      }
    } catch {
      continue;
    }
    if (resolved.length >= MAX_CLASSIFIER_ARTIFACTS) break;
  }
  return unique(resolved).slice(0, MAX_CLASSIFIER_ARTIFACTS);
}

async function buildAiClassifierPrompt(cwd: string, artifactPaths: string[]) {
  const lines = [
    "You are an advisory classifier for Blueprint repo-local AutoResearch artifacts.",
    "Read only the local artifact excerpts below. Do not infer live provider, Firestore, Notion, Stripe, rights, payment, hosted-session, customer, city, or Paperclip mutation proof.",
    "Return JSON only. No markdown, prose, comments, or code fences.",
    "The JSON must match this schema exactly:",
    JSON.stringify(AI_FAILURE_FAMILY_CLASSIFIER_RESPONSE_SCHEMA),
    "",
    "Required policy boundaries:",
    "- AI classifications are advisory only.",
    "- Deterministic validators decide whether classifications are usable.",
    "- Hosted-session proof cannot come from sample/demo/runtime-adjacent text.",
    "- Public-copy polish cannot become operational proof.",
    "- No-change churn is report-only unless evidence shows real movement.",
    "- High-risk lanes cannot be promoted.",
    "",
    "Local artifact excerpts:",
  ];

  for (const artifactPath of artifactPaths) {
    const relative = path.relative(cwd, artifactPath);
    const excerpt = conciseText(await readFilePrefix(artifactPath, MAX_PROMPT_BYTES_PER_FILE));
    lines.push("");
    lines.push(`### ${relative}`);
    lines.push(excerpt || "(empty)");
  }

  return lines.join("\n");
}

function classifierSummary(
  status: AiFailureFamilyClassifierStatus,
  aiUsed: boolean,
  validation: AiFailureFamilyValidationResult,
  fallbackReason?: string,
): AiFailureFamilyClassifierSummary {
  const reportOnly = validation.accepted.filter((entry) => entry.report_only);
  return {
    status,
    ai_used: aiUsed,
    accepted_count: validation.accepted.length,
    rejected_count: validation.rejected.length,
    report_only_count: reportOnly.length,
    accepted_families: validation.accepted.map((entry) => entry.family_id),
    report_only_families: reportOnly.map((entry) => entry.family_id),
    rejected: validation.rejected,
    ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
  };
}

function parseArgsJson(value: string | undefined) {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("BLUEPRINT_AUTORESEARCH_AI_CLASSIFIER_ARGS_JSON must be a JSON array of strings");
  }
  return parsed as string[];
}

function commandInvokerFromEnv(
  env: Record<string, string | undefined>,
  timeoutMs: number,
): AiFailureFamilyClassifierInvoker | null {
  const command = env.BLUEPRINT_AUTORESEARCH_AI_CLASSIFIER_BIN;
  if (!command) return null;
  const args = parseArgsJson(env.BLUEPRINT_AUTORESEARCH_AI_CLASSIFIER_ARGS_JSON);

  return async (request) => runClassifierCommand({
    cwd: request.cwd,
    command,
    args,
    input: request.prompt,
    timeoutMs,
    env,
  });
}

async function runClassifierCommand(input: {
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
      reject(new Error(`AI classifier command timed out after ${input.timeoutMs}ms`));
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
        reject(new Error(`AI classifier command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(input.input);
  });
}

export async function runAiFailureFamilyClassifier(
  options: RunAiFailureFamilyClassifierOptions = {},
): Promise<AiFailureFamilyClassifierResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const artifactPaths = await resolveAiClassifierArtifactPaths(cwd, options.artifactPaths ?? []);
  const emptyValidation: AiFailureFamilyValidationResult = { accepted: [], rejected: [] };
  const prompt = artifactPaths.length > 0 ? await buildAiClassifierPrompt(cwd, artifactPaths) : null;
  const invoker = options.invoker ?? commandInvokerFromEnv(env, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (!invoker) {
    return {
      ...emptyValidation,
      summary: classifierSummary(
        "fallback_no_ai",
        false,
        emptyValidation,
        "No AI classifier command or session was configured.",
      ),
      artifact_paths: artifactPaths,
      raw_output: null,
      prompt,
    };
  }

  if (!prompt) {
    return {
      ...emptyValidation,
      summary: classifierSummary(
        "fallback_no_ai",
        false,
        emptyValidation,
        "No local artifact paths were available for the AI classifier.",
      ),
      artifact_paths: artifactPaths,
      raw_output: null,
      prompt,
    };
  }

  let rawOutput: string;
  try {
    rawOutput = await invoker({
      cwd,
      artifactPaths,
      prompt,
      schema: AI_FAILURE_FAMILY_CLASSIFIER_RESPONSE_SCHEMA,
    });
  } catch (error) {
    return {
      ...emptyValidation,
      summary: classifierSummary(
        "fallback_ai_unavailable",
        false,
        emptyValidation,
        error instanceof Error ? error.message : String(error),
      ),
      artifact_paths: artifactPaths,
      raw_output: null,
      prompt,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    const validation: AiFailureFamilyValidationResult = {
      accepted: [],
      rejected: [reject(null, ["AI classifier returned non-JSON output"])],
    };
    return {
      ...validation,
      summary: classifierSummary("ai_rejected", true, validation),
      artifact_paths: artifactPaths,
      raw_output: rawOutput,
      prompt,
    };
  }

  const validation = await validateAiFailureFamilyClassifications({
    cwd,
    rawJson: parsed,
    existingFamilyIds: options.existingFamilyIds,
  });
  const usableCount = validation.accepted.filter((entry) => !entry.report_only).length;
  const status: AiFailureFamilyClassifierStatus =
    usableCount > 0
      ? "ai_accepted"
      : validation.accepted.length > 0 || validation.rejected.length > 0
        ? "ai_rejected"
        : "ai_no_candidates";

  return {
    ...validation,
    summary: classifierSummary(status, true, validation),
    artifact_paths: artifactPaths,
    raw_output: rawOutput,
    prompt,
  };
}
