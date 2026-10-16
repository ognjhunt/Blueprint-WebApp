/** One small public website; existing account, capture, and result URLs remain supported. */
export const minimalMarketingRedirects: Record<string, string> = {
  "/pricing": "/beta",
  "/for-site-operators": "/contact/site-operator",
  "/for-robot-teams": "/contact/robot-team",
  "/robot-team/eval": "/contact/robot-team",
  "/vision": "/",
  "/faq": "/#how-it-works",
  "/proof": "/#how-it-works",
  "/governance": "/privacy",
  "/capture-visit": "/contact/site-operator",
  "/site-task": "/contact/site-operator",
  "/robot-intake": "/contact/robot-team",
  // The capturer network is retired: sites film their own job or Blueprint films it.
  "/beta/capturer-guide": "/contact/site-operator",
};

export const minimalPublicPaths = ["/", "/sites", "/how-it-works", "/beta", "/contact/site-operator", "/contact/robot-team", "/about", "/privacy", "/terms", "/privacy/previous", "/terms/previous"] as const;

/** Public pages with a dynamic segment that also render on the minimal shell. */
const minimalPublicPathPatterns = [/^\/sites\/[^/]+$/] as const;

/**
 * True when a pathname (or a route pattern such as `/sites/:slug`) renders on
 * the minimal public shell. Trailing slashes are ignored.
 */
export function isMinimalPublicPath(pathname: string): boolean {
  const normalized = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return (minimalPublicPaths as readonly string[]).includes(normalized)
    || minimalPublicPathPatterns.some((pattern) => pattern.test(normalized));
}
