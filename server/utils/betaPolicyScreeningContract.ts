/**
 * The beta job's automatic multi-candidate evaluation; separate from the frozen v4 canary.
 *
 * One tier (owner decision 2026-10-28): the run under the site's allowance is
 * the job's evaluation, published as a bounded simulation estimate. v1 rows
 * were labelled diagnostic-only before that decision; they stay readable and
 * are shown the same way. No version is physical or ADP evidence.
 *
 * v3 is v2 plus the set-up flags the Pipeline's own checks recorded: per
 * candidate the run's observation-quality flags, a humanoid row's spawn and
 * floor flags and the free CPU scene check's flags for that row; per campaign
 * the scene check's verdict. Typed codes only. They never change an outcome;
 * a zero-success estimate they may explain carries a caveat instead
 * (`screeningOutcomeCaveat`). The Pipeline still sends v2 to a release that
 * does not accept v3, so v1 and v2 stay accepted as they were.
 *
 * v4 is v3 plus one optional field on a learned-policy candidate: `progress`, how far its graded
 * episodes got along the pick-and-place ladder (contact, motion, lift, carry, placement), from the
 * Pipeline's own grader. Facts only: nothing ranks, chooses or holds on it. The Pipeline sends v3
 * without it to a release that does not accept v4, so v1 to v3 stay accepted as they were.
 */
import { z } from "zod";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import type { JobScreeningOutcome, JobScreeningProgress, JobScreeningProgressStage } from "../../client/src/types/jobMarketplace";
import { SCREENING_PROGRESS_GRADER_VERSION } from "../../client/src/data/screeningProgressGrader";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const count = z.number().int().min(0).max(1_000_000);
const dollars = z.string().max(32).regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/);
export const screeningMoneyMicros = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
};
/**
 * The beta-screening site allowance before 2026-11-11, shared across a site's campaigns. The Pipeline
 * still publishes this figure for a site whose campaigns were planned before then (its
 * `LEGACY_SITE_LIMIT_USD`), so a publication at or under it is never reported as above a job's limit.
 */
export const SCREENING_LEGACY_SITE_LIMIT_USD = 30;
/**
 * The only budget figure a publication is refused for (owner decision 2026-11-11): a limit above the
 * largest job ceiling there can be, an owner authorization row's maximum (`websiteAtlasAuthorization`,
 * $1000, also the per-reservation bound). No job can be planned above it, so a publication naming more
 * is malformed rather than a job that spent more. Anything at or under it is accepted, whatever its job:
 * refusing a result un-spends nothing and only hides results the job already paid for. Testing reported
 * above a job's safety limit is counted in full and reported (`screeningPublicationAboveSafetyLimit`).
 */
export const SCREENING_PUBLICATION_LIMIT_MAX_USD = 1000;
/** Whether a publication's limit or committed total is above the job's safety limit (or the legacy $30, if larger). */
export function screeningPublicationAboveSafetyLimit(budget: { limit_usd?: string; committed_upper_bound_usd: string },
  safetyLimitUsd: number) {
  const bound = BigInt(Math.floor(Math.max(safetyLimitUsd, SCREENING_LEGACY_SITE_LIMIT_USD) * 1_000_000));
  return budget.limit_usd !== undefined && screeningMoneyMicros(budget.limit_usd) > bound
    || screeningMoneyMicros(budget.committed_upper_bound_usd) > bound;
}
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

