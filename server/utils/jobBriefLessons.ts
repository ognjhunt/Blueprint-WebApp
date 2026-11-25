/**
 * Lessons for the job brief, learnt from companies' answers (owner, 2026-11-25: "Every 'Need more details' question and
 * every 'Not a fit' reason is a signal. Feed them back so that the next similar job asks the site those things up front.
 * The packet improves without anyone hand-tuning it."). The pure part (the closed list of reasons, the word checks, the
 * bounded store) is `client/src/lib/jobBriefLessons.ts`; the lane is `server/agents/tasks/job-brief-lesson.ts`.
 *
 * When it runs: once a company saves "Need more details" or "Not a fit" (`companyAnswer.ts`), without waiting. One run
 * per company and job at a time, in this process and across processes (the claim on the run record); a lost claim is
 * taken again after three minutes. A failed run is tried again, after its wait, the next time the company saves.
 *
 * What it reads: the company's own words about its answer (for "Need more details" its question, for "Not a fit" its
 * note), only when the company gave them on its job page under a current line, after the deterministic pass took out
 * what Blueprint holds of the company's identity (`siteReasonOf`) and then of the site's (`siteWordsDeterministic`); the
 * kind of job the video reading gave; and the topics already kept for that kind. A job with no kind teaches nothing.
 *
 * What it keeps (`jobBriefLessons/<kind>`, Admin SDK only): the checked lesson and nothing else. A question passes the
 * word checks (`jobBriefLessonQuestionRefused`: money, identity, a robot's make, a place, a figure, a capitalised word),
 * holds no word of either side's identity and comes through both identity passes and the model pass over free text
 * unchanged, or it is dropped; a question on a catalog topic is kept in the catalog's own words; a reason is one of the
 * closed list. The store holds no
 * job, no company and no company's words; the raw note is stored nowhere new (the run record keeps a digest of what was
 * read, the lesson's key and how the run ended). A company counts once per job for each topic or reason (`counted` on
 * its run record), however often it saves.
 *
 * Who never contributes: an internal test job, and the internal test company (its marker, its id, or the internal route
 * as the answer's submitter).
 *
 * Money (a hard stop): before each run, its most possible cost is held against the answering job's one $40 cap with every
 * ledger of the job counted, in the transaction that claims it (`jobLaneSpend.ts`), and settled at the cost the run
 * reports; the model pass over a kept question holds its own cost against the same cap (`freeTextScreening.ts`, which
 * also keeps that question's screened words with the job's other screenings). A run the cap leaves no room for does not
 * start. A company has at most `JOB_BRIEF_LESSON_RUNS_PER_COMPANY`
 * runs on a job, a job at most `JOB_BRIEF_LESSON_RUNS_PER_JOB`, and one set of words at most
 * `JOB_BRIEF_LESSON_ATTEMPTS_PER_INPUT`. With no provider the policy permits configured, nothing is read, held or run.
 *
 * Privacy (a hard stop): nothing runs or is counted for a job whose site withdrew its permission.
 */
