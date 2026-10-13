import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendEmail } from "./email";
import { recordBetaOpsFailureSignal } from "./ops-alerts";
import { sendSlackMessage } from "./slack";

/**
 * The durable "ops has been told about this intake" record.
 *
 * A new site or robot-team request used to reach ops only through two
 * fire-and-forget sends: Slack (silently skipped with no webhook) and an ops
 * email (silently `sent:false` with no Resend key). Either failing left no
 * trace beyond a log line. The notice is now written atomically with the
 * request (`ops_notice` on the inboundRequests doc), updated from the send
 * results, and retried/escalated by `sweepIntakeOpsNotices` until a person
 * has been reached.
 *
 * Notices are link-only: they carry the request id, buyer type, priority and
 * queue, and a link to the admin lead page. Names, emails, companies, sites
 * and task text stay in Firestore behind admin auth.
 */

export type OpsNoticeChannelState = "pending" | "sent" | "failed" | "unconfigured";
export type OpsNoticeState = "pending" | "delivered" | "failed";

export type IntakeOpsNoticeMeta = {
  buyer_type: string;
  priority: string;
  queue_label: string;
  request_path_label: string;
};

export type IntakeOpsNotice = {
  state: OpsNoticeState;
  channels: { slack: OpsNoticeChannelState; email: OpsNoticeChannelState };
  attempts: number;
  last_error: string | null;
  meta: IntakeOpsNoticeMeta;
  created_at_ms: number;
  updated_at_ms: number;
  /** Claim held by whoever is sending; the sweep never sends inside it. */
  lease_until_ms: number;
  delivered_at_ms: number | null;
  escalated_at_ms: number | null;
};

const INBOUND_COLLECTION = "inboundRequests";
const DEFAULT_LEASE_MS = 5 * 60 * 1000;

export function opsNoticeMaxAttempts() {
  return positiveEnv("BLUEPRINT_INTAKE_OPS_NOTICE_MAX_ATTEMPTS", 5);
}

export function opsNoticeEscalateAfterMs() {
  return positiveEnv("BLUEPRINT_INTAKE_OPS_NOTICE_ESCALATE_AFTER_MS", 30 * 60 * 1000);
}

export function opsNoticeRetryAfterMs() {
  return positiveEnv("BLUEPRINT_INTAKE_OPS_NOTICE_RETRY_AFTER_MS", 10 * 60 * 1000);
}

