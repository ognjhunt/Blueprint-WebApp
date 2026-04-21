import { timingSafeEqual } from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";

import {
  recordExternalGapReport,
  resolveExternalGapReport,
} from "../utils/gap-closure";

const router = Router();

function verifyGapIntakeToken(req: Request, res: Response): boolean {
  const expected = String(process.env.BLUEPRINT_GAP_INTAKE_TOKEN || "").trim();
  if (!expected) {
    res.status(503).json({ error: "Gap intake is not configured (BLUEPRINT_GAP_INTAKE_TOKEN)." });
    return false;
  }
  const provided = String(req.header("X-Blueprint-Gap-Token") || "").trim();
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const reportSchema = z.object({
  source: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  detail: z.string().trim().max(20000).optional().nullable(),
  severity: z.enum(["info", "warn", "blocker"]).optional(),
  suggested_owner: z.string().trim().max(200).optional().nullable(),
  stable_id: z.string().trim().max(400).optional().nullable(),
  repo: z.enum(["Blueprint-WebApp", "BlueprintCapture", "BlueprintPipeline"]).optional(),
  project: z.string().trim().max(200).optional().nullable(),
  failure_family: z.string().trim().max(200).optional().nullable(),
  source_ref: z.string().trim().max(1000).optional().nullable(),
});

router.post("/report", async (req: Request, res: Response) => {
  if (!verifyGapIntakeToken(req, res)) {
    return;
  }
  const parsed = reportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
  }
  try {
    const result = await recordExternalGapReport(parsed.data);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to record gap",
    });
  }
});

const resolveSchema = z.object({
  stable_id: z.string().trim().min(1).max(400),
});

router.post("/resolve", async (req: Request, res: Response) => {
  if (!verifyGapIntakeToken(req, res)) {
    return;
  }
  const parsed = resolveSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
  }
  try {
    const ok = await resolveExternalGapReport(parsed.data.stable_id);
    if (!ok) {
      return res.status(404).json({ error: "Work item not found or not an external gap." });
    }
    return res.status(200).json({ ok: true, stable_id: parsed.data.stable_id });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to resolve gap",
    });
  }
});

export default router;