export const SCREENING_PUBLICATION_V1 = "beta_policy_screening_publication.v1";
export const SCREENING_PUBLICATION_V2 = "beta_policy_screening_publication.v2";
export const SCREENING_PUBLICATION_V3 = "beta_policy_screening_publication.v3";
export const SCREENING_PUBLICATION_V4 = "beta_policy_screening_publication.v4";
/** Publications that may carry set-up flags and the campaign's scene check verdict. */
const FLAGGED_PUBLICATIONS: ReadonlySet<string> = new Set([SCREENING_PUBLICATION_V3, SCREENING_PUBLICATION_V4]);
/** Publications that may carry practice-run videos. */
const JOB_EVALUATION_PUBLICATIONS: ReadonlySet<string> = new Set([SCREENING_PUBLICATION_V2, SCREENING_PUBLICATION_V3, SCREENING_PUBLICATION_V4]);
/** One typed flag: a lowercase code with at most three typed qualifiers (Pipeline `FLAG_CODE`). Never text. */
const flagCode = z.string().regex(/^[a-z][a-z0-9_]{0,127}(?::[a-z0-9_]{1,96}){0,3}$/);
const SCREENING_FLAGS_MAX = 64;
const sortedUnique = (codes: readonly string[]) => codes.every((code, index) => index === 0 || codes[index - 1] < code);
const flagList = z.array(flagCode).min(1).max(SCREENING_FLAGS_MAX).refine(sortedUnique, "Flags must be sorted and unique");
/** A candidate row's set-up flags (v3 only). Notes about the scene the row ran in, never part of its evidence. */
export const screeningRowFlagFields = ["observation_quality_flags", "setup_quality_flags", "scene_check_flags"] as const;
const sceneFeasibility = z.object({ status: z.enum(["clear", "flagged", "unknown"]),
  flags: z.array(flagCode).max(SCREENING_FLAGS_MAX).refine(sortedUnique, "Flags must be sorted and unique") }).strict()
  .refine(value => (value.status === "flagged") === (value.flags.length > 0), "Only a flagged scene check names flags");
export type ScreeningSceneFeasibility = z.infer<typeof sceneFeasibility>;

/**
 * How far a candidate's graded episodes got (v4 only), from the Pipeline's grader at a published
 * version: its thresholds and ladder are fixed by `grader_version`, never tuned per job. The ladder is
 * the closed list below, in order; `approached` is first and present only when every graded episode
 * measured its closest approach, otherwise the ladder starts at `contact`. A stage counts only when
 * every earlier stage did, so each stage's `episodes` (the graded episodes that achieved it) never
 * increases down the ladder, and `mean_score` is the mean share of the ladder an episode achieved.
 * `closest_approach_m` (Amendment 1) is the median and minimum, in metres, of how close the grasp
 * point came to the object over the graded episodes; it is present exactly when the ladder has
 * `approached`, the stage that measures it. Facts about the run, never a ranking: nothing chooses,
 * holds or orders a candidate on it.
 */
/** The grader version, kept beside the threshold it fixes (`client/src/data/screeningProgressGrader.ts`). */
export { SCREENING_PROGRESS_GRADER_VERSION } from "../../client/src/data/screeningProgressGrader";
export const SCREENING_PROGRESS_STAGES = ["approached", "contact", "moved", "lifted", "translated", "placed",
  "released_and_settled"] as const satisfies readonly JobScreeningProgressStage[];
export type ScreeningProgressStage = typeof SCREENING_PROGRESS_STAGES[number];
/**
 * A non-negative figure the Pipeline writes with at most 4 decimals (`mean_score`, the closest approach in
 * metres): its value times 10 000 is a whole number, up to float error in the decimal it was read from.
 */
const fourDecimals = (max: number) => z.number().finite().min(0).max(max)
  .refine(value => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6, "At most 4 decimals");
