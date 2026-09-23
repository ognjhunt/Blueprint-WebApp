/**
 * Early-access review for robot teams. Admin/ops only.
 *
 * Approving grants the library to that verified email and sends one email
 * with the next step. Declining records the decision and sends nothing, so
 * the reply can come from a person.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { logger } from "../logger";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { enqueueAccessEmail } from "../utils/robotTeamAccessEmails";
import { decideAccessApplication, listAccessApplications } from "../utils/robotTeamEarlyAccess";

const router = Router();
router.use(requireAdminRole);

router.get("/", async (_req: Request, res: Response) => {
  try {
    const applications = await listAccessApplications();
    return res.json({ applications, count: applications.length });
  } catch (error) {
    logger.error({ error }, "Could not list robot-team applications");
    return res.status(503).json({ error: "Applications are unavailable" });
  }
});

const decisionSchema = z
  .object({
    status: z.enum(["approved", "declined"]),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

router.post("/:id/decision", async (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  const id = String(req.params.id || "");
  if (!parsed.success || !/^[a-f0-9]{64}$/.test(id)) {
    return res.status(400).json({ error: "Send status approved or declined for a known application." });
  }
  const operator = res.locals.firebaseUser as { email?: string; uid?: string } | undefined;
  try {
    const record = await decideAccessApplication({
      id,
      status: parsed.data.status,
      note: parsed.data.note || null,
      decidedBy: operator?.email || operator?.uid || "operator",
    });
    if (!record) return res.status(404).json({ error: "Application not found" });
    if (record.status === "approved") {
      await enqueueAccessEmail({ kind: "robot_team_access_approved", recordId: id, record }).catch((error) => {
        logger.warn({ error, id }, "Could not queue the early-access approval email");
      });
    }
    return res.json({ application: { id, ...record } });
  } catch (error) {
    logger.error({ error, id }, "Could not record a robot-team access decision");
    return res.status(503).json({ error: "The decision could not be saved" });
  }
});

export default router;
