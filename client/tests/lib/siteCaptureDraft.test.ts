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
