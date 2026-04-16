import posthog from "posthog-js";
import {
  getDemandAttributionFromSearchParams,
  hasDemandAttribution,
  type DemandAttribution,
} from "./demandAttribution";
import { withCsrfHeader } from "./csrf";
import {
  getActiveExperimentAssignments,
  getOrCreateExperimentAnonymousId,
} from "./experiments";

type AnalyticsConsent = {
  analytics: boolean;
  marketing: boolean;
};

const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : ({} as Record<string, string | boolean | undefined>);

const GA_MEASUREMENT_ID =
  (viteEnv.VITE_GA_MEASUREMENT_ID as string | undefined)
  || (viteEnv.VITE_FIREBASE_MEASUREMENT_ID as string | undefined)
  || "";
const POSTHOG_PROJECT_TOKEN =
  (viteEnv.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string | undefined)?.trim() || "";
const POSTHOG_HOST =
  (viteEnv.VITE_PUBLIC_POSTHOG_HOST as string | undefined)?.trim() || "";

let gaInitialized = false;
let posthogInitialized = false;
let analyticsSessionId: string | null = null;

function analyticsRuntimeEnabled() {
  return viteEnv.DEV !== true || Boolean(viteEnv.VITE_ENABLE_ANALYTICS);
}

function getAnalyticsSessionId() {
  if (analyticsSessionId) {
    return analyticsSessionId;
  }

  analyticsSessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return analyticsSessionId;
}

function hasConfiguredGa() {
  return Boolean(GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== "G-XXXXXXXXXX");
}

function hasConfiguredPostHog() {
  return Boolean(POSTHOG_PROJECT_TOKEN && POSTHOG_HOST);
}

function normalizeConsent(consent: AnalyticsConsent | null | undefined) {
  return {
    analytics: Boolean(consent?.analytics),
    marketing: Boolean(consent?.marketing),
  };
}

function compactEventParams(
  parameters: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => value !== null && value !== undefined),
  ) as Record<string, string | number | boolean>;
}

function buildDemandAttributionEventParams(
  attribution: DemandAttribution | null | undefined,
): Record<string, string | number | boolean> {
  if (!hasDemandAttribution(attribution)) {
    return {};
  }

  return compactEventParams({
    demand_city: attribution?.demandCity ?? undefined,
    buyer_channel_source: attribution?.buyerChannelSource ?? undefined,
    buyer_channel_source_capture_mode:
      attribution?.buyerChannelSourceCaptureMode ?? undefined,
    utm_source: attribution?.utm.source ?? undefined,
    utm_medium: attribution?.utm.medium ?? undefined,
    utm_campaign: attribution?.utm.campaign ?? undefined,
    utm_content: attribution?.utm.content ?? undefined,
  });
}

function currentDemandAttribution(): DemandAttribution | null {
  if (typeof window === "undefined") {
    return null;
  }

  const attribution = getDemandAttributionFromSearchParams(
    new URLSearchParams(window.location.search),
  );
  return hasDemandAttribution(attribution) ? attribution : null;
}

function ensureGaLoaded() {
  if (!analyticsRuntimeEnabled() || !hasConfiguredGa()) {
    return;
  }

  if (!window.dataLayer) {
    window.dataLayer = [];
  }

  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
  }

  if (gaInitialized) {
    return;
  }

  if (!document.getElementById("ga-script")) {
    const script = document.createElement("script");
    script.id = "ga-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    cookie_flags: "SameSite=None;Secure",
  });

  gaInitialized = true;
}

async function ingestFirstPartyEvent(
  event: string,
  parameters?: Record<string, string | number | boolean | undefined>,
  page?: { path?: string; title?: string },
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const headers = await withCsrfHeader({ "Content-Type": "application/json" });
    await fetch("/api/analytics/ingest", {
      method: "POST",
      headers,
      body: JSON.stringify({
        event,
        source: "webapp",
        anonymousId: getOrCreateExperimentAnonymousId(),
        sessionId: getAnalyticsSessionId(),
        pagePath: page?.path || window.location.pathname,
        pageTitle: page?.title || document.title,
        currentUrl: window.location.href,
        referrer: document.referrer || null,
        experiments: getActiveExperimentAssignments(),
        properties: parameters || {},
        attribution: currentDemandAttribution(),
      }),
    });
  } catch {
    // Event ingestion should never break the customer-facing flow.
  }
}

