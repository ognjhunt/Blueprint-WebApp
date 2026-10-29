/**
 * The recommended robot team hears about its pilot.
 *
 * The site was emailed when Blueprint recommended a pilot, when it booked and
 * when the date was set. The team being recommended heard nothing at any of
 * the three, so the one party who has to show up with a robot learned about
 * it from a person, if at all. Each notice is written into the same durable
 * outbox, inside the same transaction as the record it describes, keyed so a
 * retry cannot produce a second email and a replaced recommendation cannot
 * deliver a stale one (`teamPilotNotificationIsCurrent` re-checks at send).
 *
 * The bodies carry job ids and the team's own evaluation numbers. Only the
 * booked notice carries the site's contact: the site and the team agree the
 * pilot directly (owner decision 2026-10-15), and dispatch cancels it if
 * either side's consent was withdrawn before it is sent
 * (`pilotContactExchange`).
 */
import { COMPANY } from "../../client/src/data/company";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxEntry, type OutboxInput } from "./captureOutbox";
import { EMAIL_SIGN_OFF } from "./emailLayout";
import { SIMULATION_EVIDENCE_BOUNDARY, type PilotRecommendationEvidence } from "./pilotRecommendationEvidence";
import { teamNoticeRecipient, teamPilotNoticeKey, type TeamPilotNoticeKind } from "./pilotRecommendationNotifications";
import { formatPilotContact, type PilotContact } from "./pilotContactExchange";

const APP_URL = () => (process.env.APP_URL || COMPANY.website).replace(/\/+$/, "");

/** Blueprint's beta stance on money, stated the same way in every notice. */
export const BETA_FREE_LINE =
  "Blueprint charges nothing during the beta, to your team or the site. The pilot's cost is agreed between your team and the site.";

type RecommendationForNotice = {
  id: string;
  teamId: string;
  purpose?: string;
  window?: string;
  evidence?: PilotRecommendationEvidence | null;
};

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

export function teamPilotNoticeBody(params: {
  kind: TeamPilotNoticeKind;
  requestId: string;
  recommendation: RecommendationForNotice;
  startsAt?: string | null;
  /** `team_pilot_booked` only: the site's contact, shared at booking. */
  siteContact?: PilotContact | null;
}): { subject: string; body: string } {
  const jobUrl = `${APP_URL()}/app/opportunities/${encodeURIComponent(params.requestId)}`;
  const evidence = params.recommendation.evidence;
  const evidenceLine = evidence
    ? `Your evaluation of this job: ${evidence.episodesSucceeded} of ${evidence.episodesRun} simulated episodes succeeded, against the job's pass mark of ${percent(evidence.passMark.successRate)}. ${SIMULATION_EVIDENCE_BOUNDARY}`
    : null;
  const scope = [
    params.recommendation.purpose ? `Pilot: ${params.recommendation.purpose}` : null,
    params.recommendation.window ? `Proposed timing: ${params.recommendation.window} (not a reserved date)` : null,
  ].filter(Boolean).join("\n");
  const close = [`Open the job:\n${jobUrl}`, EMAIL_SIGN_OFF];
  if (params.kind === "team_pilot_recommended") {
    return {
      subject: "Blueprint recommended your team for a site pilot",
      body: ["Hi,",
        `Blueprint recommended your team to a site as its one pilot for job ${params.requestId}.`,
        ...(evidenceLine ? [evidenceLine] : []), ...(scope ? [scope] : []),
        "The site decides whether to book it. If it does, we email you the site's contact so you can agree the pilot's dates and terms with the site directly. Nothing is needed from you yet.",
        BETA_FREE_LINE, ...close].join("\n\n"),
    };
  }
  if (params.kind === "team_pilot_booked") {
    return {
      subject: "A site booked your recommended pilot",
      body: ["Hi,",
        `The site booked the pilot Blueprint recommended with your team for job ${params.requestId}.`,
        "You and the site agree the pilot's dates and terms directly. No date is reserved yet.",
        ...(params.siteContact ? [`Site contact:\n${formatPilotContact(params.siteContact)}`] : []),
        ...(evidenceLine ? [evidenceLine] : []), BETA_FREE_LINE, ...close].join("\n\n"),
    };
  }
  const when = params.startsAt && Number.isFinite(Date.parse(params.startsAt))
    ? new Date(params.startsAt).toISOString().replace("T", " ").replace(/:\d\d\.\d{3}Z$/, " UTC") : null;
  return {
    subject: "Your pilot is scheduled",
    body: ["Hi,",
      `Your pilot for job ${params.requestId} is scheduled${when ? ` to start ${when}` : ""}. The agreement, date and preparation responsibilities are recorded on the job.`,
      "Any change to the date, scope or cost needs the applicable approval from both sides.",
      BETA_FREE_LINE, ...close].join("\n\n"),
  };
}

export function buildTeamPilotNotification(params: {
  kind: TeamPilotNoticeKind;
  requestId: string;
  recommendation: RecommendationForNotice;
  to: string;
  /** The Calendar event, for `team_pilot_scheduled`. */
  calendarEventId?: string;
  startsAt?: string | null;
  siteContact?: PilotContact | null;
}): OutboxInput {
  const eventKey = params.kind === "team_pilot_scheduled" ? String(params.calendarEventId ?? "") : params.recommendation.id;
  const { subject, body } = teamPilotNoticeBody(params);
  return {
    idempotencyKey: teamPilotNoticeKey({ requestId: params.requestId, kind: params.kind, teamId: params.recommendation.teamId, eventKey, to: params.to }),
    requestId: params.requestId,
    kind: params.kind,
    to: params.to,
    subject,
    body,
    replyTo: COMPANY.emails.hello,
  };
}

/**
 * Read (inside the caller's transaction, before any write) what a team notice
 * needs, and return the write to make once the caller starts writing. Null
 * when the team has no usable address: the recommendation still stands, and
 * ops can see the gap on the job.
 */
export async function prepareTeamPilotNotice(
  transaction: FirebaseFirestore.Transaction,
  params: Omit<Parameters<typeof buildTeamPilotNotification>[0], "to">,
  /** Reuse exact bytes across Firestore callback retries. */
  cache?: Map<string, OutboxEntry>,
): Promise<{ write: (transaction: FirebaseFirestore.Transaction) => void; idempotencyKey: string } | null> {
  if (!db) return null;
  const team = await transaction.get(db.collection("robotTeams").doc(params.recommendation.teamId));
  const to = teamNoticeRecipient(team.data());
  if (!to) return null;
  const input = buildTeamPilotNotification({ ...params, to });
  const ref = db.collection(CAPTURE_OUTBOX_COLLECTION).doc(input.idempotencyKey);
  const existing = (await transaction.get(ref)).data() as OutboxEntry | undefined;
  const cacheKey = JSON.stringify([input.idempotencyKey, input.to, input.body]);
  const entry = cache?.get(cacheKey) ?? buildOutboxEntry(input);
  cache?.set(cacheKey, entry);
  return {
    idempotencyKey: input.idempotencyKey,
    write: (tx) => {
      if (!existing) tx.create(ref, entry);
      // Restored to the same recipient before any send: rearm, never resend.
      else if (existing.status === "cancelled" && existing.attempts === 0) tx.update(ref, { status: "pending", lastError: null });
    },
  };
}
