import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("firebase/app-check");
});

describe("App Check client helper", () => {
  it("adds nothing and loads nothing when no site key is configured", async () => {
    vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "");
    const initializeAppCheck = vi.fn();
    vi.doMock("firebase/app-check", () => ({ initializeAppCheck, ReCaptchaEnterpriseProvider: vi.fn(), getToken: vi.fn() }));
    const { withAppCheckHeader, getAppCheckToken } = await import("../../src/lib/appCheck");
    expect(await withAppCheckHeader({ "X-CSRF-Token": "csrf" })).toEqual({ "X-CSRF-Token": "csrf" });
    expect(await getAppCheckToken()).toBeNull();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });

  it("attaches the token header with reCAPTCHA Enterprise when a site key is set", async () => {
    vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "site-key");
    const provider = vi.fn();
    const initializeAppCheck = vi.fn(() => ({ app: "checker" }));
    const getToken = vi.fn(async () => ({ token: "app-check-token" }));
    vi.doMock("firebase/app-check", () => ({ initializeAppCheck, ReCaptchaEnterpriseProvider: provider, getToken }));
    vi.doMock("../../src/lib/firebase", () => ({ auth: { app: { name: "[DEFAULT]" } } }));
    const { withAppCheckHeader } = await import("../../src/lib/appCheck");
    expect(await withAppCheckHeader({ "Content-Type": "application/json" }))
      .toEqual({ "Content-Type": "application/json", "X-Firebase-AppCheck": "app-check-token" });
    await withAppCheckHeader();
    expect(provider).toHaveBeenCalledWith("site-key");
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
    vi.doUnmock("../../src/lib/firebase");
  });

  it("sends the request without a token when App Check fails", async () => {
    vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "site-key");
    vi.doMock("firebase/app-check", () => ({ initializeAppCheck: vi.fn(() => ({})), ReCaptchaEnterpriseProvider: vi.fn(),
      getToken: vi.fn(async () => { throw new Error("recaptcha blocked"); }) }));
    vi.doMock("../../src/lib/firebase", () => ({ auth: { app: {} } }));
    const { withAppCheckHeader } = await import("../../src/lib/appCheck");
    expect(await withAppCheckHeader({ a: "b" })).toEqual({ a: "b" });
    vi.doUnmock("../../src/lib/firebase");
  });
});
