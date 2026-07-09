import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendSlackMessage } from "./slack";

/**
 * R037: operator alerting for the core beta failure classes.
 *
 * Server logging (server/logger.ts) records failures, but a logged error in a
 * request path is not an operator signal — it is lost unless someone tails logs.
 * `emitOperatorAlert` gives the highest-value failure sites a single, safe way to
 * surface a durable, operator-visible alert.
 *
 * Transport policy (reuse the existing stack — no new primary service):
 *   1. ALWAYS log at error level (the guaranteed sink).
 *   2. Persist to the operator-visible `operatorAlerts` Firestore collection
 *      (best-effort; durable record operators/admin surfaces can read).
 *   3. Route to Slack via the existing webhook integration when configured
 *      (best-effort real-time notification).
 *
 * The alert path is fully guarded: it never throws and never changes the
 * request's success/failure behavior. Alerting must not be able to break a
 * request. The transport is pluggable via `setOperatorAlertTransport` so tests
 * (and future routers) can intercept delivery without external services.
 */

/** Controlled set of core beta failure classes. */
export type OperatorAlertClass =
  | "upload_failed"
  | "intake_failed"
  | "provider_failed"
  | "package_failed"
  | "buyer_access_failed"
  | "payout_failed"
  | "spend_alert";

export type OperatorAlertSeverity = "info" | "warning" | "critical";

export interface OperatorAlertInput {
  class: OperatorAlertClass;
  severity?: OperatorAlertSeverity;
  message: string;
  context?: Record<string, unknown>;
}

/** Normalized alert handed to the transport and durable sinks. */
export interface OperatorAlertRecord {
  class: OperatorAlertClass;
  severity: OperatorAlertSeverity;
  message: string;
  context: Record<string, unknown>;
  createdAtIso: string;
}

export type OperatorAlertTransport = (
  record: OperatorAlertRecord,
) => void | Promise<void>;

const OPERATOR_ALERTS_COLLECTION = "operatorAlerts";

const SEVERITY_EMOJI: Record<OperatorAlertSeverity, string> = {
  critical: ":rotating_light:",
  warning: ":warning:",
  info: ":information_source:",
};

function normalizeAlert(input: OperatorAlertInput): OperatorAlertRecord {
  return {
    class: input.class,
    severity: input.severity ?? "critical",
    message: input.message,
    context: input.context ?? {},
    createdAtIso: new Date().toISOString(),
  };
}

/**
 * Best-effort durable persistence to the operator-visible Firestore collection.
 * No-op when Firestore is unconfigured. Never throws.
 */
async function persistToFirestore(record: OperatorAlertRecord): Promise<void> {
  if (!db) {
    return;
  }
  try {
    await db.collection(OPERATOR_ALERTS_COLLECTION).add({
      class: record.class,
      severity: record.severity,
      message: record.message,
      context: record.context,
      created_at_iso: record.createdAtIso,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      acknowledged: false,
    });
  } catch (error) {
    try {
      logger.error(
        { error, alertClass: record.class },
        "Failed to persist operator alert to Firestore",
      );
    } catch {
      /* logging must never break the alert path */
    }
  }
}

/**
 * Best-effort Slack notification through the existing webhook integration.
 * `sendSlackMessage` is already a no-op when no webhook is configured. Never
 * throws. Uses an optional dedicated ops-alert webhook, else the shared one.
 */
async function routeToSlack(record: OperatorAlertRecord): Promise<void> {
  try {
    const emoji = SEVERITY_EMOJI[record.severity];
    const contextLines = Object.entries(record.context)
      .slice(0, 12)
      .map(([key, value]) => `- ${key}: ${formatContextValue(value)}`);
    const message = [
      `${emoji} Blueprint operator alert [${record.class}] (${record.severity})`,
      record.message,
      ...contextLines,
    ].join("\n");
    await sendSlackMessage(
      message,
      process.env.SLACK_OPS_ALERT_WEBHOOK_URL || undefined,
    );
  } catch (error) {
    try {
      logger.error(
        { error, alertClass: record.class },
        "Failed to route operator alert to Slack",
      );
    } catch {
      /* logging must never break the alert path */
    }
  }
}

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value).slice(0, 200);
  } catch {
    return "[unserializable]";
  }
}

const defaultTransport: OperatorAlertTransport = async (record) => {
  await persistToFirestore(record);
  await routeToSlack(record);
};

let activeTransport: OperatorAlertTransport = defaultTransport;

/**
 * Override the alert transport (e.g. tests, or wiring a future primary channel).
 * Pass `null` to restore the default Firestore + Slack transport.
 */
export function setOperatorAlertTransport(
  transport: OperatorAlertTransport | null,
): void {
  activeTransport = transport ?? defaultTransport;
}

/**
 * Emit an operator alert for a core beta failure class.
 *
 * Guarantees:
 *   - Always logs at error level (the guaranteed sink).
 *   - Routes through the active transport (durable Firestore + Slack by default).
 *   - NEVER throws, even when every transport is unconfigured or errors. Callers
 *     may `await` it or fire-and-forget with `void`; either is safe on a failure
 *     branch and does not alter the request's own success/failure behavior.
 */
export async function emitOperatorAlert(
  input: OperatorAlertInput,
): Promise<void> {
  let record: OperatorAlertRecord;
  try {
    record = normalizeAlert(input);
  } catch {
    // Defensive: normalization should never throw, but the alert path must not.
    return;
  }

  // Guaranteed sink: always log at error level.
  try {
    logger.error(
      {
        operatorAlert: {
          class: record.class,
          severity: record.severity,
          createdAtIso: record.createdAtIso,
        },
        ...record.context,
      },
      `[operator-alert:${record.class}] ${record.message}`,
    );
  } catch {
    /* logging must never break the alert path */
  }

  // Route through the active transport, fully guarded.
  try {
    await activeTransport(record);
  } catch (error) {
    try {
      logger.error(
        { error, alertClass: record.class },
        "Operator alert transport failed",
      );
    } catch {
      /* nothing further we can safely do */
    }
  }
}

export const __operatorAlertsInternal = {
  OPERATOR_ALERTS_COLLECTION,
  defaultTransport,
  normalizeAlert,
};
