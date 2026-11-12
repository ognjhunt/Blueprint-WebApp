/**
 * One dollar ceiling per website job (owner decision 2026-10-30).
 *
 * Before this, a job's ledgers had separate caps: the Atlas allowance, the
 * preparation-only sponsorship (upstream rows and native scene construction)
 * and the beta-screening site ledger, so a job could spend past the owner's
 * total. Every WebApp admission of new spend for a job now counts every one of
 * those ledgers against a single ceiling, each at its settled cost where known
 * and otherwise at its held maximum, and refuses with the existing
 * `website_scene_preparation_budget_exhausted` code, which the Pipeline already
 * holds as `budget_exhausted`. Money is the only stop added: the existing
 * per-ledger caps still apply inside the ceiling, and no stored reservation,
 * grant or settlement is read differently, reset or rewritten.
 *
 * Owner decision 2026-11-11: each job has one safety limit (`websiteJobSafetyLimitUsd`: its ceiling,
 * or the grant policy's current figure if higher; $100 for new jobs), a fuse against a bug burning the
 * account's month in one job, never a judgment that a job costs too much. Nothing passes it, the
 * automatic budget extension included. Below it every rule is as before: testing stops at the stored
 * ceiling, and a flagged grant's build passes the ceiling with a note.
 */
import { websiteAtlasAuthorizationCeiling, websiteAtlasGrantPolicy } from "./websiteAtlasAuthorization";
import { parseBetaPolicyScreeningPublication, screeningMoneyMicros } from "./betaPolicyScreeningContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { isNavigationStrategy } from "./navigationSceneIntake";

/** The owner's per-job safety limit for website jobs (2026-11-11: $100, was $40). It
 * applies only when neither the job's Atlas authorization nor the configured
 * Atlas grant policy (`BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON`) names one. */
export const WEBSITE_JOB_CEILING_DEFAULT_USD = 100;

export type WebsiteJobCeilingSource = "atlas_authorization" | "job_authorization_row" | "retained_atlas_grant"
  | "atlas_grant_policy" | "owner_default";

