import { z } from "zod";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { MAX_RESULT_NOTIFICATION_ATTEMPTS, ResultNotificationRetryError, retryTaskEvaluationResultNotification } from "../utils/taskEvaluationNotificationRetry";
import { projectCorrectedScoringContract } from "../utils/taskEvaluationCorrectedScoringContract";
import { projectWebsiteResultNotification } from "../utils/taskEvaluationResultNotification";
import { resultArtifactMetadata } from "../utils/taskEvaluationArtifactIntegrity";
import { Router, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { resolveAccessContext } from "../utils/access-control";
import { taskEvaluationResultAccessAllowed } from "../utils/taskEvaluationResultAccess";
import { taskEvaluationResultArtifactAdmission } from "../utils/taskEvaluationResultArtifactAdmission";
import {
  probeTaskEvaluationResultArtifact,
  streamTaskEvaluationResultArtifact,
} from "../utils/taskEvaluationResultArtifactProxy";
import { createTaskEvaluationResultDownloadTicket } from "../utils/taskEvaluationResultDownloadTicket";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { publicationFromResultRecord } from "../utils/taskEvaluationRunPublicationStorage";
import {
  publicPolicyCanaryScoreCorrectionAudit,
  verifiedPolicyCanaryScoreCorrectionSidecar,
} from "../utils/policyCanaryScoreCorrectionContract";
import {
  verifiedPolicyCanaryEpisodeInterpretationSidecar,
} from "../utils/policyCanaryEpisodeInterpretationSidecar";

const router = Router();

type ResultRecord = Record<string, any> & {
  record_id: string;
  owner_user_id: string;
  organization_id: string;
  access_visibility: "owner_only" | "organization_members" | "unlisted_public";
  publication: Record<string, any>;
  publication_storage?: Record<string, any>;
};

function firebaseTenantId(res: Response) {
  const user = res.locals.firebaseUser as { tenantId?: string; tenant_id?: string } | undefined;
  return String(user?.tenantId || user?.tenant_id || "").trim();
}

async function accessFor(record: ResultRecord, res: Response) {
  const access = await resolveAccessContext(res);
  const tenantId = firebaseTenantId(res);
  const privateAudience = Boolean(access.uid) && (
    access.isOps
    || record.owner_user_id === access.uid
    || (
      record.access_visibility === "organization_members"
      && Boolean(tenantId)
      && record.organization_id === tenantId
    )
  );
  return {
    allowed: taskEvaluationResultAccessAllowed(record, {
      uid: access.uid,
      tenantId,
      isOps: access.isOps,
    }),
    access,
    privateAudience,
  };
}

function publicRecord(record: ResultRecord, options: { publicAudience?: boolean } = {}) {
  const publication = structuredClone(record.publication);
  const scoreCorrectionCandidate = verifiedPolicyCanaryScoreCorrectionSidecar(
    record.policy_canary_score_correction,
  );
  const scoreCorrection = scoreCorrectionCandidate
    && scoreCorrectionCandidate.correction.source_run_id === publication.run_id
    && scoreCorrectionCandidate.source_binding.source_projection_digest === publication.policy_canary_result?.projection_digest
    && scoreCorrectionCandidate.source_binding.source_delivery_digest === publication.result_delivery?.delivery_digest
    ? scoreCorrectionCandidate : null;
  const correctedScoringContract = projectCorrectedScoringContract(publication, scoreCorrection);
  const scoreCorrectionAudit = publicPolicyCanaryScoreCorrectionAudit(
    record.policy_canary_score_correction,
    record.policy_canary_score_correction_history,
  );
  const interpretationCandidate = verifiedPolicyCanaryEpisodeInterpretationSidecar(
    record.policy_canary_episode_interpretation,
  );
  const episodeInterpretation = interpretationCandidate
    && interpretationCandidate.source_binding.record_id === record.record_id
    && interpretationCandidate.source_binding.source_run_id === publication.run_id
    && interpretationCandidate.source_binding.source_projection_digest
      === publication.policy_canary_result?.projection_digest
    && interpretationCandidate.source_binding.source_delivery_digest
      === publication.result_delivery?.delivery_digest
    && interpretationCandidate.source_binding.source_score_correction_sidecar_digest
      === (record.policy_canary_score_correction?.sidecar_digest || null)
    ? interpretationCandidate
    : null;
  if (options.publicAudience) {
    delete publication.submitted_by;
    delete publication.team_namespace;
    delete publication.notification_delivery;
    if (publication.policy_canary_result) delete publication.policy_canary_result.notification_delivery;
    publication.access_visibility = "unlisted_public";
  }
  return {
    schema_version: "task_evaluation_result_site_record.v1",
    record_id: record.record_id,
    organization_id: options.publicAudience ? "unlisted" : record.organization_id,
    access_visibility: record.access_visibility,
    created_at_iso: record.created_at_iso,
    updated_at_iso: record.updated_at_iso,
    publication,
    ...(scoreCorrection ? { score_correction: scoreCorrection } : {}),
    ...(correctedScoringContract ? { corrected_scoring_contract: correctedScoringContract } : {}),
    ...(scoreCorrectionAudit ? { score_correction_audit: scoreCorrectionAudit } : {}),
    ...(episodeInterpretation ? { episode_interpretation: episodeInterpretation } : {}),
  };
}

async function readResultRecord(recordId: string): Promise<ResultRecord | null> {
  if (!db || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(recordId)) return null;
  const snapshot = await db.collection("captureTaskEvaluationRuns").doc(recordId).get();
  if (!snapshot.exists) return null;
  const raw = snapshot.data() as ResultRecord;
  const publication = publicationFromResultRecord(raw);
  const verified = parseVerifiedTaskEvaluationRunPublication(publication);
  if (!verified.ok) return null;
  const [historySnapshot, interpretationSnapshot] = await Promise.all([
    db.collection("taskEvaluationPolicyCanaryScoreCorrectionHistories").doc(recordId).get(),
    db.collection("taskEvaluationPolicyCanaryEpisodeInterpretations").doc(recordId).get(),
  ]);
  return {
    ...raw,
    record_id: recordId,
    publication: verified.publication,
    ...(historySnapshot.exists ? {
      policy_canary_score_correction_history: historySnapshot.data(),
    } : {}),
    ...(interpretationSnapshot.exists ? {
      policy_canary_episode_interpretation: interpretationSnapshot.data(),
    } : {}),
  };
}

router.get("/", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  const access = await resolveAccessContext(res);
  if (!access.uid) return res.status(401).json({ error: "Authentication required" });
  const tenantId = firebaseTenantId(res);
  try {
    let snapshot;
    if (access.isOps) {
      snapshot = await db.collection("captureTaskEvaluationRuns").limit(250).get();
    } else if (tenantId) {
      snapshot = await db.collection("captureTaskEvaluationRuns")
        .where("organization_id", "==", tenantId).limit(250).get();
    } else {
      snapshot = await db.collection("captureTaskEvaluationRuns")
        .where("owner_user_id", "==", access.uid).limit(250).get();
    }
    const records: ReturnType<typeof publicRecord>[] = [];
    for (const document of snapshot.docs) {
      const raw = { ...document.data(), record_id: document.id } as ResultRecord;
      const publication = publicationFromResultRecord(raw);
      const verified = parseVerifiedTaskEvaluationRunPublication(publication);
      const allowed = taskEvaluationResultAccessAllowed(raw, {
        uid: access.uid,
        tenantId,
        isOps: access.isOps,
      });
      if (allowed && verified.ok) {
        records.push(publicRecord({ ...raw, publication: verified.publication }));
      }
    }
    records.sort((left, right) => String(right.updated_at_iso || "").localeCompare(String(left.updated_at_iso || "")));
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_result_site_list.v1",
      scope: access.isOps ? "blueprint_operations" : tenantId ? "organization" : "owner",
      public_leaderboard: false,
      results: records,
    });
  } catch {
    return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  }
});

