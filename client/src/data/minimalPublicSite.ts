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
};

export const minimalPublicPaths = ["/", "/sites", "/how-it-works", "/beta", "/contact/site-operator", "/contact/robot-team", "/about", "/privacy", "/terms"] as const;
