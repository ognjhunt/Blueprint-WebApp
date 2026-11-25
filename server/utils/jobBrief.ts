/**
 * The job brief on a site's job (`job_brief`, `client/src/lib/jobBrief.ts`): written once by the `job_brief` lane when
 * the video reading lands, and again only when what it was written from changes.
 *
 * What it is written from is only what the job record already holds: the site's sentence and success rule, the video
 * reading (kind, object, other items, the link reading's summary and what it could not see, the estimates), the site's
 * quick answers and the catalog of quick questions. Text only, on the small tier at low effort. The digest of those
 * inputs (`jobBriefDigest`) is stored with the brief; a brief whose digest no longer matches is not used, and a new one
 * is written. The site's quick answers are sent as context but are not in the digest, so answering a question never
 * rewrites the questions being answered.
 *
 * When it runs: the coverage review starts it once the walkthrough's reading is stored (`captureCoverageReview.ts`), and
 * the company's job page and the site's job page start it, without waiting, for a job that has a reading and no current
 * brief (an older job, a changed sentence, a run that was lost). One run per job at a time, in this process and across
 * processes (the claim on the job record); a lost claim is taken again after three minutes.
 *
 * Money (a hard stop): before each run, its most possible cost is held against the job's one $40 cap with every ledger of
 * the job counted, in the transaction that claims it (`jobLaneSpend.ts`), and settled at the cost the run reports. A run
 * the cap leaves no room for does not start; the job pages show the catalog's rows, as without a brief. A job has at most
 * `JOB_BRIEF_RUNS_PER_JOB` runs ever, and each set of inputs at most `JOB_BRIEF_ATTEMPTS_PER_INPUT`. With no provider the
 * policy permits configured, no run starts and nothing is held or counted.
 *
 * Privacy (a hard stop): nothing is written for a job whose site withdrew its permission, and the site's words go to the
 * model only after the deterministic pass took out what the website knows of its identity. What a company reads of the
 * brief is screened again on its page (`server/utils/companyJobPage.ts`).
 */
import { createHash, randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  JOB_BRIEF_MIN_ROWS, JOB_BRIEF_SCHEMA_VERSION, estimateFieldsMade, jobBriefShowable, sanitizeJobBriefRows, sanitizeStoredJobBrief,
  type JobBriefEstimateField, type JobBriefEstimates, type JobBriefRow, type StoredJobBrief,
} from "../../client/src/lib/jobBrief";
import { JOB_FACT_KEYS, JOB_FACT_QUESTIONS, JOB_FACT_SHORT_LABELS, NOT_SURE_LABEL, jobFactLabel, type JobReading } from "../../client/src/lib/jobFacts";
import type { JobBriefInput } from "../agents/tasks/job-brief";
import { logger } from "../logger";
import { siteSentenceSource, siteSuccessRuleSource } from "./companyJobPage";
import { siteWordsDeterministic } from "./freeTextScreening";
import { JOB_FACTS_FIELD, readJobFacts } from "./jobFacts";
import { knownSiteIdentity } from "./siteIdentity";
import { jobReadingOf, usableReading, videoEvidence } from "./siteRobotFit";
import { getBrief, isPlaceholderSummary } from "./siteTaskBrief";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";

