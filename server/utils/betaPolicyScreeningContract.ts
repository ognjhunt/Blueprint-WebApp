/**
 * The beta job's automatic multi-candidate evaluation; separate from the frozen v4 canary.
 *
 * One tier (owner decision 2026-10-28): the run under the site's allowance is
 * the job's evaluation, published as a bounded simulation estimate. v1 rows
 * were labelled diagnostic-only before that decision; they stay readable and
 * are shown the same way. Neither version is physical or ADP evidence.
 */
import { z } from "zod";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const count = z.number().int().min(0).max(1_000_000);
const dollars = z.string().max(32).regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/);
export const screeningMoneyMicros = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
};
export const screeningTerminalCandidateStates = new Set(["completed", "blocked", "unavailable", "deferred", "infeasible"]);
/**
 * `infeasible` is measured out of reach on the reconstructed site. Until the
 * Pipeline publishes it natively it sends `unavailable` with this blocker;
 * both read as infeasible.
 */
export const SCREENING_INFEASIBLE_BLOCKER = "candidate_infeasible_measured_geometry";
export const screeningCandidateState = (row: { status: string; blockers: readonly string[] }) =>
  row.status === "unavailable" && row.blockers.includes(SCREENING_INFEASIBLE_BLOCKER) ? "infeasible" : row.status;
export const screeningExecutionEvidenceFields = ["execution_evidence_kind", "action_source", "scripted_rollout_count",
  "learned_policy_rollout_count", "scripted_controller_invoked", "candidate_policy_queried"] as const;

const candidate = z.object({
  candidate_id: identifier, configuration_digest: digest, display_name: z.string().trim().min(1).max(200),
  status: z.enum(["pending", "preparing", "launching", "running", "reconciliation_required", "completed", "blocked", "unavailable", "deferred", "infeasible"]),
  blockers: z.array(z.string().min(1).max(300)).max(100),
  episodes_planned: count, episodes_scored: count, episodes_succeeded: count, episodes_failed: count, episodes_void: count,
  success_rate: z.number().finite().min(0).max(1).nullable(), session_result_digest: digest.nullable(),
  execution_evidence_kind: z.enum(["learned_policy", "scripted_simulator_state_baseline"]).optional(),
  action_source: z.enum(["learned_policy", "scripted_simulator_state"]).optional(),
  scripted_rollout_count: count.optional(), learned_policy_rollout_count: count.optional(),
  scripted_controller_invoked: z.boolean().optional(), candidate_policy_queried: z.boolean().optional(),
}).strict().superRefine((row, ctx) => {
  const expectedRate = row.episodes_scored ? row.episodes_succeeded / row.episodes_scored : null;
  if (row.episodes_succeeded + row.episodes_failed !== row.episodes_scored
    || row.episodes_scored + row.episodes_void > row.episodes_planned || row.success_rate !== expectedRate
    || (row.episodes_scored > 0 && !row.session_result_digest)
    || (row.status === "completed" && (!row.session_result_digest || row.episodes_planned === 0
      || row.episodes_scored + row.episodes_void !== row.episodes_planned))
    || (row.status !== "completed" && (row.episodes_scored !== 0 || row.episodes_void !== 0 || row.session_result_digest !== null))) {
    ctx.addIssue({ code: "custom", message: "Screening counts and independent result evidence disagree" });
  }
  if (screeningExecutionEvidenceFields.some(key => row[key] !== undefined)) {
    const scripted = row.execution_evidence_kind === "scripted_simulator_state_baseline";
    if (screeningExecutionEvidenceFields.some(key => row[key] === undefined)
      || row.action_source !== (scripted ? "scripted_simulator_state" : "learned_policy")
      || row.scripted_rollout_count! + row.learned_policy_rollout_count! > row.episodes_planned
      || row.scripted_controller_invoked === true && row.scripted_rollout_count === 0
      || row.candidate_policy_queried === true && row.learned_policy_rollout_count === 0
      || (row.status !== "completed" && (row.scripted_rollout_count !== 0 || row.learned_policy_rollout_count !== 0
        || row.scripted_controller_invoked !== false || row.candidate_policy_queried !== false))
      || (scripted ? row.learned_policy_rollout_count !== 0 || row.candidate_policy_queried !== false
        || row.episodes_scored > row.scripted_rollout_count! || row.episodes_scored > 0 && row.scripted_controller_invoked !== true
        : row.scripted_rollout_count !== 0 || row.scripted_controller_invoked !== false
          || row.episodes_scored > row.learned_policy_rollout_count! || row.episodes_scored > 0 && row.candidate_policy_queried !== true)) {
      ctx.addIssue({ code: "custom", message: "Screening execution kind and witnessed episode evidence disagree" });
    }
  }
});

