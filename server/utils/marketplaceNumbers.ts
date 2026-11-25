/**
 * The owner's marketplace numbers (owner direction, 2026-11-25: three numbers to watch every day), on the staff job page
 * (`GET /api/admin/jobs/marketplace-numbers`, `client/src/components/admin/MarketplaceNumbers.tsx`). Read only.
 *
 * ## The window
 *
 * A job belongs to the UTC day it was shared with companies, and the window is the last 7 or 30 UTC days, today
 * included. Shared: Blueprint's automatic send of the job to every approved deployment company
 * (`company_auto_send.sentAtIso`, `jobAutoSend.ts`, written once, the moment the job first became listed). An internal
 * test job is never sent that way; it is shared when it is sent to Blueprint's internal test company (its standing
 * `companySends` row), and is left out unless the switch includes it. A company's workspace evaluation is not a site
 * job and is never counted.
 *
 * ## What each number rests on
 *
 * - The video arrived: the earliest upload time the job's capture records hold (`videoReceivedAtIso`, the walkthrough
 *   and the current capture), not an email notice.
 * - A response: a company's answer on the job (`robotTeamInterest`), recorded by the company or, before 2026-11-22, by
 *   staff from its email; at the time it was first given (`firstAnsweredAtIso`). An answer from before package C1 is
 *   not one. When any answer on the job lacks its first time, the job's first response time is not known.
 * - An application ("Apply"): an answer of Apply or Tested it: can do, the two a site can accept. It counts once given,
 *   even if changed since (`firstAppliedAtIso`, or `appliedAtOrBeforeIso` when only a bound is known; fields added
 *   2026-11-25). An older answer standing as an application has its time only when it was never edited; otherwise its
 *   time is not known unless its bounds meet, and no time is made up.
 * - An introduction: made when the company's email with the site's details was sent (its billable event's `madeAtIso`;
 *   on an internal test job, the test event's). One the site asked for that is not made yet is counted apart.
 * - Outcomes: what is recorded on an introduction that was made (`OUTCOME_READERS`, one row per kind; add a row to
 *   read a new field).
 * - Spend: what the job's ledgers count against its one cap (`websiteJobSpend`, every ledger the cap counts: each row
 *   at its settlement, else its full hold), and by ledger, with the model lanes by lane. A job with no ledger row, or a
 *   row whose figure cannot be read, is left out of the spread and counted apart.
 * - Simulation use: the counters `simulationUse.ts` keeps since it went live. A job with none reads "No data yet".
 *
 * ## Every record, a page at a time
 *
 * The whole window is read, never a first page taken as the whole (`server/AGENTS.md`), so no number leans toward the
 * newest jobs: one range query on the share time (Firestore's automatic single-field index), newest first, paged with a
 * cursor on the last document (its share time, then its id) until the window ends; with test jobs, every test job by
 * the marker's creation time, paged the same way. Per job: its answers, introductions, billable events and counters,
 * each paged in document-id order to the end, and its ledgers as the cap reads them (`transactionJobLedgerReader`, with
 * its own limits). Each page is at most `MARKETPLACE_PAGE_SIZE` documents; the video times are one `getAll` per page of
 * jobs; jobs are read `READ_CONCURRENCY` at a time. One safety ceiling stops a runaway read:
 * `MARKETPLACE_JOB_CEILING` jobs per query and `MARKETPLACE_RECORD_CEILING` records of one kind per job. Reaching one
 * is said on the page; no real window comes near either.
 *
 * No site name, address or contact, and no company name, leaves here: job ids, times and counts only.
 */
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { INTRODUCIBLE_RESPONSE_STATES, isCompanyResponseState, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { EARLIER_OUTCOME_STATES, OUTCOME_STATES, OUTCOME_STATE_LABELS } from "../../client/src/lib/jobOutcomeStates";
import type { MarketplaceDuration, MarketplaceJobRow, MarketplaceJobSpend, MarketplaceLaneSpend, MarketplaceNumbers,
  MarketplaceOutcomeRow, MarketplaceShare, MarketplaceStep, MarketplaceUsdSpread, MarketplaceUse, MarketplaceWindow }
  from "../../client/src/types/marketplaceNumbers";
import { isMadeBillableEvent, jobBillableEventStatesQuery, TEST_NO_CHARGE_STATUS } from "./billableEvents";
import { INTERNAL_TEST_FIELD, isInternalTestJob } from "./internalTestJob";
import { isSiteJobRecord, videoReceivedAtIso } from "./jobConsoleData";
import { COMPANY_RESPONSES_COLLECTION, COMPANY_SENDS_COLLECTION, INTRODUCTIONS_COLLECTION } from "./jobCompanies";
import { outcomesOf } from "./jobOutcomeGate";
import { SIMULATION_USE_COLLECTION, simulationUseRowOf, type SimulationUseRow } from "./simulationUse";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { object, text } from "./workspace-projection";
import { WEBSITE_JOB_SPEND_CAP_USD } from "./websiteJobCeiling";

type Data = Record<string, any>;
type Store = FirebaseFirestore.Firestore;

const JOBS = "inboundRequests";
/** The automatic send's marker on the job (`AUTO_SEND_FIELD` in `jobAutoSend.ts`). */
export const SHARED_FIELD = "company_auto_send";
/** Documents per page of every read. */
export const MARKETPLACE_PAGE_SIZE = 200;
/** Safety ceilings, far above any real window: jobs per query, and records of one kind per job. */
export const MARKETPLACE_JOB_CEILING = 10_000;
export const MARKETPLACE_RECORD_CEILING = 10_000;
const READ_CONCURRENCY = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------------------ the math */

/** The middle value; for an even count, the mean of the two middle values. Null for none. */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The nearest-rank percentile: the smallest value with at least `p` percent of the values at or below it. Null for none. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length))) - 1];
}

