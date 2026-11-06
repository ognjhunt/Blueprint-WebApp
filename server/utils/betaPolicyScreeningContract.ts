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
import type { JobScreeningOutcome } from "../../client/src/types/jobMarketplace";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const count = z.number().int().min(0).max(1_000_000);
const dollars = z.string().max(32).regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/);
export const screeningMoneyMicros = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
};
/** The beta-screening site ledger's standing allowance, shared across a site's campaigns. */
export const SCREENING_SITE_LIMIT_USD = 30;
export const screeningTerminalCandidateStates = new Set(["completed", "blocked", "unavailable", "deferred", "infeasible"]);
/**
 * `waitlisted`: runnable, waiting for site budget a funded candidate may
 * release before spend. Not terminal: the Pipeline funds it (`pending`) or,
 * once nothing at the site can release money, closes it as `deferred`.
 */
export const screeningQueuedCandidateStates = new Set(["pending", "waitlisted"]);
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
  status: z.enum(["pending", "waitlisted", "preparing", "launching", "running", "reconciliation_required", "completed", "blocked", "unavailable", "deferred", "infeasible"]),
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

/**
 * Each completed candidate's practice runs (its episodes, in plan order) with
 * their outcome and the review videos the Pipeline kept of them, so the job's
 * owner can watch them (`screeningPracticeRunVideos`). Kept media, never a
 * score: absent when nothing was kept, and never a reason code, path or URL.
 */
export const SCREENING_REVIEW_VIDEO_MAX_BYTES = 64 * 1024 * 1024;
export const SCREENING_REVIEW_VIDEOS_PER_CANDIDATE = 80;
const reviewVideo = z.object({
  sha256: digest, camera: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), phase: z.enum(["run", "setup_check"]),
  size_bytes: z.number().int().min(1).max(SCREENING_REVIEW_VIDEO_MAX_BYTES),
  duration_seconds: z.number().finite().min(0).max(86_400).nullable(),
}).strict();
const candidateReviewVideos = z.object({
  candidate_id: identifier, manifest_digest: digest,
  practice_runs: z.array(z.object({ cell_id: identifier, outcome: z.enum(["success", "failure", "void"]),
    videos: z.array(reviewVideo).max(SCREENING_REVIEW_VIDEOS_PER_CANDIDATE) }).strict()).min(1).max(100),
}).strict();
export type ScreeningReviewVideos = z.infer<typeof candidateReviewVideos>;

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
  // Every candidate the campaign's plan lists. A website campaign the Pipeline plans from
  // 2026-11-05 (P-DT-12) lists only those that can run on a website job; one planned earlier,
  // and its re-plans, list every catalog row. Both are accepted. A campaign's rows are part of
  // its identity (`screeningCampaignIdentity`), so no revision adds or drops one.
  candidates: z.array(candidate).min(1).max(256),
  budget: z.object({ currency: z.literal("USD"), limit_usd: dollars, committed_upper_bound_usd: dollars,
    spent_upper_bound_usd: dollars, reserved_usd: dollars }).strict(),
  generated_at: z.string().datetime({ offset: true }), publication_digest: digest,
};
const jobEvaluationPublication = z.object({ ...publicationFields, schema_version: z.literal("beta_policy_screening_publication.v2"),
  purpose: z.literal("job_evaluation"), claim_ceiling: z.literal("simulation_estimate"),
  review_videos: z.array(candidateReviewVideos).min(1).max(256).optional() }).strict();
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
  if (limit > BigInt(SCREENING_SITE_LIMIT_USD * 1_000_000) || screeningMoneyMicros(budget.spent_upper_bound_usd) + screeningMoneyMicros(budget.reserved_usd) !== committed
    || committed > limit) ctx.addIssue({ code: "custom", path: ["budget"], message: `Screening must retain the shared $${SCREENING_SITE_LIMIT_USD} site ceiling` });
  if (new Set(value.candidates.map(row => row.candidate_id)).size !== value.candidates.length)
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Candidate identities must be unique" });
  const states = new Set<string>(value.candidates.map(row => row.status));
  const expectedStatus = states.has("reconciliation_required") ? "reconciliation_required"
    : ["preparing", "launching", "running"].some(state => states.has(state)) ? "running"
      : [...screeningQueuedCandidateStates].some(state => states.has(state)) ? "queued" : states.has("completed") ? "completed" : "blocked";
  if (value.status !== expectedStatus)
    ctx.addIssue({ code: "custom", path: ["status"], message: "Campaign status must match candidate progress" });
  // A completed candidate's practice runs restate its own counts: one per planned episode.
  const rows = new Map(value.candidates.map(row => [row.candidate_id, row]));
  const seen = new Set<string>();
  for (const entry of screeningReviewVideos(value)) {
    const row = rows.get(entry.candidate_id), runs = entry.practice_runs;
    const count = (outcome: string) => runs.filter(run => run.outcome === outcome).length;
    if (!row || row.status !== "completed" || seen.has(entry.candidate_id) || runs.length !== row.episodes_planned
      || count("success") !== row.episodes_succeeded || count("failure") !== row.episodes_failed || count("void") !== row.episodes_void
      || new Set(runs.map(run => run.cell_id)).size !== runs.length || runs.every(run => run.videos.length === 0)
      || runs.reduce((sum, run) => sum + run.videos.length, 0) > SCREENING_REVIEW_VIDEOS_PER_CANDIDATE)
      ctx.addIssue({ code: "custom", path: ["review_videos"], message: "Practice-run videos must restate a completed candidate's episodes" });
    seen.add(entry.candidate_id);
  }
});
/** The practice-run videos a publication carries; none for a retained v1 one. */
export function screeningReviewVideos(value: { schema_version: string; review_videos?: ScreeningReviewVideos[] }) {
  return value.schema_version === "beta_policy_screening_publication.v2" ? value.review_videos ?? [] : [];
}
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
/** Refusals that wait for something we have to build: wrong task kind, switched off, or no admitted license. */
const HELD_BLOCKERS = new Set(["task_kind_not_supported_by_candidate", "candidate_disabled", "commercial_use_not_admitted"]);
/**
 * A catalog row never selected because nothing is prepared for it yet (no
 * policy registration or runtime binding, e.g. rows listed before their first
 * registration) is also something we have to build. A selected candidate that
 * later failed is never held: that is ours to fix and rerun.
 */