export const betaPolicyScreeningSourceSchema = z.object({
  scene_intent_id: identifier, scene_intent_digest: digest, capture_id: identifier,
  task_id: identifier, task_context_digest: digest, scene_revision_digest: digest,
}).strict();

const publicationFields = {
  campaign_id: identifier, site_id: identifier, revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  plan_digest: digest, catalog_digest: digest, scenario_plan_digest: digest,
  source: betaPolicyScreeningSourceSchema,
  status: z.enum(["queued", "running", "completed", "blocked", "reconciliation_required"]),
  execution_operator: z.object({ kind: z.literal("blueprint") }).strict(),
  candidates: z.array(candidate).min(1).max(256),
  budget: z.object({ currency: z.literal("USD"), limit_usd: dollars, committed_upper_bound_usd: dollars,
    spent_upper_bound_usd: dollars, reserved_usd: dollars }).strict(),
  generated_at: z.string().datetime({ offset: true }), publication_digest: digest,
};
const jobEvaluationPublication = z.object({ ...publicationFields, schema_version: z.literal("beta_policy_screening_publication.v2"),
  purpose: z.literal("job_evaluation"), claim_ceiling: z.literal("simulation_estimate") }).strict();
const retainedPublication = z.object({ ...publicationFields, schema_version: z.literal("beta_policy_screening_publication.v1"),
  purpose: z.literal("screening"), claim_ceiling: z.literal("diagnostic_policy_execution"), recommendation_eligible: z.literal(false) }).strict();
export const betaPolicyScreeningPublicationSchema = z.discriminatedUnion("schema_version", [jobEvaluationPublication, retainedPublication])
  .superRefine((value, ctx) => {
  if (value.schema_version === "beta_policy_screening_publication.v1"
    && value.candidates.some(row => screeningExecutionEvidenceFields.some(key => row[key] !== undefined))) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Typed execution evidence requires publication v2" });
  }
  const budget = value.budget;
  if (![budget.limit_usd, budget.committed_upper_bound_usd, budget.spent_upper_bound_usd, budget.reserved_usd]
    .every(amount => dollars.safeParse(amount).success)) return;
  const limit = screeningMoneyMicros(budget.limit_usd), committed = screeningMoneyMicros(budget.committed_upper_bound_usd);
  if (limit > BigInt(15_000_000) || screeningMoneyMicros(budget.spent_upper_bound_usd) + screeningMoneyMicros(budget.reserved_usd) !== committed
    || committed > limit) ctx.addIssue({ code: "custom", path: ["budget"], message: "Screening must retain the shared $15 site ceiling" });
  if (new Set(value.candidates.map(row => row.candidate_id)).size !== value.candidates.length)
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Candidate identities must be unique" });
  const states = new Set<string>(value.candidates.map(row => row.status));
  const expectedStatus = states.has("reconciliation_required") ? "reconciliation_required"
    : ["preparing", "launching", "running"].some(state => states.has(state)) ? "running"
      : states.has("pending") ? "queued" : states.has("completed") ? "completed" : "blocked";
  if (value.status !== expectedStatus)
    ctx.addIssue({ code: "custom", path: ["status"], message: "Campaign status must match candidate progress" });
});
export type BetaPolicyScreeningPublication = z.infer<typeof betaPolicyScreeningPublicationSchema>;
export type ScreeningExecutionEvidence = Required<Pick<BetaPolicyScreeningPublication["candidates"][number],
  typeof screeningExecutionEvidenceFields[number]>>;

/** Missing metadata on retained publications does not establish a policy kind. */
export function screeningExecutionEvidence(row: BetaPolicyScreeningPublication["candidates"][number]): ScreeningExecutionEvidence | undefined {
  return row.execution_evidence_kind ? Object.fromEntries(screeningExecutionEvidenceFields.map(key => [key, row[key]])) as ScreeningExecutionEvidence : undefined;
}

/**
 * Why a finished run has no estimate, by who can fix it (owner decision
 * 2026-10-28). `held`: every candidate is refused for capability or license,
 * so the job waits for something we have to build. `budget`: a candidate
 * needs more than the site's allowance, which only the owner can approve.
 * `setup`: anything else, ours to fix and rerun. `no_match`: no candidate can
 * run it and at least one was measured out of reach in the reconstructed site,
 * so the site is told plainly there is no match (owner decision 2026-10-30).
 * `infeasible`: every candidate was measured out of reach from the robot
 * position the scene planned (the packet's station), so the job is held with
 * that measured reason, never a setup fix (owner decision 2026-10-31). It is
 * station-relative, not a verdict that no robot could do the task anywhere.
 */
