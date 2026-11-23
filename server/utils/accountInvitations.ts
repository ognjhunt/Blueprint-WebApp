import { authAdmin } from "../../client/src/lib/firebaseAdmin";
import { accessRecordId, getAccessRecordForEmail, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { createAccountInvitationToken, verifyAccountInvitationToken, type AccountInvitationPayload } from "./request-review-auth";
import { companyJobReturnPath } from "../../client/src/lib/authReturnPath";

export class AccountInvitationError extends Error {
  constructor(public status: number, message: string, public code = "account_invitation_required") { super(message); }
}
// Shown on the sign-up page under its "get a new invitation link" (RobotTeamSignUpFlow.tsx): the company is approved
// already, or its link was never one, so it is not told to apply again.
const deny = () => { throw new AccountInvitationError(403, "This invitation link no longer works. Use the link on this page to get a new one."); };

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
  return { ...payload, email, name: record.name, organization: record.company,
    returnTo: companyJobReturnPath(record.returnToJob) ?? "/contact/robot-team" };
}

/** Independent of client-writable profiles and library-open switches. */
export async function accountHasAdmission(email: string, workspaceType: AccountInvitationPayload["workspaceType"]) {
  if (workspaceType === "site_operator") return true;
  const record = await getAccessRecordForEmail(email);
  return Boolean(record?.status === "approved" && record.decidedBy && record.decidedAtIso);
}

/**
 * This endpoint provisions only approved robot-team accounts. Existing credentials are never replaced. `link`: the
 * invitation was delivered to this address, so it creates the account with no password and signs it in (owner,
 * 2026-11-23). It does so only while no account uses the address, which makes the invitation good for one sign-in: a
 * later visit uses an emailed sign-in link (`companySignInLink.ts`), a password or Google.
 */
export async function redeemAccountInvitation(token: string, mode: "link" | "google") {
  const invitation = await resolveAccountInvitation(token);
  if (!authAdmin) throw new AccountInvitationError(503, "Account creation is temporarily unavailable.");
  let existing;
  try { existing = await authAdmin.getUserByEmail(invitation.email); }
  catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
  if (existing) {
    if (mode === "link") throw new AccountInvitationError(409, "An account already uses this email. Sign in to continue.", "account_already_exists");
    if (existing.disabled) return deny();
    return { ready: true };
  }
  // An email-derived UID also makes concurrent redemptions converge; Firebase
  // enforces both UID and email uniqueness, without storing a password in Firestore.
  const uid = `invited_${accessRecordId(invitation.email)}`;
  // The invitation is bound to this address and was delivered to it, so the
  // account starts verified: a second verification email would only delay the
  // approved team's first workspace visit and the binding of its team.
  try {
    await authAdmin.createUser({ uid, email: invitation.email, emailVerified: true, displayName: invitation.name || undefined });
  } catch (error: any) {
    if (["auth/uid-already-exists", "auth/email-already-exists"].includes(error.code)) {
      if (mode === "google") return { ready: true };
      throw new AccountInvitationError(409, "An account already uses this email. Sign in to continue.", "account_already_exists");
    }
    throw error;
  }
  return mode === "google" ? { ready: true } : { customToken: await authAdmin.createCustomToken(uid) };
}
