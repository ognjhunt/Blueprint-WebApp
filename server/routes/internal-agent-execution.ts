import { Router } from "express";

import { adpTaskAdmissionSchema } from "../agents/adp-contract";
import { configuredAdpManagedRuns } from "../agents/adp-managed-runs";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";

const router = Router();
router.post("/agent-execution/admissions", createPipelineSyncRateLimiter(), async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const authentication = verifyPipelineSyncRequest(req);
  if (!authentication.ok) return res.status(authentication.status).json({ code: authentication.code });
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature")) {
    return res.status(401).json({ code: "agent_admission_requires_signed_request" });
  }
  const parsed = adpTaskAdmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "agent_admission_invalid" });
  try { return res.json(await configuredAdpManagedRuns().admit(parsed.data)); }
  catch (error) {
    const conflict = error instanceof Error && error.message === "adp_agent_admission_conflict";
    return res.status(conflict ? 409 : 503).json({ code: conflict ? "agent_admission_conflict" : "agent_admission_store_unavailable" });
  }
});

export default router;
