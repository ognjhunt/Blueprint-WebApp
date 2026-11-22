import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxStatus } from "./captureOutbox";
import { rowAwaitsDelivery } from "./captureOutboxRetry";
import { EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";
import { appendCommercialEmailFooter } from "./email-suppression";
import { robotTeamAccountInvitation } from "./accountInvitations";
import type { RobotTeamAccessRecord } from "./robotTeamEarlyAccess";

const APP_URL = () => (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");

/** Where an approved team books its call, or null to ask them to reply instead. */
function founderCallUrl(): string | null {
  const value = String(process.env.BLUEPRINT_FOUNDER_CALL_URL || "").trim();
  return /^https:\/\/\S+$/.test(value) ? value : null;
}

function firstName(name: string): string | null {
  return name.trim().split(/\s+/)[0] || null;
}

/** A company hears once about its application: when it is approved (owner, 2026-11-19). The page says the rest. */
export type AccessEmailKind = "robot_team_access_approved";

export function accessApprovedEmail(record: RobotTeamAccessRecord) {
  const base = APP_URL();
  const invited = record.source === "invite";
  const call = founderCallUrl();
  return {
    // The doctrine's words (journey audit, 2026-11-20): an approved deployment company, not a team invited to a beta.
    subject: "Your company is approved to see jobs on Blueprint",
    body: [
      emailGreeting(firstName(record.name)),
      "",
      invited
        ? "Following our conversation, your company is approved as a deployment company on Blueprint."
        : "Your company is approved as a deployment company on Blueprint.",
      "",
      // The reader's own address is said here: the invitation works for it alone (`resolveAccountInvitation`).
      `Use this email address (${record.email}) to create your account, or sign in if you already have one.`,
      "",
      "Set up your account:",
      `${base}/signup/business?invitation=${encodeURIComponent(robotTeamAccountInvitation(record))}`,
      "",
      // The invitation's lifetime (`createAccountInvitationToken`); a new link is asked for on Find jobs (`RobotTeamEarlyAccess`).
      `The link works only for this email address and expires in 7 days. If it expires, get a new one at ${base}/contact/robot-team.`,
      "",
      "Once you are signed in, open Find jobs to see the jobs sites have posted. Open a job to see its job packet and respond.",
      "",
      "Find jobs:",
      `${base}/contact/robot-team`,
      "",
      ...(invited ? [] : [
        call
          ? `If a call would help, book one here: ${call}`
          : "If a call would help, say so in your reply and we will find a time.",
        "",
      ]),
      "Nothing is charged today.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}

/** A polite "not yet": the application stays on file and nothing is closed. */
export type AccessEmailNotification = {
  status: "queued" | "sent" | "needs_attention" | "not_requested";
  outboxStatus: OutboxStatus | null;
  outboxId: string | null;
};

export const NO_ACCESS_EMAIL: AccessEmailNotification = { status: "not_requested", outboxStatus: null, outboxId: null };

/**
 * Read the deduplicated notice before the business transaction writes anything.
 * Its write() creates the existing outbox intent in that same commit. A storage
 * failure therefore cannot leave a newly approved team without its invitation.
 * Replaying an action also repairs an older decision whose enqueue was lost,
 * without changing the approval revision or resetting an existing delivery.
 */
export async function prepareAccessEmail(transaction: FirebaseFirestore.Transaction, params: {
  kind: AccessEmailKind;
  recordId: string;
  record: RobotTeamAccessRecord;
  /** An approved team asked for a fresh link: at most one per approval an hour. */
  resend?: boolean;
}): Promise<{ notification: AccessEmailNotification; write: () => void }> {
  if (!db) throw new Error("firestore_unavailable");
  // An approval is announced once.
  const resendHour = params.resend && params.kind === "robot_team_access_approved"
    ? new Date().toISOString().slice(0, 13) : null;
  const revision = params.record.decidedAtIso ?? params.record.updatedAtIso;
  const stamp = resendHour ? `resend-${revision}-${resendHour}` : revision;
  const outboxId = `${params.kind}:${params.recordId}:${stamp}`;
  const ref = db.collection(CAPTURE_OUTBOX_COLLECTION).doc(outboxId);
  let current = await transaction.get(ref);
  let existingOutboxId = outboxId;
  let legacyUnverified = false;
  if (!current.exists && resendHour) {
    const legacyId = `${params.kind}:${params.recordId}:resend-${resendHour}`;
    const legacy = await transaction.get(db.collection(CAPTURE_OUTBOX_COLLECTION).doc(legacyId));
    if (legacy.exists) {
      const context = legacy.data()?.robotTeamAccessNotice;
      const bound = context?.schemaVersion === "robot_team_access_notice.v1"
        && context.recordId === params.recordId && context.status === "approved"
        && typeof context.revision === "string" && Number.isFinite(Date.parse(context.revision));
      // Preserve a prior uncertain send. Only a proven different approval can
      // receive a separate link; an unbound legacy row needs operator review.
      if (!bound || context.revision === revision) {
        current = legacy;
        existingOutboxId = legacyId;
        legacyUnverified = !bound;
      }
    }
  }
  if (current.exists) {
    const row = current.data();
    if (row?.kind !== params.kind || row.requestId !== `robot-team-access:${params.recordId}` || row.to !== params.record.email)
      throw new Error("access_notification_identity_conflict");
    const outboxStatus = ["pending", "claimed", "dispatching", "unknown", "sent", "failed", "cancelled", "review_required"]
      .includes(row.status) ? row.status as OutboxStatus : null;
    return {
      // Queued is every state the pump still delivers by itself, including an
      // unknown outcome that is being sent again with its provider key.
      notification: { status: legacyUnverified ? "needs_attention" : outboxStatus === "sent" ? "sent"
        : outboxStatus && rowAwaitsDelivery(row, Date.now()) ? "queued" : "needs_attention",
      outboxStatus, outboxId: existingOutboxId },
      write: () => undefined,
    };
  }
  const message = accessApprovedEmail(params.record);
  const entry = buildOutboxEntry({
    idempotencyKey: outboxId,
    requestId: `robot-team-access:${params.recordId}`,
    kind: params.kind,
    to: params.record.email,
    subject: message.subject,
    body: message.body,
    replyTo: "hello@tryblueprint.io",
    robotTeamAccessNotice: {
      schemaVersion: "robot_team_access_notice.v1", recordId: params.recordId,
      status: "approved", revision: params.record.decidedAtIso!,
    },
  });
  return { notification: { status: "queued", outboxStatus: "pending", outboxId },
    write: () => { transaction.create(ref, entry); } };
}

/** The new-job email's fixed words (package E, E4). Nothing about the site: no name, place, contact or sentence. */
export const NEW_JOB_EMAIL_SUBJECT = "New job on Blueprint";
// True of a job sent with its description only as of a filmed one (statement v5 lists both). The answers themselves
// are on the job's page.
export const NEW_JOB_EMAIL_BODY = "A site has posted a new job. Open it to see the job packet and respond.";
const NEW_JOB_ALERTS_LINE = "You get an email like this for each new job. Turn them off in Settings or unsubscribe below.";

/** The email an approved deployment company that asked for job emails gets when a job is shared: the job's link only. */
export function newJobEmail(params: { to: string; jobUrl: string }) {
  return {
    subject: NEW_JOB_EMAIL_SUBJECT,
    body: appendCommercialEmailFooter({ text: [NEW_JOB_EMAIL_BODY, "", "Open the job:", params.jobUrl, "", NEW_JOB_ALERTS_LINE].join("\n"),
      email: params.to, scope: "optional_updates" }),
  };
}

/** Audit B-03: the one email to a company that accepted the Terms after jobs were sent. Nothing about any site. */
export const OPEN_JOBS_EMAIL_SUBJECT = "Jobs on Blueprint you can open now";
export const OPEN_JOBS_EMAIL_BODY = "Sites posted jobs before you could see them. Open Find jobs to see each job packet and respond.";

/** Sent once per company (`emailOpenJobsToCompany`), with the Find jobs link only. */
export function openJobsEmail(params: { to: string }) {
  return {
    subject: OPEN_JOBS_EMAIL_SUBJECT,
    body: appendCommercialEmailFooter({ text: [OPEN_JOBS_EMAIL_BODY, "", "Find jobs:", `${APP_URL()}/contact/robot-team`, "",
      NEW_JOB_ALERTS_LINE].join("\n"), email: params.to, scope: "optional_updates" }),
  };
}

/** The site's details as the introduction gives them to the one company the site chose (E6). */
export interface IntroductionSiteDetails { name: string; contactName: string | null; email: string; phone: string | null; location: string | null }

/** The email to the company when a site asks for an introduction (E6): the site's details and the job link. */
export function introductionCompanyEmail(params: { site: IntroductionSiteDetails; jobUrl: string; contactName?: string | null;
  /** The company's stored answer the introduction followed, worded by its fixed label. */
  answerLabel: string }) {
  const { site } = params;
  // The typed location is said once: a job from the public start form stores it as the site's name too, so the site
  // has no name of its own to give.
  const nameIsAddress = Boolean(site.location) && site.location === site.name;
  return {
    subject: "A site wants to talk about its job",
    body: [
      emailGreeting(params.contactName ? firstName(params.contactName) : null),
      "",
      // A fixed answer label in plain text is quoted: "Tested it: can do" has a colon of its own.
      `You answered "${params.answerLabel}" to a job on Blueprint, and the site has asked for an introduction. Here are its details:`,
      "",
      ...(nameIsAddress ? [] : [`Site: ${site.name}`]),
      ...(site.contactName ? [`Contact: ${site.contactName}`] : []),
      `Email: ${site.email}`,
      ...(site.phone ? [`Phone: ${site.phone}`] : []),
      // "Address", the word of the statement the site agreed to beside Introduce us.
      ...(site.location ? [`Address: ${site.location}`] : []),
      "",
      "Open the job:",
      params.jobUrl,
      "",
      // A reply to this email reaches Blueprint (every outbox row is sent with Reply-To hello@, `captureOutbox.ts`).
      "We are sending the site your company's name and your contact details now. Write to them at the email above.",
      "",
      EMAIL_SIGN_OFF,
    ].join("\n"),
  };
}
