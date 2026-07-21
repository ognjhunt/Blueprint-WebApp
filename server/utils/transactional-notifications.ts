import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendEmail } from "./email";

export type TransactionalNotificationEventType =
  | "order_confirmation"
  | "delivery_ready"
  | "payout_sent"
  | "payout_failed"
  | "capture_accepted"
  | "capture_rejected"
  | "capturer_application_approved"
  | "capturer_application_rejected"
  | "consent_revocation";

export type TransactionalNotificationRecipientType = "buyer" | "creator";
export type TransactionalNotificationChannel = "email" | "push" | "in_app";
export type TransactionalNotificationStatus = "sent" | "queued" | "skipped" | "failed";

export type TransactionalNotificationRecord = {
  id: string;
  event_type: TransactionalNotificationEventType;
  channel: TransactionalNotificationChannel;
  status: TransactionalNotificationStatus;
  recipient_type: TransactionalNotificationRecipientType;
  recipient_user_id: string | null;
  recipient_email_domain: string | null;
  subject_id: string;
  source_event_id: string | null;
  source_collection: string | null;
  source_doc_id: string | null;
  title: string;
  body: string;
  email_subject: string | null;
  sent_at: string | null;
  skip_reason: string | null;
  failure_reason: string | null;
  provider_message_id: string | null;
  preference_key: string | null;
  data: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type TransactionalNotificationInput = {
  eventType: TransactionalNotificationEventType;
  recipientType: TransactionalNotificationRecipientType;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  subjectId: string;
  sourceEventId?: string | null;
  sourceCollection?: string | null;
  sourceDocId?: string | null;
  title?: string | null;
  body?: string | null;
  emailSubject?: string | null;
  emailText?: string | null;
  preferenceKey?: string | null;
  data?: Record<string, unknown> | null;
};

const COLLECTION = "transactionalNotifications";
const USABLE_PUSH_AUTHORIZATION_STATUSES = new Set([
  "authorized",
  "provisional",
  "ephemeral",
  "granted",
]);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function nowIso() {
  return new Date().toISOString();
}

function isTestRuntime() {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function enabledFlag(name: string, defaultOutsideTest = true) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }
  return isTestRuntime() ? false : defaultOutsideTest;
}

function normalizeToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stringValue(value: unknown, maxLength = 400) {
  if (typeof value === "string") {
    return value.trim().slice(0, maxLength);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, maxLength);
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function emailDomain(value?: string | null) {
  if (!value) {
    return null;
  }
  const match = value.match(EMAIL_PATTERN)?.[0];
  return match?.split("@").pop()?.trim().toLowerCase() || null;
}

function stableId(values: Array<string | null | undefined>) {
  return crypto
    .createHash("sha256")
    .update(values.map((value) => value || "").join("|"))
    .digest("hex")
    .slice(0, 20);
}

function normalizeData(input: Record<string, unknown> | null | undefined) {
  const entries = Object.entries(input || {})
    .slice(0, 30)
    .map(([key, value]) => [
      key.trim().replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 80),
      stringValue(value, 300),
    ])
    .filter(([key, value]) => key && value);
  return Object.fromEntries(entries) as Record<string, string>;
}

function defaultPreferenceKey(eventType: TransactionalNotificationEventType) {
  if (eventType === "payout_sent" || eventType === "payout_failed") {
    return "payouts";
  }
  if (eventType === "capture_accepted" || eventType === "capture_rejected") {
    return "capture_status";
  }
  return "account";
}

