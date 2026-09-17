/**
 * The promise we can keep: "next update by <a real time>".
 *
 * ## Why this is the strongest idea in the audit
 *
 * A waiting state fails when it says "still processing" forever. It succeeds
 * when it makes a commitment the operator can hold us to -- and the one
 * commitment we can always make, even when reconstruction, review and
 * participation are all uncertain, is *when we will next say something*. Not
 * when the work finishes; when we speak next.
 *
 * So `site_task_next_update_iso` is a time we put on the request, the status
 * projection surfaces it, and the outbox is what actually sends by it. A
 * committed time nobody meets is worse than none, which is why setting it and
 * enqueuing the message that honours it happen together, here.
 *
 * ## What it does not do
 *
 * Invent a turnaround. There is no credible "your scene will be ready in N
 * hours" to promise, because the Pipeline does not report and Atlas timing is
 * unmeasured. This commits to *communication*, and the default window is a
 * staffed promise to come back, not a delivery estimate dressed up as one.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { enqueueOutbox, type OutboxKind } from "./captureOutbox";

/** How far out we commit to speak next, when a step does not set its own. */
const DEFAULT_UPDATE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

function updateWindowMs(): number {
  const raw = Number(process.env.BLUEPRINT_TASK_UPDATE_WINDOW_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UPDATE_WINDOW_MS;
}

/**
 * Record a decision, commit to the next update, and queue the email — as one act.
 *
 * The three belong together: a decision the operator is not told about is not a
 * decision they can act on, and a commitment with no message behind it is the
 * broken promise this exists to avoid. So the caller records what happened and
 * this makes sure it is both durable and delivered.
 */
export async function commitTaskUpdate(params: {
  requestId: string;
  to: string;
  kind: OutboxKind;
  subject: string;
  body: string;
  replyTo?: string | null;
  /** When we next commit to speak. Defaults to the standard window. */
  nextUpdateAtMs?: number;
  /** Clear the commitment instead of extending it -- when the answer is delivered. */
  clearNextUpdate?: boolean;
}): Promise<void> {
  if (!db) return;

  const nextUpdateIso = params.clearNextUpdate
    ? null
    : new Date(params.nextUpdateAtMs ?? Date.now() + updateWindowMs()).toISOString();

  try {
    await db
      .collection("inboundRequests")
      .doc(params.requestId)
      .set(
        {
          site_task_next_update_iso: nextUpdateIso,
          site_task_last_decision: {
            kind: params.kind,
            decided_at_iso: new Date().toISOString(),
            decided_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
  } catch (error) {
    // The commitment write failing is worth knowing, but it must not stop the
    // email being queued -- a message sent without an updated deadline still
    // reaches the operator, which is the point.
    logger.warn({ error, requestId: params.requestId }, "Could not record task update commitment");
  }

  await enqueueOutbox({
    // One decision of a kind per request is one email. A second confirmation
    // does not re-send; a genuinely new decision has a new kind and a new key.
    idempotencyKey: `${params.requestId}:${params.kind}`,
    requestId: params.requestId,
    kind: params.kind,
    to: params.to,
    subject: params.subject,
    body: params.body,
    replyTo: params.replyTo ?? "ops@tryblueprint.io",
  });
}
