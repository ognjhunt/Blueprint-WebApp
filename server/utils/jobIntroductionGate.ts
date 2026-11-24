/**
 * The dispatch check for BOTH introduction emails (package E, E6; planner 19:50Z, G3; 20:35Z, H2), in its own file so
 * the outbox can import it without a cycle.
 *
 * ONE COMMIT POINT: the company's email (`introduction_made_company`) is dispatched first. The site's "Meet {company}"
 * email (`introduction_made_site`) is created held and released only when the company's row is definitely sent.
 * - Before that point, the one predicate `introductionMayProceed` decides for both: the introduction is on record and not
 *   cancelled, the job is not withdrawn and is still shared under the whole rule (`loadCompanyJobAccess`), the
 *   company is an approved deployment company with a current signed-in acceptance of the Terms (`companyMaySeeJobs`),
 *   and the company's answer on the job, as it stands now, still allows an introduction (`answerConsentsToIntroduction`:
 *   Apply or Tested it: can do, given under a line that agrees to one). A company that changed its answer to anything
 *   else after the site pressed Accept (Not a fit, Need more details, Tested it: cannot yet) is not introduced or billed
 *   (2026-11-24, a $0 stress test: it was). The site's own press checks the same answer (`requestIntroduction`), so
 *   both orders of the race end alike, and only the answer at the commit point counts.
 *   Blueprint's own work window ending (the preparation's `authority_ended` once the window has passed) stops paid
 *   work only: it does not cancel an introduction the site pressed (audit G-06), while every other stop still does.
 *   When it fails, the introduction is cancelled as a whole (`introductionEmailCheck`'s `cancel`, applied by the outbox
 *   in the same transaction after all its reads): both rows not yet sent are cancelled and cleared of both sides'
 *   details; the introduction record is marked cancelled with the reason and time and its sealed details are removed;
 *   the billable event is marked void (kept, never counted). A cancelled introduction does not count among the job's
 *   introductions, and the site's page says beside that company's answer that it could not go ahead.
 * - Once the company's email IS sent, the introduction is made: the site's email goes whatever has changed since,
 *   because the company now holds the site's details and the site must be told who has them; the billable event stands.
 *   (`taskLifecycleNotificationAuthority.ts` asks `siteIntroductionEmailState` for the site's row.)
 * - A held site row never depends on the company row's own step having run (20:55Z, J1): every dispatch pass decides
 *   each held row from the facts (`settleHeldSiteIntroductions`), and a company row that ages out in the outbox's
 *   deferral path ends the introduction there too.
 * - A cancellation caused by Blueprint's own email to the company (`company_email_failed`, `company_email_not_sent`), or
 *   by the company's answer changing (`company_answer_changed`), may be asked for again by the site
 *   (`RETRYABLE_CANCEL_REASONS`); the latter only once the company applies again, as every press requires. Each attempt
 *   after the first has its own email keys
 *   (ending `:a{attempt}`) and its own billable event; the introduction record carries the current `attempt`, and a row
 *   or event of an earlier attempt never acts on the current one.
 * Every other kind passes.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { companyMaySeeJobs } from "./companyTerms";

export const INTRODUCTION_COMPANY_KIND = "introduction_made_company";
export const INTRODUCTION_SITE_EMAIL_KIND = "introduction_made_site";
const attemptSuffix = (attempt: number) => attempt > 0 ? `:a${attempt}` : "";
export const introductionCompanyKey = (requestId: string, companyId: string, attempt = 0) =>
  `${requestId}:${INTRODUCTION_COMPANY_KIND}:${companyId}${attemptSuffix(attempt)}`;
export const introductionSiteEmailKey = (requestId: string, companyId: string, attempt = 0) =>
  `${requestId}:${INTRODUCTION_SITE_EMAIL_KIND}:${companyId}${attemptSuffix(attempt)}`;
/**
 * Cancellations the site may ask again after: Blueprint's own email failing, and the company's answer changing before
 * its email went (a new press needs the company to have applied again: `answerConsentsToIntroduction`). Never one caused
 * by the site, the job or the company's approval.
 */
export const RETRYABLE_CANCEL_REASONS: ReadonlySet<string> = new Set(["company_email_failed", "company_email_not_sent",
  "company_answer_changed"]);
