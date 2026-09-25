import { Router } from "express";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { resolveAccessContext } from "../utils/access-control";
import { nativeG1ReviewArtifacts, parseNativeG1PrivateReview } from "../utils/nativeG1PrivateReview";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { probeTaskEvaluationResultArtifact, streamTaskEvaluationResultArtifact } from "../utils/taskEvaluationResultArtifactProxy";
import { createTaskEvaluationResultDownloadTicket, verifyTaskEvaluationResultDownloadTicket } from "../utils/taskEvaluationResultDownloadTicket";

const router = Router();
export const nativeG1PrivateReviewIngestRouter = Router();
const collection = "nativeG1PrivateReviews";
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const ingestSchema = z.object({
  schema_version: z.literal("native_g1_private_review_ingest.v1"),
  run_id: identifier,
  owner_user_id: identifier,
  organization_id: identifier,
  review: z.unknown(),
}).strict();

type StoredReview = {
  run_id: string;
  owner_user_id: string;
  organization_id: string;
  access_visibility: "owner_only";
  review: NonNullable<ReturnType<typeof parseNativeG1PrivateReview>>;
  created_at_iso: string;
};

async function readReview(runId: string): Promise<StoredReview | null> {
  if (!db || !identifier.safeParse(runId).success) return null;
  const snapshot = await db.collection(collection).doc(runId).get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() as StoredReview;
  const review = parseNativeG1PrivateReview(value.review);
  if (!review || value.run_id !== runId || value.access_visibility !== "owner_only") return null;
  return { ...value, review };
}

async function authorizedReview(runId: string, res: Parameters<typeof resolveAccessContext>[0]) {
  const review = await readReview(runId);
  if (!review) return null;
  const actor = await resolveAccessContext(res);
  return actor.uid && (actor.isOps || actor.uid === review.owner_user_id) ? review : null;
}

function artifactFor(review: StoredReview, artifactId: string) {
  return nativeG1ReviewArtifacts(review.review).find((row) => row.artifact_id === artifactId);
}

nativeG1PrivateReviewIngestRouter.post("/native-g1-reviews", createPipelineSyncRateLimiter(), async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const authentication = verifyPipelineSyncRequest(req);
  if (!authentication.ok || !req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature")) {
    return res.status(401).json({ error: "Signed Pipeline request required" });
  }
  const payload = ingestSchema.safeParse(req.body);
  const review = payload.success ? parseNativeG1PrivateReview(payload.data.review) : null;
  if (!payload.success || !review) return res.status(400).json({ error: "Verified private G1 review required" });
  if (!db) return res.status(503).json({ error: "Private review store is unavailable" });
  const { run_id: runId, owner_user_id: ownerId, organization_id: organizationId } = payload.data;
  // The artifact registry is the authority for downloadable bytes. A result
  // cannot be published to a team account while any bound file is unavailable.
  const admissions = await Promise.all(nativeG1ReviewArtifacts(review).map((artifact) =>
    probeTaskEvaluationResultArtifact({
      runId, artifactId: artifact.artifact_id,
      expected: { sha256: artifact.sha256, size_bytes: artifact.size_bytes },
    }),
  ));
  if (admissions.some((admitted) => admitted !== "admitted")) {
    return res.status(503).json({ error: "G1 review artifact is unavailable" });
  }
  const record: StoredReview = {
    run_id: runId,
    owner_user_id: ownerId,
    organization_id: organizationId,
    access_visibility: "owner_only",
    review,
    created_at_iso: new Date().toISOString(),
  };
  try {
    const existing = await readReview(runId);
    if (existing) {
      if (existing.owner_user_id !== ownerId || existing.organization_id !== organizationId
        || existing.review.review_digest !== review.review_digest) {
        return res.status(409).json({ error: "G1 review identity conflict" });
      }
      return res.status(200).json({ status: "already_ingested", run_id: runId, review_digest: review.review_digest });
    }
    await db.collection(collection).doc(runId).create(record);
    return res.status(201).json({ status: "ingested", run_id: runId, review_digest: review.review_digest,
      review_url: `/app/g1-reviews/${encodeURIComponent(runId)}` });
  } catch {
    return res.status(503).json({ error: "Private review store is unavailable" });
  }
});

