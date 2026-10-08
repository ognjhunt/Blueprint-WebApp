import { beforeEach, expect, it } from "vitest";
import { readSiteCaptureDraft, writeSiteCaptureDraft, clearSiteCaptureDraft, siteCaptureDraftKey, SITE_CAPTURE_DRAFT_TTL_MS, type SiteCaptureDraft } from "@/lib/siteCaptureDraft";
const now = 1_000_000_000;
const make = (): SiteCaptureDraft => ({ version: 1, createdAt: now, requestId: "capture-1234567890123456", retryToken: "12345678901234567890123456789012ab", fields: { startTask: "Synthetic task" }, method: "phone", region: "us" });
beforeEach(() => localStorage.clear());
const returnCases = [
  ...["anonymous", "account-a"].flatMap(scope => [
    { condition: "unsubmitted", age: 0 }, { condition: "uncertain", age: 0 },
    { condition: "saved", age: 0 }, { condition: "ttl-before", age: SITE_CAPTURE_DRAFT_TTL_MS - 1 },
    { condition: "ttl-exact", age: SITE_CAPTURE_DRAFT_TTL_MS }, { condition: "ttl-after", age: SITE_CAPTURE_DRAFT_TTL_MS + 1 },
    { condition: "future-clock", age: -1 }, { condition: "bad-version", age: 0 },
    { condition: "bad-id", age: 0 }, { condition: "bad-retry", age: 0 },
    { condition: "bad-field", age: 0 }, { condition: "bad-method", age: 0 },
    { condition: "foreign-private-link", age: 0 }, { condition: "explicit-clear", age: 0 },
    { condition: "wrong-account", age: 0 },
  ].map(parameters => ({ scope, ...parameters }))),
].map((parameters, index) => ({ caseId: `A-R-${String(index + 1).padStart(3, "0")}`, ...parameters }));
it.each(returnCases)("$caseId return $scope $condition", ({ scope, condition, age }) => {
  const key = siteCaptureDraftKey(scope === "anonymous" ? null : scope);
  const draft = make();
  if (condition === "uncertain") draft.submittedBody = JSON.stringify({ requestId: draft.requestId, retryToken: draft.retryToken });
  if (condition === "saved" || condition === "foreign-private-link") draft.saved = {
    status: "done", email: "qa@example.invalid", regionApproved: true, hasFootage: false, selfRecording: true,
    uploaded: "none", processingRetryAvailable: false, linkOnlyNote: null, uploadMessage: null, captureUrl: condition === "saved" ? "/capture-upload/synthetic-token" : "https://foreign.invalid/capture-upload/token", workspaceUrl: null,
  };
  if (condition === "bad-version") (draft as any).version = 2;
  if (condition === "bad-id") draft.requestId = "bad";
  if (condition === "bad-retry") draft.retryToken = "bad";
  if (condition === "bad-field") (draft as any).fields.startTask = { nested: "data" };
  if (condition === "bad-method") (draft as any).method = "arbitrary";
  expect(writeSiteCaptureDraft(key, draft)).toBe(true);
  if (condition === "explicit-clear") clearSiteCaptureDraft(key);
  const result = readSiteCaptureDraft(condition === "wrong-account" ? siteCaptureDraftKey("other-account") : key, now + age);
  const valid = ["unsubmitted", "uncertain", "saved", "ttl-before"].includes(condition);
  expect(Boolean(result)).toBe(valid);
  if (valid) expect(result).toEqual(draft);
  if (!valid && condition !== "wrong-account") expect(localStorage.getItem(key)).toBeNull();
});

it("A-R-031 v2 stale autosave cannot erase an uncertain submitted request", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const submittedBody = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken });
  writeSiteCaptureDraft(key, { ...original, submittedBody });
  writeSiteCaptureDraft(key, { ...original, fields: { startTask: "Edited in an already open tab" } });
  expect(readSiteCaptureDraft(key)?.submittedBody).toBe(submittedBody);
});

