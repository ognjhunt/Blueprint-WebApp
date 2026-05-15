import fs from "node:fs/promises";
import path from "node:path";

import { previewDiagnosisOutputSchema } from "../../server/agents/tasks/preview-diagnosis";
import { supportTriageOutputSchema } from "../../server/agents/tasks/support-triage";
import { waitlistTriageOutputSchema } from "../../server/agents/tasks/waitlist-triage";

export type EvalLane = "waitlist_triage" | "support_triage" | "preview_diagnosis";
export type DatasetSplit = "dev" | "holdout" | "shadow";

type WeightedCheck = {
  field: string;
  matched: boolean;
  expected: unknown;
  actual: unknown;
  weight: number;
};

type ScorePenalty = {
  reason: string;
  amount: number;
};

export type LocalEvalCaseResult = {
  lane: EvalLane;
  split: DatasetSplit;
  caseId: string;
  passed: boolean;
  reward: number;
  passThreshold: number;
  candidateSource: string;
  riskTier: string | null;
  weightedChecks: WeightedCheck[];
  penalties: ScorePenalty[];
  failures: Array<{
    field: string;
    expected: unknown;
    actual: unknown;
    weight: number;
  }>;
  schemaErrors: string[];
};

export type LocalEvalLaneSummary = {
  lane: EvalLane;
  totalCases: number;
  passed: number;
  failed: number;
  minReward: number | null;
  averageReward: number | null;
  negativeControls: number;
  negativeControlsBlocked: number;
  splits: Record<DatasetSplit, number>;
  failures: Array<{
    caseId: string;
    split: DatasetSplit;
    reward: number;
    schemaErrors: string[];
    failures: LocalEvalCaseResult["failures"];
    penalties: ScorePenalty[];
  }>;
};

export type LocalEvalSummary = {
  fixtureRoot: string;
  lanes: EvalLane[];
  totalCases: number;
  totalPassed: number;
  totalFailed: number;
  totalNegativeControls: number;
  totalNegativeControlsBlocked: number;
  laneSummaries: Record<EvalLane, LocalEvalLaneSummary>;
  samples: LocalEvalCaseResult[];
};

type EvaluateLocalFixturesOptions = {
  fixtureRoot: string;
  lanes: EvalLane[];
  sampleCount?: number;
};

type ScoreResult = Omit<
  LocalEvalCaseResult,
  "lane" | "split" | "caseId" | "candidateSource" | "riskTier" | "schemaErrors"
>;

const OUTPUT_SCHEMAS = {
  waitlist_triage: waitlistTriageOutputSchema,
  support_triage: supportTriageOutputSchema,
  preview_diagnosis: previewDiagnosisOutputSchema,
} as const;

const REQUIRED_FIELDS: Record<EvalLane, string[]> = {
  waitlist_triage: [
    "automation_status",
    "recommendation",
    "recommended_queue",
    "requires_human_review",
  ],
  support_triage: [
    "automation_status",
    "category",
    "queue",
    "priority",
    "requires_human_review",
  ],
  preview_diagnosis: [
    "automation_status",
    "disposition",
    "retryable",
    "queue",
    "requires_human_review",
  ],
};

const FIELD_WEIGHTS: Record<EvalLane, Record<string, number>> = {
  waitlist_triage: {
    automation_status: 1,
    recommendation: 2,
    recommended_queue: 2,
    requires_human_review: 2,
    market_fit_score: 0.25,
    device_fit_score: 0.25,
    invite_readiness_score: 0.5,
    draft_email: 0.25,
  },
  support_triage: {
    automation_status: 1,
    category: 2,
    queue: 2,
    priority: 1,
    requires_human_review: 2,
    suggested_response: 0.5,
  },
  preview_diagnosis: {
    automation_status: 1,
    disposition: 2,
    retryable: 2,
    queue: 1.5,
    requires_human_review: 2,
    retry_recommended: 0.5,
  },
};

const DEFAULT_LABELS = {
  pass_threshold: 0.8,
  unsafe_auto_clear_penalty: 5,
  wrong_queue_penalty: 2,
  wrong_retry_penalty: 4,
  wrong_escalation_penalty: 4,
  response_quality_weight: 0.5,
  email_quality_weight: 0.25,
};

function laneToDir(lane: EvalLane) {
  switch (lane) {
    case "waitlist_triage":
      return "waitlist-triage";
    case "support_triage":
      return "support-triage";
    case "preview_diagnosis":
      return "preview-diagnosis";
  }
}

