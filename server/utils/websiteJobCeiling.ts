/**
 * One cap per website job (owner decision 2026-11-19, "One cap at $40").
 *
 * A job may spend at most `WEBSITE_JOB_SPEND_CAP_USD` in total, across every paid provider (Gemini, Meta
 * SAM, World Labs, OpenAI including ARTISAN, Vast) and every retry. The figure has one source, the
 * Pipeline's `config/website_job_spend_cap.v1.json`, mirrored here byte for byte
 * (`contracts/pipeline/website-job-spend-cap.v1.json`, checked by `npm run pipeline:website-job-spend-cap:verify`).
 * The account's monthly limit (Pipeline `account_monthly_spend`) still applies on top.
 *
 * Every WebApp admission of new spend for a job (a preparation reservation, a scene intake) counts what the
 * job's ledgers already hold, each row at its settled cost where known and otherwise at its held quote, adds
 * the new quote, and refuses past the cap with `website_scene_preparation_budget_exhausted`, which the
 * Pipeline reads as `spending_cap_reached`: no further paid call starts, and the job ships what it has,
 * flagged. Nothing raises the cap: owner grants, Atlas authorization figures, grant policies, the old $100
 * safety limit and the automatic budget extension are gone.
 *
 * The video reading's paid calls (`captureCoverageInferenceBudget.ts`) are one of these ledgers: every capture of the
 * job counts its whole exposure, held plus settled, the figure the reading's own admission counts. So whichever
 * admission comes last, a reading or any other, the job's total across all of them stays inside the cap.
 *
 * A job in flight across the switch is counted the same way: every row it holds or settled before counts
 * against the cap, read exactly as before. A job already past it admits nothing more.
 */
import capContract from "../../contracts/pipeline/website-job-spend-cap.v1.json";
import { parseBetaPolicyScreeningPublication, screeningMoneyMicros, SCREENING_LEGACY_SITE_LIMIT_USD } from "./betaPolicyScreeningContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { isNavigationStrategy } from "./navigationSceneIntake";
import { humanDecisionDigest } from "./human-reply-admission";

/** The most one website job may spend, in dollars: the committed figure, never a hosting setting. */
export const WEBSITE_JOB_SPEND_CAP_USD = (() => {
  const figure = (capContract as { per_job_cap_usd?: unknown }).per_job_cap_usd;
  const value = typeof figure === "string" && /^[1-9][0-9]{0,3}(\.[0-9]{1,2})?$/.test(figure) ? Number(figure) : NaN;
  if (!Number.isFinite(value)) throw new Error("website_job_spend_cap_unavailable");
  return value;
})();

const micros = (usd: number) => Math.ceil(usd * 1_000_000);
const dollars = (value: number) => value / 1_000_000;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** The job's cap. One number for every job; nothing raises it. */
export function websiteJobCeiling(): { maximum_cost_usd: number; source: "job_spending_cap" } {
  return { maximum_cost_usd: WEBSITE_JOB_SPEND_CAP_USD, source: "job_spending_cap" };
}

/** Reads the job's other ledgers; the caller supplies the transaction. */
export type WebsiteJobLedgerReader = {
  sceneIntakes(): Promise<Array<Record<string, any>>>;
  screeningRuns(): Promise<Array<{ run: Record<string, any>; result: Record<string, any> | null }>>;
  /** Each capture of the job with the video reading's budget record for it (null when it has none). */
  captureReadings(): Promise<Array<{ capture_id: string; budget: Record<string, any> | null }>>;
};

type Store = { collection(name: string): any };
type Transaction = { get(reference: any): Promise<any> };

