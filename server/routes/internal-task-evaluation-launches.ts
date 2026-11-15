import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { parseConfiguredSceneOfferingFromLaunchReceipt } from "../utils/configuredSceneOfferingContract";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  parseTaskEvaluationLaunchProgress,
  parseTaskEvaluationDirectExecutionAdoptionReceipt,
  taskEvaluationLaunchPublicationReadinessRequestSchema,
  parseTaskEvaluationLaunchReceipt,
} from "../utils/taskEvaluationLaunchContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

router.post(
  "/task-evaluation-launch-publication-readiness",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({
      error: "Task Evaluation launch store is unavailable",
      code: "task_evaluation_launch_store_unavailable",
    });
    const parsed = taskEvaluationLaunchPublicationReadinessRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({
      error: "Task Evaluation launch publication readiness request is invalid",
      code: "task_evaluation_launch_publication_readiness_request_invalid",
    });
    const request = parsed.data;
    let snapshot;
    try {
      snapshot = await db.collection("taskEvaluationLaunches").doc(request.launch_id).get();
    } catch {
      return res.status(503).json({
        error: "Task Evaluation launch store is unavailable",
        code: "task_evaluation_launch_store_unavailable",
      });
    }
    if (!snapshot.exists) return res.status(404).json({
      error: "Task Evaluation launch not found",
      code: "task_evaluation_launch_publication_record_missing",
    });
    const existing = snapshot.data() as Record<string, any>;
    const storedTeamNamespace = String(
      existing.team_namespace || existing.request?.team_namespace || "",
    );
    if (
      existing.run_id !== request.run_id
      || existing.request_digest !== request.request_digest
      || storedTeamNamespace !== request.team_namespace
      || existing.configured_scene_context?.run_mode !== "scene_configuration"
      || existing.configured_scene_context?.team_namespace !== request.team_namespace
    ) return res.status(409).json({
      error: "Task Evaluation launch publication binding mismatch",
      code: "task_evaluation_launch_publication_binding_mismatch",
    });
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_launch_publication_readiness_receipt.v1",
      status: "ready",
      launch_id: request.launch_id,
      run_id: request.run_id,
      request_digest: request.request_digest,
      team_namespace: request.team_namespace,
      terminal_receipt_schema_version: "task_evaluation_launch_receipt.v1",
      web_sync_receipt_schema_version: "task_evaluation_launch_web_sync_receipt.v1",
      configured_scene_offering_schema_version:
        "task_evaluation_configured_scene_offering.v1",
      launch_record_read_succeeded: true,
      team_namespace_binding_passed: true,
      firestore_mutation_performed: false,
    });
  },
);

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req, {
    expectedSecret: process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN,
  });
  if (!result.ok) return res.status(result.status).json({
    error: result.message,
    code: result.code,
  });
  next();
}

function isPublicationRecoveryUpgrade(
  existing: Record<string, any>,
  receipt: Record<string, any>,
) {
  const recovery = receipt.publication_recovery;
  return (
    existing.terminal_receipt?.status === "blocked"
    && receipt.status === "completed"
    && recovery?.schema_version
      === "task_evaluation_scene_configuration_publication_recovery.v1"
    && recovery.status === "completed"
    && recovery.original_terminal_receipt_digest
      === existing.terminal_receipt.receipt_digest
    && recovery.provider_execution_repeated === false
    && recovery.paid_execution_requested === false
    && recovery.provider_mutation_performed === false
    && receipt.terminal_evidence?.publication_recovery?.recovery_digest
      === recovery.recovery_digest
  );
}

