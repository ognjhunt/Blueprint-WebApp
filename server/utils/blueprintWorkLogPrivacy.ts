/**
 * Routes whose address carries a signed view or download ticket in its query (expiry, signature, the viewer it is
 * bound to). Anyone holding the address can use the ticket until it expires, so the query never enters a log.
 */
const TICKET_QUERY_ROUTES = ["/api/website-atlas-preview-views/", "/api/website-atlas-preview-downloads/",
  "/api/website-destination-pictures/", "/api/company-media/"];

/** OAuth material, signed tickets and private address searches must not enter request logs. */
export function privateWorkLogPath(url: string): string {
  if (/[?&]invitation=/.test(url)) return url.split("?", 1)[0];
  if (url.split("?", 1)[0].startsWith("/api/location-autocomplete")) return url.split("?", 1)[0];
  if (TICKET_QUERY_ROUTES.some(prefix => url.startsWith(prefix))) return url.split("?", 1)[0];
  if (!url.startsWith("/api/blueprint-work/") && !url.startsWith("/app/connect/chatgpt")
    && !url.startsWith("/api/communications/gmail/oauth")) return url;
  return url.split("?", 1)[0].replace(/(\/consent\/)[^/]+/, "$1[flow]");
}
