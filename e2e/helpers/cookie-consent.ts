import type { Page } from "@playwright/test";

/**
 * Key and payload shape are mirrored from `client/src/components/CookieConsent.tsx`.
 * The component only reads the key's presence to decide whether to arm its
 * reveal timer, but the value is stored and re-parsed by `getCookieConsent`, so
 * it has to be a well-formed record rather than a sentinel string.
 */
const COOKIE_CONSENT_KEY = "blueprint_cookie_consent";

/**
 * Put the page in the state a returning browser is already in: consent recorded,
 * banner never armed.
 *
 * `CookieConsent` shows itself 1500ms after mount when no consent is stored, and
 * it renders `fixed inset-x-0 bottom-0 z-50`. Any spec whose interactions run
 * past that timer can have the banner drop on top of a control and intercept
 * pointer events — which makes the spec's result a function of how fast the
 * runner is, not of the behaviour under test.
 *
 * `addInitScript` runs before the app's scripts on every navigation in the
 * page's lifetime, so this must be installed before the first `goto`.
 *
 * Use this only for specs that are not about the banner itself. It is
 * deliberately not global: the brand-polish sweep still renders and screenshots
 * the banner, and consent behaviour needs to stay observable somewhere.
 */
export async function seedCookieConsent({ page }: { page: Page }): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [
      COOKIE_CONSENT_KEY,
      JSON.stringify({
        analytics: false,
        marketing: false,
        necessary: true,
        // Fixed rather than Date.now() so a rerun of the same spec produces the
        // same stored payload.
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    ] as const,
  );
}