export function shareOf(count: number, of: number): MarketplaceShare {
  return { count, of, share: of > 0 ? count / of : null };
}

/** The first UTC day of a window of `days` days that ends today, at 00:00Z. */
export function windowStartIso(now: Date, days: number): string {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (Math.max(1, Math.floor(days)) - 1) * DAY_MS).toISOString();
}

/** A stored instant, only when it is one. */
function instant(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)) ? value : null;
}
const ms = (value: unknown): number | null => { const at = instant(value); return at ? Date.parse(at) : null; };

const dollars = (micros: number) => Math.round(micros / 10_000) / 100;

function usdSpread(micros: readonly number[]): MarketplaceUsdSpread | null {
  if (!micros.length) return null;
  return { jobs: micros.length, medianUsd: dollars(median(micros)!), p90Usd: dollars(percentile(micros, 90)!),
    maxUsd: dollars(Math.max(...micros)), totalUsd: dollars(micros.reduce((sum, value) => sum + value, 0)) };
}

/* ------------------------------------------------------------------------- one job's facts */

/** A company's answer that is a response: a known state, recorded by the company or by staff from its email. */
export function isResponse(answer: Data | undefined): boolean {
  return Boolean(answer) && isCompanyResponseState(answer!.state) && (answer!.recordedBy === "company" || answer!.recordedBy === "operator");
}

/**
 * When the company first applied, as bounds in milliseconds (equal when known; -Infinity or Infinity where a bound is
 * not on record), or null when the answer is not an application. An answer that applied counts whatever it says now
 * (`firstAppliedAtIso`, or `appliedAtOrBeforeIso` when only a bound is known: `firstApplicationFields`, `jobCompanies.ts`).
 */