function notificationCopy(input: TransactionalNotificationInput) {
  const title = stringValue(input.title, 140);
  const body = stringValue(input.body, 800);
  if (title && body) {
    return {
      title,
      body,
      emailSubject: stringValue(input.emailSubject, 180) || title,
      emailText: stringValue(input.emailText, 4000) || body,
    };
  }

  switch (input.eventType) {
    case "order_confirmation":
      return {
        title: "Blueprint order confirmed",
        body: "Your Blueprint order is confirmed. We will keep the package and access status attached to your buyer account.",
        emailSubject: "Your Blueprint order is confirmed",
        emailText:
          "Your Blueprint order is confirmed. We will keep the package and access status attached to your buyer account.",
      };
    case "delivery_ready":
      return {
        title: "Blueprint delivery is ready",
        body: "Your Blueprint package is ready to access from your buyer account.",
        emailSubject: "Your Blueprint delivery is ready",
        emailText: "Your Blueprint package is ready to access from your buyer account.",
      };
    case "payout_sent":
      return {
        title: "Blueprint payout sent",
        body: "Your Blueprint payout was marked paid by Stripe.",
        emailSubject: "Your Blueprint payout was sent",
        emailText: "Your Blueprint payout was marked paid by Stripe.",
      };
    case "payout_failed":
      return {
        title: "Blueprint payout needs review",
        body: "A Blueprint payout failed or was canceled. The payout remains visible for review.",
        emailSubject: "Your Blueprint payout needs review",
        emailText:
          "A Blueprint payout failed or was canceled. The payout remains visible for review.",
      };
    case "capture_accepted":
      return {
        title: "Capture accepted",
        body: "Your capture passed review and is moving through payout handling.",
        emailSubject: "Your Blueprint capture was accepted",
        emailText: "Your capture passed review and is moving through payout handling.",
      };
    case "capture_rejected":
      return {
        title: "Capture needs attention",
        body: "Your capture could not be accepted as submitted. Review the reason in Blueprint Capture.",
        emailSubject: "Your Blueprint capture needs attention",
        emailText:
          "Your capture could not be accepted as submitted. Review the reason in Blueprint Capture.",
      };
    case "consent_revocation":
      return {
        title: "Blueprint access revoked",
        body: "Access to a Blueprint artifact was revoked because a rights or consent signal changed.",
        emailSubject: "Blueprint artifact access was revoked",
        emailText:
          "Access to a Blueprint artifact was revoked because a rights or consent signal changed.",
      };
    default:
      return {
        title: "Blueprint notification",
        body: "A Blueprint account event changed.",
        emailSubject: "Blueprint notification",
        emailText: "A Blueprint account event changed.",
      };
  }
}

function notificationId(input: TransactionalNotificationInput, channel: TransactionalNotificationChannel) {
  return [
    "txn",
    input.eventType,
    channel,
    stableId([
      input.eventType,
      channel,
      input.recipientType,
      input.recipientUserId,
      input.recipientEmail,
      input.subjectId,
      input.sourceEventId,
    ]),
  ].join("_");
}

async function readRecord(id: string): Promise<TransactionalNotificationRecord | null> {
  if (!db) {
    return null;
  }
  const snapshot = await db.collection(COLLECTION).doc(id).get();
  return snapshot.exists ? (snapshot.data() as TransactionalNotificationRecord) : null;
}

async function writeRecord(record: TransactionalNotificationRecord) {
  if (!db) {
    return record;
  }
  await db.collection(COLLECTION).doc(record.id).set(record, { merge: true });
  return record;
}

