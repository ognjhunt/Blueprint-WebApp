/** Pure contract and construction for one paid evaluation run. */

const DEFAULT_RESERVATION_TTL_MS = 6 * 60 * 60 * 1000;

export function reservationTtlMs(): number {
  const raw = Number(process.env.BLUEPRINT_AGENT_RESERVATION_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RESERVATION_TTL_MS;
}

export type EvalRunState =
  | "requested"
  | "completed"
  | "blocked"
  | "abandoned";

export interface RunDispatch {
  startedAtIso: string;
  pipelineRunId: string | null;
}

export interface EvalRunRecord {
  runId: string;
  teamId: string;
  checkpointId: string;
  sceneId: string;
  taskFamily: string | null;
  reservationId: string;
  quotedUsd: number;
  quotedEpisodes: number;
  state: EvalRunState;
  episodesRun: number | null;
  moneyResolved: boolean;
  requestedAtIso: string;
  resolvedAtIso: string | null;
  note: string | null;
  dispatch?: RunDispatch | null;
  executionAdmission?: { envelope: Record<string, unknown>; canonicalJson?: string; digestSha256: string };
  cancellationRequested?: boolean;
  dispatchPending?: boolean;
  executionCaptureId?: string;
}

export type RequestedRunParams = Pick<
  EvalRunRecord,
  | "teamId"
  | "checkpointId"
  | "sceneId"
  | "taskFamily"
  | "reservationId"
  | "quotedUsd"
  | "quotedEpisodes"
  | "executionAdmission"
>;

export function runIdForReservation(reservationId: string): string {
  return `run_${reservationId}`;
}

export function buildRequestedRunRecord(params: RequestedRunParams): EvalRunRecord {
  return {
    ...params,
    runId: runIdForReservation(params.reservationId),
    quotedUsd: Math.round(params.quotedUsd * 100) / 100,
    quotedEpisodes: Math.max(1, Math.round(params.quotedEpisodes)),
    state: "requested",
    episodesRun: null,
    moneyResolved: false,
    requestedAtIso: new Date().toISOString(),
    resolvedAtIso: null,
    note: null,
    dispatchPending: true,
    ...(typeof (params.executionAdmission?.envelope.binding as Record<string, unknown> | undefined)?.capture_id === "string" ? { executionCaptureId: String((params.executionAdmission!.envelope.binding as Record<string, unknown>).capture_id) } : {}),
  };
}
