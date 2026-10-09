import { authAdmin } from "../../client/src/lib/firebaseAdmin";
import { MIN_PASSWORD_LENGTH } from "../../client/src/lib/passwordPolicy";
import { accessRecordId, getAccessRecordForEmail, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { createAccountInvitationToken, verifyAccountInvitationToken, type AccountInvitationPayload } from "./request-review-auth";

export class AccountInvitationError extends Error {
  constructor(public status: number, message: string, public code = "account_invitation_required") { super(message); }
}
const deny = () => { throw new AccountInvitationError(403, "Robot-team signup requires a current Blueprint invitation. Register interest and wait for approval."); };

export function robotTeamAccountInvitation(record: RobotTeamAccessRecord) {
  if (record.status !== "approved" || !record.decidedAtIso || !record.decidedBy) return deny();
  return createAccountInvitationToken({ email: record.email.trim().toLowerCase(), workspaceType: "robot_team", sourceId: accessRecordId(record.email), revision: record.decidedAtIso });
}

/** Robot approval is server-owned; public site signup has no admission gate. */
export async function resolveAccountInvitation(token: string) {
  const payload = verifyAccountInvitationToken(token);
  if (!payload || payload.workspaceType !== "robot_team") return deny();
  const email = payload.email.trim().toLowerCase();
  const record = await getAccessRecordForEmail(email);
  if (!record || record.status !== "approved" || !record.decidedBy || record.decidedAtIso !== payload.revision || accessRecordId(email) !== payload.sourceId) return deny();
  return { ...payload, email, name: record.name, organization: record.company, returnTo: "/contact/robot-team" };
}

/** Independent of client-writable profiles and library-open switches. */
export async function accountHasAdmission(email: string, workspaceType: AccountInvitationPayload["workspaceType"]) {
  if (workspaceType === "site_operator") return true;
  const record = await getAccessRecordForEmail(email);
  return Boolean(record?.status === "approved" && record.decidedBy && record.decidedAtIso);
}

/** This endpoint provisions only approved robot-team accounts. Existing credentials are never replaced. */
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
