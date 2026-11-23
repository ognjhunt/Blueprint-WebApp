/**
 * Routes whose address carries a signed view or download ticket in its query (expiry, signature, the viewer it is
 * bound to). Anyone holding the address can use the ticket until it expires, so the query never enters a log.
 */
const TICKET_QUERY_ROUTES = ["/api/website-atlas-preview-views/", "/api/website-atlas-preview-downloads/",
  "/api/website-destination-pictures/", "/api/company-media/"];

/**
 * Route prefixes followed by the site's own signed job link as the next segment (every route under them takes
 * `/:token` there). Anyone holding the link acts as the site, so the segment and the query never enter a log; the
 * rest of the address stays, so the log still says which step was asked for. Express matches routes without regard
 * to case, so neither does this.
 */
const SIGNED_LINK_PATH_ROUTES = ["/api/site-task-brief/", "/api/self-capture/uploads/", "/api/site-claim/",
  "/api/job-facts/", "/api/job-outcomes/", "/api/job-workflow/owner/"];

/** OAuth material, signed tickets and links, and private address searches must not enter request logs. */
export function privateWorkLogPath(url: string): string {
  const path = url.split("?", 1)[0];
  const lowered = path.toLowerCase();
  const linkRoute = SIGNED_LINK_PATH_ROUTES.find(prefix => lowered.startsWith(prefix));
  if (linkRoute) return `${linkRoute}[link]${path.slice(linkRoute.length).replace(/^[^/]*/, "")}`;
  if (/[?&]invitation=/.test(url)) return url.split("?", 1)[0];
  if (url.split("?", 1)[0].startsWith("/api/location-autocomplete")) return url.split("?", 1)[0];
  if (TICKET_QUERY_ROUTES.some(prefix => url.startsWith(prefix))) return url.split("?", 1)[0];
  // An unsubscribe link's query: its token, or the address itself in a link sent before tokens.
  if (lowered.startsWith("/api/growth/email/")) return path;
  if (!url.startsWith("/api/blueprint-work/") && !url.startsWith("/app/connect/chatgpt")
    && !url.startsWith("/api/communications/gmail/oauth")) return url;
  return url.split("?", 1)[0].replace(/(\/consent\/)[^/]+/, "$1[flow]");
}