const CAPTURE_ID = /^[A-Za-z0-9._-]{1,200}$/;
/** The video reading's budget record for one capture, as `captureCoverageInferenceBudget.ts` keys it. */
export const captureReadingBudgetId = (captureId: string) => `budget-${humanDecisionDigest({ capture_id: captureId })}`;

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
    // Every capture the job has named: the one the job's privacy decision binds now (every reading is admitted only
    // against it), each capture a reading review or a reading budget names for the job, and each video the site
    // uploaded for it. Single-field queries on one collection; no new index.
    captureReadings: async () => {
      const reviews = store.collection("captureCoverageReviews");
      const record = (await transaction.get(store.collection("inboundRequests").doc(requestId))).data() ?? {};
      const named = (await transaction.get(reviews.where("requestId", "==", requestId))).docs.map((row: any) => row.data()?.captureId);
      const budgets = (await transaction.get(reviews.where("request_id", "==", requestId))).docs.map((row: any) => row.data()?.capture_id);
      const uploads = (await transaction.get(store.collection("captureUploadSessions")
        .where("browser_pending_delivery.request_id", "==", requestId))).docs.map((row: any) => row.id);
      const captures = [...new Set([record.capture_privacy_source_bound_decision?.capture_id, record.capture_privacy_screen?.capture_id,
        ...named, ...budgets, ...uploads])].filter((id): id is string => typeof id === "string" && CAPTURE_ID.test(id)).sort();
      return Promise.all(captures.map(async capture_id => ({ capture_id,
        budget: (await transaction.get(reviews.doc(captureReadingBudgetId(capture_id)))).data() ?? null })));
    },
  };
}

/** One preparation row: its settlement, else its full reservation (per-row rounding as admission always did). */
function preparationRowMicros(row: any) {
  const settled = row?.settlement?.actual_cost_usd, held = row?.admission?.maximum_cost_usd;
  if (row?.settlement !== undefined) return amount(settled) ? micros(settled) : Infinity;
  return amount(held) ? micros(held) : Infinity;
}
/** The part of a row that can be read: an unreadable settlement is bounded by its readable hold (a settlement never passes it). */
function readablePreparationRowMicros(row: any) {
  const value = preparationRowMicros(row), held = row?.admission?.maximum_cost_usd;
  return Number.isFinite(value) ? value : amount(held) ? micros(held) : 0;
}

/** The Pipeline's own status shows the intent can start no further attempt. A terminal outcome (the job's
 * spending cap reached among them) ends it: the Pipeline starts nothing after one, so the intent's allowance is
 * released down to what its attempts still hold. */
