/**
 * The dispatch check for BOTH introduction emails (package E, E6; planner 19:50Z, G3), in its own file so the outbox can
 * import it without a cycle. One predicate, `introductionMayProceed`, decides for the company's email
 * (`introduction_made_company`) and the site's (`introduction_made_site`, whose site-side check in
 * `taskLifecycleNotificationAuthority.ts` calls the same predicate): the introduction is on record and not cancelled,
 * the job is not withdrawn and is still shared under the whole rule (`loadCompanyJobAccess`: the current job sentence,
 * holds, authority end, the site closing its job), and the company is an approved deployment company with a current
 * signed-in acceptance of the Terms (`companyMaySeeJobs`).
 *
 * When it fails at dispatch for either email, the introduction is cancelled as a whole (`introductionEmailCheck`'s
 * `cancel`, applied by the outbox in the same transaction after all its reads): both emails' rows that have not gone
 * out are cancelled and cleared of both sides' details; the introduction record is marked cancelled with the reason
 * and time and its sealed details are removed; the billable event is marked void (kept, never counted). A cancelled
 * introduction does not count toward the job's three, and the site's page shows that company's answer again without
 * an introduction. Every other kind passes.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { companyMaySeeJobs } from "./companyTerms";

export const INTRODUCTION_COMPANY_KIND = "introduction_made_company";
export const INTRODUCTION_SITE_EMAIL_KIND = "introduction_made_site";
export const introductionCompanyKey = (requestId: string, companyId: string) => `${requestId}:${INTRODUCTION_COMPANY_KIND}:${companyId}`;
const introductionSiteEmailKey = (requestId: string, companyId: string) => `${requestId}:${INTRODUCTION_SITE_EMAIL_KIND}:${companyId}`;

/** Outbox statuses of a row that has not gone out and is not being handed to the provider: these are cancelled. */
const NOT_YET_SENT = new Set(["pending", "claimed", "review_required"]);

export type IntroductionStopReason = "introduction_missing" | "introduction_cancelled" | "job_withdrawn" | "job_not_shared"
  | "company_not_approved";

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
 * The outbox's check for an introduction email. `current` false stops this row; `cancel`, when present, carries the
 * rest of the introduction's cancellation, to be applied in the same transaction after every read (all its own reads
 * are done here).
 */
export async function introductionEmailCheck(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<{ current: boolean; cancel?: (tx: FirebaseFirestore.Transaction) => void }> {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND && entry.kind !== INTRODUCTION_SITE_EMAIL_KIND) return { current: true };
  const companyId = introductionEmailCompany(entry);
  if (!companyId) return { current: false };
  const decision = await introductionMayProceed(entry.requestId, companyId, tx);
  if (decision.ok) return { current: true };
  if (!decision.introductionOnRecord || !tx) return { current: false };
  const store = db!;
  const reason = decision.reason;
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

/** True for every other kind; for an introduction email, true only while `introductionMayProceed` holds. */
export async function introductionEmailIsCurrent(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  return (await introductionEmailCheck(entry, tx)).current;
}
