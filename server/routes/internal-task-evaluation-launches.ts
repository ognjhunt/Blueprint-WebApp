import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { parseConfiguredSceneOfferingFromLaunchReceipt } from "../utils/configuredSceneOfferingContract";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { parseOpenAIInferenceUsagePacket } from "../utils/openaiInferenceUsageContract";
import {
  parseTaskEvaluationLaunchProgress,
  parseTaskEvaluationDirectExecutionAdoptionReceipt,
  taskEvaluationLaunchPublicationReadinessRequestSchema,
  parseTaskEvaluationLaunchReceipt,
  parseTaskEvaluationLaunchSupervision,
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
  "/openai-inference-usage",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({
      error: "OpenAI inference usage store is unavailable",
      code: "openai_inference_usage_store_unavailable",
    });
    const store = db;
    const parsed = parseOpenAIInferenceUsagePacket(req.body);
    if (!parsed.ok) return res.status(400).json({
      error: "OpenAI inference usage packet is invalid",
      blockers: parsed.blockers,
    });
    const { packet } = parsed;
    const callRefs = packet.calls.map((call) => store.collection("agentRuns").doc(
      `pipeline-openai-${call.call_id.replace(/^sha256:/, "")}`,
    ));
    type Outcome = "created" | "replayed" | "launch_missing" | "binding_mismatch" | "conflict";
    let outcome: Outcome;
    try {
      outcome = await store.runTransaction<Outcome>(async (transaction) => {
        if (packet.launch_id) {
          const launch = await transaction.get(
            store.collection("taskEvaluationLaunches").doc(packet.launch_id),
          );
          if (!launch.exists) return "launch_missing";
          if (String(launch.data()?.run_id || "") !== packet.run_id) {
            return "binding_mismatch";
          }
        }
        const existing = await transaction.getAll(...callRefs);
        if (existing.some((snapshot) =>
          snapshot.exists
          && snapshot.data()?.metadata?.source_packet_digest !== packet.packet_digest)) {
          return "conflict";
        }
        const allExisting = existing.every((snapshot) => snapshot.exists);
        if (allExisting) return "replayed";
        const now = new Date();
        for (const [index, call] of packet.calls.entries()) {
          if (existing[index].exists) continue;
          transaction.create(callRefs[index], {
            session_id: packet.run_id,
            task_kind: call.capability,
            provider: "openai",
            model: call.model,
            status: "completed",
            artifacts: {
              route: "pipeline_openai_responses",
              calls: 1,
              usage: {
                input_tokens: call.input_tokens,
                output_tokens: call.output_tokens,
                total_tokens: call.input_tokens + call.output_tokens,
                input_tokens_details: {
                  cached_tokens: call.cached_tokens,
                  cache_write_tokens: call.cache_write_tokens,
                },
                output_tokens_details: { reasoning_tokens: call.reasoning_tokens },
                uncached_input_tokens: call.uncached_input_tokens,
                uncached_input_cost_usd: call.uncached_input_cost_usd,
                cache_write_cost_usd: call.cache_write_cost_usd,
                cached_read_cost_usd: call.cached_read_cost_usd,
                output_cost_usd: call.output_cost_usd,
                estimated_total_cost_usd: call.estimated_total_cost_usd,
                estimated_cost_without_caching_usd:
                  call.estimated_cost_without_caching_usd,
                estimated_savings_usd: call.estimated_savings_usd,
                cost_status: call.cost_status,
                provider_response_id: call.provider_response_id,
              },
              cache_family: call.cache_family,
              cache_key_digest: call.cache_key_digest,
              cache_policy: {
                status: call.cache_policy_status,
                family: call.cache_family,
                contract_version: call.prompt_contract_version,
                stable_prefix_digest: call.stable_prefix_digest,
                breakpoint_digests: call.breakpoint_digests,
                policy_digest: call.policy_digest,
                privacy_scope: call.privacy_scope,
                processing_region: call.processing_region,
                decision_reason: call.cache_decision_reason,
                economics: { stable_prefix_tokens: call.reusable_prefix_tokens },
              },
              prompt_contract_version: call.prompt_contract_version,
              stable_prefix_digest: call.stable_prefix_digest,
              privacy_scope: call.privacy_scope,
              processing_region: call.processing_region,
              cache_decision:
                call.cache_policy_status === "enabled" ? "reusable" : "one_off",
              cache_decision_reason: call.cache_decision_reason,
              reusable_prefix_tokens: call.reusable_prefix_tokens,
              dynamic_suffix_tokens: call.dynamic_suffix_tokens,
              usage_detail_status: call.usage_detail_status,
              cost_status: call.cost_status,
              openai_response_id: call.provider_response_id,
              dynamic_content_before_breakpoint: false,
              raw_prompt_recorded: false,
              raw_secret_values_recorded: false,
            },
            metadata: {
              source: "signed_pipeline_openai_inference_usage",
              source_commit: packet.source_commit,
              source_receipt_digest: packet.source_receipt_digest,
              source_packet_digest: packet.packet_digest,
              launch_id: packet.launch_id,
              run_id: packet.run_id,
            },
            created_at: now,
            updated_at: now,
          });
        }
        return "created";
      });
    } catch {
      return res.status(503).json({
        error: "OpenAI inference usage store is unavailable",
        code: "openai_inference_usage_store_unavailable",
      });
    }
    if (outcome === "launch_missing") return res.status(404).json({
      error: "Task Evaluation launch not found",
      code: "openai_inference_usage_launch_missing",
    });
    if (outcome === "binding_mismatch" || outcome === "conflict") {
      return res.status(409).json({
        error: "OpenAI inference usage binding conflict",
        code: `openai_inference_usage_${outcome}`,
      });
    }
    res.set("Cache-Control", "private, no-store");
    return res.status(outcome === "created" ? 201 : 200).json({
      schema_version: "blueprint_openai_inference_usage_ingest_receipt.v1",
      status: outcome,
      run_id: packet.run_id,
      launch_id: packet.launch_id,
      source_commit: packet.source_commit,
      packet_digest: packet.packet_digest,
      call_count: packet.calls.length,
      raw_prompts_recorded: false,
      raw_secret_values_recorded: false,
    });
  },
);

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
    const ref = db.collection("taskEvaluationLaunches").doc(progress.launch_id);
    type Outcome = "recorded" | "ignored_terminal" | "not_found" | "binding_mismatch";
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        const snapshot = await transaction.get(ref);
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
        transaction.set(ref, {
          progress,
          progress_updated_at_iso: new Date().toISOString(),
        }, { merge: true });
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