function baseRecord(
  input: TransactionalNotificationInput,
  channel: TransactionalNotificationChannel,
): TransactionalNotificationRecord {
  const copy = notificationCopy(input);
  const createdAt = nowIso();
  return {
    id: notificationId(input, channel),
    event_type: input.eventType,
    channel,
    status: "queued",
    recipient_type: input.recipientType,
    recipient_user_id: stringValue(input.recipientUserId || "", 160) || null,
    recipient_email_domain: emailDomain(input.recipientEmail),
    subject_id: stringValue(input.subjectId, 200) || "unknown",
    source_event_id: stringValue(input.sourceEventId || "", 200) || null,
    source_collection: stringValue(input.sourceCollection || "", 120) || null,
    source_doc_id: stringValue(input.sourceDocId || "", 200) || null,
    title: copy.title,
    body: copy.body,
    email_subject: channel === "email" ? copy.emailSubject : null,
    sent_at: null,
    skip_reason: null,
    failure_reason: null,
    provider_message_id: null,
    preference_key: stringValue(input.preferenceKey || defaultPreferenceKey(input.eventType), 80) || null,
    data: normalizeData(input.data),
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function notificationDevice(profile: Record<string, unknown>) {
  return isRecord(profile.notification_device || profile.notificationDevice)
    ? (profile.notification_device || profile.notificationDevice) as Record<string, unknown>
    : {};
}

function notificationPreferences(profile: Record<string, unknown>) {
  return isRecord(profile.notification_preferences || profile.notificationPreferences)
    ? (profile.notification_preferences || profile.notificationPreferences) as Record<string, unknown>
    : {};
}

function pushToken(profile: Record<string, unknown>) {
  const device = notificationDevice(profile);
  return stringValue(device.fcm_token || device.fcmToken || profile.fcm_token || profile.deviceToken, 300);
}

function hasUsablePushDevice(profile: Record<string, unknown>) {
  const token = pushToken(profile);
  if (!token) {
    return false;
  }
  const device = notificationDevice(profile);
  const status = normalizeToken(device.authorization_status || device.authorizationStatus || "unknown")
    .replace(/\s+/g, "_");
  return USABLE_PUSH_AUTHORIZATION_STATUSES.has(status);
}

function preferencesAllow(profile: Record<string, unknown>, preferenceKey: string | null) {
  if (!preferenceKey) {
    return true;
  }
  const preferences = notificationPreferences(profile);
  return preferences[preferenceKey] !== false;
}

function profileEmail(profile: Record<string, unknown>) {
  return stringValue(
    profile.email ||
      profile.work_email ||
      profile.workEmail ||
      profile.buyer_email ||
      profile.buyerEmail,
    300,
  );
}

async function readRecipientProfile(input: TransactionalNotificationInput) {
  if (!db || !input.recipientUserId) {
    return {};
  }
  const userId = input.recipientUserId;
  const collections =
    input.recipientType === "creator"
      ? ["creatorProfiles", "users"]
      : ["users", "buyerProfiles", "creatorProfiles"];
  const merged: Record<string, unknown> = {};
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).doc(userId).get();
    if (snapshot.exists) {
      Object.assign(merged, snapshot.data() || {});
    }
  }
  return merged;
}

async function dispatchEmail(input: TransactionalNotificationInput, profile: Record<string, unknown>) {
  const record = baseRecord(input, "email");
  const existing = await readRecord(record.id);
  if (existing && existing.status !== "failed") {
    return existing;
  }

  const email = stringValue(input.recipientEmail || profileEmail(profile), 300);
  if (!email) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "recipient_email_missing",
      updated_at: nowIso(),
    });
  }
  if (!enabledFlag("BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED")) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "transactional_email_disabled",
      updated_at: nowIso(),
    });
  }

  const copy = notificationCopy(input);
  try {
    const result = await sendEmail({
      to: email,
      subject: copy.emailSubject,
      text: copy.emailText,
      sendGridCategories: ["transactional", input.eventType],
      sendGridCustomArgs: {
        event_type: input.eventType,
        subject_id: stringValue(input.subjectId, 200) || "unknown",
      },
    });
    return writeRecord({
      ...record,
      recipient_email_domain: emailDomain(email),
      status: result.sent ? "sent" : "skipped",
      sent_at: result.sent ? nowIso() : null,
      skip_reason: result.sent ? null : "email_transport_unavailable",
      failure_reason: result.error instanceof Error ? result.error.message.slice(0, 500) : null,
      updated_at: nowIso(),
    });
  } catch (error) {
    logger.warn({ error, eventType: input.eventType }, "Transactional email dispatch failed");
    return writeRecord({
      ...record,
      recipient_email_domain: emailDomain(email),
      status: "failed",
      failure_reason: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      updated_at: nowIso(),
    });
  }
}

async function dispatchInApp(input: TransactionalNotificationInput) {
  const record = baseRecord(input, "in_app");
  const existing = await readRecord(record.id);
  if (existing && existing.status !== "failed") {
    return existing;
  }
  if (!input.recipientUserId) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "recipient_user_id_missing",
      updated_at: nowIso(),
    });
  }
  return writeRecord({
    ...record,
    status: "queued",
    updated_at: nowIso(),
  });
}