function applyGaConsent(consent: AnalyticsConsent | null | undefined) {
  if (!analyticsRuntimeEnabled() || !hasConfiguredGa() || !window.gtag) {
    return;
  }

  const normalized = normalizeConsent(consent);
  window.gtag("consent", "update", {
    analytics_storage: normalized.analytics ? "granted" : "denied",
    ad_storage: normalized.marketing ? "granted" : "denied",
  });
}

function ensurePostHogLoaded(consent: AnalyticsConsent | null | undefined) {
  if (!analyticsRuntimeEnabled() || !hasConfiguredPostHog() || posthogInitialized) {
    return;
  }

  const normalized = normalizeConsent(consent);
  posthog.init(POSTHOG_PROJECT_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: "2026-01-30",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: normalized.analytics ? "localStorage+cookie" : "memory",
    opt_out_capturing_by_default: !normalized.analytics,
  });

  posthogInitialized = true;
}

function applyPostHogConsent(consent: AnalyticsConsent | null | undefined) {
  if (!analyticsRuntimeEnabled() || !hasConfiguredPostHog() || !posthogInitialized) {
    return;
  }

  const normalized = normalizeConsent(consent);
  posthog.set_config({
    persistence: normalized.analytics ? "localStorage+cookie" : "memory",
  });

  if (normalized.analytics) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export function initializeAnalytics(consent: AnalyticsConsent | null | undefined) {
  if (!analyticsRuntimeEnabled()) {
    return;
  }

  ensureGaLoaded();
  applyGaConsent(consent);
  ensurePostHogLoaded(consent);
  applyPostHogConsent(consent);
}

export function updateAnalyticsConsent(consent: AnalyticsConsent | null | undefined) {
  applyGaConsent(consent);
  applyPostHogConsent(consent);
}

export function trackPageView(path: string, title?: string) {
  if (window.gtag && hasConfiguredGa()) {
    window.gtag("event", "page_view", {
      page_path: path,
      page_title: title,
    });
  }

  if (posthogInitialized && hasConfiguredPostHog()) {
    posthog.capture("$pageview", {
      path,
      title,
      current_url: window.location.href,
    });
  }

  void ingestFirstPartyEvent("$pageview", undefined, { path, title });
}

export function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean | undefined>
) {
  if (window.gtag && hasConfiguredGa()) {
    window.gtag("event", eventName, parameters);
  }

  if (posthogInitialized && hasConfiguredPostHog()) {
    posthog.capture(eventName, parameters);
  }

  void ingestFirstPartyEvent(eventName, parameters);
}

function getSafeErrorType(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.trim().length > 0
  ) {
    return error.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  return "unknown";
}

