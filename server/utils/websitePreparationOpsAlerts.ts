/**
 * Beta journey L3/L6: notify operators when website preparation goes quiet or
 * ends. Claims expire; only a confirmed transport acknowledgement closes work.
 * Existing monitor scheduling, recipients and send controls remain unchanged.
 */
import { randomUUID } from "node:crypto";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { sendEmail } from "./email";
import { appBaseUrl, opsNoticeRecipient } from "./intakeOpsNotice";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { projectWebsiteSceneProgression } from "./websiteSceneProgression";
import { firstStatusAlertMs, isWebsitePreparationCapture, parseWebsitePreparationWatch, stuckAlertMs,
  websitePreparationAlertDeliverySchema, WEBSITE_PREPARATION_WATCH_DUE_FIELD, WEBSITE_PREPARATION_WATCH_FIELD,
  type WebsitePreparationAlertDelivery, type WebsitePreparationWatch } from "./websitePreparationWatch";

const SESSIONS = "captureUploadSessions";
const INTAKE_ALERT_COLLECTION = "opsWebsiteSceneIntakeAlerts";
const LEASE_MS = 5 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;
const TRANSPORT_TIMEOUT_MS = 20_000;

type Doc = { id: string; ref?: unknown; data: () => Record<string, any> | undefined };
type Store = {
  collection: (name: string) => {
    where: (field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown) => {
      limit: (n: number) => { get: () => Promise<{ docs: Doc[] }> };
    };
    doc: (id: string) => any;
  };
  runTransaction: <T>(action: (tx: any) => Promise<T>) => Promise<T>;
};
type AlertDeps = {
  store?: Store | null;
  now?: () => number;
  limit?: number;
  alert?: (key: string, message: string) => Promise<unknown>;
  email?: typeof sendEmail;
};
type Action = "check" | "email_started" | "delivered_slack" | "delivered_email"
  | "retry" | "retry_email_not_sent" | "retry_email_unknown";
type ClaimedAlert = { id: string; line: string; update: (action: Action) => Promise<boolean> };

function describe(watch: WebsitePreparationWatch): string {
  if (watch.kind === "awaiting_first_status") return `no preparation status since its upload was recorded at ${watch.since_iso}`;
  if (watch.kind === "ended") return `preparation ended for good (${watch.terminal_reason ?? "no reason given"}); review the site's next step`;
  return `preparation ${watch.state ?? "unknown"} unchanged since ${watch.since_iso}`;
}

function pendingDelivery(legacyAlertedAt: unknown = null): WebsitePreparationAlertDelivery {
  const legacy = typeof legacyAlertedAt === "string" ? legacyAlertedAt : null;
  return { schema_version: "website_preparation_ops_delivery.v1", state: "pending", attempts: 0,
    lease_id: null, lease_until_ms: null, email_state: legacy ? "unknown" : "not_started",
    acknowledged_at_iso: null, last_error: legacy ? "legacy_delivery_unverified" : null, legacy_alerted_at_iso: legacy };
}

function claimDelivery(previous: WebsitePreparationAlertDelivery | null | undefined, nowMs: number,
  leaseId: string): WebsitePreparationAlertDelivery | null {
  if (previous?.state === "delivered" || (previous?.state === "claimed" && (previous.lease_until_ms ?? 0) > nowMs)) return null;
  const delivery = previous ?? pendingDelivery();
  return { ...delivery, state: "claimed", attempts: Math.min(delivery.attempts + 1, 1_000_000),
    lease_id: leaseId, lease_until_ms: nowMs + LEASE_MS,
    // The process may have died after the provider accepted the email. Never resend it blindly.
    email_state: delivery.email_state === "sending" ? "unknown" : delivery.email_state };
}

