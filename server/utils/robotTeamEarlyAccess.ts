/**
 * Early access for robot teams.
 *
 * Blueprint opens to robot teams a few at a time. Until a team is approved
 * (by a person, or by the fit checklist for a clear fit) it sees no site tasks: not
 * the library, not a plan, not the site catalog. Approval is by verified
 * email, recorded server-side in a collection clients cannot read or write,
 * because a flag on `users/{uid}` would be client-writable.
 *
 * Opening up later is one switch: `BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS=0`.
 */
import { createHash } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { AccessFit } from "./robotTeamAccessFit";
import { getRobotTeam } from "./robotTeamRegistry";

export const ROBOT_TEAM_ACCESS_COLLECTION = "robotTeamAccess";

export type RobotTeamAccessStatus = "applied" | "approved" | "declined";

export interface RobotTeamAccessApplication {
  name: string;
  email: string;
  company: string;
  website: string | null;
  robot: string;
  workWanted: string;
  region: string | null;
  /** A site or customer the team would want to test at: a lead for the site side. */
  testSite?: string | null;
}

export interface RobotTeamAccessRecord extends RobotTeamAccessApplication {
  /** "invite" when a person granted access after a call, rather than on an application. */
  source?: "application" | "invite";
  /** The fit checklist as it stood on the latest application. */
  fit?: AccessFit | null;
  status: RobotTeamAccessStatus;
  appliedAtIso: string;
  updatedAtIso: string;
  decidedAtIso: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

/** What a viewer of the task library is allowed to see, and why. */
export interface LibraryAccess {
  /** False once the library is opened to everyone. */
  gated: boolean;
  /** "approved" is the only status that sees tasks. */
  status: RobotTeamAccessStatus | "none";
  signedIn: boolean;
  emailVerified: boolean;
  /** True when the viewer may see site tasks. */
  allowed: boolean;
  /** Blueprint staff (admin/ops), who also see records no team is shown. */
  staff: boolean;
}

const APP_URL = () => (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");

export const EARLY_ACCESS_REQUIRED = {
  error:
    "Blueprint is in early access for robot teams. Site tasks are shown to approved teams only; apply and your application will be reviewed.",
  code: "early_access_required",
  get apply() {
    return `${APP_URL()}/contact/robot-team`;
  },
} as const;

const OPEN_VALUES = new Set(["0", "false", "no", "off", "open"]);

/** On unless explicitly opened, so a missing variable never exposes sites. */
export function isRobotTeamEarlyAccessGated(): boolean {
  const value = String(process.env.BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS ?? "").trim().toLowerCase();
  return !OPEN_VALUES.has(value);
}

export function normalizeAccessEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function accessRecordId(email: string): string {
  return createHash("sha256").update(normalizeAccessEmail(email)).digest("hex");
}

export async function getAccessRecordForEmail(email: string | null | undefined): Promise<RobotTeamAccessRecord | null> {
  if (!db || !email) return null;
  const snap = await db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(accessRecordId(email)).get();
  return snap.exists ? (snap.data() as RobotTeamAccessRecord) : null;
}

/**
 * Record an application. A second application from the same address updates
 * the details but never undoes a decision: an approved team stays approved,
 * and a declined one is reopened for review.
 */
export async function recordAccessApplication(
  application: RobotTeamAccessApplication,
  options: { fit?: AccessFit | null } = {},
): Promise<{ record: RobotTeamAccessRecord; created: boolean }> {
  if (!db) throw new Error("firestore_unavailable");
  const email = normalizeAccessEmail(application.email);
  const ref = db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(accessRecordId(email));
  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const prior = existing.exists ? (existing.data() as RobotTeamAccessRecord) : null;
    const record: RobotTeamAccessRecord = {
      ...application,
      email,
      testSite: application.testSite ?? null,
      source: prior?.source ?? "application",
      fit: options.fit ?? null,
      status: prior?.status === "approved" ? "approved" : "applied",
      appliedAtIso: prior?.appliedAtIso ?? now,
      updatedAtIso: now,
      decidedAtIso: prior?.status === "approved" ? prior.decidedAtIso : null,
      decidedBy: prior?.status === "approved" ? prior.decidedBy : null,
      decisionNote: prior?.status === "approved" ? prior.decisionNote : null,
    };
    tx.set(ref, record);
    return { record, created: !prior };
  });
}

