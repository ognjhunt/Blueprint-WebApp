import { createHash } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  validateDecisionEvidenceRequest,
  type DecisionEvidenceRequest,
} from "./decisionEvidenceContract";

export const AGENT_EXECUTION_ADMISSION_SCHEMA_VERSION =
  "blueprint.agent_execution_admission.v1" as const;

export interface AgentExecutionAdmissionSelection {
  decisionRequestId: string;
  teamId: string;
  checkpoint: {
    checkpointId: string;
    teamId: string;
    runtime: "policy_endpoint" | "container_image" | "model_artifact";
    reference: string;
  };
  scene: {
    requestId: string;
    siteId: string;
    captureId: string;
    captureDigestSha256: string;
    testbedDigestSha256: string;
  };
  taskId: string;
  taskFamily: string;
}

export type AgentExecutionAdmissionResult =
  | { admitted: true; envelope: Record<string, unknown>; canonicalJson: string; digestSha256: string }
  | { admitted: false; blockers: string[] };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function agentExecutionAdmissionDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function checkpointMatches(
  request: DecisionEvidenceRequest,
  selection: AgentExecutionAdmissionSelection,
): boolean {
  if (request.candidates.length !== 1) return false;
  const candidate = request.candidates[0];
  return (
    candidate.candidate_id === selection.checkpoint.checkpointId ||
    candidate.reference.external_id === selection.checkpoint.checkpointId
  );
}

