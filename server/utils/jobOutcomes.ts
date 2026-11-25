/**
 * Outcome questions after an introduction (PACKAGE_E E8). No person at Blueprint is in the loop.
 *
 * Fourteen, 45 and 90 days after a site asked for an introduction, each side gets one email: "How did
 * it go with {the other side's name}?", one sentence, and five signed links, one per answer (`OUTCOME_STATES`: no
 * contact yet, we met, a site visit booked or done, a pilot or deployment agreed, not going ahead). A click opens a
 * confirm page (a GET records nothing: email scanners follow links); its one press records the answer, and on "Not
 * going ahead" each of its buttons is one reason from a closed list (`NOT_GOING_AHEAD_REASONS`) or none. Recording
 * appends `{ by, state, atIso, reason? }` to the introduction's `outcomes` array and sets `latestOutcomeBySide`
 * (`{ site?, company? }`, each `{ state, atIso, reason }`, `reason` null when none), the latest answer of each side.
 * Nothing here is a billable event or touches one.
 *
 * An internal test job (owner, 2026-11-25) is asked only about its introduction to Blueprint's internal test company,
 * and only at the internal test inbox (both sides of that introduction are that inbox); the signed internal route can
 * ask a date's question at once (`queueInternalTestOutcomeQuestions`), so an engineering session need not wait 14 days.
 *
 * The rules of when a question is owed are in `jobOutcomeGate.ts`, which the outbox also runs before
 * it sends. Each question is queued under a document id fixed by job, company, side and date, so a
 * sweep run twice queues it once. Each side already knows the other's name from the introduction;
 * the email names it and says nothing else about the other side.
 */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { FINAL_OUTCOME_STATES, OUTCOME_STATES, OUTCOME_STATE_LABELS, isNotGoingAheadReason, type NotGoingAheadReason, type OutcomeState }
  from "../../client/src/lib/jobOutcomeStates";
import { logger } from "../logger";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { enqueueOutbox } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import {
  INTRODUCTIONS_SUBCOLLECTION, JOB_OUTCOME_QUESTION_KIND, dueOutcomeQuestionDay, introductionTakesOutcomeQuestions, outcomeQuestionKey,
  outcomeQuestionsEnded, outcomesOf, type IntroductionLike, type OutcomeQuestionDay, type OutcomeRecord,
} from "./jobOutcomeGate";
import { isInternalTestInbox, loadInternalTestCompany } from "./internalTestCompany";
import { isInternalTestJob } from "./internalTestJob";
import { createJobOutcomeToken, verifyJobOutcomeToken, type OutcomeSide } from "./jobOutcomeToken";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { recordWorkerLoopPass } from "./workerHeartbeat";

export { outcomeQuestionIsCurrent, OUTCOME_QUESTION_DAYS, type OutcomeRecord } from "./jobOutcomeGate";
export { OUTCOME_STATE_LABELS, OUTCOME_STATES, outcomeLabel, type OutcomeState } from "../../client/src/lib/jobOutcomeStates";

/** The introduction's latest answer of each side, as recorded beside `outcomes`; `reason` is null when none was given. */
export const LATEST_OUTCOME_FIELD = "latestOutcomeBySide";
export type LatestOutcomeBySide = Partial<Record<OutcomeSide, { state: OutcomeState; atIso: string; reason: NotGoingAheadReason | null }>>;

/* ----------------------------------------------------------------- reading */

/** The current answer of each side and the latest of both. For the admin console. */
export function latestOutcome(introduction: IntroductionLike | null | undefined): {
  site: OutcomeRecord | null; company: OutcomeRecord | null; latest: OutcomeRecord | null;
} {
  let site: OutcomeRecord | null = null, company: OutcomeRecord | null = null, latest: OutcomeRecord | null = null;
  // Recorded in order; a later entry wins a tie on time.
  const later = (a: OutcomeRecord | null, b: OutcomeRecord) => !a || Date.parse(b.atIso) >= Date.parse(a.atIso) ? b : a;
  for (const record of outcomesOf(introduction)) {
    if (record.by === "site") site = later(site, record); else company = later(company, record);
    latest = later(latest, record);
  }
  return { site, company, latest };
}

