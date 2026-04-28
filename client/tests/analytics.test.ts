import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsEvents } from "../src/lib/analytics";

const fetchMock = vi.hoisted(() => vi.fn());
const withCsrfHeaderMock = vi.hoisted(() =>
  vi.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "test-csrf-token",
  })),
);
const getActiveExperimentAssignmentsMock = vi.hoisted(() => vi.fn(() => ({})));
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

vi.mock("../src/lib/csrf", () => ({
  withCsrfHeader: withCsrfHeaderMock,
}));

vi.mock("../src/lib/experiments", () => ({
  getActiveExperimentAssignments: getActiveExperimentAssignmentsMock,
  getOrCreateExperimentAnonymousId: getOrCreateExperimentAnonymousIdMock,
}));

async function flushAnalytics() {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function latestAnalyticsPayload() {
  const requestInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined;
  expect(requestInit).toBeDefined();
  expect(requestInit?.body).toBeTruthy();
  return JSON.parse(String(requestInit?.body)) as {
    event: string;
    properties: Record<string, unknown>;
  };
}

describe("Austin Proof-Motion Analytics Events", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("gtag", undefined);
    withCsrfHeaderMock.mockClear();
    getActiveExperimentAssignmentsMock.mockClear();
    getOrCreateExperimentAnonymousIdMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("calls cityLaunchLawfulAccessEstablished with correct parameters", async () => {
    analyticsEvents.cityLaunchLawfulAccessEstablished({
      city: "Austin",
      citySlug: "austin",
      accessMode: "buyer_requested_site",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_lawful_access_established",
      properties: {
        city: "Austin",
        city_slug: "austin",
        access_mode: "buyer_requested_site",
        site_label: "Austin Warehouse 1",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchCapturerApproved with correct parameters", async () => {
    analyticsEvents.cityLaunchCapturerApproved({
      city: "Austin",
      citySlug: "austin",
      capturerType: "professional_surveyor",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_capturer_approved",
      properties: {
        city: "Austin",
        city_slug: "austin",
        capturer_type: "professional_surveyor",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchCaptureCompleted with correct parameters", async () => {
    analyticsEvents.cityLaunchCaptureCompleted({
      city: "Austin",
      citySlug: "austin",
      siteLabel: "Austin Warehouse 1",
      captureType: "industrial_walkthrough",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_capture_completed",
      properties: {
        city: "Austin",
        city_slug: "austin",
        site_label: "Austin Warehouse 1",
        capture_type: "industrial_walkthrough",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchCaptureQaPassed with correct parameters", async () => {
    analyticsEvents.cityLaunchCaptureQaPassed({
      city: "Austin",
      citySlug: "austin",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_capture_qa_passed",
      properties: {
        city: "Austin",
        city_slug: "austin",
        site_label: "Austin Warehouse 1",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchProofAssetRightsCleared with correct parameters", async () => {
    analyticsEvents.cityLaunchProofAssetRightsCleared({
      city: "Austin",
      citySlug: "austin",
      siteLabel: "Austin Warehouse 1",
      rightsPath: "operator_signed_release",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_proof_asset_rights_cleared",
      properties: {
        city: "Austin",
        city_slug: "austin",
        site_label: "Austin Warehouse 1",
        rights_path: "operator_signed_release",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchProofPackDelivered with correct parameters", async () => {
    analyticsEvents.cityLaunchProofPackDelivered({
      city: "Austin",
      citySlug: "austin",
      buyerLabel: "Austin Buyer Co",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_proof_pack_delivered",
      properties: {
        city: "Austin",
        city_slug: "austin",
        buyer_label: "Austin Buyer Co",
        site_label: "Austin Warehouse 1",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchHostedReviewReady with correct parameters", async () => {
    analyticsEvents.cityLaunchHostedReviewReady({
      city: "Austin",
      citySlug: "austin",
      buyerLabel: "Austin Buyer Co",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_hosted_review_ready",
      properties: {
        city: "Austin",
        city_slug: "austin",
        buyer_label: "Austin Buyer Co",
        site_label: "Austin Warehouse 1",
        launch_id: "launch-123",
      },
    });
  });

  it("calls cityLaunchCommercialHandoff with correct parameters", async () => {
    analyticsEvents.cityLaunchCommercialHandoff({
      city: "Austin",
      citySlug: "austin",
      buyerLabel: "Austin Buyer Co",
      handoffType: "founder_approved",
      launchId: "launch-123",
    });

    await flushAnalytics();

    expect(latestAnalyticsPayload()).toMatchObject({
      event: "city_launch_commercial_handoff",
      properties: {
        city: "Austin",
        city_slug: "austin",
        buyer_label: "Austin Buyer Co",
        handoff_type: "founder_approved",
        launch_id: "launch-123",
      },
    });
  });
});
