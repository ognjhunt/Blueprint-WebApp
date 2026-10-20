// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
const sentry = vi.hoisted(() => ({ init: vi.fn(), setUser: vi.fn(), addBreadcrumb: vi.fn(), captureException: vi.fn(), withScope: vi.fn((apply) => apply({ setLevel: vi.fn(), setTags: vi.fn(), setExtras: vi.fn(), setUser: vi.fn(), setContext: vi.fn() })) }));
vi.mock("@sentry/react", () => sentry);
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: vi.fn(async () => ({})) }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.invalid/1"); vi.stubEnv("MODE", "production"); vi.stubGlobal("fetch", vi.fn(async () => new Response("{}"))); });
it("registers sanitizers for automatic Sentry events and scrubs first-party errors", async () => {
  window.history.replaceState({}, "", "/capture-upload/private-link?access=private-query#private-fragment");
  const { errorTracking } = await import("@/lib/errorTracking");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const options = sentry.init.mock.calls[0][0];
  expect(options).toMatchObject({ sendDefaultPii: false, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
  const event = options.beforeSend({ request: { url: window.location.href }, extra: { accessToken: "private-token" }, breadcrumbs: [{ data: { to: window.location.href } }] });
  expect(JSON.stringify(event)).not.toMatch(/private-link|private-query|private-fragment|private-token/);
  errorTracking.captureException(new Error(`Failed ${window.location.href}`), { extra: { token: "private-token" } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
  expect(body).toContain("[redacted]");
  expect(body).not.toMatch(/private-link|private-query|private-fragment|private-token/);
});
