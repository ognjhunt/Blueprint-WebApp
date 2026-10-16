/** Pure contract and construction for one paid evaluation run. */

const DEFAULT_RESERVATION_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_EXECUTION_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_HEARTBEAT_TTL_MS = 15 * 60 * 1000;

export function reservationTtlMs(): number {
  const raw = Number(process.env.BLUEPRINT_AGENT_RESERVATION_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RESERVATION_TTL_MS;
}

/** Queue reservations and bounded running work have separate clocks. */
export function executionTtlMs(): number {
  const value = Number(process.env.BLUEPRINT_AGENT_EXECUTION_TTL_MS);
  return Number.isFinite(value) && value >= 60_000 && value <= 7 * 24 * 60 * 60 * 1000
    ? value : DEFAULT_EXECUTION_TTL_MS;
}

export function executionHeartbeatTtlMs(): number {
  const value = Number(process.env.BLUEPRINT_AGENT_HEARTBEAT_TTL_MS);
  return Number.isFinite(value) && value >= 60_000 && value <= 60 * 60 * 1000
    ? value : DEFAULT_HEARTBEAT_TTL_MS;
}

/** Legacy workers remain bounded without requiring a heartbeat during rollout. */
export function runExecutionDueAtMs(run: Pick<EvalRunRecord, "requestedAtIso" | "dispatch" | "settlementDueAtMs">): number {
  if (!run.dispatch?.startedAtIso) {
    const requested = Date.parse(run.requestedAtIso);
    if (!Number.isFinite(requested)) return 0;
    if (run.settlementDueAtMs !== undefined && !Number.isFinite(run.settlementDueAtMs)) return 0;
    return Math.min(requested + reservationTtlMs(), run.settlementDueAtMs ?? Infinity);
  }
  const started = Date.parse(run.dispatch.startedAtIso);
  if (!Number.isFinite(started)) return 0;
  const persistedDeadline = run.dispatch.executionDeadlineAtMs;
  if (persistedDeadline !== undefined && (typeof persistedDeadline !== "number" || !Number.isFinite(persistedDeadline))) return 0;
  const deadline = typeof persistedDeadline === "number" && Number.isFinite(persistedDeadline)
    ? persistedDeadline : started + executionTtlMs();
  const heartbeat = Date.parse(run.dispatch.lastHeartbeatAtIso ?? "");
  if (run.dispatch.lastHeartbeatAtIso !== undefined && !Number.isFinite(heartbeat)) return 0;
  return Number.isFinite(heartbeat) ? Math.min(deadline, heartbeat + executionHeartbeatTtlMs()) : deadline;
}

export type EvalRunState =
  | "requested"
  | "completed"
  | "blocked"
  | "abandoned";

export interface RunDispatch {
  startedAtIso: string;
  pipelineRunId: string | null;
  executionDeadlineAtMs?: number;
  lastHeartbeatAtIso?: string;
}

/** Known lower-bound execution counts, retained even when a run is interrupted. */
export interface RunExecutionProgress {
  observed_attempted_episode_count: number;
  scored_episode_count: number;
  succeeded_episode_count: number;
  failed_episode_count: number;
  void_episode_count: number;
  measurement_complete: boolean;
}

export interface EvalRunRecord {
  /** Absent only on historical runs created before private evaluations. */
  evaluationPurpose?: "private" | "pilot";
  /** Beta L5: marks a team evaluation (200 hidden cells, scored by the simulator). */
  teamEvaluationPurpose?: "scored";
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
  executionProgress?: RunExecutionProgress;
  settlementDueAtMs?: number;
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
    // A paid run is always private; callers and callback payloads cannot opt out.
    evaluationPurpose: "private",
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

/** Historical runs retain their original sharing agreement. Unknown modes fail closed. */
export function isSiteEvaluation(run: Pick<EvalRunRecord, "evaluationPurpose">): boolean {
  return run.evaluationPurpose === undefined || run.evaluationPurpose === "pilot";
}
