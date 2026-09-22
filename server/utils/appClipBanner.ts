/**
 * The Smart App Banner for the capture link.
 *
 * `/capture-upload/:token` is the page the site-operator QR opens. When the App
 * Clip is published, Safari can offer it from that page; the browser recorder
 * underneath stays the fallback. The tag is stamped only on that route, and only
 * when both the full app's App Store ID and the App Clip bundle ID are
 * configured with real values — a banner pointing at an app that is not live
 * would promise something the page cannot deliver.
 */

type BannerEnv = Record<string, string | undefined>;

const CAPTURE_LINK_PATH = /^\/capture-upload\/[^/]+\/?$/;
const APP_STORE_ID = /^\d{6,12}$/;
const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const PLACEHOLDER = /^(YOUR|REPLACE|CHANGE)[_-]|^(PLACEHOLDER|IOS_APP_CLIP_BUNDLE_ID|APP_CLIP_BUNDLE_ID)$/i;

export function appClipBannerContent(env: BannerEnv = process.env): string | null {
  const appStoreId = env.IOS_APP_STORE_ID?.trim();
  const clipBundleId =
    env.IOS_APP_CLIP_BUNDLE_ID?.trim() || env.APP_CLIP_BUNDLE_ID?.trim();
  if (!appStoreId || !APP_STORE_ID.test(appStoreId)) return null;
  if (!clipBundleId || PLACEHOLDER.test(clipBundleId) || !BUNDLE_ID.test(clipBundleId)) return null;
  return `app-id=${appStoreId}, app-clip-bundle-id=${clipBundleId}, app-clip-display=card`;
}

export function isCaptureLinkPath(pathname: string): boolean {
  const withoutQuery = pathname.split(/[?#]/, 1)[0];
  return CAPTURE_LINK_PATH.test(withoutQuery);
}

/** Adds the banner tag to a capture-link document; every other document is returned unchanged. */
export function stampAppClipBanner(
  html: string,
  pathname: string,
  env: BannerEnv = process.env,
): string {
  if (!isCaptureLinkPath(pathname)) return html;
  const content = appClipBannerContent(env);
  if (!content || /<meta\s+name="apple-itunes-app"/i.test(html)) return html;
  return html.replace(
    /<head\b[^>]*>/i,
    (head) => `${head}\n    <meta name="apple-itunes-app" content="${content}" />`,
  );
}