const micros = (usd: number) => Math.ceil(usd * 1_000_000);
const dollars = (value: number) => value / 1_000_000;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Where the ceiling comes from, in order: the Atlas authorization this
 * admission is made under (an explicit owner row or the job's stored automatic
 * grant, which pinned the configured policy's figure when it was made); else
 * the owner's explicit authorization row for this job and capture
 * (`BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON`) when it is higher than what
 * follows, so a scene intake counts against the figure the owner raised the job
 * to; else the job's stored grant for this capture; else the configured Atlas
 * grant policy; else the owner default. A stored grant keeps the figure it was made with.
 */
export function websiteJobCeiling(input: { record: Record<string, any>; captureId: string; requestId?: string;
  atlas?: { maximum_cost_usd: number } | null }): { maximum_cost_usd: number; source: WebsiteJobCeilingSource } {
  if (input.atlas) return { maximum_cost_usd: input.atlas.maximum_cost_usd, source: "atlas_authorization" };
  const fallback = storedOrDefaultCeiling(input);
  // capture-447ae4f4 (2026-11-02): its owner row was never read by the scene intake, which
  // fell back to the $40 default whatever figure the owner set for the job. The row only
  // raises the job's ceiling: a lower row still caps the Atlas allowance it authorizes,
  // and other ledgers keep the figure they had before rows were read here.
  const row = input.requestId ? websiteAtlasAuthorizationCeiling(input.requestId, input.captureId) : null;
  return row !== null && row > fallback.maximum_cost_usd ? { maximum_cost_usd: row, source: "job_authorization_row" } : fallback;
}

function storedOrDefaultCeiling(input: { record: Record<string, any>; captureId: string })
  : { maximum_cost_usd: number; source: WebsiteJobCeilingSource } {
  const retained = input.record.website_atlas_grants?.[input.captureId]?.maximum_cost_usd;
  if (amount(retained) && retained > 0 && retained <= 1000) return { maximum_cost_usd: retained, source: "retained_atlas_grant" };
  const policy = websiteAtlasGrantPolicy();
  if (policy) return { maximum_cost_usd: policy.maximum_cost_usd, source: "atlas_grant_policy" };
  return { maximum_cost_usd: WEBSITE_JOB_CEILING_DEFAULT_USD, source: "owner_default" };
}

/** Reads the job's other ledgers; the caller supplies the transaction. */
export type WebsiteJobLedgerReader = {
  sceneIntakes(): Promise<Array<Record<string, any>>>;
  screeningRuns(): Promise<Array<{ run: Record<string, any>; result: Record<string, any> | null }>>;
};

type Store = { collection(name: string): any };
type Transaction = { get(reference: any): Promise<any> };

/** The same job queries the job pages already run (and index), inside the admission transaction. */
export function transactionJobLedgerReader(store: Store, transaction: Transaction, requestId: string): WebsiteJobLedgerReader {
  return {
    sceneIntakes: async () => (await transaction.get(store.collection("taskEvaluationSceneIntakes")
      .where("website_request_id", "==", requestId))).docs.map((row: any) => row.data()),
    screeningRuns: async () => {
      const runs = (await transaction.get(store.collection("taskEvaluationPolicyRuns")
        .where("job_evidence_binding.job_id", "==", requestId))).docs.map((row: any) => row.data())
        .filter((run: Record<string, any>) => run?.run_kind === "beta_policy_screening");
      return Promise.all(runs.map(async (run: Record<string, any>) => ({ run,
        result: typeof run.result_record_id === "string" && run.result_record_id
          ? (await transaction.get(store.collection("captureTaskEvaluationRuns").doc(run.result_record_id))).data() ?? null
          : null })));
    },
  };
}

/** One preparation row: its settlement, else its full reservation (per-row rounding as admission always did). */
function preparationRowMicros(row: any) {
  const settled = row?.settlement?.actual_cost_usd, held = row?.admission?.maximum_cost_usd;
  if (row?.settlement !== undefined) return amount(settled) ? micros(settled) : Infinity;
  return amount(held) ? micros(held) : Infinity;
}

/** The Pipeline's own status shows the intent can start no further attempt. */
function pipelineEnded(status: Record<string, any> | undefined) {
  return ["completed", "expired", "revoked"].includes(status?.status)
    || status?.status === "blocked" && status.phase === "policy_canary_blocked"
    || Array.isArray(status?.blockers) && status!.blockers.some((blocker: unknown) =>
      blocker === "scene_intake_authority_expired" || blocker === "scene_intake_authority_revoked");
}

/**
 * What the Pipeline still holds for one attempt row: a live row its full
 * reservation, a never-started cancellation nothing. A row the Pipeline settled
 * after a terminal attempt also reads `cancelled_before_execution`, but keeps the
 * hold its evidence cannot prove unspent (capture-447ae4f4, 2026-11-03: $21.63
 * of a $31 row counted here as nothing). Newer statuses report that hold as
 * `retained_spend_usd`, the figure the Pipeline's own reservation counts; it only
 * raises the row. An older status without it counts the row as before.
 */
function attemptMicros(attempt: any) {
  const live = attempt?.status === "cancelled_before_execution" ? 0
    : amount(attempt?.maximum_spend_usd) ? micros(attempt.maximum_spend_usd) : Infinity;
  if (attempt?.retained_spend_usd === undefined) return live;
  return Math.max(live, amount(attempt.retained_spend_usd) ? micros(attempt.retained_spend_usd) : Infinity);
}

/**
 * A sponsored scene intake grants native construction its own allowance
 * (`request.execution.max_total_spend_usd`, raised by any recorded budget
 * extension). It is held in full while the intake can still start an attempt.
 * Once closed, it counts what its attempts hold, the most the Pipeline
 * reports for native work. An unreadable allowance counts as unbounded.
 * Where the Pipeline reports settled holds, the count is never below what it
 * reports its rows hold, open or closed.
 *
 * The worker stores `forwarding_started` before every delivery POST. With no
 * receipt, a lost response may hide an intent the Pipeline accepted and can
 * still spend on, so it stays held in full whatever its local state says.
 * A local `blocked` only ends the WebApp's own retries or polls: it releases
 * when nothing was ever sent, or when the Pipeline's status shows it ended.
 *
 * A navigation intake keeps its scene as filmed and grants no construction
 * allowance (owner, 2026-11-07): it counts only what the Pipeline reports its
 * attempts hold, which is nothing, since the Pipeline reserves none for it.
 */
function nativeIntakeMicros(intake: Record<string, any>) {
  const status = intake.pipeline_status, attempts = Array.isArray(status?.attempts) ? status.attempts : [];
  const reserved = attempts.reduce((sum: number, attempt: any) => sum + attemptMicros(attempt), 0);
  if (isNavigationStrategy(intake.request?.task?.strategy)) return reserved;
  const settledReported = attempts.some((attempt: any) => attempt?.retained_spend_usd !== undefined);
  const granted = intake.request?.execution?.max_total_spend_usd;
  const extended = status?.effective_execution_budget?.max_total_spend_usd;
  // The Pipeline refuses any reservation that would take the intent's holds past
  // this (extended) budget, so it bounds what native construction can spend.
  const budget = amount(granted) ? Math.max(micros(granted), amount(extended) ? micros(extended) : 0) : Infinity;
  const maySpend = !intake.receipt && intake.forwarding_started === true;
  const unissued = !intake.receipt && !maySpend && ["revoked", "expired", "blocked"].includes(intake.state);
  const ended = intake.closeout_complete === true || intake.state === "completed"
    || intake.state === "blocked" && pipelineEnded(status);
  // Reported holds are the Pipeline's own committed figure: the budget never trims them.
  if (!maySpend && (ended || unissued)) return settledReported ? reserved : Math.min(reserved, budget);
  return settledReported ? Math.max(budget, reserved) : budget;
}

/**
 * The screening site ledger is site-wide and every publication carries its
 * whole snapshot, so the latest one counts: its spent upper bound (charged at
 * the full reservation once allocated) plus its open reservations.
 *
 * A run with no readable publication counts the most screening could hold
 * (owner decision 2026-11-11: screening has no fixed allowance, only the job's
 * ceiling): all of the ceiling the job's other ledgers leave, so the job counts
 * as full and nothing more is admitted until it reads. Without a ceiling to
 * measure against it counts as unbounded.
 */
function screeningMicros(rows: Array<{ run: Record<string, any>; result: Record<string, any> | null }>,
  room: { ceilingMicros?: number; otherMicros: number }) {
  if (rows.length === 0) return 0;
  const publications = rows.map(row => row.result ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(row.result)) : null);
  if (publications.some(publication => publication === null))
    return room.ceilingMicros === undefined ? Infinity : Math.max(0, room.ceilingMicros - room.otherMicros);
  const latest = publications.reduce((best, publication) => !best
    || Date.parse(publication!.generated_at) > Date.parse(best.generated_at)
    || Date.parse(publication!.generated_at) === Date.parse(best.generated_at) && publication!.revision > best.revision
    ? publication : best, null as ReturnType<typeof parseBetaPolicyScreeningPublication>)!;
  return Number(screeningMoneyMicros(latest.budget.committed_upper_bound_usd));
}