function positiveEnv(key: string, fallback: number) {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function appBaseUrl() {
  return (process.env.APP_URL || "https://tryblueprint.io").replace(/\/+$/, "");
}

export function adminLeadUrl(requestId: string) {
  return `${appBaseUrl()}/admin/leads/${encodeURIComponent(requestId)}`;
}

export function opsNoticeRecipient() {
  return process.env.CONTACT_TO?.trim() || "ops@tryblueprint.io";
}

export function initialIntakeOpsNotice(meta: IntakeOpsNoticeMeta, nowMs = Date.now()): IntakeOpsNotice {
  return {
    state: "pending",
    channels: { slack: "pending", email: "pending" },
    attempts: 0,
    last_error: null,
    meta,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
    // The request path delivers first; the sweep waits out this claim.
    lease_until_ms: nowMs + DEFAULT_LEASE_MS,
    delivered_at_ms: null,
    escalated_at_ms: null,
  };
}

const BUYER_TYPE_LABELS: Record<string, string> = {
  site_operator: "site operator",
  robot_team: "robot team",
};

/** Link-only notice text. Never includes contact details or free text. */
export function buildIntakeOpsNoticeMessage(requestId: string, meta: IntakeOpsNoticeMeta, options: { retry?: boolean } = {}) {
  const priority = String(meta.priority || "normal").toUpperCase();
  const buyer = BUYER_TYPE_LABELS[meta.buyer_type] || meta.buyer_type || "unknown";
  const pathLabel = meta.request_path_label || "Blueprint request";
  const url = adminLeadUrl(requestId);
  const subject = `[${priority}] New ${pathLabel.toLowerCase()} (${buyer})${options.retry ? " — delayed notice" : ""}`;
  const lines = [
    options.retry
      ? "A new request arrived earlier and its first ops notice did not get through."
      : "A new request was submitted.",
    "",
    `Request: ${requestId}`,
    `Type: ${buyer}`,
    `Path: ${pathLabel}`,
    `Priority: ${priority}`,
    `Queue: ${meta.queue_label || "unassigned"}`,
    "",
    `Open it in admin (contact details are there, not in this message): ${url}`,
  ];
  const slack = [
    `${options.retry ? ":hourglass: *Delayed intake notice*" : ":inbox_tray: *New request*"} — \`${requestId}\``,
    `${buyer} · ${pathLabel} · priority ${priority} · queue ${meta.queue_label || "unassigned"}`,
    `Open in admin: ${url}`,
  ].join("\n");
  return { subject, text: lines.join("\n"), slack };
}

function slackInboundWebhook() {
  return process.env.SLACK_INBOUND_WEBHOOK_URL?.trim() || process.env.SLACK_WEBHOOK_URL?.trim() || "";
}

function describeError(error: unknown): string {
  if (!error) return "unknown";
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

export type ChannelSenders = {
  slack?: (message: string, webhookUrl: string) => Promise<{ sent: boolean; error?: unknown } | undefined>;
  email?: typeof sendEmail;
};

/** Send any channel that has not already been delivered. Never throws. */
export async function sendIntakeOpsNoticeChannels(
  requestId: string,
  meta: IntakeOpsNoticeMeta,
  previous: IntakeOpsNotice["channels"] | undefined,
  options: { retry?: boolean; senders?: ChannelSenders } = {},
) {
  const message = buildIntakeOpsNoticeMessage(requestId, meta, { retry: options.retry });
  const channels: IntakeOpsNotice["channels"] = {
    slack: previous?.slack === "sent" ? "sent" : "pending",
    email: previous?.email === "sent" ? "sent" : "pending",
  };
  const errors: string[] = [];

  if (channels.slack !== "sent") {
    const webhook = slackInboundWebhook();
    if (!webhook) {
      channels.slack = "unconfigured";
      errors.push("slack: no SLACK_INBOUND_WEBHOOK_URL or SLACK_WEBHOOK_URL");
    } else {
      try {
        const slackSend = options.senders?.slack || sendSlackMessage;
        const result = await slackSend(message.slack, webhook);
        channels.slack = result?.sent ? "sent" : "failed";
        if (!result?.sent) errors.push(`slack: ${describeError(result?.error) || "not sent"}`);
      } catch (error) {
        channels.slack = "failed";
        errors.push(`slack: ${describeError(error)}`);
      }
    }
  }

  if (channels.email !== "sent") {
    try {
      const emailSend = options.senders?.email || sendEmail;
      const result = await emailSend({ to: opsNoticeRecipient(), subject: message.subject, text: message.text });
      if (result?.sent) {
        channels.email = "sent";
      } else if (result && result.provider === null && !result.error) {
        channels.email = "unconfigured";
        errors.push("email: transport not configured (RESEND_API_KEY)");
      } else {
        channels.email = "failed";
        errors.push(`email: ${describeError(result?.error) || "not sent"}`);
      }
    } catch (error) {
      channels.email = "failed";
      errors.push(`email: ${describeError(error)}`);
    }
  }

  const delivered = channels.slack === "sent" || channels.email === "sent";
  return { channels, delivered, error: errors.length ? errors.join("; ") : null };
}

type StoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: Record<string, unknown>, options: { merge: true }) => Promise<unknown>;
    };
  };
};

/**
 * First delivery attempt, run from the intake request path right after the
 * request (with its pending notice) has been committed.
 */
