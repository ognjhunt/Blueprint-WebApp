/**
 * The credential a robot team's agent carries.
 *
 * ## Why not a user token
 *
 * The rest of this surface authenticates a person: a Firebase token, a uid, an
 * email. An autonomous agent is not a person. It runs unattended, it spends
 * money, and the thing it acts for is a *team* — so the credential should name
 * the team, carry only the authority the team granted it, and be revocable
 * without disabling anybody's login.
 *
 * Conflating the two is how you end up with an agent inheriting whatever a
 * founder's account can do. A key issued to an agent can do exactly one
 * category of thing: read what the team is entitled to read, and commit spend
 * inside the team's own policy.
 *
 * ## The key is never stored
 *
 * Only a SHA-256 of it. The plaintext is returned once, at issue, and if the
 * team loses it they issue another — we cannot show it to them again, because
 * we do not have it. That is the same reason a password hash exists, and it
 * matters more here because this credential moves money.
 *
 * Lookup is by hash, so a stolen database gives an attacker a list of hashes
 * and no usable keys.
 */

import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const KEY_COLLECTION = "robotTeamAgentKeys";
const KEY_PREFIX = "bpk_";

export interface AgentKeyRecord {
  keyHash: string;
  teamId: string;
  /** What the team called this key, so revoking the right one is possible. */
  label: string;
  createdAtIso: string;
  lastUsedAtIso: string | null;
  revokedAtIso: string | null;
}

function hashKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext.trim()).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Issue a key. The plaintext is returned exactly once.
 *
 * 32 random bytes, base64url. Long enough that guessing is not a strategy, and
 * prefixed so a leaked key is recognisable in a log or a commit and can be
 * revoked without anyone working out what it is.
 */
export async function issueAgentKey(params: {
  teamId: string;
  label: string;
}): Promise<{ key: string; record: AgentKeyRecord } | null> {
  if (!db) return null;

  const key = `${KEY_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const record: AgentKeyRecord = {
    keyHash: hashKey(key),
    teamId: params.teamId,
    label: params.label.trim() || "agent",
    createdAtIso: nowIso(),
    lastUsedAtIso: null,
    revokedAtIso: null,
  };

  await db.collection(KEY_COLLECTION).doc(record.keyHash).set({
    ...record,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { key, record };
}

/**
 * Resolve a presented key to a team, or null.
 *
 * Null for anything wrong — unknown, revoked, malformed — without saying which.
 * A caller holding a bad key learns only that it does not work, which is all it
 * is entitled to know.
 */
export async function resolveAgentKey(presented: string | null | undefined): Promise<string | null> {
  const value = String(presented || "").trim();
  if (!value.startsWith(KEY_PREFIX) || !db) return null;

  const snapshot = await db.collection(KEY_COLLECTION).doc(hashKey(value)).get();
  if (!snapshot.exists) return null;

  const record = snapshot.data() as AgentKeyRecord;
  if (record.revokedAtIso) return null;

  // Best effort: a failed touch must not fail the request the key was for.
  void db
    .collection(KEY_COLLECTION)
    .doc(record.keyHash)
    .set({ lastUsedAtIso: nowIso() }, { merge: true })
    .catch(() => null);

  return record.teamId;
}

export async function revokeAgentKey(keyHash: string): Promise<boolean> {
  if (!db) return false;
  const ref = db.collection(KEY_COLLECTION).doc(keyHash);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  await ref.set({ revokedAtIso: nowIso() }, { merge: true });
  return true;
}

/** Keys on file for a team. The hash is included so one can be revoked by id. */
export async function listAgentKeys(teamId: string): Promise<AgentKeyRecord[]> {
  if (!db) return [];
  const snapshot = await db.collection(KEY_COLLECTION).where("teamId", "==", teamId).get();
  return snapshot.docs.map((doc) => doc.data() as AgentKeyRecord);
}

/** The bearer token on the request, from the header the manifest documents. */
export function presentedAgentKey(headers: Record<string, unknown>): string | null {
  const raw = headers["authorization"] ?? headers["Authorization"];
  const value = typeof raw === "string" ? raw : "";
  if (value.toLowerCase().startsWith("bearer ")) return value.slice(7).trim();
  const direct = headers["x-blueprint-agent-key"];
  return typeof direct === "string" ? direct.trim() : null;
}
