/**
 * Route matching shared by the client router lookup and the server.
 *
 * The server has to know which paths the client renders so an unknown path
 * can be answered with a real 404 instead of a 200 that happens to show a
 * "page not found" message. It cannot import the route table (that pulls in
 * React), so the build writes the table's patterns to `ROUTE_PATTERNS_FILE`
 * and both sides match them with this one function.
 */

/** Written next to `dist/public` by `scripts/prerender.tsx`. */
export const ROUTE_PATTERNS_FILE = "app-route-patterns.json";

/**
 * Mirrors wouter's matching for the patterns this app uses: literal segments
 * plus `:param` segments, compared segment by segment.
 */
export function routePatternMatches(pattern: string, pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegments = pattern.split("/").filter(Boolean);
  if (routeSegments.length !== segments.length) return false;
  return routeSegments.every(
    (segment, index) => segment.startsWith(":") || segment === segments[index],
  );
}
