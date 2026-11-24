/**
 * The robot-team early-access application.
 *
 * Public and CSRF-protected. It records the application, checks a new deployment
 * company against the published rule (`utils/companyCheck.ts`: approved at once
 * when the rule settles it) and rings the team's Slack with the result. A person
 * decides everything else in `/admin/robot-team-access`, with one press.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { logger } from "../logger";
import {
  accessRecordId,
  recordAccessApplication,
  requestAccessInvitation,
} from "../utils/robotTeamEarlyAccess";
import { recordCompanyTermsAcceptance } from "../utils/companyTerms";
import { CompanySignInLinkError, redeemCompanySignInLink, requestCompanySignInLink } from "../utils/companySignInLink";
import { shownVersionsCount } from "../../client/src/lib/legalAcceptance";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { libraryAccessForRequest } from "../utils/robotTeamLibraryAccess";
import { notifySlackRobotTeamAccessApplication } from "../utils/slack";
import { checkNewCompanyApplication } from "../utils/companyCheck";
import { companyJobReturnPath } from "../../client/src/lib/authReturnPath";
import { clientIp } from "../utils/clientIp";
import { APPLICATION_NAME_HOLDS_CONTACT, APPLICATION_WEBSITE_NOT_OWN, applicantNameHoldsContactDetails, applicantWebsiteProblem }
  from "../../client/src/lib/companyApplicant";

const router = Router();

const applyLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

const text = (max: number) => z.string().trim().min(1).max(max);

export const applicationSchema = z
  .object({
    name: text(120),
    email: z.string().trim().email().max(320),
    company: text(160),
    website: text(300).refine(value => /^https?:\/\//i.test(value) && URL.canParse(value), {
      message: "Use a full http:// or https:// website address.",
    }).refine(value => applicantWebsiteProblem(value) === null, { message: APPLICATION_WEBSITE_NOT_OWN }),
    partnerRole: z.enum(["deployment", "technology"]).optional(),
    returnToJob: z.string().max(130).transform(path => companyJobReturnPath(path) ?? undefined).optional(),
  })
  .strict()
  // The site reads the company's name before it presses Accept, so the name carries no contact detail (stress test
  // round 2, 2026-11-24: "Zed Robotics · call 415 555 0199").
  .superRefine((value, context) => {
    if (applicantNameHoldsContactDetails(value.company, value.website))
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["company"], message: APPLICATION_NAME_HOLDS_CONTACT });
  });

/** What the application form is told when it cannot be recorded as sent: the field that failed, plainly. */
export function applicationRefusal(issues: ReadonlyArray<{ code: string; path: ReadonlyArray<PropertyKey>; message: string }>): string {
  const own = issues.find(issue => issue.message === APPLICATION_NAME_HOLDS_CONTACT || issue.message === APPLICATION_WEBSITE_NOT_OWN);
  return own?.message ?? "Check the form. Every field is needed, and the website must start with https:// or http://.";
}

/**
 * New applications from one client address in a UTC day (stress test round 2, 2026-11-24: a hundred junk applications
 * from a handful of addresses). The in-memory limiter bounds a minute; this bounds a day across restarts. Each email
 * counts once a day, so an application sent again is not charged twice. The automatic check has its own share per
 * email domain (`companyCheck.ts`).
 */
export const APPLICATIONS_PER_ADDRESS_DAILY = 20;

