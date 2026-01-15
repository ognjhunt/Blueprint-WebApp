import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "blueprint_cookie_consent";

type ConsentStatus = "accepted" | "rejected" | null;

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  necessary: boolean;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    analytics: true,
    marketing: false,
    necessary: true,
  });

  useEffect(() => {
    // Check if consent was already given
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const fullConsent = {
      analytics: true,
      marketing: true,
      necessary: true,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullConsent));
    setIsVisible(false);

    // Initialize analytics if accepted
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
      });
    }
  };

  const handleAcceptSelected = () => {
    const consent = {
      ...preferences,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    setIsVisible(false);

    // Initialize analytics based on preferences
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: preferences.analytics ? "granted" : "denied",
        ad_storage: preferences.marketing ? "granted" : "denied",
      });
    }
  };

  const handleRejectAll = () => {
    const minimalConsent = {
      analytics: false,
      marketing: false,
      necessary: true,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(minimalConsent));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <Cookie className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Cookie Preferences</h3>
              <p className="text-sm text-zinc-500">Manage your privacy settings</p>
            </div>
          </div>
          <button
            onClick={handleRejectAll}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-zinc-600">
          We use cookies to enhance your experience, analyze site traffic, and for marketing purposes.
          Review our{" "}
          <a href="/privacy" className="font-medium text-indigo-600 hover:text-indigo-500">
            Privacy &amp; Cookies
          </a>{" "}
          details, customize your preferences, or accept all cookies.
        </p>

        {/* Cookie Details (expandable) */}
        {showDetails && (
          <div className="mb-4 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            {/* Necessary */}
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-zinc-900">Necessary</span>
                <p className="text-xs text-zinc-500">Required for basic site functionality</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.necessary}
                disabled
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
              />
            </label>

            {/* Analytics */}
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-zinc-900">Analytics</span>
                <p className="text-xs text-zinc-500">Help us understand how you use our site</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Marketing */}
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-zinc-900">Marketing</span>
                <p className="text-xs text-zinc-500">Personalized ads and content</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            {showDetails ? "Hide details" : "Customize"}
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleRejectAll}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 sm:flex-none"
            >
              Reject all
            </button>
            {showDetails ? (
              <button
                onClick={handleAcceptSelected}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:flex-none"
              >
                Save preferences
              </button>
            ) : (
              <button
                onClick={handleAcceptAll}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:flex-none"
              >
                Accept all
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility to check consent status
export function getCookieConsent(): ConsentPreferences | null {
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent) {
      return JSON.parse(consent);
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

// Utility to check if analytics is allowed
export function isAnalyticsAllowed(): boolean {
  const consent = getCookieConsent();
  return consent?.analytics ?? false;
}

// Use this for personalization or marketing features that require explicit opt-in.
// Example consumers: client/src/components/Analytics.tsx or any personalization logic.
export function isPersonalizationAllowed(): boolean {
  const consent = getCookieConsent();
  return consent?.marketing ?? false;
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}
