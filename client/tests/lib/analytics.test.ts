import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsEvents } from "@/lib/analytics";

const fetchMock = vi.hoisted(() => vi.fn());
const withCsrfHeaderMock = vi.hoisted(() =>
  vi.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "test-csrf-token",
  })),
);
const getActiveExperimentAssignmentsMock = vi.hoisted(() =>
  vi.fn(() => ({
    home_hero_variant: "variant-a",
  })),
);
const getOrCreateExperimentAnonymousIdMock = vi.hoisted(() => vi.fn(() => "anon-test"));
const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  set_config: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: posthogMock,
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: withCsrfHeaderMock,
}));

vi.mock("@/lib/experiments", () => ({
  getActiveExperimentAssignments: getActiveExperimentAssignmentsMock,
  getOrCreateExperimentAnonymousId: getOrCreateExperimentAnonymousIdMock,
}));

async function flushAnalytics() {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function parseAnalyticsPayload(callIndex = 0) {
  const requestInit = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  expect(requestInit).toBeDefined();
  expect(requestInit?.body).toBeTruthy();
  return JSON.parse(String(requestInit?.body)) as {
    event: string;
    properties: Record<string, unknown>;
  };
}

describe("analytics contract", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("gtag", undefined);
    posthogMock.init.mockClear();
    posthogMock.capture.mockClear();
    posthogMock.set_config.mockClear();
    posthogMock.opt_in_capturing.mockClear();
    posthogMock.opt_out_capturing.mockClear();
    withCsrfHeaderMock.mockClear();
    getActiveExperimentAssignmentsMock.mockClear();
    getOrCreateExperimentAnonymousIdMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("emits capturer signup submissions with aggregate, non-PII properties", async () => {
    analyticsEvents.capturerSignupSubmitted({
      authMethod: "google",
      equipmentCount: 2,
      availability: "weekdays",
      referralSource: "search",
    });

    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(withCsrfHeaderMock).toHaveBeenCalledTimes(1);
    expect(getOrCreateExperimentAnonymousIdMock).toHaveBeenCalledTimes(1);

    const payload = parseAnalyticsPayload();
    expect(payload.event).toBe("capturer_signup_submitted");
    expect(payload.properties).toEqual({
      auth_method: "google",
      equipment_count: 2,
      availability: "weekdays",
      referral_source: "search",
    });
    expect(payload.properties).not.toHaveProperty("email");
    expect(payload.properties).not.toHaveProperty("full_name");
  });

  it("flattens demand attribution on business signup start without nested payloads", async () => {
    analyticsEvents.businessSignupStarted({
      defaultRequestedLane: "deeper_evaluation",
      requestedLaneCount: 1,
      demandAttribution: {
        demandCity: "austin" as never,
        buyerChannelSource: "founder_intro",
        buyerChannelSourceCaptureMode: "explicit_query",
        buyerChannelSourceRaw: "Founder intro",
        utm: {
          source: "google",
          medium: "cpc",
          campaign: "spring_launch",
          term: "robotics",
          content: "hero",
        },
      },
    });

    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const payload = parseAnalyticsPayload();
    expect(payload.event).toBe("business_signup_started");
    expect(payload.properties).toMatchObject({
      default_requested_lane: "deeper_evaluation",
      requested_lane_count: 1,
      demand_city: "austin",
      buyer_channel_source: "founder_intro",
      buyer_channel_source_capture_mode: "explicit_query",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring_launch",
      utm_content: "hero",
    });
    expect(payload.properties).not.toHaveProperty("demandAttribution");
    expect(payload.properties).not.toHaveProperty("buyer_channel_source_raw");
    expect(payload.properties).not.toHaveProperty("utm_term");
  });

  it("keeps contact request submission payloads limited to lane and boolean completeness flags", async () => {
    analyticsEvents.contactRequestSubmitted({
      persona: "robot_team",
      hostedMode: true,
      requestedLane: "deeper_evaluation",
      authenticated: true,
      hasJobTitle: true,
      hasSiteName: true,
      hasSiteLocation: true,
      hasTaskStatement: true,
      hasOperatingConstraints: false,
      hasPrivacySecurityConstraints: true,
      hasNotes: false,
    });

    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const payload = parseAnalyticsPayload();
    expect(payload.event).toBe("contact_request_submitted");
    expect(payload.properties).toEqual({
      persona: "robot_team",
      hosted_mode: true,
      requested_lane: "deeper_evaluation",
      authenticated: true,
      has_job_title: true,
      has_site_name: true,
      has_site_location: true,
      has_task_statement: true,
      has_operating_constraints: false,
      has_privacy_security_constraints: true,
      has_notes: false,
    });
    expect(payload.properties).not.toHaveProperty("email");
    expect(payload.properties).not.toHaveProperty("company");
    expect(payload.properties).not.toHaveProperty("firstName");
  });
});
