import { Router, Request, Response } from "express";
import { captureGroundedPublicCopy } from "../../client/src/lib/captureGroundedLanguage";
import { pilotReplacementPolicy } from "../../client/src/lib/evaluationPricing";

const router = Router();

const definitions = [
  {
    term: "Blueprint",
    definition: captureGroundedPublicCopy.productSummary,
  },
  {
    term: "Job assessment and pilot coordination",
    definition:
      captureGroundedPublicCopy.productSummary,
  },
  {
    term: "Site sign-up",
    definition:
      "Sign-up is open for sites: anyone can start a job, and Blueprint also onboards sites by hand. Partners join by invitation after their application is reviewed. Starting a job is not a signed order or a commitment to run a pilot; the site approves the brief, chooses a proposal and agrees pilot terms before physical work.",
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
      "Walkthrough media, poses, metadata, geometry when available, scenario data, rights, privacy, provenance, and export scope for one site. It grounds candidate evaluation instead of becoming the lead product claim by itself.",
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
      captureGroundedPublicCopy.seoDescription,
  },
  {
    path: "/how-it-works",
    title: "How It Works",
    description:
      "Send video of the job and review the brief drafted from its analysis. Blueprint runs candidate robots, policies and policy APIs against the job in a site simulation and recommends the approach that wins plus deployment companies that support it; you review their delivery proposals and measure an agreed pilot.",
  },
  {
    path: "/beta",
    title: "Beta program",
    description:
      `Free for sites and partners. Sites can start a job immediately, and Blueprint also onboards sites by hand; partners join by invitation. ${pilotReplacementPolicy} Blueprint runs the candidate evaluations itself, and a partner's system is evaluated free when invited. The beta has no private paid evaluations, balances or top-ups.`,
  },
  {
    path: "/contact/site-operator",
    title: "Submit a job",
    description: "Open sign-up for sites: send video of one recurring job. We analyze it to draft the description; video is required for the site assessment.",
  },
  {
    path: "/contact/robot-team",
    title: "Robot teams",
    description: "Robot teams and technology providers apply for an invitation to make their systems available for Blueprint's evaluations of real site jobs, free during the beta.",
  },
  {
    path: "/sites",
    title: "Job library",
    description:
      "Site-approved recurring jobs shared for compatible technology assessment and delivery planning.",
  },
  { path: "/jobs-we-support", title: "Jobs we support", description: "Bounded recurring jobs, known objects and clear outcomes; compatibility and support are checked for each job." },
  { path: "/partners", title: "For partners", description: "Separate paths for deployment partners and robot technology providers." },
  { path: "/partners/deployment", title: "Deployment partners", description: "Apply to supply, install and support customer automation jobs." },
  { path: "/partners/technology", title: "Robot technology providers", description: "Make hardware, policies or APIs available for reviewed compatible-system assessment." },
  {
    path: "/about",
    title: "About",
    description: "Who Blueprint is and the standards it holds its recommendations to.",
  },
  {
    path: "/privacy",
    title: "Privacy",
    description: "Blueprint privacy policy for site capture, in-person filming visits, simulated evaluations, AI processing and California privacy rights.",
  },
  {
    path: "/terms",
    title: "Terms",
    description: "Blueprint terms for the free beta: site capture, evaluations, the recommended pilot and booking.",
  },
];

const queryThemes = [
  "measured physical robot pilot",
  "free robot pilot recommendation",
  "evaluated robot pilot recommendation",
  "which robot team should pilot my task",
  "Task Evaluation Run",
  "automate robot site discovery",
  "pre-deployment robot opportunity",
  "controlled digital twin evaluation",
  "real site job robot evaluation decision",
  "maintained Site-Task Testbed",
  "compare robot policies on a real task",
  "test robot checkpoint compatibility before field time",
  "robot task decision or abstention",
  "capture-backed robot evaluation evidence",
  "validation envelope robot evidence",
  "claim ceiling robot evaluation",
  "next cheapest robot experiment",
  "physical evidence required for robot claims",
  "site operator job evaluation request",
  "robot team job evaluation request",
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
  "/claim/*",
  "/app/results/*",
  "/ops/*",
  "/internal/*",
  "/portal",
  "/sign-in",
  "/login",
  "/forgot-password",
  "/signup*",
  "/off-waitlist-signup",
  "/capture-app",
  "/capture-upload/*",
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
