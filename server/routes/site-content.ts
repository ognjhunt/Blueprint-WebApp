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
      "The core public buyer story: one real facility, one robot task, one pass bar, readiness workflow, planning ranges, proof boundary, and request path.",
  },
  {
    path: "/proof",
    title: "Proof",
    description:
      "Short proof explainer separating public samples, generated support signals, request packets, and owner-system proof.",
  },
  {
    path: "/pricing",
    title: "Pricing",
    description:
      "Planning ranges for site/task readiness review, hosted evaluation, and custom multi-site benchmark work.",
  },
  {
    path: "/contact",
    title: "Request Readiness Review",
    description:
      "Structured intake for a site, workflow, robot profile, thresholds, pilot timeline, evidence needs, rights context, and desired next step.",
  },
  {
    path: "/privacy",
    title: "Privacy",
    description: "Blueprint privacy policy for capture, site packages, hosted sessions, and buyer workflows.",
  },
  {
    path: "/terms",
    title: "Terms",
    description: "Blueprint service terms for capture workflows, site packages, hosted sessions, and related services.",
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
  "capture-backed site packages for robot readiness",
  "capture-backed robot evaluation",
  "hosted robot evaluation",
  "robot deployment site evaluation",
  "capture provenance for world models",
  "site operator robot evaluation boundaries",
  "request readiness review",
  "readiness proof boundary",
];

const privateOrNoindex = [
  "/product",
  "/readiness",
  "/readiness-pack",
  "/for-robot-teams",
  "/how-it-works",
  "/world-models",
  "/world-models/*",
  "/agents",
  "/capture",
  "/sample-deliverables",
  "/launch-map",
  "/faq",
  "/governance",
  "/about",
  "/updates",
  "/careers",
  "/help",
  "/help/*",
  "/city/*",
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
