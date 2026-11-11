/**
 * Blueprint Cloud Functions
 *
 * Forwards Firestore lifecycle events to the Paperclip ops webhook so the
 * autonomous org can react to waitlist signups, inbound requests and completed
 * captures in real time.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString, defineSecret } from "firebase-functions/params";

const paperclipWebhookUrl = defineString("PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL", {
  description:
    "Full URL of the stable Firestore relay endpoint, e.g. " +
    "https://www.tryblueprint.io/api/paperclip/ops-firestore-relay",
});

// WEB-11: store the relay bearer secret in Cloud Secret Manager (defineSecret),
// not a plaintext functions .env. Each function that relays declares it in `secrets:`
// so the value is mounted at runtime from Secret Manager. Set/rotate it with:
//   firebase functions:secrets:set PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET
// (WEB-13: still read via .value() at call time.)
const paperclipRelaySecret = defineSecret("PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET");

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
    const relaySecret = paperclipRelaySecret.value() || "";
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
  { document: "waitlistTokens/{docId}", region: "us-central1", secrets: [paperclipRelaySecret] },
  (event) => forwardToPaperclip(event, "waitlistTokens", "waitlist.created"),
);

// Inbound capture/access requests
export const onRequestCreated = onDocumentCreated(
  { document: "inboundRequests/{docId}", region: "us-central1", secrets: [paperclipRelaySecret] },
  (event) => forwardToPaperclip(event, "inboundRequests", "request.created"),
);

// Completed captures (scenes)
export const onCaptureCompleted = onDocumentCreated(
  { document: "scenes/{docId}", region: "us-central1", secrets: [paperclipRelaySecret] },
  (event) => forwardToPaperclip(event, "scenes", "capture.completed"),
);

// The six capture-app ("mobile.*") forwards, for capture_submissions,
// sessionEvents, creatorProfiles, capture_jobs, creatorPayouts and
// creatorCaptures, were retired with the capture app, outside capturers,
// capturer payouts and filming visits (owner, 2026-11-11). Deployed copies keep
// running until they are deleted with the Firebase CLI; deploying this file
// asks to delete them.