router.get("/:recordId", async (req, res) => {
  let record: ResultRecord | null;
  try {
    record = await readResultRecord(req.params.recordId);
  } catch {
    return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  }
  if (!record) return res.status(404).json({ error: "Task Evaluation Result not found" });
  const permission = await accessFor(record, res);
  if (!permission.allowed) return res.status(404).json({ error: "Task Evaluation Result not found" });
  res.set("Cache-Control", "private, no-store");
  let websiteDelivery;
  if (permission.privateAudience && record.publication.run_kind === "internal_policy_canary") {
    try {
      const snapshot = await db!.collection("taskEvaluationPolicyRuns").doc(record.publication.run_id).get();
      const notification = projectWebsiteResultNotification(record, snapshot.exists ? snapshot.data() : undefined);
      const run = snapshot.exists ? snapshot.data() : undefined;
      const retryState = ["dispatching", "accepted", "failed", "unknown"].includes(run?.notification_retry?.status) ? run!.notification_retry.status : null;
      websiteDelivery = { status: notification ? "available" : "unbound", notification, retry_state: retryState,
        can_retry_email: notification?.status === "failed" && notification.attempts < MAX_RESULT_NOTIFICATION_ATTEMPTS
          && retryState !== "dispatching" && retryState !== "unknown"
          && (permission.access.isOps || record.owner_user_id === permission.access.uid),
      };
    } catch {
      // A notification-store outage must not hide the sealed scientific result.
      websiteDelivery = { status: "unavailable", notification: null };
    }
  }
  return res.status(200).json({ ...publicRecord(record, {
    publicAudience: !permission.privateAudience,
  }), ...(websiteDelivery ? { website_delivery: websiteDelivery } : {}) });
});

