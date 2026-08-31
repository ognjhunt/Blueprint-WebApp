import { createHash } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { stableJson } from "../utils/taskCandidateContract";
import { dispatchTransactionalNotification } from "../utils/transactional-notifications";
import { evaluationResultWebsiteUrl } from "../utils/evaluationReadyRunContract";
import {
  parsePipelinePolicyCanaryPreproviderBlocked,
  parsePipelinePolicyCanaryPublication,
  type PipelinePolicyCanaryPreproviderBlocked,
  type PipelinePolicyCanaryPublication,
} from "../utils/policyCanaryWebappSyncContract";
import { buildPolicyCanaryTerminalEmail } from "../utils/policyCanaryNotification";
import { configuredSceneOfferingSchema } from "../utils/configuredSceneOfferingContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

function sameScientificIdentity(left: Record<string, any>, right: Record<string, any>) {
  return [
    "capture_session_id",
    "intake_id",
    "run_id",
    "testbed_digest",
    "request_digest",
    "plan_digest",
    "state",
  ].every((field) => left[field] === right[field])
    && left.decision_envelope?.decision_envelope_digest
      === right.decision_envelope?.decision_envelope_digest;
}

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({ error: result.message, code: result.code });
  next();
}

type NotificationDelivery = {
  terminal_state: "completed" | "blocked" | "cancelled";
  status: "accepted" | "delivered" | "failed";
  attempts: number;
  provider: string;
  message_id: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  run_result_digest: string;
};

function terminalState(resultStatus: string): NotificationDelivery["terminal_state"] {
  if (resultStatus === "completed_unqualified") return "completed";
  if (resultStatus === "cancelled") return "cancelled";
  return "blocked";
}

function retainedNotification(
  value: unknown,
  expectedState: NotificationDelivery["terminal_state"],
  expectedDigest: string,
): NotificationDelivery | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, any>;
  if (
    row.terminal_state !== expectedState
    || !["accepted", "delivered"].includes(String(row.status))
    || row.run_result_digest !== expectedDigest
    || !Number.isInteger(row.attempts)
    || row.attempts < 1
  ) return null;
  return row as NotificationDelivery;
}

function authenticatedRunUrl(runId: string) {
  const path = `/app/evaluation-runs/${encodeURIComponent(runId)}`;
  const configured = String(
    process.env.APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://tryblueprint.io",
  ).trim();
  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:"
      && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")
    ) return `https://tryblueprint.io${path}`;
    url.pathname = path;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `https://tryblueprint.io${path}`;
  }
}

async function dispatchCanaryTerminalNotification(params: {
  policyRun: Record<string, any>;
  policyRunRef: FirebaseFirestore.DocumentReference;
  resultStatus: "completed_unqualified" | "blocked" | "cancelled";
  runResultDigest: string;
  resultUrl: string;
}) {
  const expectedState = terminalState(params.resultStatus);
  const retained = retainedNotification(
    params.policyRun.notification_delivery,
    expectedState,
    params.runResultDigest,
  );
  if (retained) return retained;
  const priorAttempts = Number(params.policyRun.notification_delivery?.attempts || 0);
  const emailCopy = buildPolicyCanaryTerminalEmail({
    record: {
      ...params.policyRun,
      state: params.resultStatus === "completed_unqualified"
        ? "results_ready"
        : params.resultStatus,
    },
    resultUrl: params.resultUrl,
  });
  const records = await dispatchTransactionalNotification({
    eventType: "evaluation_results_ready",
    recipientType: "buyer",
    recipientUserId: String(params.policyRun.notification_recipient_user_id || ""),
    recipientEmail: String(params.policyRun.notification?.email || ""),
    subjectId: String(params.policyRun.run_id || ""),
    sourceEventId: params.runResultDigest,
    sourceCollection: "taskEvaluationPolicyRuns",
    sourceDocId: String(params.policyRun.run_id || ""),
    title: emailCopy.title,
    body: emailCopy.body,
    emailSubject: emailCopy.emailSubject,
    emailText: emailCopy.emailText,
    preferenceKey: "account",
    data: {
      run_id: params.policyRun.run_id,
      result_url: params.resultUrl,
      run_kind: "internal_policy_canary",
      result_status: params.resultStatus,
    },
  });
  const email = records.find((record) => record.channel === "email");
  const notification: NotificationDelivery = {
    terminal_state: expectedState,
    status: email?.status === "sent"
      ? "accepted"
      : email && (email as Record<string, any>).status === "delivered"
        ? "delivered"
        : "failed",
    attempts: priorAttempts + 1,
    provider: String(email?.delivery_provider || "website_transactional_email"),
    message_id: email?.provider_message_id || null,
    accepted_at: email?.status === "sent" ? email.sent_at : null,
    delivered_at: email && (email as Record<string, any>).status === "delivered"
      ? email.sent_at
      : null,
    failure_reason: email?.failure_reason
      || (email?.status === "skipped" ? email.skip_reason : null)
      || (!email ? "notification_dispatch_record_missing" : null),
    run_result_digest: params.runResultDigest,
  };
  await params.policyRunRef.set({
    notification_delivery: notification,
    updated_at_iso: new Date().toISOString(),
  }, { merge: true });
  return notification;
}