/** The attempt an introduction record is on: 0 for the first. */
export const introductionAttemptOf = (record: Record<string, unknown> | undefined) => {
  const attempt = Number(record?.attempt);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : 0;
};

/** Outbox statuses of a row that has not gone out and is not being handed to the provider: these are cancelled. */
const NOT_YET_SENT = new Set(["pending", "claimed", "review_required", "held"]);
/** The site's row waits in this status until the company's email is definitely sent (H2). */
export const HELD_STATUS = "held";

export type IntroductionStopReason = "introduction_missing" | "introduction_cancelled" | "job_withdrawn" | "job_not_shared"
  | "company_not_approved" | "company_answer_changed" | "company_email_failed" | "company_email_missing" | "company_email_not_sent";

/** The one predicate both introduction emails' dispatch checks call. Reads only; inside a transaction pass `tx`. */
export async function introductionMayProceed(requestId: string, companyId: string, tx?: FirebaseFirestore.Transaction, attempt = 0):
  Promise<{ ok: true } | { ok: false; reason: IntroductionStopReason; introductionOnRecord: boolean }> {
  if (!db) throw new Error("introduction_store_unavailable");
  const jobRef = db.collection("inboundRequests").doc(requestId);
  const introRef = jobRef.collection("introductions").doc(companyId);
  const companyRef = db.collection("robotTeamAccess").doc(companyId);
  const answerRef = jobRef.collection("robotTeamInterest").doc(companyId);
  const [job, intro, company, answer] = tx ? [await tx.get(jobRef), await tx.get(introRef), await tx.get(companyRef), await tx.get(answerRef)]
    : [await jobRef.get(), await introRef.get(), await companyRef.get(), await answerRef.get()];
  if (!intro.exists) return { ok: false, reason: "introduction_missing", introductionOnRecord: false };
  // Cancelled, or an email of an earlier attempt: it stops without touching the current record.
  if (typeof intro.data()?.cancelledAtIso === "string" || introductionAttemptOf(intro.data()) !== attempt)
    return { ok: false, reason: "introduction_cancelled", introductionOnRecord: false };
  const record = job.data();
  if (!job.exists || projectWebsiteCaptureRights(record).consent_revoked)
    return { ok: false, reason: "job_withdrawn", introductionOnRecord: true };
  // Approved, a deployment company, and the current Terms accepted, signed in (`companyMaySeeJobs`).
  if (!companyMaySeeJobs(company.data())) return { ok: false, reason: "company_not_approved", introductionOnRecord: true };
  // The company's answer as it stands now still allows an introduction: Apply or Tested it: can do (money: never
  // introduce or bill a company that has since said Not a fit or anything else). Imported here, not at the top, as the
  // gate stays importable by the outbox without a cycle.
  const { answerConsentsToIntroduction } = await import("./jobCompanies");
  if (!answerConsentsToIntroduction(answer.data())) return { ok: false, reason: "company_answer_changed", introductionOnRecord: true };
  // Blueprint's own work window ending keeps the job listed (`teamJobAccess`, finding G-01), so it passes here; an
  // authority end for a source revocation closes the listing and stops the introduction.
  const { loadCompanyJobAccess } = await import("./teamJobAccess");
  if (!(await loadCompanyJobAccess(requestId, record as Record<string, any>, tx)).access.listed)
    return { ok: false, reason: "job_not_shared", introductionOnRecord: true };
  return { ok: true };
}

/** The company and attempt an introduction email's key names, or null for a key of any other shape. */
export function introductionEmailTarget(entry: { kind: string; requestId: string; idempotencyKey?: string }):
  { companyId: string; attempt: number } | null {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND && entry.kind !== INTRODUCTION_SITE_EMAIL_KIND) return null;
  const prefix = `${entry.requestId}:${entry.kind}:`;
  const rest = entry.idempotencyKey?.startsWith(prefix) ? entry.idempotencyKey.slice(prefix.length) : "";
  const match = /^([a-f0-9]{64})(?::a([1-9][0-9]{0,3}))?$/.exec(rest);
  return match ? { companyId: match[1], attempt: match[2] ? Number(match[2]) : 0 } : null;
}

