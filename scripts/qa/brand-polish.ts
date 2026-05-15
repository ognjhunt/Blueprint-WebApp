export type QaViewport = {
  name: "desktop" | "mobile";
  width: number;
  height: number;
};

export type RequiredCta = {
  label: string;
  hrefStartsWith: string;
};

export type PublicLaunchPosturePattern = {
  label: string;
  pattern: string;
  flags: string;
  guidance: string;
};

export type PublicQaRoute = {
  label: string;
  path: string;
  canonicalPath: string;
  expectedHeading: string;
  requiredCtas: RequiredCta[];
};

export type QaCheckResult = {
  name: string;
  status: "pass" | "fail";
  detail: string;
};

export type QaRouteResult = {
  routeLabel: string;
  routePath: string;
  viewportName: string;
  screenshotPath: string;
  status: "pass" | "fail";
  checks: QaCheckResult[];
};

export type QaLinkResult = {
  href: string;
  status: "pass" | "fail";
  httpStatus: number | null;
  sourceRoutes: string[];
};

export const qaOutputRoot = "output/qa/brand-polish/latest";

export const qaViewports: QaViewport[] = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

export const publicLaunchPosturePatterns: PublicLaunchPosturePattern[] = [
  {
    label: "not launched",
    pattern: "\\bnot launched(?: yet)?\\b",
    flags: "i",
    guidance: "Use request/access review language instead of broad launch-status apology copy.",
  },
  {
    label: "coming soon",
    pattern: "\\bcoming soon\\b",
    flags: "i",
    guidance: "Route users to the request path that exists today.",
  },
  {
    label: "not ready",
    pattern: "\\bnot ready\\b",
    flags: "i",
    guidance: "Qualify the exact missing fact instead of weakening the whole service posture.",
  },
  {
    label: "still building",
    pattern: "\\bwe (?:are|'re) still building\\b|\\bstill being built\\b",
    flags: "i",
    guidance: "Public routes should read like a live service with request review gates.",
  },
  {
    label: "future service",
    pattern: "\\bfuture service\\b",
    flags: "i",
    guidance: "Describe the present service and route request-specific proof checks into details.",
  },
  {
    label: "placeholder",
    pattern: "\\bplaceholder\\b",
    flags: "i",
    guidance: "Use sample, representative, planned, or request-gated labels instead.",
  },
  {
    label: "demo only",
    pattern: "\\bdemo only\\b|\\bonly a demo\\b",
    flags: "i",
    guidance: "Use labeled sample language in proof/detail areas.",
  },
  {
    label: "operationally not ready",
    pattern: "\\boperationally not ready\\b",
    flags: "i",
    guidance: "Separate Public Launch Ready from Operational Launch Ready.",
  },
  {
    label: "backend incomplete",
    pattern: "\\bbackend (?:is )?(?:incomplete|missing|not ready)\\b|\\bunavailable because (?:the )?(?:backend|payment|provider|city|payout|ops)",
    flags: "i",
    guidance: "Do not expose internal lane incompleteness as first-screen public posture.",
  },
  {
    label: "cannot claim this yet",
    pattern: "\\b(?:we\\s+)?(?:can(?:not|'t)|cannot) claim (?:this|that|it) yet\\b",
    flags: "i",
    guidance: "Block or qualify the specific unsupported claim only.",
  },
  {
    label: "not live yet",
    pattern: "\\bnot live yet\\b",
    flags: "i",
    guidance: "Use availability-confirmed-per-request language.",
  },
  {
    label: "not production ready",
    pattern: "\\bnot production[- ]ready\\b",
    flags: "i",
    guidance: "Name the exact unsupported production claim instead.",
  },
  {
    label: "prelaunch",
    pattern: "\\bpre[- ]launch\\b",
    flags: "i",
    guidance: "Use Public Launch Ready posture on public routes.",
  },
];

