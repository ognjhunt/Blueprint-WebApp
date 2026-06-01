export type AllocationProofLevel =
  | "live-performance"
  | "live-billing"
  | "live-usage"
  | "live-credit-balance"
  | "repo-local-export"
  | "repo-local-config"
  | "fixture"
  | "missing";

export type ProofStatus = "current" | "stale" | "missing" | "unsupported";

export type BudgetLinePolicy = {
  budget_line: string;
  target_usd: number;
  tier: "P0" | "P1" | "P2";
  channel_id: string;
  minimum_usd?: number | null;
  experiment_cap_usd?: number | null;
};

export type ProtectedBudgetLine = {
  budget_line: string;
  minimum_usd: number;
  tier: "P0" | "P1" | "P2";
  reason: string;
};

export type AllocationPolicy = {
  schema: "blueprint/dynamic-budget-allocation-policy/v1";
  budget_cap_usd: number;
  paperclip_declared_subcap_usd: number;
  openai_api_target_usd: number;
  openai_api_requires_approval_artifact: boolean;
  openai_api_approval_artifact?: string | null;
  max_single_move_usd: number;
  minimum_confidence: number;
  high_performance_score: number;
  low_performance_score: number;
  allocation_grade_proof_levels: AllocationProofLevel[];
  protected_lines: ProtectedBudgetLine[];
  budget_lines: BudgetLinePolicy[];
  human_approval_required_for: string[];
};

export type SpendSnapshotLike = {
  schema?: string;
  generated_at?: string;
  mode?: {
    live_read_enabled?: boolean;
    live_mutation_attempted?: boolean;
  };
  totals?: {
    target_usd?: number;
    live_billing_verified_usd?: number;
    missing_or_unverified_target_usd?: number;
  };
  sources?: Array<{
    id: string;
    budget_line?: string;
    target_usd?: number | null;
    proof_level?: string;
    status?: string;
    live_mutation_attempted?: boolean;
  }>;
};

export type OutcomeSignal = {
  channel_id: string;
  budget_line: string;
  source_id: string;
  proof_level: AllocationProofLevel;
  proof_status: ProofStatus;
  can_affect_allocation: boolean;
  observed_at?: string | null;
  stale_after_hours?: number | null;
  confidence: number;
  score: number;
  evidence_refs: string[];
  metrics: Record<string, number | string | boolean | null>;
  missing_inputs?: string[] | null;
};

export type OutcomeSnapshot = {
  schema: "blueprint/autonomous-outcome-snapshot/v1";
  generated_at: string;
  registry_path?: string;
  mode: {
    default_local_only: boolean;
    live_read_enabled: boolean;
    live_mutation_attempted: boolean;
  };
  outcomes: OutcomeSignal[];
};

export type BudgetRecommendation = {
  id: string;
  action: "reallocate" | "hold" | "keep" | "reduce" | "increase" | "no_reallocation";
  reason_code: string;
  from_budget_line: string | null;
  to_budget_line: string | null;
  amount_usd: number;
  approval_required: boolean;
  human_gate: string | null;
  proof_level: AllocationProofLevel;
  confidence: number;
  evidence_refs: string[];
  missing_proof: string[];
  advisory_only: boolean;
  live_mutation_attempted: false;
  summary: string;
};

export type BudgetRecommendations = {
  schema: "blueprint/dynamic-budget-recommendations/v1";
  generated_at: string;
  mode: {
    default_local_only: true;
    live_read_enabled: boolean;
    live_mutation_attempted: false;
    repo_local_diff_only: true;
  };
  budget_cap_usd: number;
  projected_target_total_usd: number;
  current_budget_lines: Record<string, number>;
  projected_budget_lines: Record<string, number>;
  recommendations: BudgetRecommendation[];
  human_approval_required: boolean;
  live_proof_gaps: string[];
};

export type DynamicBudgetVerification = {
  schema: "blueprint/dynamic-budget-allocator-verification/v1";
  generated_at: string;
  pass: boolean;
  errors: string[];
  warnings: string[];
};

type BuildInput = {
  policy: AllocationPolicy;
  spendSnapshot: SpendSnapshotLike;
  outcomeSnapshot: OutcomeSnapshot;
  budgetSummary?: unknown;
};

type VerifyInput = {
  recommendations: BudgetRecommendations;
  policy: AllocationPolicy;
};

