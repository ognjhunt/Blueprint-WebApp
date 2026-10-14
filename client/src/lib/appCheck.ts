import type { AppCheck } from "firebase/app-check";
import { getFirebaseAppCheckSiteKey } from "./client-env";

/**
 * Firebase App Check for the anonymous requests that cost Blueprint money:
 * starting a job and uploading its footage.
 *
 * Off unless `VITE_FIREBASE_APPCHECK_SITE_KEY` is set at build time. When it
 * is, App Check (reCAPTCHA Enterprise) is initialised lazily on the first
 * such request, never on page load, so the reCAPTCHA script only runs for
 * someone actually submitting or uploading. The token goes in the
 * `X-Firebase-AppCheck` header; the server decides, by
 * `BLUEPRINT_APP_CHECK_MODE`, whether a missing or invalid token is only
 * logged (`monitor`) or refused (`enforce`).
 *
 * Every failure is swallowed into "no token": the request is still sent and
 * the server's mode decides what that means.
 */

export const APP_CHECK_HEADER = "X-Firebase-AppCheck";

let instance: Promise<AppCheck | null> | null = null;

function appCheck(): Promise<AppCheck | null> {
  const siteKey = getFirebaseAppCheckSiteKey();
  if (!siteKey || typeof window === "undefined") return Promise.resolve(null);
  instance ??= (async () => {
    const [{ initializeAppCheck, ReCaptchaEnterpriseProvider }, { auth }] = await Promise.all([
      import("firebase/app-check"),
      import("./firebase"),
    ]);
    return initializeAppCheck(auth.app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  })().catch(() => {
    instance = null;
    return null;
  });
  return instance;
}

/** A current App Check token, or null when App Check is off or unavailable. */
export async function getAppCheckToken(): Promise<string | null> {
  try {
    const checker = await appCheck();
    if (!checker) return null;
    const { getToken } = await import("firebase/app-check");
    const { token } = await getToken(checker, false);
    return token || null;
  } catch {
    return null;
  }
}

/** `headers` plus the App Check token, when there is one. */
export async function withAppCheckHeader(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAppCheckToken();
  return token ? { ...headers, [APP_CHECK_HEADER]: token } : headers;
}