/**
 * The site's "Meet {company}" email, by the state of the company's email (planner, 20:35Z, H2: one commit point).
 * - "go": the company's email is definitely sent. The introduction is made: the site is told who holds its details,
 *   whatever has changed since (a suspension, a withdrawal, a stale acceptance).
 * - "hold": the company's email has not gone yet (unsent, retrying, being handed over, or its outcome uncertain) and the
 *   introduction may still go ahead. The site's row waits; it is released when the company's row is marked sent.
 * - "cancel": the introduction cannot go ahead: the one predicate fails before the company's email went, or the
 *   company's email was cancelled or definitely failed.
 */
export async function siteIntroductionEmailState(requestId: string, companyId: string, tx?: FirebaseFirestore.Transaction,
  attempt = 0):
  Promise<{ state: "go" } | { state: "hold" } | { state: "cancel"; reason: IntroductionStopReason; introductionOnRecord: boolean }> {
  if (!db) throw new Error("introduction_store_unavailable");
  const companyRowRef = db.collection("captureOutbox").doc(introductionCompanyKey(requestId, companyId, attempt));
  const companyRow = tx ? await tx.get(companyRowRef) : await companyRowRef.get();
  const status = companyRow.exists ? String(companyRow.data()?.status ?? "") : "";
  if (status === "sent") return { state: "go" };
  // Being handed over, or handed over with an unknown outcome: the company may have it, so nothing is cancelled.
  if (status === "dispatching" || status === "unknown") return { state: "hold" };
  const decision = await introductionMayProceed(requestId, companyId, tx, attempt);
  if (!decision.ok) return { state: "cancel", reason: decision.reason, introductionOnRecord: decision.introductionOnRecord };
  if (!companyRow.exists) return { state: "cancel", reason: "company_email_missing", introductionOnRecord: true };
  if (status === "failed" || status === "cancelled") return { state: "cancel", reason: "company_email_failed", introductionOnRecord: true };
  return { state: "hold" };
}

/**
 * The outbox's check for an introduction email. `current` false stops this row; `hold` (the site's row only) puts it
 * back to wait for the company's email; `cancel`, when present, carries the rest of the introduction's cancellation,
 * to be applied in the same transaction after every read (all its own reads are done here).
 */
export async function introductionEmailCheck(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<{ current: boolean; hold?: true; cancel?: (tx: FirebaseFirestore.Transaction) => void }> {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND && entry.kind !== INTRODUCTION_SITE_EMAIL_KIND) return { current: true };
  const target = introductionEmailTarget(entry);
  if (!target) return { current: false };
  const { companyId, attempt } = target;
  let reason: IntroductionStopReason;
  let onRecord: boolean;
  if (entry.kind === INTRODUCTION_SITE_EMAIL_KIND) {
    const site = await siteIntroductionEmailState(entry.requestId, companyId, tx, attempt);
    if (site.state === "go") return { current: true };
    if (site.state === "hold") return { current: false, hold: true };
    reason = site.reason; onRecord = site.introductionOnRecord;
  } else {
    // The company's email goes first; before it is sent, the one predicate decides.
    const decision = await introductionMayProceed(entry.requestId, companyId, tx, attempt);
    if (decision.ok) return { current: true };
    reason = decision.reason; onRecord = decision.introductionOnRecord;
  }
  if (!onRecord || !tx) return { current: false };
  const store = db!;
  const siblingKey = entry.kind === INTRODUCTION_COMPANY_KIND ? introductionSiteEmailKey(entry.requestId, companyId, attempt)
    : introductionCompanyKey(entry.requestId, companyId, attempt);
  const siblingRef = store.collection("captureOutbox").doc(siblingKey);
  const { BILLABLE_EVENTS_COLLECTION, billableEventId } = await import("./billableEvents");
  const eventRef = store.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(entry.requestId, companyId, attempt));
  const introRef = store.collection("inboundRequests").doc(entry.requestId).collection("introductions").doc(companyId);
  const [sibling, event] = [await tx.get(siblingRef), await tx.get(eventRef)];
  return {
    current: false,
    cancel: write => {
      const atIso = new Date().toISOString();
      write.set(introRef, { cancelledAtIso: atIso, cancelReason: reason, siteShared: null, companyShared: null }, { merge: true });
      if (event.exists) write.set(eventRef, { status: "void", voidedAtIso: atIso, voidReason: reason }, { merge: true });
      if (sibling.exists && NOT_YET_SENT.has(String(sibling.data()?.status)))
        write.set(siblingRef, { status: "cancelled", lastError: "introduction_cancelled", subject: "", body: "", replyTo: null,
          detailsClearedAtIso: atIso }, { merge: true });
    },
  };
}

