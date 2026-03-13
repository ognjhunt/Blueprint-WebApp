import { afterEach, describe, expect, it, vi } from "vitest";

async function loadClientEnvModule() {
  vi.resetModules();
  return import("@/lib/client-env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("client env helpers", () => {
  it("returns null for optional Google Maps config when it is missing", async () => {
    vi.stubEnv("MODE", "test");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");

    const clientEnv = await loadClientEnvModule();

    expect(clientEnv.getGoogleMapsApiKey()).toBeNull();
  });

  it("throws for missing required Google Drive config in production", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_GOOGLE_API_KEY", "");

    const clientEnv = await loadClientEnvModule();

    expect(() => clientEnv.getGoogleApiKey()).toThrowError(
      /Google Drive upload requires VITE_GOOGLE_API_KEY to be configured\./i,
    );
  });

  it("returns configured Google Drive values without placeholder substitution", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_GOOGLE_API_KEY", "google-api-key");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    vi.stubEnv("VITE_GOOGLE_APP_ID", "app-id");

    const clientEnv = await loadClientEnvModule();

    expect(clientEnv.getGoogleApiKey()).toBe("google-api-key");
    expect(clientEnv.getGoogleClientId()).toBe(
      "client-id.apps.googleusercontent.com",
    );
    expect(clientEnv.getGoogleAppId()).toBe("app-id");
  });

  it("normalizes the public app URL when it is configured", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://app.example.com/");

    const clientEnv = await loadClientEnvModule();

    expect(clientEnv.getPublicAppUrl()).toBe("https://app.example.com");
  });

  it("falls back to the browser origin for the public app URL when env is missing", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_PUBLIC_APP_URL", "");
    window.history.replaceState({}, "", "/demo");

    const clientEnv = await loadClientEnvModule();

    expect(clientEnv.getPublicAppUrl()).toBe(window.location.origin);
  });
});