const OPENAI_API_LINE = "OpenAI API costs (approval-only guardrail)";
const PAPERCLIP_LINE = "Paperclip agent/runtime envelope";
const SPEND_AFFECTING_ACTIONS = new Set<BudgetRecommendation["action"]>([
  "reallocate",
  "increase",
  "reduce",
]);

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

function targetMap(policy: AllocationPolicy) {
  return Object.fromEntries(
    policy.budget_lines.map((line) => [line.budget_line, roundUsd(line.target_usd)]),
  );
}

function protectedMinimums(policy: AllocationPolicy) {
  const minimums = new Map<string, number>();
  for (const line of policy.budget_lines) {
    minimums.set(line.budget_line, finiteNumber(line.minimum_usd, 0));
  }
  for (const line of policy.protected_lines) {
    minimums.set(line.budget_line, Math.max(minimums.get(line.budget_line) ?? 0, line.minimum_usd));
  }
  return minimums;
}

function lineForBudget(policy: AllocationPolicy, budgetLine: string) {
  return policy.budget_lines.find((line) => line.budget_line === budgetLine) ?? null;
}

function lineForChannel(policy: AllocationPolicy, channelId: string) {
  return policy.budget_lines.find((line) => line.channel_id === channelId) ?? null;
}

function isFresh(signal: OutcomeSignal) {
  return signal.proof_status === "current";
}

function hasAllocationGradeProof(policy: AllocationPolicy, signal: OutcomeSignal) {
  return policy.allocation_grade_proof_levels.includes(signal.proof_level);
}

function isEligibleIncrease(policy: AllocationPolicy, signal: OutcomeSignal) {
  if (!signal.can_affect_allocation || !isFresh(signal)) {
    return false;
  }
  if (!hasAllocationGradeProof(policy, signal)) {
    return false;
  }
  if (signal.evidence_refs.length === 0) {
    return false;
  }
  if (signal.confidence < policy.minimum_confidence) {
    return false;
  }
  if (signal.score < policy.high_performance_score) {
    return false;
  }
  if (signal.budget_line === OPENAI_API_LINE && policy.openai_api_requires_approval_artifact && !policy.openai_api_approval_artifact) {
    return false;
  }
  return true;
}

function isLowProofOrLowPerformance(signal: OutcomeSignal | null, policy: AllocationPolicy) {
  if (!signal) {
    return true;
  }
  if (signal.proof_status !== "current") {
    return true;
  }
  if (!hasAllocationGradeProof(policy, signal)) {
    return true;
  }
  if (signal.evidence_refs.length === 0) {
    return true;
  }
  return signal.score <= policy.low_performance_score;
}

function findOutcomeForLine(snapshot: OutcomeSnapshot, budgetLine: string) {
  return snapshot.outcomes.find((signal) => signal.budget_line === budgetLine) ?? null;
}

function findReduceCandidate(
  policy: AllocationPolicy,
  snapshot: OutcomeSnapshot,
  targetBudgetLine: string,
) {
  const minimums = protectedMinimums(policy);
  return policy.budget_lines
    .filter((line) => line.budget_line !== targetBudgetLine)
    .filter((line) => line.budget_line !== OPENAI_API_LINE)
    .filter((line) => line.tier !== "P0")
    .map((line) => {
      const target = finiteNumber(line.target_usd);
      const minimum = minimums.get(line.budget_line) ?? 0;
      const available = roundUsd(Math.max(0, target - minimum));
      const signal = findOutcomeForLine(snapshot, line.budget_line);
      return {
        line,
        available,
        signal,
        reducible: available > 0 && isLowProofOrLowPerformance(signal, policy),
      };
    })
    .filter((candidate) => candidate.reducible)
    .sort((a, b) => {
      if (Boolean(a.signal) !== Boolean(b.signal)) {
        return a.signal ? -1 : 1;
      }
      const aScore = a.signal?.score ?? -1;
      const bScore = b.signal?.score ?? -1;
      if (aScore !== bScore) {
        return aScore - bScore;
      }
      return b.available - a.available;
    })[0] ?? null;
}

