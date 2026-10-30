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
 */
import { websiteAtlasGrantPolicy } from "./websiteAtlasAuthorization";
import { parseBetaPolicyScreeningPublication, screeningMoneyMicros, SCREENING_SITE_LIMIT_USD } from "./betaPolicyScreeningContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";

/** The owner's existing per-job ceiling for website jobs (2026-10-30). It
 * applies only when neither the job's Atlas authorization nor the configured
 * Atlas grant policy (`BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON`) names one. */
export const WEBSITE_JOB_CEILING_DEFAULT_USD = 40;

export type WebsiteJobCeilingSource = "atlas_authorization" | "retained_atlas_grant" | "atlas_grant_policy"
  | "owner_default";

const micros = (usd: number) => Math.ceil(usd * 1_000_000);
const dollars = (value: number) => value / 1_000_000;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Where the ceiling comes from, in order: the Atlas authorization this
 * admission is made under (an explicit owner row or the job's stored automatic
 * grant, which pinned the configured policy's figure when it was made); else
 * the job's stored grant for this capture; else the configured Atlas grant
 * policy; else the owner default. All are the same owner figure ($40 today),
 * and a stored grant keeps the figure it was made with.
 */
export function websiteJobCeiling(input: { record: Record<string, any>; captureId: string;
  atlas?: { maximum_cost_usd: number } | null }): { maximum_cost_usd: number; source: WebsiteJobCeilingSource } {
  if (input.atlas) return { maximum_cost_usd: input.atlas.maximum_cost_usd, source: "atlas_authorization" };
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

/**
 * A sponsored scene intake grants native construction its own allowance
 * (`request.execution.max_total_spend_usd`, raised by any recorded budget
 * extension). It is held in full while the intake can still start an attempt.
 * Once closed, it counts what its attempts reserved, the most the Pipeline
 * reports for native work. An unreadable allowance counts as unbounded.
 */
function nativeIntakeMicros(intake: Record<string, any>) {
  const status = intake.pipeline_status, attempts = Array.isArray(status?.attempts) ? status.attempts : [];
  const reserved = attempts.reduce((sum: number, attempt: any) =>
    sum + (amount(attempt?.maximum_spend_usd) ? micros(attempt.maximum_spend_usd) : Infinity), 0);
  const unissued = !intake.receipt && ["revoked", "expired"].includes(intake.state);
  if (intake.closeout_complete === true || ["completed", "blocked"].includes(intake.state) || unissued) return reserved;
  const granted = intake.request?.execution?.max_total_spend_usd;
  const extended = status?.effective_execution_budget?.max_total_spend_usd;
  if (!amount(granted)) return Infinity;
  return Math.max(micros(granted), amount(extended) ? micros(extended) : 0, reserved);
}

/**
 * The screening site ledger is site-wide and every publication carries its
 * whole snapshot, so the latest one counts: its spent upper bound (charged at
 * the full reservation once allocated) plus its open reservations. A run with
 * no readable publication counts the full screening site limit.
 */
function screeningMicros(rows: Array<{ run: Record<string, any>; result: Record<string, any> | null }>) {
  if (rows.length === 0) return 0;
  const publications = rows.map(row => row.result ? parseBetaPolicyScreeningPublication(publicationFromResultRecord(row.result)) : null);
  if (publications.some(publication => publication === null)) return micros(SCREENING_SITE_LIMIT_USD);
  const latest = publications.reduce((best, publication) => !best
    || Date.parse(publication!.generated_at) > Date.parse(best.generated_at)
    || Date.parse(publication!.generated_at) === Date.parse(best.generated_at) && publication!.revision > best.revision
    ? publication : best, null as ReturnType<typeof parseBetaPolicyScreeningPublication>)!;
  return Number(screeningMoneyMicros(latest.budget.committed_upper_bound_usd));
}

export async function websiteJobSpend(input: { record: Record<string, any>; reader: WebsiteJobLedgerReader }) {
  const preparation = Object.values(input.record.website_preparation_reservations ?? {})
    .reduce((sum: number, row) => sum + preparationRowMicros(row), 0);
  const native = (await input.reader.sceneIntakes()).reduce((sum, intake) => sum + nativeIntakeMicros(intake), 0);
  const screening = screeningMicros(await input.reader.screeningRuns());
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

/** Refuses new spend that would take the job past its ceiling. Reads only; the caller writes. */
export async function assertWithinWebsiteJobCeiling(input: { record: Record<string, any>; captureId: string;
  atlas?: { maximum_cost_usd: number } | null; reader: WebsiteJobLedgerReader; additionalCostUsd: number }) {
  const ceiling = websiteJobCeiling(input);
  const spend = await websiteJobSpend(input);
  if (spend.total_micros + micros(input.additionalCostUsd) > Math.floor(ceiling.maximum_cost_usd * 1_000_000))
    throw new Error("website_scene_preparation_budget_exhausted");
  return { ceiling, spend };
}
