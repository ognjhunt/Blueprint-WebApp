// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: vi.fn(async () => ({})) }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.invalid/1"); vi.stubEnv("MODE", "production"); vi.stubGlobal("fetch", vi.fn(async () => new Response("{}"))); });
it("sends a scrubbed error to Blueprint's own error log only, even with a Sentry DSN set", async () => {
  window.history.replaceState({}, "", "/capture-upload/private-link?access=private-query#private-fragment");
  const { errorTracking } = await import("@/lib/errorTracking");
  errorTracking.captureException(new Error(`Failed ${window.location.href}`), { extra: { token: "private-token" } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual(["/api/errors"]);
  const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
  expect(body).toContain("[redacted]");
  expect(body).not.toMatch(/private-link|private-query|private-fragment|private-token/);
});