/** What the job holds or spent on each ledger. `ceiling` is the job's ceiling, which an unreadable screening publication fills. */
export async function websiteJobSpend(input: { record: Record<string, any>; reader: WebsiteJobLedgerReader;
  ceiling?: { maximum_cost_usd: number } }) {
  const preparation = Object.values(input.record.website_preparation_reservations ?? {})
    .reduce((sum: number, row) => sum + preparationRowMicros(row), 0);
  const native = (await input.reader.sceneIntakes()).reduce((sum, intake) => sum + nativeIntakeMicros(intake), 0);
  const screening = screeningMicros(await input.reader.screeningRuns(), { otherMicros: preparation + native,
    ceilingMicros: input.ceiling ? Math.floor(input.ceiling.maximum_cost_usd * 1_000_000) : undefined });
  return { preparation_micros: preparation, native_construction_micros: native, screening_micros: screening,
    total_micros: preparation + native + screening };
}

/** The read-only projection returned with the Atlas configuration; it authorizes nothing. */
export function websiteJobCeilingSummary(ceiling: ReturnType<typeof websiteJobCeiling>,
  spend: Awaited<ReturnType<typeof websiteJobSpend>>) {
  const limit = Math.floor(ceiling.maximum_cost_usd * 1_000_000);
  // Unbounded (unreadable) holds report as the whole ceiling: nothing remains.
  const finite = (value: number) => Number.isFinite(value) ? dollars(value) : dollars(limit);
  return { schema_version: "website_job_ceiling.v1", maximum_cost_usd: ceiling.maximum_cost_usd,
    source: ceiling.source, preparation_cost_usd: finite(spend.preparation_micros),
    native_construction_cost_usd: finite(spend.native_construction_micros), screening_cost_usd: finite(spend.screening_micros),
    reserved_or_settled_cost_usd: finite(spend.total_micros),
    remaining_cost_usd: Number.isFinite(spend.total_micros) ? dollars(Math.max(0, limit - spend.total_micros)) : 0 };
}

