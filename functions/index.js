/**
 * Blueprint Cloud Functions
 *
 * Forwards Firestore lifecycle events to the Paperclip ops webhook so the
 * autonomous org can react to waitlist signups, inbound requests, completed
 * captures, mobile capture state, field ops, and payout exceptions in real time.
 */
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";

const paperclipWebhookUrl = defineString("PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL", {
  description:
    "Full URL of the stable Firestore relay endpoint, e.g. " +
    "https://www.tryblueprint.io/api/paperclip/ops-firestore-relay",
});

defineString("PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET", {
  description: "Shared bearer secret for the stable Firestore -> webapp -> Paperclip relay.",
  default: "",
});

async function forwardToPaperclip(event, collection, eventName) {
  const url = paperclipWebhookUrl.value();
  if (!url) return;
  const data = typeof event.data?.data === "function"
    ? event.data.data()
    : event.data?.after?.data?.() ?? {};
  const previousData = event.data?.before?.data?.() ?? null;

  const payload = {
    event: eventName ?? `${collection.replace(/s$/, "")}.created`,
    documentId: event.params.docId,
    collection,
    data,
    previousData,
    source: "firebase-functions",
  };

  try {
    const relaySecret = process.env.PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET || "";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(relaySecret ? { Authorization: `Bearer ${relaySecret}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`Paperclip relay ${collection}/${event.params.docId}: ${res.status}`);
  } catch (err) {
    console.error(`Paperclip relay failed for ${collection}/${event.params.docId}:`, err);
  }
}

// Waitlist signups
export const onWaitlistCreated = onDocumentCreated(
  { document: "waitlistTokens/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "waitlistTokens", "waitlist.created"),
);

// Inbound capture/access requests
export const onRequestCreated = onDocumentCreated(
  { document: "inboundRequests/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "inboundRequests", "request.created"),
);

// Completed captures (scenes)
export const onCaptureCompleted = onDocumentCreated(
  { document: "scenes/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "scenes", "capture.completed"),
);

export const onCaptureSubmissionWritten = onDocumentWritten(
  { document: "capture_submissions/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "capture_submissions", "mobile.capture_submission_written"),
);

export const onSessionEventWritten = onDocumentWritten(
  { document: "sessionEvents/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "sessionEvents", "mobile.session_event_written"),
);

export const onCreatorProfileWritten = onDocumentWritten(
  { document: "creatorProfiles/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "creatorProfiles", "mobile.creator_profile_written"),
);

export const onCaptureJobWritten = onDocumentWritten(
  { document: "capture_jobs/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "capture_jobs", "mobile.capture_job_written"),
);

export const onCreatorPayoutWritten = onDocumentWritten(
  { document: "creatorPayouts/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "creatorPayouts", "mobile.creator_payout_written"),
);

export const onCreatorCaptureWritten = onDocumentWritten(
  { document: "creatorCaptures/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "creatorCaptures", "mobile.creator_capture_written"),
);
