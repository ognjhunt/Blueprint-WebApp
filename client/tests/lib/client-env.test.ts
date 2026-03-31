// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGoogleApiKey,
  getGoogleAppId,
  getGoogleClientId,
  getGoogleGenerativeAiKey,
  getGoogleMapsApiKey,
  getInternalSceneAccessCode,
  getPublicAppUrl,
  getCaptureAppPlaceholderUrl,
  MissingClientEnvError,
  resetClientEnvCacheForTests,
} from "@/lib/client-env";

const ENV_KEYS = [
  "VITE_GOOGLE_MAPS_API_KEY",
  "VITE_GOOGLE_GENAI_API_KEY",
  "VITE_GOOGLE_API_KEY",
  "VITE_INTERNAL_SCENE_ACCESS_CODE",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_APP_ID",
  "VITE_PUBLIC_APP_URL",
  "VITE_CAPTURE_APP_PLACEHOLDER_URL",
] as const;

describe("client env helpers", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      import.meta.env[key] = "";
    }
    vi.unstubAllGlobals();
    resetClientEnvCacheForTests();
  });

  it("returns configured optional keys", () => {
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = "maps-key";
    import.meta.env.VITE_GOOGLE_GENAI_API_KEY = "genai-key";
    import.meta.env.VITE_INTERNAL_SCENE_ACCESS_CODE = "scene-code";

    expect(getGoogleMapsApiKey()).toBe("maps-key");
    expect(getGoogleGenerativeAiKey()).toBe("genai-key");
    expect(getInternalSceneAccessCode()).toBe("scene-code");
  });

  it("returns required Google keys when configured", () => {
    import.meta.env.VITE_GOOGLE_API_KEY = "google-api-key";
    import.meta.env.VITE_GOOGLE_CLIENT_ID = "google-client-id";
    import.meta.env.VITE_GOOGLE_APP_ID = "google-app-id";

    expect(getGoogleApiKey()).toBe("google-api-key");
    expect(getGoogleClientId()).toBe("google-client-id");
    expect(getGoogleAppId()).toBe("google-app-id");
  });

  it("throws MissingClientEnvError for missing required Google keys", () => {
    import.meta.env.VITE_GOOGLE_API_KEY = "";
    import.meta.env.VITE_GOOGLE_CLIENT_ID = "";
    import.meta.env.VITE_GOOGLE_APP_ID = "";

    expect(() => getGoogleApiKey()).toThrowError(MissingClientEnvError);
    expect(() => getGoogleClientId()).toThrowError(MissingClientEnvError);
    expect(() => getGoogleAppId()).toThrowError(MissingClientEnvError);
  });

  it("prefers configured public app url and strips trailing slash", () => {
    import.meta.env.VITE_PUBLIC_APP_URL = "https://example.com/";

    expect(getPublicAppUrl()).toBe("https://example.com");
  });

  it("falls back to window origin for public app url", () => {
    vi.stubGlobal("window", { location: { origin: "https://fallback.example" } });

    expect(getPublicAppUrl()).toBe("https://fallback.example");
  });

  it("falls back to localhost for public app url when window is unavailable", () => {
    expect(getPublicAppUrl()).toBe("http://localhost:5173");
  });

  it("uses configured capture-app placeholder url and strips trailing slash", () => {
    import.meta.env.VITE_CAPTURE_APP_PLACEHOLDER_URL = "https://capture.example/handoff/";

    expect(getCaptureAppPlaceholderUrl()).toBe("https://capture.example/handoff");
  });

  it("falls back to origin-based capture-app handoff when window is available", () => {
    vi.stubGlobal("window", { location: { origin: "https://fallback.example/" } });

    expect(getCaptureAppPlaceholderUrl()).toBe("https://fallback.example/capture-app");
  });

  it("does not fall back to localhost in production when no app URL is configured", () => {
    const originalMode = import.meta.env.MODE;
    import.meta.env.MODE = "production";

    expect(getCaptureAppPlaceholderUrl()).toBe("/capture-app");

    import.meta.env.MODE = originalMode;
  });
});