export async function deliverIntakeOpsNoticeAtIntake(params: {
  requestId: string;
  meta: IntakeOpsNoticeMeta;
  store?: StoreLike | null;
  senders?: ChannelSenders;
  now?: () => number;
}) {
  const now = params.now || Date.now;
  const result = await sendIntakeOpsNoticeChannels(params.requestId, params.meta, undefined, {
    senders: params.senders,
  });
  const nowMs = now();
  const patch: Partial<IntakeOpsNotice> = {
    state: result.delivered ? "delivered" : "pending",
    channels: result.channels,
    attempts: 1,
    last_error: result.error,
    updated_at_ms: nowMs,
    // Release the claim so the sweep may retry after the retry delay.
    lease_until_ms: result.delivered ? 0 : nowMs + opsNoticeRetryAfterMs(),
    delivered_at_ms: result.delivered ? nowMs : null,
  };
  if (!result.delivered) {
    logger.warn(
      { event: "intake_ops_notice_undelivered", requestId: params.requestId, channels: result.channels, error: result.error },
      "Intake ops notice not delivered on any channel; the ops notice sweep will retry and escalate",
    );
  } else if (result.error) {
    logger.warn(
      { event: "intake_ops_notice_partial", requestId: params.requestId, channels: result.channels, error: result.error },
      "Intake ops notice reached ops on one channel only",
    );
  }
  const store = params.store === undefined ? (dbAdmin as unknown as StoreLike | null) : params.store;
  if (store) {
    try {
      await store.collection(INBOUND_COLLECTION).doc(params.requestId).set({ ops_notice: patch }, { merge: true });
    } catch (error) {
      logger.error(
        { event: "intake_ops_notice_record_failed", requestId: params.requestId, err: error },
        "Could not record the intake ops notice outcome; the sweep will treat it as pending",
      );
    }
  }
  return result;
}

// ─── Sweep ─────────────────────────────────────────────────────────────────

type SweepDoc = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  data: () => Record<string, unknown> | undefined;
};

type SweepStore = {
  collection: (name: string) => {
    where: (field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown) => {
      limit: (n: number) => { get: () => Promise<{ docs: SweepDoc[] }> };
    };
    doc: (id: string) => FirebaseFirestore.DocumentReference;
  };
  runTransaction: <T>(fn: (tx: FirebaseFirestore.Transaction) => Promise<T>) => Promise<T>;
};

export type IntakeOpsNoticeSweepSummary = {
  scanned: number;
  retried: number;
  delivered: number;
  escalated: number;
  failed: number;
};

function readNotice(value: unknown): IntakeOpsNotice | null {
  if (!value || typeof value !== "object") return null;
  const notice = value as IntakeOpsNotice;
  if (!notice.state || !notice.meta) return null;
  return notice;
}

async function escalate(requestId: string, notice: IntakeOpsNotice, reason: string, senders?: ChannelSenders) {
  const url = adminLeadUrl(requestId);
  const ageMinutes = Math.round((Date.now() - (notice.created_at_ms ?? Date.now())) / 60000);
  logger.error(
    { event: "intake_ops_notice_escalated", requestId, attempts: notice.attempts, channels: notice.channels, error: notice.last_error },
    "Intake ops notice still undelivered; escalating",
  );
  await recordBetaOpsFailureSignal({
    kind: "intake_forwarding_failure",
    scopeId: requestId,
    severity: "critical",
    summary: `Intake ${requestId} has not reached ops after ${notice.attempts} attempt(s) / ${ageMinutes} min (${reason}). ${url}`,
    details: { channels: notice.channels, last_error: notice.last_error },
  }).catch((error) => {
    logger.error({ err: error, requestId }, "Could not open an ops alert for an undelivered intake notice");
  });
  await Promise.resolve().then(() => (senders?.email || sendEmail)({
    to: opsNoticeRecipient(),
    subject: `[ESCALATION] Intake ${requestId} has not reached ops`,
    text: [
      `A new request has been waiting ${ageMinutes} minute(s) and its ops notice has failed ${notice.attempts} time(s).`,
      `Channels: slack=${notice.channels.slack}, email=${notice.channels.email}`,
      `Last error: ${notice.last_error || "unknown"}`,
      "",
      `Open it in admin: ${url}`,
    ].join("\n"),
  })).catch(() => undefined);
}

