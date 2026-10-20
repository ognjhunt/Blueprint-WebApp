import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { updateAnalyticsConsent } from "@/lib/analytics";

const COOKIE_CONSENT_KEY = "blueprint_cookie_consent";
/** Dispatched by the footer's "Cookie settings" link to reopen these choices. */
export const OPEN_COOKIE_SETTINGS_EVENT = "blueprint:open-cookie-settings";

export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

export interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  necessary: boolean;
  /**
   * Set when the choice was made while the browser sent Global Privacy
   * Control, so an explicit opt-in made under GPC is honoured and an older
   * opt-in made without it is not.
   */
  gpc?: boolean;
}

/**
 * Global Privacy Control (https://globalprivacycontrol.org): a browser-level
 * opt-out of sale and sharing. We treat it as "analytics and marketing off"
 * unless the visitor turns them on themselves while the signal is present.
 */
export function globalPrivacyControlEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

const optionalOff: ConsentPreferences = { analytics: false, marketing: false, necessary: true };
// A failed storage write must not resurrect a previous opt-in on navigation.
let sessionChoice: ConsentPreferences | undefined;

/** Storage events are a new choice from another tab; ordinary reads retain this tab's latest choice. */
export function refreshCookieConsentFromStorage(): ConsentPreferences | null {
  sessionChoice = undefined;
  return getCookieConsent();
}


export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  // Nothing optional is pre-selected: a visitor has to turn analytics or
  // marketing on themselves.
  const [preferences, setPreferences] = useState<ConsentPreferences>(optionalOff);
  const gpc = globalPrivacyControlEnabled();

  // A choice made once can be changed: the footer link reopens the details
  // with what was chosen last time.
  useEffect(() => {
    const reopen = () => {
      try {
        const stored = getCookieConsent();
        if (stored) setPreferences({ necessary: true, analytics: stored.analytics === true, marketing: stored.marketing === true });
      } catch { /* Keep the defaults. */ }
      setShowDetails(true);
      setIsVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    // The capture page is a tool someone was handed a link to, not a marketing
    // surface: a consent dialog covering the camera or the "saved" state asks a
    // question the visit does not need answered. Only essential cookies are set
    // there, so there is nothing on it to consent to.
    const isCaptureToolPage = window.location.pathname.startsWith("/capture-upload");
    // Check if consent was already given
    const consent = getCookieConsent();
    // A browser sending Global Privacy Control has already answered for the
    // optional cookies: they stay off, so there is nothing to ask. The footer
    // link still opens the choices for anyone who wants to opt in.
    if (!consent && !isCaptureToolPage && !globalPrivacyControlEnabled()) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveChoice = (consent: ConsentPreferences & { timestamp: string }) => {
    sessionChoice = consent;
    try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent)); } catch {
      // Apply the choice for this page even when browser storage is blocked.
    }
    setPreferences(consent);
    setIsVisible(false);
    updateAnalyticsConsent(consent);
  };

  const handleAcceptAll = () => {
    const fullConsent = {
      analytics: true,
      marketing: true,
      necessary: true,
      ...(gpc ? { gpc: true } : {}),
      timestamp: new Date().toISOString(),
    };
    saveChoice(fullConsent);
  };

  const handleAcceptSelected = () => {
    const consent = {
      ...preferences,
      ...(gpc ? { gpc: true } : {}),
      timestamp: new Date().toISOString(),
    };
    saveChoice(consent);
  };

  const handleRejectAll = () => {
    const minimalConsent = {
      analytics: false,
      marketing: false,
      necessary: true,
      timestamp: new Date().toISOString(),
    };
    saveChoice(minimalConsent);
  };

  if (!isVisible) return null;

  // On wide screens the first prompt is one slim bar, so it covers as little of a
  // page (a start form especially) as possible; Customize opens the full panel.
  const bar = !showDetails;
  const asBar = (classes: string) => (bar ? ` ${classes}` : "");

  return (
    <div className="ms-cookie-consent pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <div className={`ms-cookie-panel pointer-events-auto mx-auto max-w-xl p-6 sm:ml-auto sm:mr-0${asBar("lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center lg:gap-x-6 lg:py-4")}`} role="region" aria-labelledby="cookie-preferences-title">
        {/* Header */}
        <div className={`mb-4 flex items-start justify-between${asBar("lg:contents")}`}>
          <div className={`flex items-center gap-3${asBar("lg:col-start-1 lg:row-start-1 lg:mb-1")}`}>
            <div>
              <h2 id="cookie-preferences-title" className="text-lg font-medium tracking-tight text-[#22251e]">Cookie preferences</h2>
            </div>
          </div>
          <button
            onClick={handleRejectAll}
            className={`flex h-11 w-11 items-center justify-center text-[#62645d] transition hover:bg-[#eef0e7] hover:text-[#22251e]${asBar("lg:col-start-3 lg:row-span-3 lg:row-start-1")}`}
            aria-label="Reject optional cookies and close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className={`mb-4 text-sm text-[#62645d]${asBar("lg:col-start-1 lg:mb-0")}`}>
          Essential cookies keep the site working. Choose whether to allow analytics and marketing cookies. Read our{" "}
          <a href="/privacy" className="font-medium text-[#203d2e] underline underline-offset-4">privacy policy</a>.
        </p>
        {gpc && (
          <p className={`mb-4 text-sm text-[#62645d]${asBar("lg:col-start-1 lg:mb-0 lg:mt-2")}`}>
            Your browser sends a Global Privacy Control signal, so analytics and marketing cookies stay off unless you turn them on here.
          </p>
        )}

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
        <div className={`flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between${asBar("lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:gap-5")}`}>
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

// Utility to check consent status. Under Global Privacy Control, an opt-in
// recorded without the signal is read as opted out: only a choice made while
// the signal was present can turn analytics or marketing on.
export function getCookieConsent(): ConsentPreferences | null {
  if (sessionChoice) {
    return globalPrivacyControlEnabled() && sessionChoice.gpc !== true
      ? { ...sessionChoice, ...optionalOff } : sessionChoice;
  }
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent) {
      const stored = JSON.parse(consent) as ConsentPreferences;
      if (!stored || typeof stored.analytics !== "boolean" || typeof stored.marketing !== "boolean") return null;
      if (globalPrivacyControlEnabled() && stored?.gpc !== true) {
        return { ...stored, ...optionalOff };
      }
      return stored;
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
