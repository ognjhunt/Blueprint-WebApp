export type HelpCategory = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  audience: string;
  iconKey:
    | "rocket"
    | "package"
    | "play"
    | "shield"
    | "credit"
    | "tool";
  primaryActionHref: string;
  primaryActionLabel: string;
  articles: string[];
};

export type HelpArticleSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type HelpArticle = {
  slug: string;
  categorySlug: string;
  title: string;
  description: string;
  summary: string;
  readTime: string;
  lastUpdated: string;
  sections: HelpArticleSection[];
  relatedArticleSlugs?: string[];
};

const defaultLastUpdated = "May 7, 2026";

function article(input: Omit<HelpArticle, "lastUpdated"> & Partial<Pick<HelpArticle, "lastUpdated">>): HelpArticle {
  return {
    lastUpdated: defaultLastUpdated,
    ...input,
  };
}

export const helpCategories: HelpCategory[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    shortTitle: "Start",
    description: "Choose the right Blueprint path before a team opens a request, package, or hosted evaluation.",
    audience: "New buyers, operators, and capturers",
    iconKey: "rocket",
    primaryActionHref: "/contact?persona=robot-team",
    primaryActionLabel: "Open buyer contact",
    articles: [
      "what-blueprint-sells",
      "choose-the-right-path",
      "structured-intake-before-calendar",
      "create-or-access-workspace",
      "support-response-times",
    ],
  },
  {
    slug: "world-model-packages",
    title: "World Model Packages",
    shortTitle: "Packages",
    description: "Understand exact-site packages, included artifacts, licensing, and how package proof should be read.",
    audience: "Robot teams and technical evaluators",
    iconKey: "package",
    primaryActionHref: "/world-models",
    primaryActionLabel: "Browse world models",
    articles: [
      "what-is-a-site-world-package",
      "what-a-package-includes",
      "read-package-provenance",
      "package-vs-hosted-evaluation",
      "request-a-new-site",
      "export-and-integration-basics",
    ],
  },
  {
    slug: "hosted-evaluation",
    title: "Hosted Evaluation",
    shortTitle: "Hosted",
    description: "Start, inspect, share, and troubleshoot hosted sessions without separating runtime behavior from capture evidence.",
    audience: "Deployment, autonomy, and QA leads",
    iconKey: "play",
    primaryActionHref: "/exact-site-hosted-review",
    primaryActionLabel: "Review hosted evaluation",
    articles: [
      "start-a-hosted-evaluation",
      "session-access-and-permissions",
      "read-the-evidence-panel",
      "share-hosted-results",
      "report-a-runtime-issue",
      "book-a-scoping-call",
    ],
  },
  {
    slug: "capture-provenance",
    title: "Capture Provenance",
    shortTitle: "Provenance",
    description: "Rules for lawful capture, privacy, operator context, and what counts as evidence inside Blueprint.",
    audience: "Capturers, site operators, and buyers",
    iconKey: "shield",
    primaryActionHref: "/capture",
    primaryActionLabel: "Read capture rules",
    articles: [
      "capture-rules-overview",
      "public-facing-location-capture",
      "rights-privacy-and-consent",
      "capture-quality-review",
      "site-operator-permission",
      "capturer-submission-status",
    ],
  },
  {
    slug: "billing-and-access",
    title: "Billing And Access",
    shortTitle: "Billing",
    description: "Access, seats, licensing, checkout, invoices, and procurement paths for buyer teams.",
    audience: "Commercial owners and workspace admins",
    iconKey: "credit",
    primaryActionHref: "/pricing",
    primaryActionLabel: "See pricing",
    articles: [
      "pricing-basics",
      "checkout-and-invoices",
      "seat-and-workspace-access",
      "license-scope-basics",
      "purchase-orders-and-procurement",
      "cancellations-and-changes",
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    shortTitle: "Fixes",
    description: "Resolve access, browser, package, and support-routing issues while preserving the evidence trail.",
    audience: "Any Blueprint user",
    iconKey: "tool",
    primaryActionHref: "/help/contact",
    primaryActionLabel: "Contact support",
    articles: [
      "sign-in-troubleshooting",
      "missing-package-access",
      "hosted-session-not-loading",
      "broken-link-or-page",
      "what-to-send-support",
      "urgent-review-escalations",
    ],
  },
];

