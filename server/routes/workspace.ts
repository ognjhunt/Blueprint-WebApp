import { taskListingSchema, listingConsentVersion } from "../utils/taskListingDetails";
import { updatePreferencesInputSchema } from "../../client/src/types/updatePreferences";
import { buildUpdatePreferences, savedUpdatePreferences, bindVerifiedPreferenceAccount } from "../utils/updatePreferences";
import { logger } from "../logger";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { RECORDING_RIGHTS_STATEMENT_VERSIONS } from "../../client/src/lib/recordingRightsStatement";
import { TASK_CONFIRMATION_VERSION } from "../../client/src/lib/taskConfirmationStatement";
import { DESCRIPTION_AUTHORITY_VERSIONS } from "../../client/src/lib/siteSubmissionAuthority";
import {
  buildLegalAcceptanceRecord,
  TERMS_VERSION,
  PRIVACY_VERSION,
  isCurrentLegalAcceptance,
  acceptedVersionsAreCurrent,
} from "../../client/src/lib/legalAcceptance";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import { submitInboundRequest } from "./inbound-request";
import { verifySiteClaimToken } from "../utils/request-review-auth";
import { object, text, iso } from "../utils/workspace-projection";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import type { InboundRequestStored } from "../types/inbound-request";

import { deploymentCatalogWithDigest } from "../../client/src/lib/deploymentEmbodimentSupport";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
import { accessRecordId, ensureApprovedTeamForAccount } from "../utils/robotTeamEarlyAccess";
import { accountHasAdmission } from "../utils/accountInvitations";
import { resolveAccessContext } from "../utils/access-control";
import { projectWebsiteCaptureWithdrawal, recordWebsiteCaptureWithdrawal } from "../utils/websiteCaptureWithdrawal";

const router = Router();
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const short = z.string().trim().min(1).max(160);
const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: error.issues.map((item) => item.message).join(" ") });
      const status = typeof error?.status === "number" ? error.status : 500;
      return res.status(status).json({
        error:
          status < 500
            ? error.message
            : "The workspace could not be updated. Please try again.",
        ...(status < 500 && typeof error?.code === "string"
          ? { code: error.code }
          : {}),
      });
    });
  };
function refuse(status: number, message: string, code?: string): never {
  throw Object.assign(new Error(message), { status, code });
}
function identity(res: Response) {
  return res.locals.workspaceIdentity as {
    uid: string;
    email: string;
    verified: boolean;
    role: "site_operator" | "robot_team";
    user: Record<string, any>;
  };
}
function requireRole(res: Response, role: "site_operator" | "robot_team") {
  if (identity(res).role !== role)
    refuse(
      403,
      `This action requires a ${role === "site_operator" ? "site" : "robot-team"} account.`,
    );
}

// Setup inspection is available to every authenticated account, including legacy
// operations/capture accounts. It only changes customer profile fields; existing
// roles, claims, rights, assignments and records are never inferred or replaced.
const accountSetupSchema = z
  .object({
    workspaceType: z.enum(["site_operator", "robot_team"]),
    name: short,
    organization: short,
    acceptedTerms: z.boolean().optional(),
    termsVersion: z.literal(TERMS_VERSION).optional(),
    privacyVersion: z.literal(PRIVACY_VERSION).optional(),
    optionalUpdates: z.boolean().optional(),
    siteClaimToken: z.string().min(1).max(4000).optional(),
  })
  .strict();
function currentTermsAccepted(user: Record<string, any>) {
  const accepted = object(user.termsAcceptance);
  // A recorded decision takes precedence over flattened compatibility fields.
  if (typeof accepted.accepted_terms === "boolean")
    return accepted.accepted_terms && acceptedVersionsAreCurrent(accepted.terms_version, accepted.privacy_version);
  return user.acceptedTerms === true && acceptedVersionsAreCurrent(user.termsVersion, user.privacyVersion);
}
// A profile with a workspace type or a legacy role is never set up as a site
// by the start form; any other signed-in account is, when it submits.
const typedProfile = (user: Record<string, any> | undefined) =>
  Boolean(user?.buyerType || user?.role || (Array.isArray(user?.roles) && user.roles.length));
