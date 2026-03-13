import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  DERIVED_ASSET_KEYS,
  DERIVED_ASSET_STATUSES,
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import { logger } from "../logger";
import { parsePipelineAttachmentSyncPayload } from "../utils/pipelineAttachmentContract";
import type {
  DerivedAssetEntry,
  DerivedAssetsAttachment,
  OpportunityState,
  PipelineAttachment,
  PipelineArtifacts,
  QualificationState,
} from "../types/inbound-request";
import { ZodError } from "zod";

const router = Router();

function isQualificationState(value: string): value is QualificationState {
  return (QUALIFICATION_STATES as readonly string[]).includes(value);
}

function isOpportunityState(value: string): value is OpportunityState {
  return (OPPORTUNITY_STATES as readonly string[]).includes(value);
}

function isDerivedAssetStatus(
  value: string
): value is DerivedAssetEntry["status"] {
  return (DERIVED_ASSET_STATUSES as readonly string[]).includes(value);
}

function requirePipelineToken(req: Request, res: Response, next: () => void) {
  const expected = (process.env.PIPELINE_SYNC_TOKEN || "").trim();
  const provided = String(req.header("X-Blueprint-Pipeline-Token") || "").trim();
  if (!expected || provided != expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function buildPipelineAttachment(
  body: Record<string, unknown>,
  current?: PipelineAttachment
): PipelineAttachment {
  const artifacts = body.artifacts && typeof body.artifacts === "object" ? body.artifacts : {};
  return {
    scene_id: String(body.scene_id || current?.scene_id || ""),
    capture_id: String(body.capture_id || current?.capture_id || ""),
    pipeline_prefix: String(body.pipeline_prefix || current?.pipeline_prefix || ""),
    artifacts: {
      ...(current?.artifacts || {}),
      ...(artifacts as PipelineArtifacts),
    },
    synced_at: admin.firestore.FieldValue.serverTimestamp() as never,
  };
}

function buildDerivedAssets(
  body: Record<string, unknown>,
  current?: DerivedAssetsAttachment
): DerivedAssetsAttachment | undefined {
  const derivedAssets = body.derived_assets;
  if (!derivedAssets || typeof derivedAssets !== "object") {
    return current;
  }

  const next: DerivedAssetsAttachment = {
    ...(current || {}),
  };

  for (const key of DERIVED_ASSET_KEYS) {
    const rawEntry = (derivedAssets as Record<string, unknown>)[key];
    if (rawEntry == null) {
      continue;
    }

    if (typeof rawEntry !== "object") {
      throw new Error(`derived_assets.${key} must be an object`);
    }

    const status = String((rawEntry as Record<string, unknown>).status || "").trim();
    if (!isDerivedAssetStatus(status)) {
      throw new Error(`derived_assets.${key}.status is invalid`);
    }

    const previousEntry = current?.[key];
    const rawUpdatedAt = (rawEntry as Record<string, unknown>).updated_at;
    next[key] = {
      ...(previousEntry || {}),
      ...(rawEntry as DerivedAssetEntry),
      status,
      ...(rawUpdatedAt !== undefined ? { updated_at: rawUpdatedAt as never } : {}),
    };
  }

  next.synced_at = admin.firestore.FieldValue.serverTimestamp() as never;
  return next;
}

router.post("/attachments", requirePipelineToken, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsedBody = parsePipelineAttachmentSyncPayload(body);
    const siteSubmissionId = String(parsedBody.site_submission_id || "").trim();
    const requestId = String(parsedBody.request_id || "").trim();
    const authoritativeStateUpdate = parsedBody.authoritative_state_update === true;
    const qualificationState = String(parsedBody.qualification_state || "").trim();
    const opportunityState = String(parsedBody.opportunity_state || "").trim();

    if (!siteSubmissionId && !requestId) {
      return res.status(400).json({ error: "site_submission_id or request_id is required" });
    }

    let docRef: FirebaseFirestore.DocumentReference | null = null;
    let currentData: Record<string, unknown> | null = null;
    if (siteSubmissionId) {
      const snapshot = await db
        .collection("inboundRequests")
        .where("site_submission_id", "==", siteSubmissionId)
        .limit(1)
        .get();
      const matchedDoc = snapshot.docs[0];
      docRef = matchedDoc?.ref ?? null;
      currentData = (matchedDoc?.data?.() as Record<string, unknown>) ?? null;
    }
    if (!docRef && requestId) {
      const fallbackRef = db.collection("inboundRequests").doc(requestId);
      const doc = await fallbackRef.get();
      if (doc.exists) {
        docRef = fallbackRef;
        currentData = (doc.data() as Record<string, unknown>) ?? null;
      }
    }
    if (!docRef) {
      return res.status(404).json({ error: "Inbound request not found" });
    }

    if (authoritativeStateUpdate && !isQualificationState(qualificationState)) {
      return res.status(400).json({ error: "Valid qualification_state is required" });
    }

    if (opportunityState && !isOpportunityState(opportunityState)) {
      return res.status(400).json({ error: "Invalid opportunity_state" });
    }

    const pipeline = buildPipelineAttachment(parsedBody, currentData?.pipeline as PipelineAttachment);
    const derivedAssets = buildDerivedAssets(
      parsedBody,
      currentData?.derived_assets as DerivedAssetsAttachment | undefined
    );
    const nextQualificationState = authoritativeStateUpdate
      ? (qualificationState as QualificationState)
      : String(
          currentData?.qualification_state || currentData?.status || ""
        ).trim();
    const nextOpportunityState =
      authoritativeStateUpdate && opportunityState
        ? (opportunityState as OpportunityState)
        : (String(currentData?.opportunity_state || "").trim() as OpportunityState);

    const updatePayload: Record<string, unknown> = {
      pipeline,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (derivedAssets) {
      updatePayload.derived_assets = derivedAssets;
    }

    if (authoritativeStateUpdate) {
      updatePayload.status = nextQualificationState;
      updatePayload.qualification_state = nextQualificationState;
      updatePayload.opportunity_state = nextOpportunityState;
    }

    await docRef.update(updatePayload);

    return res.json({
      ok: true,
      requestId: docRef.id,
      site_submission_id: siteSubmissionId || requestId,
      qualification_state: nextQualificationState,
      opportunity_state: nextOpportunityState,
      pipeline,
      derived_assets: derivedAssets,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid pipeline attachment payload" });
    }
    logger.error({ error }, "Failed to attach pipeline metadata");
    return res.status(500).json({ error: "Failed to attach pipeline metadata" });
  }
});

export default router;
