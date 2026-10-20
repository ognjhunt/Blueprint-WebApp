const PRIVATE_LINK_PATH = /(\/(?:capture-upload|claim|api\/self-capture\/uploads|api\/site-task-brief|api\/site-claim|api\/task-listings\/owner)\/)[^/?#\s"'<>]+/g;

/** Strip URL credentials, every query/fragment, and bearer-link path tokens from telemetry only. */
export function redactInvitationUrl(value: string): string {
  if (!/^(?:https?:\/\/|\/)/i.test(value)) return value;
  try {
    const url = new URL(value, "https://tryblueprint.io");
    const pathname = url.pathname.replace(PRIVATE_LINK_PATH, "$1[redacted]");
    // Construct the safe string rather than serializing the URL so no encoded
    // fragment/query can accidentally survive and bracket markers stay legible.
    return value.startsWith("/") ? pathname : `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0].replace(PRIVATE_LINK_PATH, "$1[redacted]");
  }
}

export function redactTelemetryText(value: string): string {
  if (/^(?:https?:\/\/|\/)/i.test(value)) return redactInvitationUrl(value);
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => redactInvitationUrl(url))
    .replace(PRIVATE_LINK_PATH, "$1[redacted]")
    .replace(/([?&])[^\s"'<>]*/g, "$1[redacted]")
    .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
}

/** Used by both Sentry hooks and first-party diagnostics before serialization. */
export function sanitizeTelemetry<T>(value: T, seen = new WeakSet<object>(), depth = 0): T {
  if (depth > 12) return "[redacted-depth]" as T;
  if (typeof value === "string") return redactTelemetryText(value) as T;
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]" as T;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeTelemetry(item, seen, depth + 1)) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z]/gi, "").toLowerCase();
    result[key] = /(?:token|secret|password|authorization|cookie|apikey|email|requestbody)$/.test(normalized)
      ? "[redacted]"
      : sanitizeTelemetry(item, seen, depth + 1);
  }
  // Sentry request bodies can contain form fields or signed upload metadata.
  if (result.request && typeof result.request === "object") {
    const request = result.request as Record<string, unknown>;
    if ("data" in request) request.data = "[redacted]";
    if ("headers" in request) request.headers = "[redacted]";
  }
  return result as T;
}
