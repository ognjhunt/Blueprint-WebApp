import { Router, Request, Response } from "express";
import { captureGroundedPublicCopy } from "../../client/src/lib/captureGroundedLanguage";

const router = Router();

const definitions = [
  {
    term: "Blueprint",
    definition: captureGroundedPublicCopy.productSummary,
  },
  {
    term: "Exact-site world model",
    definition:
      "A digital environment tied to one real indoor facility, public-facing place, or workflow. In the current public story it is a substrate for readiness work, with capture provenance, rights, privacy, and package limits kept attached.",
  },
  {
    term: "Deployment readiness advisory",
    definition:
      "A request-scoped pre-pilot estimate for one site/task, robot profile, and threshold set. It can organize success-rate, cycle-time, intervention-rate, safety-threshold, failure-mode, site-modification, data-need, and pilot-protocol questions without claiming the robot is ready to deploy.",
  },
  {
    term: "Readiness report",
    definition:
      "A Blueprint deliverable that summarizes site/task scope, capture-backed evidence, robot profile, thresholds, scenario variations, failure modes, site modifications, data requirements, missing owner-system proof, and recommended next step.",
  },
  {
    term: "Category validation",
    definition:
      "Google Genie and Street View validate real-place world models outdoors; Blueprint applies that site-specific product logic to unscanned indoor spaces without claiming a Google or Waymo partnership.",
  },
  {
    term: "Site package",
    definition:
      "Walkthrough media, poses, metadata, geometry when available, rights, privacy, provenance, and export scope for one site. It grounds the readiness report instead of disappearing behind a generic digital-twin claim.",
  },
  {
    term: "Hosted review",
    definition:
      "A Blueprint-managed evaluation session for one exact site, with run evidence, observations, export framing, and an explicit next step.",
  },
  {
    term: "Dry-run agent commerce",
    definition:
      "A repo-safe quote, order, receipt, and entitlement proof path for robot agents. It does not create live Stripe charges, grant live package access, or prove hosted fulfillment.",
  },
  {
    term: "Capture provenance",
    definition:
      "The capture record, timestamps, device/context metadata, privacy handling, rights posture, freshness, and restrictions attached to downstream outputs.",
  },
  {
    term: "Ground-truth boundary",
    definition:
      `${captureGroundedPublicCopy.groundTruthDefinition} ${captureGroundedPublicCopy.supportSignalBoundary}`,
  },
];

const pages = [
  {
    path: "/",
    title: "Home",
    description:
      "Overview of Blueprint's capture-backed site-specific robot deployment readiness platform, readiness reports, hosted robot evaluation, and site packages.",
  },
  {
    path: "/product",
    title: "Product",
    description:
      "Blueprint's product path from indoor capture to task suite, world-model/site-package assets, readiness report, hosted review, pilot protocol, and provenance boundaries.",
  },
  {
    path: "/readiness",
    title: "Readiness",
    description:
      "Blueprint's first PMF wedge page for site-specific robot deployment readiness reports, threshold scope, failure modes, evidence gaps, and pilot protocol.",
  },
  {
    path: "/for-robot-teams",
    title: "For Robot Teams",
    description:
      "Robot-team page explaining pre-sales and pre-deployment evaluation from real site to capture provenance, task thresholds, readiness advisory, hosted review, and pilot decision.",
  },
  {
    path: "/how-it-works",
    title: "How It Works",
    description:
      "Workflow page separating robot teams, robot agents, and Blueprint agents across capture, package, hosted review, and decision steps.",
  },
  {
    path: "/world-models",
    title: "Site Package Catalog",
    description:
      "Exact-site package catalog with proof posture, readiness-report entry points, hosted-evaluation paths, and provenance boundaries.",
  },
  {
    path: "/world-models/siteworld-f5fd54898cfb",
    title: "Sample Site",
    description:
      "Public sample listing showing how proof, package access, hosted access, and restrictions stay separate.",
  },
  {
    path: "/agents",
    title: "Robot-Team Agent Access",
    description:
      "Headless discovery, dry-run quote/order/entitlement proof, OpenAPI contract, CLI, MCP tools, truth labels, auth model, and hosted-session lifecycle for robot-team automation.",
  },
  {
    path: "/capture",
    title: "Capture App / Earn",
    description:
      "Public capture rules and capturer handoff boundaries for lawful public-facing walkthroughs.",
  },
  {
    path: "/proof",
    title: "Proof",
    description:
      "Public proof packet example with route capture, provenance, privacy posture, thresholds, readiness-report boundaries, and hosted-review outputs.",
  },
  {
    path: "/governance",
    title: "Governance",
    description:
      "Rights, privacy, provenance, restrictions, and hosted-access boundaries.",
  },
  {
    path: "/faq",
    title: "FAQ",
    description:
      "Direct answers about readiness reports, site packages, hosted evaluation, sample proof, buyer outputs, and next steps.",
  },
  {
    path: "/pricing",
    title: "Pricing",
    description:
      "Commercial paths for site/task readiness review, hosted evaluation, and custom multi-site benchmark scope.",
  },
  {
    path: "/contact",
    title: "Enterprise Contact",
    description:
      "Structured intake for a site, workflow, robot profile, thresholds, pilot timeline, evidence needs, rights context, and desired next step.",
  },
  {
    path: "/updates",
    title: "Updates",
    description:
      "Short Blueprint product notes about capture supply, world-model packages, hosted access, and buyer workflow.",
  },
  {
    path: "/capture-app/launch-access",
    title: "Capture Launch Access",
    description:
      "Future-city signal path for capturers, site operators, and local leads.",
  },
];

const queryThemes = [
  "site-specific robot deployment readiness",
  "robot deployment readiness platform",
  "pre-pilot robot readiness estimate",
  "site task readiness report",
  "warehouse robot readiness evaluation",
  "factory robot readiness evaluation",
  "success rate cycle time intervention safety threshold robot task",
  "exact-site world models as readiness substrate",
  "indoor site packages for robot readiness",
  "Google Genie Street View indoor world model gap",
  "capture-backed robot evaluation",
  "hosted robot evaluation",
  "robot deployment site evaluation",
  "site package for robot teams",
  "capture provenance for world models",
  "facility world model",
  "site operator robot evaluation access",
  "robot-team agent API",
  "robot agent dry-run commerce",
  "hosted-session entitlement proof",
  "agent site-world catalog search",
  "no-credential robot-agent mock proof",
  "headless hosted-session rollout",
  "Blueprint MCP server",
];

const privateOrNoindex = [
  "/admin/*",
  "/dashboard",
  "/onboarding",
  "/settings",
  "/requests/*",
  "/portal",
  "/sign-in",
  "/login",
  "/forgot-password",
  "/signup*",
  "/off-waitlist-signup",
  "/capture-app",
  "/world-models/*/start",
  "/world-models/*/workspace",
];

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary: captureGroundedPublicCopy.productSummary,
    definitions,
    pages,
    queryThemes,
    privateOrNoindex,
    safety: captureGroundedPublicCopy.apiSafety,
    machineReadableFiles: {
      llms: "/llms.txt",
      llmsFull: "/llms-full.txt",
      agentAccessOpenApi: "/agent-access.openapi.json",
      agentAccessApi: "/api/agent-access/openapi.json",
      sitemap: "/sitemap.xml",
      robots: "/robots.txt",
    },
  });
});

export default router;
