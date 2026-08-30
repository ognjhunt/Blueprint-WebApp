import { Router, type NextFunction, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { resolveAccessContext } from "../utils/access-control";
import {
  EVALUATION_READY_RUN_STATES,
  evaluationReadyResultSummarySchema,
  evaluationReadyRunStatusProjectionSchema,
  evaluationResultWebsiteUrl,
  projectEvaluationReadyRun,
  type EvaluationReadyRunRecord,
} from "../utils/evaluationReadyRunContract";
import {
  createPipelineSyncRateLimiter,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";
import { withTaskEvaluationLaunchStoreTimeout } from "../utils/taskEvaluationLaunchStore";
import { dispatchTransactionalNotification } from "../utils/transactional-notifications";

const router = Router();
const COLLECTION = "taskEvaluationPolicyRuns";
const pipelineRateLimiter = createPipelineSyncRateLimiter();
const stateRank = new Map(EVALUATION_READY_RUN_STATES.map((state, index) => [state, index]));
const terminalStates = new Set(["results_ready", "abstained", "blocked", "failed"]);

function firebaseTenantId(res: Response) {
  const user = res.locals.firebaseUser as { tenantId?: string; tenant_id?: string } | undefined;
  return String(user?.tenantId || user?.tenant_id || "").trim();
}

function requirePipelineSignature(req: Request, res: Response, next: NextFunction) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({
    error: result.message,
    code: result.code,
  });
  return next();
}

async function readPolicyRun(runId: string) {
  if (!db || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(runId)) return null;
  const snapshot = await withTaskEvaluationLaunchStoreTimeout(
    db.collection(COLLECTION).doc(runId).get(),
  );
  return snapshot.exists
    ? snapshot.data() as EvaluationReadyRunRecord
    : null;
}

async function readForTeam(runId: string, res: Response) {
  const record = await readPolicyRun(runId);
  if (!record) return null;
  const access = await resolveAccessContext(res);
  if (!access.uid) return null;
  const tenantId = firebaseTenantId(res);
  if (!access.isOps && (!tenantId || tenantId !== record.team_namespace)) return null;
  return record;
}

async function getRun(req: Request, res: Response, next: NextFunction) {
  if (!db) return res.status(503).json({
    error: "Task Evaluation Run store is unavailable",
    code: "task_evaluation_policy_run_store_unavailable",
  });
  let record;
  try {
    record = await readForTeam(req.params.runId, res);
  } catch {
    return res.status(503).json({
      error: "Task Evaluation Run store is unavailable",
      code: "task_evaluation_policy_run_store_unavailable",
    });
  }
  if (!record) return next();
  res.set("Cache-Control", "private, no-store");
  return res.status(200).json(projectEvaluationReadyRun(record));
}

router.get("/:runId", verifyFirebaseToken, getRun);
router.get("/:runId/status", verifyFirebaseToken, getRun);

router.post(
  "/:runId/pipeline-status",
  pipelineRateLimiter,
  requirePipelineSignature,
  async (req, res, next) => {
    if (!db) return res.status(503).json({
      error: "Task Evaluation Run store is unavailable",
      code: "task_evaluation_policy_run_store_unavailable",
    });
    const parsed = evaluationReadyRunStatusProjectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({
      error: "Policy-run status projection is invalid",
      code: "task_evaluation_policy_run_status_invalid",
      violations: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    const projection = parsed.data;
    if (projection.run_id !== req.params.runId) return res.status(400).json({
      error: "Policy-run status route identity mismatch",
      code: "task_evaluation_policy_run_status_route_mismatch",
    });
    if (
      (projection.state === "results_ready" || projection.state === "abstained")
      && !evaluationReadyResultSummarySchema.safeParse(projection.result_summary).success
    ) return res.status(400).json({
      error: "Policy-run terminal result summary is invalid",
      code: "task_evaluation_policy_run_result_summary_invalid",
    });
    const ref = db.collection(COLLECTION).doc(projection.run_id);
    let outcome: "updated" | "replayed" | "not_found" | "identity_mismatch" | "progress_mismatch" | "state_regression" | "terminal_conflict";
    let record: EvaluationReadyRunRecord | null;
    try {
      const transactionResult = await withTaskEvaluationLaunchStoreTimeout(
        db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return { outcome: "not_found" as const, record: null };
        const existing = snapshot.data() as EvaluationReadyRunRecord;
        if (
          existing.source_launch_id !== projection.source_launch_id
          || existing.offering_digest !== projection.offering_digest
          || existing.configuration_digest !== projection.configuration_digest
        ) return { outcome: "identity_mismatch" as const, record: null };
        if (
          projection.progress
          && existing.episode_counts
          && projection.progress.total_episodes
            !== existing.episode_counts.total_episode_count
        ) return { outcome: "progress_mismatch" as const, record: null };
        const exactReplay = existing.state === projection.state
          && (existing.delivery_digest || null) === (projection.delivery_digest || null)
          && (existing.result_record_id || null) === (projection.result_record_id || null)
          && existing.pipeline_observed_at_iso === projection.observed_at_iso;
        if (exactReplay) {
          return { outcome: "replayed" as const, record: existing };
        }
        if (terminalStates.has(existing.state)) {
          return { outcome: "terminal_conflict" as const, record: null };
        }
        if ((stateRank.get(projection.state) || 0) < (stateRank.get(existing.state) || 0)) {
          return { outcome: "state_regression" as const, record: null };
        }
        const resultSummary = evaluationReadyResultSummarySchema.safeParse(
          projection.result_summary,
        );
        const update: Partial<EvaluationReadyRunRecord> = {
          state: projection.state,
          phase: projection.phase,
          progress: projection.progress,
          result_record_id: projection.result_record_id || null,
          result_summary: resultSummary.success ? resultSummary.data : null,
          delivery_digest: projection.delivery_digest || null,
          error: projection.error || null,
          pipeline_observed_at_iso: projection.observed_at_iso,
          updated_at_iso: new Date().toISOString(),
        };
        transaction.set(ref, update, { merge: true });
        return {
          outcome: "updated" as const,
          record: { ...existing, ...update } as EvaluationReadyRunRecord,
        };
      }),
      );
      outcome = transactionResult.outcome;
      record = transactionResult.record;
    } catch {
      return res.status(503).json({
        error: "Task Evaluation Run status store is unavailable",
        code: "task_evaluation_policy_run_status_store_unavailable",
      });
    }
    if (outcome === "not_found") return next();
    if (outcome === "identity_mismatch") return res.status(409).json({
      error: "Policy-run status identity does not match the stored run",
      code: "task_evaluation_policy_run_status_identity_mismatch",
    });
    if (outcome === "progress_mismatch") return res.status(409).json({
      error: "Policy-run status denominator does not match the stored run",
      code: "task_evaluation_policy_run_status_progress_mismatch",
    });
    if (outcome === "state_regression") return res.status(409).json({
      error: "Policy-run status cannot move backward",
      code: "task_evaluation_policy_run_status_regression",
    });
    if (outcome === "terminal_conflict") return res.status(409).json({
      error: "Terminal policy-run status is immutable",
      code: "task_evaluation_policy_run_terminal_conflict",
    });
    if (!record) return res.status(503).json({
      error: "Task Evaluation Run status store is unavailable",
      code: "task_evaluation_policy_run_status_store_unavailable",
    });
    if (
      (record.state === "results_ready" || record.state === "abstained")
      && record.result_record_id
    ) {
      const resultUrl = evaluationResultWebsiteUrl(record.result_record_id);
      await dispatchTransactionalNotification({
        eventType: "evaluation_results_ready",
        recipientType: "buyer",
        recipientUserId: String(record.notification_recipient_user_id || ""),
        subjectId: record.run_id,
        sourceEventId: String(
          record.notification_source_event_id || record.configuration_digest,
        ),
        sourceCollection: COLLECTION,
        sourceDocId: record.run_id,
        title: "Blueprint evaluation results are ready",
        body: "Your Task Evaluation Run results are ready in Blueprint.",
        emailSubject: "Your Blueprint evaluation results are ready",
        emailText: `Your Task Evaluation Run results are ready: ${resultUrl}`,
        preferenceKey: "account",
        data: {
          run_id: record.run_id,
          result_record_id: record.result_record_id,
          result_url: resultUrl,
        },
      });
    }
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({
      ...projectEvaluationReadyRun(record),
      already_exists: outcome === "replayed",
      notification_event_emitted:
        record.state === "results_ready" || record.state === "abstained",
    });
  },
);

export default router;
