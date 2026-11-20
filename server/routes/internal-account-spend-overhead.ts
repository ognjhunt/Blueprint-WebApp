import { Router } from "express";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { accountSpendOverheadMonth } from "../utils/accountSpendOverhead";

const router = Router();

/**
 * The WebApp's own paid agent runs for one UTC month, as named overhead (owner decision 2026-11-20). The Pipeline's
 * capacity tick reads it for the account's monthly count. Signed Pipeline calls only; it reads and changes nothing.
 */
router.post("/account-spend-overhead", createPipelineSyncRateLimiter(), async (req, res) => {
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
    return res.status(401).json({ code: "missing_pipeline_sync_signature" });
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
  const parsed = z.object({ month: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "account_spend_overhead_request_invalid" });
  if (!db) return res.status(503).json({ code: "account_spend_overhead_store_unavailable" });
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json(await accountSpendOverheadMonth(db, parsed.data.month));
  } catch {
    return res.status(503).json({ code: "account_spend_overhead_store_unavailable" });
  }
});

export default router;