const notificationRetryRequest = z.object({
  request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  expected_result_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  authorize_email_retry: z.literal(true),
}).strict();

router.post("/:recordId/notification-retries", verifyFirebaseToken, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  if (!db) return res.status(503).json({ error: "Result notification store is unavailable" });
  const parsed = notificationRetryRequest.safeParse(req.body);
  if (!parsed.success || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(req.params.recordId)) return res.status(400).json({ error: "Explicit digest-bound email retry authorization is required" });
  const access = await resolveAccessContext(res);
  if (!access.uid) return res.status(401).json({ error: "Authentication required" });
  try {
    const receipt = await retryTaskEvaluationResultNotification({ db, recordId: req.params.recordId,
      requestId: parsed.data.request_id, expectedDigest: parsed.data.expected_result_digest,
      actor: { uid: access.uid, isOps: access.isOps } });
    return res.status(receipt.status === "dispatching" ? 202 : 200).json(receipt);
  } catch (error) {
    if (error instanceof ResultNotificationRetryError) return res.status(error.status).json({ error: error.code });
    return res.status(503).json({ error: "Result notification retry is unavailable; keep the same request identifier when checking again" });
  }
});

router.get("/:recordId/artifacts/:artifactId", async (req, res) => {
  let record: ResultRecord | null;
  try {
    record = await readResultRecord(req.params.recordId);
  } catch {
    return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  }
  if (!record) return res.status(404).json({ error: "Task Evaluation Result not found" });
  const permission = await accessFor(record, res);
  if (!permission.allowed) return res.status(404).json({ error: "Task Evaluation Result not found" });
  const metadata = resultArtifactMetadata(record.publication, req.params.artifactId);
  if (metadata.status === "invalid") return res.status(404).json({ error: "Result artifact metadata is invalid" });
  const admission = taskEvaluationResultArtifactAdmission(
    record.publication,
    req.params.artifactId,
  );
  if (admission === "denied") {
    return res.status(404).json({ error: "Result artifact not found" });
  }
  await streamTaskEvaluationResultArtifact({
    runId: record.publication.run_id,
    artifactId: req.params.artifactId,
    expected: metadata.status === "known" ? metadata.metadata : undefined,
    req,
    res,
  });
});

router.post("/:recordId/artifacts/:artifactId/ticket", async (req, res) => {
  let record: ResultRecord | null;
  try {
    record = await readResultRecord(req.params.recordId);
  } catch {
    return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  }
  if (!record) return res.status(404).json({ error: "Task Evaluation Result not found" });
  const permission = await accessFor(record, res);
  if (!permission.allowed) return res.status(404).json({ error: "Task Evaluation Result not found" });
  const metadata = resultArtifactMetadata(record.publication, req.params.artifactId);
  if (metadata.status === "invalid") return res.status(404).json({ error: "Result artifact metadata is invalid" });
  const admission = taskEvaluationResultArtifactAdmission(
    record.publication,
    req.params.artifactId,
  );
  if (admission === "denied") {
    return res.status(404).json({ error: "Result artifact not found" });
  }
  if (admission === "pipeline_run_registry") {
    const registryAdmission = await probeTaskEvaluationResultArtifact({
      runId: record.publication.run_id,
      artifactId: req.params.artifactId,
      expected: metadata.status === "known" ? metadata.metadata : undefined,
    });
    if (registryAdmission === "not_found") {
      return res.status(404).json({ error: "Result artifact not found" });
    }
    if (registryAdmission !== "admitted") {
      return res.status(503).json({ error: "Result artifact registry is unavailable" });
    }
  }
  const ticket = createTaskEvaluationResultDownloadTicket(record.record_id, req.params.artifactId);
  if (!ticket) return res.status(503).json({ error: "Result download tickets are not configured" });
  const query = new URLSearchParams({
    expires: String(ticket.expires),
    signature: ticket.signature,
  });
  res.set("Cache-Control", "private, no-store");
  return res.status(201).json({
    schema_version: "task_evaluation_result_download_ticket.v1",
    expires_at_unix: ticket.expires,
    download_url: `/api/task-evaluation-result-downloads/${encodeURIComponent(record.record_id)}/${encodeURIComponent(req.params.artifactId)}?${query}`,
  });
});

export default router;
