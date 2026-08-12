import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  forwardTaskEvaluationLaunch,
} from "./taskEvaluationLaunchContract";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { withTaskEvaluationLaunchStoreTimeout } from "./taskEvaluationLaunchStore";

const COLLECTION = "taskEvaluationLaunches";

function truthy(value: unknown) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function maxAttempts() {
  const value = Number(process.env.TASK_EVALUATION_LAUNCH_FORWARD_MAX_ATTEMPTS || 20);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 100) : 20;
}

function retryDelayMs(attempt: number) {
  const base = Number(process.env.TASK_EVALUATION_LAUNCH_FORWARD_RETRY_BASE_MS || 60_000);
  const boundedBase = Number.isFinite(base) && base >= 1000 ? base : 60_000;
  return Math.min(15 * 60_000, boundedBase * 2 ** Math.min(Math.max(attempt - 1, 0), 4));
}

export function validateStoredTaskEvaluationLaunch(record: Record<string, any>): string[] {
  const blockers: string[] = [];
  const request = record.request;
  if (!request || typeof request !== "object") return ["stored_launch_request_missing"];
  if (
    request.request_digest !== record.request_digest
    || canonicalArtifactDigest(request, "request_digest") !== record.request_digest
  ) blockers.push("stored_launch_request_digest_mismatch");
  if (
    request.required_controls?.canonical_allocator !== CANONICAL_TASK_EVALUATION_ALLOCATOR
    || request.required_controls?.retry_cap !== 0
  ) blockers.push("stored_launch_control_boundary_invalid");
  if (request.authorization?.execution?.approved !== true) {
    blockers.push("stored_launch_execution_authority_missing");
  }
  return blockers;
}

/**
 * A Pipeline terminal receipt is the sole execution-result authority.  This is
 * deliberately not a substitute receipt: it only closes an accepted launch
 * whose bounded spend authority has elapsed without a Pipeline terminal
 * callback.  The original record remains intact so a delayed, digest-bound
 * Pipeline receipt can still supersede this control-plane blocker.
 */
export function buildExpiredControlPlaneTerminalBlocker(
  record: Record<string, any>,
  nowMs = Date.now(),
) {
  if (record.state !== "queued_in_pipeline" || record.terminal_receipt) return null;
  if (validateStoredTaskEvaluationLaunch(record).length) return null;
  const expiresAt = String(record.request?.authorization?.spend?.expires_at || "");
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs > nowMs) return null;
  const observedAtIso = new Date(nowMs).toISOString();
  return {
    state: "control_plane_terminal_blocked",
    retryable: false,
    paid_execution_retry_performed: false,
    control_plane_terminal_blocker: {
      schema_version: "task_evaluation_launch_control_plane_blocker.v1",
      status: "blocked",
      code: "control_plane_terminal_receipt_missing_after_spend_authority_expiry",
      launch_id: record.request.launch_id,
      run_id: record.request.run_id,
      request_digest: record.request_digest,
      spend_authority_expires_at: expiresAt,
      observed_at_iso: observedAtIso,
      pipeline_terminal_receipt_observed: false,
      provider_mutation_performed_by_webapp: false,
      paid_execution_retry_performed: false,
      execution_result: "not_observed",
      scripted_positive_controls_result: "not_observed",
      learned_policy_result: "not_observed",
      explanation: "Pipeline accepted the immutable launch, but its terminal receipt was not retained before the bounded spend authority expired.",
    },
    updated_at_iso: observedAtIso,
  };
}