export function applicationBounds(answer: Data | undefined): { lo: number; hi: number } | null {
  if (!isResponse(answer)) return null;
  const applied = ms(answer!.firstAppliedAtIso);
  if (applied !== null) return { lo: applied, hi: applied };
  const first = ms(answer!.firstAnsweredAtIso);
  const atOrBefore = ms(answer!.appliedAtOrBeforeIso);
  if (atOrBefore !== null) return { lo: first ?? -Infinity, hi: atOrBefore };
  if (!INTRODUCIBLE_RESPONSE_STATES.includes(answer!.state as CompanyResponseState)) return null;
  const updated = ms(answer!.updatedAtIso);
  if (first !== null && first === updated) return { lo: first, hi: first };
  return { lo: first ?? -Infinity, hi: updated ?? Infinity };
}

function stepAt(atMs: number, videoMs: number | null): MarketplaceStep {
  return { state: "at", atIso: new Date(atMs).toISOString(), afterVideoMs: videoMs !== null && atMs >= videoMs ? atMs - videoMs : null };
}

/** The job's first response: none, its time, or not known (an answer whose first time is not on record). */
export function firstResponseStep(answers: readonly Data[], videoMs: number | null): MarketplaceStep {
  const times = answers.filter(isResponse).map(answer => ms(answer.firstAnsweredAtIso));
  if (!times.length) return { state: "none" };
  if (times.some(time => time === null)) return { state: "time_unknown" };
  return stepAt(Math.min(...(times as number[])), videoMs);
}

/** The job's first application: none, its time, or not known (the earliest one's bounds do not meet). */
export function firstApplyStep(answers: readonly Data[], videoMs: number | null): MarketplaceStep {
  const bounds = answers.map(applicationBounds).filter((bound): bound is { lo: number; hi: number } => bound !== null);
  if (!bounds.length) return { state: "none" };
  const lo = Math.min(...bounds.map(bound => bound.lo)), hi = Math.min(...bounds.map(bound => bound.hi));
  return lo === hi && Number.isFinite(lo) ? stepAt(lo, videoMs) : { state: "time_unknown" };
}

/** The companies whose introduction on the job was made (a made billable event of any attempt; a test event on a test job). */
export function madeIntroductionCompanies(events: readonly Data[]): Set<string> {
  return new Set(events.filter(event => isMadeBillableEvent(event)
    || (event.status === TEST_NO_CHARGE_STATUS && typeof event.madeAtIso === "string" && event.madeAtIso.length > 0))
    .map(event => text(event.companyId)).filter(Boolean));
}

/**
 * What can be recorded after an introduction, one row each. Read from the introduction record (`jobIntroductions.ts`,
 * `jobOutcomes.ts`): the site's own marks for a visit and a pilot (`progress`), and each answer either side gave to
 * "How did it go?" (`outcomes`). To read a new outcome field, add a row; its key and label are shown as given.
 */
export interface OutcomeReader { key: string; label: string; recorded: (introduction: Data) => boolean }
export const OUTCOME_READERS: readonly OutcomeReader[] = [
  { key: "visit", label: "Visit (marked by the site)", recorded: introduction => Boolean(instant(object(introduction.progress).visitAtIso)) },
  { key: "pilot", label: "Pilot (marked by the site)", recorded: introduction => Boolean(instant(object(introduction.progress).pilotAtIso)) },
  ...OUTCOME_STATES.map((state): OutcomeReader => ({ key: `answer_${state}`, label: OUTCOME_STATE_LABELS[state],
    recorded: introduction => outcomesOf(introduction).some(record => record.state === state) })),
  // Answers the follow-up offered before 2026-11-25 still count where they were given.
  ...EARLIER_OUTCOME_STATES.map((state): OutcomeReader => ({ key: `answer_${state}`, label: `${OUTCOME_STATE_LABELS[state]} (earlier answer)`,
    recorded: introduction => outcomesOf(introduction).some(record => record.state === state) })),
];