it("A-R-032 v2 stale autosave cannot erase an acknowledged recovery route", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const saved = { status: "done", email: "qa@example.invalid", regionApproved: true, hasFootage: false,
    selfRecording: true, uploaded: "none", processingRetryAvailable: false, linkOnlyNote: null,
    uploadMessage: null, captureUrl: "/capture-upload/synthetic-original", workspaceUrl: null };
  writeSiteCaptureDraft(key, { ...original, saved });
  writeSiteCaptureDraft(key, original);
  expect(readSiteCaptureDraft(key)?.saved).toEqual(saved);
});

it("A-R-034 v2 expired submitted and saved snapshots cannot resurrect recovery", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  writeSiteCaptureDraft(key, { ...original, submittedBody: JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken }) });
  expect(readSiteCaptureDraft(key, original.createdAt + SITE_CAPTURE_DRAFT_TTL_MS)).toBeNull();
  expect(localStorage.getItem(`${key}:submitted`)).toBeNull();
});

it("A-R-035 v2 explicit clear removes every scoped recovery snapshot", () => {
  const key = siteCaptureDraftKey("owned-account");
  const original = { ...make(), createdAt: Date.now() };
  writeSiteCaptureDraft(key, { ...original, submittedBody: JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken }) });
  clearSiteCaptureDraft(key);
  expect([key, `${key}:submitted`, `${key}:saved`].every(k => localStorage.getItem(k) === null)).toBe(true);
});

it("A-R-036 v2 a rejection of different bytes cannot erase the current uncertain request", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const submittedBody = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken });
  writeSiteCaptureDraft(key, { ...original, submittedBody });
  writeSiteCaptureDraft(key, original, { rejectedBody: `${submittedBody} ` });
  expect(readSiteCaptureDraft(key)?.submittedBody).toBe(submittedBody);
});

it("A-R-037 v2 matching validation rejection permits a corrected request", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const submittedBody = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken });
  writeSiteCaptureDraft(key, { ...original, submittedBody });
  writeSiteCaptureDraft(key, original, { rejectedBody: submittedBody });
  expect(readSiteCaptureDraft(key)?.submittedBody).toBeUndefined();
  const corrected = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken, taskDescription: "Corrected" });
  writeSiteCaptureDraft(key, { ...original, submittedBody: corrected });
  expect(readSiteCaptureDraft(key)?.submittedBody).toBe(corrected);
});

it("A-R-038 v2 an incompatible stale identity cannot overwrite a protected request", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const submittedBody = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken });
  writeSiteCaptureDraft(key, { ...original, submittedBody });
  expect(writeSiteCaptureDraft(key, { ...original, requestId: "capture-0987654321098765" })).toBe(false);
  expect(readSiteCaptureDraft(key)?.submittedBody).toBe(submittedBody);
});

it("A-R-039 v2 protected submitted identity wins over a conflicting stale base", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const submittedBody = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken });
  writeSiteCaptureDraft(key, { ...original, submittedBody });
  localStorage.setItem(key, JSON.stringify({ ...original, requestId: "capture-0987654321098765" }));
  expect(readSiteCaptureDraft(key)?.requestId).toBe(original.requestId);
  expect(readSiteCaptureDraft(key)?.submittedBody).toBe(submittedBody);
});

it("A-R-040 v2 a changed retry credential cannot corrupt a protected request", () => {
  const key = siteCaptureDraftKey();
  const original = { ...make(), createdAt: Date.now() };
  const submittedBody = JSON.stringify({ requestId: original.requestId, retryToken: original.retryToken });
  writeSiteCaptureDraft(key, { ...original, submittedBody });
  expect(writeSiteCaptureDraft(key, { ...original, retryToken: "09876543210987654321098765432109ab" })).toBe(false);
  expect(readSiteCaptureDraft(key)?.retryToken).toBe(original.retryToken);
  expect(readSiteCaptureDraft(key)?.submittedBody).toBe(submittedBody);
});