/* ------------------------------------------------------------------ emails */

function appOrigin(): string {
  return (process.env.VITE_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://tryblueprint.io").replace(/\/+$/, "");
}

export const outcomeQuestionSubject = (otherSide: string) => `How did it go with ${otherSide}?`;
/** Two presses, not one: the link opens a page whose button records it (review S2). */
export const outcomeQuestionSentence = (otherSide: string) => `Press one to tell us what happened with ${otherSide}.`;

/** The signed answer links of one question to one side, one per answer offered, in order. */
export function outcomeAnswerLinks(params: { requestId: string; companyId: string; side: OutcomeSide; nowMs?: number }):
  Array<{ state: OutcomeState; label: string; url: string }> {
  const origin = appOrigin();
  return OUTCOME_STATES.map(state => ({ state, label: OUTCOME_STATE_LABELS[state],
    url: `${origin}/api/job-outcomes/${createJobOutcomeToken({ requestId: params.requestId, companyId: params.companyId,
      by: params.side, state, nowMs: params.nowMs })}` }));
}

/**
 * The one email to one side: one sentence, then the five answers as signed links. Nothing else. Each answer is its
 * own "Label:" paragraph followed by its link, so the HTML part draws five labelled buttons (`emailLayout.ts`).
 */
export function buildOutcomeQuestionEmail(params: { requestId: string; companyId: string; side: OutcomeSide; otherSideName: string;
  nowMs?: number }): { subject: string; body: string } {
  const links = outcomeAnswerLinks(params).map(link => `${link.label}:\n${link.url}`);
  return { subject: outcomeQuestionSubject(params.otherSideName),
    body: `${outcomeQuestionSentence(params.otherSideName)}\n\n${links.join("\n\n")}` };
}

async function plain(value: unknown): Promise<string | null> {
  if (value === null || value === undefined) return null;
  try {
    const text = String(await decryptFieldValue(value as never)).trim();
    return text || null;
  } catch { return null; }
}

const isEmail = (value: string | null): value is string => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
const record = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});

/** Who gets which question: each side's own address, and the other side's name only. */
async function recipientsOf(introduction: IntroductionLike): Promise<Array<{ side: OutcomeSide; to: string; otherSideName: string }>> {
  const site = record(introduction.siteShared), company = record(introduction.companyShared);
  const [siteName, siteEmail, siteLocation, companyName, companyEmail] = await Promise.all([
    plain(site.name), plain(site.email), plain(site.location), plain(company.company), plain(company.email)]);
  const out: Array<{ side: OutcomeSide; to: string; otherSideName: string }> = [];
  // A side with no address, or whose counterpart has no name to ask about, is not asked: nothing is made up.
  if (isEmail(siteEmail) && companyName) out.push({ side: "site", to: siteEmail, otherSideName: companyName });
  // A job from the public start form stores its typed address as the site's name: the company is asked about "the
  // site at" that address, which the introduction already gave it.
  if (isEmail(companyEmail) && siteName) out.push({ side: "company", to: companyEmail,
    otherSideName: siteName === siteLocation ? `the site at ${siteName}` : siteName });
  return out;
}

/* ------------------------------------------------------------------- sweep */

export interface OutcomeSweepSummary { examined: number; queued: number }

const SWEEP_PAGE = 200;

type IntroductionDoc = { path: string; data: IntroductionLike };

