/** Diagnostic multi-candidate screening; deliberately separate from the frozen v4 canary. */
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
export const screeningTerminalCandidateStates = new Set(["completed", "blocked", "unavailable", "deferred"]);

const candidate = z.object({
  candidate_id: identifier, configuration_digest: digest, display_name: z.string().trim().min(1).max(200),
  status: z.enum(["pending", "preparing", "launching", "running", "reconciliation_required", "completed", "blocked", "unavailable", "deferred"]),
  blockers: z.array(z.string().min(1).max(300)).max(100),
  episodes_planned: count, episodes_scored: count, episodes_succeeded: count, episodes_failed: count, episodes_void: count,
  success_rate: z.number().finite().min(0).max(1).nullable(), session_result_digest: digest.nullable(),
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
});

export const betaPolicyScreeningPublicationSchema = z.object({
  schema_version: z.literal("beta_policy_screening_publication.v1"),
  campaign_id: identifier, site_id: identifier, revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  plan_digest: digest, catalog_digest: digest, scenario_plan_digest: digest,
  source: z.object({ scene_intent_id: identifier, scene_intent_digest: digest, capture_id: identifier,
    task_id: identifier, task_context_digest: digest, scene_revision_digest: digest }).strict(),
  status: z.enum(["queued", "running", "completed", "blocked", "reconciliation_required"]),
  purpose: z.literal("screening"), execution_operator: z.object({ kind: z.literal("blueprint") }).strict(),
  claim_ceiling: z.literal("diagnostic_policy_execution"), recommendation_eligible: z.literal(false),
  candidates: z.array(candidate).min(1).max(256),
  budget: z.object({ currency: z.literal("USD"), limit_usd: dollars, committed_upper_bound_usd: dollars,
    spent_upper_bound_usd: dollars, reserved_usd: dollars }).strict(),
  generated_at: z.string().datetime({ offset: true }), publication_digest: digest,
}).strict().superRefine((value, ctx) => {
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

export function parseBetaPolicyScreeningPublication(value: unknown): BetaPolicyScreeningPublication | null {
  const parsed = betaPolicyScreeningPublicationSchema.safeParse(value);
  if (!parsed.success || crossRuntimeArtifactDigest(parsed.data, "publication_digest") !== parsed.data.publication_digest) return null;
  return parsed.data;
}

export function screeningCampaignIdentity(value: BetaPolicyScreeningPublication) {
  return crossRuntimeDigest({ campaign_id: value.campaign_id, site_id: value.site_id, source: value.source,
    plan_digest: value.plan_digest, catalog_digest: value.catalog_digest, scenario_plan_digest: value.scenario_plan_digest,
    candidates: value.candidates.map(row => ({ candidate_id: row.candidate_id, configuration_digest: row.configuration_digest,
      display_name: row.display_name, episodes_planned: row.episodes_planned })), budget_limit: value.budget.limit_usd });
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
  });
  return "updated" as const;
}