/** `mean_score` is rounded to 4 decimals by the Pipeline: half a unit of the last place, plus float slack. */
const PROGRESS_MEAN_TOLERANCE = 0.00005 + 1e-9;
const progress = z.object({
  grader_version: z.literal(SCREENING_PROGRESS_GRADER_VERSION),
  episodes_graded: count.min(1),
  stages: z.array(z.object({ stage: z.enum(SCREENING_PROGRESS_STAGES), episodes: count }).strict()).min(6).max(7),
  mean_score: fourDecimals(1),
  closest_approach_m: z.object({ median: fourDecimals(100), min: fourDecimals(100) }).strict()
    .refine(value => value.min <= value.median, "The closest approach's minimum cannot exceed its median").optional(),
}).strict().superRefine((value, ctx) => {
  const ids = value.stages.map(entry => entry.stage);
  const ladder = ids.length === SCREENING_PROGRESS_STAGES.length ? SCREENING_PROGRESS_STAGES : SCREENING_PROGRESS_STAGES.slice(1);
  if (ids.length !== ladder.length || ids.some((id, index) => id !== ladder[index])) {
    ctx.addIssue({ code: "custom", path: ["stages"], message: "Progress stages must be the ladder, in order" });
    return;
  }
  // The distance is what `approached` is measured from: carried exactly when that stage is.
  if ((ladder[0] === "approached") !== (value.closest_approach_m !== undefined)) {
    ctx.addIssue({ code: "custom", path: ["closest_approach_m"], message: "The closest approach comes exactly with the approached stage" });
  }
  if (value.stages.some((entry, index) => entry.episodes > value.episodes_graded
    || (index > 0 && entry.episodes > value.stages[index - 1].episodes))) {
    ctx.addIssue({ code: "custom", path: ["stages"], message: "Progress counts must not increase down the ladder or exceed the graded episodes" });
    return;
  }
  // Each episode achieves a prefix of the ladder, so the mean share is the stage counts over graded × ladder.
  const share = value.stages.reduce((sum, entry) => sum + entry.episodes, 0) / (value.episodes_graded * ladder.length);
  if (Math.abs(value.mean_score - share) > PROGRESS_MEAN_TOLERANCE)
    ctx.addIssue({ code: "custom", path: ["mean_score"], message: "Progress mean score must restate the stage counts" });
});
export type ScreeningProgress = z.infer<typeof progress>;

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
  // v3 only (refused on v1 and v2 below): what the run's camera gate, a humanoid row's spawn check and
  // the free CPU scene check recorded for this row.
  observation_quality_flags: flagList.optional(), setup_quality_flags: flagList.optional(), scene_check_flags: flagList.optional(),
  // v4 only (refused on v1 to v3 below): how far this learned-policy row's graded episodes got.
  progress: progress.optional(),
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
  // Progress is only ever on a learned-policy row (never a scripted baseline or the known-good control; a row
  // with no recorded execution kind reads as a policy, as it always has), and only for episodes it scored.
  if (row.progress && (row.execution_evidence_kind === "scripted_simulator_state_baseline"
    || row.progress.episodes_graded > row.episodes_scored)) {
    ctx.addIssue({ code: "custom", path: ["progress"], message: "Progress is only for a learned-policy row's scored episodes" });
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
  // `limit_usd` is optional: a publication may carry no limit; one it carries is still checked below.
  budget: z.object({ currency: z.literal("USD"), limit_usd: dollars.optional(), committed_upper_bound_usd: dollars,
    spent_upper_bound_usd: dollars, reserved_usd: dollars }).strict(),
  generated_at: z.string().datetime({ offset: true }), publication_digest: digest,
};
const jobEvaluationFields = { ...publicationFields, purpose: z.literal("job_evaluation"), claim_ceiling: z.literal("simulation_estimate"),
  review_videos: z.array(candidateReviewVideos).min(1).max(256).optional() };
const progressJobEvaluationPublication = z.object({ ...jobEvaluationFields, schema_version: z.literal(SCREENING_PUBLICATION_V4),
  scene_feasibility: sceneFeasibility }).strict();
const flaggedJobEvaluationPublication = z.object({ ...jobEvaluationFields, schema_version: z.literal(SCREENING_PUBLICATION_V3),
  scene_feasibility: sceneFeasibility }).strict();
const jobEvaluationPublication = z.object({ ...jobEvaluationFields, schema_version: z.literal(SCREENING_PUBLICATION_V2) }).strict();
const retainedPublication = z.object({ ...publicationFields, schema_version: z.literal(SCREENING_PUBLICATION_V1),
  purpose: z.literal("screening"), claim_ceiling: z.literal("diagnostic_policy_execution"), recommendation_eligible: z.literal(false) }).strict();
