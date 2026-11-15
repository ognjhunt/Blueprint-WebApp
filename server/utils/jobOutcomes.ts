/**
 * Outcome questions after an introduction (PACKAGE_E E8). No person at Blueprint is in the loop.
 *
 * Fourteen, 45 and 90 days after a site asked for an introduction, each side gets one email: "How did
 * it go with {the other side's name}?", one sentence, and five signed one-click links. A click opens a
 * confirm page (a GET records nothing: email scanners follow links); confirming records
 * `{ by, state, atIso }` on the introduction's `outcomes` array and shows a thank-you page. A later
 * answer from the same side appends; the latest per side is its current state (`latestOutcome`).
 *
 * The rules of when a question is owed are in `jobOutcomeGate.ts`, which the outbox also runs before
 * it sends. Each question is queued under a document id fixed by job, company, side and date, so a
 * sweep run twice queues it once. Each side already knows the other's name from the introduction;
 * the email names it and says nothing else about the other side.
 */
import { FINAL_OUTCOME_STATES } from "../../client/src/lib/jobOutcomeStates";
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { OUTCOME_STATES, OUTCOME_STATE_LABELS, type OutcomeState } from "../../client/src/lib/jobOutcomeStates";
import { logger } from "../logger";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { enqueueOutbox } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import {
  INTRODUCTIONS_SUBCOLLECTION, JOB_OUTCOME_QUESTION_KIND, dueOutcomeQuestionDay, jobTakesOutcomeQuestions, outcomeQuestionKey,
  outcomesOf, type IntroductionLike, type OutcomeQuestionDay, type OutcomeRecord,
} from "./jobOutcomeGate";
import { createJobOutcomeToken, verifyJobOutcomeToken, type OutcomeSide } from "./jobOutcomeToken";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";

export { outcomeQuestionIsCurrent, OUTCOME_QUESTION_DAYS, type OutcomeRecord } from "./jobOutcomeGate";
export { OUTCOME_STATE_LABELS, OUTCOME_STATES, type OutcomeState } from "../../client/src/lib/jobOutcomeStates";

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

/** The one email to one side: one sentence, then the five answers as signed links. Nothing else. */
export function buildOutcomeQuestionEmail(params: { requestId: string; companyId: string; side: OutcomeSide; otherSideName: string;
  nowMs?: number }): { subject: string; body: string } {
  const origin = appOrigin();
  const links = OUTCOME_STATES.map(state => {
    const token = createJobOutcomeToken({ requestId: params.requestId, companyId: params.companyId, by: params.side, state,
      nowMs: params.nowMs });
    return `${OUTCOME_STATE_LABELS[state]}: ${origin}/api/job-outcomes/${token}`;
  });
  return { subject: outcomeQuestionSubject(params.otherSideName),
    body: `${outcomeQuestionSentence(params.otherSideName)}\n\n${links.join("\n")}` };
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
  const [siteName, siteEmail, companyName, companyEmail] = await Promise.all([
    plain(site.name), plain(site.email), plain(company.company), plain(company.email)]);
  const out: Array<{ side: OutcomeSide; to: string; otherSideName: string }> = [];
  // A side with no address, or whose counterpart has no name to ask about, is not asked: nothing is made up.
  if (isEmail(siteEmail) && companyName) out.push({ side: "site", to: siteEmail, otherSideName: companyName });
  if (isEmail(companyEmail) && siteName) out.push({ side: "company", to: companyEmail, otherSideName: siteName });
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
 * Queue every question owed now. Idempotent: each question's outbox document id is fixed, so a second
 * pass (or a second process) queues nothing new. The outbox re-checks the same rules before it sends.
 */
export async function sweepOutcomeQuestions(options: { now?: Date } = {}): Promise<OutcomeSweepSummary> {
  const summary: OutcomeSweepSummary = { examined: 0, queued: 0 };
  if (!db) return summary;
  const nowMs = (options.now ?? new Date()).getTime();
  const jobs = new Map<string, boolean>();
  for await (const intro of introductions()) {
    summary.examined += 1;
    const where = introductionPath(intro.path);
    if (!where) continue;
    const day: OutcomeQuestionDay | null = dueOutcomeQuestionDay(intro.data, nowMs);
    if (day === null) continue;
    try {
      if (!jobs.has(where.requestId)) {
        const job = await db.collection("inboundRequests").doc(where.requestId).get();
        jobs.set(where.requestId, job.exists && await jobTakesOutcomeQuestions(where.requestId, job.data() as Record<string, unknown>));
      }
      if (!jobs.get(where.requestId)) continue;
      for (const recipient of await recipientsOf(intro.data)) {
        const email = buildOutcomeQuestionEmail({ requestId: where.requestId, companyId: where.companyId, side: recipient.side,
          otherSideName: recipient.otherSideName, nowMs });
        const { enqueued } = await enqueueOutbox({
          idempotencyKey: outcomeQuestionKey(where.requestId, where.companyId, recipient.side, day),
          requestId: where.requestId,
          kind: JOB_OUTCOME_QUESTION_KIND,
          to: recipient.to, subject: email.subject, body: email.body,
        });
        if (enqueued) summary.queued += 1;
      }
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
      try { await sweepOutcomeQuestions(); }
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
      /** Already final ("Installed" or "Not going ahead" from either side): nothing more is recorded (review S3). */
      finalAlready?: OutcomeState }
  | { ok: false; reason: "invalid_link" | "not_found" | "closed" | "store_unavailable" };

/**
 * Record the answer a link carries. Refused for a bad, expired or other-purpose link, a missing
 * introduction, and a job whose site withdrew. The same answer from the same side again within the
 * hour (a double click, a second tap on the confirm page) is recorded once.
 */
const REPEAT_CLICK_MS = 60 * 60 * 1000;

export async function recordOutcomeAnswer(token: string, now = new Date()): Promise<OutcomeAnswerResult> {
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
    // A final answer is final (planner, 2026-11-12, S3): after "Installed" or "Not going ahead" from either side, a later
    // link records nothing and says what is on record.
    const final = existing.find(record => record && FINAL_OUTCOME_STATES.has(record.state as OutcomeState));
    if (final) return { ok: true, state: payload.state, recorded: false, finalAlready: final.state as OutcomeState };
    // The same link used twice records once, however long apart.
    const link = createHash("sha256").update(token).digest("hex");
    if (existing.some(record => (record as { link?: unknown })?.link === link)) return { ok: true, state: payload.state, recorded: false };
    const mine = latestOutcome(data)[payload.by];
    // A repeated click of the same answer within the hour is one answer; the same answer to a later question appends.
    if (mine?.state === payload.state && now.getTime() - Date.parse(mine.atIso) < REPEAT_CLICK_MS)
      return { ok: true, state: payload.state, recorded: false };
    const entry = { by: payload.by, state: payload.state, atIso: now.toISOString(), link } as OutcomeRecord;
    tx.update(introRef, { outcomes: [...existing, entry] });
    return { ok: true, state: payload.state, recorded: true };
  });
}