router.post(
  "/task-evaluation-launch-supervision",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Task Evaluation supervision store is unavailable" });
    const parsed = parseTaskEvaluationLaunchSupervision(req.body);
    if (!parsed.ok) return res.status(400).json({
      error: "Pipeline Task Evaluation supervision is invalid",
      blockers: parsed.blockers,
    });
    const supervision = parsed.supervision;
    const recordId = supervision.snapshot_digest.replace("sha256:", "");
    const ref = db.collection("taskEvaluationLaunchSupervision").doc(recordId);
    let alreadyExists = false;
    try {
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) {
          const prior = existing.data() as Record<string, unknown>;
          if (prior.supervision_digest !== supervision.supervision_digest) {
            throw new Error("immutable_supervision_conflict");
          }
          alreadyExists = true;
          return;
        }
        transaction.create(ref, supervision);
      });
    } catch (error) {
      if (error instanceof Error && error.message === "immutable_supervision_conflict") {
        return res.status(409).json({ error: "Immutable launch supervision conflict" });
      }
      return res.status(503).json({ error: "Task Evaluation supervision store is unavailable" });
    }
    await db.collection("taskEvaluationLaunchSupervision").doc("latest").set({
      ...supervision,
      synced_at_iso: new Date().toISOString(),
    });
    return res.status(alreadyExists ? 200 : 201).json({
      schema_version: "task_evaluation_launch_supervision_web_sync_receipt.v1",
      status: "stored",
      already_exists: alreadyExists,
      snapshot_digest: supervision.snapshot_digest,
      supervision_digest: supervision.supervision_digest,
    });
  },
);

export default router;