/** The ledgers the cap counts, as the page names them; model lanes are `model_lane:<lane>`. */
const LEDGER_LABELS: ReadonlyArray<[string, string]> = [
  ["preparation", "Preparation (Pipeline)"],
  ["scene_construction", "Scene construction"],
  ["video_readings", "Video readings"],
  ["screening", "Early trial (retired)"],
];
const MODEL_LANE_LABELS: Readonly<Record<string, string>> = {
  free_text_redaction: "Checking words for names and contact details",
  site_task_follow_up: "Follow-up question picker",
  job_brief: "Job brief",
  job_brief_lesson: "Lessons from companies' answers",
};
const laneLabel = (key: string) => LEDGER_LABELS.find(([ledger]) => ledger === key)?.[1]
  ?? (key.startsWith("model_lane:") ? MODEL_LANE_LABELS[key.slice(11)] ?? `Model lane: ${key.slice(11) || "unnamed"}` : key);

/** One job's spend as its ledgers count it, in micro-dollars by lane (Infinity: a figure that cannot be read). */
export type JobSpendFacts =
  | { state: "counted"; totalMicros: number; lanes: Record<string, number> }
  | { state: "unreadable"; lanes: Record<string, number> }
  | { state: "no_ledger" }
  | { state: "unavailable" };

/** Everything the numbers read of one shared job. */
export interface MarketplaceJobInput {
  jobId: string;
  internalTest: { label: string | null } | null;
  sharedAtIso: string;
  videoAtIso: string | null;
  /** Its `robotTeamInterest` rows (the id is the company's). */
  answers: Array<{ companyId: string; data: Data }>;
  introductions: Array<{ companyId: string; data: Data }>;
  billableEvents: Data[];
  /** Null when the counters could not be read. */
  simulationUse: SimulationUseRow[] | null;
  spend: JobSpendFacts;
}

function useOf(rows: SimulationUseRow[] | null, kind: SimulationUseRow["kind"]): number | null {
  const mine = (rows ?? []).filter(row => row.kind === kind);
  return mine.length ? mine.reduce((sum, row) => sum + row.count, 0) : null;
}

function spendRow(spend: JobSpendFacts): MarketplaceJobSpend {
  return spend.state === "counted" ? { state: "counted", usd: dollars(spend.totalMicros) } : { state: spend.state };
}

/** One job's row and the facts the window's numbers add up. */
export function marketplaceJobOf(input: MarketplaceJobInput) {
  const answers = input.answers.map(row => row.data);
  const videoMs = ms(input.videoAtIso);
  const responses = input.answers.filter(row => isResponse(row.data));
  const applications = input.answers.filter(row => applicationBounds(row.data) !== null).map(row => row.companyId);
  const made = madeIntroductionCompanies(input.billableEvents);
  const standing = input.introductions.filter(row => typeof row.data.cancelledAtIso !== "string");
  const row: MarketplaceJobRow = {
    jobId: input.jobId,
    internalTest: input.internalTest,
    sharedAtIso: input.sharedAtIso,
    videoAtIso: input.videoAtIso,
    firstResponse: firstResponseStep(answers, videoMs),
    firstApply: firstApplyStep(answers, videoMs),
    responses: responses.length,
    applications: applications.length,
    introductions: made.size,
    introductionsWaiting: standing.filter(intro => !made.has(intro.companyId)).length,
    spend: spendRow(input.spend),
    simulationOpens: useOf(input.simulationUse, "viewer_open"),
    simulationDownloads: useOf(input.simulationUse, "download"),
  };
  return {
    row,
    states: responses.map(response => response.data.state as CompanyResponseState),
    applicationsIntroduced: applications.filter(companyId => made.has(companyId)).length,
    madeIntroductions: standing.filter(intro => made.has(intro.companyId)).map(intro => intro.data),
  };
}

function durationOf(steps: readonly MarketplaceStep[]): MarketplaceDuration {
  const values: number[] = [];
  let waiting = 0, notMeasurable = 0;
  for (const step of steps) {
    if (step.state === "none") waiting += 1;
    else if (step.state === "at" && step.afterVideoMs !== null) values.push(step.afterVideoMs);
    else notMeasurable += 1;
  }
  return { measured: values.length, medianMs: median(values), p90Ms: percentile(values, 90), waiting, notMeasurable };
}

