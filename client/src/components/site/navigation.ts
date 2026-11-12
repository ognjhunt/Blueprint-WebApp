// Public chrome navigation model (redesign spec: SCREENS.md "Global chrome").
// Exported names are preserved so Header/Footer imports stay stable; targets are repointed.
//
// Sites start a job; deployment companies apply on /partners (frame of 2026-11-12).
// There is no capturer supply path: the site films its own job (2026-11-11).

export const primaryNavLinks = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/partners", label: "For deployment companies" },
];

// Utility links sit between the primary nav and the auth controls. The capture
// network is retired for now (sites film their own task), so there are none.
export const headerUtilityLinks: Array<{ href: string; label: string }> = [];

// Primary header CTA.
export const headerRequestEvaluation = {
  href: "/contact/site-operator",
  label: "Start a job",
};

// Footer columns for the legacy layout. Every link resolves to a live page.
export const footerProductLinks = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/beta", label: "Questions" },
  { href: "/contact/site-operator", label: "Start a job" },
  { href: "/partners", label: "For deployment companies" },
];

export const footerEvidenceLinks = [
  { href: "/beta#who-we-are", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
];

export const footerCompanyLinks = [
  { href: "mailto:hello@tryblueprint.io", label: "hello@tryblueprint.io" },
];

// Retained for backward compatibility (legacy Footer import); now points at evidence/legal links.
export const footerSupportLinks = footerEvidenceLinks;