export const publicQaRoutes: PublicQaRoute[] = [
  {
    label: "Home",
    path: "/",
    canonicalPath: "/",
    expectedHeading: "Site-specific world models from real capture.",
    requiredCtas: [
      { label: "Request world model", hrefStartsWith: "/contact" },
      { label: "Browse world models", hrefStartsWith: "/world-models" },
    ],
  },
  {
    label: "Product",
    path: "/product",
    canonicalPath: "/product",
    expectedHeading: "Turn the exact site into a decision-ready world model.",
    requiredCtas: [
      { label: "Request hosted review", hrefStartsWith: "/contact" },
      { label: "Inspect proof", hrefStartsWith: "/proof" },
    ],
  },
  {
    label: "World models",
    path: "/world-models",
    canonicalPath: "/world-models",
    expectedHeading: "Browse exact-site world models.",
    requiredCtas: [
      { label: "Request world model", hrefStartsWith: "/contact" },
      { label: "Jump to catalog", hrefStartsWith: "#catalog" },
    ],
  },
  {
    label: "Pricing",
    path: "/pricing",
    canonicalPath: "/pricing",
    expectedHeading: "Choose the first step for one real site.",
    requiredCtas: [
      { label: "Request world model", hrefStartsWith: "/contact" },
      { label: "Request hosted review", hrefStartsWith: "/contact" },
    ],
  },
  {
    label: "Proof",
    path: "/proof",
    canonicalPath: "/proof",
    expectedHeading: "See what is attached before your team commits.",
    requiredCtas: [
      { label: "Request world model", hrefStartsWith: "/contact" },
      { label: "Browse world models", hrefStartsWith: "/world-models" },
    ],
  },
  {
    label: "Capture",
    path: "/capture",
    canonicalPath: "/capture",
    expectedHeading: "Get paid to capture real places robots need to understand.",
    requiredCtas: [
      { label: "Check capture access", hrefStartsWith: "/capture-app/launch-access" },
      { label: "Apply to capture", hrefStartsWith: "/signup/capturer" },
    ],
  },
  {
    label: "Contact",
    path: "/contact",
    canonicalPath: "/contact",
    expectedHeading: "Request the site-specific world model your robot team needs.",
    requiredCtas: [
      { label: "Request world model", hrefStartsWith: "#contact-intake" },
      { label: "Inspect proof", hrefStartsWith: "/proof" },
    ],
  },
  {
    label: "Careers",
    path: "/careers",
    canonicalPath: "/careers",
    expectedHeading: "Build the systems behind exact-site world models.",
    requiredCtas: [
      { label: "View open roles", hrefStartsWith: "#open-roles" },
      { label: "Apply by email", hrefStartsWith: "mailto:" },
    ],
  },
  {
    label: "FAQ",
    path: "/faq",
    canonicalPath: "/faq",
    expectedHeading: "The questions that usually decide fit.",
    requiredCtas: [
      { label: "Talk to Blueprint about a real site", hrefStartsWith: "/contact" },
    ],
  },
  {
    label: "About",
    path: "/about",
    canonicalPath: "/about",
    expectedHeading: "Blueprint exists to make one real site legible earlier.",
    requiredCtas: [
      { label: "Explore world models", hrefStartsWith: "/world-models" },
      { label: "Contact Blueprint", hrefStartsWith: "/contact" },
    ],
  },
  {
    label: "Updates",
    path: "/updates",
    canonicalPath: "/updates",
    expectedHeading: "Notes on exact-site world models.",
    requiredCtas: [
      { label: "Explore world models", hrefStartsWith: "/world-models" },
      { label: "See proof", hrefStartsWith: "/proof" },
    ],
  },
];

