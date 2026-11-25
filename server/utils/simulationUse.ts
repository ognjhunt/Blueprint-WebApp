/**
 * Whether deployment companies use the simulation of a site, as viewer opens and downloads per job (owner direction,
 * 2026-11-25). Read by the owner's marketplace numbers (`marketplaceNumbers.ts`).
 *
 * One counter per job, company and kind, at `inboundRequests/{jobId}/simulationUse/{companyId}-{kind}` =
 * `{ companyId, kind, count, lastAtIso }`. Nothing else: no person, no address, no ticket; the company only by its
 * `robotTeamAccess` id. It is not a billable event and charges nothing.
 *
 * - `viewer_open`: the company's viewer loaded the simulation of the site (the splat, `scene.ply`, served on the
 *   company's own ticket by `website-atlas-preview-views.ts`). A reload is another open. The site's own ticket and
 *   the admin console's are not counted.
 * - `download`: a company started the simulation download (`company-media.ts`, `simulation.zip`): a request with no
 *   range, or a range from the first byte. A resumed download (a range from a later byte) is not counted again.
 *
 * Counted only after every check of the request has passed and its bytes are about to be sent. The write is fire and
 * forget: the route never waits for it, and a failure only logs. Counting began with this file; use before it was
 * never recorded, so a job with no counter reads "No data yet", never 0.
 */
import { FieldValue } from "firebase-admin/firestore";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

export const SIMULATION_USE_COLLECTION = "simulationUse";
export const SIMULATION_USE_KINDS = ["viewer_open", "download"] as const;
export type SimulationUseKind = (typeof SIMULATION_USE_KINDS)[number];

const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const COMPANY_ID = /^[a-f0-9]{64}$/;

export const simulationUseDocId = (companyId: string, kind: SimulationUseKind) => `${companyId}-${kind}`;

/**
 * Whether a download request starts a download: no range, or a range from byte 0 (`bytes=0-`, `bytes=0-1023`). A
 * resumed download, a suffix range (`bytes=-500`) or more than one range is a later part of one already counted.
 */
export function startsSimulationDownload(range: string | undefined | null): boolean {
  if (range === undefined || range === null || range.trim() === "") return true;
  return /^bytes=0-\d*$/i.test(range.trim());
}

/**
 * Add one to the job's counter for this company and kind. Returns at once; the write runs in the background and a
 * failure is logged, never thrown, so the route's bytes are never held for it.
 */
export function recordSimulationUse(jobId: string, companyId: string, kind: SimulationUseKind): void {
  if (!db || !JOB_ID.test(jobId) || !COMPANY_ID.test(companyId) || !SIMULATION_USE_KINDS.includes(kind)) return;
  try {
    const ref = db.collection("inboundRequests").doc(jobId).collection(SIMULATION_USE_COLLECTION).doc(simulationUseDocId(companyId, kind));
    Promise.resolve(ref.set({ companyId, kind, count: FieldValue.increment(1), lastAtIso: new Date().toISOString() }, { merge: true }))
      .catch(error => logger.warn({ err: error, jobId, kind }, "Could not count a company's use of the simulation"));
  } catch (error) {
    logger.warn({ err: error, jobId, kind }, "Could not count a company's use of the simulation");
  }
}

/** One stored counter, read back: only a well-formed row counts. */
export interface SimulationUseRow { companyId: string; kind: SimulationUseKind; count: number }

export function simulationUseRowOf(data: Record<string, unknown> | undefined): SimulationUseRow | null {
  if (!data || typeof data.companyId !== "string" || !COMPANY_ID.test(data.companyId)) return null;
  const kind = SIMULATION_USE_KINDS.find(value => value === data.kind);
  const count = data.count;
  if (!kind || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return null;
  return { companyId: data.companyId, kind, count };
}
