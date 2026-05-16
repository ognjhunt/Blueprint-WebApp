export function derivePostHogAssetHost(host: string | undefined | null) {
  const value = String(host || "").trim();
  if (!value) {
    return null;
  }

  return value.replace("://us.i.posthog.com", "://us-assets.i.posthog.com");
}

type ContentSecurityPolicyOptions = {
  isProduction: boolean;
  posthogHost?: string | null;
  hostedDemoRuntimeBaseUrl?: string | null;
  hostedDemoRuntimeWebsocketBaseUrl?: string | null;
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
  hostedDemoRuntimeBaseUrl,
  hostedDemoRuntimeWebsocketBaseUrl,
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
    hostedDemoRuntimeBaseUrl,
    hostedDemoRuntimeWebsocketBaseUrl,
    ...analyticsConnectAllowlist,
  ]);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${
      isProduction ? "" : "'unsafe-eval' http://localhost:5173"
    } ${cspScriptAllowlist.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://chat.lindy.ai https://www.youtube-nocookie.com https://*.firebaseapp.com",
    "worker-src 'self' blob: https://cdnjs.cloudflare.com",
    "media-src 'self' blob: https:",
    `connect-src 'self' data: ${
      isProduction ? "" : "http://localhost:5173 ws://localhost:5173"
    } ${cspConnectAllowlist.join(" ")} https://api.openai.com https://api.lumalabs.ai https://api.firecrawl.dev https://api.gumloop.com https://public.lindy.ai https://chat.lindy.ai https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com https://*.firebaseapp.com https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://maps.googleapis.com https://places.googleapis.com https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://js.stripe.com`,
    "upgrade-insecure-requests",
  ]
    .map((directive) => directive.trim())
    .join("; ");
}
