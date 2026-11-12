/**
 * The dispatch check for BOTH introduction emails (package E, E6; planner 19:50Z, G3; 20:35Z, H2), in its own file so
 * the outbox can import it without a cycle.
 *
 * ONE COMMIT POINT: the company's email (`introduction_made_company`) is dispatched first. The site's "Meet {company}"
 * email (`introduction_made_site`) is created held and released only when the company's row is definitely sent.
 * - Before that point, the one predicate `introductionMayProceed` decides for both: the introduction is on record and not
 *   cancelled, the job is not withdrawn and is still shared under the whole rule (`loadCompanyJobAccess`), and the
 *   company is an approved deployment company with a current signed-in acceptance of the Terms (`companyMaySeeJobs`).
 *   When it fails, the introduction is cancelled as a whole (`introductionEmailCheck`'s `cancel`, applied by the outbox
 *   in the same transaction after all its reads): both rows not yet sent are cancelled and cleared of both sides'
 *   details; the introduction record is marked cancelled with the reason and time and its sealed details are removed;
 *   the billable event is marked void (kept, never counted). A cancelled introduction does not count toward the job's
 *   three, and the site's page says beside that company's answer that it could not go ahead.
 * - Once the company's email IS sent, the introduction is made: the site's email goes whatever has changed since,
 *   because the company now holds the site's details and the site must be told who has them; the billable event stands.
 *   (`taskLifecycleNotificationAuthority.ts` asks `siteIntroductionEmailState` for the site's row.)
 * Every other kind passes.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { companyMaySeeJobs } from "./companyTerms";

export const INTRODUCTION_COMPANY_KIND = "introduction_made_company";
export const INTRODUCTION_SITE_EMAIL_KIND = "introduction_made_site";
export const introductionCompanyKey = (requestId: string, companyId: string) => `${requestId}:${INTRODUCTION_COMPANY_KIND}:${companyId}`;
const introductionSiteEmailKey = (requestId: string, companyId: string) => `${requestId}:${INTRODUCTION_SITE_EMAIL_KIND}:${companyId}`;

/** Outbox statuses of a row that has not gone out and is not being handed to the provider: these are cancelled. */
const NOT_YET_SENT = new Set(["pending", "claimed", "review_required", "held"]);
/** The site's row waits in this status until the company's email is definitely sent (H2). */
export const HELD_STATUS = "held";

export type IntroductionStopReason = "introduction_missing" | "introduction_cancelled" | "job_withdrawn" | "job_not_shared"
  | "company_not_approved" | "company_email_failed" | "company_email_missing";

/** The one predicate both introduction emails' dispatch checks call. Reads only; inside a transaction pass `tx`. */
export async function introductionMayProceed(requestId: string, companyId: string, tx?: FirebaseFirestore.Transaction):
  Promise<{ ok: true } | { ok: false; reason: IntroductionStopReason; introductionOnRecord: boolean }> {
  if (!db) throw new Error("introduction_store_unavailable");
  const jobRef = db.collection("inboundRequests").doc(requestId);
  const introRef = jobRef.collection("introductions").doc(companyId);
  const companyRef = db.collection("robotTeamAccess").doc(companyId);
  const [job, intro, company] = tx ? [await tx.get(jobRef), await tx.get(introRef), await tx.get(companyRef)]
    : [await jobRef.get(), await introRef.get(), await companyRef.get()];
  if (!intro.exists) return { ok: false, reason: "introduction_missing", introductionOnRecord: false };
  if (typeof intro.data()?.cancelledAtIso === "string") return { ok: false, reason: "introduction_cancelled", introductionOnRecord: false };
  const record = job.data();
  if (!job.exists || projectWebsiteCaptureRights(record).consent_revoked)
    return { ok: false, reason: "job_withdrawn", introductionOnRecord: true };
  // Approved, a deployment company, and the current Terms accepted, signed in (`companyMaySeeJobs`).
  if (!companyMaySeeJobs(company.data())) return { ok: false, reason: "company_not_approved", introductionOnRecord: true };
  const { loadCompanyJobAccess } = await import("./teamJobAccess");
  if (!(await loadCompanyJobAccess(requestId, record as Record<string, any>, tx)).access.listed)
    return { ok: false, reason: "job_not_shared", introductionOnRecord: true };
  return { ok: true };
}