function accountProjection(
  user: Record<string, any>,
  auth: Record<string, any>,
) {
  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(auth.roles) ? auth.roles : []),
  ];
  return {
    workspaceType: ["site_operator", "robot_team"].includes(user.buyerType)
      ? user.buyerType
      : null,
    profile: {
      name: text(user.name || user.displayName || auth.name),
      organization: text(
        user.company || user.organizationName || user.organization,
      ),
      email: text(auth.email),
    },
    termsRequired: !currentTermsAccepted(user),
    access: {
      operations:
        auth.admin === true ||
        auth.ops === true ||
        user.admin === true ||
        user.ops === true ||
        ["admin", "ops"].includes(user.role) ||
        roles.some((role) => ["admin", "ops"].includes(role)),
    },
  };
}
router.use(
  handle(async (_req, res, next) => {
    const auth = object(res.locals.firebaseUser);
    if (!text(auth.uid)) refuse(401, "Sign in to continue.");
    if (!db) refuse(503, "Workspace storage is unavailable. Please try again.");
    const snapshot = await db!.collection("users").doc(auth.uid).get();
    res.locals.workspaceAccount = { auth, user: object(snapshot.data()) };
    next();
  }),
);
router.get(
  "/setup",
  handle(async (_req, res) => {
    const { user, auth } = res.locals.workspaceAccount;
    const owned = user.buyerType === "site_operator"
      ? await db!.collection("inboundRequests").where("account_owner_uid", "==", auth.uid).limit(1).get()
      : null;
    return res.json({ ...accountProjection(user, auth), siteIntakeRequired: !owned?.docs.length, siteSetupAvailable: !typedProfile(user) });
  }),
);
// Internal integration planning, never the customer runnable configuration registry.
router.get("/deployment-embodiments", handle(async (_req, res) => {
  if (!(await resolveAccessContext(res)).isOps) refuse(403, "Robot integration planning is managed by Blueprint.");
  res.set("Cache-Control", "no-store");
  return res.json(await deploymentCatalogWithDigest());
}));
router.post(
  "/setup",
  handle(async (req, res) => {
    const input = accountSetupSchema.parse(req.body);
    const { auth } = res.locals.workspaceAccount;
    const staff = await resolveAccessContext(res);
    if (input.workspaceType === "robot_team" && !staff.isOps && !await accountHasAdmission(text(auth.email).toLowerCase(), "robot_team"))
      refuse(403, "Complete intake and wait for Blueprint to approve your account invitation.", "account_invitation_required");
    // Existing owners can edit settings without recovering an old link. This
    // proof comes from server-owned jobs, never a client-writable profile.
    const existingSite = input.workspaceType === "site_operator" && !staff.isOps && !input.siteClaimToken
      ? (await db!.collection("inboundRequests").where("account_owner_uid", "==", auth.uid).limit(1).get()).docs[0]?.id
      : null;
    const profileRef = db!.collection("users").doc(auth.uid);
    await db!.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef),
        user = object(snapshot.data());
      let siteIntake: Record<string, any> | null = null;
      let siteIntakeId: string | null = null;
      if (input.workspaceType === "site_operator" && !staff.isOps) {
        const claim = input.siteClaimToken ? verifySiteClaimToken(input.siteClaimToken) : existingSite ? { requestId: existingSite } : null;
        if (!claim) refuse(403, "Show us your site and job first, then create your account from the saved job.", "site_intake_required");
        const source = await transaction.get(db!.collection("inboundRequests").doc(claim.requestId));
        if (!source.exists) refuse(403, "This job link is no longer available. Start with your site and job.", "site_intake_required");
        siteIntake = await decodeWorkspaceRequest(source.data() as InboundRequestStored);
        siteIntakeId = claim.requestId;
        if (object(siteIntake.request).buyerType !== "site_operator") refuse(403, "Start with your site and job.", "site_intake_required");
        if (siteIntake.account_owner_uid !== auth.uid && (!text(auth.email) || text(object(siteIntake.contact).email).toLowerCase() !== text(auth.email).toLowerCase()))
          refuse(403, "Use the email address you submitted with this job.", "claim_email_mismatch");
        if (text(siteIntake.account_owner_uid) && siteIntake.account_owner_uid !== auth.uid)
          refuse(409, "Someone has already claimed this site.", "site_already_claimed");
      }
      const needsTerms = !currentTermsAccepted(user);
      const intakeTermsApply = Boolean(auth.email_verified === true && siteIntake && isCurrentLegalAcceptance(siteIntake.terms_acceptance));
      // Old unverified claim clients used true for prior-intake reuse. On that
      // path, creating a new record requires the displayed document versions.
      const acceptsDisplayedTerms = input.acceptedTerms === true && (auth.email_verified === true
        || (!siteIntake && !input.siteClaimToken)
        || input.termsVersion === TERMS_VERSION && input.privacyVersion === PRIVACY_VERSION);
      if (needsTerms && !intakeTermsApply && !acceptsDisplayedTerms)
        refuse(
          400,
          "Accept the Terms and Privacy Policy to set up your workspace.",
          "workspace_terms_required",
        );
      const now = admin.firestore.FieldValue.serverTimestamp();
      const termsAcceptance = needsTerms
        ? intakeTermsApply ? siteIntake!.terms_acceptance : buildLegalAcceptanceRecord({ acceptedAt: now })
        : null;
      const reuseSiteDetails = Boolean(siteIntake && input.siteClaimToken && !user.workspaceSetupCompletedAt);
      const submittedName = [siteIntake?.contact?.firstName, siteIntake?.contact?.lastName]
        .filter(value => typeof value === "string" && value.trim() && !["there", "—"].includes(value.trim().toLowerCase()))
        .join(" ").trim().slice(0, 160);
      const submittedOrganization = text(siteIntake?.contact?.company || siteIntake?.request?.siteName || siteIntake?.request?.siteLocation).trim().slice(0, 160);
      const patch = {
        name: reuseSiteDetails && submittedName ? submittedName : input.name,
        organizationName: reuseSiteDetails && submittedOrganization ? submittedOrganization : input.organization,
        company: reuseSiteDetails && submittedOrganization ? submittedOrganization : input.organization,
        buyerType: input.workspaceType,
        workspaceSetupCompletedAt: now,
        ...(!user.updatePreferences && input.optionalUpdates !== undefined ? { updatePreferences: buildUpdatePreferences({ newsletter: input.optionalUpdates, newJobAlerts: input.optionalUpdates, interests: {}, declaredCategories: {}, requirements: {} }, "signup") } : {}),
        ...(!snapshot.exists
          ? { uid: auth.uid, email: text(auth.email), createdDate: now }
          : {}),
        ...(termsAcceptance
          ? {
              acceptedTerms: true,
              termsVersion: termsAcceptance.terms_version,
              privacyVersion: termsAcceptance.privacy_version,
              termsAcceptance,
              ...(intakeTermsApply ? { termsAcceptanceSource: { kind: "site_capture_intake", requestId: siteIntakeId } } : {}),
            }
          : {}),
      };
      if (snapshot.exists) transaction.update(profileRef, patch);
      else transaction.set(profileRef, patch);
    });
    if (auth.email_verified === true && auth.email) await bindVerifiedPreferenceAccount(auth.uid, auth.email);
    // An approved robot team lands in its workspace with its team bound.
    const teamId = input.workspaceType === "robot_team" && auth.email_verified === true && text(auth.email)
      ? await ensureApprovedTeamForAccount({ uid: auth.uid, email: text(auth.email).toLowerCase(), verified: true })
        .catch((error) => { logger.warn({ error }, "Could not bind the approved account to its team at setup"); return null; })
      : null;
    return res.json({ ok: true, workspaceType: input.workspaceType, ...(teamId ? { teamId } : {}) });
  }),
);
// The start form creates a site's account with its first job, so the job is
// owned from the start and its video goes with the form (owner decision
// 2026-10-22). That job is the "site and job first" `/setup` asks for, so an
// account that has not chosen a workspace type yet becomes a site workspace
// here, accepting the Terms the form shows. A profile that already has a type
// or a legacy role is left untouched, and one from ordinary sign-up keeps the
// answers it has.
router.post(
  "/capture-start",
  handle(async (req, res, next) => {
    const { user, auth } = res.locals.workspaceAccount;
    if (typedProfile(user) || req.body?.acceptedTerms !== true) return next();
    const organization = text(req.body?.company).trim().slice(0, 160) || "My site";
    const now = admin.firestore.FieldValue.serverTimestamp();
    const profile = {
      uid: auth.uid,
      email: text(auth.email),
      createdDate: now,
      name: text(auth.email).split("@")[0] || "Site operator",
      organizationName: organization,
      company: organization,
      buyerType: "site_operator",
      workspaceSetupCompletedAt: now,
      acceptedTerms: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      termsAcceptance: buildLegalAcceptanceRecord({ acceptedAt: now }),
    };
    const profileRef = db!.collection("users").doc(auth.uid);
    const siteSetup = new Set(["buyerType", "workspaceSetupCompletedAt", "acceptedTerms", "termsVersion", "privacyVersion", "termsAcceptance"]);
    await db!.runTransaction(async (transaction) => {
      const current = (await transaction.get(profileRef)).data();
      // A type chosen since the read above is someone else's setup; keep it.
      if (typedProfile(current)) return;
      transaction.set(profileRef, Object.fromEntries(Object.entries(profile)
        .filter(([key]) => siteSetup.has(key) || current?.[key] === undefined)), { merge: true });
    });
    res.locals.workspaceAccount = { auth, user: object((await profileRef.get()).data()) };
    next();
  }),
);
router.use(
  handle(async (_req, res, next) => {
    const { user, auth } = res.locals.workspaceAccount;
    if (!["site_operator", "robot_team"].includes(user.buyerType))
      refuse(
        403,
        "Choose a workspace type to get started.",
        "workspace_setup_required",
      );
    if (user.buyerType === "robot_team" && !(await resolveAccessContext(res)).isOps && !await accountHasAdmission(text(auth.email).toLowerCase(), "robot_team"))
      refuse(403, "Robot-team access requires Blueprint approval.", "account_invitation_required");
    res.locals.workspaceIdentity = {
      uid: auth.uid,
      email: text(auth.email).toLowerCase(),
      verified: auth.email_verified === true,
      role: user.buyerType,
      user,
    };
    next();
  }),
);

