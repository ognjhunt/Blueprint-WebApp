/**
 * The robot-team early-access application.
 *
 * Public and CSRF-protected. It records the application with its fit
 * checklist, sends one email, and rings the team's Slack. A person grants
 * access in `/admin/robot-team-access` when a real site task fits. Fit checks
 * support that decision and never approve public registrations automatically.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { logger } from "../logger";
import { assessAccessFit, libraryIsThin } from "../utils/robotTeamAccessFit";
import { enqueueAccessEmail } from "../utils/robotTeamAccessEmails";
import {
  accessRecordId,
  recordAccessApplication,
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
    pilotPackage: optionalText(1200),
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
    // An unavailable library remains unknown to the fit checklist. Admission is manual.
    const listed = await listTaskBrowseCards().catch(() => []);
    const fit = assessAccessFit(application, listed.map((card) => ({ title: card.title, region: card.region })));
    const { record, created } = await recordAccessApplication(application, { fit });
    const recordId = accessRecordId(record.email);
    // Registration records interest; only the existing staff decision/invite routes grant admission.
    const current = record;
    const autoApproved = false;
    await enqueueAccessEmail({ kind: "robot_team_access_received", recordId, record: current, thinLibrary: libraryIsThin(listed.length) }).catch((error) => {
      logger.warn({ error }, "Could not queue the early-access email");
    });
    if (created) {
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
