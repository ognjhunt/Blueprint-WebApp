/**
 * Stored publications of Blueprint's retired early trial (`run_kind: beta_policy_screening`), and the outcomes and
 * sentences of a scene-stage hold (`betaPolicyScreeningHold`).
 *
 * The early trial was dropped (owner, 2026-11-14) and nothing receives its publications any more. Old jobs keep
 * theirs: the job ceiling counts their committed spend (`websiteJobCeiling`), so the schema they were accepted
 * under stays exactly as it was and only parses what is stored. No page, email or alert reads them.
 *
 * v1 to v4 differ only in fields the trial added over time (typed execution evidence, set-up flags, progress); a
 * stored publication of any of them parses as it did when it was accepted.
 */
import { z } from "zod";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import type { JobScreeningOutcome, JobScreeningProgressStage } from "../../client/src/types/jobMarketplace";
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
 * refusing a result un-spends nothing and only hides results the job already paid for.
 */
const SCREENING_PUBLICATION_LIMIT_MAX_USD = 1000;
/**
 * `waitlisted`: runnable, waiting for site budget a funded candidate may
 * release before spend. Not terminal: the Pipeline funds it (`pending`) or,
 * once nothing at the site can release money, closes it as `deferred`.
 */
const screeningQueuedCandidateStates = new Set(["pending", "waitlisted"]);
const screeningExecutionEvidenceFields = ["execution_evidence_kind", "action_source", "scripted_rollout_count",
  "learned_policy_rollout_count", "scripted_controller_invoked", "candidate_policy_queried"] as const;

const SCREENING_PUBLICATION_V1 = "beta_policy_screening_publication.v1";
const SCREENING_PUBLICATION_V2 = "beta_policy_screening_publication.v2";
const SCREENING_PUBLICATION_V3 = "beta_policy_screening_publication.v3";
const SCREENING_PUBLICATION_V4 = "beta_policy_screening_publication.v4";
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
const screeningRowFlagFields = ["observation_quality_flags", "setup_quality_flags", "scene_check_flags"] as const;
const sceneFeasibility = z.object({ status: z.enum(["clear", "flagged", "unknown"]),
  flags: z.array(flagCode).max(SCREENING_FLAGS_MAX).refine(sortedUnique, "Flags must be sorted and unique") }).strict()
  .refine(value => (value.status === "flagged") === (value.flags.length > 0), "Only a flagged scene check names flags");

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
const SCREENING_PROGRESS_STAGES = ["approached", "contact", "moved", "lifted", "translated", "placed",
  "released_and_settled"] as const satisfies readonly JobScreeningProgressStage[];
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
 * owner could watch them. Kept media, never a
 * score: absent when nothing was kept, and never a reason code, path or URL.
 */
