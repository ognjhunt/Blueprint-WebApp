import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

type NullableString = string | null | undefined;

export interface GrowthEventPayload {
  event: string;
  anonymousId?: NullableString;
  sessionId?: NullableString;
  pagePath?: NullableString;
  pageTitle?: NullableString;
  currentUrl?: NullableString;
  referrer?: NullableString;
  source?: NullableString;
  properties?: Record<string, unknown>;
  experiments?: Record<string, string>;
  attribution?: Record<string, unknown>;
  user?: {
    uid?: NullableString;
    email?: NullableString;
  } | null;
}

function normalizeString(value: NullableString) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pruneObject(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;

  const entries = Object.entries(value).filter(([, entry]) => {
    if (entry === null || entry === undefined) return false;
    if (typeof entry === "string") return entry.trim().length > 0;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return Object.keys(entry).length > 0;
    return true;
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export async function logGrowthEvent(payload: GrowthEventPayload) {
  const event = normalizeString(payload.event);
  if (!event) {
    throw new Error("Growth events require an event name.");
  }

  const record = {
    event,
    anonymous_id: normalizeString(payload.anonymousId),
    session_id: normalizeString(payload.sessionId),
    page_path: normalizeString(payload.pagePath),
    page_title: normalizeString(payload.pageTitle),
    current_url: normalizeString(payload.currentUrl),
    referrer: normalizeString(payload.referrer),
    source: normalizeString(payload.source),
    properties: pruneObject(payload.properties) || {},
    experiments: pruneObject(payload.experiments) || {},
    attribution: pruneObject(payload.attribution) || {},
    user: {
      uid: normalizeString(payload.user?.uid),
      email: normalizeString(payload.user?.email),
    },
    created_at_iso: new Date().toISOString(),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!db) {
    logger.info({ growthEvent: record }, "Growth event recorded without Firestore");
    return { ok: true, persisted: false };
  }

  await db.collection("growth_events").add(record);
  return { ok: true, persisted: true };
}
