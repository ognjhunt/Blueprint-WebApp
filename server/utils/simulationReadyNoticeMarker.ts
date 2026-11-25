/**
 * The simulation-ready notice's marker on the job record (`simulationReadyNotice.ts`), apart so that the simulation's
 * acceptance (`websiteCompanySimulation.ts`) can write it without loading the notice's company and email modules.
 */

/** The marker on the job record (`inboundRequests/{jobId}`). */
export const SIMULATION_READY_NOTICE_FIELD = "company_simulation_ready_notice";

/** What the job record holds about the notice. Every field is written each time, so nothing of an earlier capture's stays. */
export interface SimulationReadyNoticeMarker {
  schemaVersion: 1;
  /** True from the moment the simulation is first stored until the notices are queued (or none is owed). */
  owed: boolean;
  /** The capture and simulation revision that made it owed. */
  captureId: string;
  simulationRevision: string;
  owedAtIso: string;
  /** When the rows were queued, and how many: zero when no company had answered or opened the job. */
  queuedAtIso: string | null;
  queued: number | null;
  /** When no row could be owed, and why: the job's closed reason (`teamJobAccess`) at that moment. */
  closedAtIso: string | null;
  closedReason: string | null;
}

/** The marker `recordWebsiteCompanySimulation` writes when it first stores a simulation for the job's capture. */
export function owedSimulationReadyNotice(params: { captureId: string; simulationRevision: string; atIso: string }): SimulationReadyNoticeMarker {
  return { schemaVersion: 1, owed: true, captureId: params.captureId, simulationRevision: params.simulationRevision,
    owedAtIso: params.atIso, queuedAtIso: null, queued: null, closedAtIso: null, closedReason: null };
}
