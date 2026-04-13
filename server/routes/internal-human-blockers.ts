import { timingSafeEqual } from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";

import { dispatchHumanBlocker } from "../utils/human-blocker-dispatch";

const router = Router();

function verifyHumanBlockerToken(req: Request, res: Response): boolean {
  const expected = String(process.env.BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN || "").trim();
  if (!expected) {
    res
      .status(503)
      .json({ error: "Human blocker dispatch is not configured (BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN)." });
    return false;
  }
  const provided = String(req.header("X-Blueprint-Human-Reply-Token") || "").trim();
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const humanBlockerPacketSchema = z.object({
  blockerId: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(2000),
  recommendedAnswer: z.string().trim().min(1).max(2000),
  exactResponseNeeded: z.string().trim().min(1).max(2000),
  whyBlocked: z.string().trim().min(1).max(3000),
  alternatives: z.array(z.string().trim().min(1).max(2000)).min(1).max(5),
  risk: z.string().trim().min(1).max(2000),
  executionOwner: z.string().trim().min(1).max(120),
  immediateNextAction: z.string().trim().min(1).max(2000),
  deadline: z.string().trim().min(1).max(240),
  evidence: z.array(z.string().trim().min(1).max(2000)).min(1).max(12),
  nonScope: z.string().trim().min(1).max(2000),
});

const dispatchSchema = z.object({
  delivery_mode: z.enum(["send_now", "review_required", "send_saved_draft"]).optional(),
  dispatch_id: z.string().trim().min(1).max(200).optional(),
  packet: humanBlockerPacketSchema.optional(),
  blocker_kind: z.enum(["technical", "ops_commercial"]).optional(),
  email_target: z.string().email().optional(),
  mirror_to_slack: z.boolean().optional(),
  slack_webhook_url: z.string().url().optional(),
  routing_owner: z.string().trim().max(120).optional(),
  execution_owner: z.string().trim().max(120).optional(),
  escalation_owner: z.string().trim().max(120).optional(),
  review_owner: z.string().trim().max(120).optional(),
  sender_owner: z.string().trim().max(120).optional(),
  report_paths: z.array(z.string().trim().min(1).max(500)).optional(),
  paperclip_issue_id: z.string().trim().max(200).optional(),
  ops_work_item_id: z.string().trim().max(200).optional(),
  actor: z.object({
    uid: z.string().trim().max(200).optional(),
    email: z.string().trim().max(500).optional(),
  }).optional(),
  reviewed_by: z.object({
    uid: z.string().trim().max(200).optional(),
    email: z.string().trim().max(500).optional(),
  }).optional(),
}).superRefine((value, ctx) => {
  const deliveryMode = value.delivery_mode || "send_now";
  if (deliveryMode === "send_saved_draft") {
    if (!value.dispatch_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dispatch_id"],
        message: "dispatch_id is required when delivery_mode=send_saved_draft.",
      });
    }
    return;
  }

  if (!value.packet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["packet"],
      message: "packet is required unless sending a saved draft.",
    });
  }
  if (!value.blocker_kind) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blocker_kind"],
      message: "blocker_kind is required unless sending a saved draft.",
    });
  }
});

router.post("/dispatch", async (req: Request, res: Response) => {
  if (!verifyHumanBlockerToken(req, res)) {
    return;
  }

  const parsed = dispatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const result = await dispatchHumanBlocker({
      delivery_mode: parsed.data.delivery_mode,
      dispatch_id: parsed.data.dispatch_id,
      packet: parsed.data.packet as any,
      blocker_kind: parsed.data.blocker_kind as any,
      email_target: parsed.data.email_target,
      mirror_to_slack: parsed.data.mirror_to_slack,
      slack_webhook_url: parsed.data.slack_webhook_url,
      routing_owner: parsed.data.routing_owner,
      execution_owner: parsed.data.execution_owner,
      escalation_owner: parsed.data.escalation_owner,
      review_owner: parsed.data.review_owner,
      sender_owner: parsed.data.sender_owner,
      report_paths: parsed.data.report_paths,
      paperclip_issue_id: parsed.data.paperclip_issue_id,
      ops_work_item_id: parsed.data.ops_work_item_id,
      actor: parsed.data.actor,
      reviewed_by: parsed.data.reviewed_by,
    });
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to dispatch human blocker.",
    });
  }
});

export default router;
