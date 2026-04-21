import { Request, Response, Router } from "express";
import { logger } from "../logger";
import { hasAnyRole, resolveAccessContext } from "../utils/access-control";
import { collectCompanyScoreboard } from "../utils/companyScoreboard";

const router = Router();

async function requireOps(_req: Request, res: Response, next: () => void) {
  const user = res.locals.firebaseUser;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    return res.status(403).json({ error: "Ops access required" });
  }
  next();
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

router.get("/", requireOps, async (req: Request, res: Response) => {
  try {
    const access = await resolveAccessContext(res);
    const scoreboard = await collectCompanyScoreboard({
      dailyLookbackDays: parsePositiveInteger(req.query.daily_days, 1),
      weeklyLookbackDays: parsePositiveInteger(req.query.weekly_days, 7),
    });

    return res.json({
      ok: true,
      operatorEmail: access.email || null,
      scoreboard,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to collect company scoreboard");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to collect company scoreboard",
    });
  }
});

export default router;
