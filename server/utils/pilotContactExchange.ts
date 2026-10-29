/**
 * Contact exchange when a site books its recommended pilot (owner decision,
 * 2026-10-15).
 *
 * The physical pilot is agreed directly between the site and the robot team,
 * and Blueprint takes no cut. So booking hands each side the other's contact:
 * the team receives the site's named contact and email (phone only when the
 * site gave one), and the site receives the team's. That holds only while both
 * consents stand:
 *
 * - the site's: it has not withdrawn recording permission
 *   (`projectWebsiteCaptureRights(...).consent_revoked`);
 * - the team's: it still has a recorded supply agreement, including taking the
 *   pilot if its evaluation passes, and has not declined (`isWillingSupply`,
 *   read the same way `recommendableTeam` reads it: the recommended row and the
 *   rows linked to it by pointer).
 *
 * Booking refuses when either is withdrawn; the outbox dispatch guard cancels a
 * booked notice (which carries the other side's contact) whose consent was
 * withdrawn between booking and send; and each workspace shows the other side's
 * contact only while both still stand.
 */
import type { PilotBookingView, PilotContact } from "../../client/src/types/workspace";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { ROBOT_TEAMS_COLLECTION, type RobotTeamRecord } from "../types/robot-team-registry";
import { decryptFieldValue } from "./field-encryption";
import { explicitlyLinked } from "./robotTeamIdentity";
import { isWillingSupply } from "./robotTeamSupply";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

export type { PilotBookingView, PilotContact };

/** Why a booking, or a notice carrying contacts, is refused. */
export type PilotConsentRefusal = "site_consent_withdrawn" | "team_consent_withdrawn";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The team's consent stands: a willing-supply row and no declined row, among those linked by pointer. */
export function teamPilotConsentStands(team: RobotTeamRecord | null | undefined, rows: readonly RobotTeamRecord[] = []): boolean {
  if (!team) return false;
  const linked = [team, ...rows.filter(row => row.id !== team.id && explicitlyLinked(team, row))];
  if (linked.some(row => row.status === "declined")) return false;
  return linked.some(isWillingSupply);
}

/** The recommended team's registry rows, read in the caller's transaction when given one. */
async function readRecommendedTeamRows(recommendation: Record<string, any>, transaction?: FirebaseFirestore.Transaction) {
  if (!db) throw new Error("Pilot contact store unavailable");
  const ids = [...new Set([recommendation.teamId, ...(Array.isArray(recommendation.registryTeamIds) ? recommendation.registryTeamIds : [])]
    .filter((id): id is string => typeof id === "string" && id.length > 0))];
  const rows: RobotTeamRecord[] = [];
  for (const id of ids) {
    const ref = db.collection(ROBOT_TEAMS_COLLECTION).doc(id);
    const snapshot = transaction ? await transaction.get(ref) : await ref.get();
    if (snapshot.exists) rows.push({ ...(snapshot.data() as RobotTeamRecord), id: snapshot.id });
  }
  return { team: rows.find(row => row.id === recommendation.teamId) ?? null, rows };
}

/**
 * Whether the site's and the recommended team's consents both stand for this
 * job's current recommendation. A legacy recommendation that names no team has
 * no team consent to withdraw and no team contact to share.
 */
export async function pilotConsentRefusal(record: Record<string, any> | null | undefined, transaction?: FirebaseFirestore.Transaction):
  Promise<{ refusal: PilotConsentRefusal | null; team: RobotTeamRecord | null }> {
  if (projectWebsiteCaptureRights(record ?? undefined).consent_revoked) return { refusal: "site_consent_withdrawn", team: null };
  const recommendation = record?.pilot_recommendation;
  if (typeof recommendation?.teamId !== "string") return { refusal: null, team: null };
  const { team, rows } = await readRecommendedTeamRows(recommendation, transaction);
  return { refusal: teamPilotConsentStands(team, rows) ? null : "team_consent_withdrawn", team };
}

async function plain(value: unknown): Promise<string> {
  return value ? String(await decryptFieldValue(value as never)).trim() : "";
}

/** The site's named contact and email; phone only when the site gave one. */
export async function sitePilotContact(record: Record<string, any> | null | undefined): Promise<PilotContact | null> {
  const contact = record?.contact ?? {};
  const email = await plain(contact.email);
  if (!EMAIL.test(email)) return null;
  const name = [await plain(contact.firstName), await plain(contact.lastName)].filter(Boolean).join(" ");
  const organization = await plain(contact.company);
  const phone = await plain(contact.phone);
  return { name: name || null, organization: organization || null, email, phone: phone || null };
}

/** The team's name and the address Blueprint emails it at (as `teamNoticeRecipient`). */
export function teamPilotContact(team: RobotTeamRecord | null | undefined): PilotContact | null {
  const email = String(team?.accountEmail || team?.contactEmail || "").trim();
  if (!team || !EMAIL.test(email)) return null;
  return { name: null, organization: team.name?.trim() || null, email, phone: null };
}

/** Plain-text lines for an email. */
export function formatPilotContact(contact: PilotContact): string {
  const who = [contact.name, contact.organization].filter(Boolean).join(", ");
  return [who, contact.email, contact.phone].filter(Boolean).join("\n");
}

/**
 * The current booking as one side sees it, or null when the current
 * recommendation is not booked. `side` is who is looking: the site sees the
 * team's contact, the team sees the site's. Callers authorize the viewer.
 */
export async function projectPilotBooking(record: Record<string, any> | null | undefined, side: "site" | "team"): Promise<PilotBookingView | null> {
  const recommendation = record?.pilot_recommendation, booking = record?.pilot_booking;
  if (!recommendation?.id || booking?.recommendationId !== recommendation.id) return null;
  const bookedAtIso = typeof booking.acceptedAtIso === "string" ? booking.acceptedAtIso
    : typeof booking.bookedAtIso === "string" ? booking.bookedAtIso : null;
  const { refusal, team } = await pilotConsentRefusal(record);
  if (refusal) return { bookedAtIso, contact: null, consentWithdrawn: true };
  let contact: PilotContact | null = null;
  try { contact = side === "site" ? teamPilotContact(team) : await sitePilotContact(record); }
  catch { contact = null; }
  return { bookedAtIso, contact, consentWithdrawn: false };
}
