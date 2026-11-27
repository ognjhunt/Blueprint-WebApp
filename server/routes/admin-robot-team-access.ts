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
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { robotTeamAccountInvitation } from "../utils/accountInvitations";
import type { RobotTeamAccessRecord } from "../utils/robotTeamEarlyAccess";
import { autoApproveMinimumTasks } from "../utils/robotTeamAccessFit";
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
  })
  .strict();

router.post("/:id/decision", async (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  const id = String(req.params.id || "");
  if (!parsed.success || !/^[a-f0-9]{64}$/.test(id)) {
    return res.status(400).json({ error: "Send status approved or declined for a known application." });
  }
  try {
    const result = await decideAccessApplication({
      id,
      status: parsed.data.status,
      note: parsed.data.note || null,
      decidedBy: operatorName(res),
    });
    if (!result) return res.status(404).json({ error: "Application not found" });
    return res.json({ application: { id, ...result.record }, emailed: result.notification.status === "sent",
      notificationStatus: result.notification.status, notification: result.notification });
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
    const { record, created, alreadyApproved, notification } = await inviteRobotTeam({
      ...parsed.data,
      note: parsed.data.note || null,
      invitedBy: operatorName(res),
    });
    const id = accessRecordId(record.email);
    return res.status(created ? 201 : 200).json({
      application: { id, ...record },
      alreadyApproved,
      emailed: notification.status === "sent",
      notificationStatus: notification.status,
      notification,
    });
  } catch (error) {
    logger.error({ error }, "Could not invite a robot team");
    return res.status(503).json({ error: "The invite could not be saved" });
  }
});

const ruleTrialSchema = z
  .object({
    emailDomain: z.string().trim().min(3).max(320).regex(/^(?:[^\s@]+@)?[a-z0-9.-]+\.[a-z]{2,}$/i),
    website: z.string().trim().min(4).max(2048),
  })
  .strict();

/**
 * Try the automatic rule once (outreach gap 1, 2026-11-27): on a work email domain and a website the owner types, each
 * step's result and reason, before the first real applicant meets it. Records no application, no approval and no email;
 * its one model call shows in `agentRuns` (kind company_website_check), so a run here proves the rule reaches the model in
 * production. It counts against its own cap of ten a day, never the applicants' (`tryCompanyRule`).
 */
router.post("/rule-trial", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = ruleTrialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Type a work email domain and a website." });
  try {
    const { tryCompanyRule } = await import("../utils/companyCheck");
    const result = await tryCompanyRule(parsed.data);
    logger.info({ outcome: result.check.outcome, reasons: result.check.reasons }, "Owner tried the company rule");
    return res.json(result);
  } catch (error) {
    logger.error({ error }, "The company rule trial could not run");
    return res.status(503).json({ error: "The rule could not run just now. Try again shortly." });
  }
});

/** Refresh an expired link without changing the person's admission decision. */
router.post("/:id/invitation", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.params.id || "");
  if (!db || !/^[a-f0-9]{64}$/.test(id)) return res.status(400).json({ error: "Use a known robot-team application." });
  try {
    const record = (await db.collection("robotTeamAccess").doc(id).get()).data() as RobotTeamAccessRecord | undefined;
    if (!record || record.status !== "approved") return res.status(403).json({ error: "Approve the team before issuing an invitation." });
    return res.json({ invitationUrl: `${(process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "")}/signup/business?invitation=${encodeURIComponent(robotTeamAccountInvitation(record))}` });
  } catch { return res.status(503).json({ error: "Could not create the invitation link." }); }
});

export default router;