function captureMatches(
  request: DecisionEvidenceRequest,
  selection: AgentExecutionAdmissionSelection,
): boolean {
  return request.constraints.available_physical_evidence.some(
    (artifact) =>
      artifact.artifact_id === selection.scene.captureId &&
      artifact.digest_sha256.toLowerCase() ===
        selection.scene.captureDigestSha256.toLowerCase() &&
      artifact.evidence_class === "real_observation",
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonicalCheckpointMatches(
  canonical: Record<string, unknown>,
  selection: AgentExecutionAdmissionSelection,
): boolean {
  const policy = objectValue(canonical.policy_package);
  if (selection.checkpoint.runtime === "policy_endpoint") {
    return (
      objectValue(policy.policy_api_endpoint).endpoint_url ===
      selection.checkpoint.reference
    );
  }
  if (selection.checkpoint.runtime === "container_image") {
    const container = objectValue(policy.docker_container);
    return (
      container.image_ref === selection.checkpoint.reference ||
      `${String(container.image_ref || "")}@${String(container.digest || "")}` ===
        selection.checkpoint.reference
    );
  }
  return false;
}

/**
 * Freeze an already-authorized Task Evaluation Run request for one purchased
 * robot-team execution. This utility never constructs missing task, capture,
 * rights, entitlement, checkpoint, or testbed facts.
 */
export async function prepareAgentExecutionAdmission(
  selection: AgentExecutionAdmissionSelection,
): Promise<AgentExecutionAdmissionResult> {
  const blockers: string[] = [];
  if (!db)
    return { admitted: false, blockers: ["agent_execution_store_unavailable"] };
  if (selection.checkpoint.teamId !== selection.teamId) {
    blockers.push("agent_execution_checkpoint_team_mismatch");
  }
  const snapshot = await db
    .collection("robotEvalJobRequests")
    .doc(selection.decisionRequestId)
    .get();
  if (!snapshot.exists) {
    return {
      admitted: false,
      blockers: ["agent_execution_decision_request_missing"],
    };
  }
  const record = (snapshot.data() ?? {}) as Record<string, unknown>;
  if (record.status !== "prepared_agent_execution")
    blockers.push("agent_execution_request_not_prepared");
  if (!record.entitlement_proof)
    blockers.push("agent_execution_entitlement_unverified");
  if (objectValue(record.pipeline_forward).performed === true)
    blockers.push("agent_execution_request_already_forwarded");
  const parsed = validateDecisionEvidenceRequest(record.decision_request);
  if (!parsed.ok || !parsed.request) {
    blockers.push("agent_execution_decision_request_invalid");
    blockers.push(...parsed.errors.map((error) => `decision_request:${error}`));
    return { admitted: false, blockers: [...new Set(blockers)] };
  }
  const request = parsed.request;
  const canonical = objectValue(record.canonical_execution_request);
  if (canonical.schema_version !== "robot_eval_job_request.v1") {
    blockers.push("agent_execution_canonical_request_missing");
  }
  if (canonical.job_id !== request.request_id) {
    blockers.push("agent_execution_canonical_job_identity_mismatch");
  }
  if (
    canonical.schema_version === "robot_eval_job_request.v1" &&
    record.canonical_execution_request_sha256 !==
      agentExecutionAdmissionDigest(canonical)
  ) {
    blockers.push("agent_execution_canonical_request_digest_mismatch");
  }
  if (request.request_id !== selection.decisionRequestId) {
    blockers.push("agent_execution_request_identity_mismatch");
  }
  if (request.site_task.site_id !== selection.scene.siteId) {
    blockers.push("agent_execution_site_mismatch");
  }
  if (request.site_task.task_id !== selection.taskId) {
    blockers.push("agent_execution_task_mismatch");
  }
  if (
    request.testbed.digest_sha256.toLowerCase() !==
    selection.scene.testbedDigestSha256.toLowerCase()
  ) {
    blockers.push("agent_execution_testbed_digest_mismatch");
  }
  if (!checkpointMatches(request, selection)) {
    blockers.push("agent_execution_checkpoint_not_in_frozen_candidates");
  }
  if (!canonicalCheckpointMatches(canonical, selection)) {
    blockers.push("agent_execution_canonical_checkpoint_mismatch");
  }
  const canonicalCustomer = objectValue(canonical.customer);
  if (canonicalCustomer.id !== selection.teamId) {
    blockers.push("agent_execution_canonical_team_mismatch");
  }
  const canonicalSite = objectValue(canonical.site_package);
  if (
    canonicalSite.site_id !== selection.scene.siteId ||
    canonicalSite.capture_id !== selection.scene.captureId
  ) {
    blockers.push("agent_execution_canonical_scene_mismatch");
  }
  const canonicalTasks = Array.isArray(canonical.requested_tasks)
    ? canonical.requested_tasks
    : [];
  const exactTask = canonicalTasks.length === 1 ? objectValue(canonicalTasks[0]) : {};
  const exactScenarios = Array.isArray(exactTask.scenario_ids)
    ? exactTask.scenario_ids
    : [];
  if (
    !canonicalTasks.some(
      (task) => objectValue(task).task_id === selection.taskId,
    )
  ) {
    blockers.push("agent_execution_canonical_task_mismatch");
  }
  const entitlement = objectValue(canonical.entitlement);
  if (entitlement.approved !== true) {
    blockers.push("agent_execution_canonical_entitlement_unapproved");
  }
  const executionAuthorization = objectValue(canonical.execution_authorization);
  if (
    executionAuthorization.authorized_by_user_id !== record.buyer_user_id ||
    executionAuthorization.principal_team_id !== selection.teamId ||
    executionAuthorization.rights_cleared !== true ||
    executionAuthorization.one_time_purchase !== true
  ) {
    blockers.push("agent_execution_exact_authorization_invalid");
  }
  if (
    canonicalTasks.length !== 1 ||
    exactScenarios.length !== 1 ||
    executionAuthorization.task_id !== exactTask.task_id ||
    executionAuthorization.scenario_id !== exactScenarios[0]
  ) {
    blockers.push("agent_execution_scope_unbounded");
  }
  if (!captureMatches(request, selection)) {
    blockers.push("agent_execution_capture_not_in_authorized_evidence");
  }
  if (
    !request.authorization?.entitlement_id ||
    !request.authorization.verified_by
  ) {
    blockers.push("agent_execution_authorization_unverified");
  }
  if (blockers.length)
    return { admitted: false, blockers: [...new Set(blockers)] };

  const envelope = {
    schema_version: AGENT_EXECUTION_ADMISSION_SCHEMA_VERSION,
    source_request_id: request.request_id,
    decision_request: request,
    canonical_execution_request: canonical,
    binding: {
      team_id: selection.teamId,
      checkpoint_id: selection.checkpoint.checkpointId,
      checkpoint_runtime: selection.checkpoint.runtime,
      checkpoint_reference: selection.checkpoint.reference,
      scene_request_id: selection.scene.requestId,
      site_id: selection.scene.siteId,
      capture_id: selection.scene.captureId,
      capture_digest_sha256: selection.scene.captureDigestSha256,
      testbed_digest_sha256: selection.scene.testbedDigestSha256,
      task_family: selection.taskFamily,
      task_id: exactTask.task_id,
      scenario_id: exactScenarios[0],
    },
    proof_boundary: {
      pipeline_execution_started: false,
      provider_spend_authorized: false,
      physical_success_proven: false,
      public_claim_upgrade_allowed: false,
    },
  };
  return {
    admitted: true,
    envelope,
    canonicalJson: canonicalJson(envelope),
    digestSha256: agentExecutionAdmissionDigest(envelope),
  };
}

export async function discoverAgentExecutionAdmissionsForSelection(
  selection: Omit<AgentExecutionAdmissionSelection, "decisionRequestId">,
  limit = 100,
): Promise<
  Array<{
    decisionRequestId: string;
    envelope: Record<string, unknown>;
    canonicalJson: string;
    digestSha256: string;
  }>
> {
  if (!db) return [];
  // Only prepared records can be admitted, so read only those; an unfiltered
  // window would miss a prepared record once the collection passed the limit.
  const snapshot = await db
    .collection("robotEvalJobRequests")
    .where("status", "==", "prepared_agent_execution")
    .limit(Math.max(1, Math.min(limit, 100)))
    .get();
  const admitted = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const result = await prepareAgentExecutionAdmission({
        ...selection,
        decisionRequestId: doc.id,
      });
      return result.admitted
        ? {
            decisionRequestId: doc.id,
            envelope: result.envelope,
            canonicalJson: result.canonicalJson,
            digestSha256: result.digestSha256,
          }
        : null;
    }),
  );
  return admitted.filter(
    (
      item,
    ): item is {
      decisionRequestId: string;
      envelope: Record<string, unknown>;
      canonicalJson: string;
      digestSha256: string;
    } => item !== null,
  );
}