/** Every introduction, a page at a time (a collection-group read needs no extra index). */
async function* introductions(): AsyncGenerator<IntroductionDoc> {
  const store = db!;
  let after: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let query = store.collectionGroup(INTRODUCTIONS_SUBCOLLECTION).limit(SWEEP_PAGE);
    if (after) query = query.startAfter(after);
    const page = await query.get();
    for (const doc of page.docs) yield { path: doc.ref.path, data: doc.data() as IntroductionLike };
    if (page.docs.length < SWEEP_PAGE) return;
    after = page.docs[page.docs.length - 1];
  }
}

/** `inboundRequests/{requestId}/introductions/{companyId}`, or null for any other path. */
export function introductionPath(path: string): { requestId: string; companyId: string } | null {
  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "inboundRequests" || parts[2] !== INTRODUCTIONS_SUBCOLLECTION || !parts[1] || !parts[3]) return null;
  return { requestId: parts[1], companyId: parts[3] };
}

/**
 * Queue the questions of one introduction that `dayFor` names, one per side: each to that side's own address, and on an
 * internal test job only to the internal test inbox. Returns how many were new rows.
 */
async function queueOwedQuestions(requestId: string, companyId: string, introduction: IntroductionLike, record: Record<string, unknown>,
  dayFor: (side: OutcomeSide) => OutcomeQuestionDay | null, nowMs: number, queuedKeys?: string[]): Promise<number> {
  let queued = 0;
  for (const recipient of await recipientsOf(introduction)) {
    const day = dayFor(recipient.side);
    if (day === null) continue;
    if (isInternalTestJob(record) && !isInternalTestInbox(recipient.to)) continue;
    const email = buildOutcomeQuestionEmail({ requestId, companyId, side: recipient.side, otherSideName: recipient.otherSideName, nowMs });
    const idempotencyKey = outcomeQuestionKey(requestId, companyId, recipient.side, day);
    const { enqueued } = await enqueueOutbox({ idempotencyKey, requestId, kind: JOB_OUTCOME_QUESTION_KIND, to: recipient.to,
      subject: email.subject, body: email.body });
    if (enqueued) { queued += 1; queuedKeys?.push(idempotencyKey); }
  }
  return queued;
}

/**
 * Queue every question owed now. Idempotent: each question's outbox document id is fixed, so a second
 * pass (or a second process) queues nothing new. The outbox re-checks the same rules before it sends.
 */
export async function sweepOutcomeQuestions(options: { now?: Date } = {}): Promise<OutcomeSweepSummary> {
  const summary: OutcomeSweepSummary = { examined: 0, queued: 0 };
  if (!db) return summary;
  const nowMs = (options.now ?? new Date()).getTime();
  const jobs = new Map<string, Record<string, unknown> | null>();
  for await (const intro of introductions()) {
    summary.examined += 1;
    const where = introductionPath(intro.path);
    if (!where) continue;
    // Each side's own date: one side's final answer never ends the other's questions.
    const dueFor = (side: OutcomeSide): OutcomeQuestionDay | null => dueOutcomeQuestionDay(intro.data, nowMs, side);
    if (dueFor("site") === null && dueFor("company") === null) continue;
    try {
      if (!jobs.has(where.requestId)) {
        const job = await db.collection("inboundRequests").doc(where.requestId).get();
        jobs.set(where.requestId, job.exists ? job.data() as Record<string, unknown> : null);
      }
      const record = jobs.get(where.requestId) ?? null;
      // On an internal test job, only its introduction to the internal test company is asked about (read per introduction).
      const company = record && isInternalTestJob(record)
        ? (await db.collection("robotTeamAccess").doc(where.companyId).get()).data() as Record<string, unknown> | undefined : undefined;
      if (!introductionTakesOutcomeQuestions(record, where.companyId, company)) continue;
      summary.queued += await queueOwedQuestions(where.requestId, where.companyId, intro.data, record!, dueFor, nowMs);
    } catch (error) {
      logger.warn({ error, requestId: where.requestId }, "Could not queue an outcome question; the next sweep tries again");
    }
  }
  return summary;
}

