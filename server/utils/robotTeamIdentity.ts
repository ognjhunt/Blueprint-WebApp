/**
 * One robot team, however many registry rows it has.
 *
 * ## The split
 *
 * A team reaches the registry through two doors, and each door writes its own
 * row:
 *
 * - the intake (including a robot-team evaluation request, which is submitted
 *   as an intake) writes `team_<company>` at status `applied`;
 * - the account flow writes a random-suffixed `self_registered` row and binds
 *   it to the verified account. That row holds the checkpoints, and every
 *   evaluation run carries its id.
 *
 * So the team that was evaluated and the team ops had "talked to" were two
 * records, and the recommendation route only accepted the second kind. A team
 * could pass an evaluation and still be unrecommendable.
 *
 * ## The resolution
 *
 * The canonical record is the account-bound one: it is the identity a run is
 * attributed to and the one a verified account controls. Intake rows link to
 * it by pointer (`canonicalTeamId` on the intake row, `linkedIntakeTeamIds` on
 * the account row) — never by merging answers, balances or status. Resolution
 * reads, in order of strength:
 *
 * 1. the row itself, if it is account-bound;
 * 2. an explicit `canonicalTeamId`;
 * 3. explicit link arrays written at registration or intake time;
 * 4. account-bound rows whose *verified* `accountEmail` equals this row's
 *    contact or account email.
 *
 * A self-serve row's typed `contactEmail` proves nothing and is never used to
 * pick a canonical team. If the evidence names more than one account, nothing
 * is resolved: `ambiguous` is returned and a person decides.
 *
 * Nothing here writes. It is safe to run against production data, which is
 * what `scripts/ops/report-robot-team-identity-splits.ts` does.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { ROBOT_TEAMS_COLLECTION, type RobotTeamRecord } from "../types/robot-team-registry";

export interface RobotTeamIdentity {
  /** The account-bound record recommendations and runs should name. */
  canonical: RobotTeamRecord | null;
  /** Every row that resolved to the same team, canonical included. */
  members: RobotTeamRecord[];
  ambiguous: boolean;
}

export function normalizeTeamEmail(value: unknown): string | null {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isAccountBound(record: RobotTeamRecord): boolean {
  return typeof record.accountUid === "string" && record.accountUid.length > 0;
}

/** Emails this row may be matched on: verified account email, and an intake contact. */
export function matchableEmails(record: RobotTeamRecord): string[] {
  const emails = new Set<string>();
  const account = normalizeTeamEmail(record.accountEmail);
  if (account && isAccountBound(record)) emails.add(account);
  // A self-serve row's contact email was typed at registration and is not proof.
  if (record.registrationSource !== "self_serve") {
    const contact = normalizeTeamEmail(record.contactEmail);
    if (contact) emails.add(contact);
  }
  return [...emails];
}

/**
 * Pure resolution over rows already read. `start` is the row being resolved;
 * `related` is anything that may be the same team.
 */
export function resolveIdentityFromRecords(start: RobotTeamRecord, related: readonly RobotTeamRecord[]): RobotTeamIdentity {
  const byId = new Map<string, RobotTeamRecord>([[start.id, start]]);
  for (const row of related) if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  const startEmails = new Set(matchableEmails(start));
  const explicit = new Set<string>([
    ...(start.canonicalTeamId ? [start.canonicalTeamId] : []),
    ...(start.linkedIntakeTeamIds ?? []),
    ...(start.selfServeTeamIds ?? []),
  ]);
  const linkedTo = (row: RobotTeamRecord) => row.canonicalTeamId === start.id
    || (row.linkedIntakeTeamIds ?? []).includes(start.id)
    || (row.selfServeTeamIds ?? []).includes(start.id);
  // An email links two rows only when one side is a verified account email.
  const startAccountEmail = isAccountBound(start) ? normalizeTeamEmail(start.accountEmail) : null;
  const sharesVerifiedEmail = (row: RobotTeamRecord) =>
    (isAccountBound(row) && startEmails.has(normalizeTeamEmail(row.accountEmail) ?? ""))
    || (startAccountEmail !== null && matchableEmails(row).includes(startAccountEmail));
  const members = [...byId.values()].filter(row => row.id === start.id
    || explicit.has(row.id) || linkedTo(row) || sharesVerifiedEmail(row));

  if (isAccountBound(start)) return { canonical: start, members, ambiguous: false };

  const explicitCanonical = start.canonicalTeamId ? byId.get(start.canonicalTeamId) : undefined;
  if (explicitCanonical && isAccountBound(explicitCanonical)) {
    return { canonical: explicitCanonical, members, ambiguous: false };
  }

  const bound = members.filter(isAccountBound);
  const accounts = new Set(bound.map(row => row.accountUid));
  if (accounts.size > 1) return { canonical: null, members, ambiguous: true };
  if (bound.length === 1) return { canonical: bound[0], members, ambiguous: false };
  if (bound.length > 1) {
    // One account, several bound rows: only an explicit link may choose.
    const linked = bound.filter(row => explicit.has(row.id) || linkedTo(row));
    return linked.length === 1
      ? { canonical: linked[0], members, ambiguous: false }
      : { canonical: null, members, ambiguous: true };
  }
  // Nobody bound: the row is its own team, as before.
  return { canonical: start, members, ambiguous: false };
}

/** The row is the team itself or linked to it by a written pointer, either direction. */
export function explicitlyLinked(team: RobotTeamRecord, row: RobotTeamRecord): boolean {
  return row.id === team.id
    || row.canonicalTeamId === team.id || team.canonicalTeamId === row.id
    || (team.linkedIntakeTeamIds ?? []).includes(row.id) || (row.linkedIntakeTeamIds ?? []).includes(team.id)
    || (team.selfServeTeamIds ?? []).includes(row.id) || (row.selfServeTeamIds ?? []).includes(team.id);
}

async function readTeam(id: string): Promise<RobotTeamRecord | null> {
  if (!db || !id) return null;
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).doc(id).get();
  return snapshot.exists ? ({ ...(snapshot.data() as RobotTeamRecord), id: snapshot.id }) : null;
}

