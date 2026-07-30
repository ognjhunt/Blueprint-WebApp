import { createHash } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  exactCaptureQaFingerprint,
  parseVerifiedCaptureQaPublication,
} from "../utils/captureQaContract";
import {
  createPipelineSyncRateLimiter,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";

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
  return `capture-qa-${createHash("sha256")
    .update(`${sessionId}\u0000${digest}`)
    .digest("hex")
    .slice(0, 32)}`;
}

router.post("/capture-qa", rateLimiter, requirePipelineSignature, async (req, res) => {
  if (!db) return res.status(503).json({ error: "Capture QA store is unavailable" });
  const verified = parseVerifiedCaptureQaPublication(req.body);
  if (!verified.ok) {
    return res.status(400).json({
      error: "Pipeline Capture QA publication is invalid",
      blockers: verified.blockers,
    });
  }
  const publication = verified.publication;
  const sessionRef = db.collection("captureUploadSessions").doc(publication.capture_session_id);
  const qaRef = db.collection("captureQaReports").doc(
    recordId(publication.capture_session_id, publication.qa_report_digest),
  );
  type Outcome =
    | { kind: "published" }
    | { kind: "replayed" }
    | { kind: "not_found" }
    | { kind: "intake_mismatch" }
    | { kind: "profile_mismatch" }
    | { kind: "envelope_conflict" }
    | { kind: "terminal_successor_forbidden" }
    | { kind: "immutable_conflict" };
  let outcome: Outcome;
  try {
    outcome = await db.runTransaction<Outcome>(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      const qaSnapshot = await transaction.get(qaRef);
      if (!sessionSnapshot.exists) return { kind: "not_found" };
      const session = sessionSnapshot.data() as Record<string, any>;
      if (session.request?.intake_id !== publication.intake_id) {
        return { kind: "intake_mismatch" };
      }
      if (session.request?.capture_authority_profile !== publication.capture_authority_profile) {
        return { kind: "profile_mismatch" };
      }
      const current = session.pipeline_capture_qa as Record<string, any> | undefined;
      if (current?.envelope_digest && current.envelope_digest !== publication.envelope_digest) {
        return { kind: "envelope_conflict" };
      }
      if (
        current?.qa_report_digest &&
        current.qa_report_digest !== publication.qa_report_digest &&
        current.status !== "analysis_required"
      ) {
        return { kind: "terminal_successor_forbidden" };
      }
      const record = { ...publication };
      if (qaSnapshot.exists) {
        if (exactCaptureQaFingerprint(qaSnapshot.data()) !== exactCaptureQaFingerprint(record)) {
          return { kind: "immutable_conflict" };
        }
      } else {
        transaction.create(qaRef, record);
      }
      transaction.set(sessionRef, {
        pipeline_capture_qa: record,
        pipeline_capture_state: publication.state,
        pipeline_capture_projection_updated_at_iso: new Date().toISOString(),
      }, { merge: true });
      return { kind: qaSnapshot.exists ? "replayed" : "published" };
    });
  } catch {
    return res.status(503).json({ error: "Capture QA store is unavailable" });
  }
  if (outcome.kind === "not_found") return res.status(404).json({ error: "Capture upload not found" });
  if (outcome.kind === "intake_mismatch") return res.status(409).json({ error: "Capture intake binding does not match" });
  if (outcome.kind === "profile_mismatch") return res.status(409).json({ error: "Capture authority profile does not match" });
  if (outcome.kind === "envelope_conflict") return res.status(409).json({ error: "Capture envelope digest conflicts with current QA" });
  if (outcome.kind === "terminal_successor_forbidden") return res.status(409).json({ error: "Terminal Capture QA cannot be replaced" });
  if (outcome.kind === "immutable_conflict") return res.status(409).json({ error: "Immutable Capture QA record conflicts" });
  res.set("Cache-Control", "no-store");
  return res.status(outcome.kind === "replayed" ? 200 : 201).json({
    schema_version: "capture_qa_publication_receipt.v1",
    already_exists: outcome.kind === "replayed",
    capture_session_id: publication.capture_session_id,
    intake_id: publication.intake_id,
    capture_authority_profile: publication.capture_authority_profile,
    envelope_digest: publication.envelope_digest,
    qa_report_digest: publication.qa_report_digest,
    status: publication.status,
    state: publication.state,
    proof_boundary: publication.proof_boundary,
  });
});

export default router;
