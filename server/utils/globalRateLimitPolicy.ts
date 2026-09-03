export const GLOBAL_RATE_LIMIT_SKIP_PATHS = Object.freeze([
  "/health",
  "/site-worlds/sessions",
  // Short-lived HMAC tickets and immutable registry admission protect this
  // route. Video players may issue many Range requests while seeking.
  "/task-evaluation-result-downloads",
]);

export function globalRateLimitSkipsPath(pathname: string) {
  return GLOBAL_RATE_LIMIT_SKIP_PATHS.some((path) => pathname.startsWith(path));
}