/**
 * Inside the transaction that ends the company's introduction email. Reads now (reads before writes); the caller applies
 * `write` only for the matching end:
 * - sent: the introduction is made: its billable event records when (`madeAtIso`), and the site's held
 *   "Meet {company}" row is released (`sent` returns whether it was);
 * - definitely failed: the company never received the site's details, so the introduction is cancelled as a whole
 *   (`company_email_failed`): the site's row is cancelled and cleared, the record marked, the billable event void.
 */
export async function companyIntroductionEmailEnd(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx: FirebaseFirestore.Transaction): Promise<null | { siteRow: FirebaseFirestore.DocumentReference;
    sent: (tx: FirebaseFirestore.Transaction) => boolean; failed: (tx: FirebaseFirestore.Transaction) => void }> {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND || !db) return null;
  const target = introductionEmailTarget(entry);
  if (!target) return null;
  const { companyId, attempt } = target;
  const store = db;
  const siteRef = store.collection("captureOutbox").doc(introductionSiteEmailKey(entry.requestId, companyId, attempt));
  const { BILLABLE_EVENTS_COLLECTION, billableEventId } = await import("./billableEvents");
  const eventRef = store.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(entry.requestId, companyId, attempt));
  const introRef = store.collection("inboundRequests").doc(entry.requestId).collection("introductions").doc(companyId);
  const [site, event, intro] = [await tx.get(siteRef), await tx.get(eventRef), await tx.get(introRef)];
  const siteStatus = site.exists ? String(site.data()?.status) : "";
  return {
    siteRow: siteRef,
    sent: write => {
      // The company now holds the site's details: the introduction was made at this moment. Written once.
      const eventData = event.data();
      if (event.exists && eventData?.status !== "void" && typeof eventData?.madeAtIso !== "string")
        write.set(eventRef, { madeAtIso: new Date().toISOString() }, { merge: true });
      if (siteStatus !== HELD_STATUS) return false;
      write.set(siteRef, { status: "pending", nextAttemptAtMs: null, lastError: null, releasedAtIso: new Date().toISOString() },
        { merge: true });
      return true;
    },
    failed: write => {
      if (!intro.exists || typeof intro.data()?.cancelledAtIso === "string" || introductionAttemptOf(intro.data()) !== attempt) return;
      const atIso = new Date().toISOString(), reason: IntroductionStopReason = "company_email_failed";
      write.set(introRef, { cancelledAtIso: atIso, cancelReason: reason, siteShared: null, companyShared: null }, { merge: true });
      if (event.exists) write.set(eventRef, { status: "void", voidedAtIso: atIso, voidReason: reason }, { merge: true });
      if (NOT_YET_SENT.has(siteStatus)) write.set(siteRef, { status: "cancelled", lastError: "introduction_cancelled",
        subject: "", body: "", replyTo: null, detailsClearedAtIso: atIso }, { merge: true });
    },
  };
}

/** Reads (call before any write): the writes that cancel an introduction as a whole, for `reason`. */
async function introductionCancellation(tx: FirebaseFirestore.Transaction, requestId: string, companyId: string,
  reason: IntroductionStopReason, attempt: number): Promise<(tx: FirebaseFirestore.Transaction) => void> {
  const store = db!;
  const { BILLABLE_EVENTS_COLLECTION, billableEventId } = await import("./billableEvents");
  const introRef = store.collection("inboundRequests").doc(requestId).collection("introductions").doc(companyId);
  const eventRef = store.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(requestId, companyId, attempt));
  const rowRefs = [introductionCompanyKey(requestId, companyId, attempt), introductionSiteEmailKey(requestId, companyId, attempt)]
    .map(key => store.collection("captureOutbox").doc(key));
  const intro = await tx.get(introRef), event = await tx.get(eventRef);
  const rows: FirebaseFirestore.DocumentSnapshot[] = [];
  for (const ref of rowRefs) rows.push(await tx.get(ref));
  return write => {
    const atIso = new Date().toISOString();
    if (intro.exists && typeof intro.data()?.cancelledAtIso !== "string" && introductionAttemptOf(intro.data()) === attempt) {
      write.set(introRef, { cancelledAtIso: atIso, cancelReason: reason, siteShared: null, companyShared: null }, { merge: true });
      if (event.exists) write.set(eventRef, { status: "void", voidedAtIso: atIso, voidReason: reason }, { merge: true });
    }
    rows.forEach((row, index) => {
      if (row.exists && NOT_YET_SENT.has(String(row.data()?.status))) write.set(rowRefs[index], { status: "cancelled",
        lastError: "introduction_cancelled", subject: "", body: "", replyTo: null, detailsClearedAtIso: atIso }, { merge: true });
    });
  };
}

