import posthog from "posthog-js";

type AnalyticsConsent = {
  analytics: boolean;
  marketing: boolean;
};

const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : ({} as Record<string, string | boolean | undefined>);

const GA_MEASUREMENT_ID = (viteEnv.VITE_GA_MEASUREMENT_ID as string | undefined) || "";
const POSTHOG_PROJECT_TOKEN =
  (viteEnv.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string | undefined)?.trim() || "";
const POSTHOG_HOST =
  (viteEnv.VITE_PUBLIC_POSTHOG_HOST as string | undefined)?.trim() || "";

let gaInitialized = false;
let posthogInitialized = false;

function analyticsRuntimeEnabled() {
  return viteEnv.DEV !== true || Boolean(viteEnv.VITE_ENABLE_ANALYTICS);
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
}

export function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) {
  if (window.gtag && hasConfiguredGa()) {
    window.gtag("event", eventName, parameters);
  }

  if (posthogInitialized && hasConfiguredPostHog()) {
    posthog.capture(eventName, parameters);
  }
}

export const analyticsEvents = {
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
};
