// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/email", () => ({
  getEmailTransportStatus: () => ({ provider: "sendgrid", configured: true }),
}));

vi.mock("../utils/elevenlabs", () => ({
  getElevenLabsConfig: () => ({
    configured: true,
    agentId: "agent-1",
    modelId: "eleven_turbo_v2_5",
  }),
}));

vi.mock("../utils/runway", () => ({
  getRunwayStatus: () => ({
    configured: true,
    baseUrl: "https://openrouter.ai/api/v1",
    version: "videos/v1",
    provider: "openrouter",
    defaultModel: "bytedance/seedance-2.0-fast",
  }),
}));

describe("provider-status", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_GENAI_API_KEY", "test-key");
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA4_PROPERTY_ID", "123456789");
    vi.stubEnv("GA4_CREDENTIALS_JSON", "/tmp/ga4-service-account.json");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://ph.test");
    vi.stubEnv("BLUEPRINT_ANALYTICS_INGEST_ENABLED", "1");
    vi.stubEnv("SEARCH_API_KEY", "search-key");
    vi.stubEnv("SEARCH_API_PROVIDER", "brave");
    vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
    vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS", "warehouse robotics");
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS", "test@example.com");
    vi.stubEnv("SENDGRID_EVENT_WEBHOOK_SECRET", "wh-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("buildGrowthIntegrationSummary aggregates all provider statuses", async () => {
    const { buildGrowthIntegrationSummary } = await import("../utils/provider-status");
    const summary = buildGrowthIntegrationSummary();

    expect(summary.googleImage.configured).toBe(false);
    expect(summary.googleImage.model).toBe("disabled_by_policy");
    expect(summary.googleImage.apiKeySource).toBeNull();
    expect(summary.runway.configured).toBe(true);
    expect(summary.elevenlabs.configured).toBe(true);
    expect(summary.analytics.ga4.configured).toBe(true);
    expect(summary.analytics.ga4.liveAccessConfigured).toBe(true);
    expect(summary.analytics.posthog.configured).toBe(true);
    expect(summary.sendgrid.configured).toBe(true);
    expect(summary.researchOutbound.configured).toBe(true);
    expect(summary.researchOutbound.providerKey).toBe("web_search");
    expect(summary.researchOutbound.optional).toBe(true);
  });

  it("buildGrowthIntegrationSummary accepts the Firebase measurement alias when GA is absent", async () => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-FALLBACK");
    vi.stubEnv("GA4_PROPERTY_ID", "");
    vi.stubEnv("GA4_CREDENTIALS_JSON", "");

    const { buildGrowthIntegrationSummary } = await import("../utils/provider-status");
    const summary = buildGrowthIntegrationSummary();

    expect(summary.analytics.ga4.configured).toBe(true);
    expect(summary.analytics.ga4.liveAccessConfigured).toBe(false);
    expect(summary.analytics.alignment.externalConfigured).toBe(true);
  });

  it("classifyGoogleCreativeFailure handles quota errors", async () => {
    const { classifyGoogleCreativeFailure } = await import("../utils/provider-status");
    const result = classifyGoogleCreativeFailure(429, "RESOURCE_EXHAUSTED: quota exceeded");
    expect(result.executionState).toBe("blocked_quota_or_billing");
  });

  it("classifyGoogleCreativeFailure handles permission errors", async () => {
    const { classifyGoogleCreativeFailure } = await import("../utils/provider-status");
    const result = classifyGoogleCreativeFailure(403, "Permission denied");
    expect(result.executionState).toBe("blocked_permission");
  });

  it("classifyGoogleCreativeFailure handles generic failures", async () => {
    const { classifyGoogleCreativeFailure } = await import("../utils/provider-status");
    const result = classifyGoogleCreativeFailure(500, "Internal server error");
    expect(result.executionState).toBe("request_failed");
  });

  it("getGoogleCreativeStatus defaults to a gemini model, not imagen", async () => {
    const { getGoogleCreativeStatus } = await import("../utils/provider-status");
    const status = getGoogleCreativeStatus();
    expect(status.model).toBe("disabled_by_policy");
    expect(status.configured).toBe(false);
  });
});