export type NoEstimateReason = "held" | "infeasible" | "no_match" | "budget" | "setup";
const HELD_BLOCKERS = new Set(["task_kind_not_supported_by_candidate", "candidate_disabled", "commercial_use_not_admitted"]);

export function noEstimateReason(candidates: ReadonlyArray<{ status: string; blockers: readonly string[] }>): NoEstimateReason {
  const open = candidates.filter(row => row.status !== "completed");
  if (open.some(row => row.blockers.some(code => code.includes("budget")))) return "budget";
  // A completed candidate with only void episodes is a broken scene, not a capability gap.
  const infeasible = (row: { status: string; blockers: readonly string[] }) => screeningCandidateState(row) === "infeasible";
  if (open.length === 0 || open.length !== candidates.length
      || !open.every(row => infeasible(row) || (row.blockers.length > 0 && row.blockers.every(code => HELD_BLOCKERS.has(code)))))
    return "setup";
  return open.every(infeasible) ? "infeasible" : open.some(infeasible) ? "no_match" : "held";
}

export function parseBetaPolicyScreeningPublication(value: unknown): BetaPolicyScreeningPublication | null {
  const parsed = betaPolicyScreeningPublicationSchema.safeParse(value);
  if (!parsed.success || crossRuntimeArtifactDigest(parsed.data, "publication_digest") !== parsed.data.publication_digest) return null;
  return parsed.data;
}

export function screeningCampaignIdentity(value: BetaPolicyScreeningPublication) {
  return crossRuntimeDigest({ campaign_id: value.campaign_id, site_id: value.site_id, source: value.source,
    plan_digest: value.plan_digest, catalog_digest: value.catalog_digest, scenario_plan_digest: value.scenario_plan_digest,
    candidates: value.candidates.map(row => ({ candidate_id: row.candidate_id, configuration_digest: row.configuration_digest,
      display_name: row.display_name, episodes_planned: row.episodes_planned,
      ...(row.execution_evidence_kind ? { execution_evidence_kind: row.execution_evidence_kind, action_source: row.action_source } : {}) })),
    budget_limit: value.budget.limit_usd });
}

/** Retried or delayed deliveries cannot rewrite a campaign or its completed candidate results. */
export function screeningPublicationTransition(previous: BetaPolicyScreeningPublication, next: BetaPolicyScreeningPublication) {
  if (screeningCampaignIdentity(previous) !== screeningCampaignIdentity(next)) throw new Error("screening_campaign_identity_conflict");
  if (previous.publication_digest === next.publication_digest) return "replayed" as const;
  if (next.revision < previous.revision) return "superseded" as const;
  if (next.revision === previous.revision) throw new Error("screening_revision_conflict");
  // Later campaigns at the same site update the shared budget snapshot even
  // after this campaign ends. Its scientific evidence must remain byte-identical.
  if (["completed", "blocked"].includes(previous.status) && (next.status !== previous.status
    || crossRuntimeDigest(previous.candidates) !== crossRuntimeDigest(next.candidates))) throw new Error("screening_revision_conflict");
  if (Date.parse(next.generated_at) < Date.parse(previous.generated_at)
    || screeningMoneyMicros(next.budget.spent_upper_bound_usd) < screeningMoneyMicros(previous.budget.spent_upper_bound_usd))
    throw new Error("screening_progress_regression");
  previous.candidates.forEach((row, index) => {
    const updated = next.candidates[index];
    if (screeningTerminalCandidateStates.has(row.status) && crossRuntimeDigest(row) !== crossRuntimeDigest(updated))
      throw new Error("screening_terminal_candidate_conflict");
    const rank: Record<string, number> = { pending: 0, preparing: 1, launching: 2, running: 3 };
    // Pipeline retains a canonical no-allocation receipt before retrying a
    // busy slot. Waiting for that capacity is preparation, never execution.
    const waitingForCapacity = updated.status === "preparing" && updated.blockers.includes("beta_screening_waiting_for_capacity");
    if ((updated.status === "pending" && row.status !== "pending")
      || (!waitingForCapacity && rank[updated.status] !== undefined && rank[row.status] !== undefined && rank[updated.status] < rank[row.status]))
      throw new Error("screening_progress_regression");
    if (updated.episodes_scored < row.episodes_scored || updated.episodes_void < row.episodes_void)
      throw new Error("screening_progress_regression");
    if ((updated.scripted_rollout_count ?? 0) < (row.scripted_rollout_count ?? 0)
      || (updated.learned_policy_rollout_count ?? 0) < (row.learned_policy_rollout_count ?? 0))
      throw new Error("screening_progress_regression");
  });
  return "updated" as const;
}