function advanceDelivery(delivery: WebsitePreparationAlertDelivery, action: Action, nowMs: number) {
  if (action === "email_started" && !["not_started", "not_sent"].includes(delivery.email_state)) return null;
  const acknowledged = action === "delivered_slack" || action === "delivered_email";
  const retry = action.startsWith("retry");
  const next: WebsitePreparationAlertDelivery = { ...delivery,
    state: acknowledged ? "delivered" : retry ? "pending" : "claimed",
    lease_id: acknowledged || retry ? null : delivery.lease_id,
    lease_until_ms: acknowledged || retry ? null : nowMs + LEASE_MS,
    email_state: action === "email_started" ? "sending" : action === "delivered_email" ? "sent"
      : action === "retry_email_not_sent" ? "not_sent" : action === "retry_email_unknown" ? "unknown" : delivery.email_state,
    acknowledged_at_iso: acknowledged ? new Date(nowMs).toISOString() : null,
    last_error: retry ? (action === "retry_email_unknown" || delivery.email_state === "unknown"
      ? "email_acknowledgement_unknown" : "ops_alert_unacknowledged") : null };
  const due = acknowledged ? null : retry ? nowMs + Math.min(MAX_RETRY_MS, RETRY_MS * 2 ** Math.min(delivery.attempts - 1, 8))
    : next.lease_until_ms;
  return { delivery: next, due };
}

/** A hung provider cannot hold the whole monitor pass or overlap a five-minute claim. */
async function bounded<T>(send: () => Promise<T>): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(send), new Promise<undefined>(resolve => {
      timer = setTimeout(() => resolve(undefined), TRANSPORT_TIMEOUT_MS);
    })]);
  } catch { return undefined; }
  finally { if (timer) clearTimeout(timer); }
}

async function current(claims: ClaimedAlert[], action: Action): Promise<ClaimedAlert[]> {
  const valid: ClaimedAlert[] = [];
  for (const claim of claims) {
    try { if (await claim.update(action)) valid.push(claim); }
    catch (error) { logger.warn({ err: error, alertId: claim.id }, "Could not update a website preparation alert claim"); }
  }
  return valid;
}

/** Slack first, with ops email as fallback. Every record in a batch is named.
 * Retries stay durable at a capped cadence until one channel acknowledges.
 * Slack is at-least-once if the process dies between acceptance and recording;
 * an ambiguous email remains unknown and only Slack is retried thereafter.
 */
async function report(claims: ClaimedAlert[], deps: AlertDeps, key: string, title: string): Promise<number> {
  let alerted = 0;
  for (let offset = 0; offset < claims.length; offset += 10) {
    const batch = await current(claims.slice(offset, offset + 10), "check");
    if (!batch.length) continue;
    const message = (rows: ClaimedAlert[]) => [`:rotating_light: Blueprint: ${title}`, ...rows.map(row => row.line)].join("\n");
    logger.error({ event: key, count: batch.length }, title);
    const slack = await bounded(() => (deps.alert || sendRateLimitedOpsAlert)(`${key}:${batch[0].id}`, message(batch)));
    if (slack && typeof slack === "object" && "sent" in slack && slack.sent === true) {
      alerted += (await current(batch, "delivered_slack")).length;
      continue;
    }
    // Re-read status and consent immediately before the fallback. Persist email
    // intent first so a lost acknowledgement cannot cause duplicate emails.
    const emailBatch = await current(batch, "email_started");
    if (emailBatch.length) {
      const result = await bounded(() => (deps.email || sendEmail)({ to: opsNoticeRecipient(), subject: `[ALERT] ${title}`,
        text: message(emailBatch).replace(/^:rotating_light: /, "") }));
      if (result?.sent === true) alerted += (await current(emailBatch, "delivered_email")).length;
      else await current(emailBatch, result?.outcome === "not_sent" || result?.provider === null
        ? "retry_email_not_sent" : "retry_email_unknown");
    }
    const emailed = new Set(emailBatch.map(row => row.id));
    await current(batch.filter(row => !emailed.has(row.id)), "retry");
  }
  return alerted;
}