router.post(
  "/task-evaluation-launches",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
    const directAdoption = req.body?.schema_version
      === "task_evaluation_native_direct_execution_adoption.v1";
    const parsed = directAdoption
      ? parseTaskEvaluationDirectExecutionAdoptionReceipt(req.body)
      : parseTaskEvaluationLaunchReceipt(req.body);
    if (!parsed.ok) return res.status(400).json({
      error: "Pipeline Task Evaluation launch receipt is invalid",
      blockers: parsed.blockers,
    });
    const receipt = parsed.receipt;
    const configuredSceneOffering = directAdoption
      ? undefined
      : parseConfiguredSceneOfferingFromLaunchReceipt(
        receipt as unknown as Record<string, unknown>,
      );
    if (configuredSceneOffering && !configuredSceneOffering.ok) {
      return res.status(400).json({
        error: "Configured scene offering is invalid",
        blockers: configuredSceneOffering.blockers,
      });
    }
    const offering = configuredSceneOffering?.ok
      ? configuredSceneOffering.offering
      : undefined;
    const ref = db.collection("taskEvaluationLaunches").doc(receipt.launch_id);
    type Outcome = "updated" | "replayed" | "replayed_catalog_repaired"
      | "publication_recovered"
      | "not_found" | "binding_mismatch"
      | "configured_scene_offering_missing" | "immutable_conflict"
      | "adoption_updated" | "adoption_replayed" | "adoption_conflict";
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return "not_found";
        const existing = snapshot.data() as Record<string, any>;
        if (
          existing.request_digest !== receipt.request_digest
          || existing.run_id !== receipt.run_id
        ) return "binding_mismatch";
        if (directAdoption) {
          const adoptionProjection = receipt.website_projection as {
            qualification_upgrade_performed: boolean;
          };
          const original = existing.terminal_receipt as Record<string, any> | undefined;
          const existingProfileDigest = String(
            existing.request?.launch_profile_digest
              || existing.launch_profile_digest
              || original?.launch_profile_digest
              || "",
          );
          const existingProfileId = String(
            existing.request?.launch_profile_id
              || existing.launch_profile_id
              || "",
          );
          if (
            !original
            || original.status !== "blocked"
            || original.receipt_digest !== receipt.original_launch_receipt_digest
            || original.request_digest !== receipt.request_digest
            || original.launch_profile_digest !== receipt.launch_profile_digest
            || existingProfileId !== receipt.launch_profile_id
            || existingProfileDigest !== receipt.launch_profile_digest
            || receipt.status !== "blocked"
            || receipt.construction_gate_qualified !== false
            || receipt.controls_qualified !== false
            || receipt.evaluation_ready !== false
            || adoptionProjection.qualification_upgrade_performed !== false
          ) return "binding_mismatch";
          if (existing.terminal_adoption_receipt) {
            return existing.terminal_adoption_receipt.receipt_digest
              === receipt.receipt_digest
              ? "adoption_replayed"
              : "adoption_conflict";
          }
          transaction.set(ref, {
            state: "blocked",
            terminal_adoption_receipt: receipt,
            terminal_adoption_receipt_digest: receipt.receipt_digest,
            terminal_adoption_original_receipt_digest:
              receipt.original_launch_receipt_digest,
            terminal_adoption_updated_at_iso: new Date().toISOString(),
            configured_scene_offering_state: "configured_controls_pending",
            native_construction_status: "blocked",
            native_construction_blockers: receipt.blockers,
            native_construction_evidence_refs: receipt.source_receipts,
            controls_qualified: false,
            evaluation_ready: false,
            terminal_adoption_provider_mutation_observed: true,
          }, { merge: true });
          return "adoption_updated";
        }
        const expectedTeamNamespace = String(
          existing.team_namespace || existing.request?.team_namespace || "",
        );
        const configuredSceneExpected =
          existing.configured_scene_context?.run_mode === "scene_configuration";
        const completedConfiguredSceneExpected = configuredSceneExpected
          && receipt.status === "completed";
        if (completedConfiguredSceneExpected && !offering) {
          return "configured_scene_offering_missing";
        }
        if (!configuredSceneExpected && offering) return "binding_mismatch";
        if (
          offering
          && (
            offering.team_namespace !== expectedTeamNamespace
            || offering.configuration_run_id
              !== existing.configured_scene_context?.configuration_run_id
          )
        ) {
          return "binding_mismatch";
        }
        if (existing.terminal_receipt) {
          const sameOffering = offering
            ? existing.configured_scene_offering_digest === offering.offering_digest
            : existing.configured_scene_offering_digest === undefined;
          if (
            existing.terminal_receipt.receipt_digest === receipt.receipt_digest
            && sameOffering
          ) {
            if (offering && existing.configured_scene_offering_state !== "launch_ready") {
              transaction.set(ref, {
                configured_scene_offering_state: "launch_ready",
                configured_scene_offering_team_namespace: offering.team_namespace,
              }, { merge: true });
              return "replayed_catalog_repaired";
            }
            return "replayed";
          }
          if (!offering || !isPublicationRecoveryUpgrade(existing, receipt)) {
            return "immutable_conflict";
          }
          transaction.set(ref, {
            state: receipt.status,
            terminal_receipt_before_publication_recovery: existing.terminal_receipt,
            terminal_receipt_before_publication_recovery_digest:
              existing.terminal_receipt.receipt_digest,
            terminal_receipt: receipt,
            terminal_receipt_digest: receipt.receipt_digest,
            publication_recovery: receipt.publication_recovery,
            provider_mutation_observed: receipt.provider_mutation_attempted,
            terminal_updated_at_iso: new Date().toISOString(),
            configured_scene_offering: offering,
            configured_scene_offering_digest: offering.offering_digest,
            configured_scene_offering_state: "launch_ready",
            configured_scene_offering_team_namespace: offering.team_namespace,
            configured_scene_offering_public_visibility:
              offering.public_display?.status === "authorized" ? "public" : "private",
            ...(offering.public_display ? {
              configured_scene_offering_public_slug: offering.public_display.public_slug,
            } : {}),
          }, { merge: true });
          return "publication_recovered";
        }
        transaction.set(ref, {
          state: receipt.status,
          terminal_receipt: receipt,
          terminal_receipt_digest: receipt.receipt_digest,
          provider_mutation_observed: receipt.provider_mutation_attempted,
          terminal_updated_at_iso: new Date().toISOString(),
          ...(offering ? {
            configured_scene_offering: offering,
            configured_scene_offering_digest: offering.offering_digest,
            configured_scene_offering_state: "launch_ready",
            configured_scene_offering_team_namespace: offering.team_namespace,
            configured_scene_offering_public_visibility:
              offering.public_display?.status === "authorized" ? "public" : "private",
            ...(offering.public_display ? {
              configured_scene_offering_public_slug: offering.public_display.public_slug,
            } : {}),
          } : {}),
        }, { merge: true });
        return "updated";
      });
    } catch {
      return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
    }
    if (outcome === "not_found") return res.status(404).json({ error: "Task Evaluation launch not found" });
    if (outcome === "binding_mismatch") return res.status(409).json({ error: "Task Evaluation launch binding mismatch" });
    if (outcome === "configured_scene_offering_missing") return res.status(409).json({
      error: "Configured scene offering is required",
      code: "configured_scene_offering_missing",
    });
    if (outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable Task Evaluation launch receipt conflict" });
    if (outcome === "adoption_conflict") return res.status(409).json({
      error: "Immutable Task Evaluation direct-execution adoption conflict",
      code: "task_evaluation_direct_execution_adoption_immutable_conflict",
    });
    res.set("Cache-Control", "no-store");
    return res.status([
      "replayed",
      "replayed_catalog_repaired",
      "adoption_replayed",
    ].includes(outcome) ? 200 : 201).json({
      schema_version: "task_evaluation_launch_web_sync_receipt.v1",
      status: receipt.status,
      already_exists: [
        "replayed",
        "replayed_catalog_repaired",
        "adoption_replayed",
      ].includes(outcome),
      launch_id: receipt.launch_id,
      run_id: receipt.run_id,
      request_digest: receipt.request_digest,
      receipt_digest: receipt.receipt_digest,
      ...(directAdoption ? {
        configured_scene_offering_status: "configured_controls_pending",
        native_construction_status: "blocked",
        native_construction_blockers: receipt.blockers,
        qualification_upgrade_performed: false,
      } : {}),
      ...(offering ? {
        configured_scene_offering_digest: offering.offering_digest,
        configured_scene_offering_status: offering.status,
      } : {}),
      ...(outcome === "publication_recovered" ? {
        publication_recovery_applied: true,
      } : {}),
      ...(outcome === "replayed_catalog_repaired" ? {
        configured_scene_catalog_state_repaired: true,
      } : {}),
    });
  },
);

