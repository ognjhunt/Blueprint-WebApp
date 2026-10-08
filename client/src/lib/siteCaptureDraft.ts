/** Local recovery only; server authorization and saved submission remain authoritative. */
export const SITE_CAPTURE_DRAFT_VERSION = 1;
export const SITE_CAPTURE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export type SiteCaptureDraft = {
  task: string; location: string; email: string; company: string;
  method: "phone" | "upload" | "visit"; region: "" | "us" | "non_us";
  regionManuallySet: boolean;
};
export type SiteCaptureRecovery = {
  version: 1; savedAt: number; requestId: string; retryToken: string;
  draft: SiteCaptureDraft;
  pending: null | { body: string; endpoint: "/api/inbound-request" | "/api/workspace/capture-start"; acknowledged: boolean };
};
export const emptySiteCaptureDraft = (): SiteCaptureDraft => ({
  task: "", location: "", email: "", company: "", method: "phone", region: "", regionManuallySet: false,
});
export function siteCaptureDraftKey(uid: string | null, authoring: string) {
  return `bp-site-capture:v1:${uid === null ? "anonymous" : `account:${encodeURIComponent(uid)}`}:${encodeURIComponent(authoring)}`;
}
export function newSiteCaptureRecovery(): SiteCaptureRecovery {
  return { version: 1, savedAt: Date.now(), requestId: `capture-${crypto.randomUUID()}`,
    retryToken: crypto.randomUUID(), draft: emptySiteCaptureDraft(), pending: null };
}
export function readSiteCaptureRecovery(key: string | null): SiteCaptureRecovery | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length > 25000) return null;
    const value = JSON.parse(raw) as SiteCaptureRecovery;
    const draft = value.draft;
    const now = Date.now();
    if (value.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > now + 60000
      || now - value.savedAt >= SITE_CAPTURE_DRAFT_TTL_MS
      || !/^capture-[a-f0-9-]{36}$/.test(value.requestId) || !/^[a-f0-9-]{36}$/.test(value.retryToken)
      || !draft || !["phone", "upload", "visit"].includes(draft.method)
      || !["", "us", "non_us"].includes(draft.region) || typeof draft.regionManuallySet !== "boolean"
      || !([[draft.task, 2000], [draft.location, 300], [draft.email, 320], [draft.company, 200]] as const)
        .every(([field, limit]) => typeof field === "string" && field.length <= limit)) return null;
    if (value.pending !== null) {
      const pending = value.pending;
      if (!pending || typeof pending.body !== "string" || pending.body.length > 16000
        || typeof pending.acknowledged !== "boolean"
        || !["/api/inbound-request", "/api/workspace/capture-start"].includes(pending.endpoint)) return null;
      const body = JSON.parse(pending.body);
      if (body.requestId !== value.requestId || body.retryToken !== value.retryToken
        || body.buyerType !== "site_operator" || body.taskStatement !== draft.task.trim()
        || body.siteLocation !== draft.location.trim() || body.captureRegion !== draft.region) return null;
    }
    return value;
  } catch { return null; }
}
export function writeSiteCaptureRecovery(key: string | null, value: SiteCaptureRecovery): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    // Persist only the named recovery fields: no File objects or bearer URL
    // can ride along on a future caller's spread object.
    const { task, location, email, company, method, region, regionManuallySet } = value.draft;
    window.localStorage.setItem(key, JSON.stringify({
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, company, method, region, regionManuallySet },
      pending: value.pending ? { body: value.pending.body, endpoint: value.pending.endpoint, acknowledged: value.pending.acknowledged } : null,
    }));
    return true;
  } catch { return false; }
}
export function forgetSiteCaptureRecovery(key: string | null): boolean {
  try { if (key) window.localStorage.removeItem(key); return true; } catch { return false; }
}

/** Preserve uncertainty when stored bytes are unreadable or expired. */
export function hasSiteCaptureRecoveryBytes(key: string | null): boolean {
  if (!key || typeof window === "undefined") return false;
  try { return window.localStorage.getItem(key) !== null; } catch { return false; }
}