router.get("/", async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  const actor = await resolveAccessContext(res);
  if (!actor.uid) return res.status(401).json({ error: "Authentication required" });
  if (!db) return res.status(503).json({ error: "Private review store is unavailable" });
  try {
    const snapshot = await db.collection(collection).where("owner_user_id", "==", actor.uid).limit(50).get();
    const reviews = snapshot.docs.map((doc) => {
      const record = doc.data() as StoredReview;
      const review = parseNativeG1PrivateReview(record.review);
      return review && record.run_id === doc.id && record.access_visibility === "owner_only"
        ? { run_id: doc.id, scene_id: review.scene_id, task_id: review.task_id,
          embodiment_id: review.embodiment_id, review_digest: review.review_digest,
          created_at_iso: record.created_at_iso } : null;
    }).filter(Boolean);
    return res.status(200).json({ schema_version: "native_g1_private_review_list.v1", reviews });
  } catch {
    return res.status(503).json({ error: "Private review store is unavailable" });
  }
});

router.get("/:runId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  if (!db) return res.status(503).json({ error: "Private review store is unavailable" });
  try {
    const record = await authorizedReview(req.params.runId, res);
    if (!record) return res.status(404).json({ error: "G1 review not found" });
    return res.status(200).json({ schema_version: "native_g1_private_review_site_record.v1",
      run_id: record.run_id, review: record.review,
      artifacts: nativeG1ReviewArtifacts(record.review) });
  } catch {
    return res.status(503).json({ error: "Private review store is unavailable" });
  }
});

router.post("/:runId/artifacts/:artifactId/ticket", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const record = await authorizedReview(req.params.runId, res);
    const artifact = record && artifactFor(record, req.params.artifactId);
    if (!record || !artifact) return res.status(404).json({ error: "G1 review artifact not found" });
    const admitted = await probeTaskEvaluationResultArtifact({
      runId: record.run_id, artifactId: artifact.artifact_id,
      expected: { sha256: artifact.sha256, size_bytes: artifact.size_bytes },
    });
    if (admitted !== "admitted") return res.status(503).json({ error: "G1 review artifact unavailable" });
    const ticket = createTaskEvaluationResultDownloadTicket(`g1:${record.run_id}`, artifact.artifact_id);
    if (!ticket) return res.status(503).json({ error: "Review tickets are not configured" });
    const query = new URLSearchParams({ expires: String(ticket.expires), signature: ticket.signature });
    return res.status(201).json({ download_url:
      `/api/native-g1-review-downloads/${encodeURIComponent(record.run_id)}/${artifact.artifact_id}?${query}` });
  } catch {
    return res.status(503).json({ error: "G1 review artifact unavailable" });
  }
});

export const nativeG1PrivateReviewDownloadsRouter = Router();
nativeG1PrivateReviewDownloadsRouter.get("/:runId/:artifactId", async (req, res) => {
  const { runId, artifactId } = req.params;
  if (!identifier.safeParse(runId).success
    || !/^[0-9a-f]{32}$/.test(artifactId)
    || !verifyTaskEvaluationResultDownloadTicket(`g1:${runId}`, artifactId,
      req.query.expires, req.query.signature)) {
    return res.status(404).json({ error: "G1 review download unavailable" });
  }
  if (!db) return res.status(503).json({ error: "Private review store is unavailable" });
  try {
    const record = await readReview(runId);
    const artifact = record && artifactFor(record, artifactId);
    if (!record || !artifact) return res.status(404).json({ error: "G1 review download unavailable" });
    await streamTaskEvaluationResultArtifact({
      runId, artifactId, req, res,
      expected: { sha256: artifact.sha256, size_bytes: artifact.size_bytes },
    });
  } catch {
    if (!res.headersSent) return res.status(503).json({ error: "G1 review download unavailable" });
    res.destroy();
  }
});

export default router;
