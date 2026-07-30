import { createHash } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import {
  exactTestbedPublicationFingerprint,
  parseVerifiedMaintainedSiteTaskTestbed,
  siteTaskTestbedPublicationSchema,
} from "../utils/siteTaskTestbedContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.message, code: result.code });
  }
  next();
}

function recordId(sessionId: string, digest: string) {
  return `site-task-testbed-${createHash("sha256")
    .update(`${sessionId}\u0000${digest}`)
    .digest("hex")
    .slice(0, 32)}`;
}

router.post(
  "/capture-testbeds",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Capture testbed store is unavailable" });
    const parsed = siteTaskTestbedPublicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Pipeline testbed publication is invalid",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const publication = parsed.data;
    const verified = parseVerifiedMaintainedSiteTaskTestbed(publication.testbed);
    if (!verified.ok) {
      return res.status(400).json({
        error: "Pipeline testbed failed integrity validation",
        blockers: verified.blockers,
      });
    }
    const testbed = verified.testbed;
    if (
      publication.testbed_id !== testbed.testbed_id ||
      publication.version !== testbed.version ||
      publication.testbed_digest !== testbed.testbed_digest ||
      publication.artifact_reference.digest !== testbed.testbed_digest ||
      publication.approved_task_digest !== testbed.approved_task_definition.digest ||
      exactTestbedPublicationFingerprint(publication.proof_boundary) !==
        exactTestbedPublicationFingerprint(testbed.proof_boundary)
    ) {
      return res.status(409).json({ error: "Pipeline testbed publication binding mismatch" });
    }
    const sourceBundles = testbed.source_capture_bundles.filter(
      (bundle) => bundle.bundle_id === publication.intake_id,
    );
    if (sourceBundles.length !== 1) {
      return res.status(409).json({ error: "Pipeline testbed intake source binding mismatch" });
    }

    const sessionRef = db.collection("captureUploadSessions").doc(
      publication.capture_session_id,
    );
    const testbedRef = db.collection("captureSiteTaskTestbeds").doc(
      recordId(publication.capture_session_id, publication.testbed_digest),
    );
    type Outcome =
      | { kind: "published" }
      | { kind: "replayed" }
      | { kind: "not_found" }
      | { kind: "intake_mismatch" }
      | { kind: "approved_task_mismatch" }
      | { kind: "version_conflict" }
      | { kind: "predecessor_mismatch" }
      | { kind: "immutable_conflict" };
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        const sessionSnapshot = await transaction.get(sessionRef);
        const testbedSnapshot = await transaction.get(testbedRef);
        if (!sessionSnapshot.exists) return { kind: "not_found" };
        const session = sessionSnapshot.data() as Record<string, any>;
        if (session.request?.intake_id !== publication.intake_id) {
          return { kind: "intake_mismatch" };
        }
        if (
          session.approved_task_definition?.approved_task_digest !==
          publication.approved_task_digest
        ) {
          return { kind: "approved_task_mismatch" };
        }
        const current = session.pipeline_site_task_testbed as
          | { testbed_id?: string; version?: string; testbed_digest?: string }
          | undefined;
        if (
          current?.testbed_id === publication.testbed_id &&
          current.version === publication.version &&
          current.testbed_digest !== publication.testbed_digest
        ) {
          return { kind: "version_conflict" };
        }
        if (
          current?.testbed_digest &&
          current.testbed_digest !== publication.testbed_digest &&
          testbed.predecessor_testbed_digest !== current.testbed_digest
        ) {
          return { kind: "predecessor_mismatch" };
        }
        if (!current?.testbed_digest && testbed.predecessor_testbed_digest !== null) {
          return { kind: "predecessor_mismatch" };
        }
        const record = {
          schema_version: "capture_site_task_testbed_record.v1",
          capture_session_id: publication.capture_session_id,
          intake_id: publication.intake_id,
          approved_task_digest: publication.approved_task_digest,
          testbed_id: publication.testbed_id,
          version: publication.version,
          testbed_digest: publication.testbed_digest,
          artifact_reference: publication.artifact_reference,
          testbed,
          status: "testbed_ready",
          proof_boundary: publication.proof_boundary,
        };
        if (testbedSnapshot.exists) {
          if (
            exactTestbedPublicationFingerprint(testbedSnapshot.data()) !==
            exactTestbedPublicationFingerprint(record)
          ) {
            return { kind: "immutable_conflict" };
          }
        } else {
          transaction.create(testbedRef, record);
        }
        transaction.set(
          sessionRef,
          {
            pipeline_site_task_testbed: record,
            pipeline_testbed_state: "testbed_ready",
            pipeline_testbed_projection_updated_at_iso: new Date().toISOString(),
          },
          { merge: true },
        );
        return { kind: testbedSnapshot.exists ? "replayed" : "published" };
      });
    } catch {
      return res.status(503).json({ error: "Capture testbed store is unavailable" });
    }
    if (outcome.kind === "not_found") return res.status(404).json({ error: "Capture upload not found" });
    if (outcome.kind === "intake_mismatch") return res.status(409).json({ error: "Capture intake binding does not match" });
    if (outcome.kind === "approved_task_mismatch") return res.status(409).json({ error: "Approved task binding does not match" });
    if (outcome.kind === "version_conflict") return res.status(409).json({ error: "Testbed version already has a different digest" });
    if (outcome.kind === "predecessor_mismatch") return res.status(409).json({ error: "Testbed predecessor does not match the current version" });
    if (outcome.kind === "immutable_conflict") return res.status(409).json({ error: "Immutable testbed record conflicts" });
    res.set("Cache-Control", "no-store");
    return res.status(outcome.kind === "replayed" ? 200 : 201).json({
      schema_version: "capture_site_task_testbed_publication_receipt.v1",
      status: "testbed_ready",
      already_exists: outcome.kind === "replayed",
      capture_session_id: publication.capture_session_id,
      intake_id: publication.intake_id,
      approved_task_digest: publication.approved_task_digest,
      testbed_id: publication.testbed_id,
      version: publication.version,
      testbed_digest: publication.testbed_digest,
      artifact_reference: publication.artifact_reference,
      proof_boundary: publication.proof_boundary,
    });
  },
);

export default router;
