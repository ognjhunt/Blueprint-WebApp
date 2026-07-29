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
      "A derived evidence method tied to one real site-task. It may support a claim only within its qualified validation envelope; it is not the product, ground truth, or a physical guarantee.",
  },
  {
    term: "Site-Task Testbed",
    definition:
      "The maintained, versioned substrate behind Task Evaluation Runs for one real site-task. Its manifest, version, digest, capture provenance, rights, and evidence history remain attached to every run.",
  },
  {
    term: "Decision/Evidence Request",
    definition:
      "The versioned request sent to Pipeline with the decision question, claims, candidates when applicable, thresholds, false-safe consequence, acceptable risk, budget, deadline, evidence, restrictions, audience, owner, idempotency, and provenance. It does not select a simulator.",
  },
  {
    term: "Decision Envelope",
    definition:
      "The Pipeline-owned result projected by WebApp: per-claim outcomes, overall decision or abstention, evidence methods and qualification, validation envelope, uncertainty, disagreements, claim ceiling, next experiment, physical-evidence needs, exact artifact provenance, and permitted evidence uses.",
  },
  {
    term: "Task Evaluation Run",
    definition:
      "Blueprint's one customer-facing service. It converts a real site-task into a maintained testbed, routes each decision-relevant claim to qualified evidence, and returns a bounded decision or explicit abstention.",
  },
  {
    term: "Evidence routing",
    definition:
      "Pipeline selects the least expensive evidence trustworthy enough for each claim and asks for stronger evidence only when needed. WebApp does not independently choose methods or calculate scientific verdicts.",
  },
  {
    term: "Permitted evidence use",
    definition:
      "An explicit result-artifact permission such as evaluation or post-training eligibility. Eligibility does not prove that training happened or that a policy improved.",
  },
  {
    term: "Evidence artifact",
    definition:
      "A fixture, simulation, provider, real-observation, or physical record with an exact reference, contract version, digest, evidence class, and permitted uses. An export does not by itself prove a scientific or physical claim.",
  },
  {
    term: "Physical Outcome Join",
    definition:
      "An authoritative physical observation joined to the exact decision, testbed version, method profile, and evidence artifact identifiers. A user note alone cannot recalibrate a method.",
  },
  {
    term: "Structured robot-team test submission",
    definition:
      "A candidate reference inside a Task Evaluation Run. It may name a robot, policy, checkpoint, policy API, container, trace, or controller without sending client secrets or raw policy weights and without proving execution.",
  },
  {
    term: "Claim ceiling",
    definition:
      "The strongest conclusion supported by the current evidence. It keeps estimates, simulation, provider output, real observations, and physical proof from being presented as interchangeable.",
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
    term: "Partial decision",
    definition:
      "A result where some claims are answered while others remain unresolved or abstained. The answered claims do not silently upgrade the unresolved ones.",
  },
  {
    term: "Legacy commerce compatibility",
    definition:
      "Historical orders and entitlements remain readable under their original access controls. New standalone quote and checkout endpoints are retired and create no payment or entitlement state.",
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
      "Blueprint turns a real site-task into a maintained testbed and returns a bounded decision or explicit abstention through one Task Evaluation Run.",
  },
  {
    path: "/for-robot-teams",
    title: "Task Evaluation Runs for robot teams",
    description:
      "Robot teams use the same Task Evaluation Run to compare internal candidates, test task compatibility, discover failure conditions, and decide whether field time is justified.",
  },
  {
    path: "/sites",
    title: "Sites",
    description:
      "Capture-backed Site-Task Testbeds that may ground a Task Evaluation Run, with provenance and access boundaries attached.",
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
      "Capture-first Task Evaluation Run workflow from maintained testbed through qualified evidence, decision or abstention, and explicit proof boundaries.",
  },
  {
    path: "/faq",
    title: "FAQ",
    description:
      "Plain-language answers about Task Evaluation Runs, decisions and abstentions, evidence routing, pricing, rights, provenance, and physical proof boundaries.",
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
      "One scoped Task Evaluation Run, quoted according to the decision, evidence, candidates, scenarios, compute, timing, rights, and physical requirements. No ranking or winner is guaranteed.",
  },
  {
    path: "/contact",
    title: "Start a Request",
    description:
      "Persona-aware entry to the same Task Evaluation Run intake for robot teams and site operators.",
  },
  {
    path: "/privacy",
    title: "Privacy",
    description: "Blueprint privacy policy for capture, maintained testbeds, Task Evaluation Runs, evidence artifacts, and compatibility records.",
  },
  {
    path: "/terms",
    title: "Terms",
    description: "Blueprint service terms for capture workflows, maintained testbeds, Task Evaluation Runs, evidence review, and compatibility records.",
  },
];

const queryThemes = [
  "Task Evaluation Run",
  "real site task robot evaluation decision",
  "maintained Site-Task Testbed",
  "compare robot policies on a real task",
  "test robot checkpoint compatibility before field time",
  "robot task decision or abstention",
  "capture-backed robot evaluation evidence",
  "validation envelope robot evidence",
  "claim ceiling robot evaluation",
  "next cheapest robot experiment",
  "physical evidence required for robot claims",
  "site operator task evaluation request",
  "robot team task evaluation request",
  "simulation and world model evidence boundaries",
  "post-training eligible evidence",
  "capture provenance for robot evaluation",
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