function laneSpends(inputs: readonly MarketplaceJobInput[]): MarketplaceLaneSpend[] {
  const withLedgers = inputs.map(input => input.spend).filter((spend): spend is Extract<JobSpendFacts, { lanes: unknown }> =>
    spend.state === "counted" || spend.state === "unreadable");
  const seen = new Set(withLedgers.flatMap(spend => Object.keys(spend.lanes)));
  const keys = [...LEDGER_LABELS.map(([key]) => key).filter(key => seen.has(key)),
    ...[...seen].filter(key => key.startsWith("model_lane:")).sort()];
  return keys.map(key => {
    const values = withLedgers.map(spend => spend.lanes[key] ?? 0);
    const readable = values.filter(Number.isFinite);
    return { key, label: laneLabel(key), spread: usdSpread(readable), unreadable: values.length - readable.length };
  }).filter(lane => lane.unreadable > 0 || (lane.spread?.maxUsd ?? 0) > 0);
}

function useSummary(inputs: readonly MarketplaceJobInput[], kind: SimulationUseRow["kind"]): MarketplaceUse | null {
  const rows = inputs.flatMap(input => (input.simulationUse ?? []).filter(row => row.kind === kind).map(row => ({ ...row, jobId: input.jobId })));
  if (!rows.length) return null;
  return { total: rows.reduce((sum, row) => sum + row.count, 0), jobs: new Set(rows.filter(row => row.count > 0).map(row => row.jobId)).size,
    companies: new Set(rows.filter(row => row.count > 0).map(row => row.companyId)).size };
}

/** The window's numbers from its jobs' facts. Pure: every figure is worked out here and nowhere else. */
export function marketplaceNumbersOf(inputs: readonly MarketplaceJobInput[], meta: { windowDays: MarketplaceWindow;
  includeTests: boolean; sinceIso: string; generatedAtIso: string; limits?: readonly string[] }): MarketplaceNumbers {
  const jobs = inputs.map(marketplaceJobOf);
  const states = jobs.flatMap(job => job.states);
  const applications = jobs.reduce((sum, job) => sum + job.row.applications, 0);
  const made = jobs.flatMap(job => job.madeIntroductions);
  const introductionsMade = jobs.reduce((sum, job) => sum + job.row.introductions, 0);
  const outcomes: MarketplaceOutcomeRow[] = OUTCOME_READERS.map(reader => ({ key: reader.key, label: reader.label,
    introductions: made.filter(introduction => { try { return reader.recorded(introduction); } catch { return false; } }).length }));
  const counted = inputs.flatMap(input => input.spend.state === "counted" ? [input.spend.totalMicros] : []);
  const spendCount = (state: JobSpendFacts["state"]) => inputs.filter(input => input.spend.state === state).length;
  return {
    windowDays: meta.windowDays,
    includeTests: meta.includeTests,
    sinceIso: meta.sinceIso,
    generatedAtIso: meta.generatedAtIso,
    sharedJobs: inputs.length,
    limits: [...new Set(meta.limits ?? [])],
    headline: {
      firstResponse: durationOf(jobs.map(job => job.row.firstResponse)),
      firstApply: durationOf(jobs.map(job => job.row.firstApply)),
      jobsWithApply: shareOf(jobs.filter(job => job.row.applications > 0).length, inputs.length),
      applicationsIntroduced: shareOf(jobs.reduce((sum, job) => sum + job.applicationsIntroduced, 0), applications),
    },
    answers: {
      needMoreDetails: shareOf(states.filter(state => state === "needs_something").length, states.length),
      notAFit: shareOf(states.filter(state => state === "declined").length, states.length),
    },
    outcomes: { introductions: introductionsMade, rows: outcomes },
    cost: { perJob: usdSpread(counted), noLedger: spendCount("no_ledger"), unreadable: spendCount("unreadable"),
      unavailable: spendCount("unavailable"), lanes: laneSpends(inputs), capUsd: WEBSITE_JOB_SPEND_CAP_USD },
    simulation: { viewerOpens: useSummary(inputs, "viewer_open"), downloads: useSummary(inputs, "download") },
    jobs: jobs.map(job => job.row).sort((a, b) => b.sharedAtIso.localeCompare(a.sharedAtIso) || a.jobId.localeCompare(b.jobId)),
  };
}

