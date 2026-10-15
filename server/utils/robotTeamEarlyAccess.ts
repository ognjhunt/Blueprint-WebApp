/**
 * Early access for robot teams.
 *
 * Blueprint opens to robot teams a few at a time. Until a team is approved
 * (by a person for the invited beta) it sees no site tasks: not
 * the library, not a plan, not the site catalog. A person approves an
 * application, recorded server-side in a collection clients cannot read or
 * write, because a flag on `users/{uid}` would be client-writable.
 *
 * The approval then belongs to the team, not to an email address. When the
 * approved, verified account first signs in (or registers with its invitation)
 * the application is bound to the team record (`accessApproval` on the team,
 * `teamIds` on the application), and from then on access is a question about
 * the team: its bound account and its agent keys see jobs while the
 * application stays approved. Approvals given before this binding existed are
 * bound to the account's teams the first time they are used.
 *
 * Opening up later is one switch: `BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS=0`.
 */
import { createHash } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { UpdatePreferences } from "../../client/src/types/updatePreferences";
import { buildUpdatePreferences } from "./updatePreferences";
import type { AccessFit } from "./robotTeamAccessFit";
import { getRobotTeam, registerSelfServeTeam } from "./robotTeamRegistry";
import { bindTeamToAccount, teamsForAccount, type AccountHolder } from "./robotTeamAccounts";
import { ROBOT_TEAMS_COLLECTION, type RobotTeamRecord } from "../types/robot-team-registry";

export const ROBOT_TEAM_ACCESS_COLLECTION = "robotTeamAccess";

export type RobotTeamAccessStatus = "applied" | "approved" | "declined";

export interface RobotTeamAccessApplication {
  optionalUpdates?: boolean;
  name: string;
  email: string;
  company: string;
  website: string | null;
  robot: string;
  workWanted: string;
  region: string | null;
  /** Private, provider-supplied starting point; never a binding site quote. */
  pilotPackage?: string | null;
  /** A site or customer the team would want to test at: a lead for the site side. */
  testSite?: string | null;
}

export interface RobotTeamAccessRecord extends RobotTeamAccessApplication {
  /** "invite" when a person granted access after a call, rather than on an application. */
  updatePreferences?: UpdatePreferences;
  preferencesAccountUid?: string;
  newJobAlertsOptIn?: boolean;
  source?: "application" | "invite";
  /** The fit checklist as it stood on the latest application. */
  fit?: AccessFit | null;
  status: RobotTeamAccessStatus;
  appliedAtIso: string;
  updatedAtIso: string;
  decidedAtIso: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  /** The teams this approval covers. Written only by `bindAccessApprovalToTeam`. */
  teamIds?: string[];
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
    "Blueprint is in early access for robot teams. Site tasks are shown to approved teams only; register interest for manual review when a real task fits.",
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
      newJobAlertsOptIn: prior?.newJobAlertsOptIn ?? (!prior && application.optionalUpdates === true),
      ...(prior?.updatePreferences ? { updatePreferences: prior.updatePreferences } : !prior && application.optionalUpdates !== undefined
        ? { updatePreferences: buildUpdatePreferences({ newsletter: application.optionalUpdates, newJobAlerts: application.optionalUpdates, interests: {}, declaredCategories: {}, requirements: {} }, "application") } : {}),
      ...(prior?.preferencesAccountUid ? { preferencesAccountUid: prior.preferencesAccountUid } : {}),
      email,
      testSite: application.testSite ?? null,
      pilotPackage: application.pilotPackage ?? null,
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
      ...(prior?.updatePreferences ? { updatePreferences: prior.updatePreferences } : {}),
      ...(prior?.preferencesAccountUid ? { preferencesAccountUid: prior.preferencesAccountUid } : {}),
      newJobAlertsOptIn: prior?.newJobAlertsOptIn ?? false,
      name: params.name,
      email,
      company: params.company,
      website: prior?.website ?? null,
      robot: prior?.robot ?? "",
      workWanted: prior?.workWanted ?? params.note ?? "",
      region: prior?.region ?? null,
      testSite: prior?.testSite ?? null,
      pilotPackage: prior?.pilotPackage ?? null,
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
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
  isOps: boolean;
} | null;

/**
 * Bind an approved application to a team: the team record carries the
 * approval and the application lists the team. Idempotent. A team already
 * covered by a different application keeps that one.
 */
export async function bindAccessApprovalToTeam(recordId: string, teamId: string): Promise<boolean> {
  if (!db) return false;
  const recordRef = db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(recordId);
  const teamRef = db.collection(ROBOT_TEAMS_COLLECTION).doc(teamId);
  return db.runTransaction(async (tx) => {
    const recordSnap = await tx.get(recordRef);
    const teamSnap = await tx.get(teamRef);
    const record = recordSnap.exists ? (recordSnap.data() as RobotTeamAccessRecord) : null;
    if (record?.status !== "approved" || !teamSnap.exists) return false;
    const current = (teamSnap.data() as RobotTeamRecord).accessApproval;
    if (current && current.accessRecordId !== recordId) return false;
    const now = new Date().toISOString();
    if (!current) {
      tx.set(teamRef, {
        accessApproval: {
          accessRecordId: recordId,
          approvedBy: record.decidedBy ?? null,
          approvedAtIso: record.decidedAtIso ?? null,
          boundAtIso: now,
        },
        updatedAt: now,
      }, { merge: true });
    }
    if (!(record.teamIds ?? []).includes(teamId)) {
      tx.set(recordRef, { teamIds: [...(record.teamIds ?? []), teamId] }, { merge: true });
    }
    return true;
  });
}

