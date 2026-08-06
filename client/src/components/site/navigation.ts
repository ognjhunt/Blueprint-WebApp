// Public chrome navigation model (redesign spec: SCREENS.md "Global chrome").
// Exported names are preserved so Header/Footer imports stay stable; targets are repointed.
//
// Streamlined to one product with a robot-team-first wedge. Site operators are
// a second persona using the same Task Evaluation Run contract and intake;
// capturers remain the paid-supply path.

export const primaryNavLinks = [
  { href: "/for-robot-teams", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/proof", label: "Proof" },
  { href: "/pricing", label: "Pricing" },
];

// Utility links sit between the primary nav and the auth controls. Capture is paid
// supply the company recruits — framed as an earn opportunity, not a product to buy.
export const headerUtilityLinks = [
  { href: "/capture", label: "Capture network" },
];

// Primary header CTA — white-fill "Request evaluation" button.
export const headerRequestEvaluation = {
  href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=task-evaluation-run&path=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=header",
  label: "Scope a benchmark",
};

// Footer columns: Product / Evidence / Company.
export const footerProductLinks = [
  { href: "/for-robot-teams", label: "For Robot Teams" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export const footerEvidenceLinks = [
  { href: "/proof", label: "Proof" },
  { href: "/faq", label: "FAQ" },
  { href: "/sites", label: "Sites" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export const footerCompanyLinks = [
  { href: "/vision", label: "Vision" },
  {
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=task-evaluation-run&path=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=footer",
    label: "Request a Task Evaluation Run",
  },
  { href: "/for-site-operators", label: "For Site Operators" },
  // Demoted: capture is paid supply the company recruits.
  { href: "/capture", label: "Get paid to capture" },
];

// Retained for backward compatibility (legacy Footer import); now points at evidence/legal links.
export const footerSupportLinks = footerEvidenceLinks;
