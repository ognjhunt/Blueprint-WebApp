import { timingSafeEqual } from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";

import { ingestHumanReplyPayload } from "../utils/human-reply-worker";

const router = Router();

function verifyHumanReplyIntakeToken(req: Request, res: Response): boolean {
  const expected = String(process.env.BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN || "").trim();
  if (!expected) {
    res
      .status(503)
      .json({ error: "Human reply intake is not configured (BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN)." });
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

const ingestSchema = z.object({
  channel: z.enum(["email", "slack"]),
  external_message_id: z.string().trim().min(1).max(500),
  external_thread_id: z.string().trim().max(500).optional().nullable(),
  sender: z.string().trim().max(1000).optional().nullable(),
  recipient: z.string().trim().max(1000).optional().nullable(),
  subject: z.string().trim().max(1000).optional().nullable(),
  body: z.string().trim().min(1).max(50000),
  received_at: z.string().trim().max(100).optional().nullable(),
});

router.post("/ingest", async (req: Request, res: Response) => {
  if (!verifyHumanReplyIntakeToken(req, res)) {
    return;
  }

  const parsed = ingestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
  }

  try {
    const result = await ingestHumanReplyPayload(parsed.data);
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to ingest human reply.",
    });
  }
});

export default router;