export function startJobOutcomeQuestionWorker(options: { intervalMs?: number; lease?: AutomationLeaderLease } = {}): () => void {
  // A pull request preview shares the production store and must never email a site or a company.
  if (process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true") return () => undefined;
  const lease = options.lease ?? createAutomationLeaderLease({ leaseName: "job-outcome-questions-leader" });
  lease.start();
  let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (!running && lease.isLeader()) {
      running = true;
      try { await sweepOutcomeQuestions(); await recordWorkerLoopPass("outcome-questions"); }
      catch (error) { logger.error({ err: error }, "Outcome question sweep failed; it will retry"); }
      finally { running = false; }
    }
    if (!stopped) { timer = setTimeout(run, options.intervalMs ?? 15 * 60_000); timer.unref?.(); }
  };
  timer = setTimeout(run, 30_000); timer.unref?.();
  return () => { stopped = true; if (timer) clearTimeout(timer); void lease.stop(); };
}

/* ------------------------------------------------------------------ answer */

export type OutcomeAnswerResult =
  | { ok: true; state: OutcomeState; recorded: boolean;
      /** The reason recorded with "Not going ahead", when the side chose one. */
      notGoingAheadReason?: NotGoingAheadReason;
      /** This side's own answer was already final ("Not going ahead", or "Installed" while offered): nothing more is
       * recorded for it (review S3). Never the other side's answer. */
      finalAlready?: OutcomeState }
  | { ok: false; reason: "invalid_link" | "not_found" | "closed" | "store_unavailable" };

/** The latest answer of each side, as stored beside `outcomes`: every field written, `reason` null when none. */
function latestBySide(outcomes: unknown[]): LatestOutcomeBySide {
  const latest = latestOutcome({ outcomes });
  const out: LatestOutcomeBySide = {};
  for (const side of ["site", "company"] as const) {
    const record = latest[side];
    if (record) out[side] = { state: record.state, atIso: record.atIso, reason: record.reason ?? null };
  }
  return out;
}

/**
 * Record the answer a link carries, with `reason` (one of `NOT_GOING_AHEAD_REASONS`, pressed on the confirm page) only
 * for "Not going ahead"; any other value, or a reason on another answer, is not recorded. Refused for a bad, expired or
 * other-purpose link, a missing introduction, and a job whose site withdrew. The same answer from the same side again
 * within the hour (a double click, a second tap on the confirm page) is recorded once. Never a billable event.
 */
const REPEAT_CLICK_MS = 60 * 60 * 1000;

export async function recordOutcomeAnswer(token: string, now = new Date(), options: { reason?: unknown } = {}): Promise<OutcomeAnswerResult> {
  const payload = verifyJobOutcomeToken(token, now.getTime());
  if (!payload) return { ok: false, reason: "invalid_link" };
  if (!db) return { ok: false, reason: "store_unavailable" };
  const store = db;
  const jobRef = store.collection("inboundRequests").doc(payload.r);
  const introRef = jobRef.collection(INTRODUCTIONS_SUBCOLLECTION).doc(payload.c);
  return store.runTransaction(async (tx): Promise<OutcomeAnswerResult> => {
    const [job, intro] = [await tx.get(jobRef), await tx.get(introRef)];
    if (!job.exists || !intro.exists) return { ok: false, reason: "not_found" };
    if (projectWebsiteCaptureRights(job.data()).consent_revoked) return { ok: false, reason: "closed" };
    const data = intro.data() as IntroductionLike;
    const existing = Array.isArray(data.outcomes) ? data.outcomes : [];
    // A final answer is final for the side that gave it (planner, 2026-11-12, S3): after its own "Installed" or "Not going
    // ahead", a later link of the same side records nothing and says what that side said. The other side's answer never
    // refuses this one, and is never said to it (stress test round 2, 2026-11-24).
    const final = existing.find(record => record && record.by === payload.by && FINAL_OUTCOME_STATES.has(record.state as OutcomeState));
    if (final) return { ok: true, state: payload.state, recorded: false, finalAlready: final.state as OutcomeState };
    // The same link used twice records once, however long apart.
    const link = createHash("sha256").update(token).digest("hex");
    if (existing.some(record => (record as { link?: unknown })?.link === link)) return { ok: true, state: payload.state, recorded: false };
    const mine = latestOutcome(data)[payload.by];
    // A repeated click of the same answer within the hour is one answer; the same answer to a later question appends.
    if (mine?.state === payload.state && now.getTime() - Date.parse(mine.atIso) < REPEAT_CLICK_MS)
      return { ok: true, state: payload.state, recorded: false };
    const reason = payload.state === "not_going_ahead" && isNotGoingAheadReason(options.reason) ? options.reason : null;
    const entry = { by: payload.by, state: payload.state, atIso: now.toISOString(), ...(reason ? { reason } : {}), link } as OutcomeRecord;
    const outcomes = [...existing, entry];
    tx.update(introRef, { outcomes, [LATEST_OUTCOME_FIELD]: latestBySide(outcomes) });
    return { ok: true, state: payload.state, recorded: true, ...(reason ? { notGoingAheadReason: reason } : {}) };
  });
}

