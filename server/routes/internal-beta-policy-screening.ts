import { Router, type Response } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { betaPolicyScreeningHoldSchema, ingestBetaPolicyScreeningHold, parseBetaPolicyScreeningHold } from "../utils/betaPolicyScreeningHold";
import { PIPELINE_SCHEMA_NOT_ACCEPTED, PIPELINE_SCHEMA_NOT_ACCEPTED_STATUS, quarantineRejectedPayload,
  type QuarantinedPayloadKind } from "../utils/pipelinePayloadQuarantine";
import type { ZodType } from "zod";

const router = Router();
/**
 * Answer a signed payload that did not parse. One the Pipeline sealed (its own digest verifies) whose
 * schema this release does not accept is kept in quarantine, reported once, and refused by name
 * (422 `schema_not_accepted`), so the Pipeline can deliver the same result in a version this release
 * accepts. Anything else keeps the plain 400. A payload that cannot be stored is a 503: the sender
 * retries rather than move on from a payload nobody kept.
 */
async function refuseUnparsed(res: Response, args: { kind: QuarantinedPayloadKind; digestField: string; body: unknown;
  schema: ZodType; invalidCode: string }) {
  try {
    const kept = await quarantineRejectedPayload(args);
    if (!kept) return res.status(400).json({ code: args.invalidCode });
    return res.status(PIPELINE_SCHEMA_NOT_ACCEPTED_STATUS).json({ code: PIPELINE_SCHEMA_NOT_ACCEPTED, kind: args.kind,
      payload_digest: kept.payload_digest, quarantined: true });
  } catch {
    return res.status(503).json({ code: "screening_store_unavailable" });
  }
}
// A job whose evaluation could not start (no campaign), held by name. A new delivery, so always signed.
router.post("/beta-policy-screening-holds", createPipelineSyncRateLimiter(), async (req, res) => {
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
    return res.status(401).json({ code: "missing_pipeline_sync_signature" });
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
  const hold = parseBetaPolicyScreeningHold(req.body);
  if (!hold) return refuseUnparsed(res, { kind: "beta_policy_screening_hold", digestField: "hold_digest",
    body: req.body, schema: betaPolicyScreeningHoldSchema, invalidCode: "screening_hold_invalid" });
  try {
    const receipt = await ingestBetaPolicyScreeningHold(hold);
    return res.status(receipt.status === "created" ? 201 : 200).json(receipt);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^(screening_|job_)[a-z_]+$/.test(code))
      return res.status(code.endsWith("store_unavailable") ? 503 : 409).json({ code });
    return res.status(503).json({ code: "screening_store_unavailable" });
  }
});
export default router;
