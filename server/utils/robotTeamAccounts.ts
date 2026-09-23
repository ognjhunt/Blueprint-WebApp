/**
 * Which Blueprint account a robot team belongs to.
 *
 * ## Why paying needs an account
 *
 * Planning is open: a team (or its agent) can register, see the sites its
 * checkpoint would run against and the price, and never talk to anyone. Paying
 * and running are not. Before money moves we need to know who our customer is,
 * so a team is bound to a verified Blueprint account once, by a person, and
 * from then on its agent can spend inside the team's policy without anybody at
 * Blueprint in the loop. The autonomy goal was always about Blueprint's people,
 * not about the team never signing up.
 *
 * ## How a team gets bound
 *
 * A signed-in, email-verified account either connects the team it registered
 * on the public page (proving custody with that team's key), or issues a key
 * from account settings, which creates the team if it has none. Either way the
 * binding is written once and never moved to another account.
 */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { ROBOT_TEAMS_COLLECTION, type RobotTeamRecord } from "../types/robot-team-registry";

export interface AccountHolder {
  uid: string;
  email: string;
  verified: boolean;
}

export class TeamAccountError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
  }
}

/** Refusal body for an agent route that needs an account-bound team. */
export const TEAM_ACCOUNT_REQUIRED = {
  error:
    "Connect this team to a verified Blueprint account before paying or running. Create an "
    + "account at /signup/robot-team, verify your email, then connect the team from the plan page "
    + "or issue a key from Settings → Agent access.",
  code: "team_account_required",
} as const;

export async function teamAccountUid(teamId: string): Promise<string | null> {
  if (!db) return null;
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).doc(teamId).get();
  const uid = (snapshot.data() as RobotTeamRecord | undefined)?.accountUid;
  return typeof uid === "string" && uid ? uid : null;
}

/**
 * Where to email a team: its verified account, else the contact it registered.
 * Used for Stripe receipts and result notices.
 */
export async function teamAccountEmail(teamId: string): Promise<string | null> {
  if (!db) return null;
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).doc(teamId).get();
  const team = snapshot.data() as RobotTeamRecord | undefined;
  const email = String(team?.accountEmail || team?.contactEmail || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Bind a team to the caller's account. Idempotent for the same account; a team
 * already bound to someone else is refused rather than moved.
 */
export async function bindTeamToAccount(teamId: string, holder: AccountHolder): Promise<void> {
  if (!db) throw new TeamAccountError("The registry is unavailable.", 503, "registry_unavailable");
  if (!holder.verified) {
    throw new TeamAccountError("Verify your email before connecting a team.", 403, "account_email_unverified");
  }
  const ref = db.collection(ROBOT_TEAMS_COLLECTION).doc(teamId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new TeamAccountError("That team no longer exists.", 404, "team_not_found");
    const team = snapshot.data() as RobotTeamRecord;
    if (team.accountUid && team.accountUid !== holder.uid) {
      throw new TeamAccountError(
        "This team is already connected to another Blueprint account.",
        409,
        "team_account_taken",
      );
    }
    if (team.accountUid === holder.uid) return;
    const now = new Date().toISOString();
    transaction.update(ref, {
      accountUid: holder.uid,
      accountEmail: holder.email,
      accountBoundAtIso: now,
      updatedAt: now,
    });
  });
}

/** Teams bound to this account, newest first. */
export async function teamsForAccount(uid: string): Promise<RobotTeamRecord[]> {
  if (!db) return [];
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).where("accountUid", "==", uid).limit(20).get();
  return snapshot.docs
    .map((doc) => ({ ...(doc.data() as RobotTeamRecord), id: doc.id }))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}
