/**
 * "Email me a sign-in link" for a deployment company (owner, 2026-11-23): no password needed.
 *
 * - Asked for on the sign-in page with an email address. The answer is the same whether or not the address is known.
 * - Sent only to an address whose access record is approved, through the existing outbox, at most one per address
 *   every five minutes (a repeat inside that window adds nothing; the earlier link still works).
 * - The link is a signed token (`createAccountSignInToken`): 15 minutes, bound to the approved record and its decision
 *   revision, and spent on first use (a create-only marker per token id). A withdrawn or re-decided approval ends it.
 * - Redeeming it signs that address's account in with a Firebase custom token, the helper the invitation already uses.
 *   An account with a password or Google keeps them; an address with no account yet gets one, with no password.
 */
import { authAdmin, dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { companyJobReturnPath } from "../../client/src/lib/authReturnPath";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import { createAccountSignInToken, verifyAccountSignInToken } from "./request-review-auth";
import { accessRecordId, normalizeAccessEmail, ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";

const SIGN_IN_LINK_USES = "companySignInLinkUses";
const RESEND_WINDOW_MS = 5 * 60 * 1000;
const APP_URL = () => (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");

export class CompanySignInLinkError extends Error {
  constructor(public status: number, message: string, public code = "sign_in_link_invalid") { super(message); }
}
const refuse = () => {
  throw new CompanySignInLinkError(403, "This sign-in link no longer works. Ask for a new one on this page.");
};

function approved(record: RobotTeamAccessRecord | undefined): record is RobotTeamAccessRecord {
  return Boolean(record && record.status === "approved" && record.decidedBy && record.decidedAtIso
    && typeof record.email === "string");
}

export const SIGN_IN_LINK_EMAIL_SUBJECT = "Your Blueprint sign-in link";

export function signInLinkEmail(record: RobotTeamAccessRecord, token: string) {
  return {
    subject: SIGN_IN_LINK_EMAIL_SUBJECT,
    body: [
      emailGreeting(record.name?.trim().split(/\s+/)[0] || null),
      "",
      "Use this link to sign in to Blueprint:",
      `${APP_URL()}/sign-in?link=${encodeURIComponent(token)}`,
      "",
      "It works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

/** Queue a sign-in link if `email` is an approved company's address. Says nothing about whether it is. */
export async function requestCompanySignInLink(email: string, nowMs = Date.now()): Promise<void> {
  if (!db) throw new Error("firestore_unavailable");
  const store = db;
  const address = normalizeAccessEmail(email);
  const recordId = accessRecordId(address);
  const recordRef = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(recordId);
  const slot = Math.floor(nowMs / RESEND_WINDOW_MS);
  const outboxId = `robot_team_sign_in_link:${recordId}:${slot}`;
  const outboxRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(outboxId);
  await store.runTransaction(async (tx) => {
    const record = (await tx.get(recordRef)).data() as RobotTeamAccessRecord | undefined;
    if (!approved(record) || normalizeAccessEmail(record.email) !== address) return;
    if ((await tx.get(outboxRef)).exists) return;
    const token = createAccountSignInToken({ email: address, sourceId: recordId, revision: record.decidedAtIso! });
    const message = signInLinkEmail(record, token);
    tx.create(outboxRef, buildOutboxEntry({ idempotencyKey: outboxId, requestId: `robot-team-access:${recordId}`,
      kind: "robot_team_sign_in_link", to: address, subject: message.subject, body: message.body, replyTo: "hello@tryblueprint.io" }));
  });
}

/** Spend the link and return a custom token for its address's account, creating one with no password if none exists. */
export async function redeemCompanySignInLink(token: string): Promise<{ customToken: string; returnTo: string }> {
  const payload = verifyAccountSignInToken(token);
  if (!payload) return refuse();
  if (!db || !authAdmin) throw new CompanySignInLinkError(503, "Sign-in is temporarily unavailable. Try again shortly.", "sign_in_link_unavailable");
  const store = db, auth = authAdmin;
  const address = normalizeAccessEmail(payload.email);
  if (accessRecordId(address) !== payload.sourceId) return refuse();
  const recordRef = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(payload.sourceId);
  const useRef = store.collection(SIGN_IN_LINK_USES).doc(payload.jti);
  const record = await store.runTransaction(async (tx) => {
    const current = (await tx.get(recordRef)).data() as RobotTeamAccessRecord | undefined;
    if (!approved(current) || normalizeAccessEmail(current.email) !== address || current.decidedAtIso !== payload.revision) return null;
    if ((await tx.get(useRef)).exists) return null;
    // Spent before the account is touched: a second use of the same link is refused even if this one fails later.
    tx.create(useRef, { recordId: payload.sourceId, usedAtIso: new Date().toISOString(), expiresAtMs: payload.exp * 1000 });
    return current;
  });
  if (!record) return refuse();
  let user;
  try { user = await auth.getUserByEmail(address); }
  catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
  if (user?.disabled) return refuse();
  if (!user) {
    const uid = `invited_${payload.sourceId}`;
    try {
      user = await auth.createUser({ uid, email: address, emailVerified: true, displayName: record.name || undefined });
    } catch (error: any) {
      if (!["auth/uid-already-exists", "auth/email-already-exists"].includes(error.code)) throw error;
      user = await auth.getUserByEmail(address);
    }
  } else if (!user.emailVerified) {
    // The link reached this inbox, which proves the address as a verification email would.
    await auth.updateUser(user.uid, { emailVerified: true });
  }
  return { customToken: await auth.createCustomToken(user.uid),
    returnTo: companyJobReturnPath(record.returnToJob) ?? "/contact/robot-team" };
}
