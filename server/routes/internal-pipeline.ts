import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type {
  DerivedAssetsAttachment,
  OpportunityState,
  PipelineAttachment,
  PipelineArtifacts,
  QualificationState,
} from "../types/inbound-request";

const router = Router();

function requirePipelineToken(req: Request, res: Response, next: () => void) {
  const expected = (process.env.PIPELINE_SYNC_TOKEN || "").trim();
  const provided = String(req.header("X-Blueprint-Pipeline-Token") || "").trim();
  if (!expected || provided != expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function buildPipelineAttachment(body: Record<string, unknown>): PipelineAttachment {
  const artifacts = body.artifacts && typeof body.artifacts === "object" ? body.artifacts : {};
  return {
    scene_id: String(body.scene_id || ""),
    capture_id: String(body.capture_id || ""),
    pipeline_prefix: String(body.pipeline_prefix || ""),
    artifacts: { ...(artifacts as PipelineArtifacts) },
    synced_at: admin.firestore.FieldValue.serverTimestamp() as never,
  };
}

function buildDerivedAssets(body: Record<string, unknown>): DerivedAssetsAttachment | undefined {
  const derivedAssets =
    body.derived_assets && typeof body.derived_assets === "object" ? body.derived_assets : null;
  if (!derivedAssets) {
    return undefined;
  }
  return {
    ...(derivedAssets as DerivedAssetsAttachment),
    synced_at: admin.firestore.FieldValue.serverTimestamp() as never,
  };
}

router.post("/attachments", requirePipelineToken, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const siteSubmissionId = String(body.site_submission_id || "").trim();
    const requestId = String(body.request_id || "").trim();
    const qualificationState = String(body.qualification_state || "").trim() as QualificationState;
    const opportunityState = String(body.opportunity_state || "").trim() as OpportunityState;

    if (!siteSubmissionId && !requestId) {
      return res.status(400).json({ error: "site_submission_id or request_id is required" });
    }

    let docRef: FirebaseFirestore.DocumentReference | null = null;
    if (siteSubmissionId) {
      const snapshot = await db
        .collection("inboundRequests")
        .where("site_submission_id", "==", siteSubmissionId)
        .limit(1)
        .get();
      docRef = snapshot.docs[0]?.ref ?? null;
    }
    if (!docRef && requestId) {
      const fallbackRef = db.collection("inboundRequests").doc(requestId);
      const doc = await fallbackRef.get();
      if (doc.exists) {
        docRef = fallbackRef;
      }
    }
    if (!docRef) {
      return res.status(404).json({ error: "Inbound request not found" });
    }

    const pipeline = buildPipelineAttachment(body);
    const derivedAssets = buildDerivedAssets(body);
    await docRef.update({
      status: qualificationState,
      qualification_state: qualificationState,
      opportunity_state: opportunityState,
      pipeline,
      ...(derivedAssets ? { derived_assets: derivedAssets } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      ok: true,
      requestId: docRef.id,
      site_submission_id: siteSubmissionId || requestId,
      qualification_state: qualificationState,
      opportunity_state: opportunityState,
      pipeline,
      derived_assets: derivedAssets,
    });
  } catch (error) {
    logger.error({ error }, "Failed to attach pipeline metadata");
    return res.status(500).json({ error: "Failed to attach pipeline metadata" });
  }
});

export default router;
