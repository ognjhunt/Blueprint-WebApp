/**
 * Record a decision on a task and queue the email that tells the site.
 *
 * The site hears about each decision when it happens. There is no longer a
 * "next update by" deadline behind it: the timed check-in that kept that
 * promise is retired, because every real event now sends its own email. So
 * this records what was decided, clears any old deadline, and queues the
 * message, as one act.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { enqueueOutbox, type OutboxKind } from "./captureOutbox";

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
}): Promise<void> {
  if (!db) return;

  try {
    await db
      .collection("inboundRequests")
      .doc(params.requestId)
      .set(
        {
          // Updates follow events now; no deadline is promised.
          site_task_next_update_iso: null,
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