export const analyticsEvents = {
  experimentExposure: (experimentKey: string, variant: string, source: string) =>
    trackEvent("experiment_exposure", {
      experiment_key: experimentKey,
      variant,
      source,
    }),

  campaignKitGenerated: (assetGoal: string, skuName: string) =>
    trackEvent("campaign_kit_generated", {
      asset_goal: assetGoal,
      sku_name: skuName,
    }),

  creativeImageGenerated: (assetGoal: string, aspectRatio: string) =>
    trackEvent("creative_image_generated", {
      asset_goal: assetGoal,
      aspect_ratio: aspectRatio,
    }),

  creativeVideoRequested: (assetGoal: string, ratio: string) =>
    trackEvent("creative_video_requested", {
      asset_goal: assetGoal,
      ratio,
    }),

  exactSiteReviewView: (variantId: string) =>
    trackEvent("exact_site_review_view", {
      variant_id: variantId,
    }),

  voiceConciergeStarted: (surface: string) =>
    trackEvent("voice_concierge_started", {
      surface,
    }),

  voiceConciergeCompleted: (surface: string, handoffRequired: boolean) =>
    trackEvent("voice_concierge_completed", {
      surface,
      handoff_required: handoffRequired,
    }),

  homeHeroView: (variantId: string, source: string) =>
    trackEvent("home_hero_view", { variant_id: variantId, source }),

  contactFormSubmit: (formType: string) =>
    trackEvent("contact_form_submit", { form_type: formType }),

  contactFormError: (errorType: string) =>
    trackEvent("contact_form_error", { error_type: errorType }),

  marketplaceItemView: (itemId: string, itemType: string) =>
    trackEvent("view_item", { item_id: itemId, item_type: itemType }),

  marketplaceFilterApply: (filterType: string, filterValue: string) =>
    trackEvent("apply_filter", { filter_type: filterType, filter_value: filterValue }),

  loginAttempt: (method: string) =>
    trackEvent("login_attempt", { method }),

  signupAttempt: (method: string) =>
    trackEvent("signup_attempt", { method }),

  beginCheckout: (itemId: string, value: number) =>
    trackEvent("begin_checkout", { item_id: itemId, value, currency: "USD" }),

  completeCheckout: (source: string, value: number) =>
    trackEvent("checkout_complete", { source, value, currency: "USD" }),

  purchaseComplete: (transactionId: string, value: number) =>
    trackEvent("purchase", { transaction_id: transactionId, value, currency: "USD" }),

  waitlistSignup: (locationType: string) =>
    trackEvent("waitlist_signup", { location_type: locationType }),

  pilotExchangeView: () =>
    trackEvent("pilot_exchange_view"),

  pilotExchangeFilterApply: (filterType: string, filterValue: string) =>
    trackEvent("pilot_exchange_filter_apply", {
      filter_type: filterType,
      filter_value: filterValue,
    }),

  pilotExchangeOpenBriefForm: () =>
    trackEvent("pilot_exchange_open_brief_form"),

  pilotExchangeSubmitBrief: (status: "success" | "error") =>
    trackEvent("pilot_exchange_submit_brief", { status }),

  pilotExchangeOpenPolicyForm: () =>
    trackEvent("pilot_exchange_open_policy_form"),

  pilotExchangeSubmitPolicy: (status: "success" | "error") =>
    trackEvent("pilot_exchange_submit_policy", { status }),

  pilotExchangeSubmitDataLicenseRequest: (status: "success" | "error") =>
    trackEvent("pilot_exchange_submit_data_license_request", { status }),

  pilotExchangeSelectReadinessGate: (gateTitle: string) =>
    trackEvent("pilot_exchange_select_readiness_gate", { gate_title: gateTitle }),

  pilotExchangeOpenFaq: (faqId: string) =>
    trackEvent("pilot_exchange_open_faq", { faq_id: faqId }),

  pilotExchangeChartView: (chartId: string) =>
    trackEvent("pilot_exchange_chart_view", { chart_id: chartId }),

  capturerCohortEntered: (properties: {
    market: string;
    cohortSource: string;
    accessPath: string;
    hasAccessCode: boolean;
    equipmentCount: number;
    availability: string;
    applicationStatus: string;
  }) =>
    trackEvent("capturer_cohort_entered", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      access_path: properties.accessPath,
      has_access_code: properties.hasAccessCode,
      equipment_count: properties.equipmentCount,
      availability: properties.availability,
      application_status: properties.applicationStatus,
    }),

  capturerTrustPacketVerified: (properties: {
    market: string;
    cohortSource: string;
    identityOutcome: string;
    authorizationOutcome: string;
    duplicateIntegrityOutcome: string;
    locationDeviceOutcome: string;
    policyAcknowledgementOutcome: string;
  }) =>
    trackEvent("capturer_trust_packet_verified", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      identity_outcome: properties.identityOutcome,
      authorization_outcome: properties.authorizationOutcome,
      duplicate_integrity_outcome: properties.duplicateIntegrityOutcome,
      location_device_outcome: properties.locationDeviceOutcome,
      policy_acknowledgement_outcome: properties.policyAcknowledgementOutcome,
    }),

  capturerApproved: (properties: {
    market: string;
    cohortSource: string;
    approvalOwnerType: string;
    approvedLane: string;
    laneRestrictionCount: number;
  }) =>
    trackEvent("capturer_approved", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      approval_owner_type: properties.approvalOwnerType,
      approved_lane: properties.approvedLane,
      lane_restriction_count: properties.laneRestrictionCount,
    }),

  capturerFirstCaptureSubmitted: (properties: {
    market: string;
    cohortSource: string;
    captureSubmissionSource: string;
    captureContext: string;
  }) =>
    trackEvent("capturer_first_capture_submitted", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      capture_submission_source: properties.captureSubmissionSource,
      capture_context: properties.captureContext,
    }),

  capturerFirstCapturePassed: (properties: {
    market: string;
    cohortSource: string;
    captureQualityTier: string;
    coachingRequired: boolean;
  }) =>
    trackEvent("capturer_first_capture_passed", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      capture_quality_tier: properties.captureQualityTier,
      coaching_required: properties.coachingRequired,
    }),

  capturerRepeatReady: (properties: {
    market: string;
    cohortSource: string;
    tierName: string;
    firstPassCount: number;
  }) =>
    trackEvent("capturer_repeat_ready", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      tier_name: properties.tierName,
      first_pass_count: properties.firstPassCount,
    }),

  capturerReferralToPassedCapture: (properties: {
    market: string;
    cohortSource: string;
    referralSource: string;
    referralActivationPath: string;
  }) =>
    trackEvent("capturer_referral_to_passed_capture", {
      market: properties.market,
      cohort_source: properties.cohortSource,
      referral_source: properties.referralSource,
      referral_activation_path: properties.referralActivationPath,
    }),

  capturerSignupStarted: () =>
    trackEvent("capturer_signup_started"),

  capturerSignupStepViewed: (stepNumber: number, stepName: string) =>
    trackEvent("capturer_signup_step_viewed", {
      step_number: stepNumber,
      step_name: stepName,
    }),

  capturerSignupStepCompleted: (
    stepNumber: number,
    stepName: string,
    authMethod: "password" | "google",
  ) =>
    trackEvent("capturer_signup_step_completed", {
      step_number: stepNumber,
      step_name: stepName,
      auth_method: authMethod,
    }),

  capturerSignupSubmitted: (properties: {
    authMethod: "password" | "google";
    equipmentCount: number;
    availability: string;
    referralSource: string;
  }) =>
    trackEvent("capturer_signup_submitted", {
      auth_method: properties.authMethod,
      equipment_count: properties.equipmentCount,
      availability: properties.availability,
      referral_source: properties.referralSource,
    }),

  capturerSignupCompleted: (properties: {
    authMethod: "password" | "google";
    equipmentCount: number;
    availability: string;
    referralSource: string;
  }) =>
    trackEvent("capturer_signup_completed", {
      auth_method: properties.authMethod,
      equipment_count: properties.equipmentCount,
      availability: properties.availability,
      referral_source: properties.referralSource,
    }),

  capturerSignupFailed: (properties: {
    stage: string;
    stepNumber: number;
    errorType: string;
  }) =>
    trackEvent("capturer_signup_failed", {
      stage: properties.stage,
      step_number: properties.stepNumber,
      error_type: properties.errorType,
    }),

  businessSignupStarted: (properties: {
    defaultRequestedLane: string;
    requestedLaneCount: number;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("business_signup_started", {
      default_requested_lane: properties.defaultRequestedLane,
      requested_lane_count: properties.requestedLaneCount,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  businessSignupSubmitted: (properties: {
    buyerType: string;
    requestedLaneCount: number;
    includesQualificationLane: boolean;
    companySize: string;
    budgetRange: string;
    referralSource: string;
    hasPhoneNumber: boolean;
    hasWorkflowContext: boolean;
    hasOperatingConstraints: boolean;
    hasPrivacySecurityConstraints: boolean;
    hasKnownBlockers: boolean;
    hasTargetRobotTeam: boolean;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("business_signup_submitted", {
      buyer_type: properties.buyerType,
      requested_lane_count: properties.requestedLaneCount,
      includes_qualification_lane: properties.includesQualificationLane,
      company_size: properties.companySize,
      budget_range: properties.budgetRange,
      referral_source: properties.referralSource,
      has_phone_number: properties.hasPhoneNumber,
      has_workflow_context: properties.hasWorkflowContext,
      has_operating_constraints: properties.hasOperatingConstraints,
      has_privacy_security_constraints: properties.hasPrivacySecurityConstraints,
      has_known_blockers: properties.hasKnownBlockers,
      has_target_robot_team: properties.hasTargetRobotTeam,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  businessSignupCompleted: (properties: {
    buyerType: string;
    requestedLaneCount: number;
    includesQualificationLane: boolean;
    companySize: string;
    budgetRange: string;
    referralSource: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("business_signup_completed", {
      buyer_type: properties.buyerType,
      requested_lane_count: properties.requestedLaneCount,
      includes_qualification_lane: properties.includesQualificationLane,
      company_size: properties.companySize,
      budget_range: properties.budgetRange,
      referral_source: properties.referralSource,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  businessSignupFailed: (properties: {
    stage: string;
    stepNumber: number;
    errorType: string;
    buyerType: string;
    requestedLaneCount: number;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("business_signup_failed", {
      stage: properties.stage,
      step_number: properties.stepNumber,
      error_type: properties.errorType,
      buyer_type: properties.buyerType,
      requested_lane_count: properties.requestedLaneCount,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  contactRequestStarted: (properties: {
    persona: string;
    hostedMode: boolean;
    requestedLane: string;
    authenticated: boolean;
    prefilledSiteContext: boolean;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("contact_request_started", {
      persona: properties.persona,
      hosted_mode: properties.hostedMode,
      requested_lane: properties.requestedLane,
      authenticated: properties.authenticated,
      prefilled_site_context: properties.prefilledSiteContext,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  contactRequestSubmitted: (properties: {
    persona: string;
    hostedMode: boolean;
    requestedLane: string;
    authenticated: boolean;
    hasJobTitle: boolean;
    hasSiteName: boolean;
    hasSiteLocation: boolean;
    hasTaskStatement: boolean;
    hasOperatingConstraints: boolean;
    hasPrivacySecurityConstraints: boolean;
    hasNotes: boolean;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("contact_request_submitted", {
      persona: properties.persona,
      hosted_mode: properties.hostedMode,
      requested_lane: properties.requestedLane,
      authenticated: properties.authenticated,
      has_job_title: properties.hasJobTitle,
      has_site_name: properties.hasSiteName,
      has_site_location: properties.hasSiteLocation,
      has_task_statement: properties.hasTaskStatement,
      has_operating_constraints: properties.hasOperatingConstraints,
      has_privacy_security_constraints: properties.hasPrivacySecurityConstraints,
      has_notes: properties.hasNotes,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  contactRequestCompleted: (properties: {
    persona: string;
    hostedMode: boolean;
    requestedLane: string;
    authenticated: boolean;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("contact_request_completed", {
      persona: properties.persona,
      hosted_mode: properties.hostedMode,
      requested_lane: properties.requestedLane,
      authenticated: properties.authenticated,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  contactRequestFailed: (properties: {
    stage: string;
    errorType: string;
    persona: string;
    hostedMode: boolean;
    requestedLane: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("contact_request_failed", {
      stage: properties.stage,
      error_type: properties.errorType,
      persona: properties.persona,
      hosted_mode: properties.hostedMode,
      requested_lane: properties.requestedLane,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  buyerReviewViewed: (properties: {
    section: string;
    buyerType: string;
    requestedLaneCount: number;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("buyer_review_viewed", {
      section: properties.section,
      buyer_type: properties.buyerType,
      requested_lane_count: properties.requestedLaneCount,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  proofPathStageUpdated: (properties: {
    proofPathStage: string;
    action: "mark" | "clear";
    eventOrigin: "admin_ops" | "admin_review_link";
    buyerType: string;
    requestedLaneCount: number;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("proof_path_stage_updated", {
      proof_path_stage: properties.proofPathStage,
      proof_path_stage_action: properties.action,
      event_origin: properties.eventOrigin,
      buyer_type: properties.buyerType,
      requested_lane_count: properties.requestedLaneCount,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  robotTeamInboundCaptured: (properties: {
    city?: string;
    buyerRole?: string;
    requestedLane?: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("robot_team_inbound_captured", {
      city: properties.city,
      buyer_role: properties.buyerRole,
      requested_lane: properties.requestedLane,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  exactSiteRequestCreated: (properties: {
    city?: string;
    siteRequestType?: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("exact_site_request_created", {
      city: properties.city,
      site_request_type: properties.siteRequestType,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  deeperReviewRequested: (properties: {
    city?: string;
    blockerType?: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("deeper_review_requested", {
      city: properties.city,
      blocker_type: properties.blockerType,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  hostedReviewStarted: (properties: {
    city?: string;
    hostedMode?: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("hosted_review_started", {
      city: properties.city,
      hosted_mode: properties.hostedMode,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  proofMotionStalled: (properties: {
    city?: string;
    blockerReason?: string;
    blockerDetail?: string;
    demandAttribution?: DemandAttribution;
  }) =>
    trackEvent("proof_motion_stalled", {
      city: properties.city,
      blocker_reason: properties.blockerReason,
      blocker_detail: properties.blockerDetail,
      ...buildDemandAttributionEventParams(properties.demandAttribution),
    }),

  // City-launch proof-motion events (8 required metrics)
  cityLaunchLawfulAccessEstablished: (properties: {
    city: string;
    citySlug: string;
    accessMode: string;
    siteLabel: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_lawful_access_established", {
      city: properties.city,
      city_slug: properties.citySlug,
      access_mode: properties.accessMode,
      site_label: properties.siteLabel,
      launch_id: properties.launchId,
    }),

  cityLaunchCapturerApproved: (properties: {
    city: string;
    citySlug: string;
    capturerType: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_capturer_approved", {
      city: properties.city,
      city_slug: properties.citySlug,
      capturer_type: properties.capturerType,
      launch_id: properties.launchId,
    }),

  cityLaunchCaptureCompleted: (properties: {
    city: string;
    citySlug: string;
    siteLabel: string;
    captureType: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_capture_completed", {
      city: properties.city,
      city_slug: properties.citySlug,
      site_label: properties.siteLabel,
      capture_type: properties.captureType,
      launch_id: properties.launchId,
    }),

  cityLaunchCaptureQaPassed: (properties: {
    city: string;
    citySlug: string;
    siteLabel: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_capture_qa_passed", {
      city: properties.city,
      city_slug: properties.citySlug,
      site_label: properties.siteLabel,
      launch_id: properties.launchId,
    }),

  cityLaunchProofAssetRightsCleared: (properties: {
    city: string;
    citySlug: string;
    siteLabel: string;
    rightsPath: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_proof_asset_rights_cleared", {
      city: properties.city,
      city_slug: properties.citySlug,
      site_label: properties.siteLabel,
      rights_path: properties.rightsPath,
      launch_id: properties.launchId,
    }),

  cityLaunchProofPackDelivered: (properties: {
    city: string;
    citySlug: string;
    buyerLabel: string;
    siteLabel: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_proof_pack_delivered", {
      city: properties.city,
      city_slug: properties.citySlug,
      buyer_label: properties.buyerLabel,
      site_label: properties.siteLabel,
      launch_id: properties.launchId,
    }),

  cityLaunchHostedReviewReady: (properties: {
    city: string;
    citySlug: string;
    buyerLabel: string;
    siteLabel: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_hosted_review_ready", {
      city: properties.city,
      city_slug: properties.citySlug,
      buyer_label: properties.buyerLabel,
      site_label: properties.siteLabel,
      launch_id: properties.launchId,
    }),

  cityLaunchCommercialHandoff: (properties: {
    city: string;
    citySlug: string;
    buyerLabel: string;
    handoffType: string;
    launchId?: string;
  }) =>
    trackEvent("city_launch_commercial_handoff", {
      city: properties.city,
      city_slug: properties.citySlug,
      buyer_label: properties.buyerLabel,
      handoff_type: properties.handoffType,
      launch_id: properties.launchId,
    }),

  // City-opening distribution events
  cityOpeningOutreachSent: (properties: {
    city: string;
    citySlug: string;
    lane: string;
    actionType: string;
    channelLabel: string;
    launchId?: string;
  }) =>
    trackEvent("city_opening_outreach_sent", {
      city: properties.city,
      city_slug: properties.citySlug,
      lane: properties.lane,
      action_type: properties.actionType,
      channel_label: properties.channelLabel,
      launch_id: properties.launchId,
    }),

  cityOpeningResponseReceived: (properties: {
    city: string;
    citySlug: string;
    lane: string;
    responseType: string;
    routingTarget: string;
    launchId?: string;
  }) =>
    trackEvent("city_opening_response_received", {
      city: properties.city,
      city_slug: properties.citySlug,
      lane: properties.lane,
      response_type: properties.responseType,
      routing_target: properties.routingTarget,
      launch_id: properties.launchId,
    }),
};

export { getAnalyticsSessionId, getOrCreateExperimentAnonymousId, getSafeErrorType };
