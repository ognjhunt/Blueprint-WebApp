// Program v3 amendment: future clocks beyond the frozen 60s tolerance are rejected.
// First peer-contract adaptation retained 37 passes/2 failures at age -1ms; that
// prior expectation was incompatible with the already documented 60s tolerance.
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readSiteCaptureRecovery, writeSiteCaptureRecovery, forgetSiteCaptureRecovery, siteCaptureDraftKey, SITE_CAPTURE_DRAFT_TTL_MS, type SiteCaptureRecovery } from "@/lib/siteCaptureDraft";
const now = 1000000000;
const make = (): SiteCaptureRecovery => ({ version: 1, savedAt: now,
    requestId: "capture-00000000-0000-4000-8000-000000000001", retryToken: "00000000-0000-4000-8000-000000000002",
    draft: { task: "Synthetic task", location: "Austin TX", email: "qa@example.invalid", company: "Owned fixture", method: "phone", region: "us", regionManuallySet: false }, pending: null });
function pending(row: SiteCaptureRecovery, acknowledged = false) {
    return { endpoint: "/api/inbound-request" as const, acknowledged,
        body: JSON.stringify({ requestId: row.requestId, retryToken: row.retryToken, buyerType: "site_operator", taskStatement: row.draft.task, siteLocation: row.draft.location, captureRegion: row.draft.region }) };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); localStorage.clear(); });