type WebsiteJobCeilingInput = { record: Record<string, any>; captureId: string;
  requestId?: string; atlas?: { maximum_cost_usd: number } | null; reader: WebsiteJobLedgerReader;
  additionalCostUsd: number };

/**
 * The job's safety limit (owner decision 2026-11-11): its ceiling, or the configured grant policy's
 * current figure if that is higher (the owner default when no policy is set). A job granted before the
 * policy was raised keeps its stored ceiling for testing, and on a grant naming the automatic budget
 * extension may build past that ceiling with a note, as before, but never past this. A policy lowered
 * below a job's stored ceiling never lowers the job: the larger figure stands.
 */
export function websiteJobSafetyLimitUsd(ceiling: { maximum_cost_usd: number }) {
  return Math.max(ceiling.maximum_cost_usd, websiteAtlasGrantPolicy()?.maximum_cost_usd ?? WEBSITE_JOB_CEILING_DEFAULT_USD);
}

/** Whether new spend would take the job past its ceiling, and past its safety limit. Reads only; the caller decides and writes. */
export async function checkWebsiteJobCeiling(input: WebsiteJobCeilingInput & {
  /** The admission is on a grant naming the automatic budget extension, so it stops at the safety limit. */
  extended?: boolean }) {
  const ceiling = websiteJobCeiling(input);
  const safetyLimitUsd = websiteJobSafetyLimitUsd(ceiling);
  // An unreadable screening publication fills the limit that applies to this admission: the safety limit
  // on a flagged grant (where build stops), else the ceiling. It never under-counts against either.
  const spend = await websiteJobSpend({ ...input,
    ceiling: input.extended ? { maximum_cost_usd: safetyLimitUsd } : ceiling });
  const after = spend.total_micros + micros(input.additionalCostUsd);
  const exceeded = after > Math.floor(ceiling.maximum_cost_usd * 1_000_000);
  const pastSafetyLimit = after > Math.floor(safetyLimitUsd * 1_000_000);
  return { ceiling, spend, exceeded, safetyLimitUsd, pastSafetyLimit };
}

/** Refuses new spend that would take the job past its ceiling. Reads only; the caller writes. */
export async function assertWithinWebsiteJobCeiling(input: WebsiteJobCeilingInput) {
  const { ceiling, spend, exceeded } = await checkWebsiteJobCeiling(input);
  if (exceeded) throw new Error("website_scene_preparation_budget_exhausted");
  return { ceiling, spend };
}