function configuredOffering(record: Record<string, any>) {
  const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
  if (
    !parsed.success
    || record.configured_scene_offering_state !== "configured_controls_pending"
    || parsed.data.status !== "configured_controls_pending"
    || record.configured_scene_offering_digest !== parsed.data.offering_digest
  ) return null;
  return parsed.data;
}

function offeringScope(
  policyRun: Record<string, any>,
  offering: { team_namespace: string },
) {
  const ownerUserId = String(policyRun.owner_user_id || "").trim();
  const organizationId = offering.team_namespace;
  return {
    ownerUserId,
    organizationId,
    accessVisibility: organizationId === `user:${ownerUserId}`
      ? "owner_only" as const
      : "organization_members" as const,
  };
}

function policyRunBelongsToOffering(
  policyRun: Record<string, any>,
  offering: { offering_digest: string; team_namespace: string },
  sourceLaunchId: string,
) {
  return Boolean(String(policyRun.owner_user_id || "").trim())
    && policyRun.source_launch_id === sourceLaunchId
    && policyRun.offering_digest === offering.offering_digest
    && policyRun.team_namespace === offering.team_namespace;
}

async function handlePolicyCanaryPublication(
  publication: PipelinePolicyCanaryPublication,
  res: Response,
) {
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  const offeringRef = db.collection("taskEvaluationLaunches").doc(publication.capture_session_id);
  const policyRunRef = db.collection("taskEvaluationPolicyRuns").doc(publication.run_id);
  const recordId = `capture-run-${createHash("sha256").update(`${publication.capture_session_id}\0${publication.run_id}`).digest("hex").slice(0, 32)}`;
  const runRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  type Outcome = "created" | "replayed" | "offering_not_found" | "offering_invalid" | "policy_run_not_found" | "configuration_run_mismatch" | "owner_team_mismatch" | "binding_mismatch" | "immutable_conflict";
  let transactionResult: { outcome: Outcome; policyRun: Record<string, any> | null };
  try {
    transactionResult = await db.runTransaction(async (transaction) => {
      const [offeringSnapshot, policyRunSnapshot, runSnapshot] = await Promise.all([
        transaction.get(offeringRef), transaction.get(policyRunRef), transaction.get(runRef),
      ]);
      if (!offeringSnapshot.exists) return { outcome: "offering_not_found" as const, policyRun: null };
      if (!policyRunSnapshot.exists) return { outcome: "policy_run_not_found" as const, policyRun: null };
      const offeringRecord = offeringSnapshot.data() as Record<string, any>;
      const offering = configuredOffering(offeringRecord);
      if (!offering) return { outcome: "offering_invalid" as const, policyRun: null };
      const policyRun = policyRunSnapshot.data() as Record<string, any>;
      if (offering.configuration_run_id !== publication.intake_id) {
        return { outcome: "configuration_run_mismatch" as const, policyRun: null };
      }
      if (!policyRunBelongsToOffering(
        policyRun,
        offering,
        publication.capture_session_id,
      )) {
        return { outcome: "owner_team_mismatch" as const, policyRun: null };
      }
      if (
        policyRun.run_kind !== "internal_policy_canary"
        || policyRun.request_digest !== publication.request_digest
        || (policyRun.pipeline_configuration_digest
          && policyRun.pipeline_configuration_digest !== publication.configuration_digest)
      ) return { outcome: "binding_mismatch" as const, policyRun: null };
      const now = new Date().toISOString();
      const scope = offeringScope(policyRun, offering);
      const record = {
        schema_version: "capture_task_evaluation_run_record.v2",
        record_id: recordId,
        owner_user_id: scope.ownerUserId,
        organization_id: scope.organizationId,
        access_visibility: scope.accessVisibility,
        created_at_iso: runSnapshot.exists
          ? String((runSnapshot.data() as Record<string, any>).created_at_iso || now)
          : now,
        updated_at_iso: now,
        publication,
      };
      let outcome: "created" | "replayed" = "created";
      if (runSnapshot.exists) {
        const existing = runSnapshot.data() as Record<string, any>;
        if (stableJson(existing.publication) !== stableJson(publication)) {
          return { outcome: "immutable_conflict" as const, policyRun: null };
        }
        outcome = "replayed";
      } else {
        transaction.create(runRef, record);
      }
      const state = publication.result_status === "completed_unqualified"
        ? "results_ready"
        : publication.result_status;
      const projection = publication.policy_canary_result;
      const update = {
        state,
        phase: "published",
        stage: "terminal",
        result_status: publication.result_status,
        pipeline_configuration_digest: publication.configuration_digest,
        progress: {
          completed_episodes: projection.counts.completed_learned_policy_rollout_count,
          total_episodes: projection.counts.learned_policy_rollout_count,
        },
        completed_learned_episode_count:
          projection.counts.completed_learned_policy_rollout_count,
        completed_control_episode_count:
          projection.counts.completed_diagnostic_control_rollout_count,
        result_record_id: recordId,
        policy_run_result_projection: projection,
        delivery_digest: publication.result_delivery.delivery_digest,
        pipeline_observed_at_iso: now,
        updated_at_iso: now,
        ...(projection.blockers.length ? {
          error: {
            code: projection.blockers[0],
            message: projection.blockers.join(" · ").slice(0, 500),
          },
        } : { error: null }),
      };
      transaction.set(policyRunRef, update, { merge: true });
      transaction.set(offeringRef, {
        policy_canary_terminal_sync: {
          record_id: recordId,
          run_id: publication.run_id,
          request_digest: publication.request_digest,
          configuration_digest: publication.configuration_digest,
          projection_digest: publication.policy_canary_result.projection_digest,
          result_status: publication.result_status,
          updated_at_iso: now,
        },
        pipeline_run_state: publication.result_status,
        pipeline_run_projection_updated_at_iso: now,
      }, { merge: true });
      return { outcome, policyRun: { ...policyRun, ...update } };
    });
  } catch {
    return res.status(503).json({ error: "Task Evaluation policy canary store is unavailable" });
  }
  if (transactionResult.outcome === "offering_not_found") return res.status(404).json({ error: "Configured scene offering not found" });
  if (transactionResult.outcome === "offering_invalid") return res.status(409).json({ error: "Configured scene offering is not a valid controls-pending revision" });
  if (transactionResult.outcome === "policy_run_not_found") return res.status(404).json({ error: "Policy canary run not found" });
  if (transactionResult.outcome === "configuration_run_mismatch") return res.status(409).json({ error: "Configured scene configuration-run binding mismatch" });
  if (transactionResult.outcome === "owner_team_mismatch") return res.status(409).json({ error: "Policy canary owner or team binding mismatch" });
  if (transactionResult.outcome === "binding_mismatch") return res.status(409).json({ error: "Policy canary request or configuration binding mismatch" });
  if (transactionResult.outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable policy canary publication conflict" });
  if (!transactionResult.policyRun) return res.status(503).json({ error: "Policy canary run state is unavailable" });
  let notification: NotificationDelivery;
  try {
    notification = await dispatchCanaryTerminalNotification({
      policyRun: transactionResult.policyRun,
      policyRunRef,
      resultStatus: publication.result_status,
      runResultDigest: publication.policy_canary_result.projection_digest,
      resultUrl: evaluationResultWebsiteUrl(recordId),
    });
  } catch {
    return res.status(503).json({ error: "Policy canary notification receipt store is unavailable" });
  }
  res.set("Cache-Control", "no-store");
  return res.status(transactionResult.outcome === "created" ? 201 : 200).json({
    schema_version: "capture_task_evaluation_policy_canary_publication_receipt.v1",
    status: publication.result_status,
    already_exists: transactionResult.outcome === "replayed",
    capture_session_id: publication.capture_session_id,
    intake_id: publication.intake_id,
    run_id: publication.run_id,
    request_digest: publication.request_digest,
    configuration_digest: publication.configuration_digest,
    result_delivery_digest: publication.result_delivery.delivery_digest,
    policy_canary_projection_digest: publication.policy_canary_result.projection_digest,
    projection_digest: publication.policy_canary_result.projection_digest,
    notification_delivery: notification,
    proof_boundary: publication.proof_boundary,
  });
}

async function resolveBlockedPolicyRun(payload: PipelinePolicyCanaryPreproviderBlocked) {
  if (!db) return { status: "not_found" as const };
  const collection = db.collection("taskEvaluationPolicyRuns");
  const direct = await collection.doc(payload.activation_id).get();
  if (direct.exists) {
    const record = direct.data() as Record<string, any>;
    if (record.request_digest === payload.request_digest) {
      return { status: "found" as const, ref: collection.doc(payload.activation_id), record };
    }
  }
  const snapshot = await collection.where("request_digest", "==", payload.request_digest).limit(2).get();
  if (snapshot.docs.length > 1) return { status: "ambiguous" as const };
  if (snapshot.docs.length === 0) return { status: "not_found" as const };
  const document = snapshot.docs[0];
  return {
    status: "found" as const,
    ref: collection.doc(document.id),
    record: document.data() as Record<string, any>,
  };
}

async function handlePolicyCanaryPreproviderBlocked(
  payload: PipelinePolicyCanaryPreproviderBlocked,
  res: Response,
) {
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  let resolved;
  try {
    resolved = await resolveBlockedPolicyRun(payload);
  } catch {
    return res.status(503).json({ error: "Policy canary run lookup is unavailable" });
  }
  if (resolved.status === "not_found") return res.status(404).json({ error: "Policy canary run not found" });
  if (resolved.status === "ambiguous") return res.status(409).json({ error: "Policy canary request digest is ambiguous" });
  const policyRunRef = resolved.ref as FirebaseFirestore.DocumentReference;
  const offeringRef = db.collection("taskEvaluationLaunches").doc(payload.capture_session_id);
  const recordId = `capture-run-${createHash("sha256").update(`${payload.capture_session_id}\0${payload.activation_id}`).digest("hex").slice(0, 32)}`;
  const blockedRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  type Outcome = "created" | "replayed" | "offering_not_found" | "offering_invalid" | "policy_run_not_found" | "configuration_run_mismatch" | "owner_team_mismatch" | "binding_mismatch" | "immutable_conflict";
  let transactionResult: { outcome: Outcome; policyRun: Record<string, any> | null };
  try {
    transactionResult = await db.runTransaction(async (transaction) => {
      const [offeringSnapshot, policyRunSnapshot, blockedSnapshot] = await Promise.all([
        transaction.get(offeringRef), transaction.get(policyRunRef), transaction.get(blockedRef),
      ]);
      if (!offeringSnapshot.exists) return { outcome: "offering_not_found" as const, policyRun: null };
      if (!policyRunSnapshot.exists) return { outcome: "policy_run_not_found" as const, policyRun: null };
      const offeringRecord = offeringSnapshot.data() as Record<string, any>;
      const offering = configuredOffering(offeringRecord);
      if (!offering) return { outcome: "offering_invalid" as const, policyRun: null };
      const policyRun = policyRunSnapshot.data() as Record<string, any>;
      if (offering.configuration_run_id !== payload.intake_id) {
        return { outcome: "configuration_run_mismatch" as const, policyRun: null };
      }
      if (!policyRunBelongsToOffering(policyRun, offering, payload.capture_session_id)) {
        return { outcome: "owner_team_mismatch" as const, policyRun: null };
      }
      if (
        policyRun.run_kind !== "internal_policy_canary"
        || policyRun.request_digest !== payload.request_digest
      ) return { outcome: "binding_mismatch" as const, policyRun: null };
      const now = new Date().toISOString();
      const scope = offeringScope(policyRun, offering);
      const record = {
        schema_version: "capture_task_evaluation_policy_canary_preprovider_blocked_record.v1",
        record_id: recordId,
        owner_user_id: scope.ownerUserId,
        organization_id: scope.organizationId,
        access_visibility: scope.accessVisibility,
        created_at_iso: blockedSnapshot.exists
          ? String((blockedSnapshot.data() as Record<string, any>).created_at_iso || now)
          : now,
        updated_at_iso: now,
        preprovider_blocked: payload,
      };
      let outcome: "created" | "replayed" = "created";
      if (blockedSnapshot.exists) {
        const existing = blockedSnapshot.data() as Record<string, any>;
        if (stableJson(existing.preprovider_blocked) !== stableJson(payload)) {
          return { outcome: "immutable_conflict" as const, policyRun: null };
        }
        outcome = "replayed";
      } else {
        transaction.create(blockedRef, record);
      }
      const update = {
        state: "blocked",
        phase: "pre_provider_blocked",
        stage: "terminal",
        result_status: "blocked",
        preprovider_blocked: payload,
        blocked_record_id: recordId,
        error: {
          code: payload.blockers[0],
          message: payload.blockers.join(" · ").slice(0, 500),
        },
        pipeline_observed_at_iso: now,
        updated_at_iso: now,
      };
      transaction.set(policyRunRef, update, { merge: true });
      transaction.set(offeringRef, {
        policy_canary_preprovider_blocked_sync: {
          record_id: recordId,
          activation_id: payload.activation_id,
          run_id: String(policyRun.run_id || policyRunRef.id),
          request_digest: payload.request_digest,
          payload_digest: payload.payload_digest,
          result_status: "blocked",
          updated_at_iso: now,
        },
        pipeline_run_state: "blocked",
        pipeline_run_projection_updated_at_iso: now,
      }, { merge: true });
      return { outcome, policyRun: { ...policyRun, ...update } };
    });
  } catch {
    return res.status(503).json({ error: "Policy canary blocked receipt store is unavailable" });
  }
  if (transactionResult.outcome === "offering_not_found") return res.status(404).json({ error: "Configured scene offering not found" });
  if (transactionResult.outcome === "offering_invalid") return res.status(409).json({ error: "Configured scene offering is not a valid controls-pending revision" });
  if (transactionResult.outcome === "policy_run_not_found") return res.status(404).json({ error: "Policy canary run not found" });
  if (transactionResult.outcome === "configuration_run_mismatch") return res.status(409).json({ error: "Configured scene configuration-run binding mismatch" });
  if (transactionResult.outcome === "owner_team_mismatch") return res.status(409).json({ error: "Policy canary owner or team binding mismatch" });
  if (transactionResult.outcome === "binding_mismatch") return res.status(409).json({ error: "Policy canary request binding mismatch" });
  if (transactionResult.outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable pre-provider blocker conflict" });
  if (!transactionResult.policyRun) return res.status(503).json({ error: "Policy canary run state is unavailable" });
  let notification: NotificationDelivery;
  try {
    notification = await dispatchCanaryTerminalNotification({
      policyRun: transactionResult.policyRun,
      policyRunRef,
      resultStatus: "blocked",
      runResultDigest: payload.payload_digest,
      resultUrl: authenticatedRunUrl(String(transactionResult.policyRun.run_id || resolved.ref.id)),
    });
  } catch {
    return res.status(503).json({ error: "Policy canary notification receipt store is unavailable" });
  }
  res.set("Cache-Control", "no-store");
  return res.status(transactionResult.outcome === "created" ? 201 : 200).json({
    schema_version: "capture_task_evaluation_policy_canary_blocked_receipt.v1",
    status: "blocked",
    already_exists: transactionResult.outcome === "replayed",
    activation_id: payload.activation_id,
    capture_session_id: payload.capture_session_id,
    intake_id: payload.intake_id,
    run_id: String(transactionResult.policyRun.run_id || resolved.ref.id),
    request_digest: payload.request_digest,
    payload_digest: payload.payload_digest,
    notification_delivery: notification,
  });
}

router.post("/capture-task-evaluation-runs", rateLimiter, requirePipelineSignature, async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  if (req.body?.schema_version === "task_evaluation_policy_canary_preprovider_blocked.v1") {
    const blocked = parsePipelinePolicyCanaryPreproviderBlocked(req.body);
    if (!blocked.ok) return res.status(400).json({
      error: "Pipeline policy canary pre-provider blocker is invalid",
      blockers: blocked.blockers,
    });
    return handlePolicyCanaryPreproviderBlocked(blocked.payload, res);
  }
  if (
    req.body?.schema_version === "task_evaluation_run_publication.v4"
    && req.body?.run_kind === "internal_policy_canary"
  ) {
    const canary = parsePipelinePolicyCanaryPublication(req.body);
    if (!canary.ok) return res.status(400).json({
      error: "Pipeline policy canary publication is invalid",
      blockers: canary.blockers,
    });
    return handlePolicyCanaryPublication(canary.publication, res);
  }
  const verified = parseVerifiedTaskEvaluationRunPublication(req.body);
  if (!verified.ok) return res.status(400).json({ error: "Pipeline run publication is invalid", blockers: verified.blockers });
  const publication = verified.publication;
  const sessionRef = db.collection("captureUploadSessions").doc(publication.capture_session_id);
  const recordId = `capture-run-${createHash("sha256").update(`${publication.capture_session_id}\0${publication.run_id}`).digest("hex").slice(0, 32)}`;
  const runRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  const policyRunRef = publication.schema_version === "task_evaluation_run_publication.v3"
    ? db.collection("taskEvaluationPolicyRuns").doc(publication.run_id)
    : null;
  type Outcome = "created" | "updated" | "replayed" | "not_found" | "intake_mismatch" | "testbed_mismatch" | "policy_run_not_found" | "policy_run_mismatch" | "immutable_conflict";
  let outcome: Outcome;
  try {
    outcome = await db.runTransaction<Outcome>(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      const runSnapshot = await transaction.get(runRef);
      const policyRunSnapshot = policyRunRef ? await transaction.get(policyRunRef) : null;
      if (!sessionSnapshot.exists) return "not_found";
      if (policyRunRef && !policyRunSnapshot?.exists) return "policy_run_not_found";
      const session = sessionSnapshot.data() as Record<string, any>;
      if (session.request?.intake_id !== publication.intake_id) return "intake_mismatch";
      if (session.pipeline_site_task_testbed?.testbed_digest !== publication.testbed_digest) return "testbed_mismatch";
      const organizationId = String(session.organization_id || `user:${session.owner_user_id}`);
      const accessVisibility = session.organization_binding_status === "firebase_tenant_verified"
        ? "organization_members"
        : "owner_only";
      const policyRun = policyRunSnapshot?.data() as Record<string, any> | undefined;
      if (
        publication.schema_version === "task_evaluation_run_publication.v3"
        && (
          policyRun?.source_launch_id !== publication.policy_run_result.source_launch_id
          || policyRun?.offering_digest !== publication.policy_run_result.offering_digest
          || policyRun?.configuration_digest
            !== publication.policy_run_result.configuration_digest
          || policyRun?.team_namespace !== organizationId
        )
      ) return "policy_run_mismatch";
      const now = new Date().toISOString();
      const record = {
        schema_version: "capture_task_evaluation_run_record.v2",
        record_id: recordId,
        owner_user_id: String(session.owner_user_id || ""),
        organization_id: organizationId,
        access_visibility: accessVisibility,
        created_at_iso: runSnapshot.exists
          ? String((runSnapshot.data() as Record<string, any>)?.created_at_iso || now)
          : now,
        updated_at_iso: now,
        publication,
      };
      let recordOutcome: "created" | "updated" | "replayed" = "created";
      if (runSnapshot.exists) {
        const existing = runSnapshot.data() as Record<string, any>;
        const exactReplay = stableJson(existing.publication) === stableJson(publication);
        if (exactReplay) {
          record.updated_at_iso = String(existing.updated_at_iso || record.created_at_iso);
          recordOutcome = "replayed";
        } else {
          const existingDelivery = existing.publication?.result_delivery;
          const nextDelivery = (publication as Record<string, any>).result_delivery;
          const monotonicEvidenceUpgrade = sameScientificIdentity(existing.publication || {}, publication)
            && (!existingDelivery || existingDelivery.status === "blocked")
            && nextDelivery?.status === "ready";
          if (!monotonicEvidenceUpgrade) return "immutable_conflict";
          recordOutcome = "updated";
        }
      }
      if (recordOutcome === "created") transaction.create(runRef, record);
      if (recordOutcome === "updated") transaction.set(runRef, record);
      transaction.set(sessionRef, {
        pipeline_task_evaluation_run: record,
        pipeline_run_state: publication.state,
        pipeline_run_projection_updated_at_iso: new Date().toISOString(),
      }, { merge: true });
      if (
        policyRunRef
        && publication.schema_version === "task_evaluation_run_publication.v3"
      ) transaction.set(policyRunRef, {
        state: publication.state === "abstained" ? "abstained" : "results_ready",
        phase: "published",
        progress: {
          completed_episodes: publication.policy_run_result.matrix.completed_episode_count,
          total_episodes: publication.policy_run_result.matrix.expected_episode_count,
        },
        result_record_id: recordId,
        policy_run_result: publication.policy_run_result,
        delivery_digest: publication.result_delivery.delivery_digest,
        pipeline_observed_at_iso: now,
        updated_at_iso: now,
      }, { merge: true });
      return recordOutcome;
    });
  } catch {
    return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  }
  if (outcome === "not_found") return res.status(404).json({ error: "Capture upload not found" });
  if (outcome === "intake_mismatch") return res.status(409).json({ error: "Capture intake binding mismatch" });
  if (outcome === "testbed_mismatch") return res.status(409).json({ error: "Current testbed digest mismatch" });
  if (outcome === "policy_run_not_found") return res.status(404).json({ error: "Evaluation Ready policy run not found" });
  if (outcome === "policy_run_mismatch") return res.status(409).json({ error: "Evaluation Ready policy-run binding mismatch" });
  if (outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable Task Evaluation Run conflict" });
  res.set("Cache-Control", "no-store");
  const resultDeliveryDigest = (
    publication.schema_version === "task_evaluation_run_publication.v2"
    || publication.schema_version === "task_evaluation_run_publication.v3"
  )
    ? publication.result_delivery.delivery_digest
    : undefined;
  const policyRunProjectionDigest = publication.schema_version
    === "task_evaluation_run_publication.v3"
    ? publication.policy_run_result.projection_digest
    : undefined;
  if (publication.schema_version === "task_evaluation_run_publication.v3" && policyRunRef) {
    const snapshot = await policyRunRef.get();
    const policyRun = snapshot.data() as Record<string, any> | undefined;
    const resultUrl = evaluationResultWebsiteUrl(recordId);
    await dispatchTransactionalNotification({
      eventType: "evaluation_results_ready",
      recipientType: "buyer",
      recipientUserId: String(policyRun?.notification_recipient_user_id || ""),
      subjectId: publication.run_id,
      sourceEventId: String(
        policyRun?.notification_source_event_id || policyRun?.configuration_digest,
      ),
      sourceCollection: "taskEvaluationPolicyRuns",
      sourceDocId: publication.run_id,
      title: "Blueprint evaluation results are ready",
      body: "Your Task Evaluation Run results are ready in Blueprint.",
      emailSubject: "Your Blueprint evaluation results are ready",
      emailText: `Your Task Evaluation Run results are ready: ${resultUrl}`,
      preferenceKey: "account",
      data: {
        run_id: publication.run_id,
        result_record_id: recordId,
        result_url: resultUrl,
      },
    });
  }
  return res.status(outcome === "created" ? 201 : 200).json({
    schema_version: "capture_task_evaluation_run_publication_receipt.v1",
    status: publication.state,
    already_exists: outcome === "replayed",
    capture_session_id: publication.capture_session_id,
    intake_id: publication.intake_id,
    run_id: publication.run_id,
    testbed_digest: publication.testbed_digest,
    request_digest: publication.request_digest,
    plan_digest: publication.plan_digest,
    decision_envelope_digest: publication.decision_envelope.decision_envelope_digest,
    ...(resultDeliveryDigest ? { result_delivery_digest: resultDeliveryDigest } : {}),
    ...(policyRunProjectionDigest ? { policy_run_projection_digest: policyRunProjectionDigest } : {}),
    proof_boundary: publication.proof_boundary,
  });
});

export default router;