function noReallocationRecommendation(missingProof: string[]): BudgetRecommendation {
  return {
    id: "no_reallocation_improve_proof_first",
    action: "no_reallocation",
    reason_code: "improve_proof_first",
    from_budget_line: null,
    to_budget_line: null,
    amount_usd: 0,
    approval_required: false,
    human_gate: null,
    proof_level: "missing",
    confidence: 0,
    evidence_refs: [],
    missing_proof: missingProof.length > 0 ? missingProof : ["fresh allocation-grade outcome evidence"],
    advisory_only: true,
    live_mutation_attempted: false,
    summary: "No reallocation recommended. Improve proof first rather than inventing performance.",
  };
}

function buildMissingProof(policy: AllocationPolicy, snapshot: OutcomeSnapshot) {
  const reasons = new Set<string>();
  if (snapshot.mode.live_mutation_attempted) {
    reasons.add("no live mutation flags");
  }
  if (!snapshot.outcomes.some((signal) => isEligibleIncrease(policy, signal))) {
    reasons.add("fresh allocation-grade outcome evidence");
  }
  if (!snapshot.outcomes.some((signal) => signal.evidence_refs.length > 0)) {
    reasons.add("evidence refs");
  }
  if (snapshot.outcomes.some((signal) => signal.proof_status === "stale")) {
    reasons.add("fresh allocation-grade outcome evidence");
  }
  return [...reasons];
}

export function buildBudgetRecommendations(input: BuildInput): BudgetRecommendations {
  const currentTargets = targetMap(input.policy);
  const projectedTargets = { ...currentTargets };
  const recommendations: BudgetRecommendation[] = [];
  const eligibleIncreases = input.outcomeSnapshot.outcomes
    .filter((signal) => isEligibleIncrease(input.policy, signal))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  for (const signal of eligibleIncreases) {
    const targetLine = lineForBudget(input.policy, signal.budget_line) ?? lineForChannel(input.policy, signal.channel_id);
    if (!targetLine || targetLine.budget_line === OPENAI_API_LINE) {
      continue;
    }
    const reduceCandidate = findReduceCandidate(input.policy, input.outcomeSnapshot, targetLine.budget_line);
    if (!reduceCandidate) {
      continue;
    }
    const amount = roundUsd(Math.min(input.policy.max_single_move_usd, reduceCandidate.available));
    if (amount <= 0) {
      continue;
    }
    projectedTargets[reduceCandidate.line.budget_line] = roundUsd(
      projectedTargets[reduceCandidate.line.budget_line] - amount,
    );
    projectedTargets[targetLine.budget_line] = roundUsd(
      (projectedTargets[targetLine.budget_line] ?? targetLine.target_usd) + amount,
    );
    recommendations.push({
      id: `move_${amount.toFixed(0)}_${slugifyLine(reduceCandidate.line.budget_line)}_to_${slugifyLine(targetLine.budget_line)}`,
      action: "reallocate",
      reason_code: "allocation_grade_signal",
      from_budget_line: reduceCandidate.line.budget_line,
      to_budget_line: targetLine.budget_line,
      amount_usd: amount,
      approval_required: true,
      human_gate: "budget_vendor_or_live_spend_change",
      proof_level: signal.proof_level,
      confidence: signal.confidence,
      evidence_refs: signal.evidence_refs,
      missing_proof: [],
      advisory_only: false,
      live_mutation_attempted: false,
      summary: `Recommend moving $${amount.toFixed(2)} from ${reduceCandidate.line.budget_line} to ${targetLine.budget_line} based on current ${signal.source_id} evidence.`,
    });
    break;
  }

  if (recommendations.length === 0) {
    recommendations.push(noReallocationRecommendation(buildMissingProof(input.policy, input.outcomeSnapshot)));
  }

  const projectedTotal = roundUsd(
    Object.values(projectedTargets).reduce((sum, value) => sum + finiteNumber(value), 0),
  );

  return {
    schema: "blueprint/dynamic-budget-recommendations/v1",
    generated_at: new Date().toISOString(),
    mode: {
      default_local_only: true,
      live_read_enabled: Boolean(input.spendSnapshot.mode?.live_read_enabled || input.outcomeSnapshot.mode.live_read_enabled),
      live_mutation_attempted: false,
      repo_local_diff_only: true,
    },
    budget_cap_usd: input.policy.budget_cap_usd,
    projected_target_total_usd: projectedTotal,
    current_budget_lines: currentTargets,
    projected_budget_lines: projectedTargets,
    recommendations,
    human_approval_required: recommendations.some((entry) => entry.approval_required),
    live_proof_gaps: buildLiveProofGaps(input.spendSnapshot, input.outcomeSnapshot),
  };
}

