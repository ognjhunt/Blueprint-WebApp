// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), set_config: vi.fn(),
  opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn(),
}));
const csrf = vi.hoisted(() => vi.fn(async () => ({ "Content-Type": "application/json" })));
vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: csrf }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("optional analytics consent boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_ENABLE_ANALYTICS", "1");
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-CONSENTTEST");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "public-test-project-token");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://analytics.example.invalid");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    csrf.mockResolvedValue({ "Content-Type": "application/json" });
    window.history.replaceState({}, "", "/privacy");
    localStorage.clear();
    document.getElementById("ga-script")?.remove();
    delete window.gtag;
    delete window.dataLayer;
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("sends nothing and writes no analytics identifier before consent or after rejection", async () => {
    const analytics = await import("@/lib/analytics");
    for (const choice of [null, { analytics: false, marketing: false }, { analytics: false, marketing: true }]) {
      analytics.initializeAnalytics(choice);
      analytics.trackPageView("/privacy");
      analytics.trackEvent("signup");
    }
    await flush();
    expect(document.getElementById("ga-script")).toBeNull();
    expect(window.gtag).toBeUndefined();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(csrf).not.toHaveBeenCalled();
    expect(localStorage.getItem("bp.analytics.anonymousId")).toBeNull();
  });

  it("starts providers only after opt-in and never enables session replay or form autocapture", async () => {
    const analytics = await import("@/lib/analytics");
    analytics.initializeAnalytics(null);
    analytics.updateAnalyticsConsent({ analytics: true, marketing: false });
    await flush();
    expect(document.getElementById("ga-script")).not.toBeNull();
    expect(posthog.init).toHaveBeenCalledWith("public-test-project-token", expect.objectContaining({
      disable_session_recording: true, autocapture: false, capture_heatmaps: false,
      capture_pageview: false, capture_pageleave: false,
    }));
    analytics.trackEvent("signup", { source: "header" });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith("signup", { source: "header" });
    expect(localStorage.getItem("bp.analytics.anonymousId")).not.toBeNull();
  });

  it("withdrawal stops events and clears optional cookies and identifiers without clearing sign-in", async () => {
    const analytics = await import("@/lib/analytics");
    analytics.initializeAnalytics({ analytics: true, marketing: true });
    await flush();
    localStorage.setItem("bp.analytics.anonymousId", "old-id");
    localStorage.setItem("ph_test_posthog", "old-id");
    localStorage.setItem("firebase:authUser:fixture", "keep-sign-in");
    document.cookie = "_ga=old-id; Path=/";
    document.cookie = "csrfToken=keep-essential; Path=/";
    analytics.updateAnalyticsConsent({ analytics: false, marketing: false });
    analytics.trackPageView("/privacy");
    analytics.trackEvent("signup");
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).toHaveBeenCalledWith();
    expect(localStorage.getItem("bp.analytics.anonymousId")).toBeNull();
    expect(localStorage.getItem("ph_test_posthog")).toBeNull();
    expect(localStorage.getItem("firebase:authUser:fixture")).toBe("keep-sign-in");
    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).toContain("csrfToken=");
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-CONSENTTEST"]).toBe(true);
  });

  it("does not send an event queued before withdrawal while CSRF was loading", async () => {
    let release!: (value: { "Content-Type": string }) => void;
    csrf.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const analytics = await import("@/lib/analytics");
    analytics.initializeAnalytics({ analytics: true, marketing: false });
    analytics.trackEvent("signup");
    analytics.updateAnalyticsConsent({ analytics: false, marketing: false });
    release({ "Content-Type": "application/json" });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("keeps the capture tool free of analytics even with a previous site opt-in", async () => {
    window.history.replaceState({}, "", "/capture-upload/test-link");
    const analytics = await import("@/lib/analytics");
    analytics.initializeAnalytics({ analytics: true, marketing: true });
    analytics.trackPageView(window.location.pathname);
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(document.getElementById("ga-script")).toBeNull();
  });
  it("redacts private URLs and email addresses in titles and campaign attribution", async () => {
    window.history.replaceState({}, "", "/privacy?utm_content=" + encodeURIComponent("https://tryblueprint.io/claim/private-link?access=secret") + "&utm_source=person%40example.com");
    const analytics = await import("@/lib/analytics");
    analytics.initializeAnalytics({ analytics: true, marketing: false });
    analytics.trackPageView("/privacy?access=secret", "Contact person@example.com");
    await flush();
    const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
    expect(body).not.toMatch(/private-link|person@example.com|access=secret/);
    expect(body).toContain("[redacted]");
    expect(JSON.stringify(window.dataLayer)).not.toContain("person@example.com");
  });
});