/* ------------------------------------------------------- the internal test company */

export type InternalTestOutcomeQuestionsResult =
  | { ok: true; queued: string[];
      /** Each side's answer links, as its email carries them: the pair is Blueprint's own, at the internal test inbox. */
      answers: Partial<Record<OutcomeSide, Array<{ state: OutcomeState; label: string; url: string }>>> }
  | { ok: false; reason: "store_unavailable" | "no_test_company" | "not_found" | "not_a_test_job" | "not_introduced" | "closed" };

/**
 * Ask a date's outcome question now, for an internal test job's introduction to the internal test company only (owner,
 * 2026-11-25), so an engineering session can test the follow-up end to end without waiting for the date. The same email,
 * the same row id as the sweep's for that date (so it is asked once either way), the same dispatch check, and only to the
 * internal test inbox. A side that already gave its final answer is not asked. Nothing billable is written.
 */
export async function queueInternalTestOutcomeQuestions(requestId: string, day: OutcomeQuestionDay, now = new Date()):
  Promise<InternalTestOutcomeQuestionsResult> {
  if (!db) return { ok: false, reason: "store_unavailable" };
  const company = await loadInternalTestCompany(db);
  if (!company) return { ok: false, reason: "no_test_company" };
  const job = (await db.collection("inboundRequests").doc(requestId).get()).data();
  if (!job) return { ok: false, reason: "not_found" };
  if (!isInternalTestJob(job)) return { ok: false, reason: "not_a_test_job" };
  const intro = (await db.collection("inboundRequests").doc(requestId).collection(INTRODUCTIONS_SUBCOLLECTION).doc(company.id).get())
    .data() as IntroductionLike | undefined;
  if (!intro || typeof intro.cancelledAtIso === "string") return { ok: false, reason: "not_introduced" };
  if (!introductionTakesOutcomeQuestions(job, company.id, company.record)) return { ok: false, reason: "closed" };
  const nowMs = now.getTime();
  const owed = (side: OutcomeSide) => outcomeQuestionsEnded(intro, side) ? null : day;
  const queued: string[] = [];
  await queueOwedQuestions(requestId, company.id, intro, job, owed, nowMs, queued);
  const answers: Partial<Record<OutcomeSide, Array<{ state: OutcomeState; label: string; url: string }>>> = {};
  for (const recipient of await recipientsOf(intro)) {
    if (owed(recipient.side) !== null && isInternalTestInbox(recipient.to))
      answers[recipient.side] = outcomeAnswerLinks({ requestId, companyId: company.id, side: recipient.side, nowMs });
  }
  return { ok: true, queued, answers };
}
