import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

export const COMPANY_JOB_VIEWS_COLLECTION = "companyViews";

/** A refresh or a second tab counts as the same company. View tracking never blocks a job. */
export async function recordCompanyJobView(jobId: string, companyId: string): Promise<void> {
  if (!db) return;
  const ref = db.collection("inboundRequests").doc(jobId).collection(COMPANY_JOB_VIEWS_COLLECTION).doc(companyId);
  try {
    await db.runTransaction(async tx => {
      if (!(await tx.get(ref)).exists) tx.set(ref, { openedAtIso: new Date().toISOString() });
    });
  } catch (error) {
    logger.warn({ err: error }, "Could not record a company job view");
  }
}
