/**
 * The deletion notice the Terms and Privacy Policy promise (review M4; planner, 2026-11-12, 18:00Z): when a site's
 * withdrawal is first recorded, ONE email to each approved deployment company the job was sent to (its `companySends`
 * rows), asking it to delete any copy it saved. Outbox kind `job_withdrawn_company`, one row per job and company
 * (idempotency key `{requestId}:job_withdrawn_company:{companyId}`).
 *
 * It carries nothing of the site: no name, address, contact or the site's own sentence. Only the date the job was sent
 * and the job's category title, as the category-only listing record holds it. It is a notice, not an update, so it is
 * sent whatever the company's optional-updates choice is; it is not sent to a company that is no longer approved, and
 * that is checked again at dispatch (`withdrawalNoticeIsCurrent`).
 *
 * The rows are planned inside the withdrawal's own transaction (`recordWebsiteCaptureWithdrawal`): all reads first,
 * then the writes, so the notice is as durable as the withdrawal itself.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";

export const WITHDRAWAL_COMPANY_KIND = "job_withdrawn_company";
export const withdrawalCompanyKey = (requestId: string, companyId: string) => `${requestId}:${WITHDRAWAL_COMPANY_KIND}:${companyId}`;
export const WITHDRAWAL_COMPANY_SUBJECT = "A job you were sent has been withdrawn";
export const withdrawalCompanyBody = (date: string, title: string) =>
  `A site has withdrawn a job you were sent on ${date}: ${title}. It has left your job library. If you saved its video or `
  + "its simulation, delete your copy now.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Tx = FirebaseFirestore.Transaction;

/** The category titles the listing record can hold (built only by `anonymizedOpportunityDraft`): never free text. */
const CATEGORY_TITLES = new Set(["dish", "pallet carton", "pallet", "pack", "inspect", "pick", ""]
  .map(words => anonymizedOpportunityDraft(words).title));
export function categoryTitleOf(record: Record<string, any> | null | undefined): string {
  const title = record?.public_task_listing?.details?.title;
  return typeof title === "string" && CATEGORY_TITLES.has(title) ? title : "Work assessment opportunity";
}

/** "November 12, 2026", from an ISO instant; never a raw value. */
function dateInWords(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "an earlier date"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function isApprovedDeploymentCompany(record: Record<string, any> | undefined): boolean {
  return record?.status === "approved" && record.partnerRole !== "technology";
}

/**
 * Reads only (call before the transaction's first write): the outbox rows to create, one per approved deployment
 * company the job was sent to that has no row yet. The caller creates them with `tx.set(row.ref, row.data)`.
 */
export async function planWithdrawalCompanyNotices(tx: Tx, requestId: string, record: Record<string, any> | undefined):
  Promise<Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>> {
  if (!db) return [];
  const store = db;
  // Every send of the job (a job is sent to each approved company once; the bound is far above any real count).
  const sends = await tx.get(store.collection("inboundRequests").doc(requestId).collection("companySends").limit(5000));
  const firstSent = new Map<string, string>();
  for (const send of sends.docs) {
    const row = send.data();
    if (typeof row.companyId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(row.companyId) || row.voidedAtIso) continue;
    const at = typeof row.sentAtIso === "string" ? row.sentAtIso : "";
    const earlier = firstSent.get(row.companyId);
    if (earlier === undefined || (at && at < earlier)) firstSent.set(row.companyId, at);
  }
  if (firstSent.size === 0) return [];
  const { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const title = categoryTitleOf(record);
  const planned: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
  for (const [companyId, sentAtIso] of [...firstSent.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const company = (await tx.get(store.collection("robotTeamAccess").doc(companyId))).data();
    const to = typeof company?.email === "string" ? company.email.trim().toLowerCase() : "";
    if (!isApprovedDeploymentCompany(company) || !EMAIL.test(to)) continue;
    const ref = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(withdrawalCompanyKey(requestId, companyId));
    if ((await tx.get(ref)).exists) continue;
    planned.push({ ref, data: buildOutboxEntry({ idempotencyKey: ref.id, requestId, kind: WITHDRAWAL_COMPANY_KIND as never, to,
      subject: WITHDRAWAL_COMPANY_SUBJECT, body: withdrawalCompanyBody(dateInWords(sentAtIso), title), replyTo: "hello@tryblueprint.io" }) as unknown as Record<string, unknown> });
  }
  return planned;
}

/** The dispatch check: sent only while the company is still an approved deployment company. Every other kind passes. */
export async function withdrawalNoticeIsCurrent(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: Tx): Promise<boolean> {
  if (entry.kind !== WITHDRAWAL_COMPANY_KIND) return true;
  const prefix = `${entry.requestId}:${WITHDRAWAL_COMPANY_KIND}:`;
  const companyId = entry.idempotencyKey?.startsWith(prefix) ? entry.idempotencyKey.slice(prefix.length) : "";
  if (!companyId || !db) return false;
  const ref = db.collection("robotTeamAccess").doc(companyId);
  return isApprovedDeploymentCompany((tx ? await tx.get(ref) : await ref.get()).data());
}
