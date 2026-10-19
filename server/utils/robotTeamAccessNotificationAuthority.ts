import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { ROBOT_TEAM_ACCESS_COLLECTION, normalizeAccessEmail, type RobotTeamAccessStatus } from "./robotTeamEarlyAccess";
import type { OutboxEntry } from "./captureOutbox";

export type RobotTeamAccessNoticeContext = {
  schemaVersion: "robot_team_access_notice.v1";
  recordId: string;
  status: RobotTeamAccessStatus;
  revision: string;
};

/** Read current manual admission in the existing dispatch transaction. A
 * withdrawal/reapproval cannot send a notice for the previous revision. */
export async function robotTeamAccessNotificationAuthority(
  entry: Pick<OutboxEntry, "kind" | "requestId" | "idempotencyKey" | "to" | "robotTeamAccessNotice">,
  transaction: FirebaseFirestore.Transaction,
): Promise<"current" | "obsolete" | "review_required"> {
  const expectedStatus = entry.kind === "robot_team_access_approved" ? "approved"
    : entry.kind === "robot_team_access_not_yet" ? "declined"
      : entry.kind === "robot_team_access_received" ? "applied" : null;
  if (!expectedStatus) return "current";
  if (!db) return "review_required";
  const recordId = /^robot-team-access:([a-f0-9]{64})$/.exec(entry.requestId)?.[1];
  if (!recordId) return "review_required";
  const record = (await transaction.get(db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(recordId))).data();
  if (!record || record.status !== expectedStatus || typeof record.email !== "string"
    || normalizeAccessEmail(record.email) !== normalizeAccessEmail(entry.to)) return "obsolete";
  const revision = expectedStatus === "applied" ? record.appliedAtIso : record.decidedAtIso;
  if (typeof revision !== "string" || !Number.isFinite(Date.parse(revision))) return "review_required";
  if (expectedStatus !== "applied" && !record.decidedBy) return "review_required";
  const context = entry.robotTeamAccessNotice;
  if (context) {
    if (context.schemaVersion !== "robot_team_access_notice.v1" || context.recordId !== recordId
      || context.status !== expectedStatus || typeof context.revision !== "string") return "review_required";
    return context.revision === revision ? "current" : "obsolete";
  }
  // Original receipt/decision keys contain their exact revision. Keep those
  // legacy notices usable. Hourly resend keys do not establish which approval
  // their signed link belongs to, so preserve them for review instead of sending
  // an unverifiable invitation or silently rewriting its retained message.
  return entry.idempotencyKey === `${entry.kind}:${recordId}:${revision}` ? "current" : "review_required";
}