async function decodeWorkspaceRequest(value: InboundRequestStored) {
  const record = (await decryptInboundRequestForAdmin(
    value,
  )) as unknown as Record<string, any>;
  // The recording grant is stored in plaintext, and the admin decrypt view
  // rebuilds `request` without it. Without it, every job read here looks as
  // if its site never granted recording, and `teamJobAccess` (which the job
  // library evaluates on the stored record) would answer differently here.
  const stored = object(object(value).request);
  if ("consent_attestation" in stored)
    record.request = { ...object(record.request), consent_attestation: stored.consent_attestation };
  return record;
}
async function readRequest(requestId: string) {
  id.parse(requestId);
  const snap = await db!.collection("inboundRequests").doc(requestId).get();
  if (!snap.exists) refuse(404, "Job not found.");
  return {
    ref: snap.ref,
    revision: snap.updateTime
      ? `${snap.updateTime.seconds}:${snap.updateTime.nanoseconds}`
      : null,
    record: await decodeWorkspaceRequest(snap.data() as InboundRequestStored),
  };
}
async function ownedTask(requestId: string, res: Response) {
  const item = await readRequest(requestId),
    caller = identity(res);
  const owner = text(item.record.account_owner_uid);
  const legacy =
    !owner &&
    caller.role === "site_operator" &&
    caller.verified &&
    caller.user.structuredIntakeRequestId === requestId &&
    text(object(item.record.contact).email).toLowerCase() === caller.email;
  if (
    !caller.verified ||
    object(item.record.request).buyerType !== "site_operator" ||
    (owner !== caller.uid && !legacy)
  )
    refuse(404, "Job not found.");
  return item;
}
async function listOwnedRequests(res: Response) {
  const caller = identity(res);
  const snapshot = await db!
    .collection("inboundRequests")
    .where("account_owner_uid", "==", caller.uid)
    .limit(100)
    .get();
  const records = await Promise.all(
    snapshot.docs.map(async (doc) => ({
      id: doc.id,
      record: await decodeWorkspaceRequest(doc.data() as InboundRequestStored),
    })),
  );
  const legacyId = text(caller.user.structuredIntakeRequestId);
  if (
    caller.role === "site_operator" &&
    legacyId &&
    !records.some((item) => item.id === legacyId)
  ) {
    try {
      const item = await ownedTask(legacyId, res);
      records.push({ id: legacyId, record: item.record });
    } catch (error) {
      if ((error as any).status !== 404) throw error;
    }
  }
  return records.sort((a, b) =>
    (iso(b.record.createdAt) || "").localeCompare(
      iso(a.record.createdAt) || "",
    ),
  );
}
/**
 * One row of the account's "Your jobs" list. The list only links each job to
 * its job page, which says where the job stands; it shows nothing more.
 */
