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
import { assessAccessFit } from "../utils/robotTeamAccessFit";
import {
  accessRecordId,
  recordAccessApplication,
  requestAccessInvitation,
} from "../utils/robotTeamEarlyAccess";
import { applicationTermsAcceptance, recordCompanyTermsAcceptance } from "../utils/companyTerms";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../client/src/lib/legalAcceptance";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
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
    website: optionalText(300).refine(value => !value || /^https?:\/\//i.test(value) && URL.canParse(value), {
      message: "Use a full http:// or https:// website address.",
    }),
    robot: text(1200),
    workWanted: text(1200),
    region: optionalText(300),
    partnerRole: z.enum(["deployment", "technology"]).optional(),
    supportedSystems: optionalText(1200),
    pilotPackage: optionalText(1200),
    testSite: optionalText(300),
    acceptedTerms: z.literal(true),
    optionalUpdates: z.boolean().optional(),
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
  const { acceptedTerms: _accepted, ...fields } = parsed.data;
  const application = { ...fields, supportedSystems: Object.prototype.hasOwnProperty.call(req.body, "supportedSystems")
    ? fields.supportedSystems : undefined };
  try {
    // An unavailable library remains unknown to the fit checklist. Admission is manual.
    const listed = await listTaskBrowseCards().catch(() => []);
    const fit = assessAccessFit(application, listed.map((card) => ({ title: card.title, region: card.region })));
    // The applicant agreed to the Terms and Privacy Policy on this form: recorded with the versions and the time, and
    // carried to the account when the company is approved and signs in, so it does not accept twice.
    const { record, created, notification } = await recordAccessApplication(application, { fit,
      termsAcceptance: applicationTermsAcceptance() });
    // Registration records interest; only the existing staff decision/invite routes grant admission.
    const current = record;
    const autoApproved = false;
    // The receipt (or fresh invitation for an approved email) was committed
    // with the application. Queued is not provider delivery.
    if (created) {
      void notifySlackRobotTeamAccessApplication({ ...current, fit, autoApproved }).catch(() => undefined);
    }
    return res.status(202).json({ status: current.status, notificationStatus: notification.status });
  } catch (error) {
    logger.error({ error }, "Could not record a robot-team application");
    return res.status(503).json({ error: "The application could not be saved. Try again shortly.", code: "application_unavailable" });
  }
});

const invitationRequestSchema = z.object({ email: z.string().trim().email().max(320) }).strict();

/**
 * An approved team whose invitation link is lost or expired asks for a new
 * one. The link goes only to the approved address, and the answer is the same
 * whether or not the address is approved.
 */
router.post("/invitation", applyLimiter, async (req: Request, res: Response) => {
  const parsed = invitationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter the email address your team was approved with.", code: "invitation_request_invalid" });
  }
  try {
    await requestAccessInvitation(parsed.data.email);
  } catch (error) {
    logger.warn({ error }, "Could not queue a fresh robot-team invitation");
    return res.status(503).json({ error: "The link could not be sent. Try again shortly.", code: "invitation_request_unavailable" });
  }
  return res.status(202).json({ ok: true, message: "If that address is approved, check its inbox for your invitation. If it does not arrive, contact hello@tryblueprint.io." });
});

/**
 * An approved deployment company accepts the current Terms and Privacy Policy before it sees any job. Recorded on its
 * account and its access record (`companyTerms.ts`), with the versions taken from the server, never the client.
 */
const acceptTermsSchema = z.object({ acceptedTerms: z.literal(true), termsVersion: z.literal(TERMS_VERSION),
  privacyVersion: z.literal(PRIVACY_VERSION) }).strict();
router.post("/accept-terms", applyLimiter, verifyFirebaseToken, async (req: Request, res: Response) => {
  const user = res.locals.firebaseUser;
  if (!acceptTermsSchema.safeParse(req.body).success)
    return res.status(400).json({ error: "Agree to the current Terms and Privacy Policy.", code: "terms_acceptance_invalid" });
  if (!user?.uid || !user.email || user.email_verified !== true)
    return res.status(403).json({ error: "Use your approved company's verified account.", code: "terms_acceptance_account_required" });
  try {
    const recorded = await recordCompanyTermsAcceptance({ uid: user.uid, email: user.email }, accessRecordId(user.email));
    if (!recorded) return res.status(403).json({ error: "Only an approved deployment company can accept here.", code: "terms_acceptance_not_approved" });
    return res.json({ ok: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  } catch (error) {
    logger.warn({ error }, "Could not record a company's Terms acceptance");
    return res.status(503).json({ error: "Your agreement could not be saved. Try again shortly.", code: "terms_acceptance_unavailable" });
  }
});

/** The caller's own access state, for the page to decide what to show. */
router.get("/me", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  return res.json({ access: await libraryAccessForRequest(req) });
});

export default router;