export interface SceneExecutionFacts {
  ok: true;
  taskId: string;
  taskFamily: string;
  captureDigest: string;
  testbedDigest: string;
  testbedId: string;
  testbedVersion: string;
  siteId: string;
  captureId: string;
}

/**
 * What the Pipeline's published testbed says about a site's scene: the approved
 * task, the capture it was built from, and the digests that bind them. Read
 * from records, never constructed; anything missing is a blocker.
 */
export async function sceneExecutionFacts(
  scene: Record<string, unknown>,
): Promise<SceneExecutionFacts | { ok: false; blockers: string[] }> {
  if (!db) return { ok: false, blockers: ["agent_execution_store_unavailable"] };
  const pipeline = objectValue(scene.pipeline);
  const captureJobId = String(pipeline.capture_job_id || "").trim();
  if (!captureJobId) return { ok: false, blockers: ["agent_execution_capture_session_missing"] };
  const captureSnapshot = await db.collection("captureUploadSessions").doc(captureJobId).get();
  if (!captureSnapshot.exists) {
    return { ok: false, blockers: ["agent_execution_capture_session_missing"] };
  }
  const capture = objectValue(captureSnapshot.data());
  const testbedPublication = objectValue(capture.pipeline_site_task_testbed);
  const testbed = objectValue(testbedPublication.testbed);
  const approvedTask = objectValue(testbed.approved_task_definition);
  const sourceCapture = objectValue(approvedTask.source_capture);
  const task = objectValue(approvedTask.task);
  const taskDistribution = objectValue(testbed.task_distribution);
  const compiledCards = objectValue(testbed.compiled_cards);
  const siteCard = objectValue(compiledCards.site_card);
  const sourceCaptureBundles = Array.isArray(testbed.source_capture_bundles)
    ? testbed.source_capture_bundles.map(objectValue)
    : [];
  const facts = {
    ok: true as const,
    taskId: String(approvedTask.approved_task_id || "").trim(),
    taskFamily: String(task.task_family || taskDistribution.task_family || "").trim(),
    captureDigest: String(sourceCapture.capture_digest || sourceCaptureBundles[0]?.digest || "").trim(),
    testbedDigest: String(testbedPublication.testbed_digest || "").trim(),
    testbedId: String(testbedPublication.testbed_id || testbed.testbed_id || "").trim(),
    testbedVersion: String(testbedPublication.version || testbed.version || "").trim(),
    siteId: String(siteCard.id || testbed.site_id || "").trim(),
    captureId: String(pipeline.capture_id || capture.capture_id || captureJobId).trim(),
  };
  const blockers: string[] = [];
  if (!facts.taskId || !facts.taskFamily) blockers.push("agent_execution_approved_task_missing");
  if (!facts.captureDigest) blockers.push("agent_execution_capture_digest_missing");
  if (!facts.testbedDigest) blockers.push("agent_execution_testbed_digest_missing");
  if (!facts.siteId || !facts.captureId) blockers.push("agent_execution_scene_identity_missing");
  return blockers.length ? { ok: false, blockers } : facts;
}

