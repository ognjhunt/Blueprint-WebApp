/**
 * Compose and send the record-only link to whoever is doing the filming.
 *
 * One place, two callers: the capture page's "send it to them" button and the
 * intake's "someone else on-site will film this" field. Both want exactly the
 * same thing — a film-scoped link, a one-line instruction, by text or email —
 * so the message and the channel rules live here rather than being written
 * twice and drifting.
 *
 * Everything is best effort and fails closed. Email uses the core stack. SMS is
 * a config-gated Twilio call that returns `sms_unavailable` when it is off, so a
 * caller can fall back to email or to handing over the link. The link is always
 * returned, sent or not, so nothing is lost when a channel is down.
 */

import { isApprovedCaptureRegion, type CaptureRegion } from "../../client/src/data/captureResidency";
import { FILM_AROUND_THE_JOB } from "../../client/src/lib/footageNotice";
import { captureUploadUrlFor } from "./captureUploadToken";
import { brandedEmail, CUSTOMER_JOB_EMAIL_IDENTITY } from "./emailLayout";
import { sendEmail } from "./email";
import { looksLikePhoneNumber, sendSms } from "./sms";

export type HandoffChannel = "email" | "sms";

export interface FilmLinkHandoffResult {
  sent: boolean;
  /** Set when not sent: invalid_email | invalid_number | sms_unavailable | sms_send_failed | email_unavailable. */
  code?: string;
  /** The film-scoped link, so a failed send can still be shared by hand. */
  filmUrl: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A destination with an "@" is an email; otherwise treat it as a phone number. */
export function inferHandoffChannel(to: string): HandoffChannel {
  return to.includes("@") ? "email" : "sms";
}

/**
 * Whether intake should hand the film link on to a named on-site filmer.
 *
 * Only when someone was actually named, the capture is a self-recorded one (a
 * film link is meaningless for a capturer visit), and the region is approved —
 * otherwise the link would open on the same "no region recorded" wall the
 * operator would hit, and sending it would be a promise we cannot keep yet.
 */
export function shouldSendFilmerHandoff(params: {
  filmerContact: string | null | undefined;
  buyerType: string;
  captureMode: string | null | undefined;
  captureRegion: CaptureRegion | null | undefined;
}): boolean {
  return (
    Boolean(String(params.filmerContact ?? "").trim()) &&
    params.buyerType === "site_operator" &&
    params.captureMode === "self_capture" &&
    isApprovedCaptureRegion(params.captureRegion ?? null)
  );
}

/** `` for "the tote-to-pallet task"``, capped, or empty when we have no summary. */
function taskClause(summary: string | null | undefined): string {
  const task = String(summary ?? "").trim();
  if (!task) return "";
  const trimmed = task.length > 120 ? `${task.slice(0, 117)}…` : task;
  return ` for "${trimmed}"`;
}

/** The film-link email: what the link is for, how to film, and the link as its one button. */
export function filmLinkHandoffEmail(params: { filmUrl: string; taskSummary?: string | null }): { subject: string; text: string } {
  return {
    subject: "You've been asked to film a job for Blueprint",
    text:
      `Someone has asked you to film a job${taskClause(params.taskSummary)}. Blueprint turns the video into a job packet. We share it, ` +
      `without sound, with robot deployment companies we've approved, so they can decide if they can do the job.\n\n` +
      // No capture app is in use (owner, 2026-11-11): the link opens the browser recorder on every phone. The length is
      // the start form's own words ("One full round of the job, about 30 seconds").
      `Open this link on your phone. The recorder opens in your browser, and no account is needed. One full round of the job, about 30 seconds, is enough.\n\n` +
      `Film the job:\n${params.filmUrl}\n\n` +
      `${FILM_AROUND_THE_JOB}\n\n` +
      `You can record and upload from this link.`,
  };
}

export async function sendFilmLinkHandoff(params: {
  requestId: string;
  channel: HandoffChannel;
  to: string;
  taskSummary?: string | null;
}): Promise<FilmLinkHandoffResult> {
  const to = params.to.trim();
  const filmUrl = captureUploadUrlFor(params.requestId, "film");
  const clause = taskClause(params.taskSummary);

  if (params.channel === "sms") {
    if (!looksLikePhoneNumber(to)) return { sent: false, code: "invalid_number", filmUrl };
    const result = await sendSms({
      to,
      body:
        `Blueprint: you've been asked to film a job${clause}. Blueprint turns the video into a job packet for robot ` +
        `deployment companies. Open this on your phone to film, no account needed: ${filmUrl}`,
    });
    if (result.sent) return { sent: true, filmUrl };
    return {
      sent: false,
      code: result.reason === "not_configured" ? "sms_unavailable" : "sms_send_failed",
      filmUrl,
    };
  }

  if (!EMAIL_RE.test(to)) return { sent: false, code: "invalid_email", filmUrl };
  const { subject, text } = filmLinkHandoffEmail({ filmUrl, taskSummary: params.taskSummary });
  const result = await sendEmail({
    to,
    subject,
    // In the layout of every other email to a site, from and replying to the same address (hello@), not the operators'.
    ...brandedEmail({ subject, text }),
    ...CUSTOMER_JOB_EMAIL_IDENTITY,
  });
  if (result.sent) return { sent: true, filmUrl };
  return { sent: false, code: "email_unavailable", filmUrl };
}
