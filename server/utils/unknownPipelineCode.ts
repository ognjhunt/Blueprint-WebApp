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

/** Create the job's marker for this slot and code; true only when it is new (the first time this job met it). */
async function markUnknownPipelineCode(requestId: string, slot: string, code: string): Promise<boolean> {
  try {
    if (!db) return false;
    const id = createHash("sha256").update(`${requestId}\u0000${slot}\u0000${code}`).digest("hex").slice(0, 40);
    await db.collection(UNKNOWN_PIPELINE_CODES_COLLECTION).doc(id).create({ request_id: requestId, slot, code,
      first_seen_at_iso: new Date().toISOString() });
    return true;
  } catch { return false; }
}
const alertKey = (requestId: string, what: string) => `pipeline_code_unknown:${requestId}:${what}`;
async function alert(key: string, message: string) {
  await Promise.resolve().then(() => sendRateLimitedOpsAlert(key, message)).catch(() => undefined);
}

/**
 * One unknown code for one job. Call it after the record that carried the code is committed. The alert is keyed by
 * job, slot and code, so every job that meets a code gets its own (review, 2026-11-12).
 */
export async function noteUnknownPipelineCode(requestId: string, slot: string, code: string): Promise<boolean> {
  if (!await markUnknownPipelineCode(requestId, slot, code)) return false;
  const message = `The website met a Pipeline code it does not know: ${slot} = ${code} (job ${requestId}). The site sees a general sentence for it.`;
  logger.error({ requestId, slot, code, alert: "pipeline_code_unknown" }, message);
  await alert(alertKey(requestId, `${slot}:${code}`), message);
  return true;
}

/**
 * The unknown codes one ingest met, one at a time, after its record is committed. Only codes this job meets for the
 * first time count: up to `UNKNOWN_CODE_ALERTS_PER_INGEST` each get an alert, and every further new one is named in
 * one summary alert with the count. Codes already marked are skipped.
 */
export async function noteUnknownPipelineCodes(requestId: string, found: Array<[slot: string, code: string]>): Promise<void> {
  const distinct = [...new Map(found.map(entry => [`${entry[0]}\u0000${entry[1]}`, entry])).values()];
  let alerted = 0;
  const rest: string[] = [];
  for (const [slot, code] of distinct) {
    if (!await markUnknownPipelineCode(requestId, slot, code)) continue;
    if (alerted < UNKNOWN_CODE_ALERTS_PER_INGEST) {
      alerted++;
      const message = `The website met a Pipeline code it does not know: ${slot} = ${code} (job ${requestId}). The site sees a general sentence for it.`;
      logger.error({ requestId, slot, code, alert: "pipeline_code_unknown" }, message);
      await alert(alertKey(requestId, `${slot}:${code}`), message);
    } else rest.push(`${slot} = ${code}`);
  }
  if (rest.length > 0) {
    const message = `The website met ${rest.length} more Pipeline codes it does not know in one ingest (job ${requestId}): ${rest.join(", ").slice(0, 1500)}.`;
    logger.error({ requestId, more: rest.length, alert: "pipeline_code_unknown_summary" }, message);
    await alert(alertKey(requestId, `summary:${createHash("sha256").update(rest.join("|")).digest("hex").slice(0, 16)}`), message);
  }
}