async function dispatchPush(input: TransactionalNotificationInput, profile: Record<string, unknown>) {
  const record = baseRecord(input, "push");
  const existing = await readRecord(record.id);
  if (existing && existing.status !== "failed") {
    return existing;
  }
  if (!input.recipientUserId) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "recipient_user_id_missing",
      updated_at: nowIso(),
    });
  }
  if (!preferencesAllow(profile, record.preference_key)) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "notification_preference_disabled",
      updated_at: nowIso(),
    });
  }
  if (!hasUsablePushDevice(profile)) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "push_device_unavailable",
      updated_at: nowIso(),
    });
  }
  if (
    !enabledFlag("BLUEPRINT_TRANSACTIONAL_PUSH_NOTIFICATIONS_ENABLED", false) ||
    !admin?.apps?.length
  ) {
    return writeRecord({
      ...record,
      status: "skipped",
      skip_reason: "push_transport_not_configured",
      updated_at: nowIso(),
    });
  }

  try {
    const messageId = await admin.messaging().send({
      token: pushToken(profile),
      notification: {
        title: record.title,
        body: record.body,
      },
      data: {
        event_type: input.eventType,
        subject_id: record.subject_id,
        ...record.data,
      },
    });
    return writeRecord({
      ...record,
      status: "sent",
      sent_at: nowIso(),
      provider_message_id: messageId,
      updated_at: nowIso(),
    });
  } catch (error) {
    logger.warn({ error, eventType: input.eventType }, "Transactional push dispatch failed");
    return writeRecord({
      ...record,
      status: "failed",
      failure_reason: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      updated_at: nowIso(),
    });
  }
}

export async function dispatchTransactionalNotification(
  input: TransactionalNotificationInput,
): Promise<TransactionalNotificationRecord[]> {
  if (!input.subjectId) {
    return [];
  }

  try {
    const profile = await readRecipientProfile(input);
    const records = await Promise.all([
      dispatchEmail(input, profile),
      dispatchInApp(input),
      dispatchPush(input, profile),
    ]);
    return records;
  } catch (error) {
    logger.warn({ error, eventType: input.eventType }, "Transactional notification dispatch failed");
    return [];
  }
}

async function readDisbursement(
  disbursementId: string,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  if (!db || !disbursementId) {
    return null;
  }
  const snapshot = await db.collection("creatorPayoutDisbursements").doc(disbursementId).get();
  return snapshot.exists
    ? {
        id: snapshot.id || disbursementId,
        ...((snapshot.data() || {}) as Record<string, unknown>),
      }
    : null;
}

export async function dispatchCreatorPayoutSettlementNotifications(input: {
  disbursementId: string;
  status: "paid" | "failed" | "canceled";
  stripePayoutId: string;
  sourceEventId?: string | null;
  failureReason?: string | null;
}) {
  const disbursement = await readDisbursement(input.disbursementId);
  if (!disbursement) {
    return [];
  }
  const creatorId = stringValue(disbursement.creator_id, 160);
  const amountCents = stringValue(disbursement.disbursed_amount_cents, 80);
  const failed = input.status !== "paid";
  return dispatchTransactionalNotification({
    eventType: failed ? "payout_failed" : "payout_sent",
    recipientType: "creator",
    recipientUserId: creatorId,
    subjectId: input.disbursementId,
    sourceEventId: input.sourceEventId || input.stripePayoutId,
    sourceCollection: "creatorPayoutDisbursements",
    sourceDocId: input.disbursementId,
    title: failed ? "Blueprint payout needs review" : "Blueprint payout sent",
    body: failed
      ? `A Blueprint payout for ${amountCents || "your capture"} cents failed or was canceled. ${input.failureReason || "Review the payout status in Blueprint."}`
      : `A Blueprint payout for ${amountCents || "your capture"} cents was marked paid by Stripe.`,
    emailSubject: failed ? "Your Blueprint payout needs review" : "Your Blueprint payout was sent",
    emailText: failed
      ? `A Blueprint payout for ${amountCents || "your capture"} cents failed or was canceled. ${input.failureReason || "Review the payout status in Blueprint."}`
      : `A Blueprint payout for ${amountCents || "your capture"} cents was marked paid by Stripe.`,
    preferenceKey: "payouts",
    data: {
      disbursement_id: input.disbursementId,
      stripe_payout_id: input.stripePayoutId,
      status: input.status,
    },
  });
}
