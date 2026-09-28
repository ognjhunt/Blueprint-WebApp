import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { storageAdmin, dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { registerCheckpoint } from "../utils/robotCheckpoints";
import {
  MODEL_MAX_UPLOAD_BYTES, modelInterfaceSchema, modelBytesDigest, validatePrivateModelBucket,
  type PolicyModelArtifact,
} from "../utils/policyModelArtifact";

const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MODEL_MAX_UPLOAD_BYTES, files: 1, fields: 2, fieldSize: 32 * 1024, parts: 4,
} }).single("model");

/** Mounted only after team key and verified account checks. */
export function receivePolicyModel(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (error: unknown) => {
    if (error) return res.status(400).json({ code: "policy_model_upload_invalid", error: "Upload one ONNX model of at most 16 MiB." });
    next();
  });
}

export async function storePolicyModel(req: Request, res: Response) {
  const teamId = res.locals.policyModelTeamId as string;
  const file = (req as Request & { file?: { buffer: Buffer; originalname: string; size: number } }).file;
  let manifest;
  try { manifest = modelInterfaceSchema.parse(JSON.parse(String(req.body.interface || ""))); }
  catch { return res.status(400).json({ code: "policy_model_interface_invalid", error: "Select a compatible runner and provide its input and action interface." }); }
  if (!file || !file.originalname.toLowerCase().endsWith(".onnx")) {
    return res.status(400).json({ code: "policy_model_format_unsupported", error: "This runner requires an ONNX model. Native framework packages require their own compatible runner." });
  }
  if (!db || !storageAdmin) return res.status(503).json({ code: "policy_model_store_unavailable" });
  let bucketName;
  try { bucketName = validatePrivateModelBucket(String(process.env.POLICY_MODEL_PRIVATE_STORAGE_BUCKET || "")); }
  catch { return res.status(503).json({ code: "policy_model_private_store_not_configured" }); }
  const digest = modelBytesDigest(file.buffer);
  const artifactId = `model_${randomUUID()}`;
  const objectPath = `policy-models/${encodeURIComponent(teamId)}/${artifactId}/${digest.slice(7)}.onnx`;
  const object = storageAdmin.bucket(bucketName).file(objectPath);
  let stored = false;
  try {
    // The dedicated bucket must have uniform access + enforced public-access
    // prevention. Check before uploading; never trust a prefix to be private.
    const [bucketMetadata] = await storageAdmin.bucket(bucketName).getMetadata();
    if (bucketMetadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true
      || bucketMetadata.iamConfiguration?.publicAccessPrevention !== "enforced") {
      return res.status(503).json({ code: "policy_model_private_store_protection_required" });
    }
    await object.save(file.buffer, {
      resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: "application/octet-stream", cacheControl: "private, no-store",
        metadata: { owner_team_id: teamId, sha256: digest } },
    });
    stored = true;
    const [metadata] = await object.getMetadata();
    if (Number(metadata.size) !== file.size || !metadata.generation) throw new Error("model_storage_readback_invalid");
    const artifact: PolicyModelArtifact = {
      schema_version: "blueprint.policy_model_artifact.v1", artifact_id: artifactId,
      uri: `gs://${bucketName}/${objectPath}`, sha256: digest, size_bytes: file.size,
      storage_generation: String(metadata.generation), interface: manifest,
      compatibility_status: "uploaded_pending_runner_validation",
    };
    const registered = await registerCheckpoint({
      teamId, label: String(req.body.label || artifactId).slice(0, 120), runtime: "model_artifact",
      reference: artifact.uri, modelArtifact: artifact,
    });
    if (!registered.registered) throw new Error("model_checkpoint_registration_failed");
    return res.status(201).json({ ok: true, checkpoint: registered.checkpoint,
      next: "Runner validation is required before this model can execute a task." });
  } catch {
    // Compensate only the unique object this request created, never other work.
    if (stored) {
      try { await object.delete({ ignoreNotFound: true }); }
      catch { return res.status(503).json({ code: "policy_model_upload_cleanup_pending" }); }
    }
    return res.status(503).json({ code: "policy_model_upload_store_failed" });
  }
}
