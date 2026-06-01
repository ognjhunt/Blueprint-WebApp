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
      "A digital environment tied to one real indoor facility, public-facing place, or workflow, with capture provenance, rights, privacy, and package limits kept attached.",
  },
  {
    term: "Category validation",
    definition:
      "Google Genie and Street View validate real-place world models outdoors; Blueprint applies that site-specific product logic to unscanned indoor spaces without claiming a Google or Waymo partnership.",
  },
  {
    term: "Site package",
    definition:
      "Walkthrough media, poses, metadata, geometry when available, rights, privacy, provenance, and export scope for one site.",
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
      "Overview of Blueprint's capture-backed site-specific world models, hosted robot evaluation, and site packages.",
  },
  {
    path: "/product",
    title: "Product",
    description:
      "Blueprint's product path for indoor site-specific world models, site packages, hosted review, and provenance boundaries.",
  },
  {
    path: "/for-robot-teams",
    title: "For Robot Teams",
    description:
      "Robot-team page explaining the indoor workflow from real site to capture provenance, grounded world model, hosted review, and export or recapture decision.",
  },
  {
    path: "/how-it-works",
    title: "How It Works",
    description:
      "Workflow page separating robot teams, robot agents, and Blueprint agents across capture, package, hosted review, and decision steps.",
  },
  {
    path: "/world-models",
    title: "Catalog",
    description:
      "Exact-site world-model catalog with proof posture, package paths, hosted-evaluation entry points, and provenance boundaries.",
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
      "Public proof packet example with route capture, provenance, privacy posture, and hosted-review outputs.",
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
      "Direct answers about world models, hosted evaluation, sample proof, buyer outputs, and next steps.",
  },
  {
    path: "/pricing",
    title: "Pricing",
    description:
      "Commercial paths for site package, hosted evaluation, and enterprise scope.",
  },
  {
    path: "/contact",
    title: "Enterprise Contact",
    description:
      "Structured intake for a site, workflow, robot question, rights context, and desired next step.",
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
  "exact-site world models",
  "indoor world models for robot teams",
  "site-specific world models for robotics",
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
