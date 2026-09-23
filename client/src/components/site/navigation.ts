// Public chrome navigation model (redesign spec: SCREENS.md "Global chrome").
// Exported names are preserved so Header/Footer imports stay stable; targets are repointed.
//
// Streamlined to one product with a robot-team-first wedge. Site operators are
// a second persona using the same Task Evaluation Run contract and intake;
// capturers remain the paid-supply path.

export const primaryNavLinks = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-site-operators", label: "For sites" },
  { href: "/for-robot-teams", label: "For robot teams" },
  { href: "/pricing", label: "Pricing" },
];

// Utility links sit between the primary nav and the auth controls. The capture
// network is retired for now (sites film their own task), so there are none.
export const headerUtilityLinks: Array<{ href: string; label: string }> = [];

// Primary header CTA.
export const headerRequestEvaluation = {
  href: "/contact/site-operator",
  label: "Start a task assessment",
};

// Footer columns for the legacy layout. Every link resolves to a live page.
export const footerProductLinks = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact/site-operator", label: "Start a task assessment" },
  { href: "/contact/robot-team", label: "Robot teams" },
  { href: "/sites", label: "Task library" },
];

export const footerEvidenceLinks = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export const footerCompanyLinks = [
  { href: "mailto:hello@tryblueprint.io", label: "hello@tryblueprint.io" },
];

// Retained for backward compatibility (legacy Footer import); now points at evidence/legal links.
export const footerSupportLinks = footerEvidenceLinks;