export async function discoverAgentExecutionAdmission(params: {
  teamId: string;
  checkpointId: string;
  sceneId: string;
  quotedEpisodes: number;
  quotedUsd: number;
}): Promise<
  | { admitted: true; envelope: Record<string, unknown>; canonicalJson: string; digestSha256: string }
  | { admitted: false; blockers: string[] }
> {
  if (!db) return { admitted: false, blockers: ["agent_execution_store_unavailable"] };
  const [checkpointSnapshot, sceneSnapshot] = await Promise.all([
    db.collection("robotCheckpoints").doc(params.checkpointId).get(),
    db.collection("inboundRequests").doc(params.sceneId).get(),
  ]);
  if (!checkpointSnapshot.exists) {
    return { admitted: false, blockers: ["agent_execution_checkpoint_missing"] };
  }
  if (!sceneSnapshot.exists) {
    return { admitted: false, blockers: ["agent_execution_scene_missing"] };
  }
  const checkpoint = objectValue(checkpointSnapshot.data());
  const facts = await sceneExecutionFacts(objectValue(sceneSnapshot.data()));
  if (!facts.ok) return { admitted: false, blockers: facts.blockers };
  const { taskId, taskFamily, captureDigest, testbedDigest, siteId, captureId } = facts;
  const blockers: string[] = [];
  if (checkpoint.teamId !== params.teamId) blockers.push("agent_execution_checkpoint_team_mismatch");
  if (!Number.isInteger(params.quotedEpisodes) || params.quotedEpisodes <= 0) {
    blockers.push("agent_execution_episode_quote_invalid");
  }
  if (!Number.isFinite(params.quotedUsd) || params.quotedUsd < 0) {
    blockers.push("agent_execution_cost_quote_invalid");
  }
  if (blockers.length) return { admitted: false, blockers };

  const admissions = await discoverAgentExecutionAdmissionsForSelection({
    teamId: params.teamId,
    checkpoint: {
      checkpointId: params.checkpointId,
      teamId: String(checkpoint.teamId),
      runtime: checkpoint.runtime as AgentExecutionAdmissionSelection["checkpoint"]["runtime"],
      reference: String(checkpoint.reference || ""),
    },
    scene: {
      requestId: params.sceneId,
      siteId,
      captureId,
      captureDigestSha256: captureDigest,
      testbedDigestSha256: testbedDigest,
    },
    taskId,
    taskFamily,
  });
  const exact = admissions.filter((item) => {
    const canonical = objectValue(item.envelope.canonical_execution_request);
    const authorization = objectValue(canonical.execution_authorization);
    return (
      authorization.principal_team_id === params.teamId &&
      authorization.episodes === params.quotedEpisodes &&
      authorization.max_cost_usd === params.quotedUsd &&
      authorization.rights_cleared === true &&
      authorization.one_time_purchase === true
    );
  });
  if (exact.length !== 1) {
    return {
      admitted: false,
      blockers: [
        exact.length > 1
          ? "agent_execution_admission_ambiguous"
          : "agent_execution_exact_authorization_missing",
      ],
    };
  }
  return {
    admitted: true,
    envelope: exact[0].envelope,
    canonicalJson: exact[0].canonicalJson,
    digestSha256: exact[0].digestSha256,
  };
}
