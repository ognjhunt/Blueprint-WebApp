import { Router } from "express";

import { adpTaskAdmissionSchema } from "../agents/adp-contract";
import { configuredAdpManagedRuns } from "../agents/adp-managed-runs";
import { configuredEngineeringHandoffs, configuredPaperclipClient } from "../agents/adp-engineering";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { z } from "zod";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";

const router = Router();
router.post("/agent-execution/paperclip-bindings", createPipelineSyncRateLimiter(), async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ code: auth.code });
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature")) {
    return res.status(401).json({ code: "paperclip_binding_requires_signed_request" });
  }
  const parsed = z.object({ task_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/),
    task_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/), issue_id: z.string().uuid() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "paperclip_binding_invalid" });
  try {
    const company = process.env.BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID, agent = process.env.BLUEPRINT_PAPERCLIP_ADP_AGENT_ID;
    const project = process.env.BLUEPRINT_PAPERCLIP_ADP_PROJECT_ID || process.env.BLUEPRINT_ADP_ENGINEERING_PROJECT_ID;
    if (!company || !agent || !project) throw new Error("paperclip_binding_not_configured");
    const service = configuredAdpManagedRuns(), input = parsed.data;
    const admission = await service.admission(input.task_id);
    if (admission.task_digest !== input.task_digest) throw new Error("paperclip_binding_task_changed");
    const issue = await configuredPaperclipClient().request("GET", `/api/issues/${input.issue_id}`);
    if (issue.id !== input.issue_id || issue.companyId !== company || issue.projectId !== project || issue.assigneeAgentId !== agent) {
      throw new Error("paperclip_binding_scope_changed");
    }
    const binding = { ...input, company_id: company, agent_id: agent };
    const ref = service.store.collection("agentExecutionPaperclipIssueBindings").doc(input.issue_id);
    await service.store.runTransaction(async (tx) => {
      const old = await tx.get(ref);
      if (old.exists && crossRuntimeDigest(old.data()) !== crossRuntimeDigest(binding)) throw new Error("paperclip_binding_conflict");
      tx.set(ref, binding);
    });
    return res.json({ schema_version: "blueprint_paperclip_issue_binding.v1", binding, stored: true });
  } catch { return res.status(409).json({ code: "paperclip_issue_binding_not_admitted" }); }
});
router.post("/agent-execution/engineering", createPipelineSyncRateLimiter(), async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const authentication = verifyPipelineSyncRequest(req);
  if (!authentication.ok) return res.status(authentication.status).json({ code: authentication.code });
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature")) {
    return res.status(401).json({ code: "engineering_handoff_requires_signed_request" });
  }
  try { return res.json(await configuredEngineeringHandoffs().admit(req.body)); }
  catch { return res.status(409).json({ code: "engineering_handoff_not_admitted" }); }
});
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
