/**
 * Early-access review for robot teams. Admin/ops only.
 *
 * Approving grants the library to that verified email and sends one email
 * with the next step. Declining ("not yet") sends one polite email unless the
 * reviewer would rather reply in their own words. Inviting is the outbound
 * path: after a call, a person grants access to that email directly.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { logger } from "../logger";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { autoApproveMinimumTasks } from "../utils/robotTeamAccessFit";
import { enqueueAccessEmail } from "../utils/robotTeamAccessEmails";
import {
  accessRecordId,
  decideAccessApplication,
  inviteRobotTeam,
  listAccessApplications,
} from "../utils/robotTeamEarlyAccess";
import { listTaskBrowseCards } from "../utils/taskBrowse";

const router = Router();
router.use(requireAdminRole);

function operatorName(res: Response): string {
  const operator = res.locals.firebaseUser as { email?: string; uid?: string } | undefined;
  return operator?.email || operator?.uid || "operator";
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const [applications, listed] = await Promise.all([
      listAccessApplications(),
      listTaskBrowseCards().catch(() => null),
    ]);
    return res.json({
      applications,
      count: applications.length,
      library: {
        listedTaskCount: listed?.length ?? null,
        autoApproveMinimumTasks: autoApproveMinimumTasks(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Could not list robot-team applications");
    return res.status(503).json({ error: "Applications are unavailable" });
  }
});

const decisionSchema = z
  .object({
    status: z.enum(["approved", "declined"]),
    note: z.string().trim().max(2000).optional(),
    /** Declines only: false to reply personally instead of the standard email. */
    notify: z.boolean().optional(),
  })
  .strict();

router.post("/:id/decision", async (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  const id = String(req.params.id || "");
  if (!parsed.success || !/^[a-f0-9]{64}$/.test(id)) {
    return res.status(400).json({ error: "Send status approved or declined for a known application." });
  }
  try {
    const record = await decideAccessApplication({
      id,
      status: parsed.data.status,
      note: parsed.data.note || null,
      decidedBy: operatorName(res),
    });
    if (!record) return res.status(404).json({ error: "Application not found" });
    const kind = record.status === "approved"
      ? "robot_team_access_approved" as const
      : parsed.data.notify === false ? null : "robot_team_access_not_yet" as const;
    if (kind) {
      await enqueueAccessEmail({ kind, recordId: id, record }).catch((error) => {
        logger.warn({ error, id, kind }, "Could not queue the early-access decision email");
      });
    }
    return res.json({ application: { id, ...record }, emailed: Boolean(kind) });
  } catch (error) {
    logger.error({ error, id }, "Could not record a robot-team access decision");
    return res.status(503).json({ error: "The decision could not be saved" });
  }
});

const inviteSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(320),
    company: z.string().trim().min(1).max(160),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

/** After a call: grant access to that email and send the same email-bound link. */
router.post("/invites", async (req: Request, res: Response) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Send the team's name, work email and company." });
  }
  try {
    const { record, created, alreadyApproved } = await inviteRobotTeam({
      ...parsed.data,
      note: parsed.data.note || null,
      invitedBy: operatorName(res),
    });
    const id = accessRecordId(record.email);
    if (!alreadyApproved) {
      await enqueueAccessEmail({ kind: "robot_team_access_approved", recordId: id, record }).catch((error) => {
        logger.warn({ error, id }, "Could not queue the early-access invite email");
      });
    }
    return res.status(created ? 201 : 200).json({
      application: { id, ...record },
      alreadyApproved,
      emailed: !alreadyApproved,
    });
  } catch (error) {
    logger.error({ error }, "Could not invite a robot team");
    return res.status(503).json({ error: "The invite could not be saved" });
  }
});

export default router;
