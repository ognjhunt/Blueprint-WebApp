/**
 * Blueprint Cloud Functions
 *
 * Forwards Firestore document-creation events to the Paperclip ops webhook
 * so the autonomous org agents can react to waitlist signups, inbound
 * requests, and completed captures in real time.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";

const paperclipWebhookUrl = defineString("PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL", {
  description:
    "Full URL of the stable Firestore relay endpoint, e.g. " +
    "https://www.tryblueprint.io/api/paperclip/ops-firestore-relay",
});

const paperclipRelaySecret = defineString("PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET", {
  description: "Shared bearer secret for the stable Firestore -> webapp -> Paperclip relay.",
  default: "",
});

async function forwardToPaperclip(event, collection) {
  const url = paperclipWebhookUrl.value();
  if (!url) return;

  const payload = {
    event: `${collection.replace(/s$/, "")}.created`,
    documentId: event.params.docId,
    collection,
    data: event.data?.data() ?? {},
  };

  try {
    const relaySecret = paperclipRelaySecret.value();
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
  (event) => forwardToPaperclip(event, "waitlistTokens"),
);

// Inbound capture/access requests
export const onRequestCreated = onDocumentCreated(
  { document: "inboundRequests/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "inboundRequests"),
);

// Completed captures (scenes)
export const onCaptureCompleted = onDocumentCreated(
  { document: "scenes/{docId}", region: "us-central1" },
  (event) => forwardToPaperclip(event, "scenes"),
);
