/**
 * The dispatch check for the introduction emails (package E, E6), in its own file so the outbox can import it without
 * a cycle. The company's email (`introduction_made_company`) is sent only while the introduction document exists and
 * the site has not withdrawn. The site's email (`introduction_made_site`) is the site side's to check
 * (`taskLifecycleNotificationAuthority.ts`); it passes here. Every other kind passes.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

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
  const [job, intro] = tx ? [await tx.get(jobRef), await tx.get(introRef)] : [await jobRef.get(), await introRef.get()];
  return job.exists && intro.exists && !projectWebsiteCaptureRights(job.data()).consent_revoked;
}
