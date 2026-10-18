import { validateSiteTaskQualificationReceipt } from "./siteTaskQualificationReceipt";
import { hasCurrentPolicyRunLicense } from "./policyRunLicense";
import { prepareFreeAgentExecution } from "./selfServeAgentExecution";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "./field-encryption";
import { teamAccountUid } from "./robotTeamAccounts";
import { discoverAgentExecutionAdmission, agentExecutionAdmissionDigest, canonicalJson } from "./agentExecutionAdmission";
import { executionTtlMs, reservationTtlMs, runIdForReservation, type EvalRunRecord } from "./agentRunRecord";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { TEAM_EVALUATION_PROVIDER_CAP_USD } from "./teamEvaluationSelection";
import { teamJobAccess } from "./teamJobAccess";
import { isTeamEvaluationProfile, offersTeamEvaluation, TEAM_EVALUATION_PURPOSE, teamPolicyBlocker } from "./policyIntegration";
import { robotEmbodimentSchema } from "../../client/src/types/robotEmbodiment";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
/** An operator approves exact existing records; a workspace request alone is not permission. */
export const freeEvaluationApprovalSchema = z.object({
  teamId: id, checkpointId: id, executionRequestId: id.optional(),
  episodes: z.number().int().positive(),
  sponsorCapUsd: z.number().positive().max(TEAM_EVALUATION_PROVIDER_CAP_USD),
  expiresAtIso: z.string().datetime(),
  maxAttempts: z.literal(1),
  evidenceScope: z.enum(["development_only", "simulation"]),
  qualificationReceiptDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
}).strict().superRefine((value, context) => {
  if ((value.evidenceScope === "simulation") !== Boolean(value.qualificationReceiptDigest))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["qualificationReceiptDigest"],
      message: "A simulation evaluation requires its published qualification receipt; diagnostic evaluations do not use one." });
});

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
  if (!scene || !projectWebsiteCaptureRights(scene).derived_scene_generation_allowed)
    throw new Error("free_evaluation_scene_authority_unavailable");
  // The job must still be open to robot teams by the same rule the team
  // requested it under: a site that has since kept the job private, paused
  // it, or whose rights review now holds it, is not evaluated.
  const jobAccess = teamJobAccess(scene);
  if (!jobAccess.evaluationAvailable) throw new Error(`free_evaluation_job_not_open:${jobAccess.reason}`);
  const teamRef = db.collection("robotTeams").doc(approval.teamId);
  const team = (await teamRef.get()).data();
  if (await teamAccountUid(approval.teamId) !== owner) throw new Error("free_evaluation_team_owner_mismatch");
  const setupRef = db.collection("users").doc(owner).collection("robotSetups").doc(selection.setupId);
  const setupRecord = (await setupRef.get()).data();
  if (!setupRecord?.payload) throw new Error("free_evaluation_setup_missing");
  const setup = JSON.parse(await decryptFieldValue(setupRecord.payload));
  if (!hasCurrentPolicyRunLicense({ ownerUid: owner, requestId, opportunityId: selection.opportunityId,
    setupId: selection.setupId, setup }, selection.policyRunLicense))
    throw new Error("free_evaluation_policy_license_required:request_a_new_evaluation_for_this_setup");
  const checkpointRef = db.collection("robotCheckpoints").doc(approval.checkpointId);
  const checkpoint = (await checkpointRef.get()).data();
  if (!checkpoint || checkpoint.teamId !== approval.teamId || checkpoint.reference !== setup.reference)
    throw new Error("free_evaluation_policy_mismatch");
  // Preparation refuses an episode count other than 200 when the job offers team evaluations.
  const robotEmbodiment = setup.robotEmbodiment ? robotEmbodimentSchema.parse(setup.robotEmbodiment) : null;
  // A team evaluation calls an authenticated HTTPS policy; anything else is refused before
  // any prepared request (even an operator-supplied one) is admitted.
  const teamBlocker = offersTeamEvaluation(scene) ? teamPolicyBlocker(checkpoint, { robotEmbodiment }) : null;
  if (teamBlocker) throw new Error(teamBlocker);
  let executionRequestId = approval.executionRequestId;
  if (!executionRequestId) {
    const prepared = await prepareFreeAgentExecution({ teamId: approval.teamId,
      checkpointId: approval.checkpointId, sceneId: selection.opportunityId,
      quotedEpisodes: approval.episodes, quotedUsd: approval.sponsorCapUsd,
      submissionKey: `free:${requestId}`, teamEvaluation: { robotEmbodiment } },
    { approvedBy, expiresAtIso: approval.expiresAtIso });
    if (!prepared.prepared) throw new Error(prepared.blockers.join(","));
    executionRequestId = prepared.requestId;
  }
  const decisionRef = db.collection("robotEvalJobRequests").doc(executionRequestId);
  const decision = (await decisionRef.get()).data();
  if (decision?.buyer_user_id !== owner) throw new Error("free_evaluation_request_owner_mismatch");
  const captureJobId = scene.pipeline?.capture_job_id;
  const captureRef = typeof captureJobId === "string" && captureJobId
    ? db.collection("captureUploadSessions").doc(captureJobId) : null;
  const captureRecord = captureRef ? (await captureRef.get()).data() : null;
  // Reuse the production entitlement, task, checkpoint, capture, rights and testbed checks.
  // The canonical cost bound is Blueprint's cap; the customer quote below is zero.
  const admitted = await discoverAgentExecutionAdmission({ teamId: approval.teamId,
    checkpointId: approval.checkpointId, sceneId: selection.opportunityId,
    executionRequestId, quotedEpisodes: approval.episodes,
    quotedUsd: approval.sponsorCapUsd });
  if (!admitted.admitted) throw new Error(admitted.blockers.join(","));
  const admittedRequest = admitted.envelope.canonical_execution_request as Record<string, any>;
  const admittedEndpoint = admittedRequest?.policy_package?.policy_api_endpoint;
  if (isTeamEvaluationProfile(admittedEndpoint?.execution_profile)
    && agentExecutionAdmissionDigest(admittedEndpoint.robot_embodiment ?? null) !== agentExecutionAdmissionDigest(robotEmbodiment))
    throw new Error("free_evaluation_policy_robot_mismatch");
  const qualificationRef = approval.qualificationReceiptDigest
    ? db.collection("siteTaskQualifications").doc(approval.qualificationReceiptDigest.slice(7)) : null;
  const qualificationRecord = qualificationRef ? (await qualificationRef.get()).data() : null;
  const qualification = qualificationRef
    ? validateSiteTaskQualificationReceipt(qualificationRecord?.receipt) : null;
  if (qualification) {
    // Default DROID runtime assets do not yet expose independently measured,
    // hash-bound model bytes to this producer. Keep that path diagnostic.
    if (!robotEmbodiment) throw new Error("free_evaluation_qualification_robot_model_unbound");
    if (!captureRecord) throw new Error("free_evaluation_qualification_capture_missing");
    const binding = admitted.envelope.binding as Record<string, unknown>;
    const qualified = qualification.binding;
    const pairs = [
      [qualified.scene_request_id, selection.opportunityId], [qualified.site_id, binding.site_id],
      [qualified.task_id, binding.task_id], [qualified.capture_id, binding.capture_id],
      [qualified.source_capture_digest, binding.capture_digest_sha256],
      [qualified.testbed_digest_sha256, binding.testbed_digest_sha256],
    ];
    const canonical = admitted.envelope.canonical_execution_request as Record<string, any>;
    const endpoint = canonical?.policy_package?.policy_api_endpoint;
    if (qualification.receipt_digest !== approval.qualificationReceiptDigest
      || pairs.some(([qualifiedValue, currentValue]) => qualifiedValue !== currentValue)
      || qualified.policy_interface_id !== endpoint?.policy_interface_id
      || (robotEmbodiment && qualified.robot_model_digest !== robotEmbodiment.model.sha256))
      throw new Error("free_evaluation_qualification_binding_mismatch");
    // Validity covers the latest allowed claim plus its bounded execution.
    // Historical accepted evidence does not expire merely because it is viewed later.
    if (Date.parse(qualification.reviewed_at_iso) > Date.now()
      || Date.parse(qualification.expires_at_iso) < expiry + executionTtlMs())
      throw new Error("free_evaluation_qualification_expired_or_too_short");
    if (!isTeamEvaluationProfile(endpoint?.execution_profile) || approval.episodes !== 200)
      throw new Error("free_evaluation_qualification_requires_scored_200");
  }
  const approvalDigest = agentExecutionAdmissionDigest({ requestId, approvedBy, approval,
    setup: setupRecord.payload, policyRunLicense: selection.policyRunLicense, admissionDigest: admitted.digestSha256 });
  const funding = { payer: "blueprint", customer_price_usd: 0, cap_usd: approval.sponsorCapUsd,
    max_attempts: approval.maxAttempts, expires_at_iso: approval.expiresAtIso,
    approved_by: approvedBy, approval_digest: approvalDigest, workspace_request_id: requestId };
  const envelope: Record<string, unknown> = { ...admitted.envelope, funding,
    policy_run_license: selection.policyRunLicense, evidence_scope: approval.evidenceScope,
    ...(qualification ? { site_task_qualification: qualification.qualification,
      site_task_qualification_receipt: qualification } : {}) };
  const reservationId = `free_${agentExecutionAdmissionDigest({ requestId }).slice(7)}`;
  const runId = runIdForReservation(reservationId);
  const runRef = db.collection("evaluationRuns").doc(runId);
  const binding = envelope.binding as Record<string, unknown>;
  // Only a team-evaluation policy package is a team evaluation; any other admitted run is not one.
  const request = envelope.canonical_execution_request as Record<string, any> | undefined;
  const profile = request?.policy_package?.policy_api_endpoint?.execution_profile;
  if (offersTeamEvaluation(scene) && !isTeamEvaluationProfile(profile)) throw new Error("free_evaluation_team_evaluation_required");
  const run: EvalRunRecord = { runId, reservationId, teamId: approval.teamId,
    checkpointId: approval.checkpointId, sceneId: selection.opportunityId,
    taskFamily: String(binding.task_family), evaluationPurpose: "pilot",
    ...(isTeamEvaluationProfile(profile) ? { teamEvaluationPurpose: TEAM_EVALUATION_PURPOSE } : {}), quotedUsd: 0,
    quotedEpisodes: approval.episodes, state: "requested", episodesRun: null,
    moneyResolved: false, requestedAtIso: new Date().toISOString(), resolvedAtIso: null,
    note: qualification
      ? "Blueprint-funded evaluation on a qualified captured scene; simulation evidence only."
      : "Blueprint-funded development evaluation; no physical-success or partner proof.",
    dispatchPending: true, executionCaptureId: String(binding.capture_id),
    executionAdmission: { envelope, canonicalJson: canonicalJson(envelope), digestSha256: agentExecutionAdmissionDigest(envelope) } };
  return db.runTransaction(async transaction => {
    const [currentRequest, currentSetup, currentCheckpoint, currentDecision, currentRun, currentScene, currentTeam] = await Promise.all([
      transaction.get(requestRef), transaction.get(setupRef), transaction.get(checkpointRef),
      transaction.get(decisionRef), transaction.get(runRef), transaction.get(sceneRef), transaction.get(teamRef),
    ]);
    const [currentQualification, currentCapture] = await Promise.all([
      qualificationRef ? transaction.get(qualificationRef) : null,
      captureRef ? transaction.get(captureRef) : null,
    ]);
    if (captureRef && agentExecutionAdmissionDigest(currentCapture?.data() ?? null) !== agentExecutionAdmissionDigest(captureRecord ?? null))
      throw new Error("free_evaluation_capture_changed");
    if (qualificationRef && agentExecutionAdmissionDigest(currentQualification?.data() ?? null) !== agentExecutionAdmissionDigest(qualificationRecord ?? null))
      throw new Error("free_evaluation_qualification_changed");
    if (agentExecutionAdmissionDigest(currentScene.data()) !== agentExecutionAdmissionDigest(scene)
      || agentExecutionAdmissionDigest(currentTeam.data()) !== agentExecutionAdmissionDigest(team)
      || agentExecutionAdmissionDigest(currentRequest.data()) !== agentExecutionAdmissionDigest(application)
      || agentExecutionAdmissionDigest(currentSetup.data()) !== agentExecutionAdmissionDigest(setupRecord)
      || agentExecutionAdmissionDigest(currentCheckpoint.data()) !== agentExecutionAdmissionDigest(checkpoint)
      || agentExecutionAdmissionDigest(currentDecision.data()) !== agentExecutionAdmissionDigest(decision))
      throw new Error("free_evaluation_source_changed");
    if (currentRun.exists) {
      if ((currentRun.data()?.executionAdmission?.envelope?.funding?.approval_digest) !== approvalDigest)
        throw new Error("free_evaluation_approval_conflict");
      return { runId, created: false, evidenceScope: approval.evidenceScope };
    }
    transaction.set(runRef, { ...run, settlementDueAtMs: expiry });
    transaction.set(requestRef, { free_evaluation_handoff: { runId, approvalDigest,
      approvedBy, approval, executionRequestId } }, { merge: true });
    return { runId, created: true, evidenceScope: approval.evidenceScope };
  });
}