/* ------------------------------------------------------------------------------- the reads */

/** The job fields the numbers read: enough to tell a site job, its share time, its capture and its preparation ledger. */
const JOB_FIELDS = ["request.buyerType", "workspace_evaluation", INTERNAL_TEST_FIELD, SHARED_FIELD, "active_capture_id",
  "website_preparation_reservations"];
const VIDEO_FIELDS = ["browser_stored_upload.completed_at_iso", "browser_pending_delivery.completed_at_iso", "site_capture_bundle.recorded_at_iso"];

type SharedJob = { jobId: string; record: Data; sharedAtIso: string };
type Doc = FirebaseFirestore.QueryDocumentSnapshot;

async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; out[index] = await work(items[index]); }
  }));
  return out;
}

/**
 * Every document an ordered query matches, `MARKETPLACE_PAGE_SIZE` at a time, each page starting after the last
 * document of the one before (its ordered values, then its id), until a page comes back short. `ceiling` stops a
 * runaway read: `cut` says documents remain past it (one more is asked to tell).
 */
export async function readEveryPage(query: FirebaseFirestore.Query, ceiling: number): Promise<{ docs: Doc[]; cut: boolean }> {
  const docs: Doc[] = [];
  let after: Doc | null = null;
  for (;;) {
    const room = Math.min(MARKETPLACE_PAGE_SIZE, ceiling - docs.length);
    const from = after ? query.startAfter(after) : query;
    if (room <= 0) return { docs, cut: (await from.limit(1).get()).docs.length > 0 };
    const page = await from.limit(room).get();
    docs.push(...page.docs);
    if (page.docs.length < room) return { docs, cut: false };
    after = page.docs[page.docs.length - 1];
  }
}

/** One loader's reads: its store, the safety ceilings, and the sentences that say a ceiling was reached. */
type Reads = { store: Store; jobCeiling: number; recordCeiling: number; limits: string[] };
const count = (value: number) => value.toLocaleString("en-US");

/** Every record an ordered query on one job matches, a page at a time; the safety ceiling reached is said. */
async function everyRecord(reads: Reads, query: FirebaseFirestore.Query): Promise<Array<{ id: string; data: Data }>> {
  const read = await readEveryPage(query, reads.recordCeiling);
  if (read.cut) reads.limits.push(`A job holds more than ${count(reads.recordCeiling)} records of one kind; `
    + `only the first ${count(reads.recordCeiling)} were read.`);
  return read.docs.map(doc => ({ id: doc.id, data: (doc.data() ?? {}) as Data }));
}
/** Every record of one kind on one job, in document-id order. */
const records = (reads: Reads, query: FirebaseFirestore.Query) => everyRecord(reads, query.orderBy("__name__"));