async function teamsWhere(field: "accountEmail" | "contactEmail", values: string[]): Promise<RobotTeamRecord[]> {
  if (!db || !values.length) return [];
  const snapshots = await Promise.all(values.map(value =>
    db!.collection(ROBOT_TEAMS_COLLECTION).where(field, "==", value).limit(20).get()));
  return snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ ...(doc.data() as RobotTeamRecord), id: doc.id })));
}

/** Read what may be the same team and resolve it. Read-only. */
export async function resolveRobotTeamIdentity(teamId: string): Promise<RobotTeamIdentity | null> {
  const start = await readTeam(teamId);
  if (!start) return null;
  const linkedIds = [...new Set([
    ...(start.canonicalTeamId ? [start.canonicalTeamId] : []),
    ...(start.linkedIntakeTeamIds ?? []),
    ...(start.selfServeTeamIds ?? []),
  ])].filter(id => id !== start.id);
  const raw = [start.accountEmail, start.contactEmail].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const emails = [...new Set([...raw.map(value => value.trim()), ...matchableEmails(start)])];
  const [linked, byAccount, byContact] = await Promise.all([
    Promise.all(linkedIds.map(readTeam)),
    teamsWhere("accountEmail", emails),
    // Intake rows that name this account's verified email, so an account row
    // can find the intake rows (and their declined/applied state) it owns.
    isAccountBound(start) ? teamsWhere("contactEmail", emails) : Promise.resolve([]),
  ]);
  const related = [...linked.filter((row): row is RobotTeamRecord => Boolean(row)), ...byAccount,
    ...byContact.filter(row => row.registrationSource !== "self_serve")];
  return resolveIdentityFromRecords(start, related);
}

/**
 * Group every row into teams, for the read-only split report. Two rows are in
 * one group when resolution links them; a group with more than one row is a
 * split identity.
 */
export function groupRobotTeamIdentities(rows: readonly RobotTeamRecord[]): Array<{
  canonicalId: string | null;
  ambiguous: boolean;
  memberIds: string[];
}> {
  const parent = new Map<string, string>(rows.map(row => [row.id, row.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(ra, rb);
  };
  const resolutions = new Map<string, RobotTeamIdentity>();
  for (const row of rows) {
    const identity = resolveIdentityFromRecords(row, rows);
    resolutions.set(row.id, identity);
    for (const member of identity.members) union(row.id, member.id);
  }
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const root = find(row.id);
    groups.set(root, [...(groups.get(root) ?? []), row.id]);
  }
  return [...groups.values()].map(memberIds => {
    const canonicalIds = new Set(memberIds.map(id => resolutions.get(id)!.canonical?.id ?? null));
    const ambiguous = memberIds.some(id => resolutions.get(id)!.ambiguous) || canonicalIds.size > 1;
    const canonicalId = ambiguous ? null : [...canonicalIds][0] ?? null;
    return { canonicalId, ambiguous, memberIds: memberIds.sort() };
  });
}
