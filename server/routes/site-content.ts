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
      "A digital environment tied to one real indoor facility, public-facing place, or workflow. In the current public story it supports captured task packs, policy evaluation, generated review media, and advisory outputs while provenance, rights, privacy, and scope limits stay attached.",
  },
  {
    term: "Real-site robot eval dataset",
    definition:
      "The Pipeline-owned Site Card, Task Card, Scenario Card, Eval Card, annotation backlog, prediction/outcome ledger, and robot-team submission modality artifact for one capture-backed site/task scope. WebApp may display the package and missing-evidence shape but cannot upgrade it into generated-world policy-ranking proof.",
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
      "Blueprint's service for ranking robot policies or checkpoints against one capture-backed site, task scope, threshold target, evaluator backend, results manifest, and proof-boundary record before field time.",
  },
  {
    term: "Policy Evaluation Run",
    definition:
      "A fixed-scope 100 or 500 episode evaluation run for 1-3 policies or checkpoints against one captured real-site task pack. It ranks candidates for review and does not claim deployment proof, off-scope validation, or guaranteed outcomes.",
  },
  {
    term: "Provenance-checked Evaluation Package",
    definition:
      "A buyer-facing pack that can attach owner-system rollout evidence and envelope-scoped correlation metrics when those artifacts exist for the matched evaluation scope. The pack reports scoped correlation signals and proof limits; it does not claim universal SRCC, off-scope validation, generated-world policy-ranking proof, or guaranteed field outcomes.",
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
      "Blueprint helps robot teams test robot policies before field time using captured real-site task packs, 100/500 episode runs, and scoped proof boundaries.",
  },
  {
    path: "/for-robot-teams",
    title: "Start a Policy Evaluation",
    description:
      "The robot-team page and canonical structured submission route: read how a Task Evaluation Run works, then submit one on the same page — choose a site task, add policies, name the robot, choose episodes, and attach policy access details when available, without upgrading references into readiness proof.",
  },
  {
    path: "/sites",
    title: "Sites",
    description:
      "Captured places and task packs robot teams can use to request a Policy Evaluation Run.",
  },
  {
    path: "/proof",
    title: "Proof",
    description:
      "Short proof explainer: third-party research, request packets, owner-system run evidence, and real robot validation stay separate.",
  },
  {
    path: "/how-it-works",
    title: "How It Works",
    description:
      "Capture-first workflow for Policy Evaluation Runs, Policy Improvement Runs, package delivery, and explicit proof boundaries.",
  },
  {
    path: "/faq",
    title: "FAQ",
    description:
      "Plain-language answers about capture provenance, evaluation scope, pricing, rights, generated media, and the third-party SC3-Eval correlation reference.",
  },
  {
    path: "/capture",
    title: "Capture for Blueprint",
    description:
      "Capturer application, launch-city availability, field workflow, review state, and payout setup boundaries.",
  },
  {
    path: "/pricing",
    title: "Pricing",
    description:
      "Subscription-first pricing for robot-team eval infrastructure, lite quick-look evals, $5,000/site operator supply reviews, and yearly deployed-site monitoring.",
  },
  {
    path: "/contact",
    title: "Start a Request",
    description:
      "Short intake for robot teams to tell Blueprint what to test, or for site operators to share a place for review.",
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
  "Provenance-checked evaluation package with owner-system evidence when available",
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
  "/world-models",
  "/world-models/*",
  "/site-worlds",
  "/site-worlds/*",
  "/agents",
  "/sample-deliverables",
  "/launch-map",
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
