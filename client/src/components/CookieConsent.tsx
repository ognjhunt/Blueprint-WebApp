import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import { updateAnalyticsConsent } from "@/lib/analytics";

const COOKIE_CONSENT_KEY = "blueprint_cookie_consent";

type ConsentStatus = "accepted" | "rejected" | null;

export interface ConsentPreferences {
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
    updateAnalyticsConsent(fullConsent);
  };

  const handleAcceptSelected = () => {
    const consent = {
      ...preferences,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    setIsVisible(false);
    updateAnalyticsConsent(consent);
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
    updateAnalyticsConsent(minimalConsent);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="runway-panel mx-auto max-w-2xl p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-runway-line bg-runway-raised">
              <Cookie className="h-5 w-5 text-runway-signal" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold uppercase tracking-[0.005em] text-runway-text">Cookie Preferences</h3>
              <p className="text-sm text-runway-faint">Manage your privacy settings</p>
            </div>
          </div>
          <button
            onClick={handleRejectAll}
            className="flex h-11 w-11 items-center justify-center text-runway-faint transition hover:bg-runway-raised hover:text-runway-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-runway-mute">
          We use cookies to enhance your experience, analyze site traffic, and for marketing purposes.
          Review our{" "}
          <a href="/privacy" className="font-medium text-runway-signal underline-offset-4 hover:underline">
            Privacy &amp; Cookies
          </a>{" "}
          details, customize your preferences, or accept all cookies.
        </p>

        {/* Cookie Details (expandable) */}
        {showDetails && (
          <div className="mb-4 space-y-3 border border-runway-line bg-runway-raised p-4">
            {/* Necessary */}
            <label className="flex min-h-[44px] items-center justify-between">
              <div>
                <span className="text-sm font-medium text-runway-text">Necessary</span>
                <p className="text-xs text-runway-faint">Required for basic site functionality</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.necessary}
                disabled
                className="h-4 w-4 rounded-none border-runway-line-strong bg-runway-panel accent-runway-signal"
              />
            </label>

            {/* Analytics */}
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-runway-text">Analytics</span>
                <p className="text-xs text-runway-faint">Help us understand how you use our site</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                className="h-4 w-4 rounded-none border-runway-line-strong bg-runway-panel accent-runway-signal focus:ring-runway-signal"
              />
            </label>

            {/* Marketing */}
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-runway-text">Marketing</span>
                <p className="text-xs text-runway-faint">Personalized ads and content</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                className="h-4 w-4 rounded-none border-runway-line-strong bg-runway-panel accent-runway-signal focus:ring-runway-signal"
              />
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="min-h-[44px] py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-runway-mute transition hover:text-runway-signal"
          >
            {showDetails ? "Hide details" : "Customize"}
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleRejectAll}
              className="min-h-[44px] flex-1 border border-runway-line-strong px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-runway-text transition hover:border-runway-signal hover:text-runway-signal sm:flex-none"
            >
              Reject all
            </button>
            {showDetails ? (
              <button
                onClick={handleAcceptSelected}
                className="min-h-[44px] flex-1 bg-runway-signal px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-runway-signal-ink transition hover:bg-runway-signal-lit sm:flex-none"
              >
                Save preferences
              </button>
            ) : (
              <button
                onClick={handleAcceptAll}
                className="min-h-[44px] flex-1 bg-runway-signal px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-runway-signal-ink transition hover:bg-runway-signal-lit sm:flex-none"
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
