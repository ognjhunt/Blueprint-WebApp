import { useState, useEffect } from "react";
import { X } from "lucide-react";

/** Dispatched by the footer's "Cookie settings" link to reopen these choices. */
export const OPEN_COOKIE_SETTINGS_EVENT = "blueprint:open-cookie-settings";

export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

/**
 * Cookie settings. The website uses only essential cookies and browser storage
 * (sign-in, form protection, an unsent job draft), which need no consent, so
 * nothing is asked on a first visit. The panel opens only from the footer's
 * "Cookie settings" link or the Privacy Policy's "open cookie settings" button,
 * and says what is used.
 */
export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const open = () => setIsVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="ms-cookie-consent pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="ms-cookie-panel pointer-events-auto mx-auto max-w-xl p-6 sm:ml-auto sm:mr-0" role="region" aria-labelledby="cookie-preferences-title">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="cookie-preferences-title" className="text-lg font-medium tracking-tight text-[#22251e]">Cookie preferences</h2>
          <button
            onClick={() => setIsVisible(false)}
            className="flex h-11 w-11 items-center justify-center text-[#62645d] transition hover:bg-[#eef0e7] hover:text-[#22251e]"
            aria-label="Close cookie settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-[#62645d]">
          We use only essential cookies and browser storage: they keep you signed in, protect forms from forgery and
          keep an unsent job draft on your device. We use no analytics or marketing cookies, so there is nothing to
          choose. Read our{" "}
          <a href="/privacy" className="font-medium text-[#203d2e] underline underline-offset-4">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