export const JOB_BRIEF_FIELD = "job_brief";
/** The claim on the job record: which inputs the last run read, how it ended, and how many runs the job has had. */
export const JOB_BRIEF_RUN_FIELD = "job_brief_run";
/** The most runs one job may have ever (a site that edits its sentence often gets a new brief each time, up to this). */
export const JOB_BRIEF_RUNS_PER_JOB = 20;
/** The most runs for one set of inputs: a failed run, or an answer with fewer than three usable rows, is tried again. */
export const JOB_BRIEF_ATTEMPTS_PER_INPUT = 3;
/** A claimed run that has not ended in this long is taken as lost (the process stopped) and may be claimed again. */
const CLAIM_LOST_AFTER_MS = 3 * 60_000;
/** After a failed run, the next for the same inputs is allowed after one minute, then four, then sixteen. */
const retryAfterMs = (attempts: number) => Math.min(60_000 * 4 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
/** After the job's spending cap left no room, it is looked at again after this long (costs no paid call). */
const CAP_RECHECK_AFTER_MS = 60 * 60_000;

/* ------------------------------------------------------------------------------------------------- what it reads */

/** What a brief is written from, as the job record holds it now. */
interface JobBriefSources {
  /** The site's sentence and success rule as stored ("" for none, or for the placeholder a video-drafted job starts with). */
  sentence: string;
  successRule: string;
  reading: JobReading;
  estimates: JobBriefEstimates | null;
  /** A usable link reading's summary and what it could not see; absent on walkthrough readings. */
  summary: string | null;
  notEvidenced: string[];
}

function sourcesOf(record: Record<string, any> | null | undefined, brief: { summary?: unknown; successCriteria?: any } | null | undefined):
  JobBriefSources | null {
  const reading = jobReadingOf(record);
  if (!record || !reading) return null;
  const sentence = siteSentenceSource(brief);
  const found = videoEvidence({ request: record, brief: null, measurements: null })?.estimates ?? null;
  const link = usableReading(record.site_video_evidence);
  const words = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
  return {
    sentence: isPlaceholderSummary(sentence) ? "" : sentence,
    successRule: siteSuccessRuleSource(brief),
    reading,
    estimates: found ? { largestSideM: found.largestSideM, massKg: found.massKg, surface: found.surface, pickToPlaceM: found.pickToPlaceM,
      pickHeightM: found.pickHeightM, placeHeightM: found.placeHeightM, frontClearanceM: found.frontClearanceM, cycleSeconds: found.cycleSeconds }
      : null,
    summary: words(link?.summary, 2000),
    notEvidenced: (Array.isArray(link?.not_evidenced) ? link.not_evidenced : []).map(item => words(item, 300))
      .filter((item): item is string => Boolean(item)).slice(0, 12),
  };
}

/**
 * The digest of what a brief is written from: the site's sentence and success rule as stored, the reading, its
 * estimates, the link reading's words and the catalog's questions. A change to any of them is a new brief. The site's
 * quick answers are not in it.
 */
export function jobBriefDigest(sources: JobBriefSources): string {
  return createHash("sha256").update(JSON.stringify([JOB_BRIEF_SCHEMA_VERSION, sources.sentence, sources.successRule,
    sources.reading.kind, sources.reading.object, sources.reading.others, sources.estimates, sources.summary, sources.notEvidenced,
    JOB_FACT_KEYS])).digest("hex");
}

const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 ? value as number : 0;

/**
 * Why no run may start now for these inputs, from the claim on the record, or null when one may: a run under way, a
 * failed run waiting for its retry or out of attempts, or a limit (the job's runs, or its spending cap, looked at again
 * after an hour). Read before anything is decrypted or held, and again inside the claim's transaction.
 */
function runWaits(run: Record<string, any> | null | undefined, digest: string, nowMs: number): "busy" | "limit" | null {
  if (!run || typeof run !== "object") return null;
  const same = run.inputDigest === digest;
  const attempts = same ? count(run.attempts) : 0;
  if (same && run.status === "running" && nowMs - Number(run.claimedAtMs ?? 0) < CLAIM_LOST_AFTER_MS) return "busy";
  if (same && run.status === "failed" && (attempts >= JOB_BRIEF_ATTEMPTS_PER_INPUT || nowMs - Number(run.endedAtMs ?? 0) < retryAfterMs(attempts)))
    return "busy";
  // The job's runs are a limit for good; its spending cap is looked at again after an hour, as an earlier hold may
  // have settled lower.
  if (count(run.total) >= JOB_BRIEF_RUNS_PER_JOB) return "limit";
  if (same && run.status === "limit" && nowMs - Date.parse(String(run.limitAtIso ?? "")) < CAP_RECHECK_AFTER_MS) return "limit";
  return null;
}

/** The stored brief as the job record holds it, checked again (`sanitizeStoredJobBrief`), current or not. */
export function storedJobBriefOf(record: Record<string, any> | null | undefined): StoredJobBrief | null {
  return sanitizeStoredJobBrief(record?.[JOB_BRIEF_FIELD]);
}

/**
 * The job's brief as both pages read it: the stored brief only while it was written from what the record holds now
 * (`current`), with what its values are written from (the reading's estimates and the stored sentence). `wanted` is true
 * when a reading exists, no current brief does and nothing on the claim stops a run now (`runWaits`): a run may be
 * started (`requestJobBrief`).
 */
export function jobBriefOfRecord(record: Record<string, any> | null | undefined,
  brief: { summary?: unknown; successCriteria?: any } | null | undefined):
  { current: StoredJobBrief | null; wanted: boolean; estimates: JobBriefEstimates | null; sentence: string } {
  const sources = sourcesOf(record, brief);
  if (!sources) return { current: null, wanted: false, estimates: null, sentence: "" };
  const stored = storedJobBriefOf(record);
  const digest = jobBriefDigest(sources);
  const current = stored && stored.inputDigest === digest ? stored : null;
  return { current, wanted: !current && runWaits(record?.[JOB_BRIEF_RUN_FIELD], digest, Date.now()) === null,
    estimates: sources.estimates, sentence: sources.sentence };
}

/**
 * The brief's questions for the site's own page, or null when the brief is not used (none current, or fewer than three
 * rows it could show): the site is then asked the catalog's questions.
 */
export function siteJobBriefOf(record: Record<string, any> | null | undefined,
  brief: { summary?: unknown; successCriteria?: any } | null | undefined): StoredJobBrief | null {
  const read = jobBriefOfRecord(record, brief);
  return read.current && jobBriefShowable(read.current, read) ? read.current : null;
}

/* ------------------------------------------------------------------------------------------------- the model's input */

const ESTIMATE_VALUES: ReadonlyArray<[JobBriefEstimateField, (estimates: JobBriefEstimates) => number | string | null]> = [
  ["object_largest_side_m", e => e.largestSideM], ["object_mass_kg_low", e => e.massKg?.low ?? null],
  ["object_mass_kg_high", e => e.massKg?.high ?? null], ["object_surface", e => e.surface], ["pick_to_place_m", e => e.pickToPlaceM],
  ["pick_height_m", e => e.pickHeightM], ["place_height_m", e => e.placeHeightM], ["front_clearance_m", e => e.frontClearanceM],
  ["cycle_seconds", e => e.cycleSeconds],
];

/** The lane's input: only data already held, the site's words and the reading's names through the deterministic pass. */
function taskInputOf(record: Record<string, any>, sources: JobBriefSources, known: Parameters<typeof siteWordsDeterministic>[1]): JobBriefInput {
  const plain = (text: string) => siteWordsDeterministic(text, known).replace(/\s+/g, " ").trim();
  const facts = readJobFacts(record);
  const videoEstimates: JobBriefInput["videoEstimates"] = {};
  if (sources.estimates) for (const [field, value] of ESTIMATE_VALUES) {
    const found = value(sources.estimates);
    if (found !== null) videoEstimates[field] = found;
  }
  return {
    sentence: plain(sources.sentence),
    successRule: plain(sources.successRule) || null,
    reading: { kind: sources.reading.kind, object: sources.reading.object ? plain(sources.reading.object) || null : null,
      others: sources.reading.others.map(plain).filter(Boolean), summary: sources.summary ? plain(sources.summary) || null : null,
      notEvidenced: sources.notEvidenced.map(plain).filter(Boolean) },
    videoEstimates,
    siteAnswers: JOB_FACT_KEYS.flatMap(key => {
      const code = facts?.[key];
      const answer = code === "unsure" ? NOT_SURE_LABEL : code ? jobFactLabel(key, code) : null;
      return answer ? [{ key, answer }] : [];
    }),
    catalog: JOB_FACT_KEYS.map(key => ({ key, label: JOB_FACT_SHORT_LABELS[key], question: JOB_FACT_QUESTIONS[key] })),
  };
}

/* ------------------------------------------------------------------------------------------------- the writer */

/**
 * One run of the lane: the rows the model returned (unchecked), or null when it did not answer. A scripted writer may
 * also say what it cost (`costUsd`); otherwise it costs nothing.
 */
export type JobBriefWriter = (input: JobBriefInput, requestId: string) =>
  Promise<unknown[] | { rows: unknown; costUsd?: number } | null>;

let writerOverride: JobBriefWriter | null = null;
/** Unit tests and the local journey harness only: a scripted writer in place of the model. Null puts the model back. */
export function useJobBriefWriter(writer: JobBriefWriter | null) {
  writerOverride = writer;
}

async function writerAvailable(): Promise<boolean> {
  if (writerOverride) return true;
  const { getStructuredProviderOrder } = await import("../agents/provider-config");
  return getStructuredProviderOrder("job_brief").length > 0;
}

type RunResult = { rows: unknown; costUsd: number | null; basis: "reported_usage" | "no_provider_request" | "scripted" };

async function runWriter(input: JobBriefInput, requestId: string): Promise<RunResult> {
  if (writerOverride) {
    const answer = await writerOverride(input, requestId);
    const rows = Array.isArray(answer) ? answer : answer && typeof answer === "object" ? answer.rows : null;
    const cost = !Array.isArray(answer) && answer && typeof answer.costUsd === "number" ? answer.costUsd : 0;
    return { rows, costUsd: cost, basis: "scripted" };
  }
  const [{ runAgentTask }, { runCostUsd }] = await Promise.all([import("../agents/runtime"), import("./jobLaneSpend")]);
  const result = await runAgentTask<JobBriefInput, { job_brief?: unknown }>({
    kind: "job_brief", input, metadata: { request_id: requestId },
  }, { dispatchQueuedOnFinish: false, privacyRequestBinding: { request_id: requestId } });
  const costUsd = runCostUsd(result as { artifacts?: Record<string, unknown> });
  return { rows: result.status === "completed" ? result.output?.job_brief ?? null : null, costUsd,
    basis: costUsd === 0 ? "no_provider_request" : "reported_usage" };
}

type Claim = { state: "claimed"; token: string; reservationId: string } | { state: "current"; brief: StoredJobBrief }
  | { state: "busy" | "limit" | "gone" };

/**
 * In one transaction on the job record: a new run claimed for these inputs, counted, and held against the job's one
 * spending cap; or why not (a current brief exists, a run is under way or waiting its retry, a limit, a withdrawn site).
 */
async function claimRun(requestId: string, digest: string, maximumUsd: number, nowMs: number): Promise<Claim> {
  const store = db!;
  const { planJobLaneReservation } = await import("./jobLaneSpend");
  const ref = store.collection("inboundRequests").doc(requestId);
  return store.runTransaction(async (tx): Promise<Claim> => {
    const record = (await tx.get(ref)).data();
    if (!record || projectWebsiteCaptureRights(record).consent_revoked) return { state: "gone" };
    const stored = storedJobBriefOf(record);
    if (stored?.inputDigest === digest) return { state: "current", brief: stored };
    const run = record[JOB_BRIEF_RUN_FIELD] ?? {};
    const waits = runWaits(run, digest, nowMs);
    if (waits) return { state: waits };
    const attempts = run.inputDigest === digest ? count(run.attempts) : 0, total = count(run.total);
    const atIso = new Date(nowMs).toISOString();
    const limited = (limit: "job_spending_cap"): Claim => {
      tx.set(ref, { [JOB_BRIEF_RUN_FIELD]: { ...run, inputDigest: digest, status: "limit", limit, limitAtIso: atIso } },
        { mergeFields: [JOB_BRIEF_RUN_FIELD] });
      return { state: "limit" };
    };
    const reservationId = `job_brief-${digest.slice(0, 16)}-${total + 1}`;
    const hold = await planJobLaneReservation(tx, requestId, { lane: "job_brief", reservationId, maximumUsd });
    if (hold.state === "no_job") return { state: "gone" };
    if (hold.state !== "fits") return limited("job_spending_cap");
    const token = randomUUID();
    hold.write(tx);
    tx.set(ref, { [JOB_BRIEF_RUN_FIELD]: { inputDigest: digest, status: "running", attempts: attempts + 1, total: total + 1,
      claimedAtMs: nowMs, claimedAtIso: atIso, claimToken: token, reservationId } }, { mergeFields: [JOB_BRIEF_RUN_FIELD] });
    return { state: "claimed", token, reservationId };
  });
}

/** Whether an answer to a question of the old brief still means the same in the new one: same id, question and choices. */
function sameQuestion(before: JobBriefRow | undefined, after: JobBriefRow | undefined): boolean {
  return before?.evidence === "ask_site" && after?.evidence === "ask_site" && before.question === after.question
    && before.choices.length === after.choices.length && before.choices.every((choice, index) => choice === after.choices[index]);
}

/**
 * The run's end, written only while the claim is still this run's. A brief with enough rows is stored whole, with its
 * digest; the site's answers to questions the new brief no longer asks in the same words are taken off `job_facts`
 * (an answer is a choice's index, so it would otherwise read as another choice).
 */
async function endRun(requestId: string, token: string, end: { brief: StoredJobBrief } | { failed: string }): Promise<boolean> {
  const store = db!;
  const ref = store.collection("inboundRequests").doc(requestId);
  return store.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    const run = record?.[JOB_BRIEF_RUN_FIELD];
    if (!record || run?.claimToken !== token || run.status !== "running") return false;
    const endedAtMs = Date.now(), endedAtIso = new Date(endedAtMs).toISOString();
    if ("failed" in end) {
      tx.set(ref, { [JOB_BRIEF_RUN_FIELD]: { ...run, status: "failed", reason: end.failed, endedAtMs, endedAtIso } },
        { mergeFields: [JOB_BRIEF_RUN_FIELD] });
      return true;
    }
    const before = storedJobBriefOf(record);
    const facts = record[JOB_FACTS_FIELD];
    const custom = facts && typeof facts === "object" && facts.custom && typeof facts.custom === "object" ? facts.custom as Record<string, unknown> : null;
    const kept = custom ? Object.fromEntries(Object.entries(custom).filter(([id]) =>
      sameQuestion(before?.rows.find(row => row.id === id), end.brief.rows.find(row => row.id === id)))) : null;
    const pruned = custom && kept && Object.keys(kept).length !== Object.keys(custom).length;
    tx.set(ref, {
      [JOB_BRIEF_FIELD]: end.brief,
      [JOB_BRIEF_RUN_FIELD]: { ...run, status: "done", reason: null, endedAtMs, endedAtIso },
      ...(pruned ? { [JOB_FACTS_FIELD]: { ...facts, custom: kept } } : {}),
    }, { mergeFields: [JOB_BRIEF_FIELD, JOB_BRIEF_RUN_FIELD, ...(pruned ? [JOB_FACTS_FIELD] : [])] });
    return true;
  });
}

