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
      "A digital environment tied to one real indoor facility, public-facing place, or workflow. In the current public story it is the substrate for site data packages, policy-evaluation sessions, and training exports, with capture provenance, rights, privacy, and package limits kept attached.",
  },
  {
    term: "Real-site robot eval dataset",
    definition:
      "The Pipeline-owned Site Card, Task Card, Scenario Card, Eval Card, annotation backlog, prediction/outcome ledger, and robot-team submission modality artifact for one capture-backed site/task scope. WebApp may display the package and missing-evidence shape but cannot upgrade it into robot readiness.",
  },
  {
    term: "Eval Cards",
    definition:
      "Pipeline-generated review records for a task/scenario pair that name required metrics, prediction sources, missing outcome proof, and blocked proof upgrades. They are review inputs, not evidence that a robot trial passed.",
  },
  {
    term: "Deployment readiness advisory",
    definition:
      "A request-scoped pre-pilot estimate for one site/task, robot profile, and threshold set. It can organize success-rate, cycle-time, intervention-rate, safety-threshold, failure-mode, site-modification, data-need, and pilot-protocol questions without claiming the robot is ready to deploy.",
  },
  {
    term: "Real-site robot data service",
    definition:
      "Blueprint's service for turning one capture-backed site into a world-model package, task/scenario data, policy-evaluation session path, export bundle, and proof-boundary record for robot teams.",
  },
  {
    term: "Policy evaluation record",
    definition:
      "A record that names the robot or policy scope, task/scenario run, engine or session path used, observed outputs, failure modes, uncertainty, validation state, and blocked proof upgrades.",
  },
  {
    term: "Structured robot-team test submission",
    definition:
      "A hosted-session policy payload that lets a robot team reference one or more review modalities: policy API endpoint, Docker container, recorded action trace, high-level skill trace, teleop demo, or sim controller plugin. These references organize review inputs and do not prove policy execution, simulator completion, safety validation, or deployment readiness.",
  },
  {
    term: "Evidence-boundary advisory",
    definition:
      "A support record attached to a robot-team request that summarizes capture-backed evidence, robot profile, thresholds, scenario variations, failure modes, site modifications, data requirements, missing owner-system proof, and recommended next step without becoming the product being sold.",
  },
  {
    term: "Category validation",
    definition:
      "Google Genie and Street View validate real-place world models outdoors; Blueprint applies that site-specific product logic to unscanned indoor spaces without claiming a Google or Waymo partnership.",
  },
  {
    term: "Site package",
    definition:
      "Walkthrough media, poses, metadata, geometry when available, scenario data, rights, privacy, provenance, and export scope for one site. It grounds robot-team data and policy evaluation instead of disappearing behind a generic digital-twin claim.",
  },
  {
    term: "Policy evaluation",
    definition:
      "A compute-backed manual or headless session for running a robot policy against one exact site's tasks and scenarios, with run evidence, observations, export framing, and an explicit next step.",
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
      "The core public buyer story: an open robot-team marketplace for capture-backed site data packages, policy-evaluation sessions, scenario data, training exports, and proof boundaries.",
  },
  {
    path: "/for-robot-teams",
    title: "Robot-Team Test Interface",
    description:
      "Buyer-facing interface for selecting a capture-backed site/task package and referencing policy API, Docker, recorded trace, skill trace, teleop demo, or sim-controller-plugin evidence before hosted-session creation or intake fallback.",
  },
  {
    path: "/robot-team/eval",
    title: "Robot-Team Evaluation Submission",
    description:
      "Canonical structured submission route for robot teams to create an eligible hosted session or route request-gated modalities to contact intake without upgrading references into readiness proof.",
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
      "Simple pricing: robot teams pay for policy-evaluation session-hours or site data packages; site operators participate for free.",
  },
  {
    path: "/contact",
    title: "Request Site Data Or Policy Evaluation",
    description:
      "Structured intake for site data packages, policy evaluation, new capture requests, free site-operator participation, robot tasks, thresholds, dynamic conditions, zones, rights/access, pilot outcomes, and desired next step.",
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
  "real-site robot data marketplace",
  "real-site robot data service",
  "site data package policy evaluation robot",
  "capture a real site turn it into robot training data",
  "test robot policy before a long pilot",
  "site-specific robot deployment readiness",
  "real-site robot data workflow",
  "pre-pilot robot readiness estimate",
  "site task robot policy evaluation",
  "warehouse robot data package",
  "factory robot scenario data",
  "success rate cycle time intervention safety threshold robot task",
  "capture-backed site packages for robot teams",
  "capture-backed robot policy evaluation",
  "robot team test submission interface",
  "policy API endpoint Docker container robot eval",
  "recorded action trace high level skill trace teleop demo",
  "sim controller plugin hosted session robot evaluation",
  "headless robot policy evaluation",
  "manual robot policy evaluation",
  "robot training data for one site",
  "robot fine-tuning data for one site",
  "robot deployment site evaluation",
  "capture provenance for world models",
  "site operator robot evaluation boundaries",
  "site operators free Blueprint",
  "request robot site data",
  "readiness proof boundary",
];

const privateOrNoindex = [
  "/product",
  "/readiness",
  "/readiness-pack",
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
