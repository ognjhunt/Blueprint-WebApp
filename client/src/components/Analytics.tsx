import { useEffect } from "react";
import { getCookieConsent } from "./CookieConsent";

// Replace with your actual GA4 Measurement ID
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-XXXXXXXXXX";

export function Analytics() {
  useEffect(() => {
    // Don't initialize in development unless explicitly enabled
    if (import.meta.env.DEV && !import.meta.env.VITE_ENABLE_ANALYTICS) {
      return;
    }

    // Check if already loaded
    if (document.getElementById("ga-script")) {
      return;
    }

    // Check consent status (use isPersonalizationAllowed for marketing/personalization features)
    const consent = getCookieConsent();
    const analyticsAllowed = consent?.analytics ?? false;

    // Load gtag script
    const script = document.createElement("script");
    script.id = "ga-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Initialize gtag with consent mode
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

    window.gtag("js", new Date());

    // Set default consent state
    window.gtag("consent", "default", {
      analytics_storage: analyticsAllowed ? "granted" : "denied",
      ad_storage: consent?.marketing ? "granted" : "denied",
    });

    // Configure GA
    window.gtag("config", GA_MEASUREMENT_ID, {
      anonymize_ip: true,
      cookie_flags: "SameSite=None;Secure",
    });

    return () => {
      // Cleanup if needed
      const scriptEl = document.getElementById("ga-script");
      if (scriptEl) {
        scriptEl.remove();
      }
    };
  }, []);

  return null;
}

// Track page views
export function trackPageView(path: string, title?: string) {
  if (window.gtag) {
    window.gtag("event", "page_view", {
      page_path: path,
      page_title: title,
    });
  }
}

// Track custom events
export function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) {
  if (window.gtag) {
    window.gtag("event", eventName, parameters);
  }
}

// Common event helpers
export const analyticsEvents = {
  // Contact form events
  contactFormSubmit: (formType: string) =>
    trackEvent("contact_form_submit", { form_type: formType }),

  contactFormError: (errorType: string) =>
    trackEvent("contact_form_error", { error_type: errorType }),

  // Marketplace events
  marketplaceItemView: (itemId: string, itemType: string) =>
    trackEvent("view_item", { item_id: itemId, item_type: itemType }),

  marketplaceFilterApply: (filterType: string, filterValue: string) =>
    trackEvent("apply_filter", { filter_type: filterType, filter_value: filterValue }),

  // Auth events
  loginAttempt: (method: string) =>
    trackEvent("login_attempt", { method }),

  signupAttempt: (method: string) =>
    trackEvent("signup_attempt", { method }),

  // Checkout events
  beginCheckout: (itemId: string, value: number) =>
    trackEvent("begin_checkout", { item_id: itemId, value, currency: "USD" }),

  completeCheckout: (source: string, value: number) =>
    trackEvent("checkout_complete", { source, value, currency: "USD" }),

  purchaseComplete: (transactionId: string, value: number) =>
    trackEvent("purchase", { transaction_id: transactionId, value, currency: "USD" }),

  // Waitlist events
  waitlistSignup: (locationType: string) =>
    trackEvent("waitlist_signup", { location_type: locationType }),

  // Pilot Exchange events
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
};