/** The window's shared jobs, newest first, every page of them; a safety ceiling reached is said. */
async function sharedJobsSince(reads: Reads, sinceIso: string, nowIso: string, includeTests: boolean): Promise<SharedJob[]> {
  const { store, jobCeiling, limits } = reads;
  const inWindow = (at: string | null): at is string => Boolean(at) && at! >= sinceIso && at! <= nowIso;
  const real = await readEveryPage(store.collection(JOBS).where(`${SHARED_FIELD}.sentAtIso`, ">=", sinceIso)
    .orderBy(`${SHARED_FIELD}.sentAtIso`, "desc").select(...JOB_FIELDS), jobCeiling);
  if (real.cut) limits.push(`More than ${count(jobCeiling)} jobs were shared in this window; only the ${count(jobCeiling)} shared most recently were read.`);
  const jobs: SharedJob[] = [];
  for (const doc of real.docs) {
    const record = doc.data() ?? {};
    const sharedAtIso = instant(object(record[SHARED_FIELD]).sentAtIso);
    if (isSiteJobRecord(record) && !isInternalTestJob(record) && inWindow(sharedAtIso)) jobs.push({ jobId: doc.id, record, sharedAtIso });
  }
  if (!includeTests) return jobs;
  // A test job made before the window may be shared inside it, so every test job is read, a page at a time.
  const tests = await readEveryPage(store.collection(JOBS).orderBy(`${INTERNAL_TEST_FIELD}.created_at_iso`, "desc")
    .select(...JOB_FIELDS), jobCeiling);
  if (tests.cut) limits.push(`More than ${count(jobCeiling)} internal test jobs exist; only the ${count(jobCeiling)} newest were read.`);
  const shared = await mapLimit(tests.docs, READ_CONCURRENCY, async doc => {
    const record = doc.data() ?? {};
    if (!isSiteJobRecord(record) || !isInternalTestJob(record)) return null;
    // Shared with Blueprint's internal test company: its standing send (`sendJobToInternalTestCompany`).
    const sends = await records(reads, store.collection(JOBS).doc(doc.id).collection(COMPANY_SENDS_COLLECTION).select("sentAtIso", "voidedAtIso"));
    const at = sends.map(send => send.data).filter(send => !text(send.voidedAtIso))
      .map(send => instant(send.sentAtIso)).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
    return inWindow(at) ? { jobId: doc.id, record, sharedAtIso: at } : null;
  });
  return [...jobs, ...shared.filter((job): job is SharedJob => job !== null)];
}

/**
 * When each job's video arrived: the earliest of its walkthrough's and its current capture's records, one `getAll` per
 * page of jobs.
 */
async function videoTimes(store: Store, jobs: readonly SharedJob[]): Promise<Map<string, string | null>> {
  const captures = jobs.map(job => [...new Set([`walkthrough-${job.jobId}`, siteWalkthroughIdentity(job.jobId, job.record).captureId])]);
  const byId = new Map<string, Data | undefined>();
  for (let start = 0; start < jobs.length; start += MARKETPLACE_PAGE_SIZE) {
    const refs = captures.slice(start, start + MARKETPLACE_PAGE_SIZE).flat().map(id => store.collection("captureUploadSessions").doc(id));
    for (const session of await store.getAll(...refs, { fieldMask: VIDEO_FIELDS }))
      byId.set(session.id, session.exists ? session.data() : undefined);
  }
  return new Map(jobs.map((job, index) => [job.jobId, captures[index].map(id => videoReceivedAtIso(byId.get(id)))
    .filter((at): at is string => Boolean(instant(at))).sort()[0] ?? null]));
}

/**
 * What the job's ledgers count against its cap, read as the admin job page reads them (`costOf`, `jobConsoleData.ts`):
 * the same reader the cap's admission runs, outside a transaction. By ledger, with the model lanes by lane.
 */
