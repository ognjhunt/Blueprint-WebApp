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
      "A digital environment tied to one real indoor facility, public-facing place, or workflow. In the current public story it is the substrate for real-site Task Evaluation Runs, sim-only Policy Improvement Runs, and hosted review outputs, with capture provenance, rights, privacy, and scope limits kept attached.",
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
    term: "Evaluation planning advisory",
    definition:
      "A request-scoped pre-pilot estimate for one site/task, robot profile, and threshold set. It can organize success-rate, cycle-time, intervention-rate, failure-mode, site-modification, data-need, and pilot-protocol questions while keeping claims tied to artifacts.",
  },
  {
    term: "Capture-backed policy/checkpoint evaluation infrastructure",
    definition:
      "Blueprint helps robot teams rank policies and checkpoints before field time by pairing capture-backed real-site task packs with WAM/VLA evaluator backends, fixed episode envelopes, and explicit proof boundaries.",
  },
  {
    term: "Real-site robot evaluation service",
    definition:
      "Blueprint's service for ranking one robot policy or checkpoint against one capture-backed site, task scope, scenario set, threshold target, WAM/VLA evaluator backend, scenario/results manifest, and proof-boundary record before field time.",
  },
  {
    term: "Policy Evaluation Run",
    definition:
      "A fixed-scope 100 or 500 episode evaluation run for one policy or checkpoint against a capture-backed real-site task pack, evaluator backend, metrics envelope, and scenario/results manifest. It ranks candidates for review and does not claim live provider execution, deployment readiness, or guaranteed outcomes.",
  },
  {
    term: "Validated Evaluation Pack",
    definition:
      "A buyer-facing pack that pairs real-world rollout evidence with envelope-scoped correlation metrics for the matched evaluation scope. The pack reports scoped correlation signals and proof limits; it does not claim universal SRCC, safety validation, deployment readiness, or guaranteed field outcomes.",
  },
  {
    term: "Policy evaluation record",
    definition:
      "A record that names the robot or policy scope, task/scenario run, engine or session path used, observed outputs, failure modes, uncertainty, validation state, and blocked proof upgrades.",
  },
  {
    term: "Structured robot-team test submission",
    definition:
      "A hosted-session policy payload that lets a robot team reference one or more review modalities: policy API endpoint, Docker container, recorded action trace, high-level skill trace, teleop demo, or sim controller plugin. These references organize review inputs and do not prove policy execution, simulator completion, or package outcomes.",
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
      "Walkthrough media, poses, metadata, geometry when available, scenario data, rights, privacy, provenance, and export scope for one site. It grounds robot-team evaluation instead of becoming the lead product claim by itself.",
  },
  {
    term: "Policy evaluation",
    definition:
      "A fixed-scope evaluation set for testing one robot policy/profile on one exact site against one scoped task pack, with scenario evidence, observations, export framing, and an explicit next step.",
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
      "The core public buyer story: capture-backed policy/checkpoint evaluation infrastructure that helps robot teams rank candidates before field time using real-site task packs, WAM/VLA evaluator backends, 100/500 episode Policy Evaluation Runs, and proof boundaries.",
  },
  {
    path: "/for-robot-teams",
    title: "Robot-Team Test Interface",
    description:
      "Buyer-facing interface for selecting capture-backed real-site task packs and referencing policy API, Docker, recorded trace, skill trace, teleop demo, or sim-controller-plugin evidence for WAM/VLA-backed evaluation intake.",
  },
  {
    path: "/robot-team/eval",
    title: "Robot-Team Evaluation Submission",
    description:
      "Canonical structured submission route for robot teams to create an eligible hosted session or route request-gated modalities to contact intake without upgrading references into readiness proof.",
  },
  {
    path: "/sites",
    title: "Sites",
    description:
      "Blueprint Site Library for browsing captured-site profiles by site type, task pack, access status, and region before requesting a Policy Evaluation Run.",
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
      "Simple pricing for fixed-scope 100/500 episode Policy Evaluation Runs and Validated Evaluation Packs with paired real-world rollouts and envelope-scoped correlation metrics; site operators submit sites for free.",
  },
  {
    path: "/contact",
    title: "Request Policy Evaluation Or Validated Pack",
    description:
      "Structured intake for Policy Evaluation Runs, Validated Evaluation Packs, new capture requests, free site-operator participation, robot tasks, thresholds, dynamic conditions, zones, rights/access, rollout evidence, and desired next step.",
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
  "real-site robot evaluation",
  "real-site robot evaluation service",
  "rank robot policies before field time",
  "rank robot checkpoints before field time",
  "capture a real site turn it into robot evaluation",
  "test robot policy before a long pilot",
  "capture-backed policy checkpoint evaluation infrastructure",
  "real-site robot evaluation workflow",
  "capture-backed real-site task packs",
  "site task robot policy evaluation",
  "warehouse robot evaluation",
  "factory robot scenario tests",
  "success rate cycle time intervention envelope metrics robot task",
  "capture-backed site evaluation for robot teams",
  "capture-backed robot policy evaluation",
  "WAM VLA evaluator backends",
  "100 episode Policy Evaluation Run",
  "500 episode Policy Evaluation Run",
  "Validated Evaluation Pack paired real-world rollouts",
  "envelope scoped correlation metrics robot evaluation",
  "robot team test submission interface",
  "policy API endpoint Docker container robot eval",
  "recorded action trace high level skill trace teleop demo",
  "sim controller plugin hosted session robot evaluation",
  "headless robot policy evaluation",
  "manual robot policy evaluation",
  "robot evaluation data for one site",
  "captured site library",
  "browse captured sites for robot evaluation",
  "Task Evaluation Run request",
  "robot fine-tuning data for one site",
  "robot policy checkpoint ranking before field time",
  "capture provenance for world models",
  "site operator robot evaluation boundaries",
  "site operators free Blueprint",
  "request robot site evaluation",
  "policy checkpoint evaluation proof boundary",
];

const privateOrNoindex = [
  "/product",
  "/readiness",
  "/readiness-pack",
  "/how-it-works",
  "/world-models",
  "/world-models/*",
  "/site-worlds",
  "/site-worlds/*",
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
