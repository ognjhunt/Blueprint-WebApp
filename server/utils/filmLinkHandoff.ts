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
import { captureUploadUrlFor } from "./captureUploadToken";
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
        `Blueprint: you've been asked to film a site walkthrough${clause}. ` +
        `Open on your phone — no app needed: ${filmUrl}`,
    });
    if (result.sent) return { sent: true, filmUrl };
    return {
      sent: false,
      code: result.reason === "not_configured" ? "sms_unavailable" : "sms_send_failed",
      filmUrl,
    };
  }

  if (!EMAIL_RE.test(to)) return { sent: false, code: "invalid_email", filmUrl };
  const result = await sendEmail({
    to,
    subject: "You've been asked to film a Blueprint site capture",
    text:
      `Someone has asked you to film a short walkthrough of a work area${clause} for a Blueprint robot evaluation.\n\n` +
      `Open this link on your phone — no app to install, and about thirty seconds of the actual cycle is enough:\n${filmUrl}\n\n` +
      `You can record and upload from this link. Confirming the task details stays with the site operator who sent it to you.`,
    replyTo: "ops@tryblueprint.io",
  });
  if (result.sent) return { sent: true, filmUrl };
  return { sent: false, code: "email_unavailable", filmUrl };
}