/**
 * Planner, 20:55Z, J1: a held "Meet {company}" row never depends on another row's code path having run. Each dispatch
 * pass decides every held row from the facts, in its own transaction:
 * - the company's email is sent: the row is released (pending, due now);
 * - the introduction cannot go ahead (the one predicate fails before the send, or the company's row is failed, cancelled
 *   or missing): the introduction is cancelled as a whole (rows cancelled and cleared, record marked, event void);
 * - otherwise it keeps holding, but never past the outbox's own maximum age (`maxAgeMs`, from the row's creation): then
 *   it is cancelled the same way (`company_email_not_sent`). The one exception is a company row whose dispatch may have
 *   reached the company (`dispatching`, or `unknown`): cancelling would tell the site "We did not give them your details"
 *   when that may be false, so it keeps holding until that row's own outcome is settled.
 */
export async function settleHeldSiteIntroductions(limit: number, nowMs: number, maxAgeMs: number,
  ageOf: (row: Record<string, unknown>, nowMs: number) => number): Promise<{ released: number; cancelled: number }> {
  if (!db) return { released: 0, cancelled: 0 };
  const store = db;
  const held = await store.collection("captureOutbox").where("status", "==", HELD_STATUS).limit(limit).get();
  const outcome = { released: 0, cancelled: 0 };
  for (const doc of held.docs) {
    try {
      const result = await store.runTransaction(async tx => {
        const row = (await tx.get(doc.ref)).data();
        if (row?.status !== HELD_STATUS || row.kind !== INTRODUCTION_SITE_EMAIL_KIND) return "skipped" as const;
        const entry = { kind: String(row.kind), requestId: String(row.requestId), idempotencyKey: String(row.idempotencyKey ?? doc.id) };
        const target = introductionEmailTarget(entry);
        if (!target) {
          tx.set(doc.ref, { status: "cancelled", lastError: "introduction_cancelled", subject: "", body: "", replyTo: null,
            detailsClearedAtIso: new Date(nowMs).toISOString() }, { merge: true });
          return "cancelled" as const;
        }
        const { companyId, attempt } = target;
        const state = await siteIntroductionEmailState(entry.requestId, companyId, tx, attempt);
        if (state.state === "go") {
          tx.set(doc.ref, { status: "pending", nextAttemptAtMs: null, lastError: null, releasedAtIso: new Date(nowMs).toISOString() },
            { merge: true });
          return "released" as const;
        }
        let reason: IntroductionStopReason;
        if (state.state === "cancel") reason = state.reason;
        else {
          if (ageOf(row, nowMs) <= maxAgeMs) return "held" as const;
          const companyRow = (await tx.get(store.collection("captureOutbox").doc(introductionCompanyKey(entry.requestId, companyId, attempt)))).data();
          if (companyRow?.status === "dispatching" || companyRow?.status === "unknown") return "held" as const;
          reason = "company_email_not_sent";
        }
        const cancel = await introductionCancellation(tx, entry.requestId, companyId, reason, attempt);
        cancel(tx);
        return "cancelled" as const;
      });
      if (result === "released") outcome.released += 1;
      if (result === "cancelled") outcome.cancelled += 1;
    } catch {
      // Decided again on the next pass.
    }
  }
  return outcome;
}

/** True for every other kind; for an introduction email, true only while `introductionMayProceed` holds. */
export async function introductionEmailIsCurrent(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  return (await introductionEmailCheck(entry, tx)).current;
}