/** The company an introduction email's key names, or null for a key of any other shape. */
export function introductionEmailCompany(entry: { kind: string; requestId: string; idempotencyKey?: string }): string | null {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND && entry.kind !== INTRODUCTION_SITE_EMAIL_KIND) return null;
  const prefix = `${entry.requestId}:${entry.kind}:`;
  const companyId = entry.idempotencyKey?.startsWith(prefix) ? entry.idempotencyKey.slice(prefix.length) : "";
  return /^[a-f0-9]{64}$/.test(companyId) ? companyId : null;
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
export async function siteIntroductionEmailState(requestId: string, companyId: string, tx?: FirebaseFirestore.Transaction):
  Promise<{ state: "go" } | { state: "hold" } | { state: "cancel"; reason: IntroductionStopReason; introductionOnRecord: boolean }> {
  if (!db) throw new Error("introduction_store_unavailable");
  const companyRowRef = db.collection("captureOutbox").doc(introductionCompanyKey(requestId, companyId));
  const companyRow = tx ? await tx.get(companyRowRef) : await companyRowRef.get();
  const status = companyRow.exists ? String(companyRow.data()?.status ?? "") : "";
  if (status === "sent") return { state: "go" };
  // Being handed over, or handed over with an unknown outcome: the company may have it, so nothing is cancelled.
  if (status === "dispatching" || status === "unknown") return { state: "hold" };
  const decision = await introductionMayProceed(requestId, companyId, tx);
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
  const companyId = introductionEmailCompany(entry);
  if (!companyId) return { current: false };
  let reason: IntroductionStopReason;
  let onRecord: boolean;
  if (entry.kind === INTRODUCTION_SITE_EMAIL_KIND) {
    const site = await siteIntroductionEmailState(entry.requestId, companyId, tx);
    if (site.state === "go") return { current: true };
    if (site.state === "hold") return { current: false, hold: true };
    reason = site.reason; onRecord = site.introductionOnRecord;
  } else {
    // The company's email goes first; before it is sent, the one predicate decides.
    const decision = await introductionMayProceed(entry.requestId, companyId, tx);
    if (decision.ok) return { current: true };
    reason = decision.reason; onRecord = decision.introductionOnRecord;
  }
  if (!onRecord || !tx) return { current: false };
  const store = db!;
  const siblingKey = entry.kind === INTRODUCTION_COMPANY_KIND ? introductionSiteEmailKey(entry.requestId, companyId)
    : introductionCompanyKey(entry.requestId, companyId);
  const siblingRef = store.collection("captureOutbox").doc(siblingKey);
  const { BILLABLE_EVENTS_COLLECTION, billableEventId } = await import("./billableEvents");
  const eventRef = store.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(entry.requestId, companyId));
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
 * - sent: the introduction is made, so the site's held "Meet {company}" row is released;
 * - definitely failed: the company never received the site's details, so the introduction is cancelled as a whole
 *   (`company_email_failed`): the site's row is cancelled and cleared, the record marked, the billable event void.
 */
export async function companyIntroductionEmailEnd(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx: FirebaseFirestore.Transaction): Promise<null | { siteRow: FirebaseFirestore.DocumentReference;
    sent: (tx: FirebaseFirestore.Transaction) => boolean; failed: (tx: FirebaseFirestore.Transaction) => void }> {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND || !db) return null;
  const companyId = introductionEmailCompany(entry);
  if (!companyId) return null;
  const store = db;
  const siteRef = store.collection("captureOutbox").doc(introductionSiteEmailKey(entry.requestId, companyId));
  const { BILLABLE_EVENTS_COLLECTION, billableEventId } = await import("./billableEvents");
  const eventRef = store.collection(BILLABLE_EVENTS_COLLECTION).doc(billableEventId(entry.requestId, companyId));
  const introRef = store.collection("inboundRequests").doc(entry.requestId).collection("introductions").doc(companyId);
  const [site, event, intro] = [await tx.get(siteRef), await tx.get(eventRef), await tx.get(introRef)];
  const siteStatus = site.exists ? String(site.data()?.status) : "";
  return {
    siteRow: siteRef,
    sent: write => {
      if (siteStatus !== HELD_STATUS) return false;
      write.set(siteRef, { status: "pending", nextAttemptAtMs: null, lastError: null, releasedAtIso: new Date().toISOString() },
        { merge: true });
      return true;
    },
    failed: write => {
      if (!intro.exists || typeof intro.data()?.cancelledAtIso === "string") return;
      const atIso = new Date().toISOString(), reason: IntroductionStopReason = "company_email_failed";
      write.set(introRef, { cancelledAtIso: atIso, cancelReason: reason, siteShared: null, companyShared: null }, { merge: true });
      if (event.exists) write.set(eventRef, { status: "void", voidedAtIso: atIso, voidReason: reason }, { merge: true });
      if (NOT_YET_SENT.has(siteStatus)) write.set(siteRef, { status: "cancelled", lastError: "introduction_cancelled",
        subject: "", body: "", replyTo: null, detailsClearedAtIso: atIso }, { merge: true });
    },
  };
}

/** True for every other kind; for an introduction email, true only while `introductionMayProceed` holds. */
export async function introductionEmailIsCurrent(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  return (await introductionEmailCheck(entry, tx)).current;
}