export function artifactSlugForRoute(routePath: string, viewportName: string): string {
  const routeSlug = routePath === "/"
    ? "home"
    : routePath
      .replace(/^\//, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  return `${routeSlug}-${viewportName}`;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function collectPublicLaunchPostureHits(text: string): string[] {
  return publicLaunchPosturePatterns
    .filter((entry) => new RegExp(entry.pattern, entry.flags).test(text))
    .map((entry) => entry.label);
}

export function normalizeCheckableInternalHref(href: string, baseUrl: string): string | null {
  if (!href) return null;

  const trimmed = href.trim();
  if (
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }

  const base = new URL(baseUrl);
  const target = new URL(trimmed, base);

  if (target.origin !== base.origin) {
    return null;
  }

  return `${target.pathname}${target.search}`;
}

export function buildNotionLayoutChecklistMarkdown({
  generatedAt,
  reportPath,
}: {
  generatedAt: string;
  reportPath: string;
}): string {
  return `# Notion Layout QA Checklist

Generated: ${generatedAt}
Local QA report: \`${reportPath}\`

This checklist is a repo-owned review template for human or Notion Manager review. No live Notion mutation was performed by this harness.

## Source-Of-Truth Labels

- [ ] Repo/Paperclip/Notion source-of-truth labels are visible on the page or database being reviewed.
- [ ] Repo docs are named as canonical for doctrine, policy drafts, architecture, and implementation contracts.
- [ ] Paperclip is named as execution truth for issues, blockers, delegated ownership, and closeouts.
- [ ] Notion is named as workspace, review, dashboards, onboarding journey, and visibility.
- [ ] Live systems are named only for the facts they actually own.

## First-Screen Layout

- [ ] The first screen exposes the primary next action without scrolling.
- [ ] The page has a single clear H1 and no duplicated page title blocks.
- [ ] The top links route to the expected databases, policy docs, onboarding docs, or review pages.
- [ ] Mobile width keeps titles, callouts, and database cards readable without horizontal scrolling.
- [ ] Empty states explain the missing source or owner instead of implying completion.

## Blueprint Doctrine And Claims

- [ ] Capture-first and world-model-product-first language remains visible.
- [ ] Qualification, readiness, and review are presented as support layers, not the company center.
- [ ] Capture provenance, rights, privacy, consent, and commercialization status are not invented.
- [ ] Sample, planned, request-gated, and live proof states are labeled separately.

## Policy And HR Draft Boundaries

- [ ] Counsel/PEO review status is visible for legal, HR, payroll, benefits, confidentiality, IP, and employment-administration material.
- [ ] Draft policy material is not presented as signed or approved unless the approved system owns it.
- [ ] Owner, review cadence, and last-reviewed date are visible.

## Notion Usability

- [ ] Related databases use human-readable names and do not require agents to infer IDs from raw URLs.
- [ ] Important child pages are linked from the parent landing page.
- [ ] Database views are named by workflow, not only by internal implementation category.
- [ ] Archived, duplicate, or stale pages are labeled before being used as current guidance.

## Follow-Up

- [ ] Screenshot or link the reviewed Notion page in the owning issue or report.
- [ ] Record any missing source, stale copy, broken link, or layout issue with an owner.
- [ ] Mirror approved Notion doctrine or policy changes back into repo docs before treating them as canonical.
`;
}

export function buildBrandPolishReportMarkdown({
  generatedAt,
  baseUrl,
  routeResults,
  linkResults,
  issues,
  notionChecklistPath,
}: {
  generatedAt: string;
  baseUrl: string;
  routeResults: QaRouteResult[];
  linkResults: QaLinkResult[];
  issues: string[];
  notionChecklistPath: string;
}): string {
  const routeRows = routeResults
    .map((result) => {
      const failedChecks = result.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.name)
        .join(", ");
      return `| ${result.routePath} | ${result.viewportName} | ${result.status} | \`${result.screenshotPath}\` | ${failedChecks || "none"} |`;
    })
    .join("\n");

  const linkRows = linkResults.length > 0
    ? linkResults
      .map((result) => `| ${result.href} | ${result.status} | ${result.httpStatus ?? "n/a"} | ${result.sourceRoutes.join(", ")} |`)
      .join("\n")
    : "| none | pass | n/a | n/a |";

  const issueList = issues.length > 0
    ? issues.map((issue) => `- ${issue}`).join("\n")
    : "- No blocking issues found.";

  const passedRoutes = routeResults.filter((result) => result.status === "pass").length;
  const passedLinks = linkResults.filter((result) => result.status === "pass").length;

  return `# Blueprint Brand Polish QA Report

Generated: ${generatedAt}
Base URL: ${baseUrl}
Command: \`npm run qa:polish\`
Boundary: local Playwright dev server only. No live sends, provider calls, payments, deploys, or Notion writes.

## Summary

- Route viewport checks: ${passedRoutes}/${routeResults.length} passed.
- Internal link checks: ${passedLinks}/${linkResults.length} passed.
- Notion layout checklist: \`${notionChecklistPath}\`

## Issues

${issueList}

## Route And Screenshot Matrix

| Route | Viewport | Status | Screenshot | Failed checks |
|---|---:|---:|---|---|
${routeRows}

## Internal Link Matrix

| Href | Status | HTTP status | Source routes |
|---|---:|---:|---|
${linkRows}

## Checks Covered

- Desktop and mobile screenshots for key public buyer routes.
- Blank page, framework overlay, H1, route heading, and visible text checks.
- Basic SEO: title, meta description, robots, and canonical URL.
- Basic accessibility: image alt text, interactive names, and visible form labels.
- Mobile layout: horizontal overflow guard.
- Asset sanity: visible image decode/natural-size guard.
- CTA presence and href contract for primary route actions.
- Public Launch Ready posture guard for broad prelaunch, apology, placeholder, and backend-incomplete copy on public routes.
- Broken internal link check over visible same-origin links.
- Console errors after filtering known local dev-server, Firebase persistence, and React Helmet dev warnings.
`;
}