export async function decideAccessApplication(params: {
  id: string;
  status: Exclude<RobotTeamAccessStatus, "applied">;
  note: string | null;
  decidedBy: string;
}): Promise<RobotTeamAccessRecord | null> {
  if (!db) throw new Error("firestore_unavailable");
  const ref = db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const now = new Date().toISOString();
  const update = {
    status: params.status,
    decidedAtIso: now,
    decidedBy: params.decidedBy,
    decisionNote: params.note,
    updatedAtIso: now,
  };
  await ref.set(update, { merge: true });
  return { ...(snap.data() as RobotTeamAccessRecord), ...update };
}

/**
 * Grant access to a team a person already spoke with: the outbound path.
 * It is bound to the email exactly as an approval is, so it cannot be passed
 * on the way an invite code can. An existing approval is kept as it was.
 */
export async function inviteRobotTeam(params: {
  name: string;
  email: string;
  company: string;
  note: string | null;
  invitedBy: string;
}): Promise<{ record: RobotTeamAccessRecord; created: boolean; alreadyApproved: boolean }> {
  if (!db) throw new Error("firestore_unavailable");
  const email = normalizeAccessEmail(params.email);
  const ref = db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(accessRecordId(email));
  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const prior = existing.exists ? (existing.data() as RobotTeamAccessRecord) : null;
    if (prior?.status === "approved") return { record: prior, created: false, alreadyApproved: true };
    const record: RobotTeamAccessRecord = {
      name: params.name,
      email,
      company: params.company,
      website: prior?.website ?? null,
      robot: prior?.robot ?? "",
      workWanted: prior?.workWanted ?? params.note ?? "",
      region: prior?.region ?? null,
      testSite: prior?.testSite ?? null,
      source: prior?.source ?? "invite",
      fit: prior?.fit ?? null,
      status: "approved",
      appliedAtIso: prior?.appliedAtIso ?? now,
      updatedAtIso: now,
      decidedAtIso: now,
      decidedBy: params.invitedBy,
      decisionNote: params.note,
    };
    tx.set(ref, record);
    return { record, created: !prior, alreadyApproved: false };
  });
}

export async function listAccessApplications(limit = 200): Promise<Array<RobotTeamAccessRecord & { id: string }>> {
  if (!db) return [];
  const snap = await db.collection(ROBOT_TEAM_ACCESS_COLLECTION).orderBy("updatedAtIso", "desc").limit(limit).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RobotTeamAccessRecord) }));
}

type ViewerIdentity = {
  email: string | null;
  emailVerified: boolean;
  isOps: boolean;
} | null;

/**
 * What a signed-in (or anonymous) viewer of the library may see. Staff always
 * see it, so the people matching teams to sites can see what teams would.
 * Access needs a verified email: an unverified address is anyone's to type.
 */
export async function resolveViewerAccess(viewer: ViewerIdentity): Promise<LibraryAccess> {
  const gated = isRobotTeamEarlyAccessGated();
  const signedIn = Boolean(viewer);
  const emailVerified = Boolean(viewer?.emailVerified);
  const staff = Boolean(viewer?.isOps);
  if (!gated || staff) return { gated, status: "approved", signedIn, emailVerified, allowed: true, staff };
  if (!viewer) return { gated, status: "none", signedIn, emailVerified, allowed: false, staff };

  let record: RobotTeamAccessRecord | null = null;
  try {
    record = await getAccessRecordForEmail(viewer.email);
  } catch (error) {
    logger.warn({ error }, "Could not read robot-team access; treating as not approved");
  }
  const status = record?.status ?? "none";
  return { gated, status, signedIn, emailVerified, allowed: status === "approved" && emailVerified, staff };
}

/**
 * Whether an agent-key team may see site tasks. The team must be bound to a
 * verified account whose email is approved; the contact email a team typed at
 * registration proves nothing.
 */
export async function teamHasEarlyAccess(teamId: string): Promise<boolean> {
  if (!isRobotTeamEarlyAccessGated()) return true;
  try {
    // Only the email of a verified account the team is bound to. The contact
    // email typed at registration (which `teamAccountEmail` falls back to for
    // receipts) proves nothing and must never grant access.
    const team = await getRobotTeam(teamId);
    const email = team?.accountUid ? team.accountEmail : null;
    if (!email) return false;
    const record = await getAccessRecordForEmail(email);
    return record?.status === "approved";
  } catch (error) {
    logger.warn({ error, teamId }, "Could not check robot-team early access; refusing");
    return false;
  }
}
