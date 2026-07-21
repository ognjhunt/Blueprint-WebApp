import { Router } from "express";
import { listOperatorSlaTrackers } from "../utils/sla-enforcement";

const router = Router();
type SlaListParams = NonNullable<Parameters<typeof listOperatorSlaTrackers>[0]>;

function parseStatus(value: unknown): SlaListParams["status"] {
  const normalized = String(value || "all").trim();
  return ["on_track", "at_risk", "breached", "completed", "all"].includes(normalized)
    ? normalized as SlaListParams["status"]
    : "all";
}

function parseStage(value: unknown): SlaListParams["stage"] {
  const normalized = String(value || "all").trim();
  return ["scoping", "upload_to_package", "packaging", "delivery", "review_setup", "all"].includes(normalized)
    ? normalized as SlaListParams["stage"]
    : "all";
}

router.get("/status", async (req, res) => {
  try {
    const result = await listOperatorSlaTrackers({
      status: parseStatus(req.query.status),
      stage: parseStage(req.query.stage),
      limit: Number(req.query.limit || 50),
    });
    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : "SLA tracker status is unavailable.",
    });
  }
});

export default router;
