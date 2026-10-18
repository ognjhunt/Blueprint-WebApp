/**
 * Beta journey L3/L6: notice when a website capture's preparation goes quiet.
 *
 * A capture is watched from the moment its upload is recorded until its
 * preparation status is final (handed off, or authority ended). The watch is
 * due when no status has arrived within the first-status bound, when one
 * non-final state has lasted longer than the stuck bound, and at once when
 * preparation ended for good. The beta ops monitor alerts once per due watch,
 * and the site page says only that preparation is taking longer than it should.
 *
 * This is the WebApp's own observation (it covers uploads the Pipeline never
 * reported on, including supplements). It never stands in for a Pipeline status.
 */
import { z } from "zod";
import type { StoredWebsitePreparation } from "./websitePreparationStatus";

export const WEBSITE_PREPARATION_WATCH_FIELD = "website_preparation_watch";
/** Top-level number so a single-field range query (automatic index) finds due watches. */
export const WEBSITE_PREPARATION_WATCH_DUE_FIELD = "website_preparation_watch_due_at_ms";

const FIRST_STATUS_ALERT_MS_ENV = "BLUEPRINT_WEBSITE_PREPARATION_FIRST_STATUS_ALERT_MS";
const STUCK_ALERT_MS_ENV = "BLUEPRINT_WEBSITE_PREPARATION_STUCK_ALERT_MS";
const FINAL_STATES = new Set(["handed_off", "authority_ended"]);

// Every key is always present, so Firestore's merge of this map is a replacement.
const watchSchema = z.object({
  schema_version: z.literal("website_preparation_watch.v1"),
  request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
  capture_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,131}$/),
  kind: z.enum(["awaiting_first_status", "unchanged_state", "ended"]),
  state: z.string().max(40).nullable(),
  terminal_reason: z.string().max(40).nullable(),
  attempt_count: z.number().int().positive().nullable(),
  since_iso: z.string().max(40),
  due_at_ms: z.number().int().nonnegative().nullable(),
  alerted_at_iso: z.string().max(40).nullable(),
}).strict();
export type WebsitePreparationWatch = z.infer<typeof watchSchema>;

function boundMs(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
/** No preparation status at all this long after the upload was recorded. */
export const firstStatusAlertMs = () => boundMs(FIRST_STATUS_ALERT_MS_ENV, 2 * 60 * 60 * 1000);
/** One non-final preparation state unchanged this long. */
export const stuckAlertMs = () => boundMs(STUCK_ALERT_MS_ENV, 24 * 60 * 60 * 1000);

export function parseWebsitePreparationWatch(value: unknown): WebsitePreparationWatch | null {
  const parsed = watchSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isWebsitePreparationCapture(requestId: string, sceneId: string, captureId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(requestId) && sceneId === `site-${requestId}`
    && (captureId === `walkthrough-${requestId}` || /^supplement-[0-9a-f]{40}$/.test(captureId));
}

/** Written in the transaction that records a finished website upload (browser or app bundle). */
export function websitePreparationUploadWatchFields(requestId: string, sceneId: string, captureId: string,
  nowMs = Date.now()): Record<string, unknown> {
  if (!isWebsitePreparationCapture(requestId, sceneId, captureId)) return {};
  const watch: WebsitePreparationWatch = {schema_version: "website_preparation_watch.v1", request_id: requestId,
    capture_id: captureId, kind: "awaiting_first_status", state: null, terminal_reason: null, attempt_count: null,
    since_iso: new Date(nowMs).toISOString(), due_at_ms: nowMs + firstStatusAlertMs(), alerted_at_iso: null};
  return {[WEBSITE_PREPARATION_WATCH_FIELD]: watch, [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: watch.due_at_ms};
}

/** The watch after a status commit. The clock runs from the last change of state, not revision. */
export function nextWebsitePreparationWatch(previous: WebsitePreparationWatch | null,
  preparation: StoredWebsitePreparation, nowMs = Date.now()): WebsitePreparationWatch | null {
  const {selector, status} = preparation;
  if (FINAL_STATES.has(status.state)) return null;
  const base = {schema_version: "website_preparation_watch.v1" as const, request_id: selector.request_id,
    capture_id: selector.capture_id, since_iso: new Date(nowMs).toISOString(), alerted_at_iso: null};
  if (status.state === "failed_terminal") {
    // Each terminal transition is reported to operators once.
    if (previous?.kind === "ended" && previous.attempt_count === status.attempt_count) return previous;
    return {...base, kind: "ended", state: status.state, attempt_count: status.attempt_count,
      terminal_reason: status.schema_version === "website_preparation_status.v2" ? status.terminal_reason : null,
      due_at_ms: nowMs};
  }
  if (previous?.kind === "unchanged_state" && previous.state === status.state) return previous;
  return {...base, kind: "unchanged_state", state: status.state, terminal_reason: null,
    attempt_count: status.attempt_count, due_at_ms: nowMs + stuckAlertMs()};
}

/** Whether the site should be told its preparation is taking longer than it should. */
export function websitePreparationOverdue(value: unknown, nowMs = Date.now()): boolean {
  const watch = parseWebsitePreparationWatch(value);
  if (!watch || watch.kind === "ended") return false;
  const bound = watch.kind === "awaiting_first_status" ? firstStatusAlertMs() : stuckAlertMs();
  const since = Date.parse(watch.since_iso);
  return Number.isFinite(since) && nowMs - since >= bound;
}
