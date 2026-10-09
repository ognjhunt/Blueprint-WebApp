import { randomUUID } from "node:crypto";
import { dbAdmin as db, authAdmin } from "../../client/src/lib/firebaseAdmin";
import { isCurrentLegalAcceptance } from "../../client/src/lib/legalAcceptance";
import { MIN_PASSWORD_LENGTH } from "../../client/src/lib/passwordPolicy";
import { decryptInboundRequestForAdmin } from "./field-encryption";
import { accessRecordId, getAccessRecordForEmail, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { createAccountInvitationToken, createSiteClaimToken, verifyAccountInvitationToken, type AccountInvitationPayload } from "./request-review-auth";

export const SITE_ACCOUNT_ACCESS_COLLECTION = "siteAccountAccess";
export class AccountInvitationError extends Error {
  constructor(public status: number, message: string, public code = "account_invitation_required") { super(message); }
}
const deny = () => { throw new AccountInvitationError(403, "Account creation requires a current Blueprint invitation. Complete intake and wait for approval."); };

export function robotTeamAccountInvitation(record: RobotTeamAccessRecord) {
  if (record.status !== "approved" || !record.decidedAtIso || !record.decidedBy) return deny();
  return createAccountInvitationToken({ email: record.email.trim().toLowerCase(), workspaceType: "robot_team", sourceId: accessRecordId(record.email), revision: record.decidedAtIso });
}

/** Uses current server-owned intake facts; a review/claim token is not approval. */
export function siteAccountPrerequisites(record: Record<string, any>): string[] {
  const missing: string[] = [];
  if (record.request?.buyerType !== "site_operator") missing.push("A site-operator submission is required.");
  if (!record.site_task_brief_confirmed_at) missing.push("The site must confirm its job brief.");
  if (record.site_task_triage?.disposition !== "qualified") missing.push("Finish site screening and resolve its outstanding requirements.");
  if (!isCurrentLegalAcceptance(record.terms_acceptance)) missing.push("The site must accept the current Terms and Privacy Policy.");
  if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) missing.push("Current recording consent is required.");
  return missing;
}

async function siteSource(sourceId: string) {
  if (!db) throw new AccountInvitationError(503, "Account invitations are temporarily unavailable.");
  const snapshot = await db.collection("inboundRequests").doc(sourceId).get();
  if (!snapshot.exists) return deny();
  return await decryptInboundRequestForAdmin(snapshot.data() as never) as Record<string, any>;
}

export async function approveSiteAccount(requestId: string, decidedBy: string) {
  if (!db) throw new AccountInvitationError(503, "Account invitations are temporarily unavailable.");
  return db.runTransaction(async transaction => {
    const source = await transaction.get(db!.collection("inboundRequests").doc(requestId));
    if (!source.exists) throw new AccountInvitationError(404, "Site submission not found.");
    const record = await decryptInboundRequestForAdmin(source.data() as never) as Record<string, any>;
    const missing = siteAccountPrerequisites(record);
    if (missing.length) throw new AccountInvitationError(409, missing.join(" "), "account_prerequisites_incomplete");
    const email = String(record.contact?.email || "").trim().toLowerCase();
    if (!email.includes("@")) throw new AccountInvitationError(409, "The submission needs a valid operator email.");
    const ref = db!.collection(SITE_ACCOUNT_ACCESS_COLLECTION).doc(accessRecordId(email));
    const prior = (await transaction.get(ref)).data();
    const admission = prior?.status === "approved" && prior.requestId === requestId ? prior : {
      status: "approved", requestId, email, revision: randomUUID(), decidedBy, decidedAtIso: new Date().toISOString(),
    };
    transaction.set(ref, admission);
    return { admission, token: createAccountInvitationToken({ email, workspaceType: "site_operator", sourceId: requestId, revision: admission.revision }) };
  });
}

export async function resolveAccountInvitation(token: string) {
  const payload = verifyAccountInvitationToken(token);
  if (!payload) return deny();
  const email = payload.email.trim().toLowerCase();
  if (payload.workspaceType === "robot_team") {
    const record = await getAccessRecordForEmail(email);
    if (!record || record.status !== "approved" || !record.decidedBy || record.decidedAtIso !== payload.revision || accessRecordId(email) !== payload.sourceId) return deny();
    return { ...payload, email, name: record.name, organization: record.company, returnTo: "/contact/robot-team" };
  }
  if (!db) throw new AccountInvitationError(503, "Account invitations are temporarily unavailable.");
  const admission = (await db.collection(SITE_ACCOUNT_ACCESS_COLLECTION).doc(accessRecordId(email)).get()).data();
  if (admission?.status !== "approved" || admission.requestId !== payload.sourceId || admission.revision !== payload.revision || !admission.decidedBy) return deny();
  const record = await siteSource(payload.sourceId);
  if (siteAccountPrerequisites(record).length || String(record.contact?.email || "").trim().toLowerCase() !== email) return deny();
  return { ...payload, email, name: String(record.contact?.name || ""), organization: String(record.request?.siteName || record.company || "My site"), returnTo: `/claim/${createSiteClaimToken(payload.sourceId)}` };
}

/** Independent of client-writable user profile fields and library-open switches. */
export async function accountHasAdmission(email: string, workspaceType: AccountInvitationPayload["workspaceType"]) {
  if (workspaceType === "robot_team") {
    const record = await getAccessRecordForEmail(email);
    return Boolean(record?.status === "approved" && record.decidedBy && record.decidedAtIso);
  }
  if (!db || !email) return false;
  const admission = (await db.collection(SITE_ACCOUNT_ACCESS_COLLECTION).doc(accessRecordId(email)).get()).data();
  if (admission?.status !== "approved" || !admission.decidedBy || !admission.requestId) return false;
  const record = await siteSource(admission.requestId);
  return !siteAccountPrerequisites(record).length && String(record.contact?.email || "").trim().toLowerCase() === email.trim().toLowerCase();
}

/** Only the Admin SDK provisions accounts. Existing credentials are never replaced. */
export async function redeemAccountInvitation(token: string, mode: "password" | "google", password?: string) {
  const invitation = await resolveAccountInvitation(token);
  if (!authAdmin) throw new AccountInvitationError(503, "Account creation is temporarily unavailable.");
  if (mode === "password" && (!password || password.length < MIN_PASSWORD_LENGTH)) throw new AccountInvitationError(400, `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`, "weak_password");
  let existing;
  try { existing = await authAdmin.getUserByEmail(invitation.email); }
  catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
  if (existing) {
    if (mode === "password") throw new AccountInvitationError(409, "An account already uses this email. Sign in to continue.", "account_already_exists");
    if (existing.disabled) return deny();
    return { ready: true };
  }
  // An email-derived UID also makes concurrent redemptions converge; Firebase
  // enforces both UID and email uniqueness, without storing a password in Firestore.
  const uid = `invited_${accessRecordId(invitation.email)}`;
  try {
    await authAdmin.createUser({ uid, email: invitation.email, emailVerified: false, displayName: invitation.name || undefined, ...(mode === "password" ? { password } : {}) });
  } catch (error: any) {
    if (["auth/uid-already-exists", "auth/email-already-exists"].includes(error.code)) {
      if (mode === "google") return { ready: true };
      throw new AccountInvitationError(409, "An account already uses this email. Sign in to continue.", "account_already_exists");
    }
    throw error;
  }
  return mode === "google" ? { ready: true } : { customToken: await authAdmin.createCustomToken(uid) };
}
