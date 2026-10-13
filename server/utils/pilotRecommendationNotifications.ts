import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { OutboxEntry } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { buildTaskLifecycleNotification } from "./taskLifecycleNotifications";
import { projectPilotCoordination } from "./pilotCoordination";

export function pilotRecommendationEventId(recommendationId: string, recipient: string): string {
  // Bind each authorized notification to both the recommendation and its
  // current recipient without putting contact details in a document name.
  return `${recommendationId}.${createHash("sha256").update(recipient.trim()).digest("hex")}`;
}

export function pilotScheduledEventId(calendarEventId: string, recipient: string): string {
  return createHash("sha256").update(JSON.stringify([calendarEventId, recipient.trim()])).digest("hex");
}

export function buildPilotRecommendationNotification(params: {
  requestId: string;
  recommendation: { id: string; teamName: string; purpose: string };
  to: string;
  captureUrl: string;
}) {
  return buildTaskLifecycleNotification({
    requestId: params.requestId,
    milestone: "pilot_recommended",
    eventId: pilotRecommendationEventId(params.recommendation.id, params.to),
    detail: `${params.recommendation.teamName}, to ${params.recommendation.purpose.replace(/[.\s]+$/, "")}`,
    to: params.to,
    captureUrl: params.captureUrl,
  });
}

/** Called inside the final dispatch transaction, before any writes. Source
 * errors propagate: inability to verify authority is never permission to send. */
export async function pilotRecommendationNotificationIsCurrent(
  entry: OutboxEntry,
  transaction: FirebaseFirestore.Transaction,
): Promise<boolean> {
  if (TEAM_PILOT_NOTICE_KINDS.includes(entry.kind as TeamPilotNoticeKind)) return teamPilotNotificationIsCurrent(entry, transaction);
  if (!["pilot_recommended", "pilot_booked", "pilot_scheduled"].includes(entry.kind)) return true;
  if (!db) throw new Error("Recommendation notification store unavailable");
  const snapshot = await transaction.get(db.collection("inboundRequests").doc(entry.requestId));
  const record = snapshot.data();
  const recommendation = record?.pilot_recommendation;
  if (!snapshot.exists || typeof recommendation?.id !== "string") return false;
  if (entry.kind === "pilot_scheduled") {
    if (projectPilotCoordination(record)?.state !== "scheduled") return false;
  } else if (entry.kind === "pilot_booked") {
    if (record?.pilot_booking?.recommendationId !== recommendation.id) return false;
  } else if (record?.pilot_booking || recommendation.reviewRequired) return false;
  const to = String(await decryptFieldValue(record?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to !== entry.to) return false;
  const event = entry.kind === "pilot_scheduled" ? record?.pilot_booking?.coordination?.calendarEventId : recommendation.id;
  const expectedKey = `${entry.requestId}:${entry.kind}:${entry.kind === "pilot_scheduled" ? pilotScheduledEventId(event, to) : pilotRecommendationEventId(event, to)}`;
  // Legacy queued rows are accepted only if their exact current event and
  // recipient still match. No old event is upgraded into a new recommendation.
  return entry.idempotencyKey === expectedKey
    || (entry.kind !== "pilot_scheduled" && entry.idempotencyKey === `${entry.requestId}:${entry.kind}:${event}`);
}

/* ------------------------------------------------- the recommended team */

export type TeamPilotNoticeKind = "team_pilot_recommended" | "team_pilot_booked" | "team_pilot_scheduled";
export const TEAM_PILOT_NOTICE_KINDS: readonly TeamPilotNoticeKind[] = ["team_pilot_recommended", "team_pilot_booked", "team_pilot_scheduled"];

/** Where Blueprint emails a team: its verified account, else its registered contact. */
export function teamNoticeRecipient(team: { accountEmail?: string | null; contactEmail?: string | null } | null | undefined): string | null {
  const email = String(team?.accountEmail || team?.contactEmail || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * One key per job, notice kind, team, event and recipient. The event is the
 * recommendation id (recommended, booked) or the Calendar event (scheduled),
 * so a replaced recommendation or a corrected address is a new notice and a
 * retry of the same one is not.
 */
export function teamPilotNoticeKey(params: { requestId: string; kind: TeamPilotNoticeKind; teamId: string; eventKey: string; to: string }): string {
  const digest = createHash("sha256").update(JSON.stringify([params.teamId, params.eventKey, params.to.trim().toLowerCase()])).digest("hex");
  return `${params.requestId}:${params.kind}:${digest}`;
}

/** The event a team notice is about, read from the current job record, or null when it no longer holds. */
export function currentTeamPilotEvent(record: Record<string, any> | null | undefined, kind: TeamPilotNoticeKind):
  { teamId: string; eventKey: string } | null {
  const recommendation = record?.pilot_recommendation;
  if (typeof recommendation?.id !== "string" || typeof recommendation?.teamId !== "string") return null;
  if (kind === "team_pilot_recommended") {
    if (record?.pilot_booking || recommendation.reviewRequired) return null;
    return { teamId: recommendation.teamId, eventKey: recommendation.id };
  }
  if (kind === "team_pilot_booked") {
    if (record?.pilot_booking?.recommendationId !== recommendation.id) return null;
    return { teamId: recommendation.teamId, eventKey: recommendation.id };
  }
  if (projectPilotCoordination(record)?.state !== "scheduled") return null;
  const calendarEventId = record?.pilot_booking?.coordination?.calendarEventId;
  return typeof calendarEventId === "string" ? { teamId: recommendation.teamId, eventKey: calendarEventId } : null;
}

/** Dispatch guard: the notice still describes the current recommendation, team and recipient. */
export async function teamPilotNotificationIsCurrent(entry: OutboxEntry, transaction: FirebaseFirestore.Transaction): Promise<boolean> {
  if (!db) throw new Error("Team pilot notification store unavailable");
  const snapshot = await transaction.get(db.collection("inboundRequests").doc(entry.requestId));
  const event = currentTeamPilotEvent(snapshot.data(), entry.kind as TeamPilotNoticeKind);
  if (!snapshot.exists || !event) return false;
  const team = await transaction.get(db.collection("robotTeams").doc(event.teamId));
  const to = teamNoticeRecipient(team.data());
  if (!to || to !== entry.to) return false;
  return entry.idempotencyKey === teamPilotNoticeKey({ requestId: entry.requestId, kind: entry.kind as TeamPilotNoticeKind, ...event, to });
}
