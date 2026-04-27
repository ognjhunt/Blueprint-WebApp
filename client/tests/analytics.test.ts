import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyticsEvents } from "../analytics";

// Mock trackEvent to verify calls
vi.mock("../src/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/analytics")>("../src/lib/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

// Import the mocked trackEvent
const { trackEvent } = await import("../src/lib/analytics");

describe("Austin Proof-Motion Analytics Events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls cityLaunchLawfulAccessEstablished with correct parameters", () => {
    analyticsEvents.cityLaunchLawfulAccessEstablished({
      city: "Austin",
      citySlug: "austin",
      accessMode: "buyer_requested_site",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_lawful_access_established", {
      city: "Austin",
      city_slug: "austin",
      access_mode: "buyer_requested_site",
      site_label: "Austin Warehouse 1",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchCapturerApproved with correct parameters", () => {
    analyticsEvents.cityLaunchCapturerApproved({
      city: "Austin",
      citySlug: "austin",
      capturerType: "professional_surveyor",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_capturer_approved", {
      city: "Austin",
      city_slug: "austin",
      capturer_type: "professional_surveyor",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchCaptureCompleted with correct parameters", () => {
    analyticsEvents.cityLaunchCaptureCompleted({
      city: "Austin",
      citySlug: "austin",
      siteLabel: "Austin Warehouse 1",
      captureType: "industrial_walkthrough",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_capture_completed", {
      city: "Austin",
      city_slug: "austin",
      site_label: "Austin Warehouse 1",
      capture_type: "industrial_walkthrough",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchCaptureQaPassed with correct parameters", () => {
    analyticsEvents.cityLaunchCaptureQaPassed({
      city: "Austin",
      citySlug: "austin",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_capture_qa_passed", {
      city: "Austin",
      city_slug: "austin",
      site_label: "Austin Warehouse 1",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchProofAssetRightsCleared with correct parameters", () => {
    analyticsEvents.cityLaunchProofAssetRightsCleared({
      city: "Austin",
      citySlug: "austin",
      siteLabel: "Austin Warehouse 1",
      rightsPath: "operator_signed_release",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_proof_asset_rights_cleared", {
      city: "Austin",
      city_slug: "austin",
      site_label: "Austin Warehouse 1",
      rights_path: "operator_signed_release",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchProofPackDelivered with correct parameters", () => {
    analyticsEvents.cityLaunchProofPackDelivered({
      city: "Austin",
      citySlug: "austin",
      buyerLabel: "Austin Buyer Co",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_proof_pack_delivered", {
      city: "Austin",
      city_slug: "austin",
      buyer_label: "Austin Buyer Co",
      site_label: "Austin Warehouse 1",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchHostedReviewReady with correct parameters", () => {
    analyticsEvents.cityLaunchHostedReviewReady({
      city: "Austin",
      citySlug: "austin",
      buyerLabel: "Austin Buyer Co",
      siteLabel: "Austin Warehouse 1",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_hosted_review_ready", {
      city: "Austin",
      city_slug: "austin",
      buyer_label: "Austin Buyer Co",
      site_label: "Austin Warehouse 1",
      launch_id: "launch-123",
    });
  });

  it("calls cityLaunchCommercialHandoff with correct parameters", () => {
    analyticsEvents.cityLaunchCommercialHandoff({
      city: "Austin",
      citySlug: "austin",
      buyerLabel: "Austin Buyer Co",
      handoffType: "founder_approved",
      launchId: "launch-123",
    });

    expect(trackEvent).toHaveBeenCalledWith("city_launch_commercial_handoff", {
      city: "Austin",
      city_slug: "austin",
      buyer_label: "Austin Buyer Co",
      handoff_type: "founder_approved",
      launch_id: "launch-123",
    });
  });
});