function writeWatch(tx: any, ref: any, watch: WebsitePreparationWatch) {
  tx.set(ref, { [WEBSITE_PREPARATION_WATCH_FIELD]: watch, [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: watch.due_at_ms },
    { mergeFields: [WEBSITE_PREPARATION_WATCH_FIELD, WEBSITE_PREPARATION_WATCH_DUE_FIELD] });
}

/** Claim due work, then acknowledge only a confirmed send. A crash leaves the
 * due index at the lease expiry; a newer status replaces and fences the claim. */
export async function scanWebsitePreparationWatch(deps: AlertDeps = {}): Promise<{ due: number; alerted: number }> {
  const store = deps.store === undefined ? (dbAdmin as unknown as Store | null) : deps.store;
  if (!store) return { due: 0, alerted: 0 };
  const now = deps.now || Date.now;
  const rows = await store.collection(SESSIONS).where(WEBSITE_PREPARATION_WATCH_DUE_FIELD, "<=", now())
    .limit(Math.max(1, Math.min(deps.limit ?? 50, 200))).get();
  const claims: ClaimedAlert[] = [];
  for (const row of rows.docs) {
    const ref = store.collection(SESSIONS).doc(row.id), leaseId = randomUUID();
    try {
      const claimed = await store.runTransaction(async tx => {
        const data = (await tx.get(ref)).data() ?? {}, nowMs = now();
        const due = data[WEBSITE_PREPARATION_WATCH_DUE_FIELD];
        if (typeof due !== "number" || due > nowMs) return null;
        const watch = parseWebsitePreparationWatch(data[WEBSITE_PREPARATION_WATCH_FIELD]);
        const request = watch ? (await tx.get(store.collection("inboundRequests").doc(watch.request_id))).data() : undefined;
        if (!watch || watch.capture_id !== row.id) {
          tx.set(ref, { [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: null }, { mergeFields: [WEBSITE_PREPARATION_WATCH_DUE_FIELD] });
          return null;
        }
        if (projectWebsiteCaptureRights(request).consent_revoked) {
          writeWatch(tx, ref, { ...watch, due_at_ms: null, delivery: { ...(watch.delivery ?? pendingDelivery()),
            state: "cancelled", lease_id: null, lease_until_ms: null } });
          return null;
        }
        if (watch.due_at_ms !== due) return null;
        const delivery = claimDelivery(watch.delivery, nowMs, leaseId);
        if (!delivery) return null;
        const next = { ...watch, due_at_ms: delivery.lease_until_ms, delivery };
        writeWatch(tx, ref, next);
        return next;
      });
      if (!claimed) continue;
      claims.push({ id: row.id, line: `- ${claimed.capture_id} (request ${claimed.request_id}): ${describe(claimed)}. `
        + `${appBaseUrl()}/admin/leads/${encodeURIComponent(claimed.request_id)}`,
      update: action => store.runTransaction(async tx => {
        const data = (await tx.get(ref)).data() ?? {}, nowMs = now();
        const watch = parseWebsitePreparationWatch(data[WEBSITE_PREPARATION_WATCH_FIELD]);
        if (!watch || watch.delivery?.lease_id !== leaseId || watch.delivery.state !== "claimed"
          || (watch.delivery.lease_until_ms ?? 0) <= nowMs) return false;
        const request = (await tx.get(store.collection("inboundRequests").doc(watch.request_id))).data();
        if (projectWebsiteCaptureRights(request).consent_revoked) {
          writeWatch(tx, ref, { ...watch, due_at_ms: null, delivery: { ...watch.delivery,
            state: "cancelled", lease_id: null, lease_until_ms: null } });
          return false;
        }
        const next = advanceDelivery(watch.delivery, action, nowMs);
        if (!next) return false;
        writeWatch(tx, ref, { ...watch, due_at_ms: next.due, delivery: next.delivery,
          alerted_at_iso: next.delivery.acknowledged_at_iso });
        return true;
      }) });
    } catch (error) {
      logger.warn({ err: error, captureId: row.id }, "Could not claim a website preparation watch");
    }
  }
  const alerted = await report(claims, deps, "website_preparation_watch", "Website captures need a look: preparation stuck, never reported, or ended");
  return { due: rows.docs.length, alerted };
}

const FINAL_STATES = new Set(["handed_off", "authority_ended"]);

/**
 * A capture uploaded before the watch shipped has none, so a capture that is
 * already stuck would never alert. Give each one a watch dated from its own
 * recorded upload; the due scan then reports it like any other. A field that is
 * present is preserved, except legacy pre-send alert marks whose delivery was
 * never confirmed. Those are recovered at the same bounded scan cadence.
 */
export async function backfillWebsitePreparationWatches(deps: AlertDeps = {}): Promise<{ scanned: number; started: number }> {
  const store = deps.store === undefined ? (dbAdmin as unknown as Store | null) : deps.store;
  if (!store) return { scanned: 0, started: 0 };
  const nowMs = (deps.now || Date.now)();
  const limit = Math.max(1, Math.min(deps.limit ?? 50, 100));
  let scanned = 0, started = 0;
  for (const [field, value, cursor] of [
    ["browser_pending_delivery.state", "published", "website_preparation_watch_backfill_browser"],
    ["site_capture_bundle.schema_version", "site_capture_bundle_session.v1", "website_preparation_watch_backfill_bundle"],
  ] as const) {
    const rows = await automationBatch(store as unknown as FirebaseFirestore.Firestore,
      store.collection(SESSIONS).where(field, "==", value) as unknown as FirebaseFirestore.Query, cursor, limit) as unknown as { docs: Doc[] };
    for (const row of rows.docs) {
      scanned++;
      const previous = parseWebsitePreparationWatch(row.data()?.[WEBSITE_PREPARATION_WATCH_FIELD]);
      const legacy = previous?.alerted_at_iso && !previous.delivery;
      if (row.data()?.[WEBSITE_PREPARATION_WATCH_FIELD] !== undefined && !legacy) continue;
      try {
        const began = await store.runTransaction(async tx => {
          const ref = store.collection(SESSIONS).doc(row.id);
          const data = (await tx.get(ref)).data();
          if (!data) return false;
          const previous = parseWebsitePreparationWatch(data[WEBSITE_PREPARATION_WATCH_FIELD]);
          if (previous?.alerted_at_iso && !previous.delivery) {
            // A legacy timestamp was recorded before transport, so delivery is
            // unknown. Preserve it and retry Slack without duplicating email.
            const status = data.website_preparation?.status;
            if (status?.state && FINAL_STATES.has(status.state)) return false;
            writeWatch(tx, ref, { ...previous, due_at_ms: nowMs, alerted_at_iso: null,
              delivery: pendingDelivery(previous.alerted_at_iso) });
            return true;
          }
          if (data[WEBSITE_PREPARATION_WATCH_FIELD] !== undefined) return false;
          const source = data.browser_pending_delivery?.state === "published" ? data.browser_pending_delivery : data.site_capture_bundle;
          const { request_id: requestId, scene_id: sceneId, capture_id: captureId } = source ?? {};
          if (typeof requestId !== "string" || typeof sceneId !== "string" || captureId !== row.id
            || !isWebsitePreparationCapture(requestId, sceneId, captureId)) return false;
          const uploaded = Date.parse(String(source.completed_at_iso ?? source.recorded_at_iso ?? ""));
          const since = Number.isFinite(uploaded) ? Math.min(uploaded, nowMs) : nowMs;
          const status = data.website_preparation?.status;
          const state = typeof status?.state === "string" ? status.state : null;
          const attempt = Number.isSafeInteger(status?.attempt_count) && status.attempt_count > 0 ? status.attempt_count : null;
          const watch: WebsitePreparationWatch | null = state && FINAL_STATES.has(state) ? null : {
            schema_version: "website_preparation_watch.v1", request_id: requestId, capture_id: captureId,
            kind: state === "failed_terminal" ? "ended" : state ? "unchanged_state" : "awaiting_first_status",
            state, terminal_reason: state === "failed_terminal" && typeof status?.terminal_reason === "string" ? status.terminal_reason : null,
            attempt_count: attempt, since_iso: new Date(since).toISOString(), alerted_at_iso: null, delivery: null,
            due_at_ms: state === "failed_terminal" ? nowMs : since + (state ? stuckAlertMs() : firstStatusAlertMs()) };
          tx.set(ref, { [WEBSITE_PREPARATION_WATCH_FIELD]: watch, [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: watch?.due_at_ms ?? null },
            { mergeFields: [WEBSITE_PREPARATION_WATCH_FIELD, WEBSITE_PREPARATION_WATCH_DUE_FIELD] });
          return watch !== null;
        });
        if (began) started++;
      } catch (error) {
        logger.warn({ err: error, captureId: row.id }, "Could not start a website preparation watch");
      }
    }
  }
  return { scanned, started };
}

/** The same recoverable delivery contract covers scenes that ended after hand-off. */
export async function scanEndedWebsiteSceneIntakes(deps: AlertDeps = {}): Promise<{ ended: number; alerted: number }> {
  const store = deps.store === undefined ? (dbAdmin as unknown as Store | null) : deps.store;
  if (!store) return { ended: 0, alerted: 0 };
  const now = deps.now || Date.now, limit = Math.max(1, Math.min(deps.limit ?? 50, 100));
  const ended: { id: string; requestId: string }[] = [];
  for (const state of ["blocked", "expired", "accepted"]) {
    const rows = await automationBatch(store as unknown as FirebaseFirestore.Firestore,
      store.collection(SCENE_INTAKE_COLLECTION).where("state", "==", state) as unknown as FirebaseFirestore.Query,
      `website_scene_intake_alerts_${state}`, limit) as unknown as { docs: Doc[] };
    for (const row of rows.docs) {
      const data = row.data();
      if (typeof data?.website_request_id === "string" && projectWebsiteSceneProgression(data)?.state === "ended")
        ended.push({ id: row.id, requestId: data.website_request_id });
    }
  }
  const claims: ClaimedAlert[] = [];
  for (const intake of ended) {
    const ref = store.collection(INTAKE_ALERT_COLLECTION).doc(intake.id);
    const sourceRef = store.collection(SCENE_INTAKE_COLLECTION).doc(intake.id), leaseId = randomUUID();
    const stillEnded = (data: any) => data?.website_request_id === intake.requestId && data.state !== "revoked"
      && projectWebsiteSceneProgression(data)?.state === "ended";
    try {
      const claimed = await store.runTransaction(async tx => {
        const source = (await tx.get(sourceRef)).data(), marker = (await tx.get(ref)).data() ?? {};
        const request = (await tx.get(store.collection("inboundRequests").doc(intake.requestId))).data(), nowMs = now();
        if (!stillEnded(source) || projectWebsiteCaptureRights(request).consent_revoked
          || (typeof marker.next_attempt_at_ms === "number" && marker.next_attempt_at_ms > nowMs)) return false;
        const parsed = websitePreparationAlertDeliverySchema.safeParse(marker.delivery);
        // A newer or malformed delivery record is unknown, not permission to
        // send again. Preserve it for inspection instead of resetting it.
        if (marker.delivery !== undefined && marker.delivery !== null && !parsed.success) return false;
        const delivery = claimDelivery(parsed.success ? parsed.data : pendingDelivery(marker.alerted_at_iso), nowMs, leaseId);
        if (!delivery) return false;
        tx.set(ref, { intake_id: intake.id, request_id: intake.requestId, delivery,
          next_attempt_at_ms: delivery.lease_until_ms, alerted_at_iso: null }, { merge: true });
        return true;
      });
      if (!claimed) continue;
      claims.push({ id: intake.id, line: `- scene intake ${intake.id} (request ${intake.requestId}) cannot become runnable. `
        + `${appBaseUrl()}/admin/leads/${encodeURIComponent(intake.requestId)}`,
      update: action => store.runTransaction(async tx => {
        const source = (await tx.get(sourceRef)).data(), marker = (await tx.get(ref)).data() ?? {};
        const request = (await tx.get(store.collection("inboundRequests").doc(intake.requestId))).data(), nowMs = now();
        const parsed = websitePreparationAlertDeliverySchema.safeParse(marker.delivery);
        if (!parsed.success || parsed.data.lease_id !== leaseId || parsed.data.state !== "claimed"
          || (parsed.data.lease_until_ms ?? 0) <= nowMs) return false;
        if (!stillEnded(source) || projectWebsiteCaptureRights(request).consent_revoked) {
          tx.set(ref, { delivery: { ...parsed.data, state: "cancelled", lease_id: null, lease_until_ms: null },
            next_attempt_at_ms: null }, { merge: true });
          return false;
        }
        const next = advanceDelivery(parsed.data, action, nowMs);
        if (!next) return false;
        tx.set(ref, { delivery: next.delivery, next_attempt_at_ms: next.due,
          alerted_at_iso: next.delivery.acknowledged_at_iso }, { merge: true });
        return true;
      }) });
    } catch (error) {
      logger.warn({ err: error, intakeId: intake.id }, "Could not claim a website scene intake alert");
    }
  }
  return { ended: ended.length, alerted: await report(claims, deps, "website_scene_intake_ended", "Website scenes stopped after hand-off") };
}