function buildLiveProofGaps(spendSnapshot: SpendSnapshotLike, outcomeSnapshot: OutcomeSnapshot) {
  const gaps = new Set<string>();
  if ((spendSnapshot.totals?.live_billing_verified_usd ?? 0) === 0) {
    gaps.add("live billing or owner-system export proof for actual spend");
  }
  for (const signal of outcomeSnapshot.outcomes) {
    if (signal.proof_level === "missing" || signal.proof_status === "missing") {
      gaps.add(`${signal.source_id}: missing outcome proof`);
    }
    if (signal.proof_status === "stale") {
      gaps.add(`${signal.source_id}: stale outcome proof`);
    }
    if (signal.proof_level === "repo-local-config" || signal.proof_level === "fixture") {
      gaps.add(`${signal.source_id}: proof is advisory only`);
    }
  }
  return [...gaps];
}

function slugifyLine(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function verifyDynamicBudgetAllocation(input: VerifyInput): DynamicBudgetVerification {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { recommendations, policy } = input;
  const protectedMinimum = protectedMinimums(policy);
  const projectedTotal = roundUsd(
    Object.values(recommendations.projected_budget_lines).reduce((sum, value) => sum + finiteNumber(value), 0),
  );
  const paperclipTarget = recommendations.projected_budget_lines[PAPERCLIP_LINE] ?? 0;
  const openAiTarget = recommendations.projected_budget_lines[OPENAI_API_LINE] ?? 0;

  if (recommendations.schema !== "blueprint/dynamic-budget-recommendations/v1") {
    errors.push("recommendations schema mismatch");
  }
  if (projectedTotal > policy.budget_cap_usd) {
    errors.push(`projected target total $${projectedTotal.toFixed(2)} exceeds $${policy.budget_cap_usd.toFixed(2)} cap`);
  }
  if (recommendations.projected_target_total_usd > policy.budget_cap_usd) {
    errors.push("reported projected target total exceeds budget cap");
  }
  if (paperclipTarget > policy.paperclip_declared_subcap_usd) {
    errors.push("Paperclip declared budget exceeds configured subcap");
  }
  if (openAiTarget > 0 && policy.openai_api_requires_approval_artifact && !policy.openai_api_approval_artifact) {
    errors.push("OpenAI API target is nonzero without explicit approval artifact");
  }
  if (recommendations.mode.live_mutation_attempted) {
    errors.push("live mutation flag must remain false");
  }

  for (const line of policy.budget_lines) {
    const projected = recommendations.projected_budget_lines[line.budget_line];
    const minimum = protectedMinimum.get(line.budget_line) ?? 0;
    if (projected !== undefined && projected < minimum) {
      errors.push(`${line.budget_line} projected target $${projected.toFixed(2)} is below protected minimum $${minimum.toFixed(2)}`);
    }
  }

  for (const recommendation of recommendations.recommendations) {
    if (recommendation.live_mutation_attempted) {
      errors.push(`${recommendation.id} attempted live mutation`);
    }
    if (SPEND_AFFECTING_ACTIONS.has(recommendation.action)) {
      if (recommendation.evidence_refs.length === 0) {
        errors.push(`${recommendation.id} lacks evidence refs`);
      }
      if (!recommendation.approval_required) {
        errors.push(`${recommendation.id} bypasses human approval for paid/live spend`);
      }
      if (recommendation.proof_level === "fixture") {
        errors.push(`${recommendation.id} fixture proof cannot justify spend-affecting recommendations`);
      }
      if (recommendation.proof_level === "repo-local-config") {
        errors.push(`${recommendation.id} repo-local config proof cannot be treated as performance proof`);
      }
    }
  }

  if (!recommendations.recommendations.some((entry) => entry.action !== "no_reallocation")) {
    warnings.push("No reallocation emitted; proof improvement is the next action.");
  }

  return {
    schema: "blueprint/dynamic-budget-allocator-verification/v1",
    generated_at: new Date().toISOString(),
    pass: errors.length === 0,
    errors,
    warnings,
  };
}