const UNPREPARED_BLOCKERS = new Set(["prepared_robot_policy_registration_missing", "runtime_candidate_binding_missing"]);
/** Rows the Pipeline closed when it planned them again in a newer run after a deploy. */
export const SCREENING_REPLANNED_BLOCKER = "beta_screening_replanned_for_new_implementation";
/**
 * Rows preparation refused because a deploy changed the code they were planned
 * at. The Pipeline plans them again by itself (`replan_scope`), so a run they
 * ended is still in progress, never held.
 */
export const SCREENING_COMMIT_CHANGED_BLOCKER = "beta_screening_implementation_commit_changed";
export const screeningReplanPending = (candidates: ReadonlyArray<{ status: string; blockers: readonly string[] }>) =>
  candidates.some(row => row.status === "blocked" && row.blockers.includes(SCREENING_COMMIT_CHANGED_BLOCKER));
/** Held only because candidates that could take the job are not prepared in the simulator yet. */
export const screeningHeldForPreparation = (candidates: ReadonlyArray<{ status: string; blockers: readonly string[] }>) =>
  candidates.some(row => row.status === "unavailable" && row.blockers.some(code => UNPREPARED_BLOCKERS.has(code)));
const heldRow = (row: { status: string; blockers: readonly string[] }) => row.blockers.length > 0
  && row.blockers.every(code => HELD_BLOCKERS.has(code) || row.status === "unavailable" && UNPREPARED_BLOCKERS.has(code));

/**
 * The Pipeline defers a candidate the website job's one dollar ceiling (all of
 * the job's ledgers together) cannot cover (Pipeline `JOB_CEILING_DEFERRED`).
 */
export const SCREENING_JOB_CEILING_BLOCKER = "website_job_ceiling_insufficient";
const jobCeilingCode = (code: string) => code.split(":")[0] === SCREENING_JOB_CEILING_BLOCKER;
const budgetCode = (code: string) => code.includes("budget") || jobCeilingCode(code);
/** A candidate the job's dollar ceiling held back. */
export const screeningJobCeilingRow = (row: { blockers: readonly string[] }) => row.blockers.some(jobCeilingCode);

