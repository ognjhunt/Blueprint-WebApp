/** Selected Paperclip worker linkage; Pipeline retains all provider ownership. */
import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { configuredAdpManagedRuns } from "../agents/adp-managed-runs";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const requestSchema = z.object({ task_id: id, company_id: id, agent_id: id, issue_id: id, run_id: id,
  action: z.enum(["inspect", "start", "cancel", "cleanup"]) }).strict();
const router = Router();
router.post("/adp-execution", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const token = process.env.BLUEPRINT_PAPERCLIP_ADP_BRIDGE_TOKEN?.trim();
  const company = process.env.BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID?.trim();
  const agent = process.env.BLUEPRINT_PAPERCLIP_ADP_AGENT_ID?.trim();
  if (!token || !company || !agent) return res.status(503).json({ code: "paperclip_adp_not_configured" });
  const actual = Buffer.from(req.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(401).json({ code: "paperclip_adp_authentication_required" });
  }
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "paperclip_adp_request_invalid" });
  const input = parsed.data;
  if (input.company_id !== company || input.agent_id !== agent) {
    return res.status(403).json({ code: "paperclip_adp_worker_not_selected" });
  }
  try {
    const service = configuredAdpManagedRuns();
    const admission = await service.admission(input.task_id);
    const owner = { company_id: input.company_id, agent_id: input.agent_id, issue_id: input.issue_id,
      task_id: input.task_id, task_digest: admission.task_digest };
    const bindingRef = service.store.collection("agentExecutionPaperclipOwners").doc(input.task_id);
    const executionRef = service.store.collection("agentExecutionPaperclipRuns").doc(input.run_id);
    await service.store.runTransaction(async (transaction) => {
      const [bound, execution] = await Promise.all([transaction.get(bindingRef), transaction.get(executionRef)]);
      if (bound.exists && JSON.stringify(bound.data()) !== JSON.stringify(owner)) throw new Error("paperclip_adp_owner_conflict");
      if (execution.exists && execution.data()!.task_digest !== admission.task_digest) throw new Error("paperclip_adp_owner_conflict");
      transaction.set(bindingRef, owner);
      transaction.set(executionRef, { ...owner, paperclip_run_id: input.run_id,
        execution_owner: "blueprint_pipeline", last_requested_action: input.action }, { merge: true });
    });
    const actor = `paperclip:${input.company_id}:${input.agent_id}:${input.run_id}`;
    if (input.action === "start") await service.start(input.task_id, actor);
    if (input.action === "cancel" || input.action === "cleanup") await service.requestAction(input.task_id, input.action, actor);
    const { run } = await service.status(input.task_id);
    const execution = run?.artifacts?.agent_execution;
    const result = { schema_version: "blueprint_paperclip_adp_execution.v1", ...owner,
      paperclip_run_id: input.run_id, blueprint_agent_run_id: run?.id ?? null,
      status: run?.status ?? "admitted", pipeline_runtime: admission.runtime,
      source_commit: admission.source_commit, task_result_digest: execution?.result?.result_digest ?? null,
      interpretation_receipt_digest: execution?.interpretation?.receipt_digest ?? null,
      cleanup_state: execution?.cleanup_state ?? "not_requested",
      scientific_acceptance_granted: false, product_completion_inferred: false };
    await executionRef.set({ last_observation: result }, { merge: true });
    return res.json(result);
  } catch (error) {
    const conflict = error instanceof Error && error.message === "paperclip_adp_owner_conflict";
    return res.status(conflict ? 409 : 503).json({ code: conflict ? "paperclip_adp_owner_conflict" : "paperclip_adp_execution_unresolved" });
  }
});
export default router;