export const betaPolicyScreeningPublicationSchema = z.discriminatedUnion("schema_version",
  [progressJobEvaluationPublication, flaggedJobEvaluationPublication, jobEvaluationPublication, retainedPublication])
  .superRefine((value, ctx) => {
  if (value.schema_version === SCREENING_PUBLICATION_V1
    && value.candidates.some(row => screeningExecutionEvidenceFields.some(key => row[key] !== undefined))) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Typed execution evidence requires publication v2" });
  }
  if (!FLAGGED_PUBLICATIONS.has(value.schema_version)
    && value.candidates.some(row => screeningRowFlagFields.some(key => row[key] !== undefined))) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Set-up flags require publication v3" });
  }
  if (value.schema_version !== SCREENING_PUBLICATION_V4 && value.candidates.some(row => row.progress !== undefined)) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Progress requires publication v4" });
  }
  const budget = value.budget;
  if (![budget.limit_usd ?? "0", budget.committed_upper_bound_usd, budget.spent_upper_bound_usd, budget.reserved_usd]
    .every(amount => dollars.safeParse(amount).success)) return;
  const limit = budget.limit_usd === undefined ? null : screeningMoneyMicros(budget.limit_usd);
  const committed = screeningMoneyMicros(budget.committed_upper_bound_usd);
  if (limit !== null && limit > BigInt(SCREENING_PUBLICATION_LIMIT_MAX_USD * 1_000_000) || screeningMoneyMicros(budget.spent_upper_bound_usd) + screeningMoneyMicros(budget.reserved_usd) !== committed
    || limit !== null && committed > limit) ctx.addIssue({ code: "custom", path: ["budget"], message: `Screening must stay within its limit, at most $${SCREENING_PUBLICATION_LIMIT_MAX_USD}` });
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
  return JOB_EVALUATION_PUBLICATIONS.has(value.schema_version) ? value.review_videos ?? [] : [];
}
/** The free CPU scene check's verdict for the campaign; null for a publication that carries none (v1, v2). */
export function screeningSceneFeasibility(value: { schema_version: string; scene_feasibility?: ScreeningSceneFeasibility }) {
  return FLAGGED_PUBLICATIONS.has(value.schema_version) ? value.scene_feasibility ?? null : null;
}
/** A row's progress, in the projection's shape; undefined for a row (or a publication before v4) without it. */
export function screeningProgress(row: { progress?: ScreeningProgress }): JobScreeningProgress | undefined {
  const value = row.progress;
  return value ? { graded: value.episodes_graded,
    stages: value.stages.map(entry => ({ stage: entry.stage, episodes: entry.episodes })), meanScore: value.mean_score,
    ...(value.closest_approach_m ? { closestApproachM: { median: value.closest_approach_m.median, min: value.closest_approach_m.min } } : {}) }
    : undefined;
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
/** Rows the Pipeline closed when it planned them again in a newer run (after a deploy, or on its own retry timer). */
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
/**
 * The Pipeline's known-good control (`beta_policy_screening_known_good_control`, owner approval
 * 2026-11-10): one scripted reference arm, reading exact positions from the simulation, run on a new
 * website campaign's scene to show the simulated set-up can record a success. It is a check, never a
 * candidate: it is left out of candidate lists, counts and the estimate, and its outcome is one sentence
 * (`screeningSetupNotes`). A row is the control only when it is scripted and carries one of the control's
 * own `known_good_control_*` set-up flags, which only a Pipeline made after that change writes; a
 * scripted row of an earlier publication is read exactly as before.
 */
export const KNOWN_GOOD_CONTROL_FLAG_PREFIX = "known_good_control_";
export const screeningKnownGoodControl = (row: { execution_evidence_kind?: string; setup_quality_flags?: readonly string[] }) =>
  scriptedBaseline(row) && (row.setup_quality_flags ?? []).some(code => code.startsWith(KNOWN_GOOD_CONTROL_FLAG_PREFIX));
/**
 * What our scripted reference check found, from its published counts alone (review, 2026-11-12): could not run when
 * none of its tries was scored; failed when none of the scored tries succeeded; passed when at least two were scored
 * and at least two thirds of them succeeded; otherwise partly. Null when there is no such row, or it has not ended
 * (it carries only its pending flag).
 */
export type ScreeningReferenceCheck = "passed" | "partly" | "failed" | "could_not_run";
export function screeningReferenceCheckFromCounts(scored: number, succeeded: number): ScreeningReferenceCheck {
  if (scored <= 0) return "could_not_run";
  if (succeeded <= 0) return "failed";
  return scored >= 2 && succeeded * 3 >= scored * 2 ? "passed" : "partly";
}
export const screeningReferenceControl = (rows: readonly ScreeningCandidateRow[]) => {
  const control = rows.find(screeningKnownGoodControl);
  return control && (control.setup_quality_flags ?? []).some(code => code.startsWith(KNOWN_GOOD_CONTROL_FLAG_PREFIX)
    && !/^known_good_control_pending(:|$)/.test(code)) ? control : null;
};
export function screeningReferenceCheck(rows: readonly ScreeningCandidateRow[]): ScreeningReferenceCheck | null {
  const control = screeningReferenceControl(rows);
  if (!control) return null;
  // An earlier check of the same scene, reused (`:reused`): this publication carries no counts of its own, so the
  // earlier check's class is the flag's (review, 2026-11-12).
  const reused = control.episodes_scored === 0
    ? (control.setup_quality_flags ?? []).map(code => /^known_good_control_(passed|partly|failed):reused$/.exec(code)?.[1]).find(Boolean) : undefined;
  if (reused) return reused as ScreeningReferenceCheck;
  return screeningReferenceCheckFromCounts(control.episodes_scored, control.episodes_succeeded);
}
/** Flags that are facts about one robot and the object (`screeningSetupFlagSentences`): never a set-up doubt. */
export const ROBOT_FACT_FLAG_CODES: ReadonlySet<string> = new Set(["task_object_wider_than_gripper", "task_object_heavier_than_grip",
  "task_object_grip_depends_on_weight", "task_object_needs_edge_grip", "fixed_arm_reach_cannot_span_pick_and_place"]);
export const isRobotFactFlagCode = (code: string) => ROBOT_FACT_FLAG_CODES.has(code.split(":")[0]);
/** The rows that are candidates: every row but the known-good control. */
export const screeningCandidateRows = <Row extends { execution_evidence_kind?: string; setup_quality_flags?: readonly string[] }>(
  candidates: readonly Row[]): Row[] => candidates.filter(row => !screeningKnownGoodControl(row));
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

export function screeningOutcome(value: Pick<BetaPolicyScreeningPublication, "status" | "candidates" | "budget">): ScreeningOutcome | null {
  // The known-good control is a check, not a candidate: what the run means rests on the candidates alone.
  const publication = { ...value, candidates: screeningCandidateRows(value.candidates) };
  const scored = publication.candidates.reduce((sum, row) => sum + row.episodes_scored, 0);
  // A run whose candidates finished with no scored episode has no estimate to show.
  const finished = publication.status === "completed" && scored === 0 ? "blocked" : publication.status;
  if (finished !== "completed" && finished !== "blocked") return null;
  // Rows planned again in a newer run (after a deploy, or on a retry timer): with nothing scored here,
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
 * What an outcome's sentence has to add, beside the outcome itself (the outcome kinds are a closed set
 * both repositories share, and none changes here). `scene_setup`: the run is an estimate in which no
 * scored try succeeded, and Blueprint's own checks flagged the scene a scored candidate ran in: the free
 * CPU scene check for that candidate, its run's camera gate, or a humanoid row's spawn check. The count
 * may then reflect how we set the scene up more than the robots, so the page and the email say so in one
 * sentence. The flags do not prove the cause, and a result with no flag is said exactly as before. A
 * publication that names a flagged scene without naming any candidate's scene flags speaks for every
 * scored candidate.
 */
export const SCREENING_OUTCOME_CAVEATS = ["scene_setup"] as const;
export type ScreeningOutcomeCaveat = typeof SCREENING_OUTCOME_CAVEATS[number];
/** A stored caveat, or null for anything this version does not know. */
export const storedScreeningOutcomeCaveat = (value: unknown): ScreeningOutcomeCaveat | null =>
  (SCREENING_OUTCOME_CAVEATS as readonly unknown[]).includes(value) ? value as ScreeningOutcomeCaveat : null;
export function screeningOutcomeCaveat(publication: BetaPolicyScreeningPublication): ScreeningOutcomeCaveat | null {
  if (screeningOutcome(publication) !== "estimate") return null;
  const candidates = screeningCandidateRows(publication.candidates);
  const scored = candidates.filter(row => row.episodes_scored > 0);
  if (scored.some(row => row.episodes_succeeded > 0)) return null;
  // A flag about one robot and the object is a fact about that robot, never a doubt about our set-up.
  if (scored.some(row => screeningRowFlagFields.some(key => (row[key] ?? []).some(code => !isRobotFactFlagCode(code))))) return "scene_setup";
  // Our scripted reference check (review, 2026-11-12): when it failed, did it only partly, or could not run, a result
  // with no success may come from how we set up the scene. A passed check removes no flag (above).
  const reference = screeningReferenceCheck(publication.candidates);
  if (reference === "failed" || reference === "partly" || reference === "could_not_run") return "scene_setup";
  return screeningSceneFeasibility(publication)?.status === "flagged"
    && !candidates.some(row => (row.scene_check_flags?.length ?? 0) > 0) ? "scene_setup" : null;
}

/**
 * The one plain sentence for each outcome. Measured reasons are relative to
 * the robot position the scene planned, never a task-level verdict (owner
 * decision 2026-10-31); "No match" is said plainly (owner decision 2026-10-30).
 * A hold that is ours to look at says what happened, that it does not restart
 * by itself, and what the site hears next.
 */
/** Rows a Blueprint update stopped are planned again only after a deploy, which nothing schedules: no rerun is promised. */
const SETUP_REPAIR_SENTENCE = "Simulation evaluation of your job has not finished: a Blueprint update stopped it before it gave an estimate. "
  + "If a later run gives an estimate, it will show here.";
const ATTENTION_NEXT = "It won't restart by itself. Our team has been told, and we'll email you if a later run gives a result.";
/**
 * A failure on our side may run again, but nothing guarantees it: the Pipeline plans a harness failure
 * again only after a later deploy, which nothing schedules, while the candidate has a retry left
 * (HARNESS_RETRY_LIMIT) inside the site's allowance. So no rerun is promised, and none is ruled out.
 */
const SETUP_NEXT = "Our team has been told, and we'll email you if a later run gives a result.";
/** One plain sentence, no codes. It says "may": the flags are a possible cause, never a proven one. */
const SCREENING_CAVEAT_SENTENCE: Readonly<Record<ScreeningOutcomeCaveat, string>> = {
  scene_setup: "Our scene check found a possible set-up cause, so this result may reflect how we set the scene up more than the robots.",
};
const SCREENING_OUTCOME_SENTENCE: Readonly<Record<ScreeningOutcome, string>> = {
  estimate: "Your simulation estimate is ready. It is an estimate from a simulation of your site, not a certified result.",
  reference_only: "No estimate yet: only scripted reference baselines were scored, and no learned policy could be evaluated on your job yet.",
  held_capability: "Held: we can't simulate this kind of job yet. It counts as demand for what we build next.",
  held_unprepared: "Held: the robots that could do this job aren't set up in our simulator yet. It counts as demand for what we build next.",
  infeasible: "Held: from the robot position planned in the scene built from your video, none of the robots we can simulate could reach this task.",
  no_match: "No match: none of the robots we can simulate matched this job. At least one was measured out of reach from the robot position planned in the scene built from your video.",
  held_setup: `Held: a problem on our side stopped the simulation of your job before it gave an estimate. ${SETUP_NEXT}`,
  held_budget: `Held: your job reached a limit on our side before it gave an estimate. ${ATTENTION_NEXT}`,
  held_scene_check: `Held: the simulation built from your video failed the check we run before testing robots, so no robot was tested on your job. ${ATTENTION_NEXT}`,
  // An internal limit is Blueprint's own control, never a step for the site, and is never named.
  awaiting_spend_approval: "Your job is paused on our side. Nothing is needed from you.",
  setup_repair: SETUP_REPAIR_SENTENCE,
  superseded: "Continued in a newer run.",
};
/**
 * The same result outcomes, as the site's email says them: about the simulation, never "your job is held".
 * The site already has its answer from the fit check; only the simulation waits or stopped.
 * The job page keeps `SCREENING_OUTCOME_SENTENCE`; an estimate's email is built from the simulation proof.
 */
const SIMULATION_OUTCOME_EMAIL_SENTENCE: Readonly<Record<Exclude<ScreeningOutcome, "estimate" | "awaiting_spend_approval"
  | "setup_repair" | "superseded">, string>> = {
  reference_only: "The simulation scored only scripted reference checks, so no AI policy could be tested in it yet.",
  held_capability: "The simulation can't model this kind of task yet. It counts as demand for what we build next.",
  held_unprepared: "The robots that could do this task aren't set up in the simulation yet. It counts as demand for what we build next.",
  infeasible: "From the robot position planned in the scene built from your video, none of the robots the simulation can run could reach the task.",
  no_match: "None of the robots the simulation can run matched this task. At least one was measured out of reach from the robot position planned in the scene built from your video.",
  held_setup: `A problem on our side stopped the simulation before it finished. ${SETUP_NEXT}`,
  held_budget: `The simulation stopped at a limit on our side before it finished. ${ATTENTION_NEXT}`,
  held_scene_check: `The simulated scene failed the check we run before testing robots, so no robot was tested in it. ${ATTENTION_NEXT}`,
};
/** A held or reference-only outcome's email sentence, said about the simulation. */
/**
 * A hold's detail the site is told in its own words (review, 2026-11-12). The Pipeline sends the cold-storage hold
 * only as the evaluation hold record: `team_scene_packet_blocked` with this `detail_code`. Any other detail keeps the
 * reason's own sentence.
 */
export const SCREENING_HOLD_DETAILS = ["scene_run_in_cold_storage"] as const;
export type ScreeningHoldDetail = typeof SCREENING_HOLD_DETAILS[number];
const HOLD_DETAIL_SENTENCE: Readonly<Record<ScreeningHoldDetail, string>> = {
  scene_run_in_cold_storage: "Held on our side while the saved simulation of your job is restored. Nothing is needed from you.",
};
export const screeningHoldDetail = (reason: unknown, detail: unknown): ScreeningHoldDetail | null =>
  reason === "team_scene_packet_blocked" && detail === "scene_run_in_cold_storage" ? detail : null;
/** The held sentence, by its detail when it has words of its own. */
export function simulationHoldSentence(outcome: ScreeningOutcome, detail?: ScreeningHoldDetail | null): string {
  return detail && outcome === "held_setup" ? HOLD_DETAIL_SENTENCE[detail] : simulationOutcomeEmailSentence(outcome);
}
export function simulationOutcomeEmailSentence(outcome: ScreeningOutcome): string {
  return (SIMULATION_OUTCOME_EMAIL_SENTENCE as Partial<Record<ScreeningOutcome, string>>)[outcome] ?? SCREENING_OUTCOME_SENTENCE[outcome];
}
/** The zero-success caveat's sentence, for an email that has no projected proof to take it from. */
export const screeningCaveatSentence = (caveat: ScreeningOutcomeCaveat) => SCREENING_CAVEAT_SENTENCE[caveat];
/** Outcomes that still wait on Blueprint, so they say until when Blueprint can keep working on the job. */
const WAITING_OUTCOMES: ReadonlySet<ScreeningOutcome> = new Set(["awaiting_spend_approval", "setup_repair"]);
/**
 * Until when Blueprint is authorized to keep working on the job (`websiteJobWorkWindow`), as a
 * plain date. It says what holds today: it is not a date the job ends by. Empty without a date.
 */
export function jobWorkWindowSentence(untilEpoch?: number | null): string {
  if (typeof untilEpoch !== "number" || !Number.isFinite(untilEpoch) || untilEpoch <= 0) return "";
  const date = new Date(untilEpoch * 1000).toLocaleDateString("en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  return `We can keep working on this job until ${date}.`;
}
/**
 * The outcome's sentence, followed by its caveat when it has one. Only an estimate takes a caveat, so a
 * stale one never attaches to another outcome; without a caveat the sentence is the outcome's own.
 */
export const screeningOutcomeSentence = (outcome: ScreeningOutcome, caveat?: ScreeningOutcomeCaveat | null) =>
  caveat && outcome === "estimate" ? `${SCREENING_OUTCOME_SENTENCE[outcome]} ${SCREENING_CAVEAT_SENTENCE[caveat]}`
    : SCREENING_OUTCOME_SENTENCE[outcome];
/** The same sentence, with the job's work window when the outcome still waits on Blueprint and a date is known. */
export function screeningOutcomeSentenceWithWindow(outcome: ScreeningOutcome, workUntilEpoch: number | null | undefined,
  caveat?: ScreeningOutcomeCaveat | null): string {
  const window = WAITING_OUTCOMES.has(outcome) ? jobWorkWindowSentence(workUntilEpoch) : "";
  const sentence = screeningOutcomeSentence(outcome, caveat);
  return window ? `${sentence} ${window}` : sentence;
}
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

/**
 * A candidate row's evidence: everything but its set-up flags and its progress. The flags are notes about
 * the scene the row ran in, and progress is read from the row's own sealed episodes by the Pipeline's
 * grader, so a later revision may state either for a result this site already holds (a campaign first
 * accepted as v2 or v3) and the Pipeline's older form of a revision, which cannot carry them, is still
 * accepted after a newer one. The counts, the status and the result digest never change.
 */
type ScreeningCandidateRow = BetaPolicyScreeningPublication["candidates"][number];
const evidenceRow = ({ observation_quality_flags: _observation, setup_quality_flags: _setup, scene_check_flags: _scene,
  progress: _progress, ...evidence }: ScreeningCandidateRow) => evidence;

/** Retried or delayed deliveries cannot rewrite a campaign or its completed candidate results. */
export function screeningPublicationTransition(previous: BetaPolicyScreeningPublication, next: BetaPolicyScreeningPublication) {
  if (screeningCampaignIdentity(previous) !== screeningCampaignIdentity(next)) throw new Error("screening_campaign_identity_conflict");
  if (previous.publication_digest === next.publication_digest) return "replayed" as const;
  if (next.revision < previous.revision) return "superseded" as const;
  if (next.revision === previous.revision) throw new Error("screening_revision_conflict");
  // The site limit is the shared allowance, not part of a campaign: raising it
  // (2026-11-05, $15 to $30 on the owner's approval) must not refuse every update
  // to a campaign first published under the old limit. It may never be lowered.
  if (screeningMoneyMicros(next.budget.limit_usd) < screeningMoneyMicros(previous.budget.limit_usd))
    throw new Error("screening_budget_limit_lowered");
  // Later campaigns at the same site update the shared budget snapshot even
  // after this campaign ends. Its scientific evidence must remain byte-identical.
  if (["completed", "blocked"].includes(previous.status) && (next.status !== previous.status
    || crossRuntimeDigest(previous.candidates.map(evidenceRow)) !== crossRuntimeDigest(next.candidates.map(evidenceRow))))
    throw new Error("screening_revision_conflict");
  // Kept videos are media, not evidence: a later revision may add a candidate's, never change or drop one.
  const nextVideos = new Map(screeningReviewVideos(next).map(entry => [entry.candidate_id, crossRuntimeDigest(entry)]));
  if (screeningReviewVideos(previous).some(entry => nextVideos.get(entry.candidate_id) !== crossRuntimeDigest(entry)))
    throw new Error("screening_review_videos_conflict");
  if (Date.parse(next.generated_at) < Date.parse(previous.generated_at)
    || screeningMoneyMicros(next.budget.spent_upper_bound_usd) < screeningMoneyMicros(previous.budget.spent_upper_bound_usd))
    throw new Error("screening_progress_regression");
  previous.candidates.forEach((row, index) => {
    const updated = next.candidates[index];
    if (screeningTerminalCandidateStates.has(row.status) && crossRuntimeDigest(evidenceRow(row)) !== crossRuntimeDigest(evidenceRow(updated)))
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