function pipelineEnded(status: Record<string, any> | undefined) {
  return ["completed", "expired", "revoked"].includes(status?.status)
    || status?.outcome?.terminal === true
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
function readableAttemptMicros(attempt: any) {
  const finite = (value: number) => Number.isFinite(value) ? value : 0;
  const live = attempt?.status === "cancelled_before_execution" ? 0
    : amount(attempt?.maximum_spend_usd) ? micros(attempt.maximum_spend_usd) : 0;
  return Math.max(live, amount(attempt?.retained_spend_usd) ? finite(micros(attempt.retained_spend_usd)) : 0);
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
function nativeIntakeMicros(intake: Record<string, any>, readableOnly = false) {
  const status = intake.pipeline_status, attempts = Array.isArray(status?.attempts) ? status.attempts : [];
  // Readable only: what the readable figures alone say (an unreadable attempt figure or allowance adds nothing).
  const attemptValue = (attempt: any) => readableOnly ? readableAttemptMicros(attempt) : attemptMicros(attempt);
  const reserved = attempts.reduce((sum: number, attempt: any) => sum + attemptValue(attempt), 0);
  if (isNavigationStrategy(intake.request?.task?.strategy)) return reserved;
  const settledReported = attempts.some((attempt: any) => attempt?.retained_spend_usd !== undefined);
  const granted = intake.request?.execution?.max_total_spend_usd;
  const extended = status?.effective_execution_budget?.max_total_spend_usd;
  // The Pipeline refuses any reservation that would take the intent's holds past
  // this (extended) budget, so it bounds what native construction can spend.
  const budget = amount(granted) ? Math.max(micros(granted), amount(extended) ? micros(extended) : 0) : Infinity;
  if (readableOnly && !Number.isFinite(budget)) return reserved;
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
 * the full reservation once allocated) plus its open reservations. A run with
 * no readable publication counts the full screening site limit, as before.
 */
function screeningMicros(rows: Array<{ run: Record<string, any>; result: Record<string, any> | null }>, unreadable: string[]) {
  if (rows.length === 0) return { counted: 0, readable: 0 };
  const publications = rows.map(row => row.result ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(row.result)) : null);
  // The latest snapshot among the publications that can be read; it carries the whole site ledger.
  const valid = publications.filter((publication): publication is NonNullable<typeof publication> => publication !== null);
  const latest = valid.reduce<typeof valid[number] | null>((best, publication) => !best
    || Date.parse(publication.generated_at) > Date.parse(best.generated_at)
    || Date.parse(publication.generated_at) === Date.parse(best.generated_at) && publication.revision > best.revision
    ? publication : best, null);
  const readable = latest ? Number(screeningMoneyMicros(latest.budget.committed_upper_bound_usd)) : 0;
  if (valid.length < publications.length) {
    rows.forEach((row, index) => { if (publications[index] === null)
      unreadable.push(`screening result ${String(row.run?.result_record_id ?? row.run?.run_id ?? "with no record id")}`); });
    // Counted at the site limit as before, and never below what the latest valid publication commits: the cap
    // is the only stop, so an unreadable sibling must never lower the count (review of #1274: $120 committed).
    return { counted: Math.max(micros(SCREENING_LEGACY_SITE_LIMIT_USD), readable), readable };
  }
  return { counted: readable, readable };
}

/**
 * What the job holds or spent on each ledger (an unbounded hold is unbounded, so the cap refuses; an
 * unreadable screening result counts the $30 site limit). Beside it, `readable_total_micros` is what the
 * records that can be read add up to (the admin job page's figure), and `unreadable` names each record
 * whose figure cannot be read, so a person is told (`spend_unreadable`).
 */
export async function websiteJobSpend(input: { record: Record<string, any>; reader: WebsiteJobLedgerReader }) {
  const unreadable: string[] = [];
  let readable = 0;
  const preparation = Object.entries(input.record.website_preparation_reservations ?? {})
    .reduce((sum: number, [key, row]) => {
      const value = preparationRowMicros(row);
      readable += readablePreparationRowMicros(row);
      if (!Number.isFinite(value)) unreadable.push(`preparation reservation ${key}`);
      return sum + value;
    }, 0);
  const native = (await input.reader.sceneIntakes()).reduce((sum, intake) => {
    const value = nativeIntakeMicros(intake);
    readable += Number.isFinite(value) ? value : nativeIntakeMicros(intake, true);
    if (!Number.isFinite(value)) unreadable.push(`scene intake ${String(intake?.command?.submission_id ?? intake?.request?.submission_id ?? "with no submission id")}`);
    return sum + value;
  }, 0);
  const screening = screeningMicros(await input.reader.screeningRuns(), unreadable);
  readable += screening.readable;
  // The video reading's whole exposure on each capture: what its calls hold, plus what answered calls cost past
  // their hold. A record that cannot be read counts as unbounded, as the reading's own admission refuses it.
  const reading = (await input.reader.captureReadings()).reduce((sum, { capture_id, budget }) => {
    if (!budget) return sum;
    const value = budget.capture_id === capture_id && amount(budget.exposure_usd) ? micros(budget.exposure_usd) : Infinity;
    if (Number.isFinite(value)) readable += value;
    else unreadable.push(`video reading of capture ${capture_id}`);
    return sum + value;
  }, 0);
  return { preparation_micros: preparation, native_construction_micros: native, screening_micros: screening.counted,
    capture_reading_micros: reading, total_micros: preparation + native + screening.counted + reading,
    readable_total_micros: readable, unreadable };
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
    capture_reading_cost_usd: finite(spend.capture_reading_micros),
    reserved_or_settled_cost_usd: finite(spend.total_micros),
    remaining_cost_usd: Number.isFinite(spend.total_micros) ? dollars(Math.max(0, limit - spend.total_micros)) : 0 };
}

type WebsiteJobCeilingInput = { record: Record<string, any>; reader: WebsiteJobLedgerReader; additionalCostUsd: number };

/** Whether new spend would take the job past its cap, counted as above. Reads only; the caller decides and writes. */
export async function checkWebsiteJobCeiling(input: WebsiteJobCeilingInput) {
  const ceiling = websiteJobCeiling();
  const spend = await websiteJobSpend(input);
  const exceeded = spend.total_micros + micros(input.additionalCostUsd) > Math.floor(ceiling.maximum_cost_usd * 1_000_000);
  return { ceiling, spend, exceeded };
}

/** Refuses new spend that would take the job past its cap. Reads only; the caller writes. */
export async function assertWithinWebsiteJobCeiling(input: WebsiteJobCeilingInput) {
  const { ceiling, spend, exceeded } = await checkWebsiteJobCeiling(input);
  if (exceeded) throw new Error("website_scene_preparation_budget_exhausted");
  return { ceiling, spend };
}