/**
 * The teams an approval covers. An approval given before approvals were bound
 * to teams covers none yet; it is bound first to the teams its approved
 * account already holds, so registering another team cannot strand them.
 */
export async function teamsCoveredByApproval(email: string): Promise<string[]> {
  if (!db) return [];
  const normalized = normalizeAccessEmail(email);
  const record = await getAccessRecordForEmail(normalized);
  if (record?.status !== "approved") return [];
  if ((record.teamIds ?? []).length) return record.teamIds!;
  const held = await db.collection(ROBOT_TEAMS_COLLECTION).where("accountEmail", "==", normalized).limit(20).get();
  const covered: string[] = [];
  for (const doc of held.docs) {
    if (!(doc.data() as RobotTeamRecord).accountUid) continue;
    if (await bindAccessApprovalToTeam(accessRecordId(normalized), doc.id)) covered.push(doc.id);
  }
  return covered;
}

/** Whether a team's own approval stands: the application it is bound to is still approved. */
async function teamApprovalStands(team: RobotTeamRecord): Promise<boolean> {
  const recordId = team.accessApproval?.accessRecordId;
  if (!db || !recordId) return false;
  const snap = await db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(recordId).get();
  return snap.exists && (snap.data() as RobotTeamAccessRecord).status === "approved";
}

// One binding per account at a time on this instance, so the library, the
// workspace and account setup arriving together create one team, not three.
const ensuring = new Map<string, Promise<string | null>>();

/**
 * The team an approved, verified account acts for, with the approval bound to
 * it. In order: a team of this account the approval already covers; a team
 * the approval covers that no account holds yet (registered with the
 * invitation), which this account takes; the account's existing teams, for an
 * approval given before approvals were bound to teams; otherwise a new team
 * under the approved company name. Null when the account is not approved or
 * not verified, or the approval covers a team another account holds.
 */
export function ensureApprovedTeamForAccount(holder: AccountHolder): Promise<string | null> {
  const key = holder.uid;
  const previous = ensuring.get(key) ?? Promise.resolve(null);
  const next = previous.catch(() => null).then(() => ensureApprovedTeamOnce(holder));
  ensuring.set(key, next);
  return next.finally(() => { if (ensuring.get(key) === next) ensuring.delete(key); });
}

async function ensureApprovedTeamOnce(holder: AccountHolder): Promise<string | null> {
  if (!db || !holder.verified || !holder.uid || !holder.email) return null;
  const email = normalizeAccessEmail(holder.email);
  const recordId = accessRecordId(email);
  const record = await getAccessRecordForEmail(email);
  if (record?.status !== "approved") return null;
  const owned = await teamsForAccount(holder.uid);
  const covered = owned.find((team) => team.accessApproval?.accessRecordId === recordId);
  if (covered) return covered.id;
  for (const teamId of record.teamIds ?? []) {
    const team = await getRobotTeam(teamId);
    if (!team) continue;
    if (team.accountUid === holder.uid) return teamId;
    if (!team.accountUid) {
      await bindTeamToAccount(teamId, { ...holder, email });
      return teamId;
    }
  }
  if ((record.teamIds ?? []).length) return null;
  if (owned.length) {
    let bound: string | null = null;
    for (const team of owned) {
      if (await bindAccessApprovalToTeam(recordId, team.id)) bound ??= team.id;
    }
    return bound;
  }
  const created = await registerSelfServeTeam({
    name: record.company?.trim() || email.split("@")[1] || "Robot team",
    contactEmail: email,
  });
  if (!created) return null;
  await bindTeamToAccount(created.id, { ...holder, email });
  await bindAccessApprovalToTeam(recordId, created.id);
  return created.id;
}

/**
 * What a signed-in (or anonymous) viewer of the library may see. Staff always
 * see it, so the people recommending teams to sites can see what teams would.
 * Access needs a verified email (an unverified address is anyone's to type)
 * and a team the approval covers, which an approved account is bound to on
 * first use.
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
  let allowed = false;
  if (status === "approved" && emailVerified && viewer.uid && viewer.email) {
    try {
      allowed = Boolean(await ensureApprovedTeamForAccount({ uid: viewer.uid, email: viewer.email, verified: true }));
    } catch (error) {
      logger.warn({ error }, "Could not bind the approved account to its team; treating as not approved");
    }
  }
  return { gated, status, signedIn, emailVerified, allowed, staff };
}

/**
 * Whether an agent-key team may see site tasks: the team's own approval
 * stands. The contact email a team typed at registration proves nothing.
 */
export async function teamHasEarlyAccess(teamId: string): Promise<boolean> {
  if (!isRobotTeamEarlyAccessGated()) return true;
  try {
    const team = await getRobotTeam(teamId);
    if (!team) return false;
    if (team.accessApproval) return await teamApprovalStands(team);
    // An approval given before approvals were bound to teams: the team is
    // bound to the verified account of an approved application that covers no
    // team yet. Bind it to every team that account holds now, once.
    const email = team.accountUid ? team.accountEmail : null;
    if (!email) return false;
    const record = await getAccessRecordForEmail(email);
    if (record?.status !== "approved" || (record.teamIds ?? []).length) return false;
    const recordId = accessRecordId(email);
    for (const owned of await teamsForAccount(team.accountUid!)) {
      if (owned.id !== teamId) await bindAccessApprovalToTeam(recordId, owned.id);
    }
    return await bindAccessApprovalToTeam(recordId, teamId);
  } catch (error) {
    logger.warn({ error, teamId }, "Could not check robot-team early access; refusing");
    return false;
  }
}
