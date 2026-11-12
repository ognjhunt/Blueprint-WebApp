/**
 * The dispatch check for the introduction emails (package E, E6), in its own file so the outbox can import it without
 * a cycle. The company's email (`introduction_made_company`) is sent only while the introduction document exists, the
 * company is still an approved deployment company, and the job is still listed under the whole rule (`loadCompanyJobAccess`). The site's email (`introduction_made_site`) is the site side's to check
 * (`taskLifecycleNotificationAuthority.ts`); it passes here. Every other kind passes.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

export const INTRODUCTION_COMPANY_KIND = "introduction_made_company";
export const introductionCompanyKey = (requestId: string, companyId: string) => `${requestId}:${INTRODUCTION_COMPANY_KIND}:${companyId}`;

export async function introductionEmailIsCurrent(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== INTRODUCTION_COMPANY_KIND) return true;
  const prefix = `${entry.requestId}:${INTRODUCTION_COMPANY_KIND}:`;
  const companyId = entry.idempotencyKey?.startsWith(prefix) ? entry.idempotencyKey.slice(prefix.length) : "";
  if (!/^[a-f0-9]{64}$/.test(companyId)) return false;
  if (!db) throw new Error("introduction_store_unavailable");
  const jobRef = db.collection("inboundRequests").doc(entry.requestId);
  const introRef = jobRef.collection("introductions").doc(companyId);
  const companyRef = db.collection("robotTeamAccess").doc(companyId);
  const [intro, company] = tx ? [await tx.get(introRef), await tx.get(companyRef)] : [await introRef.get(), await companyRef.get()];
  if (!intro.exists) return false;
  // The company must still be an approved deployment company.
  const record = company.data();
  if (record?.status !== "approved" || record.partnerRole === "technology") return false;
  // The whole sharing rule, as on every company-facing read: a withdrawal, an operator hold, a rights hold, an authority
  // end or the site closing its job each stop the site's details from going out.
  const { loadCompanyJobAccess } = await import("./teamJobAccess");
  return (await loadCompanyJobAccess(entry.requestId, undefined, tx)).access.listed;
}