async function readJson(pathname: string) {
  const raw = await fs.readFile(pathname, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function listCaseIds(casesRoot: string) {
  try {
    const entries = await fs.readdir(casesRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function asBool(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asPositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

function validateInputShape(lane: EvalLane, input: Record<string, unknown>) {
  const errors: string[] = [];
  if (lane === "waitlist_triage") {
    if (!input.submission || typeof input.submission !== "object") {
      errors.push("input.submission must be an object");
    }
    return errors;
  }

  if (lane === "preview_diagnosis") {
    if (typeof input.requestId !== "string" || input.requestId.trim().length === 0) {
      errors.push("input.requestId must be a non-empty string");
    }
    return errors;
  }

  if (!input || typeof input !== "object") {
    errors.push("input must be an object");
  }
  return errors;
}

function validateExpectedShape(lane: EvalLane, expected: Record<string, unknown>) {
  const parsed = OUTPUT_SCHEMAS[lane].safeParse(expected);
  if (parsed.success) {
    return [];
  }
  return parsed.error.issues.map((issue) => {
    const fieldPath = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    return `${fieldPath}: ${issue.message}`;
  });
}

function responsePresent(value: unknown) {
  return (
    Boolean(value)
    && typeof value === "object"
    && typeof (value as Record<string, unknown>).subject === "string"
    && typeof (value as Record<string, unknown>).body === "string"
    && String((value as Record<string, unknown>).subject).trim().length > 0
    && String((value as Record<string, unknown>).body).trim().length > 0
  );
}

export function scoreOutputAgainstExpected(
  lane: EvalLane,
  candidate: Record<string, unknown>,
  expected: Record<string, unknown>,
  labels: Record<string, unknown>,
): ScoreResult {
  let score = 0;
  const weightedChecks: WeightedCheck[] = [];
  const failures: ScoreResult["failures"] = [];
  const penalties: ScorePenalty[] = [];
  const weights = FIELD_WEIGHTS[lane];
  const passThreshold = asPositiveNumber(labels.pass_threshold, DEFAULT_LABELS.pass_threshold);

  function recordField(
    field: string,
    matched: boolean,
    expectedValue: unknown,
    actualValue: unknown,
    weight: number,
  ) {
    weightedChecks.push({
      field,
      matched,
      expected: expectedValue,
      actual: actualValue,
      weight,
    });
    if (matched) {
      score += weight;
    } else {
      failures.push({
        field,
        expected: expectedValue,
        actual: actualValue,
        weight,
      });
    }
  }

  for (const field of REQUIRED_FIELDS[lane]) {
    recordField(field, candidate[field] === expected[field], expected[field], candidate[field], weights[field] ?? 1);
  }

  if (lane === "waitlist_triage") {
    for (const field of ["market_fit_score", "device_fit_score", "invite_readiness_score"]) {
      if (expected[field] === undefined || expected[field] === null) {
        continue;
      }
      const expectedValue = asNumber(expected[field]);
      const actualValue = asNumber(candidate[field]);
      recordField(
        field,
        expectedValue !== null && actualValue !== null && Math.abs(expectedValue - actualValue) <= 10,
        expectedValue,
        actualValue,
        weights[field] ?? 0.25,
      );
    }
    if (expected.draft_email !== undefined && expected.draft_email !== null) {
      const weight = asPositiveNumber(labels.email_quality_weight, DEFAULT_LABELS.email_quality_weight);
      recordField("draft_email", responsePresent(candidate.draft_email), expected.draft_email, candidate.draft_email, weight);
    }
  }

  if (lane === "support_triage" && expected.suggested_response !== undefined && expected.suggested_response !== null) {
    const weight = asPositiveNumber(labels.response_quality_weight, DEFAULT_LABELS.response_quality_weight);
    recordField(
      "suggested_response",
      responsePresent(candidate.suggested_response),
      expected.suggested_response,
      candidate.suggested_response,
      weight,
    );
  }

  if (lane === "preview_diagnosis" && expected.retry_recommended !== undefined) {
    recordField(
      "retry_recommended",
      candidate.retry_recommended === expected.retry_recommended,
      expected.retry_recommended,
      candidate.retry_recommended,
      weights.retry_recommended ?? 0.5,
    );
  }

  function addPenalty(reason: string, amount: number) {
    if (amount <= 0) {
      return;
    }
    penalties.push({ reason, amount });
    score -= amount;
  }

  const unsafeAutoClearPenalty = asPositiveNumber(
    labels.unsafe_auto_clear_penalty,
    DEFAULT_LABELS.unsafe_auto_clear_penalty,
  );
  const wrongQueuePenalty = asPositiveNumber(
    labels.wrong_queue_penalty,
    DEFAULT_LABELS.wrong_queue_penalty,
  );
  const wrongRetryPenalty = asPositiveNumber(
    labels.wrong_retry_penalty,
    DEFAULT_LABELS.wrong_retry_penalty,
  );
  const wrongEscalationPenalty = asPositiveNumber(
    labels.wrong_escalation_penalty,
    DEFAULT_LABELS.wrong_escalation_penalty,
  );

  if (asBool(expected.requires_human_review) && !asBool(candidate.requires_human_review)) {
    addPenalty("unsafe_auto_clear", unsafeAutoClearPenalty);
  }

  const expectedQueue = expected.recommended_queue ?? expected.queue;
  const actualQueue = candidate.recommended_queue ?? candidate.queue;
  if (expectedQueue !== undefined && expectedQueue !== actualQueue) {
    addPenalty("wrong_queue", wrongQueuePenalty);
  }

  if (lane === "preview_diagnosis") {
    if (expected.retryable !== candidate.retryable) {
      addPenalty("wrong_retry", wrongRetryPenalty);
    }
    if (expected.disposition !== candidate.disposition) {
      addPenalty("wrong_escalation", wrongEscalationPenalty);
    }
  }

  const maxScore = weightedChecks.reduce((sum, check) => sum + check.weight, 0) || 1;
  const reward = clamp(score / maxScore, 0, 1);

  return {
    passed: reward >= passThreshold,
    reward,
    passThreshold,
    weightedChecks,
    penalties,
    failures,
  };
}

function buildNegativeControl(lane: EvalLane, expected: Record<string, unknown>) {
  const candidate = structuredClone(expected) as Record<string, unknown>;

  if (lane === "waitlist_triage") {
    candidate.recommended_queue = "__wrong_queue__";
    return candidate;
  }

  if (lane === "support_triage") {
    if (expected.requires_human_review === true) {
      candidate.automation_status = "completed";
      candidate.requires_human_review = false;
    } else {
      candidate.queue = "__wrong_queue__";
    }
    return candidate;
  }

  candidate.retryable = !asBool(expected.retryable);
  candidate.retry_recommended = !asBool(expected.retry_recommended);
  candidate.disposition = expected.disposition === "retry_now" ? "provider_escalation" : "retry_now";
  return candidate;
}

async function evaluateCase(
  fixtureRoot: string,
  lane: EvalLane,
  split: DatasetSplit,
  caseId: string,
) {
  const caseRoot = path.join(fixtureRoot, laneToDir(lane), "cases", split, caseId);
  const input = await readJson(path.join(caseRoot, "input.json"));
  const expected = await readJson(path.join(caseRoot, "expected.json"));
  const labels = await readJson(path.join(caseRoot, "labels.json"));
  const schemaErrors = [
    ...validateInputShape(lane, input),
    ...validateExpectedShape(lane, expected),
  ];
  const score = scoreOutputAgainstExpected(lane, expected, expected, labels);
  const result: LocalEvalCaseResult = {
    lane,
    split,
    caseId,
    candidateSource: "expected.json",
    riskTier: typeof labels.risk_tier === "string" ? labels.risk_tier : null,
    schemaErrors,
    ...score,
    passed: schemaErrors.length === 0 && score.passed,
  };

  const negativeControl = scoreOutputAgainstExpected(
    lane,
    buildNegativeControl(lane, expected),
    expected,
    labels,
  );

  return {
    result,
    negativeControlBlocked: !negativeControl.passed,
  };
}

function emptyLaneSummary(lane: EvalLane): LocalEvalLaneSummary {
  return {
    lane,
    totalCases: 0,
    passed: 0,
    failed: 0,
    minReward: null,
    averageReward: null,
    negativeControls: 0,
    negativeControlsBlocked: 0,
    splits: {
      dev: 0,
      holdout: 0,
      shadow: 0,
    },
    failures: [],
  };
}

export async function evaluateLocalFixtures(
  options: EvaluateLocalFixturesOptions,
): Promise<LocalEvalSummary> {
  const sampleCount = Math.max(0, options.sampleCount ?? 3);
  const laneSummaries = {} as Record<EvalLane, LocalEvalLaneSummary>;
  const samples: LocalEvalCaseResult[] = [];
  let totalCases = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalNegativeControls = 0;
  let totalNegativeControlsBlocked = 0;

  for (const lane of options.lanes) {
    const summary = emptyLaneSummary(lane);
    let rewardSum = 0;

    for (const split of ["dev", "holdout", "shadow"] as DatasetSplit[]) {
      const splitRoot = path.join(options.fixtureRoot, laneToDir(lane), "cases", split);
      const caseIds = await listCaseIds(splitRoot);
      summary.splits[split] = caseIds.length;

      for (const caseId of caseIds) {
        const { result, negativeControlBlocked } = await evaluateCase(
          options.fixtureRoot,
          lane,
          split,
          caseId,
        );
        summary.totalCases += 1;
        rewardSum += result.reward;
        summary.minReward =
          summary.minReward === null ? result.reward : Math.min(summary.minReward, result.reward);
        summary.negativeControls += 1;
        totalNegativeControls += 1;
        if (negativeControlBlocked) {
          summary.negativeControlsBlocked += 1;
          totalNegativeControlsBlocked += 1;
        }

        if (result.passed) {
          summary.passed += 1;
          totalPassed += 1;
        } else {
          summary.failed += 1;
          totalFailed += 1;
          summary.failures.push({
            caseId,
            split,
            reward: result.reward,
            schemaErrors: result.schemaErrors,
            failures: result.failures,
            penalties: result.penalties,
          });
        }

        totalCases += 1;
        if (samples.length < sampleCount) {
          samples.push(result);
        }
      }
    }

    summary.averageReward = summary.totalCases > 0 ? rewardSum / summary.totalCases : null;
    laneSummaries[lane] = summary;
  }

  return {
    fixtureRoot: options.fixtureRoot,
    lanes: options.lanes,
    totalCases,
    totalPassed,
    totalFailed,
    totalNegativeControls,
    totalNegativeControlsBlocked,
    laneSummaries,
    samples,
  };
}
