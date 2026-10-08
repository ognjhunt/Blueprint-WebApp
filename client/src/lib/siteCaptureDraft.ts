/** A private, device-local recovery record. Never stores video bytes. */
export const SITE_CAPTURE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export type SiteCaptureDraft = {
  version: 1;
  createdAt: number;
  requestId: string;
  retryToken: string;
  fields: Record<string, string>;
  method: "phone" | "upload" | "visit";
  region: "us" | "non_us" | "";
  regionManuallySet?: boolean;
  submittedBody?: string;
  saved?: Record<string, unknown>;
};
export function siteCaptureDraftKey(accountId?: string | null) {
  return `bp-site-capture-draft-v1:${accountId ? `account:${accountId}` : "anonymous"}`;
}
function validSaved(saved: Record<string, unknown> | undefined): boolean {
  if (!saved) return true;
  if (saved.status !== "done" || typeof saved.email !== "string"
    || typeof saved.regionApproved !== "boolean" || typeof saved.hasFootage !== "boolean"
    || typeof saved.selfRecording !== "boolean" || typeof saved.processingRetryAvailable !== "boolean"
    || !(saved.linkOnlyNote === null || typeof saved.linkOnlyNote === "string")
    || !(saved.uploadMessage === null || typeof saved.uploadMessage === "string") || !["none", "done", "held", "failed", "processing_pending"].includes(String(saved.uploaded))) return false;
  if (saved.captureUrl !== null) {
    if (typeof saved.captureUrl !== "string") return false;
    try {
      const url = new URL(saved.captureUrl, window.location.origin);
      if (url.origin !== window.location.origin || !/^\/capture-upload\/[^/?#]+$/.test(url.pathname)) return false;
    } catch { return false; }
  }
  return saved.workspaceUrl === null || (typeof saved.workspaceUrl === "string" && /^\/app\/tasks\/capture-[a-zA-Z0-9-]+$/.test(saved.workspaceUrl));
}
function validSubmitted(draft: SiteCaptureDraft): boolean {
  if (draft.submittedBody === undefined) return true;
  try {
    const body = JSON.parse(draft.submittedBody);
    return Boolean(body && typeof body === "object" && !Array.isArray(body)
      && body.requestId === draft.requestId && body.retryToken === draft.retryToken);
  } catch { return false; }
}
function readRecord(key: string, now: number): SiteCaptureDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SiteCaptureDraft;
    if (raw.length > 32_768 || draft.version !== 1 || !Number.isFinite(draft.createdAt)
      || now < draft.createdAt || now - draft.createdAt >= SITE_CAPTURE_DRAFT_TTL_MS
      || !/^capture-[a-zA-Z0-9-]{16,128}$/.test(draft.requestId)
      || !/^[a-zA-Z0-9_-]{32,128}$/.test(draft.retryToken)
      || !draft.fields || !Object.values(draft.fields).every(value => typeof value === "string")
      || !validSaved(draft.saved) || !validSubmitted(draft) || !["phone", "upload", "visit"].includes(draft.method)
      || !["us", "non_us", ""].includes(draft.region)
      || (draft.submittedBody !== undefined && typeof draft.submittedBody !== "string")) {
      window.localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    return null;
  }
}
export function readSiteCaptureDraft(key: string, now = Date.now()): SiteCaptureDraft | null {
  const saved = readRecord(`${key}:saved`, now);
  const submitted = readRecord(`${key}:submitted`, now);
  const base = readRecord(key, now);
  // Protected snapshots survive an autosave from a tab mounted before dispatch.
  const draft = saved?.saved ? saved : submitted?.submittedBody ? submitted : base;
  if (!draft) return null;
  if (!draft.saved && submitted?.submittedBody && submitted.requestId === draft.requestId
    && submitted.retryToken === draft.retryToken) draft.submittedBody = submitted.submittedBody;
  return draft;
}
export function writeSiteCaptureDraft(key: string, draft: SiteCaptureDraft, options: { rejectedBody?: string } = {}): boolean {
  try {
    const latest = readSiteCaptureDraft(key);
    if (latest && (latest.saved || latest.submittedBody) && (latest.requestId !== draft.requestId || latest.retryToken !== draft.retryToken)) return false;
    let next = { ...draft };
    const rejectedMatches = Boolean(options.rejectedBody && latest?.requestId === draft.requestId
      && latest.retryToken === draft.retryToken && latest.submittedBody === options.rejectedBody);
    if (latest?.saved && !next.saved) next = latest;
    else if (latest?.submittedBody && !next.saved && !rejectedMatches) next.submittedBody = latest.submittedBody;
    if (rejectedMatches && !next.saved) delete next.submittedBody;
    if (next.saved) {
      delete next.submittedBody;
    }
    const value = JSON.stringify(next);
    if (value.length > 32_768) return false;
    if (next.saved) {
      window.localStorage.setItem(`${key}:saved`, value);
      window.localStorage.removeItem(`${key}:submitted`);
    } else if (next.submittedBody) window.localStorage.setItem(`${key}:submitted`, value);
    else if (rejectedMatches) window.localStorage.removeItem(`${key}:submitted`);
    window.localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}
export async function withSiteCaptureSubmissionLock<T>(key: string, action: () => T): Promise<T> {
  // Modern browsers serialize the tiny local freeze across tabs. No network is held under the lock.
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(key, action);
  }
  return action();
}
export function clearSiteCaptureDraft(key: string) {
  for (const storageKey of [key, `${key}:submitted`, `${key}:saved`]) {
    try { window.localStorage.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
  }
}