function listedJob(requestId: string, record: Record<string, any>) {
  const request = object(record.request);
  return {
    id: requestId,
    title: text(request.taskStatement) || "Untitled job",
    siteName: text(request.siteName) || "Your site",
    location: text(request.siteLocation),
    archived: object(record.workspace_task).archived === true,
    recordingPermissionWithdrawn: projectWebsiteCaptureRights(record).consent_revoked,
    createdAt: iso(record.createdAt),
  };
}
router.get(
  "/",
  handle(async (_req, res) => {
    const caller = identity(res),
      requests = await listOwnedRequests(res);
    const tasks = (caller.verified ? requests : [])
      .filter((item) => object(item.record.request).buyerType === "site_operator")
      .map((item) => listedJob(item.id, item.record));
    const profile = {
      name: text(caller.user.name || caller.user.displayName),
      organization:
        text(
          caller.user.company ||
            caller.user.organizationName ||
            caller.user.organization,
        ) || text(caller.user.name),
      email: caller.email,
      updatePreferences: savedUpdatePreferences(caller.user.updatePreferences),
    };
    return res.json({ role: caller.role, profile, tasks });
  }),
);

function intakeIdentity(res: Response) {
  const caller = identity(res),
    fullName = text(caller.user.name || caller.user.displayName)
      .trim()
      .split(/\s+/);
  return {
    firstName: fullName[0] || "Account",
    lastName: fullName.slice(1).join(" ") || "Owner",
    company:
      text(
        caller.user.company ||
          caller.user.organizationName ||
          caller.user.organization,
      ) ||
      text(caller.user.name) ||
      "Account organization",
    email: caller.email,
    roleTitle: caller.role === "site_operator" ? "Site operator" : "Robot team",
    buyerType: caller.role,
    accountSignup: false,
    budgetBucket: "Undecided/Unsure",
    requestedLanes: [],
    context: { sourcePageUrl: "/app", utm: {} },
  };
}
/**
 * Attach a site to the signed-in account, with the claim token as proof.
 *
 * This is the identity moment the funnel otherwise lacks: intake, filming,
 * upload and the brief are all account-free by design, and the operator's
 * first contact runs on signed links. When the scene is real, the operator is
 * invited to claim it — verify the email, and the site attaches to their
 * workspace (`account_owner_uid`, the same ownership every task route reads).
 * The token proves custody of the invitation email; the signature check is
 * what stops a forwarded link from being a transfer of ownership, and a
 * claimed site refuses a second claimant outright.
 */
