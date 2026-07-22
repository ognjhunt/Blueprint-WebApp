// Public chrome navigation model (redesign spec: SCREENS.md "Global chrome").
// Exported names are preserved so Header/Footer imports stay stable; targets are repointed.
//
// Streamlined to a single front door: the robot-team Task Evaluation Run. Site
// operators (a later demand-side gate / access partner) and capturers (paid
// supply) are kept reachable but demoted below the primary buyer motion.

export const primaryNavLinks = [
  { href: "/for-robot-teams", label: "For Robot Teams" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

// Utility links sit between the primary nav and the auth controls. Capture is paid
// supply the company recruits — framed as an earn opportunity, not a product to buy.
export const headerUtilityLinks = [
  { href: "/capture", label: "Get paid to capture" },
];

// Primary header CTA — white-fill "Request evaluation" button.
export const headerRequestEvaluation = {
  href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=header",
  label: "Request evaluation",
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
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=footer",
    label: "Request evaluation",
  },
  // Demoted: site operators are a capture / access partner, not a co-equal buyer.
  { href: "/for-site-operators", label: "Site access partners" },
  // Demoted: capture is paid supply the company recruits.
  { href: "/capture", label: "Get paid to capture" },
];

// Retained for backward compatibility (legacy Footer import); now points at evidence/legal links.
export const footerSupportLinks = footerEvidenceLinks;
