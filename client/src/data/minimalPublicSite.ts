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
  // The capturer network and Blueprint filming visits are retired: sites film their own job.
  "/beta/capturer-guide": "/contact/site-operator",
  // Bare bones (2026-11-11): "Jobs we support" folded into How it works, "About" into the Questions page.
  "/jobs-we-support": "/how-it-works",
  "/about": "/beta#who-we-are",
  // The job packet frame (2026-11-12): surfaces it does not need are gone; their old URLs land here.
  "/internal/opportunity-board": "/",
  "/internal/opportunity-board/:id": "/",
  "/internal/opportunity-board/:id/anonymous": "/",
  "/internal/opportunity-board/:id/package": "/",
  "/internal/opportunity-board/:id/offer": "/",
  "/internal/opportunity-board/:id/offers": "/",
  "/partners/deployment": "/partners",
  "/partners/technology": "/partners",
  "/sites": "/partners",
  "/sites/:slug": "/partners",
  "/beta/buyer-guide": "/partners",
  "/requests/:requestId": "/",
  "/requests/:requestId/evidence": "/",
  "/requests/:requestId/qualification": "/",
  "/requests/:requestId/preview": "/",
  // Where robot teams ran their own software, and the old account history page.
  "/app/history": "/",
  "/app/library": "/partners",
  "/app/opportunities": "/partners",
  "/app/opportunities/:opportunityId": "/partners",
  "/app/evaluations/:evaluationId": "/partners",
  "/app/runs": "/partners",
  "/app/runs/new": "/partners",
  "/app/advanced/runs/new": "/partners",
  "/app/runs/:runId": "/partners",
  "/app/runs/:runId/policy-candidate/new": "/partners",
  "/app/packs": "/partners",
  "/app/packs/policy-packet": "/partners",
  "/app/packs/:sourceLaunchId/evaluate": "/partners",
  "/app/packs/:sourceLaunchId/policy-canary": "/partners",
  "/app/packs/:siteId": "/partners",
  "/app/policies": "/partners",
  "/app/data": "/partners",
  "/app/entitlements": "/partners",
  // Operator pages V1 does not need: the CEO metrics screen and the designers' reference.
  "/admin/company-metrics": "/",
  "/ops/spend": "/",
  "/internal/design-system": "/",
  // The last removal round (2026-11-12): one "Your jobs" list at /app replaces the signed-in job pages, and the
  // printed readiness brief is gone. Old links land on the home page, whose header leads a signed-in site to its jobs.
  "/app/tasks": "/",
  "/app/tasks/new": "/contact/site-operator",
  "/app/tasks/:taskId": "/",
  "/readiness-brief/:briefToken": "/",
};

/**
 * Retired URLs whose old links carried a credential in the query string (the
 * buyer review console's `?access=` token). Their redirect drops the query so a
 * token never travels onto another page; every other redirect keeps it.
 */
export const queryDroppingRedirects: ReadonlySet<string> = new Set([
  "/requests/:requestId",
  "/requests/:requestId/evidence",
  "/requests/:requestId/qualification",
  "/requests/:requestId/preview",
]);

export const minimalPublicPaths = ["/", "/how-it-works", "/partners", "/beta", "/contact/site-operator", "/contact/robot-team", "/privacy", "/terms", "/refunds", "/privacy/previous", "/terms/previous"] as const;

/**
 * True when a pathname renders on the minimal public shell. Trailing slashes
 * are ignored.
 */
export function isMinimalPublicPath(pathname: string): boolean {
  const normalized = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return (minimalPublicPaths as readonly string[]).includes(normalized);
}
