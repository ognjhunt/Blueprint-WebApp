import { useState, useEffect } from "react";
import { X } from "lucide-react";
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
    <div className="ms-cookie-consent fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="ms-cookie-panel mx-auto max-w-xl p-6 sm:ml-auto sm:mr-0" role="region" aria-labelledby="cookie-preferences-title">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 id="cookie-preferences-title" className="text-lg font-medium tracking-tight text-[#22251e]">Cookie preferences</h2>
            </div>
          </div>
          <button
            onClick={handleRejectAll}
            className="flex h-11 w-11 items-center justify-center text-[#62645d] transition hover:bg-[#eef0e7] hover:text-[#22251e]"
            aria-label="Reject optional cookies and close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-[#62645d]">
          Essential cookies keep the site working. Choose whether to allow analytics and marketing cookies. Read our{" "}
          <a href="/privacy" className="font-medium text-[#203d2e] underline underline-offset-4">privacy policy</a>.
        </p>

        {/* Cookie Details (expandable) */}
        {showDetails && (
          <div id="cookie-details" className="mb-4 space-y-3 border-y border-[#c5cabc] py-4">
            {/* Necessary */}
            <label className="flex min-h-[44px] items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#22251e]">Necessary</span>
                <p className="text-xs text-[#62645d]">Required for basic site functionality</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.necessary}
                disabled
                className="h-4 w-4 rounded-none border-[#c5cabc] bg-[#f6f5ef] accent-[#203d2e]"
              />
            </label>

            {/* Analytics */}
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#22251e]">Analytics</span>
                <p className="text-xs text-[#62645d]">Help us understand how you use our site</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                className="h-4 w-4 rounded-none border-[#c5cabc] bg-[#f6f5ef] accent-[#203d2e] focus:ring-[#203d2e]"
              />
            </label>

            {/* Marketing */}
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#22251e]">Marketing</span>
                <p className="text-xs text-[#62645d]">Personalized ads and content</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                className="h-4 w-4 rounded-none border-[#c5cabc] bg-[#f6f5ef] accent-[#203d2e] focus:ring-[#203d2e]"
              />
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            aria-controls="cookie-details"
            className="min-h-[44px] py-2 text-left font-sans text-[13px] font-medium normal-case tracking-normal text-[#62645d] transition hover:text-[#203d2e]"
          >
            {showDetails ? "Hide details" : "Customize"}
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleRejectAll}
              className="min-h-[44px] flex-1 border border-[#c5cabc] px-4 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#22251e] transition hover:border-[#203d2e] hover:text-[#203d2e] sm:flex-none"
            >
              Reject all
            </button>
            {showDetails ? (
              <button
                onClick={handleAcceptSelected}
                className="min-h-[44px] flex-1 bg-[#203d2e] px-4 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#f6f5ef] transition hover:bg-[#315440] sm:flex-none"
              >
                Save preferences
              </button>
            ) : (
              <button
                onClick={handleAcceptAll}
                className="min-h-[44px] flex-1 bg-[#203d2e] px-4 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#f6f5ef] transition hover:bg-[#315440] sm:flex-none"
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
