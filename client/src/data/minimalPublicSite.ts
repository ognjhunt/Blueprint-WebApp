/** One small public website; existing account, capture, and result URLs remain supported. */
export const minimalMarketingRedirects: Record<string, string> = {
  "/for-site-operators": "/contact/site-operator",
  "/for-robot-teams": "/contact/robot-team",
  "/robot-team/eval": "/contact/robot-team",
  "/pricing": "/contact/site-operator",
  "/about": "/",
  "/vision": "/",
  "/faq": "/#how-it-works",
  "/proof": "/#how-it-works",
  "/governance": "/privacy",
  "/capture-visit": "/contact/site-operator",
  "/site-task": "/contact/site-operator",
  "/robot-intake": "/contact/robot-team",
};

export const minimalPublicPaths = ["/", "/how-it-works", "/contact/site-operator", "/contact/robot-team", "/privacy", "/terms", "/sites", "/capture", "/launch-map", "/capture-app/launch-access"] as const;

/**
 * Public routes with a dynamic segment that still belong to the ivory site.
 * Kept separate from the exact list so an internal route can never match by
 * accident: admin, ops and the buyer app carry their own chrome.
 */
const minimalPublicPrefixes = ["/sites/"] as const;

export function isMinimalPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return (
    (minimalPublicPaths as readonly string[]).includes(normalized)
    || minimalPublicPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}
