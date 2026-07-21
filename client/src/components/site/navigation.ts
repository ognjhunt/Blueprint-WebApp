// Public chrome navigation model (redesign spec: SCREENS.md "Global chrome").
// Exported names are preserved so Header/Footer imports stay stable; targets are repointed.

export const primaryNavLinks = [
  { href: "/for-robot-teams", label: "For Robot Teams" },
  { href: "/for-site-operators", label: "For Site Operators" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

// Utility links sit between the primary nav and the auth controls (divider · Become a capturer · Sign in).
export const headerUtilityLinks = [
  { href: "/capture", label: "Become a capturer" },
];

// Primary header CTA — white-fill "Request evaluation" button.
export const headerRequestEvaluation = {
  href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=header",
  label: "Request evaluation",
};

// Footer columns: Product / Evidence / Company.
export const footerProductLinks = [
  { href: "/for-robot-teams", label: "For Robot Teams" },
  { href: "/for-site-operators", label: "For Site Operators" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export const footerEvidenceLinks = [
  { href: "/proof", label: "Proof" },
  { href: "/sites", label: "Sites" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export const footerCompanyLinks = [
  { href: "/vision", label: "Vision" },
  {
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=footer",
    label: "Request evaluation",
  },
  { href: "/contact/site-operator", label: "Start site review" },
  { href: "/capture", label: "Become a capturer" },
];

// Retained for backward compatibility (legacy Footer import); now points at evidence/legal links.
export const footerSupportLinks = footerEvidenceLinks;
