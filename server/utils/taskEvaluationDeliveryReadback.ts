import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";

import { evaluationResultWebsiteUrl } from "./evaluationReadyRunContract";
import { operatorPolicyCanaryPublicationScope } from "./operatorPolicyCanaryRegistration";
import type { PipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";
import { resultArtifactMetadata } from "./taskEvaluationArtifactIntegrity";
import { taskEvaluationResultArtifactAdmission } from "./taskEvaluationResultArtifactAdmission";
import { probeTaskEvaluationResultArtifactMetadata } from "./taskEvaluationResultArtifactProxy";
import { createTaskEvaluationResultDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { stableJson } from "./taskCandidateContract";
import { readTaskEvaluationResultInbox } from "./taskEvaluationResultInbox";
import { parseVerifiedTaskEvaluationRunPublication } from "./taskEvaluationRunContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const taskEvaluationDeliveryReadbackRequestSchema = z.object({
  schema_version: z.literal("task_evaluation_delivery_readback_request.v1"),
  capture_session_id: identifier,
  run_id: identifier,
  operator_registration_digest: digest,
  result_delivery_digest: digest,
  policy_canary_projection_digest: digest,
  artifact_ids: z.array(identifier).min(1).max(12).refine((ids) => new Set(ids).size === ids.length),
}).strict();

type ReadbackRequest = z.infer<typeof taskEvaluationDeliveryReadbackRequestSchema>;

export class TaskEvaluationDeliveryReadbackError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

function publicationMatches(publication: Record<string, any>, expected: ReadbackRequest) {
  return publication.schema_version === "task_evaluation_run_publication.v4"
    && publication.capture_session_id === expected.capture_session_id
    && publication.run_id === expected.run_id
    && publication.operator_registration_digest === expected.operator_registration_digest
    && publication.result_delivery?.delivery_digest === expected.result_delivery_digest
    && publication.policy_canary_result?.projection_digest === expected.policy_canary_projection_digest;
}

/** Read stored publication and owner-list membership; issue only ephemeral UI tickets. */
export async function readTaskEvaluationDelivery(db: Firestore, expected: ReadbackRequest) {
  const recordId = `capture-run-${createHash("sha256")
    .update(`${expected.capture_session_id}\0${expected.run_id}`).digest("hex").slice(0, 32)}`;
  const [recordSnapshot, policySnapshot] = await Promise.all([
    db.collection("captureTaskEvaluationRuns").doc(recordId).get(),
    db.collection("taskEvaluationPolicyRuns").doc(expected.run_id).get(),
  ]);
  if (!recordSnapshot.exists || !policySnapshot.exists) {
    throw new TaskEvaluationDeliveryReadbackError(404, "delivery_readback_not_found");
  }
  const record = recordSnapshot.data() as Record<string, any>;
  const policyRun = policySnapshot.data() as Record<string, any>;
  const verified = parseVerifiedTaskEvaluationRunPublication(publicationFromResultRecord(record));
  if (!verified.ok || !publicationMatches(verified.publication, expected)) {
    throw new TaskEvaluationDeliveryReadbackError(409, "delivery_readback_publication_mismatch");
  }
  const publication = verified.publication as PipelinePolicyCanaryPublication;
  const scope = operatorPolicyCanaryPublicationScope(policyRun, publication);
  if (!scope || record.record_id !== recordId || record.owner_user_id !== scope.ownerUserId
    || record.organization_id !== scope.organizationId || record.access_visibility !== scope.accessVisibility) {
    throw new TaskEvaluationDeliveryReadbackError(404, "delivery_readback_owner_unavailable");
  }
  if (policyRun.run_id !== expected.run_id || policyRun.result_record_id !== recordId
    || policyRun.request_digest !== publication.request_digest
    || policyRun.pipeline_configuration_digest !== publication.configuration_digest
    || policyRun.task_success_contract_digest !== publication.policy_canary_result.task_success_contract?.contract_digest
    || policyRun.phase !== "published" || policyRun.stage !== "terminal"
    || policyRun.result_status !== publication.result_status
    || policyRun.delivery_digest !== expected.result_delivery_digest
    || policyRun.policy_run_result_projection?.projection_digest !== expected.policy_canary_projection_digest
    || stableJson(policyRun.policy_run_result_projection) !== stableJson(publication.policy_canary_result)) {
    throw new TaskEvaluationDeliveryReadbackError(409, "delivery_readback_run_binding_mismatch");
  }
  // This performs the same bounded owner query and access filtering as the UI;
  // a direct document read or a publication acknowledgement is insufficient.
  const inbox = await readTaskEvaluationResultInbox(db, {
    uid: scope.ownerUserId, tenantId: "", isOps: false,
  });
  const listed = inbox.records.find((item) => item.record_id === recordId);
  if (!listed || listed.owner_user_id !== scope.ownerUserId || listed.organization_id !== scope.organizationId
    || listed.access_visibility !== scope.accessVisibility || !publicationMatches(listed.publication, expected)) {
    throw new TaskEvaluationDeliveryReadbackError(409, "delivery_readback_owner_inbox_unverified");
  }
  const artifacts = expected.artifact_ids.map((artifactId) => {
    const metadata = resultArtifactMetadata(listed.publication, artifactId);
    const admission = taskEvaluationResultArtifactAdmission(listed.publication, artifactId);
    if (metadata.status === "invalid" || admission === "denied") {
      throw new TaskEvaluationDeliveryReadbackError(404, "delivery_readback_artifact_not_found");
    }
    return { artifactId, metadata: metadata.status === "known" ? metadata.metadata : null, admission };
  });
  for (const artifact of artifacts) {
    if (artifact.admission === "pipeline_run_registry") {
      const probe = await probeTaskEvaluationResultArtifactMetadata({
        runId: expected.run_id, artifactId: artifact.artifactId, expected: artifact.metadata ?? undefined,
      });
      if (probe.status !== "admitted" || !probe.metadata) {
        throw new TaskEvaluationDeliveryReadbackError(probe.status === "not_found" ? 404 : 503,
          "delivery_readback_artifact_origin_unverified");
      }
      artifact.metadata = probe.metadata;
    }
  }
  const downloads = artifacts.map(({ artifactId, metadata }) => {
    if (!metadata) throw new TaskEvaluationDeliveryReadbackError(503, "delivery_readback_artifact_origin_unverified");
    const ticket = createTaskEvaluationResultDownloadTicket(recordId, artifactId);
    if (!ticket) throw new TaskEvaluationDeliveryReadbackError(503, "delivery_readback_download_secret_unavailable");
    const query = new URLSearchParams({ expires: String(ticket.expires), signature: ticket.signature });
    return { artifact_id: artifactId, ...metadata, expires_at_unix: ticket.expires,
      download_url: `/api/task-evaluation-result-downloads/${encodeURIComponent(recordId)}/${encodeURIComponent(artifactId)}?${query}` };
  });
  // Do not log, persist, or copy download URLs into a durable proof record.
  return {
    schema_version: "task_evaluation_delivery_readback.v1", status: "verified", run_id: publication.run_id,
    record_id: recordId, result_url: evaluationResultWebsiteUrl(recordId),
    operator_registration_digest: publication.operator_registration_digest,
    result_delivery_digest: publication.result_delivery.delivery_digest,
    policy_canary_projection_digest: publication.policy_canary_result.projection_digest,
    inbox: { status: "verified", scope: "owner", run_id: listed.publication.run_id,
      projection_digest: listed.publication.policy_canary_result.projection_digest,
      team_namespace: scope.organizationId, source: "website_owner_run_index_readback" },
    ephemeral_downloads: downloads,
  };
}
