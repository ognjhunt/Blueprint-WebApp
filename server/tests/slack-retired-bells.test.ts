// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import * as slack from "../utils/slack";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

// Retired 2026-11-22: no screening calls, and no person reviews footage, so neither rings Slack.
it("has no bell for a screening call or for footage review by hand", () => {
  expect(Object.keys(slack)).not.toContain("notifySlackScreeningCallNeeded");
  expect(Object.keys(slack)).not.toContain("notifySlackFootageNeedsReview");
});

it("links the privacy bell to the job's page, not a retired admin path", async () => {
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.example.invalid/x");
  vi.stubEnv("APP_URL", "https://app.example.invalid");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
  await slack.notifySlackCapturePrivacyEscalation({ requestId: "job-1", reason: "Held for review" });
  const text = JSON.parse(String(fetchSpy.mock.calls[0][1]!.body)).text as string;
  expect(text).toContain("https://app.example.invalid/admin/jobs?job=job-1");
  expect(text).not.toContain("/admin/leads/");
});
