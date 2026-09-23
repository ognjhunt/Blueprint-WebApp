/**
 * The robot-team early-access application.
 *
 * Public and CSRF-protected. It records the application with its fit
 * checklist, sends one email, and rings the team's Slack. A person grants
 * access in `/admin/robot-team-access`; the one exception is a clear fit once
 * the library has enough listed site tasks (see `robotTeamAccessFit`).
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { logger } from "../logger";
import { assessAccessFit, libraryIsThin, shouldAutoApprove } from "../utils/robotTeamAccessFit";
import { enqueueAccessEmail } from "../utils/robotTeamAccessEmails";
import {
  accessRecordId,
  decideAccessApplication,
  recordAccessApplication,
  type RobotTeamAccessRecord,
} from "../utils/robotTeamEarlyAccess";
import { libraryAccessForRequest } from "../utils/robotTeamLibraryAccess";
import { notifySlackRobotTeamAccessApplication } from "../utils/slack";
import { listTaskBrowseCards } from "../utils/taskBrowse";

const router = Router();

const applyLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : null));

export const applicationSchema = z
  .object({
    name: text(120),
    email: z.string().trim().email().max(320),
    company: text(160),
    website: optionalText(300),
    robot: text(1200),
    workWanted: text(1200),
    region: optionalText(120),
    testSite: optionalText(300),
    acceptedTerms: z.literal(true),
  })
  .strict();

router.post("/apply", applyLimiter, async (req: Request, res: Response) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Check the application: name, work email, company, what your robot does and the work you want to test it on are required.",
      code: "application_invalid",
    });
  }
  const { acceptedTerms: _accepted, ...application } = parsed.data;
  try {
    // A library that cannot be read counts as empty: nothing is auto-approved.
    const listed = await listTaskBrowseCards().catch(() => []);
    const fit = assessAccessFit(application, listed.map((card) => ({ title: card.title, region: card.region })));
    const { record, created } = await recordAccessApplication(application, { fit });
    const recordId = accessRecordId(record.email);
    let current: RobotTeamAccessRecord = record;
    const autoApproved = record.status === "applied" && shouldAutoApprove(fit);
    if (autoApproved) {
      current = (await decideAccessApplication({
        id: recordId,
        status: "approved",
        note: "Clear fit: work email and a website on the same domain.",
        decidedBy: "auto: fit checklist",
      })) ?? record;
    }
    await enqueueAccessEmail(autoApproved
      ? { kind: "robot_team_access_approved", recordId, record: current }
      : { kind: "robot_team_access_received", recordId, record: current, thinLibrary: libraryIsThin(listed.length) },
    ).catch((error) => {
      logger.warn({ error }, "Could not queue the early-access email");
    });
    if (created || autoApproved) {
      void notifySlackRobotTeamAccessApplication({ ...current, fit, autoApproved }).catch(() => undefined);
    }
    return res.status(202).json({ status: current.status });
  } catch (error) {
    logger.error({ error }, "Could not record a robot-team application");
    return res.status(503).json({ error: "The application could not be saved. Try again shortly.", code: "application_unavailable" });
  }
});

/** The caller's own access state, for the page to decide what to show. */
router.get("/me", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  return res.json({ access: await libraryAccessForRequest(req) });
});

export default router;