export async function jobSpendFacts(store: Store, jobId: string, record: Data): Promise<JobSpendFacts> {
  const { ledgerRowMicros, transactionJobLedgerReader, websiteJobSpend } = await import("./websiteJobCeiling");
  const ledgers = transactionJobLedgerReader(store, { get: (reference: any) => reference.get() }, jobId);
  let entries = Object.keys(object(record.website_preparation_reservations)).length;
  let laneRows: Data[] = [];
  const counted = <T>(rows: T[]) => { entries += rows.length; return rows; };
  const spend = await websiteJobSpend({ record, reader: {
    sceneIntakes: async () => counted(await ledgers.sceneIntakes()),
    screeningRuns: async () => counted(await ledgers.screeningRuns()),
    laneReservations: async () => (laneRows = counted(await ledgers.laneReservations())),
    videoReadings: async () => counted(await ledgers.videoReadings()),
  } });
  if (!entries) return { state: "no_ledger" };
  const lanes: Record<string, number> = { preparation: spend.preparation_micros, scene_construction: spend.native_construction_micros,
    video_readings: spend.video_reading_micros, screening: spend.screening_micros };
  for (const row of laneRows) {
    const key = `model_lane:${text(row?.lane)}`;
    lanes[key] = (lanes[key] ?? 0) + ledgerRowMicros(row);
  }
  return Number.isFinite(spend.total_micros) ? { state: "counted", totalMicros: spend.total_micros, lanes } : { state: "unreadable", lanes };
}

async function readJob(reads: Reads, job: SharedJob, videoAtIso: string | null): Promise<MarketplaceJobInput> {
  const { store } = reads;
  const jobRef = store.collection(JOBS).doc(job.jobId);
  const byCompany = (rows: Array<{ id: string; data: Data }>) => rows.map(row => ({ companyId: row.id, data: row.data }));
  const [answers, introductions, events, simulationUse, spend] = await Promise.all([
    records(reads, jobRef.collection(COMPANY_RESPONSES_COLLECTION).select("state", "recordedBy", "firstAnsweredAtIso", "updatedAtIso",
      "firstAppliedAtIso", "appliedAtOrBeforeIso")).then(byCompany),
    records(reads, jobRef.collection(INTRODUCTIONS_COLLECTION).select("cancelledAtIso", "outcomes", "progress")).then(byCompany),
    everyRecord(reads, jobBillableEventStatesQuery(store, job.jobId)).then(rows => rows.map(row => row.data)),
    records(reads, jobRef.collection(SIMULATION_USE_COLLECTION))
      .then(rows => rows.map(row => simulationUseRowOf(row.data)).filter((row): row is SimulationUseRow => row !== null))
      .catch(() => null),
    jobSpendFacts(store, job.jobId, job.record).catch((): JobSpendFacts => ({ state: "unavailable" })),
  ]);
  return { jobId: job.jobId, internalTest: isInternalTestJob(job.record) ? { label: text(object(job.record[INTERNAL_TEST_FIELD]).label) || null } : null,
    sharedAtIso: job.sharedAtIso, videoAtIso, answers, introductions, billableEvents: events, simulationUse, spend };
}

/**
 * The window's numbers, read now. Throws when the store, the jobs or their answers cannot be read (the route's 503).
 * `ceilings` lowers the safety ceilings, for tests only.
 */
export async function loadMarketplaceNumbers(options: { windowDays: MarketplaceWindow; includeTests: boolean; now?: Date;
  store?: Store | null; ceilings?: { jobs?: number; records?: number } }): Promise<MarketplaceNumbers> {
  const store = options.store === undefined ? dbAdmin : options.store;
  if (!store) throw new Error("marketplace_numbers_store_unavailable");
  const now = options.now ?? new Date();
  const sinceIso = windowStartIso(now, options.windowDays);
  const reads: Reads = { store, jobCeiling: options.ceilings?.jobs ?? MARKETPLACE_JOB_CEILING,
    recordCeiling: options.ceilings?.records ?? MARKETPLACE_RECORD_CEILING, limits: [] };
  const jobs = await sharedJobsSince(reads, sinceIso, now.toISOString(), options.includeTests);
  const videos = await videoTimes(store, jobs);
  const inputs = await mapLimit(jobs, READ_CONCURRENCY, job => readJob(reads, job, videos.get(job.jobId) ?? null));
  return marketplaceNumbersOf(inputs, { windowDays: options.windowDays, includeTests: options.includeTests, sinceIso,
    generatedAtIso: now.toISOString(), limits: reads.limits });
}