export const helpArticles: HelpArticle[] = [
  article({
    slug: "what-blueprint-sells",
    categorySlug: "getting-started",
    title: "What Blueprint sells",
    description: "The short version of Blueprint's product surface.",
    summary: "Blueprint sells site-specific world-model packages, hosted access, and supporting review outputs tied to real capture provenance.",
    readTime: "3 min",
    sections: [
      {
        heading: "Start with the site",
        body: "Blueprint is capture-first and world-model-product-first. The product begins with real capture evidence and turns that evidence into exact-site packages and hosted evaluation paths.",
      },
      {
        heading: "What is primary",
        body: "The primary buyer output is the site-specific package or hosted session. Readiness, qualification, and review outputs help teams decide, but they do not replace the capture record.",
        bullets: ["World model package", "Hosted evaluation", "Capture provenance", "Rights, privacy, and access context"],
      },
    ],
    relatedArticleSlugs: ["choose-the-right-path", "what-is-a-site-world-package", "package-vs-hosted-evaluation"],
  }),
  article({
    slug: "choose-the-right-path",
    categorySlug: "getting-started",
    title: "Choose the right support path",
    description: "Where to go when you need a package, hosted review, capture access, or human reply.",
    summary: "Use buyer contact for a known site, hosted evaluation for an existing package, capture access for capturer questions, and support for access or evidence issues.",
    readTime: "3 min",
    sections: [
      {
        heading: "If you are buying",
        body: "Use the buyer contact path when your team knows the site, robot, workflow, or deployment question. Blueprint will route the request before asking for a calendar slot.",
      },
      {
        heading: "If you are evaluating",
        body: "Open the hosted evaluation path when a package exists and the next question is whether the evidence, routes, and runtime view answer your deployment question.",
      },
      {
        heading: "If you are capturing",
        body: "Use the capture path only for lawful public-facing routes and markets where Blueprint is accepting or reviewing capture coverage.",
      },
    ],
    relatedArticleSlugs: ["structured-intake-before-calendar", "request-a-new-site", "capturer-submission-status"],
  }),
  article({
    slug: "structured-intake-before-calendar",
    categorySlug: "getting-started",
    title: "Why Blueprint asks for structured intake before a calendar",
    description: "How routing works before a sales or scoping call.",
    summary: "Blueprint collects role, site, robot, workflow, and evidence needs first so a human call starts with the right context.",
    readTime: "3 min",
    sections: [
      {
        heading: "Routing comes first",
        body: "Blueprint support starts with structured intake because the next step depends on whether you need buyer access, package review, hosted evaluation, operator permissioning, or capture help.",
      },
      {
        heading: "Calendar second",
        body: "A call is useful when the request is specific enough to scope. If the request is still broad, the first reply may ask for the missing site, robot, access, or provenance detail.",
      },
    ],
    relatedArticleSlugs: ["choose-the-right-path", "book-a-scoping-call", "what-to-send-support"],
  }),
  article({
    slug: "create-or-access-workspace",
    categorySlug: "getting-started",
    title: "Create or access a Blueprint workspace",
    description: "How buyer and internal workspaces are opened.",
    summary: "Workspace access is invite or request based. It is attached to organization, package, request, or hosted-review context.",
    readTime: "2 min",
    sections: [
      {
        heading: "Buyer workspaces",
        body: "Buyer access is opened after Blueprint can identify the organization, site request, package, or hosted review that the workspace should contain.",
      },
      {
        heading: "If you cannot sign in",
        body: "Do not create duplicate accounts as a workaround. Contact support from the work email that should receive access and include the package or request link.",
      },
    ],
    relatedArticleSlugs: ["seat-and-workspace-access", "sign-in-troubleshooting", "missing-package-access"],
  }),
  article({
    slug: "support-response-times",
    categorySlug: "getting-started",
    title: "Support response times",
    description: "What to expect after contacting Blueprint.",
    summary: "Blueprint prioritizes support based on buyer access, active hosted evaluations, package blockers, and human-gated review needs.",
    readTime: "2 min",
    sections: [
      {
        heading: "What gets routed fastest",
        body: "Active hosted-evaluation access blockers, package access issues, and buyer questions tied to a live deal or review path are routed first.",
      },
      {
        heading: "What helps",
        body: "Send the page URL, organization, package or request id if known, expected outcome, and the exact blocker. This keeps the reply narrow.",
      },
    ],
    relatedArticleSlugs: ["what-to-send-support", "urgent-review-escalations", "report-a-runtime-issue"],
  }),

  article({
    slug: "what-is-a-site-world-package",
    categorySlug: "world-model-packages",
    title: "What is a site-specific world-model package?",
    description: "The package concept in plain language.",
    summary: "A package is a structured output derived from one real site, its capture evidence, and the rights and access context attached to that evidence.",
    readTime: "3 min",
    sections: [
      {
        heading: "Exact site, not generic scene",
        body: "Blueprint packages are meant to answer questions about a specific real place. They should not be treated as generic training data or proof for unrelated locations.",
      },
      {
        heading: "Evidence stays attached",
        body: "The package should keep capture provenance, timestamps, routes, device context, rights, and privacy labels visible enough for a buyer to inspect the basis of the output.",
      },
    ],
    relatedArticleSlugs: ["what-a-package-includes", "read-package-provenance", "license-scope-basics"],
  }),
  article({
    slug: "what-a-package-includes",
    categorySlug: "world-model-packages",
    title: "What a package can include",
    description: "Common deliverables and supporting files.",
    summary: "Package contents vary by site and scope, but usually center on the site model, capture record, route context, metadata, and access instructions.",
    readTime: "4 min",
    sections: [
      {
        heading: "Common package materials",
        body: "A package may include site model assets, route context, sample observations, manifests, metadata, hosted-session links, and notes about access or restrictions.",
      },
      {
        heading: "What is not implied",
        body: "A package listing does not automatically mean a site is cleared for every commercial use, every robot, or live deployment. Check the license and provenance details.",
      },
    ],
    relatedArticleSlugs: ["read-package-provenance", "package-vs-hosted-evaluation", "export-and-integration-basics"],
  }),
  article({
    slug: "read-package-provenance",
    categorySlug: "world-model-packages",
    title: "How to read package provenance",
    description: "What the evidence labels mean.",
    summary: "Provenance labels tell you what was captured, when, where possible, by what route or device, and under which review or access boundaries.",
    readTime: "4 min",
    sections: [
      {
        heading: "Start with source evidence",
        body: "Look for capture dates, route notes, device or modality context, operator notes, and any privacy or rights labels. Those fields tell you how much trust to place in the output.",
      },
      {
        heading: "Generated outputs are labeled",
        body: "If a downstream output is simulated, generated, or derived, treat it as a support artifact. It should not overwrite the underlying capture truth.",
      },
    ],
    relatedArticleSlugs: ["rights-privacy-and-consent", "capture-quality-review", "read-the-evidence-panel"],
  }),
  article({
    slug: "package-vs-hosted-evaluation",
    categorySlug: "world-model-packages",
    title: "Package access vs hosted evaluation",
    description: "When to use each buyer path.",
    summary: "Package access is for inspecting and using deliverables. Hosted evaluation is for reviewing the site through a managed runtime and evidence view.",
    readTime: "3 min",
    sections: [
      {
        heading: "Use package access when",
        body: "Your team needs files, manifests, metadata, or a licensing conversation around a specific site output.",
      },
      {
        heading: "Use hosted evaluation when",
        body: "Your team needs to inspect the site, routes, runtime behavior, or review evidence before deployment, travel, or integration spend.",
      },
    ],
    relatedArticleSlugs: ["start-a-hosted-evaluation", "what-a-package-includes", "license-scope-basics"],
  }),
  article({
    slug: "request-a-new-site",
    categorySlug: "world-model-packages",
    title: "Request a new site",
    description: "How to ask Blueprint for coverage that is not listed.",
    summary: "Send the site type, city or region, robot workflow, buyer reason, and any access constraints so Blueprint can route capture or partner review.",
    readTime: "3 min",
    sections: [
      {
        heading: "What to include",
        body: "A useful request names the site or site type, the geography, the robot task, what answer you need, and whether you have operator access or need Blueprint to source coverage.",
      },
      {
        heading: "No fake readiness",
        body: "A new-site request is not a promise that coverage, rights, hosted access, or a package already exists. Blueprint will route the request based on real availability.",
      },
    ],
    relatedArticleSlugs: ["structured-intake-before-calendar", "site-operator-permission", "capture-rules-overview"],
  }),
  article({
    slug: "export-and-integration-basics",
    categorySlug: "world-model-packages",
    title: "Export and integration basics",
    description: "How to think about integration scope.",
    summary: "Exports depend on the package, license, and technical scope. Ask for the target runtime, format, and integration constraints up front.",
    readTime: "3 min",
    sections: [
      {
        heading: "Export scope varies",
        body: "Blueprint may expose manifests, media, model assets, route files, or hosted links depending on the package and license scope.",
      },
      {
        heading: "Integration questions",
        body: "When asking for integration support, include the robot stack, file format needs, simulator/runtime target, and whether you need offline assets or hosted review only.",
      },
    ],
    relatedArticleSlugs: ["what-a-package-includes", "license-scope-basics", "what-to-send-support"],
  }),

  article({
    slug: "start-a-hosted-evaluation",
    categorySlug: "hosted-evaluation",
    title: "Start a hosted evaluation",
    description: "How to begin a hosted exact-site review.",
    summary: "Open the hosted evaluation path from a site or package page, then follow the access, evidence, and runtime readiness prompts.",
    readTime: "3 min",
    sections: [
      {
        heading: "From a site page",
        body: "When a site supports hosted evaluation, the page should route you to the hosted setup flow. If access is missing, request access instead of bypassing the gate.",
      },
      {
        heading: "Before the session",
        body: "Confirm the package, site, intended robot workflow, and the evaluation question. Hosted review works best when the team is testing one concrete deployment concern.",
      },
    ],
    relatedArticleSlugs: ["session-access-and-permissions", "read-the-evidence-panel", "report-a-runtime-issue"],
  }),
  article({
    slug: "session-access-and-permissions",
    categorySlug: "hosted-evaluation",
    title: "Session access and permissions",
    description: "Who can open or share hosted sessions.",
    summary: "Hosted sessions are tied to package access, organization context, and any rights or privacy restrictions attached to the site.",
    readTime: "3 min",
    sections: [
      {
        heading: "Access is scoped",
        body: "A hosted-session link should be treated as scoped access to a specific site context. Do not forward it as if it were public unless Blueprint labels it public.",
      },
      {
        heading: "When access fails",
        body: "Send support the session URL, workspace email, organization, package name, and what you expected to see.",
      },
    ],
    relatedArticleSlugs: ["missing-package-access", "share-hosted-results", "license-scope-basics"],
  }),
  article({
    slug: "read-the-evidence-panel",
    categorySlug: "hosted-evaluation",
    title: "Read the evidence panel",
    description: "How hosted review ties runtime views back to proof.",
    summary: "The evidence panel helps you distinguish raw capture, package metadata, generated or derived views, and runtime diagnostics.",
    readTime: "4 min",
    sections: [
      {
        heading: "Evidence before opinion",
        body: "Use the evidence panel to inspect what the system is showing, what source artifact it came from, and whether any runtime issue or package mismatch is present.",
      },
      {
        heading: "Derived views",
        body: "If a view is generated, derived, or diagnostic, treat it as supporting context. The capture and package artifacts remain the source of truth.",
      },
    ],
    relatedArticleSlugs: ["read-package-provenance", "report-a-runtime-issue", "hosted-session-not-loading"],
  }),
  article({
    slug: "share-hosted-results",
    categorySlug: "hosted-evaluation",
    title: "Share hosted results",
    description: "What to share with teammates or Blueprint support.",
    summary: "Share the session link, screenshot, package id, and the deployment question rather than a detached opinion about whether the site is ready.",
    readTime: "2 min",
    sections: [
      {
        heading: "Useful context",
        body: "A helpful share includes the session URL, site name, package id if visible, the observed issue or evidence, and the decision your team is trying to make.",
      },
      {
        heading: "Keep labels intact",
        body: "Do not strip capture, rights, or derived-output labels from screenshots when the recipient needs to judge evidence quality.",
      },
    ],
    relatedArticleSlugs: ["read-the-evidence-panel", "what-to-send-support", "license-scope-basics"],
  }),
  article({
    slug: "report-a-runtime-issue",
    categorySlug: "hosted-evaluation",
    title: "Report a hosted runtime issue",
    description: "What to send if the hosted view behaves incorrectly.",
    summary: "Send the session URL, time, browser, action taken, visible diagnostic, and whether the package evidence itself was still available.",
    readTime: "3 min",
    sections: [
      {
        heading: "Report the exact state",
        body: "Runtime issues are easiest to debug when support can separate browser problems, package access problems, runtime startup issues, and evidence mismatch.",
      },
      {
        heading: "Include",
        body: "Include the session URL, package or site id, timestamp, browser, screenshot if possible, and the exact control or view that failed.",
      },
    ],
    relatedArticleSlugs: ["hosted-session-not-loading", "read-the-evidence-panel", "urgent-review-escalations"],
  }),
  article({
    slug: "book-a-scoping-call",
    categorySlug: "hosted-evaluation",
    title: "Book a scoping call",
    description: "When a human scoping call is useful.",
    summary: "Book a call when the site, workflow, buyer role, and evaluation question are known enough for Blueprint to scope the next package or hosted-review path.",
    readTime: "2 min",
    sections: [
      {
        heading: "Good reasons to book",
        body: "A call is useful for a known site, custom package scope, licensing question, or live buyer evaluation where asynchronous support would be too slow.",
      },
      {
        heading: "Before booking",
        body: "Send the site, robot workflow, organization, desired outcome, and any timing pressure so the call can stay focused.",
      },
    ],
    relatedArticleSlugs: ["structured-intake-before-calendar", "package-vs-hosted-evaluation", "pricing-basics"],
  }),

  article({
    slug: "capture-rules-overview",
    categorySlug: "capture-provenance",
    title: "Capture rules overview",
    description: "The baseline rules for capture submissions.",
    summary: "Capture should be lawful, public-facing where applicable, privacy-aware, and useful for downstream site-specific package review.",
    readTime: "3 min",
    sections: [
      {
        heading: "Capture truth matters",
        body: "Raw capture, timestamps, routes, device metadata, and rights context are the foundation of the product. Do not alter or describe captures in a way that changes their provenance.",
      },
      {
        heading: "Stay inside rules",
        body: "Do not capture restricted areas, private interiors without permission, sensitive personal information, or locations where capture is prohibited.",
      },
    ],
    relatedArticleSlugs: ["public-facing-location-capture", "rights-privacy-and-consent", "capture-quality-review"],
  }),
  article({
    slug: "public-facing-location-capture",
    categorySlug: "capture-provenance",
    title: "Public-facing location capture",
    description: "How Blueprint treats everyday public-facing sites.",
    summary: "Many useful captures can come from lawful public-facing customer areas, but review still checks privacy, usefulness, and downstream rights.",
    readTime: "3 min",
    sections: [
      {
        heading: "Public-facing does not mean unrestricted",
        body: "A public customer area may be lawful to observe, but capturers still need to avoid restricted zones, private information, and anything the site prohibits.",
      },
      {
        heading: "Review still applies",
        body: "Blueprint review determines whether a capture is useful and whether any rights, privacy, or commercialization limits should apply.",
      },
    ],
    relatedArticleSlugs: ["capture-rules-overview", "rights-privacy-and-consent", "site-operator-permission"],
  }),
  article({
    slug: "rights-privacy-and-consent",
    categorySlug: "capture-provenance",
    title: "Rights, privacy, and consent",
    description: "How support thinks about capture permissions.",
    summary: "Rights and privacy labels are product-critical. If those labels are missing or ambiguous, support will route review before commercial use.",
    readTime: "4 min",
    sections: [
      {
        heading: "Rights labels matter",
        body: "Commercial availability depends on the capture context, site context, privacy constraints, and any operator or contributor agreements.",
      },
      {
        heading: "Ambiguity is a blocker",
        body: "If rights or privacy status is unclear, support should not describe the package as commercially ready. The issue needs review before buyer commitments.",
      },
    ],
    relatedArticleSlugs: ["read-package-provenance", "license-scope-basics", "site-operator-permission"],
  }),
  article({
    slug: "capture-quality-review",
    categorySlug: "capture-provenance",
    title: "Capture quality review",
    description: "What Blueprint checks before a capture supports a package.",
    summary: "Review looks for coverage, motion quality, visual clarity, route usefulness, privacy concerns, and whether the capture can support a downstream package.",
    readTime: "3 min",
    sections: [
      {
        heading: "What gets checked",
        body: "Blueprint reviews whether the capture is stable, relevant to a real workflow, sufficiently covered, and free from obvious privacy or restricted-zone issues.",
      },
      {
        heading: "Quality is not buyer readiness",
        body: "A good capture can still need package processing, rights review, or hosted setup before it becomes a buyer-facing product.",
      },
    ],
    relatedArticleSlugs: ["capturer-submission-status", "what-a-package-includes", "rights-privacy-and-consent"],
  }),
  article({
    slug: "site-operator-permission",
    categorySlug: "capture-provenance",
    title: "When site-operator permission matters",
    description: "How operator involvement fits into Blueprint.",
    summary: "Site-operator permission is a supported path for access, rights, and commercialization, but not every lawful public-facing capture begins with operator intake.",
    readTime: "3 min",
    sections: [
      {
        heading: "Operator involvement can help",
        body: "An operator can clarify access, privacy, allowed capture areas, commercialization, and whether a buyer workflow should be restricted.",
      },
      {
        heading: "Not always the first step",
        body: "Blueprint can support lawful capture paths that do not start with formal operator qualification, while still applying rights and privacy review before buyer claims.",
      },
    ],
    relatedArticleSlugs: ["public-facing-location-capture", "rights-privacy-and-consent", "request-a-new-site"],
  }),
  article({
    slug: "capturer-submission-status",
    categorySlug: "capture-provenance",
    title: "Capturer submission status",
    description: "What happens after a capturer submits.",
    summary: "Submission is review-gated. It does not automatically mean package creation, buyer readiness, approval, or payout eligibility.",
    readTime: "2 min",
    sections: [
      {
        heading: "Review steps",
        body: "Blueprint may review upload health, market fit, capture quality, privacy, rights context, and usefulness before deciding whether a submission can move forward.",
      },
      {
        heading: "Support context",
        body: "When asking about a submission, include the submission id, city, capture route, app version, and upload time if available.",
      },
    ],
    relatedArticleSlugs: ["capture-quality-review", "capture-rules-overview", "what-to-send-support"],
  }),

  article({
    slug: "pricing-basics",
    categorySlug: "billing-and-access",
    title: "Pricing basics",
    description: "How to approach package and hosted-review pricing.",
    summary: "Pricing depends on package scope, hosted access, licensing, integration support, and whether the request needs custom review.",
    readTime: "3 min",
    sections: [
      {
        heading: "Scope drives price",
        body: "Exact-site access, package rights, hosted evaluation, export needs, and managed support all affect price. Use the pricing page for the current public offer shape.",
      },
      {
        heading: "Ask with context",
        body: "For a quote, include the site, package or request link, robot workflow, team size, desired license scope, and deadline.",
      },
    ],
    relatedArticleSlugs: ["license-scope-basics", "checkout-and-invoices", "book-a-scoping-call"],
  }),
  article({
    slug: "checkout-and-invoices",
    categorySlug: "billing-and-access",
    title: "Checkout and invoices",
    description: "How billing support handles payments and receipts.",
    summary: "Blueprint uses Stripe-backed checkout and billing paths where enabled. Invoice or procurement requests should include organization and package context.",
    readTime: "2 min",
    sections: [
      {
        heading: "Checkout",
        body: "If checkout is enabled for your offer, complete it from the Blueprint flow rather than a copied link. This keeps access tied to the correct package or request.",
      },
      {
        heading: "Invoices",
        body: "For invoice help, send organization name, billing email, package or offer, and any tax or procurement details support should know.",
      },
    ],
    relatedArticleSlugs: ["pricing-basics", "purchase-orders-and-procurement", "seat-and-workspace-access"],
  }),
  article({
    slug: "seat-and-workspace-access",
    categorySlug: "billing-and-access",
    title: "Seat and workspace access",
    description: "How workspace access is assigned.",
    summary: "Seats and workspace access should match organization, package, hosted evaluation, and license scope.",
    readTime: "3 min",
    sections: [
      {
        heading: "Access follows the work",
        body: "A user should receive access to the workspace, request, package, or hosted session needed for their role. Support may ask for organization and domain confirmation.",
      },
      {
        heading: "Adding teammates",
        body: "Send support the teammate email, organization, role, and which package or hosted session they need to inspect.",
      },
    ],
    relatedArticleSlugs: ["create-or-access-workspace", "missing-package-access", "license-scope-basics"],
  }),
  article({
    slug: "license-scope-basics",
    categorySlug: "billing-and-access",
    title: "License scope basics",
    description: "What license scope can cover.",
    summary: "License scope determines how a team can use a package, hosted review, exports, and supporting evidence.",
    readTime: "4 min",
    sections: [
      {
        heading: "Check the scope",
        body: "Do not assume every package allows every internal, external, commercial, training, or redistribution use. License details should state the allowed use.",
      },
      {
        heading: "When to ask",
        body: "Ask support before using package outputs in a new robot workflow, public artifact, partner handoff, or downstream dataset process not covered by the original scope.",
      },
    ],
    relatedArticleSlugs: ["rights-privacy-and-consent", "what-is-a-site-world-package", "pricing-basics"],
  }),
  article({
    slug: "purchase-orders-and-procurement",
    categorySlug: "billing-and-access",
    title: "Purchase orders and procurement",
    description: "How to route commercial paperwork.",
    summary: "Procurement support needs organization, buyer owner, package or scope, billing contact, and timing.",
    readTime: "2 min",
    sections: [
      {
        heading: "Send the basics",
        body: "Include organization name, billing contact, procurement owner, package or custom scope, required vendor forms, and timeline.",
      },
      {
        heading: "Do not detach the scope",
        body: "Procurement support should stay tied to the same package, hosted review, or site request so commercial terms match the product being delivered.",
      },
    ],
    relatedArticleSlugs: ["pricing-basics", "checkout-and-invoices", "book-a-scoping-call"],
  }),
  article({
    slug: "cancellations-and-changes",
    categorySlug: "billing-and-access",
    title: "Cancellations and changes",
    description: "How to request billing or scope changes.",
    summary: "Send the original purchase or scope, the requested change, timing, and whether access should remain active during review.",
    readTime: "2 min",
    sections: [
      {
        heading: "Requesting a change",
        body: "Support needs the organization, package or request link, billing contact, original scope, and the exact change being requested.",
      },
      {
        heading: "Access during review",
        body: "If access should stay active or be paused while support reviews the change, say that explicitly.",
      },
    ],
    relatedArticleSlugs: ["checkout-and-invoices", "seat-and-workspace-access", "what-to-send-support"],
  }),

  article({
    slug: "sign-in-troubleshooting",
    categorySlug: "troubleshooting",
    title: "Sign-in troubleshooting",
    description: "What to do when account access fails.",
    summary: "Use the same work email, avoid duplicate accounts, and send support the route, email, and expected workspace.",
    readTime: "2 min",
    sections: [
      {
        heading: "Try first",
        body: "Confirm you are using the intended work email, reset password if needed, and open the current Blueprint domain rather than an old copied link.",
      },
      {
        heading: "Contact support",
        body: "Send your work email, organization, expected workspace or package, error text, and the page URL.",
      },
    ],
    relatedArticleSlugs: ["create-or-access-workspace", "seat-and-workspace-access", "missing-package-access"],
  }),
  article({
    slug: "missing-package-access",
    categorySlug: "troubleshooting",
    title: "Missing package access",
    description: "What to do when a package or hosted link is unavailable.",
    summary: "Send the package link, organization, account email, and expected access reason. Support will verify entitlement and route scope.",
    readTime: "3 min",
    sections: [
      {
        heading: "Common causes",
        body: "Access can be missing because the wrong email is signed in, the package is not included in scope, the workspace is pending review, or the hosted path needs setup.",
      },
      {
        heading: "What to send",
        body: "Send the package URL, account email, organization, who granted access, and whether file access, hosted access, or both are missing.",
      },
    ],
    relatedArticleSlugs: ["session-access-and-permissions", "seat-and-workspace-access", "license-scope-basics"],
  }),
  article({
    slug: "hosted-session-not-loading",
    categorySlug: "troubleshooting",
    title: "Hosted session is not loading",
    description: "How to separate browser, access, and runtime issues.",
    summary: "Refresh once, check sign-in, then send support the session URL, browser, screenshot, visible diagnostic, and action taken.",
    readTime: "3 min",
    sections: [
      {
        heading: "Quick checks",
        body: "Confirm you are signed in with the right account, reload once, try a current browser, and check whether the evidence panel or package link still opens.",
      },
      {
        heading: "Escalate with details",
        body: "Send the hosted session URL, site/package name, browser, timestamp, screenshot, and whether the failure happened before or after the runtime view started.",
      },
    ],
    relatedArticleSlugs: ["report-a-runtime-issue", "read-the-evidence-panel", "missing-package-access"],
  }),
  article({
    slug: "broken-link-or-page",
    categorySlug: "troubleshooting",
    title: "Broken link or page",
    description: "How to report a public-site or workspace route issue.",
    summary: "Send the URL, referring page, expected destination, and whether this blocked buyer access, capture access, or hosted evaluation.",
    readTime: "2 min",
    sections: [
      {
        heading: "What matters",
        body: "A broken public route has different urgency than a broken paid access or hosted-evaluation route. Tell support what the route was supposed to unlock.",
      },
      {
        heading: "Helpful details",
        body: "Include the URL, previous page, browser, account email if signed in, and a screenshot of the error.",
      },
    ],
    relatedArticleSlugs: ["what-to-send-support", "sign-in-troubleshooting", "urgent-review-escalations"],
  }),
  article({
    slug: "what-to-send-support",
    categorySlug: "troubleshooting",
    title: "What to send support",
    description: "The minimum packet that gets a useful reply.",
    summary: "Send who you are, the URL, organization, package or request id, expected outcome, actual blocker, and urgency.",
    readTime: "2 min",
    sections: [
      {
        heading: "Minimum packet",
        body: "A useful support request includes your name, work email, organization, page URL, package or request id if known, expected outcome, actual blocker, and deadline.",
      },
      {
        heading: "For evidence issues",
        body: "Include screenshots with labels visible, the capture or package field in question, and why the evidence matters to the buyer decision.",
      },
    ],
    relatedArticleSlugs: ["support-response-times", "report-a-runtime-issue", "missing-package-access"],
  }),
  article({
    slug: "urgent-review-escalations",
    categorySlug: "troubleshooting",
    title: "Urgent review escalations",
    description: "When a support request should be treated as urgent.",
    summary: "Escalate when an active buyer evaluation, access blocker, rights concern, or hosted runtime issue is blocking a time-sensitive decision.",
    readTime: "2 min",
    sections: [
      {
        heading: "Urgent examples",
        body: "Urgent review is appropriate for active buyer access blockers, live hosted-evaluation failures, rights/privacy ambiguity in a buyer handoff, or a package issue blocking a scheduled review.",
      },
      {
        heading: "Say why",
        body: "State the deadline, affected buyer or team, blocked decision, and the exact evidence or access issue. Support cannot infer urgency from a vague message.",
      },
    ],
    relatedArticleSlugs: ["what-to-send-support", "rights-privacy-and-consent", "report-a-runtime-issue"],
  }),
];

export const featuredArticleSlugs = [
  "choose-the-right-path",
  "package-vs-hosted-evaluation",
  "read-package-provenance",
  "report-a-runtime-issue",
  "what-to-send-support",
];

export function getHelpCategory(slug: string | undefined) {
  return helpCategories.find((category) => category.slug === slug) || null;
}

export function getHelpArticle(slug: string | undefined) {
  return helpArticles.find((articleItem) => articleItem.slug === slug) || null;
}

export function getArticlesForCategory(categorySlug: string) {
  return helpArticles.filter((articleItem) => articleItem.categorySlug === categorySlug);
}

export function getHelpCategoryForArticle(articleItem: HelpArticle | null) {
  if (!articleItem) return null;
  return getHelpCategory(articleItem.categorySlug);
}

export function getFeaturedArticles() {
  return featuredArticleSlugs
    .map((slug) => getHelpArticle(slug))
    .filter((articleItem): articleItem is HelpArticle => Boolean(articleItem));
}