/**
 * `budget` needs money actually committed at the site: a candidate deferred
 * for budget while nothing was spent was left unfunded because funded ones
 * failed before spend, which is ours to fix, not an owner approval. The job's
 * dollar ceiling is the exception: with too little of it left, the Pipeline
 * defers every runnable candidate before any screening spend, and only the
 * owner can raise it. That stays `budget` unless a candidate also failed for
 * a reason that is ours to fix.
 */
export function noEstimateReason(candidates: ReadonlyArray<{ status: string; blockers: readonly string[] }>,
  budget: { spent_upper_bound_usd: string }): NoEstimateReason {
  const open = candidates.filter(row => row.status !== "completed");
  const spent = dollars.safeParse(budget.spent_upper_bound_usd).success && screeningMoneyMicros(budget.spent_upper_bound_usd) > BigInt(0);
  if (spent && open.some(row => row.blockers.some(budgetCode))) return "budget";
  // A completed candidate with only void episodes is a broken scene, not a capability gap.
  const infeasible = (row: { status: string; blockers: readonly string[] }) => screeningCandidateState(row) === "infeasible";
  if (open.length > 0 && open.length === candidates.length && open.some(screeningJobCeilingRow)
      && open.every(row => screeningJobCeilingRow(row) || infeasible(row) || heldRow(row)))
    return "budget";
  if (open.length === 0 || open.length !== candidates.length
      || !open.every(row => infeasible(row) || heldRow(row)))
    return "setup";
  return open.every(infeasible) ? "infeasible" : open.some(infeasible) ? "no_match" : "held";
}

/**
 * What a run means for the site, in one word (F-03). The job page headline,
 * the run's summary and the result email all say the same sentence for it.
 * `estimate`: a scored row that is not a scripted reference baseline (rows
 * with no recorded execution kind count, as they always have).
 * `reference_only`: only scripted reference baselines were scored, so no
 * learned policy was evaluated and there is no estimate. `held_*`,
 * `infeasible`, `no_match`: no candidate could run the job, by reason.
 * `held_setup`: the run ended on a failure on our side (an infrastructure
 * refusal, a run that timed out or returned no usable result, every candidate
 * blocked). It is rerun once the cause is fixed: the Pipeline plans a run our
 * harness failed again by itself after the fix deploys (a bounded number of
 * times), and anything else is rerun by us. `held_budget`: the site's
 * simulation allowance was spent before an estimate; nothing reserves more.
 * `held_scene_check`: the scene failed its robot-free check, so no campaign
 * could start (a Pipeline hold, `betaPolicyScreeningHold`). Each is final for
 * the run and told once; a later run that gives a result replaces it.
 * `setup_repair`: ended only on rows the Pipeline plans again after a deploy,
 * so still in progress. `awaiting_spend_approval`: only the job's dollar
 * ceiling held candidates back; it waits on Blueprint's money decision and is
 * never emailed. `superseded`: planned again in a newer
 * run. A run still queued or running has no outcome yet (null).
 */
export const SCREENING_OUTCOMES = ["estimate", "reference_only", "held_capability", "held_unprepared", "infeasible", "no_match",
  "held_setup", "held_budget", "held_scene_check", "awaiting_spend_approval", "setup_repair", "superseded"] as const satisfies readonly JobScreeningOutcome[];
export type ScreeningOutcome = JobScreeningOutcome;
/** Outcomes that leave the job with no estimate until we build, prepare or fix something. */
export type ScreeningHeldOutcome = Extract<ScreeningOutcome, "reference_only" | "held_capability" | "held_unprepared" | "infeasible"
  | "no_match" | "held_setup" | "held_budget" | "held_scene_check">;
const HELD_OUTCOMES = new Set<string>(["reference_only", "held_capability", "held_unprepared", "infeasible", "no_match",
  "held_setup", "held_budget", "held_scene_check"]);