router.post(
  "/claim",
  handle(async (req, res) => {
    const caller = identity(res);
    if (!caller.verified)
      refuse(403, "Verify your email before claiming a site.", "claim_email_unverified");
    const token = text(String(object(req.body).token ?? ""));
    const payload = verifySiteClaimToken(token);
    if (!payload)
      refuse(400, "That claim link is not valid any more.", "claim_token_invalid");

    const item = await readRequest(payload.requestId);
    if (object(item.record.request).buyerType !== "site_operator")
      refuse(404, "Site not found.");
    const profileRef = db!.collection("users").doc(caller.uid);
    await db!.runTransaction(async (transaction) => {
      const [siteSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(item.ref), transaction.get(profileRef),
      ]);
      const site = await decodeWorkspaceRequest(siteSnapshot.data() as InboundRequestStored);
      const user = object(profileSnapshot.data());
      const owner = text(site.account_owner_uid);
      if (owner && owner !== caller.uid)
        refuse(409, "Someone has already claimed this site.", "site_already_claimed");
      const operatorEmail = text(object(site.contact).email).toLowerCase();
      if (!operatorEmail || operatorEmail !== caller.email)
        refuse(403, "Sign in with the submission email to claim this site.", "claim_email_mismatch");
      const sourceTerms = site.terms_acceptance;
      const needsTerms = !currentTermsAccepted(user);
      const intakeTermsApply = isCurrentLegalAcceptance(sourceTerms);
      if (needsTerms && !intakeTermsApply && object(req.body).acceptedTerms !== true)
        refuse(400, "Accept the Terms and Privacy Policy to claim this site.", "workspace_terms_required");
      const now = admin.firestore.FieldValue.serverTimestamp();
      const termsAcceptance = needsTerms
        ? intakeTermsApply ? sourceTerms : buildLegalAcceptanceRecord({ acceptedAt: now })
        : null;
      transaction.update(item.ref, {
        account_owner_uid: caller.uid,
        claimed_at: now,
        claimed_at_iso: new Date().toISOString(),
      });
      const profilePatch = {
        ...(caller.role === "site_operator" ? { finishedOnboarding: true, onboardingStep: "completed" } : {}),
        ...(!text(user.structuredIntakeRequestId)
          ? { structuredIntakeRequestId: payload.requestId } : {}),
        ...(termsAcceptance ? {
          acceptedTerms: true,
          termsVersion: termsAcceptance.terms_version,
          privacyVersion: termsAcceptance.privacy_version,
          termsAcceptance,
          termsAcceptanceSource: intakeTermsApply
            ? { kind: "site_capture_intake", requestId: payload.requestId }
            : { kind: "site_claim", requestId: payload.requestId },
        } : {}),
      };
      if (Object.keys(profilePatch).length > 0) transaction.update(profileRef, profilePatch);
    });
    return res.json({ ok: true, requestId: payload.requestId });
  }),
);
/**
 * A fresh private link to the task page, for its signed-in owner.
 *
 * The emailed link expires after seven days; the account is the durable way
 * back. The task page is where the brief is reviewed or edited, footage is
 * added, and the scene is opened, so the workspace hands out a new link on
 * demand rather than sending the owner to find an old email.
 */