const SCREENING_REVIEW_VIDEO_MAX_BYTES = 64 * 1024 * 1024;
const SCREENING_REVIEW_VIDEOS_PER_CANDIDATE = 80;
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
type ScreeningReviewVideos = z.infer<typeof candidateReviewVideos>;

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
const betaPolicyScreeningPublicationSchema = z.discriminatedUnion("schema_version",
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
function screeningReviewVideos(value: { schema_version: string; review_videos?: ScreeningReviewVideos[] }) {
  return JOB_EVALUATION_PUBLICATIONS.has(value.schema_version) ? value.review_videos ?? [] : [];
}
export type BetaPolicyScreeningPublication = z.infer<typeof betaPolicyScreeningPublicationSchema>;
/**
 * Every outcome a stored run names (`screening_outcome`). A scene-stage hold stores `held_capability`, `held_setup`,
 * `held_scene_check` or `awaiting_spend_approval` (`screeningHoldOutcome`); the others were written only by campaigns
 * of the retired early trial, and stay known so stored values read as they were written.
 */
export const SCREENING_OUTCOMES = ["estimate", "reference_only", "held_capability", "held_unprepared", "infeasible", "no_match",
  "held_setup", "held_budget", "held_scene_check", "awaiting_spend_approval", "setup_repair", "superseded"] as const satisfies readonly JobScreeningOutcome[];
export type ScreeningOutcome = JobScreeningOutcome;
export type ScreeningHeldOutcome = Extract<ScreeningOutcome, "reference_only" | "held_capability" | "held_unprepared" | "infeasible"
  | "no_match" | "held_setup" | "held_budget" | "held_scene_check">;
const HELD_OUTCOMES = new Set<string>(["reference_only", "held_capability", "held_unprepared", "infeasible", "no_match",
  "held_setup", "held_budget", "held_scene_check"]);
/** The outcomes a scene-stage hold record tells the site (`SCREENING_HOLD_OUTCOMES` in `betaPolicyScreeningHold`). */
export type SceneHoldOutcome = Extract<ScreeningHeldOutcome, "held_capability" | "held_setup" | "held_scene_check">;
export const isSceneHoldOutcome = (value: unknown): value is SceneHoldOutcome =>
  value === "held_capability" || value === "held_setup" || value === "held_scene_check";
/** Holds that are ours to look at (a failure, a spent allowance, a scene check), not demand for a new capability. */
export const SCREENING_ATTENTION_OUTCOMES = ["held_setup", "held_budget", "held_scene_check"] as const;
export const isScreeningAttentionOutcome = (value: unknown): value is typeof SCREENING_ATTENTION_OUTCOMES[number] =>
  (SCREENING_ATTENTION_OUTCOMES as readonly unknown[]).includes(value);
export const isScreeningHeldOutcome = (value: unknown): value is ScreeningHeldOutcome => typeof value === "string" && HELD_OUTCOMES.has(value);
/** A stored outcome, or null for anything this version does not know. */
export const storedScreeningOutcome = (value: unknown): ScreeningOutcome | null =>
  (SCREENING_OUTCOMES as readonly unknown[]).includes(value) ? value as ScreeningOutcome : null;

/** A caveat a campaign's estimate once carried; kept so a stored hold notice intent still parses (`screeningOutcomeNotifications`). */
export const SCREENING_OUTCOME_CAVEATS = ["scene_setup"] as const;

const ATTENTION_NEXT = "It won't restart by itself. Our team has been told, and we'll email you if a later run gives a result.";
/**
 * A failure on our side may run again, but nothing guarantees it, so no rerun is promised, and none is ruled out.
 */
const SETUP_NEXT = "Our team has been told, and we'll email you if a later run gives a result.";
/**
 * A scene-stage hold, as the site's job page and its email say it: about the simulation, never "your job is held".
 * The site already has its answer from the fit check; only the simulation waits or stopped.
 */
const SIMULATION_HOLD_SENTENCE: Readonly<Record<SceneHoldOutcome, string>> = {
  held_capability: "The simulation can't model this kind of task yet. It counts as demand for what we build next.",
  held_setup: `A problem on our side stopped the simulation before it finished. ${SETUP_NEXT}`,
  held_scene_check: `The simulated scene failed the check we run before testing robots, so no robot was tested in it. ${ATTENTION_NEXT}`,
};
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
export function simulationHoldSentence(outcome: SceneHoldOutcome, detail?: ScreeningHoldDetail | null): string {
  return detail && outcome === "held_setup" ? HOLD_DETAIL_SENTENCE[detail] : SIMULATION_HOLD_SENTENCE[outcome];
}
/** Outcomes a notice intent may name (F-01): kept as the stored intents were written. */
export const isScreeningResultOutcome = (value: unknown): value is "estimate" | ScreeningHeldOutcome =>
  value === "estimate" || isScreeningHeldOutcome(value);

/** A stored publication, parsed as it was accepted; null when it does not parse or its digest does not verify. */
export function parseBetaPolicyScreeningPublication(value: unknown): BetaPolicyScreeningPublication | null {
  const parsed = betaPolicyScreeningPublicationSchema.safeParse(value);
  if (!parsed.success || crossRuntimeArtifactDigest(parsed.data, "publication_digest") !== parsed.data.publication_digest) return null;
  return parsed.data;
}
