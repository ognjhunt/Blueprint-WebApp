import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { isGeminiVideoConfigured } from "../agents/provider-config";
import { processSceneIntakeQueue } from "./taskEvaluationSceneIntake";
import { processJobEvidenceForwardQueue } from "./jobEvidenceForwardWorker";
import { resolveExecutionAccessContext } from "./access-control";
import type { Response } from "express";
import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  forwardTaskEvaluationLaunch,
} from "./taskEvaluationLaunchContract";
import { canonicalArtifactDigest, stableJson } from "./taskCandidateContract";
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
  const actor = record.request.authorization?.actor;
  if (!actor || typeof actor.id!=="string" || !actor.id || !["admin","ops","team_member"].includes(actor.role)) return {state:"forward_terminal_blocked",blockers:["execution_actor_identity_missing"],retryable:false,provider_mutation_performed:false,paid_execution_retry_performed:false};
  const serviceIssued = actor?.id === "blueprint-production-runner"
    && (record.submission?.channel === "production_webapp_service_api"
      && record.submission?.service_id === actor.id
      || record.submission_channel === "production_webapp_service_api");
  if (["admin", "ops"].includes(actor?.role) && !serviceIssued) {
    const access=await resolveExecutionAccessContext({locals:{firebaseUser:{uid:actor.id,...(record.firebase_tenant_id ? {tenantId:record.firebase_tenant_id} : {})}}} as Response);
    if (!access.isOps) return {state:"forward_terminal_blocked",blockers:["execution_actor_verified_custom_claims_required"],retryable:false,provider_mutation_performed:false,paid_execution_retry_performed:false};
  }
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

export async function forwardStoredPolicyCanaryRun(
  record: Record<string, any>,
  forwarder = forwardTaskEvaluationLaunch,
) {
  const result = await forwardStoredTaskEvaluationLaunch(record, forwarder);
  if (result.skipped) return result;
  const state = result.state === "queued_in_pipeline"
    || result.state === "queued_dispatch_blocked"
    ? "queued"
    : result.state;
  return {
    ...result,
    state,
    phase: state === "queued" ? "preparing" : "blocked",
  };
}

export async function processTaskEvaluationLaunchForwardQueue(limit = 10) {
  if (!db) return { status: "blocked", blocker: "firestore_unavailable", processed: 0 };
  const docs: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot }> = [];
  for (const state of ["forward_pending", "forward_blocked"] as const) {
    const snapshot = await withTaskEvaluationLaunchStoreTimeout(
      db.collection(COLLECTION).where("state", "==", state).limit(limit).get(),
    );
    docs.push(...snapshot.docs.map((doc) => ({ doc })));
  }
  docs.sort((left, right) => {
    const leftRecord = left.doc.data() as Record<string, any>;
    const rightRecord = right.doc.data() as Record<string, any>;
    const leftTime = Date.parse(String(leftRecord.updated_at_iso || leftRecord.created_at_iso || ""));
    const rightTime = Date.parse(String(rightRecord.updated_at_iso || rightRecord.created_at_iso || ""));
    const normalizedLeft = Number.isFinite(leftTime) ? leftTime : 0;
    const normalizedRight = Number.isFinite(rightTime) ? rightTime : 0;
    return normalizedLeft - normalizedRight || left.doc.id.localeCompare(right.doc.id);
  });
  let processed = 0;
  for (const { doc } of docs.slice(0, limit)) {
    const record = doc.data() as Record<string, any>;
    const result = await forwardStoredTaskEvaluationLaunch(record);
    if (result.skipped) continue;
    // Forwarding is an asynchronous, digest-bound intake operation. A Pipeline
    // terminal callback may already have advanced this record while the HTTP
    // response was in flight; applying a stale queue snapshot must not reopen
    // it or bind the receipt to a successor request. Concurrent queue passes
    // likewise only apply the response to the state/attempt they observed.
    const applied = await withTaskEvaluationLaunchStoreTimeout(db.runTransaction(async transaction => {
      const current = (await transaction.get(doc.ref)).data();
      if (!current || current.state !== record.state
        || current.request_digest !== record.request_digest
        || stableJson(current.request ?? null) !== stableJson(record.request ?? null)
        || Number(current.forward_attempt_count || 0) !== Number(record.forward_attempt_count || 0)
        || current.terminal_receipt) return false;
      transaction.set(doc.ref, {
        ...result,
        updated_at_iso: new Date().toISOString(),
      }, { merge: true });
      return true;
    }));
    if (applied) processed += 1;
  }
  return { status: "completed", processed };
}

export function startTaskEvaluationLaunchForwardWorker() {
  const enabled = truthy(process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED);
  logger.info({
    launchForwardWorkerEnabled: enabled,
    siteVideoEvidenceEnabled: isSiteVideoEvidenceEnabled(),
    openAiCredentialConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    geminiCredentialConfigured: isGeminiVideoConfigured(),
  }, "Task Evaluation launch worker admission");
  if (!enabled) {
    return () => undefined;
  }
  const intervalValue = Number(
    process.env.TASK_EVALUATION_LAUNCH_FORWARD_WORKER_INTERVAL_MS || 60_000,
  );
  const intervalMs = Number.isFinite(intervalValue) && intervalValue >= 10_000
    ? intervalValue
    : 60_000;
  let stopped = false;
  // A batch can outlive the polling interval. Keep each lane independent, but
  // never retain another batch or forward the same intake from an overlapping
  // lap in this process. Release the guard only when that lane settles.
  const activeLanes = new Set<string>();
  const startLane = (lane: string, work: () => Promise<unknown>, failure: string) => {
    if (stopped || activeLanes.has(lane)) return;
    activeLanes.add(lane);
    void Promise.resolve().then(() => stopped ? undefined : work()).catch((error) => {
      logger.error({ err: error }, failure);
    }).finally(() => { activeLanes.delete(lane); });
  };
  const run = () => {
    if (stopped) return;
    // This loop also runs when the broader ops scheduler is intentionally off.
    if (isSiteVideoEvidenceEnabled()) {
      // Coverage intent survives upload/worker interruption. Its retained footage
      // reading also drafts the brief; it must not depend on the broader ops
      // scheduler. This narrow lane records findings without enqueueing email.
      startLane("capture-coverage", async () => {
        const { tickCoverageReviews } = await import("./captureCoverageQueue");
        if (!stopped) await tickCoverageReviews(2, { notifyOwner: false });
      }, "Capture coverage worker tick unavailable");
    }
    startLane("job-evidence", processJobEvidenceForwardQueue, "Job evidence delivery reconciliation failed");
    startLane("scene-intake", processSceneIntakeQueue, "Task Evaluation scene intake reconciliation failed");
    startLane("launch-forward", processTaskEvaluationLaunchForwardQueue, "Task Evaluation launch forward reconciliation failed");
  };
  const initial = setTimeout(run, 5_000);
  const interval = setInterval(run, intervalMs);
  return () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(interval);
  };
}