router.post(
  "/tasks/:taskId/task-link",
  handle(async (req, res) => {
    await ownedTask(req.params.taskId, res);
    return res.json({ url: captureUploadUrlFor(req.params.taskId, "owner") });
  }),
);

// Create a new capture owned by the authenticated account. Email verification
// remains necessary to claim someone else's existing submission; a new draft
// derives its ownership from Firebase identity, never submitted account fields.
router.post(
  "/capture-start",
  handle(async (req, res) => {
    requireRole(res, "site_operator");
    const input = z.object({
      requestId: id,
      siteLocation: z.string().trim().max(300).default(""),
      taskStatement: z.string().trim().max(2000).default(""),
      siteTaskSpec: z.object({
        jobFrequency: z.string().trim().max(120).optional(),
        purchaseReadiness: z.enum(["exploring", "planning", "ready_for_proposals", "unsure"]).optional(),
      }).strict().optional(),
      publicTaskListing: z.object({ consent: z.literal(true), statementVersion: z.literal(listingConsentVersion), details: taskListingSchema }).strict().optional(),
      captureMode: z.enum(["self_capture", "site_visit"]),
      captureRegion: z.enum(["us", "non_us"]),
      hasExistingFootage: z.boolean(),
      filmerContact: z.string().email().max(320).optional(),
      consentAttestation: z.object({ granted: z.literal(true), statementVersion: z.enum(RECORDING_RIGHTS_STATEMENT_VERSIONS) }).nullable().optional(),
      descriptionOnly: z.boolean().optional(),
      acceptedTerms: z.boolean().optional(),
      descriptionAuthority: z.object({ granted: z.literal(true), statementVersion: z.enum(DESCRIPTION_AUTHORITY_VERSIONS) }).optional(),
      // The start form's one box (2026-11-07); the intake records it as the brief's confirmation.
      taskConfirmation: z.object({ granted: z.literal(true), statementVersion: z.literal(TASK_CONFIRMATION_VERSION) }).optional(),
      successCriteria: z.object({ successDefinition: z.string().trim().max(1000) }).strict().optional(),
      claudeAuthoringConsent: z.object({ granted: z.literal(true),
        statementVersion: z.literal("2026-09-24.v1") }).optional(),
      solAgentsApiConsent: z.object({ granted: z.literal(true),
        statementVersion: z.literal("2026-09-24.v1") }).optional(),
      honeypot: z.string().optional(),
    }).refine(input => input.captureMode !== "site_visit" || Boolean(input.siteLocation), {
      path: ["siteLocation"], message: "Add the street address for a Blueprint filming visit.",
    }).refine(input => Boolean(input.taskStatement)
      || (input.captureMode === "self_capture" && input.descriptionOnly !== true
        && input.consentAttestation?.granted === true)
      || (input.descriptionOnly === true && input.acceptedTerms === true
        && input.descriptionAuthority?.granted === true), {
      path: ["taskStatement"], message: "Confirm permission to prepare your recording, then upload or film the work.",
    }).parse(req.body);
    res.locals.workspaceIntake = {
      account_owner_uid: identity(res).uid,
      workspace_task: { archived: false, paused: false },
    };
    req.body = {
      ...intakeIdentity(res), ...input,
      siteName: input.siteLocation,
      taskDescription: input.taskStatement,
      siteTaskGates: {}, siteTaskSpec: input.siteTaskSpec ?? {},
    };
    return submitInboundRequest(req, res);
  }),
);
router.patch("/update-preferences", handle(async (req, res) => {
  const caller = identity(res);
  if (!caller.verified) refuse(403, "Verify your email to save update preferences.");
  const preferences = buildUpdatePreferences(updatePreferencesInputSchema.parse(req.body), "settings");
  const userRef = db!.collection("users").doc(caller.uid);
  await db!.runTransaction(async tx => {
    const contactRef = db!.collection("robotTeamAccess").doc(accessRecordId(caller.email));
    const contact = await tx.get(contactRef);
    tx.update(userRef, { updatePreferences: preferences });
    if (contact.exists) tx.update(contactRef, { preferencesAccountUid: caller.uid, newJobAlertsOptIn: preferences.newJobAlerts });
  });
  return res.json({ ok: true });
}));
router.patch(
  "/profile",
  handle(async (req, res) => {
    const input = z
      .object({ name: short, organization: short })
      .strict()
      .parse(req.body);
    await db!
      .collection("users")
      .doc(identity(res).uid)
      .update({ name: input.name, company: input.organization });
    return res.json({ ok: true });
  }),
);
/** Owner-only withdrawal. The same effect backs the signed owner link; deletion
 * is reported only once the deletion worker's receipt confirms it. */
router.post("/tasks/:taskId/recording-consent/withdraw", handle(async (req, res) => {
  await ownedTask(req.params.taskId, res);
  const caller = identity(res);
  const { withdrawal } = await recordWebsiteCaptureWithdrawal({ requestId: req.params.taskId, requestedBy: caller.uid,
    authorize: record => {
      if (!record || record.account_owner_uid !== caller.uid) refuse(403, "Only the verified site owner can withdraw recording permission.");
    } });
  return res.status(202).json({ ok: true, receipt: withdrawal, withdrawal: projectWebsiteCaptureWithdrawal(withdrawal) });
}));
export default router;