/** "a minute", "12 minutes", "3 hours": how long to wait, rounded up. */
export function waitInWords(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes === 1) return "a minute";
  if (minutes < 90) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hours`;
}

router.post("/apply", applyLimiter, async (req: Request, res: Response) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: applicationRefusal(parsed.error.issues), code: "application_invalid" });
  }
  // The same answer for every application from an address over its day, decided or not, so it reveals nothing.
  const { consumeDailyCaps } = await import("../utils/durableDailyCaps");
  const admitted = await consumeDailyCaps({ scope: "company_application", failClosed: false,
    caps: [{ name: "company_application_address", limit: APPLICATIONS_PER_ADDRESS_DAILY, subject: clientIp(req) }],
    idempotencyKey: parsed.data.email.trim().toLowerCase() });
  if (!admitted.allowed) {
    res.set("Retry-After", String(admitted.retryAfterSeconds));
    return res.status(429).json({ code: "application_rate_limited", retryAfterSeconds: admitted.retryAfterSeconds,
      error: `Too many applications from this network today. Try again in ${waitInWords(admitted.retryAfterSeconds)}.` });
  }
  const { returnToJob, ...fields } = parsed.data;
  const application = { ...fields, ...(returnToJob ? { returnToJob } : {}) };
  try {
    // Nothing is agreed on this unsigned form (owner, 2026-11-23): every company agrees once, signed in, on its first
    // visit, before it sees any job (G1).
    const { record, created, unchanged, notification } = await recordAccessApplication(application);
    // A decided record is left as it is, and the answer is the same as for a new application (G1).
    if (unchanged) return res.status(202).json({ status: "applied", notificationStatus: "not_requested" });
    // No receipt by email: the page says the application was received and when the answer comes (owner, 2026-11-23).
    // A new deployment company is checked against the published rule once, after this answer (owner direction
    // 2026-11-23: approval in minutes, not days); the check rings Slack with what it found. A technology partner is
    // never approved by the rule and gets the plain bell.
    if (created) {
      if (record.partnerRole === "technology") {
        void notifySlackRobotTeamAccessApplication({ email: record.email, autoApproved: false }).catch(() => undefined);
      } else {
        void checkNewCompanyApplication(record).catch(() => undefined);
      }
    }
    return res.status(202).json({ status: record.status, notificationStatus: notification.status });
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
    return res.status(400).json({ error: "Enter the email address your company was approved with.", code: "invitation_request_invalid" });
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
 * "Email me a sign-in link" (owner, 2026-11-23): the same answer whether or not the address is an approved company's,
 * and the same rate limit as the application. The link itself is single use and lasts 15 minutes.
 */
export const SIGN_IN_LINK_ANSWER = { ok: true,
  message: "If that address belongs to an approved deployment company, we have emailed it a sign-in link. It works once, for 15 minutes." };
router.post("/sign-in-link", applyLimiter, async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const parsed = invitationRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email address.", code: "sign_in_link_request_invalid" });
  try {
    await requestCompanySignInLink(parsed.data.email);
  } catch (error) {
    logger.warn({ error }, "Could not queue a company sign-in link");
    return res.status(503).json({ error: "The link could not be sent. Try again shortly.", code: "sign_in_link_unavailable" });
  }
  return res.status(202).json(SIGN_IN_LINK_ANSWER);
});

const signInLinkRedeemSchema = z.object({ link: z.string().min(1).max(2000) }).strict();
router.post("/sign-in-link/redeem", applyLimiter, async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  const parsed = signInLinkRedeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "This sign-in link no longer works. Ask for a new one on this page.", code: "sign_in_link_invalid" });
  try {
    return res.json(await redeemCompanySignInLink(parsed.data.link));
  } catch (error) {
    if (error instanceof CompanySignInLinkError) return res.status(error.status).json({ error: error.message, code: error.code });
    logger.warn({ error }, "Could not redeem a company sign-in link");
    return res.status(503).json({ error: "Sign-in is temporarily unavailable. Try again shortly.", code: "sign_in_link_unavailable" });
  }
});

/**
 * An approved deployment company accepts the current Terms and Privacy Policy before it sees any job. Recorded on its
 * account and its access record (`companyTerms.ts`), with the versions taken from the server, never the client.
 */
const TERMS_ACCEPTANCE_INVALID = { error: "Agree to the current Terms and Privacy Policy.", code: "terms_acceptance_invalid" };
const acceptTermsSchema = z.object({ acceptedTerms: z.literal(true), termsVersion: z.string().max(40),
  privacyVersion: z.string().max(40) }).strict();
router.post("/accept-terms", applyLimiter, verifyFirebaseToken, async (req: Request, res: Response) => {
  const user = res.locals.firebaseUser;
  const body = acceptTermsSchema.safeParse(req.body);
  // The versions the prompt showed, recorded exactly when they still count as current; refused otherwise.
  const shown = body.success ? shownVersionsCount(body.data.termsVersion, body.data.privacyVersion) : null;
  if (!shown) return res.status(400).json(TERMS_ACCEPTANCE_INVALID);
  if (!user?.uid || !user.email || user.email_verified !== true)
    return res.status(403).json({ error: "Use your approved company's verified account.", code: "terms_acceptance_account_required" });
  try {
    const recorded = await recordCompanyTermsAcceptance({ uid: user.uid, email: user.email }, accessRecordId(user.email), shown);
    if (!recorded) return res.status(403).json({ error: "Only an approved deployment company can accept here.", code: "terms_acceptance_not_approved" });
    // Jobs sent before this company could see them: one email about them, once (audit B-03). Best effort.
    const companyId = accessRecordId(user.email);
    await import("../utils/jobAutoSend").then(({ emailOpenJobsToCompany }) => emailOpenJobsToCompany(companyId))
      .catch(() => false);
    return res.json({ ok: true, termsVersion: shown.terms_version, privacyVersion: shown.privacy_version });
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
