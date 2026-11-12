/**
 * The website met a code from the Pipeline it does not know (review, 2026-11-12). Recorded where a value is INGESTED
 * or first adopted, never on a read: the first time per job, slot and code, a durable marker is created and the ops
 * alert (`sendRateLimitedOpsAlert`) is sent beside it. The read or ingest that met it carries on: the site sees that
 * slot's general sentence and the job keeps its real state.
 */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";

export const UNKNOWN_PIPELINE_CODES_COLLECTION = "pipelineUnknownCodes";
/** At most this many unknown codes are alerted per ingest; the rest are counted in one summary line. */
export const UNKNOWN_CODE_ALERTS_PER_INGEST = 5;

export async function noteUnknownPipelineCode(requestId: string, slot: string, code: string): Promise<boolean> {
  try {
    if (!db) return false;
    const id = createHash("sha256").update(`${requestId}\u0000${slot}\u0000${code}`).digest("hex").slice(0, 40);
    await db.collection(UNKNOWN_PIPELINE_CODES_COLLECTION).doc(id).create({ request_id: requestId, slot, code,
      first_seen_at_iso: new Date().toISOString() });
    const message = `The website met a Pipeline code it does not know: ${slot} = ${code} (job ${requestId}). The site sees a general sentence for it.`;
    logger.error({ requestId, slot, code, alert: "pipeline_code_unknown" }, message);
    await Promise.resolve(sendRateLimitedOpsAlert(`pipeline_code_unknown:${slot}:${code}`, message)).catch(() => undefined);
    return true;
  } catch { return false; }
}

/**
 * Note the unknown codes one ingest met, in order and one at a time: at most `UNKNOWN_CODE_ALERTS_PER_INGEST` of them,
 * then one summary line with how many more there were. Never unbounded, never concurrent.
 */
export async function noteUnknownPipelineCodes(requestId: string, found: Array<[slot: string, code: string]>): Promise<void> {
  const distinct = [...new Map(found.map(entry => [`${entry[0]}\u0000${entry[1]}`, entry])).values()];
  for (const [slot, code] of distinct.slice(0, UNKNOWN_CODE_ALERTS_PER_INGEST)) await noteUnknownPipelineCode(requestId, slot, code);
  const more = distinct.length - UNKNOWN_CODE_ALERTS_PER_INGEST;
  if (more > 0) logger.error({ requestId, more, alert: "pipeline_code_unknown_summary" },
    `The website met ${more} more Pipeline codes it does not know in one ingest; only the first ${UNKNOWN_CODE_ALERTS_PER_INGEST} were alerted.`);
}