/**
 * Retry undelivered intake notices and escalate the ones that stay
 * undelivered. Idempotent: each notice is claimed in a transaction before a
 * send, a delivered channel is never re-sent, and escalation happens once.
 * Bounded by `limit` per pass and by the max-attempt budget per notice.
 */
export async function sweepIntakeOpsNotices(options: {
  store?: SweepStore | null;
  limit?: number;
  now?: () => number;
  senders?: ChannelSenders;
} = {}): Promise<IntakeOpsNoticeSweepSummary> {
  const summary: IntakeOpsNoticeSweepSummary = { scanned: 0, retried: 0, delivered: 0, escalated: 0, failed: 0 };
  const store = options.store === undefined ? (dbAdmin as unknown as SweepStore | null) : options.store;
  if (!store) return summary;
  const now = options.now || Date.now;
  const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
  const maxAttempts = opsNoticeMaxAttempts();
  const escalateAfterMs = opsNoticeEscalateAfterMs();

  // Single-field equality: served by Firestore's automatic index. The pending
  // set stays small because every notice ends delivered or failed.
  const snapshot = await store.collection(INBOUND_COLLECTION)
    .where("ops_notice.state", "==", "pending")
    .limit(limit * 3)
    .get();

  for (const doc of snapshot.docs) {
    if (summary.retried >= limit) break;
    const notice = readNotice(doc.data()?.ops_notice);
    if (!notice) continue;
    summary.scanned += 1;
    const startMs = now();
    if ((notice.lease_until_ms || 0) > startMs) continue;

    // Claim: only one sweeper sends, and only if nothing changed underneath.
    const claimed = await store.runTransaction(async (tx) => {
      const current = readNotice((await tx.get(doc.ref)).data()?.ops_notice);
      if (!current || current.state !== "pending" || (current.lease_until_ms || 0) > now()) return null;
      tx.set(doc.ref, { ops_notice: { lease_until_ms: now() + DEFAULT_LEASE_MS } }, { merge: true });
      return current;
    }).catch((error) => {
      logger.warn({ err: error, requestId: doc.id }, "Could not claim an intake ops notice for retry");
      return null;
    });
    if (!claimed) continue;

    summary.retried += 1;
    const result = await sendIntakeOpsNoticeChannels(doc.id, claimed.meta, claimed.channels, {
      retry: true,
      senders: options.senders,
    });
    const attempts = (claimed.attempts || 0) + 1;
    const nowMs = now();
    const next: IntakeOpsNotice = {
      ...claimed,
      channels: result.channels,
      attempts,
      last_error: result.error,
      updated_at_ms: nowMs,
      state: result.delivered ? "delivered" : attempts >= maxAttempts ? "failed" : "pending",
      lease_until_ms: result.delivered ? 0 : nowMs + opsNoticeRetryAfterMs(),
      delivered_at_ms: result.delivered ? nowMs : null,
    };

    if (result.delivered) {
      summary.delivered += 1;
      logger.warn(
        { event: "intake_ops_notice_delivered_late", requestId: doc.id, attempts },
        "Intake ops notice delivered on retry",
      );
    } else {
      const overdue = nowMs - (claimed.created_at_ms ?? nowMs) >= escalateAfterMs;
      if (!claimed.escalated_at_ms && (next.state === "failed" || overdue)) {
        await escalate(doc.id, next, next.state === "failed" ? "retry budget exhausted" : "overdue", options.senders);
        next.escalated_at_ms = nowMs;
        summary.escalated += 1;
      }
      if (next.state === "failed") {
        summary.failed += 1;
        logger.error(
          { event: "intake_ops_notice_failed", requestId: doc.id, attempts, channels: result.channels, error: result.error },
          "Intake ops notice exhausted its retries",
        );
      } else {
        logger.warn(
          { event: "intake_ops_notice_retry_failed", requestId: doc.id, attempts, error: result.error },
          "Intake ops notice retry failed",
        );
      }
    }

    await doc.ref.set({ ops_notice: next }, { merge: true }).catch((error: unknown) => {
      logger.error({ err: error, requestId: doc.id }, "Could not record an intake ops notice retry outcome");
    });
  }

  return summary;
}