/** Holds that are ours to look at (a failure, a spent allowance, a scene check), not demand for a new capability. */
export const SCREENING_ATTENTION_OUTCOMES = ["held_setup", "held_budget", "held_scene_check"] as const;
export const isScreeningAttentionOutcome = (value: unknown): value is typeof SCREENING_ATTENTION_OUTCOMES[number] =>
  (SCREENING_ATTENTION_OUTCOMES as readonly unknown[]).includes(value);
export const isScreeningHeldOutcome = (value: unknown): value is ScreeningHeldOutcome => typeof value === "string" && HELD_OUTCOMES.has(value);
/** A stored outcome, or null for anything this version does not know. */
export const storedScreeningOutcome = (value: unknown): ScreeningOutcome | null =>
  (SCREENING_OUTCOMES as readonly unknown[]).includes(value) ? value as ScreeningOutcome : null;

const scriptedBaseline = (row: { execution_evidence_kind?: string }) => row.execution_evidence_kind === "scripted_simulator_state_baseline";
/** Rows an estimate can rest on: scored, and not a scripted reference baseline. */
export const screeningEstimateRows = <Row extends { episodes_scored: number; execution_evidence_kind?: string }>(candidates: readonly Row[]) =>
  candidates.filter(row => row.episodes_scored > 0 && !scriptedBaseline(row));

/**
 * Every money refusal among the open rows is the job's dollar ceiling: a
 * Blueprint money decision the owner can raise, so the run waits on Blueprint
 * (no email to the site; the ops monitor reports it). A spent site allowance
 * is final.
 */
export function screeningJobCeilingWait(candidates: ReadonlyArray<{ status: string; blockers: readonly string[] }>): boolean {
  const money = candidates.filter(row => row.status !== "completed" && row.blockers.some(budgetCode));
  return money.length > 0 && money.every(screeningJobCeilingRow);
}

export function screeningOutcome(publication: Pick<BetaPolicyScreeningPublication, "status" | "candidates" | "budget">): ScreeningOutcome | null {
  const scored = publication.candidates.reduce((sum, row) => sum + row.episodes_scored, 0);
  // A run whose candidates finished with no scored episode has no estimate to show.
  const finished = publication.status === "completed" && scored === 0 ? "blocked" : publication.status;
  if (finished !== "completed" && finished !== "blocked") return null;
  // Rows planned again in a newer run after a deploy: with nothing scored here,
  // the newer run is the one to read (owner decision 2026-10-31).
  if (scored === 0 && publication.candidates.some(row => row.blockers.includes(SCREENING_REPLANNED_BLOCKER))) return "superseded";
  if (finished === "completed") return screeningEstimateRows(publication.candidates).length ? "estimate" : "reference_only";
  // A finished run is final: nothing reruns a blocked campaign or reserves more
  // than the site's allowance, so a budget or setup end is held by name. Two
  // ends stay open: rows the Pipeline plans again after a deploy, and rows only
  // the job's dollar ceiling held back, which the owner can raise.
  const reason = noEstimateReason(publication.candidates, publication.budget);
  return reason === "budget" ? screeningJobCeilingWait(publication.candidates) ? "awaiting_spend_approval" : "held_budget"
    : reason === "setup" ? screeningReplanPending(publication.candidates) ? "setup_repair" : "held_setup"
    : reason === "held" ? screeningHeldForPreparation(publication.candidates) ? "held_unprepared" : "held_capability" : reason;
}

/**
 * The one plain sentence for each outcome. Measured reasons are relative to
 * the robot position the scene planned, never a task-level verdict (owner
 * decision 2026-10-31); "No match" is said plainly (owner decision 2026-10-30).
 * A hold that is ours to look at says what happened, that it does not restart
 * by itself, and what the site hears next.
 */