const inFlight = new Map<string, Promise<StoredJobBrief | null>>();

/**
 * The job's current brief: the stored one when it was written from what the record holds now, else a new run (claimed,
 * counted, held, run, checked and stored). Null when there is none and none could be written now. Never throws for a
 * reason the job pages need to know: a page falls back to the catalog's rows either way.
 */
export async function ensureJobBrief(requestId: string): Promise<StoredJobBrief | null> {
  if (!db || !/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) return null;
  let work = inFlight.get(requestId);
  if (!work) {
    work = writeOnce(requestId).catch(error => {
      logger.warn({ err: error, requestId }, "The job brief could not be written; the job pages show the catalog's rows");
      return null;
    }).finally(() => inFlight.delete(requestId));
    inFlight.set(requestId, work);
  }
  return work;
}

/** Start `ensureJobBrief` without waiting for it (the next read of the page shows the brief). */
export function requestJobBrief(requestId: string): void {
  void ensureJobBrief(requestId);
}

async function writeOnce(requestId: string): Promise<StoredJobBrief | null> {
  const store = db!;
  if (!(await writerAvailable())) return null;
  const [snapshot, brief] = await Promise.all([store.collection("inboundRequests").doc(requestId).get(), getBrief(requestId)]);
  const record = snapshot.data() as Record<string, any> | undefined;
  if (!record || projectWebsiteCaptureRights(record).consent_revoked) return null;
  const sources = sourcesOf(record, brief);
  if (!sources) return null;
  const digest = jobBriefDigest(sources);
  const stored = storedJobBriefOf(record);
  if (stored?.inputDigest === digest) return stored;
  if (runWaits(record[JOB_BRIEF_RUN_FIELD], digest, Date.now())) return null;
  // Without the site's identity its words cannot go through the deterministic pass: nothing is sent this time.
  const known = await knownSiteIdentity(record).catch(() => null);
  if (!known) return null;
  const input = taskInputOf(record, sources, known);
  const [{ jobBriefTask }, { laneRunMaximumUsd, settleJobLaneSpend }] = await Promise.all([
    import("../agents/tasks/job-brief"), import("./jobLaneSpend")]);
  const maximumUsd = await laneRunMaximumUsd("job_brief", Buffer.byteLength(jobBriefTask.build_prompt(input), "utf8"),
    { scripted: Boolean(writerOverride) });
  if (maximumUsd === null) return null;
  const claim = await claimRun(requestId, digest, maximumUsd, Date.now());
  if (claim.state === "current") return claim.brief;
  if (claim.state !== "claimed") return null;
  let result: RunResult = { rows: null, costUsd: null, basis: "reported_usage" };
  let failure: string | null = null;
  try { result = await runWriter(input, requestId); } catch (error) { failure = error instanceof Error ? error.name : "error"; }
  // The hold settles at what the run cost, or stays whole when that is not known (a throw included).
  await settleJobLaneSpend(requestId, claim.reservationId, result.costUsd, result.basis).catch(error =>
    logger.warn({ err: error, requestId }, "The job brief's hold could not be settled; it stays counted in full"));
  if (result.rows === null || result.rows === undefined) { await endRun(requestId, claim.token, { failed: failure ?? "no_answer" }); return null; }
  const rows = sanitizeJobBriefRows(result.rows, { sentence: input.sentence, estimates: new Set(estimateFieldsMade(sources.estimates)) });
  if (rows.length < JOB_BRIEF_MIN_ROWS) { await endRun(requestId, claim.token, { failed: "too_few_rows" }); return null; }
  const written: StoredJobBrief = { schemaVersion: JOB_BRIEF_SCHEMA_VERSION, rows, generatedAtIso: new Date().toISOString(), inputDigest: digest };
  return await endRun(requestId, claim.token, { brief: written }) ? written : null;
}

export function resetJobBriefForTests() {
  inFlight.clear();
  writerOverride = null;
}
