/**
 * Beta journey L3/L6: tell an operator about every website capture whose
 * preparation went quiet or ended, so no site waits on a job nobody is watching.
 *
 * Run by the beta ops monitor (leader-leased, every few minutes). Alerts carry
 * ids, states and admin links only; no recipient, footage or Pipeline detail.
 */
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
  WEBSITE_PREPARATION_WATCH_DUE_FIELD, WEBSITE_PREPARATION_WATCH_FIELD, type WebsitePreparationWatch } from "./websitePreparationWatch";

const SESSIONS = "captureUploadSessions";
/** Create-only markers, one per ended scene intake, so it is reported once. */
const INTAKE_ALERT_COLLECTION = "opsWebsiteSceneIntakeAlerts";

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

function describe(watch: WebsitePreparationWatch): string {
  if (watch.kind === "awaiting_first_status") return `no preparation status since its upload was recorded at ${watch.since_iso}`;
  if (watch.kind === "ended") return `preparation ended for good (${watch.terminal_reason ?? "no reason given"}); the site is emailed`;
  return `preparation ${watch.state ?? "unknown"} unchanged since ${watch.since_iso}`;
}

async function report(lines: string[], deps: AlertDeps, key: string, title: string) {
  const more = lines.length > 10 ? [`- …and ${lines.length - 10} more`] : [];
  const text = [`:rotating_light: Blueprint: ${title}`, ...lines.slice(0, 10), ...more].join("\n");
  logger.error({ event: key, count: lines.length }, title);
  await Promise.resolve((deps.alert || sendRateLimitedOpsAlert)(key, text)).catch(() => undefined);
  await (deps.email || sendEmail)({ to: opsNoticeRecipient(), subject: `[ALERT] ${title}`,
    text: text.replace(/^:rotating_light: /, "") }).catch(() => undefined);
}

/**
 * Alert once per due preparation watch: no status since upload, one state too
 * long, or an ending. The due index is cleared in the same transaction that
 * re-reads it, so a concurrent status commit (a newer clock) always wins.
 */
export async function scanWebsitePreparationWatch(deps: AlertDeps = {}): Promise<{ due: number; alerted: number }> {
  const store = deps.store === undefined ? (dbAdmin as unknown as Store | null) : deps.store;
  if (!store) return { due: 0, alerted: 0 };
  const nowMs = (deps.now || Date.now)();
  const rows = await store.collection(SESSIONS).where(WEBSITE_PREPARATION_WATCH_DUE_FIELD, "<=", nowMs)
    .limit(Math.max(1, Math.min(deps.limit ?? 50, 200))).get();
  const fresh: WebsitePreparationWatch[] = [];
  for (const row of rows.docs) {
    try {
      const claimed = await store.runTransaction(async tx => {
        const ref = store.collection(SESSIONS).doc(row.id);
        const data = (await tx.get(ref)).data() ?? {};
        const due = data[WEBSITE_PREPARATION_WATCH_DUE_FIELD];
        if (typeof due !== "number" || due > nowMs) return null;
        const watch = parseWebsitePreparationWatch(data[WEBSITE_PREPARATION_WATCH_FIELD]);
        const request = watch ? (await tx.get(store.collection("inboundRequests").doc(watch.request_id))).data() : undefined;
        // An unreadable watch leaves the index too, so it cannot hold the scan.
        tx.set(ref, { [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: null,
          ...(watch ? { [WEBSITE_PREPARATION_WATCH_FIELD]: { ...watch, due_at_ms: null, alerted_at_iso: new Date(nowMs).toISOString() } } : {}) },
        { mergeFields: [WEBSITE_PREPARATION_WATCH_DUE_FIELD, ...(watch ? [WEBSITE_PREPARATION_WATCH_FIELD] : [])] });
        // A withdrawn recording is not a stuck job.
        return watch && watch.due_at_ms === due && !projectWebsiteCaptureRights(request).consent_revoked ? watch : null;
      });
      if (claimed) fresh.push(claimed);
    } catch (error) {
      logger.warn({ err: error, captureId: row.id }, "Could not claim a website preparation watch");
    }
  }
  if (fresh.length) {
    await report(fresh.map(watch => `- ${watch.capture_id} (request ${watch.request_id}): ${describe(watch)}. `
      + `${appBaseUrl()}/admin/leads/${encodeURIComponent(watch.request_id)}`), deps,
    `website_preparation_watch:${fresh[0].capture_id}:${nowMs}`,
    `${fresh.length} website capture(s) need a look: preparation stuck, never reported, or ended`);
  }
  return { due: rows.docs.length, alerted: fresh.length };
}

const FINAL_STATES = new Set(["handed_off", "authority_ended"]);

/**
 * A capture uploaded before the watch shipped has none, so a capture that is
 * already stuck would never alert. Give each one a watch dated from its own
 * recorded upload; the due scan then reports it like any other. A field that is
 * present (a watch, or null after a final status) is never touched again.
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
      if (row.data()?.[WEBSITE_PREPARATION_WATCH_FIELD] !== undefined) continue;
      try {
        const began = await store.runTransaction(async tx => {
          const ref = store.collection(SESSIONS).doc(row.id);
          const data = (await tx.get(ref)).data();
          if (!data || data[WEBSITE_PREPARATION_WATCH_FIELD] !== undefined) return false;
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
            attempt_count: attempt, since_iso: new Date(since).toISOString(), alerted_at_iso: null,
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

/** Alert once per website scene intake that can no longer become runnable after hand-off. */
export async function scanEndedWebsiteSceneIntakes(deps: AlertDeps = {}): Promise<{ ended: number; alerted: number }> {
  const store = deps.store === undefined ? (dbAdmin as unknown as Store | null) : deps.store;
  if (!store) return { ended: 0, alerted: 0 };
  const limit = Math.max(1, Math.min(deps.limit ?? 50, 100));
  const ended: { id: string; requestId: string }[] = [];
  // A revoked intent was ended on purpose (withdrawal or an operator); the rest were not.
  // The rotating cursor reaches every row of a state larger than one batch.
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
  const fresh: typeof ended = [];
  for (const intake of ended) {
    try {
      await store.collection(INTAKE_ALERT_COLLECTION).doc(intake.id).create({ intake_id: intake.id,
        request_id: intake.requestId, alerted_at_iso: new Date((deps.now || Date.now)()).toISOString() });
      fresh.push(intake);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code !== 6 && code !== "already-exists" && code !== "ALREADY_EXISTS")
        logger.warn({ err: error, intakeId: intake.id }, "Could not record a website scene intake alert marker");
    }
  }
  if (fresh.length) {
    await report(fresh.map(intake => `- scene intake ${intake.id} (request ${intake.requestId}) cannot become runnable. `
      + `${appBaseUrl()}/admin/leads/${encodeURIComponent(intake.requestId)}`), deps,
    `website_scene_intake_ended:${fresh[0].id}`, `${fresh.length} website scene(s) stopped after hand-off`);
  }
  return { ended: ended.length, alerted: fresh.length };
}
