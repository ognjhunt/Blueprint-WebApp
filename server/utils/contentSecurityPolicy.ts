export function derivePostHogAssetHost(host: string | undefined | null) {
  const value = String(host || "").trim();
  if (!value) {
    return null;
  }

  return value.replace("://us.i.posthog.com", "://us-assets.i.posthog.com");
}

/**
 * Every inline script the production site serves, by CSP hash. There is no
 * 'unsafe-inline' in production script-src: an injected <script> runs only if
 * its exact bytes are listed here. server/tests/content-security-policy.test.ts
 * recomputes these from client/index.html, client/public/*.html and, when a
 * build exists, every HTML file under dist/public, and fails if any executable
 * inline script or inline event handler is not covered. JSON-LD
 * (type="application/ld+json") is data, not script, and needs no hash.
 *
 * - this.media='all': the non-blocking web-font link onload in index.html
 *   (needs 'unsafe-hashes'; main.tsx also flips it for browsers without it).
 * - the comment-only inline script in public/onedrive-redirect.html.
 */
export const INLINE_SCRIPT_HASHES = [
  "'sha256-MhtPZXr7+LpJUY5qtMutB+qWfQtMaPccfe7QXtCcEYc='",
  "'sha256-6no7hxXoaGJYS4yuatFPaN1o/Kr/HLN0Ec2Q2gp98lk='",
] as const;

type ContentSecurityPolicyOptions = {
  isProduction: boolean;
  posthogHost?: string | null;
};

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

export function buildContentSecurityPolicy({
  isProduction,
  posthogHost,
}: ContentSecurityPolicyOptions) {
  const analyticsConnectAllowlist = uniqueNonEmpty([
    posthogHost,
    derivePostHogAssetHost(posthogHost),
  ]);

  const cspScriptAllowlist = uniqueNonEmpty([
    "https://js.stripe.com",
    "https://cdnjs.cloudflare.com",
    "https://apis.google.com",
    "https://accounts.google.com",
    "https://www.googletagmanager.com",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    derivePostHogAssetHost(posthogHost),
  ]);

  const cspConnectAllowlist = uniqueNonEmpty([
    ...analyticsConnectAllowlist,
    // The keyless geocoder the location field falls back to when there is no
    // Google Maps key. Google's own hosts are already allowed below. Without
    // this, the free provider is blocked and the field silently loses its
    // suggestions (typing still works, which is the floor, but not the point).
    "https://photon.komoot.io",
  ]);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    // Development keeps 'unsafe-inline' for Vite's injected HMR preamble.
    `script-src 'self' ${
      isProduction ? `'unsafe-hashes' ${INLINE_SCRIPT_HASHES.join(" ")}` : "'unsafe-inline'"
    } 'wasm-unsafe-eval' ${
      isProduction ? "" : "'unsafe-eval' http://localhost:5173"
    } ${cspScriptAllowlist.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.youtube-nocookie.com https://*.firebaseapp.com",
    "worker-src 'self' blob: https://cdnjs.cloudflare.com",
    "media-src 'self' blob: https:",
    `connect-src 'self' data: ${
      isProduction ? "" : "http://localhost:5173 ws://localhost:5173"
    } ${cspConnectAllowlist.join(" ")} https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com https://*.firebaseapp.com https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://maps.googleapis.com https://places.googleapis.com https://js.stripe.com`,
    "upgrade-insecure-requests",
  ]
    .map((directive) => directive.trim())
    .join("; ");
}
