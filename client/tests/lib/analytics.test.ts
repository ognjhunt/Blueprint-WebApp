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

  it("emits the capturer funnel milestones with aggregate, non-PII properties", async () => {
    analyticsEvents.capturerCohortEntered({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      accessPath: "search",
      hasAccessCode: false,
      equipmentCount: 1,
      availability: "flexible",
      applicationStatus: "pending_review",
    });
    analyticsEvents.capturerTrustPacketVerified({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      identityOutcome: "pass",
      authorizationOutcome: "not_required",
      duplicateIntegrityOutcome: "pass",
      locationDeviceOutcome: "pass",
      policyAcknowledgementOutcome: "pass",
    });
    analyticsEvents.capturerApproved({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      approvalOwnerType: "human",
      approvedLane: "capturer_beta",
      laneRestrictionCount: 1,
    });
    analyticsEvents.capturerFirstCaptureSubmitted({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      captureSubmissionSource: "approved_path",
      captureContext: "first_assignment",
    });
    analyticsEvents.capturerFirstCapturePassed({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      captureQualityTier: "pass",
      coachingRequired: false,
    });
    analyticsEvents.capturerRepeatReady({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      tierName: "repeat_ready",
      firstPassCount: 1,
    });
    analyticsEvents.capturerReferralToPassedCapture({
      market: "Raleigh-Durham, NC",
      cohortSource: "search",
      referralSource: "friend",
      referralActivationPath: "first_passed_capture",
    });

    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(7);

    expect(parseAnalyticsPayload(0)).toMatchObject({
      event: "capturer_cohort_entered",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        access_path: "search",
        has_access_code: false,
        equipment_count: 1,
        availability: "flexible",
        application_status: "pending_review",
      },
    });
    expect(parseAnalyticsPayload(1)).toMatchObject({
      event: "capturer_trust_packet_verified",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        identity_outcome: "pass",
        authorization_outcome: "not_required",
        duplicate_integrity_outcome: "pass",
        location_device_outcome: "pass",
        policy_acknowledgement_outcome: "pass",
      },
    });
    expect(parseAnalyticsPayload(2)).toMatchObject({
      event: "capturer_approved",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        approval_owner_type: "human",
        approved_lane: "capturer_beta",
        lane_restriction_count: 1,
      },
    });
    expect(parseAnalyticsPayload(3)).toMatchObject({
      event: "capturer_first_capture_submitted",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        capture_submission_source: "approved_path",
        capture_context: "first_assignment",
      },
    });
    expect(parseAnalyticsPayload(4)).toMatchObject({
      event: "capturer_first_capture_passed",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        capture_quality_tier: "pass",
        coaching_required: false,
      },
    });
    expect(parseAnalyticsPayload(5)).toMatchObject({
      event: "capturer_repeat_ready",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        tier_name: "repeat_ready",
        first_pass_count: 1,
      },
    });
    expect(parseAnalyticsPayload(6)).toMatchObject({
      event: "capturer_referral_to_passed_capture",
      properties: {
        market: "Raleigh-Durham, NC",
        cohort_source: "search",
        referral_source: "friend",
        referral_activation_path: "first_passed_capture",
      },
    });
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

  it("tracks contact page CTA clicks without personal request data", async () => {
    analyticsEvents.contactPageCtaClicked({
      persona: "robot_team",
      ctaId: "contact_hero_start",
      ctaLabel: "Start robot-team brief",
      destination: "#contact-intake",
      source: "contact-hero",
      requestedLane: "deeper_evaluation",
    });

    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const payload = parseAnalyticsPayload();
    expect(payload.event).toBe("contact_page_cta_clicked");
    expect(payload.properties).toEqual({
      persona: "robot_team",
      cta_id: "contact_hero_start",
      cta_label: "Start robot-team brief",
      destination: "#contact-intake",
      source: "contact-hero",
      requested_lane: "deeper_evaluation",
    });
    expect(payload.properties).not.toHaveProperty("email");
    expect(payload.properties).not.toHaveProperty("company");
  });

  it("emits all 8 Austin funnel events with correct properties and attribution", async () => {
    // Test robot_team_inbound_captured
    analyticsEvents.robotTeamInboundCaptured({
      city: "austin",
      buyerRole: "robot_team",
      requestedLane: "deeper_evaluation",
      demandAttribution: {
        demandCity: "austin" as never,
        buyerChannelSource: "founder_intro",
        buyerChannelSourceCaptureMode: "explicit_query",
        utm: { source: "google", medium: "cpc", campaign: "austin_launch" },
      },
    });
    await flushAnalytics();
    let payload = parseAnalyticsPayload(0);
    expect(payload.event).toBe("robot_team_inbound_captured");
    expect(payload.properties).toMatchObject({
      city: "austin",
      buyer_role: "robot_team",
      requested_lane: "deeper_evaluation",
      demand_city: "austin",
      buyer_channel_source: "founder_intro",
      utm_source: "google",
    });

    // Test proof_path_assigned
    analyticsEvents.proofPathAssigned({
      city: "austin",
      outcome: "approved",
      assignedBy: "system",
      buyerSegment: "robot_team",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(1);
    expect(payload.event).toBe("proof_path_assigned");
    expect(payload.properties).toMatchObject({
      city: "austin",
      outcome: "approved",
      assigned_by: "system",
      buyer_segment: "robot_team",
      demand_city: "austin",
    });

    // Test proof_pack_delivered
    analyticsEvents.proofPackDelivered({
      city: "austin",
      artifactSummary: "3 sites, 2 proofs",
      buyerSegment: "robot_team",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(2);
    expect(payload.event).toBe("proof_pack_delivered");
    expect(payload.properties).toMatchObject({
      city: "austin",
      artifact_summary: "3 sites, 2 proofs",
      buyer_segment: "robot_team",
      demand_city: "austin",
    });

    // Test hosted_review_ready
    analyticsEvents.hostedReviewReady({
      city: "austin",
      hostedMode: "full_access",
      reviewPath: "proof_pack",
      buyerSegment: "robot_team",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(3);
    expect(payload.event).toBe("hosted_review_ready");
    expect(payload.properties).toMatchObject({
      city: "austin",
      hosted_mode: "full_access",
      review_path: "proof_pack",
      buyer_segment: "robot_team",
      demand_city: "austin",
    });

    // Test hosted_review_started
    analyticsEvents.hostedReviewStarted({
      city: "austin",
      hostedMode: "full_access",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(4);
    expect(payload.event).toBe("hosted_review_started");
    expect(payload.properties).toMatchObject({
      city: "austin",
      hosted_mode: "full_access",
      demand_city: "austin",
    });

    // Test hosted_review_follow_up_sent
    analyticsEvents.hostedReviewFollowUpSent({
      city: "austin",
      nextStepRecommendation: "human_handoff",
      buyerSegment: "robot_team",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(5);
    expect(payload.event).toBe("hosted_review_follow_up_sent");
    expect(payload.properties).toMatchObject({
      city: "austin",
      next_step_recommendation: "human_handoff",
      buyer_segment: "robot_team",
      demand_city: "austin",
    });

    // Test human_commercial_handoff_started
    analyticsEvents.humanCommercialHandoffStarted({
      city: "austin",
      handoffReason: "complex_requirements",
      buyerSegment: "robot_team",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(6);
    expect(payload.event).toBe("human_commercial_handoff_started");
    expect(payload.properties).toMatchObject({
      city: "austin",
      handoff_reason: "complex_requirements",
      buyer_segment: "robot_team",
      demand_city: "austin",
    });

    // Test proof_motion_stalled
    analyticsEvents.proofMotionStalled({
      city: "austin",
      blockerReason: "no_proof_pack",
      blockerDetail: "Awaiting site access",
      demandAttribution: { demandCity: "austin" as never },
    });
    await flushAnalytics();
    payload = parseAnalyticsPayload(7);
    expect(payload.event).toBe("proof_motion_stalled");
    expect(payload.properties).toMatchObject({
      city: "austin",
      blocker_reason: "no_proof_pack",
      blocker_detail: "Awaiting site access",
      demand_city: "austin",
    });

    // Verify all 8 events were emitted
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
