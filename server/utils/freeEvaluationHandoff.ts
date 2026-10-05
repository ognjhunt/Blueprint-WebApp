import { prepareFreeAgentExecution } from "./selfServeAgentExecution";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "./field-encryption";
import { teamAccountUid } from "./robotTeamAccounts";
import { discoverAgentExecutionAdmission, agentExecutionAdmissionDigest, canonicalJson } from "./agentExecutionAdmission";
import { reservationTtlMs, runIdForReservation, type EvalRunRecord } from "./agentRunRecord";
import { TEAM_EVALUATION_PROVIDER_CAP_USD } from "./teamEvaluationSelection";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
/** An operator approves exact existing records; a workspace request alone is not permission. */
export const freeEvaluationApprovalSchema = z.object({
  teamId: id, checkpointId: id, executionRequestId: id.optional(),
  episodes: z.number().int().positive(),
  sponsorCapUsd: z.number().positive().max(TEAM_EVALUATION_PROVIDER_CAP_USD),
  expiresAtIso: z.string().datetime(),
  maxAttempts: z.literal(1),
  evidenceScope: z.literal("development_only"),
}).strict();

export async function admitFreeWorkspaceEvaluation(requestId: string, input: unknown, approvedBy: string) {
  id.parse(requestId);
  const approval = freeEvaluationApprovalSchema.parse(input);
  if (!db || !approvedBy) throw new Error("free_evaluation_authority_unavailable");
  const expiry = Date.parse(approval.expiresAtIso);
  if (expiry <= Date.now() || expiry > Date.now() + reservationTtlMs()) throw new Error("free_evaluation_approval_expired");
  const requestRef = db.collection("inboundRequests").doc(requestId);
  const application = (await requestRef.get()).data();
  const selection = application?.workspace_evaluation;
  if (!selection?.opportunityId || !selection.setupId || !application?.account_owner_uid)
    throw new Error("workspace_evaluation_missing");
  const owner = application.account_owner_uid;
  const sceneRef = db.collection("inboundRequests").doc(selection.opportunityId);
  const scene = (await sceneRef.get()).data();
  if (!scene || scene.consent_revoked === true || scene.future_processing_allowed === false)
    throw new Error("free_evaluation_scene_authority_unavailable");
  const teamRef = db.collection("robotTeams").doc(approval.teamId);
  const team = (await teamRef.get()).data();
  if (await teamAccountUid(approval.teamId) !== owner) throw new Error("free_evaluation_team_owner_mismatch");
  const setupRef = db.collection("users").doc(owner).collection("robotSetups").doc(selection.setupId);
  const setupRecord = (await setupRef.get()).data();
  if (!setupRecord?.payload) throw new Error("free_evaluation_setup_missing");
  const setup = JSON.parse(await decryptFieldValue(setupRecord.payload));
  const checkpointRef = db.collection("robotCheckpoints").doc(approval.checkpointId);
  const checkpoint = (await checkpointRef.get()).data();
  if (!checkpoint || checkpoint.teamId !== approval.teamId || checkpoint.reference !== setup.reference)
    throw new Error("free_evaluation_policy_mismatch");
  let executionRequestId = approval.executionRequestId;
  if (!executionRequestId) {
    const prepared = await prepareFreeAgentExecution({ teamId: approval.teamId,
      checkpointId: approval.checkpointId, sceneId: selection.opportunityId,
      quotedEpisodes: approval.episodes, quotedUsd: approval.sponsorCapUsd,
      submissionKey: `free:${requestId}` }, { approvedBy, expiresAtIso: approval.expiresAtIso });
    if (!prepared.prepared) throw new Error(prepared.blockers.join(","));
    executionRequestId = prepared.requestId;
  }
  const decisionRef = db.collection("robotEvalJobRequests").doc(executionRequestId);
  const decision = (await decisionRef.get()).data();
  if (decision?.buyer_user_id !== owner) throw new Error("free_evaluation_request_owner_mismatch");
  // Reuse the production entitlement, task, checkpoint, capture, rights and testbed checks.
  // The canonical cost bound is Blueprint's cap; the customer quote below is zero.
  const admitted = await discoverAgentExecutionAdmission({ teamId: approval.teamId,
    checkpointId: approval.checkpointId, sceneId: selection.opportunityId,
    executionRequestId, quotedEpisodes: approval.episodes,
    quotedUsd: approval.sponsorCapUsd });
  if (!admitted.admitted) throw new Error(admitted.blockers.join(","));
  const approvalDigest = agentExecutionAdmissionDigest({ requestId, approvedBy, approval,
    setup: setupRecord.payload, admissionDigest: admitted.digestSha256 });
  const funding = { payer: "blueprint", customer_price_usd: 0, cap_usd: approval.sponsorCapUsd,
    max_attempts: approval.maxAttempts, expires_at_iso: approval.expiresAtIso,
    approved_by: approvedBy, approval_digest: approvalDigest, workspace_request_id: requestId };
  const envelope: Record<string, unknown> = { ...admitted.envelope, funding, evidence_scope: approval.evidenceScope };
  const reservationId = `free_${agentExecutionAdmissionDigest({ requestId }).slice(7)}`;
  const runId = runIdForReservation(reservationId);
  const runRef = db.collection("evaluationRuns").doc(runId);
  const binding = envelope.binding as Record<string, unknown>;
  const run: EvalRunRecord = { runId, reservationId, teamId: approval.teamId,
    checkpointId: approval.checkpointId, sceneId: selection.opportunityId,
    taskFamily: String(binding.task_family), evaluationPurpose: "pilot", quotedUsd: 0,
    quotedEpisodes: approval.episodes, state: "requested", episodesRun: null,
    moneyResolved: false, requestedAtIso: new Date().toISOString(), resolvedAtIso: null,
    note: "Blueprint-funded development evaluation; no physical-success or partner proof.",
    dispatchPending: true, executionCaptureId: String(binding.capture_id),
    executionAdmission: { envelope, canonicalJson: canonicalJson(envelope), digestSha256: agentExecutionAdmissionDigest(envelope) } };
  return db.runTransaction(async transaction => {
    const [currentRequest, currentSetup, currentCheckpoint, currentDecision, currentRun, currentScene, currentTeam] = await Promise.all([
      transaction.get(requestRef), transaction.get(setupRef), transaction.get(checkpointRef),
      transaction.get(decisionRef), transaction.get(runRef), transaction.get(sceneRef), transaction.get(teamRef),
    ]);
    if (currentRun.exists) {
      if ((currentRun.data()?.executionAdmission?.envelope?.funding?.approval_digest) !== approvalDigest)
        throw new Error("free_evaluation_approval_conflict");
      return { runId, created: false };
    }
    if (agentExecutionAdmissionDigest(currentScene.data()) !== agentExecutionAdmissionDigest(scene)
      || agentExecutionAdmissionDigest(currentTeam.data()) !== agentExecutionAdmissionDigest(team)
      || agentExecutionAdmissionDigest(currentRequest.data()) !== agentExecutionAdmissionDigest(application)
      || agentExecutionAdmissionDigest(currentSetup.data()) !== agentExecutionAdmissionDigest(setupRecord)
      || agentExecutionAdmissionDigest(currentCheckpoint.data()) !== agentExecutionAdmissionDigest(checkpoint)
      || agentExecutionAdmissionDigest(currentDecision.data()) !== agentExecutionAdmissionDigest(decision))
      throw new Error("free_evaluation_source_changed");
    transaction.set(runRef, { ...run, settlementDueAtMs: expiry });
    transaction.set(requestRef, { free_evaluation_handoff: { runId, approvalDigest,
      approvedBy, approval, executionRequestId } }, { merge: true });
    return { runId, created: true };
  });
}