const IN_PROGRESS_SENTENCE = "Simulation evaluation in progress. We'll run your job again and show the estimate here.";
const ATTENTION_NEXT = "It won't restart by itself. Our team has been told, and we'll email you if a later run gives a result.";
/** A failure on our side is rerun after its fix (the Pipeline replans harness failures once the fix deploys). */
const SETUP_NEXT = "Our team has been told. We'll run it again once the cause is fixed, and email you if a later run gives a result.";
const SCREENING_OUTCOME_SENTENCE: Readonly<Record<ScreeningOutcome, string>> = {
  estimate: "Your simulation estimate is ready. It is an estimate from a simulation of your site, not a certified result.",
  reference_only: "No estimate yet: only scripted reference baselines were scored, and no learned policy could be evaluated on your job yet.",
  held_capability: "Held: we can't simulate this kind of job yet. It counts as demand for what we build next.",
  held_unprepared: "Held: the robots that could do this job aren't set up in our simulator yet. It counts as demand for what we build next.",
  infeasible: "Held: from the robot position planned in the scene built from your video, none of the robots we can simulate could reach this task.",
  no_match: "No match: none of the robots we can simulate matched this job. At least one was measured out of reach from the robot position planned in the scene built from your video.",
  held_setup: `Held: a problem on our side stopped the simulation of your job before it gave an estimate. ${SETUP_NEXT}`,
  held_budget: `Held: your job reached the most the free beta can simulate for one job before it gave an estimate. ${ATTENTION_NEXT}`,
  held_scene_check: `Held: the simulation built from your video failed the check we run before testing robots, so no robot was tested on your job. ${ATTENTION_NEXT}`,
  awaiting_spend_approval: "Your job's simulation is waiting on an approval inside Blueprint before it can continue.",
  setup_repair: IN_PROGRESS_SENTENCE,
  superseded: "Continued in a newer run after a Blueprint update.",
};
export const screeningOutcomeSentence = (outcome: ScreeningOutcome) => SCREENING_OUTCOME_SENTENCE[outcome];
/** How much of the job an estimate covers, said the same way on the page and in the email. */
export const screeningEstimateCountSentence = (ran: number, total: number, scored: number) =>
  `In the simulation, ${ran} of ${total} candidates ran, with ${scored} episodes scored against the job's success criteria.`;
/** Outcomes the site is told by email once (F-01): an estimate, or why there is none. Never one still in progress. */
export const isScreeningResultOutcome = (value: unknown): value is "estimate" | ScreeningHeldOutcome =>
  value === "estimate" || isScreeningHeldOutcome(value);

export function parseBetaPolicyScreeningPublication(value: unknown): BetaPolicyScreeningPublication | null {
  const parsed = betaPolicyScreeningPublicationSchema.safeParse(value);
  if (!parsed.success || crossRuntimeArtifactDigest(parsed.data, "publication_digest") !== parsed.data.publication_digest) return null;
  return parsed.data;
}

/**
 * What a campaign is: its plan, source and candidates. The budget is the site's shared snapshot,
 * never part of it: the site limit is Blueprint's own control and was raised for every site at once
 * (2026-11-05, $15 to $30), after which every earlier campaign's next snapshot was refused here and
 * its later revisions (finished runs' practice videos among them) never reached the site. The parser
 * still bounds the limit and what is committed against it.
 */
export function screeningCampaignIdentity(value: BetaPolicyScreeningPublication) {
  return crossRuntimeDigest({ campaign_id: value.campaign_id, site_id: value.site_id, source: value.source,
    plan_digest: value.plan_digest, catalog_digest: value.catalog_digest, scenario_plan_digest: value.scenario_plan_digest,
    candidates: value.candidates.map(row => ({ candidate_id: row.candidate_id, configuration_digest: row.configuration_digest,
      display_name: row.display_name, episodes_planned: row.episodes_planned,
      ...(row.execution_evidence_kind ? { execution_evidence_kind: row.execution_evidence_kind, action_source: row.action_source } : {}) })) });
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
  // Kept videos are media, not evidence: a later revision may add a candidate's, never change or drop one.
  const nextVideos = new Map(screeningReviewVideos(next).map(entry => [entry.candidate_id, crossRuntimeDigest(entry)]));
  if (screeningReviewVideos(previous).some(entry => nextVideos.get(entry.candidate_id) !== crossRuntimeDigest(entry)))
    throw new Error("screening_review_videos_conflict");
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
    // A waitlisted candidate becomes pending when released money funds it;
    // only a pending one can wait for budget again.
    if ((updated.status === "pending" && !screeningQueuedCandidateStates.has(row.status))
      || (updated.status === "waitlisted" && !screeningQueuedCandidateStates.has(row.status))
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
