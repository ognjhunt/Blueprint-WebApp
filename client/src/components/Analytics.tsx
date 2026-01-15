import { useEffect } from "react";
import { getImportMetaEnv } from "@/lib/import-meta-env";
import { getCookieConsent } from "./CookieConsent";

export function Analytics() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const env = getImportMetaEnv();
    // Replace with your actual GA4 Measurement ID
    const gaMeasurementId = env.VITE_GA_MEASUREMENT_ID ?? "G-XXXXXXXXXX";

    // Don't initialize in development unless explicitly enabled
    if (env.DEV && !env.VITE_ENABLE_ANALYTICS) {
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
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
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
    window.gtag("config", gaMeasurementId, {
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
};