router.post(
  "/task-evaluation-launch-progress",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
    const parsed = parseTaskEvaluationLaunchProgress(req.body);
    if (!parsed.ok) return res.status(400).json({
      error: "Pipeline Task Evaluation launch progress is invalid",
      blockers: parsed.blockers,
    });
    const progress = parsed.progress;
    const launchRef = db.collection("taskEvaluationLaunches").doc(progress.launch_id);
    const policyRunRef = db.collection("taskEvaluationPolicyRuns").doc(progress.run_id);
    type Outcome = "recorded" | "ignored_terminal" | "not_found" | "binding_mismatch";
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        let ref = launchRef;
        let snapshot = await transaction.get(launchRef);
        if (!snapshot.exists && progress.launch_id === progress.run_id) {
          const candidate = await transaction.get(policyRunRef);
          const policyRun = candidate.data() as Record<string, any> | undefined;
          if (candidate.exists && policyRun?.run_kind === "internal_policy_canary") {
            ref = policyRunRef;
            snapshot = candidate;
          }
        }
        if (!snapshot.exists) return "not_found";
        const existing = snapshot.data() as Record<string, any>;
        if (
          existing.request_digest !== progress.request_digest
          || existing.run_id !== progress.run_id
        ) return "binding_mismatch";
        // The terminal receipt is the only authority once it exists. A progress
        // post delayed behind it must not make a finished run look in-flight
        // again, so this is a no-op rather than a conflict.
        if (existing.terminal_receipt) return "ignored_terminal";
        // `state` is deliberately never written here. It is the terminal field,
        // and the control room stops polling the moment it reads a terminal
        // value, so an observation writing it would freeze the live view.
        const progressUpdate = existing.run_kind === "internal_policy_canary"
          ? {
              // Policy-run records already use `progress` for the immutable
              // completed/total episode pair. Keep lifecycle observations in
              // their own field instead of erasing the real counters.
              pipeline_progress: progress,
            }
          : { progress };
        transaction.set(ref, {
          ...progressUpdate,
          progress_updated_at_iso: new Date().toISOString(),
        }, { merge: true });
        // Keep accepted lifecycle observations for reconnecting cloud operators.
        // The digest makes retries idempotent; terminal state remains untouched.
        transaction.set(ref.collection("progressEvents").doc(
          canonicalArtifactDigest(progress, "event_digest").replace("sha256:", ""),
        ), progress);
        return "recorded";
      });
    } catch {
      return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
    }
    if (outcome === "not_found") return res.status(404).json({ error: "Task Evaluation launch not found" });
    if (outcome === "binding_mismatch") return res.status(409).json({ error: "Task Evaluation launch binding mismatch" });
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_launch_progress_web_sync_receipt.v1",
      status: outcome,
      launch_id: progress.launch_id,
      run_id: progress.run_id,
      request_digest: progress.request_digest,
      phase: progress.phase,
    });
  },
);

export default router;
