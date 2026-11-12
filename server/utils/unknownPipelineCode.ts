/**
 * The website met a code from the Pipeline it does not know (review, 2026-11-12). The read that met it carries on
 * (the site sees that slot's general sentence and the job keeps its real state); staff hear once per job, slot and
 * code: the first time, a durable marker is created and an error is logged for the ops alert. Never fails a read.
 */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

export const UNKNOWN_PIPELINE_CODES_COLLECTION = "pipelineUnknownCodes";

export async function noteUnknownPipelineCode(requestId: string, slot: string, code: string): Promise<boolean> {
  try {
    if (!db) return false;
    const id = createHash("sha256").update(`${requestId}\u0000${slot}\u0000${code}`).digest("hex").slice(0, 40);
    await db.collection(UNKNOWN_PIPELINE_CODES_COLLECTION).doc(id).create({ request_id: requestId, slot, code,
      first_seen_at_iso: new Date().toISOString() });
    logger.error({ requestId, slot, code, alert: "pipeline_code_unknown" },
      "The website met a Pipeline code it does not know; the site sees a general sentence for it");
    return true;
  } catch { return false; }
}

/** Fire and forget: note each unknown code a read met. */
export function noteUnknownPipelineCodes(requestId: string, found: Array<[slot: string, code: string]>): void {
  for (const [slot, code] of found) void noteUnknownPipelineCode(requestId, slot, code);
}