import { createHash, randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { COMPANY_RESPONSE_STATEMENT_VERSIONS } from "../../client/src/lib/companyResponses";
import { REMOVED, containsContactDetails, removeIdentifyingDetails, type KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { JOB_FACT_KEYS, JOB_FACT_QUESTIONS, READER_JOB_KINDS, isJobFactKey, type ReaderJobKind } from "../../client/src/lib/jobFacts";
import {
  JOB_BRIEF_LESSONS_SCHEMA_VERSION, JOB_BRIEF_LESSON_REASONS, JOB_BRIEF_LESSON_REASON_WORDS, addJobBriefLesson, emptyJobBriefLessonStore,
  jobBriefLessonKey, jobBriefLessonsForBrief, sanitizeJobBriefLesson, sanitizeJobBriefLessonStore, type JobBriefLesson,
  type JobBriefLessonForBrief, type JobBriefLessonReason, type JobBriefLessonStore,
} from "../../client/src/lib/jobBriefLessons";
import type { JobBriefLessonInput } from "../agents/tasks/job-brief-lesson";
import { logger } from "../logger";
import { siteWordsDeterministic } from "./freeTextScreening";
import { INTERNAL_TEST_ANSWER_SUBMITTER, hasInternalTestCompanyMarker, internalTestCompanyId } from "./internalTestCompany";
import { isInternalTestJob } from "./internalTestJob";
import { COMPANY_RESPONSES_COLLECTION, knownCompanyIdentity, siteReasonOf } from "./jobCompanies";
import { ROBOT_TEAM_ACCESS_COLLECTION } from "./robotTeamEarlyAccess";
import { knownSiteIdentity } from "./siteIdentity";
import { jobReadingOf } from "./siteRobotFit";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";

/** One document per kind of job: `jobBriefLessons/<kind>`. */
export const JOB_BRIEF_LESSONS_COLLECTION = "jobBriefLessons";
/** One run record per company on a job: `inboundRequests/<job>/jobBriefLessonRuns/<companyId>`. */
export const JOB_BRIEF_LESSON_RUNS_COLLECTION = "jobBriefLessonRuns";
/** On the job record: how many lesson runs the job has had, across its companies. */
export const JOB_BRIEF_LESSON_JOB_FIELD = "job_brief_lesson_runs";
/** The most runs one company may have on one job ever (a company that edits its note often is read again, up to this). */
export const JOB_BRIEF_LESSON_RUNS_PER_COMPANY = 6;
/** The most lesson runs one job may have ever, across its companies. */
export const JOB_BRIEF_LESSON_RUNS_PER_JOB = 60;
/** The most runs for one set of words: a run the model did not answer is tried again, at most this many times. */
export const JOB_BRIEF_LESSON_ATTEMPTS_PER_INPUT = 3;
/** A claimed run that has not ended in this long is taken as lost (the process stopped) and may be claimed again. */
const CLAIM_LOST_AFTER_MS = 3 * 60_000;
/** After a failed run, the next for the same words is allowed after one minute, then four, then sixteen. */
const retryAfterMs = (attempts: number) => Math.min(60_000 * 4 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
/** After the job's spending cap left no room, it is looked at again after this long (costs no paid call). */
const CAP_RECHECK_AFTER_MS = 60 * 60_000;

type Data = Record<string, any>;
const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 ? value as number : 0;
const isRecord = (value: unknown): value is Data => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/* ------------------------------------------------------------------------------------------------- who may teach */

/** The lesson an answer's state may teach: "Need more details" a question, "Not a fit" a reason; nothing else. */
export function lessonAnswerOf(state: unknown): JobBriefLessonInput["answer"] | null {
  return state === "needs_something" ? "need_more_details" : state === "declined" ? "not_a_fit" : null;
}

/**
 * Whether an answer may teach a lesson: "Need more details" or "Not a fit", given by the company itself on its job page
 * under a current line, on a job whose site has not withdrawn; never an internal test job, and never the internal test
 * company (its marker on the access record, the configured test company's id, or the internal route as the submitter).
 */
export function answerMayTeach(job: Data | null | undefined, companyId: string, company: Data | null | undefined,
  answer: Data | null | undefined): boolean {
  if (!job || !answer || isInternalTestJob(job) || projectWebsiteCaptureRights(job).consent_revoked) return false;
  if (hasInternalTestCompanyMarker(company) || companyId === internalTestCompanyId() || answer.submittedBy === INTERNAL_TEST_ANSWER_SUBMITTER)
    return false;
  if (answer.recordedBy !== "company" || !COMPANY_RESPONSE_STATEMENT_VERSIONS.includes(String(answer.statementVersion))) return false;
  return lessonAnswerOf(answer.state) !== null;
}

/**
 * The company's words as the lesson lane reads them, or null: the company's identity out (`siteReasonOf`, which also
 * refuses words the site may not read), then the site's (`siteWordsDeterministic`), on one line. Null when nothing worth
 * reading is left.
 */
export function companyWordsForLesson(answer: Data, company: Data | null | undefined, siteKnown: KnownSiteIdentity): string | null {
  const companyOut = siteReasonOf(answer, knownCompanyIdentity(company, answer));
  if (!companyOut) return null;
  const words = siteWordsDeterministic(companyOut, siteKnown).replace(/\s+/g, " ").trim();
  return /\p{L}{3,}/u.test(words.split(REMOVED).join(" ").replace(/\bthe (?:site|company)\b/gi, " ")) ? words : null;
}

/** Letters only, accents folded, lower case: how a lesson's words and the held identity are compared. */
const wordsOf = (text: string) => text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/**
 * Whether a lesson's words hold nothing of either side's identity: no word of four or more letters of anything Blueprint
 * holds of the site or the company (a name, a person, an address, an email or a website, in any case: stricter than the
 * pass a reader's words get, since a lesson is generic and has no reason to hold any), no contact detail, and both
 * identity passes (the company's, then the site's) leave it unchanged. A lesson that fails is dropped, never rewritten.
 */
export function lessonWordsPassUnchanged(words: string, siteKnown: KnownSiteIdentity, companyKnown: KnownSiteIdentity): boolean {
  if (containsContactDetails(words)) return false;
  const held = new Set<string>();
  for (const known of [siteKnown, companyKnown])
    for (const value of [...known.names, ...(known.organisations ?? []), ...(known.people ?? []), ...known.addresses, ...known.contacts])
      if (typeof value === "string") for (const word of wordsOf(value)) if (word.length >= 4) held.add(word);
  if (wordsOf(words).some(word => held.has(word))) return false;
  const plain = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
  try {
    return plain(siteWordsDeterministic(removeIdentifyingDetails(words, companyKnown, { nameAs: "company" }), siteKnown)) === plain(words);
  } catch {
    return false;
  }
}

/** The digest of what one run reads: the kind, the answer and the company's words after the passes. The words are never stored. */
function lessonDigest(kind: ReaderJobKind, answer: JobBriefLessonInput["answer"], words: string): string {
  return createHash("sha256").update(JSON.stringify([JOB_BRIEF_LESSONS_SCHEMA_VERSION, kind, answer, words])).digest("hex");
}

/* ------------------------------------------------------------------------------------------------- the store */

function storeRef(kind: ReaderJobKind) {
  return db!.collection(JOB_BRIEF_LESSONS_COLLECTION).doc(kind);
}

/** The lessons kept for one kind of job, checked again (`sanitizeJobBriefLessonStore`); an empty store when there are none. */
export async function loadJobBriefLessonStore(kind: ReaderJobKind): Promise<JobBriefLessonStore> {
  if (!db) return emptyJobBriefLessonStore(kind);
  return sanitizeJobBriefLessonStore((await storeRef(kind).get()).data(), kind);
}

/**
 * The top lessons for a job brief of this kind (`jobBriefLessonsForBrief`), or none when the job has no kind or the
 * store cannot be read (the brief is then written without them, as before lessons existed).
 */
export async function lessonsForJobBrief(kind: ReaderJobKind | null): Promise<JobBriefLessonForBrief[]> {
  if (!kind) return [];
  try {
    return jobBriefLessonsForBrief(await loadJobBriefLessonStore(kind));
  } catch (error) {
    logger.warn({ err: error, kind }, "The job brief's lessons could not be read; the brief is written without them");
    return [];
  }
}

/** Every kind's lessons, for staff (`GET /api/admin/jobs/brief-lessons`): the checked lessons, the reasons in words. */
export async function loadAllJobBriefLessons(): Promise<Array<{ kind: ReaderJobKind; updatedAtIso: string | null;
  questions: JobBriefLessonStore["questions"];
  reasons: Array<JobBriefLessonStore["reasons"][number] & { words: string }> }>> {
  const stores = await Promise.all(READER_JOB_KINDS.map(kind => loadJobBriefLessonStore(kind)));
  return stores.map(store => ({ kind: store.kind, updatedAtIso: store.updatedAtIso, questions: store.questions,
    reasons: store.reasons.map(entry => ({ ...entry, words: JOB_BRIEF_LESSON_REASON_WORDS[entry.reason] })) }));
}

/* ------------------------------------------------------------------------------------------------- the model's input */

/**
 * The lane's input: the kind, the answer, the company's words after both passes and, for a question, the topics already
 * known for the kind (the catalog's quick questions, then the lessons kept); for a reason, the closed list in words.
 */
function lessonInput(kind: ReaderJobKind, answer: JobBriefLessonInput["answer"], words: string, store: JobBriefLessonStore): JobBriefLessonInput {
  return {
    kind, answer, words,
    topics: answer === "need_more_details" ? [...JOB_FACT_KEYS.map(key => ({ topic: key, question: JOB_FACT_QUESTIONS[key] })),
      ...store.questions.filter(entry => !isJobFactKey(entry.topic)).map(entry => ({ topic: entry.topic, question: entry.question }))] : [],
    reasons: answer === "not_a_fit"
      ? JOB_BRIEF_LESSON_REASONS.map((reason: JobBriefLessonReason) => ({ reason, means: JOB_BRIEF_LESSON_REASON_WORDS[reason] })) : [],
  };
}

/* ------------------------------------------------------------------------------------------------- the writer */

/**
 * One run of the lane: what the model returned as `job_brief_lesson` (unchecked; null when it found no lesson), or null
 * when it did not answer. A scripted writer may also say what it cost (`costUsd`); otherwise it costs nothing.
 */
export type JobBriefLessonWriter = (input: JobBriefLessonInput, requestId: string) =>
  Promise<{ lesson: unknown; costUsd?: number } | null>;

let writerOverride: JobBriefLessonWriter | null = null;
/** Unit tests and the local journey harness only: a scripted writer in place of the model. Null puts the model back. */
export function useJobBriefLessonWriter(writer: JobBriefLessonWriter | null) {
  writerOverride = writer;
}

async function writerAvailable(): Promise<boolean> {
  if (writerOverride) return true;
  const { getStructuredProviderOrder } = await import("../agents/provider-config");
  return getStructuredProviderOrder("job_brief_lesson").length > 0;
}

type RunResult = { answered: boolean; lesson: unknown; costUsd: number | null; basis: "reported_usage" | "no_provider_request" | "scripted" };

async function runWriter(input: JobBriefLessonInput, requestId: string): Promise<RunResult> {
  if (writerOverride) {
    const answer = await writerOverride(input, requestId);
    return { answered: Boolean(answer), lesson: answer?.lesson ?? null,
      costUsd: typeof answer?.costUsd === "number" ? answer.costUsd : 0, basis: "scripted" };
  }
  const [{ runAgentTask }, { runCostUsd }] = await Promise.all([import("../agents/runtime"), import("./jobLaneSpend")]);
  const result = await runAgentTask<JobBriefLessonInput, { job_brief_lesson?: unknown }>({
    kind: "job_brief_lesson", input, metadata: { request_id: requestId },
  }, { dispatchQueuedOnFinish: false, privacyRequestBinding: { request_id: requestId } });
  const costUsd = runCostUsd(result as { artifacts?: Record<string, unknown> });
  return { answered: result.status === "completed", lesson: result.status === "completed" ? result.output?.job_brief_lesson ?? null : null,
    costUsd, basis: costUsd === 0 ? "no_provider_request" : "reported_usage" };
}

/* ------------------------------------------------------------------------------------------------- the run */

/**
 * Why no run may start now for these words, from the company's run record and the job's count, or null when one may:
 * the same words already read ("done"), a run under way or a failed one waiting its retry or out of attempts ("busy"),
 * or a limit (the company's runs on the job, the job's runs, or its spending cap, looked at again after an hour).
 */
function runWaits(run: Data | null | undefined, digest: string, jobTotal: number, nowMs: number): "done" | "busy" | "limit" | null {
  const record = isRecord(run) ? run : {};
  const same = record.inputDigest === digest;
  const attempts = same ? count(record.attempts) : 0;
  if (same && record.status === "done") return "done";
  if (same && record.status === "running" && nowMs - Number(record.claimedAtMs ?? 0) < CLAIM_LOST_AFTER_MS) return "busy";
  if (same && record.status === "failed" && (attempts >= JOB_BRIEF_LESSON_ATTEMPTS_PER_INPUT
    || nowMs - Number(record.endedAtMs ?? 0) < retryAfterMs(attempts))) return "busy";
  if (count(record.total) >= JOB_BRIEF_LESSON_RUNS_PER_COMPANY || jobTotal >= JOB_BRIEF_LESSON_RUNS_PER_JOB) return "limit";
  if (same && record.status === "limit" && nowMs - Date.parse(String(record.limitAtIso ?? "")) < CAP_RECHECK_AFTER_MS) return "limit";
  return null;
}

const jobRefOf = (jobId: string) => db!.collection("inboundRequests").doc(jobId);
const runRefOf = (jobId: string, companyId: string) => jobRefOf(jobId).collection(JOB_BRIEF_LESSON_RUNS_COLLECTION).doc(companyId);

type Claim = { state: "claimed"; token: string; reservationId: string } | { state: "done" | "busy" | "limit" | "gone" };

/**
 * In one transaction: a new run claimed for these words, counted for the company and the job, and held against the job's
 * one spending cap; or why not (the words already read, a run under way or waiting, a limit, a withdrawn or test job).
 */
async function claimRun(jobId: string, companyId: string, digest: string, kind: ReaderJobKind, maximumUsd: number, nowMs: number):
  Promise<Claim> {
  const store = db!;
  const { planJobLaneReservation } = await import("./jobLaneSpend");
  const jobRef = jobRefOf(jobId), runRef = runRefOf(jobId, companyId);
  return store.runTransaction(async (tx): Promise<Claim> => {
    const [record, prior] = await Promise.all([tx.get(jobRef).then(snap => snap.data()), tx.get(runRef).then(snap => snap.data())]);
    if (!record || isInternalTestJob(record) || projectWebsiteCaptureRights(record).consent_revoked) return { state: "gone" };
    const run: Data = isRecord(prior) ? prior : {};
    const jobTotal = count(record[JOB_BRIEF_LESSON_JOB_FIELD]?.total);
    const waits = runWaits(run, digest, jobTotal, nowMs);
    if (waits) return { state: waits };
    const attempts = run.inputDigest === digest ? count(run.attempts) : 0, total = count(run.total);
    const atIso = new Date(nowMs).toISOString();
    const reservationId = `job_brief_lesson-${createHash("sha256").update(`${companyId}:${digest}`).digest("hex").slice(0, 16)}-${total + 1}`;
    const hold = await planJobLaneReservation(tx, jobId, { lane: "job_brief_lesson", reservationId, maximumUsd });
    if (hold.state === "no_job") return { state: "gone" };
    if (hold.state !== "fits") {
      tx.set(runRef, { ...run, inputDigest: digest, kind, status: "limit", limit: "job_spending_cap", limitAtIso: atIso });
      return { state: "limit" };
    }
    const token = randomUUID();
    hold.write(tx);
    tx.set(runRef, { ...run, schemaVersion: JOB_BRIEF_LESSONS_SCHEMA_VERSION, inputDigest: digest, kind, status: "running",
      attempts: attempts + 1, total: total + 1, claimedAtMs: nowMs, claimedAtIso: atIso, claimToken: token, reservationId,
      counted: Array.isArray(run.counted) ? run.counted.filter((key: unknown) => typeof key === "string") : [] });
    tx.set(jobRef, { [JOB_BRIEF_LESSON_JOB_FIELD]: { total: jobTotal + 1, lastAtIso: atIso } }, { mergeFields: [JOB_BRIEF_LESSON_JOB_FIELD] });
    return { state: "claimed", token, reservationId };
  });
}

type RunEnd = { lesson: JobBriefLesson | null; outcome: "kept" | "none" | "dropped" } | { failed: string };

/**
 * The run's end, written only while the claim is still this run's. A kept lesson is counted in its kind's store unless
 * this company already counted it on this job; nothing is counted once the site withdrew or the job is a test job.
 * How it ended (`kept`, `counted_before`, `none`, `dropped`, `withdrawn`, `failed`), or null when the claim was lost.
 */
async function endRun(jobId: string, companyId: string, token: string, kind: ReaderJobKind, end: RunEnd): Promise<string | null> {
  const store = db!;
  const jobRef = jobRefOf(jobId), runRef = runRefOf(jobId, companyId), lessonsRef = storeRef(kind);
  return store.runTransaction(async tx => {
    const [record, run, lessons] = await Promise.all([tx.get(jobRef), tx.get(runRef), tx.get(lessonsRef)].map(read => read.then(snap => snap.data())));
    if (!run || run.claimToken !== token || run.status !== "running") return null;
    const endedAtMs = Date.now(), endedAtIso = new Date(endedAtMs).toISOString();
    if ("failed" in end) {
      tx.set(runRef, { ...run, status: "failed", reason: end.failed, endedAtMs, endedAtIso });
      return "failed";
    }
    const counted: string[] = Array.isArray(run.counted) ? run.counted.filter((key: unknown): key is string => typeof key === "string") : [];
    const withdrawn = !record || isInternalTestJob(record) || projectWebsiteCaptureRights(record).consent_revoked;
    const key = end.lesson ? jobBriefLessonKey(end.lesson) : null;
    let outcome: string = withdrawn ? "withdrawn" : end.outcome;
    if (end.lesson && key && !withdrawn) {
      if (counted.includes(key)) outcome = "counted_before";
      else {
        tx.set(lessonsRef, addJobBriefLesson(sanitizeJobBriefLessonStore(lessons, kind), end.lesson, endedAtIso));
        counted.push(key);
      }
    }
    tx.set(runRef, { ...run, status: "done", reason: null, outcome, lesson: key, counted, endedAtMs, endedAtIso });
    return outcome;
  });
}

const inFlight = new Map<string, Promise<JobBriefLesson | null>>();

/**
 * Learn from one company's answer on one job: read, claim, hold, run, check and count. The lesson kept, or null when
 * there is none or none could be learnt now. Never throws: a lesson is a signal, and the company's answer is saved
 * either way.
 */
export async function ensureJobBriefLesson(jobId: string, companyId: string): Promise<JobBriefLesson | null> {
  if (!db || !/^[A-Za-z0-9_-]{1,200}$/.test(jobId) || !/^[A-Za-z0-9_-]{1,200}$/.test(companyId)) return null;
  const key = `${jobId}/${companyId}`;
  let work = inFlight.get(key);
  if (!work) {
    work = learnOnce(jobId, companyId).catch(error => {
      logger.warn({ err: error, jobId }, "A company's answer could not be turned into a lesson for the job brief");
      return null;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, work);
  }
  return work;
}

/** Start `ensureJobBriefLesson` without waiting for it. */
export function requestJobBriefLesson(jobId: string, companyId: string): void {
  void ensureJobBriefLesson(jobId, companyId);
}

async function learnOnce(jobId: string, companyId: string): Promise<JobBriefLesson | null> {
  const store = db!;
  if (!(await writerAvailable())) return null;
  const jobRef = jobRefOf(jobId);
  const [record, answer, company, prior] = await Promise.all([jobRef.get(), jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(companyId).get(),
    store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId).get(), runRefOf(jobId, companyId).get()]
    .map(read => read.then(snap => snap.data() as Data | undefined)));
  if (!record || !answer || !answerMayTeach(record, companyId, company, answer)) return null;
  const kind = jobReadingOf(record)?.kind ?? null;
  const answerKind = lessonAnswerOf(answer.state);
  if (!kind || !answerKind) return null;
  // Without the site's identity the company's words cannot go through the site's pass: nothing is sent this time.
  const siteKnown = await knownSiteIdentity(record).catch(() => null);
  if (!siteKnown) return null;
  const words = companyWordsForLesson(answer, company, siteKnown);
  if (!words) return null;
  const digest = lessonDigest(kind, answerKind, words);
  if (runWaits(prior, digest, count(record[JOB_BRIEF_LESSON_JOB_FIELD]?.total), Date.now())) return null;
  const input = lessonInput(kind, answerKind, words, await loadJobBriefLessonStore(kind));
  const [{ jobBriefLessonTask }, { laneRunMaximumUsd, settleJobLaneSpend }] = await Promise.all([
    import("../agents/tasks/job-brief-lesson"), import("./jobLaneSpend")]);
  const maximumUsd = await laneRunMaximumUsd("job_brief_lesson", Buffer.byteLength(jobBriefLessonTask.build_prompt(input), "utf8"),
    { scripted: Boolean(writerOverride) });
  if (maximumUsd === null) return null;
  const claim = await claimRun(jobId, companyId, digest, kind, maximumUsd, Date.now());
  if (claim.state !== "claimed") return null;
  let result: RunResult = { answered: false, lesson: null, costUsd: null, basis: "reported_usage" };
  let failure: string | null = null;
  try { result = await runWriter(input, jobId); } catch (error) { failure = error instanceof Error ? error.name : "error"; }
  // The hold settles at what the run cost, or stays whole when that is not known (a throw included).
  await settleJobLaneSpend(jobId, claim.reservationId, result.costUsd, result.basis).catch(error =>
    logger.warn({ err: error, jobId }, "A job brief lesson's hold could not be settled; it stays counted in full"));
  if (!result.answered) { await endRun(jobId, companyId, claim.token, kind, { failed: failure ?? "no_answer" }); return null; }
  const companyKnown = knownCompanyIdentity(company, answer);
  let lesson = result.lesson === null ? null
    : sanitizeJobBriefLesson(result.lesson, answerKind, text => lessonWordsPassUnchanged(text, siteKnown, companyKnown));
  let dropped = result.lesson !== null && !lesson;
  // A question in the model's own words reaches other sites and companies only as a company's words reach a site: the
  // model pass over free text as well (`freeTextScreening.ts`, against this company's budget on this job), kept only
  // when it finds nothing to take out. Not yet screened (no provider, a limit, a failure): tried again with the run.
  if (lesson?.type === "question" && !isJobFactKey(lesson.topic)) {
    const { budgetFor, screenText } = await import("./freeTextScreening");
    const screened = await screenText(jobId, "company", lesson.question, { budget: budgetFor("company", companyId) });
    if (screened === null) { await endRun(jobId, companyId, claim.token, kind, { failed: "lesson_unscreened" }); return null; }
    if (screened.replace(/\s+/g, " ").trim() !== lesson.question) { lesson = null; dropped = true; }
  }
  const outcome = await endRun(jobId, companyId, claim.token, kind,
    { lesson, outcome: lesson ? "kept" : dropped ? "dropped" : "none" });
  return outcome === "kept" || outcome === "counted_before" ? lesson : null;
}

export function resetJobBriefLessonsForTests() {
  inFlight.clear();
  writerOverride = null;
}