afterEach(() => vi.useRealTimers());
const definitions = ["anonymous", "account-a"].flatMap(scope => [
    { condition: "unsubmitted", age: 0 }, { condition: "uncertain", age: 0 }, { condition: "saved", age: 0 },
    { condition: "ttl-before", age: SITE_CAPTURE_DRAFT_TTL_MS - 1 }, { condition: "ttl-exact", age: SITE_CAPTURE_DRAFT_TTL_MS }, { condition: "ttl-after", age: SITE_CAPTURE_DRAFT_TTL_MS + 1 },
    { condition: "future-clock", age: -60001 }, { condition: "bad-version", age: 0 }, { condition: "bad-id", age: 0 }, { condition: "bad-retry", age: 0 },
    { condition: "bad-field", age: 0 }, { condition: "bad-method", age: 0 }, { condition: "foreign-private-link", age: 0 }, { condition: "explicit-clear", age: 0 }, { condition: "wrong-account", age: 0 }
].map(row => ({ scope, ...row }))).map((row, index) => ({ caseId: `A-R-${String(index + 1).padStart(3, "0")}`, ...row }));
it.each(definitions)("$caseId preserved return $scope $condition", ({ scope, condition, age }) => {
    const key = siteCaptureDraftKey(scope === "anonymous" ? null : scope, "none");
    const row = make();
    if (condition === "uncertain" || condition === "saved")
        row.pending = pending(row, condition === "saved");
    if (condition === "bad-version")
        (row as any).version = 2;
    if (condition === "bad-id")
        row.requestId = "bad";
    if (condition === "bad-retry")
        row.retryToken = "bad";
    if (condition === "bad-field")
        (row.draft as any).task = { nested: "data" };
    if (condition === "bad-method")
        (row.draft as any).method = "arbitrary";
    if (condition === "foreign-private-link")
        (row as any).captureUrl = "https://foreign.invalid/capture-upload/token";
    expect(writeSiteCaptureRecovery(key, row)).toBe(true);
    if (condition === "explicit-clear")
        expect(forgetSiteCaptureRecovery(key)).toBe(true);
    vi.setSystemTime(now + age);
    const result = readSiteCaptureRecovery(condition === "wrong-account" ? siteCaptureDraftKey("other-account", "none") : key);
    const valid = ["unsubmitted", "uncertain", "saved", "ttl-before", "foreign-private-link"].includes(condition);
    expect(Boolean(result)).toBe(valid);
    if (valid) {
        expect(result?.requestId).toBe(row.requestId);
        expect(result?.retryToken).toBe(row.retryToken);
        expect(result?.pending).toEqual(row.pending);
    }
    if (condition === "foreign-private-link")
        expect(localStorage.getItem(key)).not.toContain("foreign.invalid");
    if (!valid && !["wrong-account", "explicit-clear"].includes(condition))
        expect(localStorage.getItem(key)).not.toBeNull();
});
it("A-R-031 preserved stale autosave cannot erase uncertain snapshot", () => { const key = siteCaptureDraftKey(null, "none"), row = make(); const p = pending(row); writeSiteCaptureRecovery(key, { ...row, pending: p }); expect(writeSiteCaptureRecovery(key, { ...row, draft: { ...row.draft, task: "Later stale edit" } })).toBe(false); expect(readSiteCaptureRecovery(key)?.pending).toEqual(p); });
it("A-R-032 preserved stale autosave cannot erase acknowledgement", () => { const key = siteCaptureDraftKey(null, "none"), row = make(), p = pending(row, true); writeSiteCaptureRecovery(key, { ...row, pending: p }); expect(writeSiteCaptureRecovery(key, row)).toBe(false); expect(readSiteCaptureRecovery(key)?.pending).toEqual(p); });
it("A-R-034 preserved expired snapshot cannot resurrect recovery", () => { const key = siteCaptureDraftKey(null, "none"), row = make(); writeSiteCaptureRecovery(key, { ...row, pending: pending(row) }); vi.setSystemTime(now + SITE_CAPTURE_DRAFT_TTL_MS); expect(readSiteCaptureRecovery(key)).toBeNull(); expect(writeSiteCaptureRecovery(key, { ...make(), savedAt: Date.now() })).toBe(false); expect(localStorage.getItem(key)).not.toBeNull(); });
it("A-R-035 preserved explicit clear removes scoped recovery", () => { const key = siteCaptureDraftKey("owned-account", "none"), row = make(); writeSiteCaptureRecovery(key, { ...row, pending: pending(row) }); expect(forgetSiteCaptureRecovery(key)).toBe(true); expect(localStorage.getItem(key)).toBeNull(); });
it("A-R-036 preserved different rejection bytes cannot erase uncertainty", () => { const key = siteCaptureDraftKey(null, "none"), row = make(), p = pending(row); writeSiteCaptureRecovery(key, { ...row, pending: p }); expect(writeSiteCaptureRecovery(key, row, { releasePendingBody: p.body + " " })).toBe(false); expect(readSiteCaptureRecovery(key)?.pending).toEqual(p); });
it("A-R-037 preserved exact refusal permits corrected snapshot", () => { const key = siteCaptureDraftKey(null, "none"), row = make(), p = pending(row); writeSiteCaptureRecovery(key, { ...row, pending: p }); expect(writeSiteCaptureRecovery(key, row, { releasePendingBody: p.body })).toBe(true); expect(readSiteCaptureRecovery(key)?.pending).toBeNull(); const next = { ...row, draft: { ...row.draft, task: "Corrected" } }; expect(writeSiteCaptureRecovery(key, { ...next, pending: pending(next) })).toBe(true); expect(readSiteCaptureRecovery(key)?.pending?.body).toBe(pending(next).body); });
it("A-R-038 preserved changed request identity cannot overwrite protected snapshot", () => { const key = siteCaptureDraftKey(null, "none"), row = make(), p = pending(row); writeSiteCaptureRecovery(key, { ...row, pending: p }); expect(writeSiteCaptureRecovery(key, { ...row, requestId: "capture-00000000-0000-4000-8000-000000000003" })).toBe(false); expect(readSiteCaptureRecovery(key)?.pending).toEqual(p); });
it("A-R-039 preserved corrupted identity cannot become a new intake", () => { const key = siteCaptureDraftKey(null, "none"), row = make(), p = pending(row); writeSiteCaptureRecovery(key, { ...row, pending: p }); const corrupted = JSON.stringify({ ...row, requestId: "capture-00000000-0000-4000-8000-000000000003", pending: p }); localStorage.setItem(key, corrupted); expect(readSiteCaptureRecovery(key)).toBeNull(); expect(writeSiteCaptureRecovery(key, { ...row, pending: p })).toBe(false); expect(localStorage.getItem(key)).toBe(corrupted); });
it("A-R-040 preserved changed retry credential cannot corrupt snapshot", () => { const key = siteCaptureDraftKey(null, "none"), row = make(), p = pending(row); writeSiteCaptureRecovery(key, { ...row, pending: p }); expect(writeSiteCaptureRecovery(key, { ...row, retryToken: "00000000-0000-4000-8000-000000000003" })).toBe(false); expect(readSiteCaptureRecovery(key)?.pending).toEqual(p); });

// This diagnostic control is outside the 39-case program denominator.
it("positive control: future clock inside the frozen 60s tolerance", () => {
 const key=siteCaptureDraftKey(null,"clock-positive");
 for (const age of [-1,-60000]) {localStorage.clear();vi.setSystemTime(now); const row=make();expect(writeSiteCaptureRecovery(key,row)).toBe(true);vi.setSystemTime(now+age);expect(readSiteCaptureRecovery(key)?.requestId).toBe(row.requestId);}
});