export async function forwardStoredTaskEvaluationLaunch(
  record: Record<string, any>,
  forwarder = forwardTaskEvaluationLaunch,
) {
  const blockers = validateStoredTaskEvaluationLaunch(record);
  if (blockers.length) return {
    state: "forward_terminal_blocked",
    blockers,
    retryable: false,
    provider_mutation_performed: false,
    paid_execution_retry_performed: false,
  };
  const attempts = Number(record.forward_attempt_count || 0);
  if (attempts >= maxAttempts()) return {
    state: "forward_terminal_blocked",
    blockers: ["task_evaluation_launch_forward_retry_cap_reached"],
    retryable: false,
    provider_mutation_performed: false,
    paid_execution_retry_performed: false,
  };
  const nextAt = Date.parse(String(record.next_forward_at_iso || ""));
  if (Number.isFinite(nextAt) && nextAt > Date.now()) return {
    state: record.state,
    skipped: true,
    retryable: true,
    provider_mutation_performed: false,
    paid_execution_retry_performed: false,
  };
  const forward = await forwarder({ request: record.request });
  const attemptCount = attempts + 1;
  const state = forward.status === "forwarded"
    ? forward.pipeline_intake_status === "queued_dispatch_blocked"
      ? "queued_dispatch_blocked"
      : "queued_in_pipeline"
    : "forward_blocked";
  return {
    state,
    forward,
    forward_attempt_count: attemptCount,
    next_forward_at_iso: state === "forward_blocked"
      ? new Date(Date.now() + retryDelayMs(attemptCount)).toISOString()
      : null,
    retryable: state === "forward_blocked",
    provider_mutation_performed: false,
    paid_execution_retry_performed: false,
  };
}

export async function processTaskEvaluationLaunchForwardQueue(limit = 10) {
  if (!db) return { status: "blocked", blocker: "firestore_unavailable", processed: 0 };
  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const state of ["forward_pending", "forward_blocked"] as const) {
    const snapshot = await withTaskEvaluationLaunchStoreTimeout(
      db.collection(COLLECTION).where("state", "==", state).limit(limit).get(),
    );
    docs.push(...snapshot.docs);
    if (docs.length >= limit) break;
  }
  let processed = 0;
  for (const doc of docs.slice(0, limit)) {
    const record = doc.data() as Record<string, any>;
    const result = await forwardStoredTaskEvaluationLaunch(record);
    if (result.skipped) continue;
    await withTaskEvaluationLaunchStoreTimeout(
      doc.ref.set({
        ...result,
        updated_at_iso: new Date().toISOString(),
      }, { merge: true }),
    );
    processed += 1;
  }
  return { status: "completed", processed };
}

export async function closeExpiredTaskEvaluationLaunches(
  limit = 10,
  options: { firestore?: typeof db; nowMs?: () => number } = {},
) {
  const firestore = options.firestore === undefined ? db : options.firestore;
  if (!firestore) return { status: "blocked", blocker: "firestore_unavailable", closed: 0 };
  const nowMs = options.nowMs || Date.now;
  const snapshot = await withTaskEvaluationLaunchStoreTimeout(
    firestore.collection(COLLECTION).where("state", "==", "queued_in_pipeline").limit(limit).get(),
  );
  let closed = 0;
  for (const doc of snapshot.docs) {
    const didClose = await withTaskEvaluationLaunchStoreTimeout(
      firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(doc.ref);
        if (!current.exists) return false;
        const blocker = buildExpiredControlPlaneTerminalBlocker(
          current.data() as Record<string, any>,
          nowMs(),
        );
        if (!blocker) return false;
        transaction.set(doc.ref, blocker, { merge: true });
        return true;
      }),
    );
    if (didClose) closed += 1;
  }
  return { status: "completed", closed };
}

export function startTaskEvaluationLaunchForwardWorker() {
  if (!truthy(process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED)) {
    return () => undefined;
  }
  const intervalValue = Number(
    process.env.TASK_EVALUATION_LAUNCH_FORWARD_WORKER_INTERVAL_MS || 60_000,
  );
  const intervalMs = Number.isFinite(intervalValue) && intervalValue >= 10_000
    ? intervalValue
    : 60_000;
  const run = () => {
    void processTaskEvaluationLaunchForwardQueue().catch((error) => {
      logger.error({ err: error }, "Task Evaluation launch forward reconciliation failed");
    });
    void closeExpiredTaskEvaluationLaunches().catch((error) => {
      logger.error({ err: error }, "Task Evaluation launch terminal closure reconciliation failed");
    });
  };
  const initial = setTimeout(run, 5_000);
  const interval = setInterval(run, intervalMs);
  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
