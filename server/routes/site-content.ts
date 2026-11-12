import { Router, Request, Response } from "express";
import { HOW_SEO_DESCRIPTION, PARTNERS_SEO_DESCRIPTION, QUESTIONS_SEO_DESCRIPTION, ROBOT_TEAM_SEO_DESCRIPTION, START_SEO_DESCRIPTION } from "../../client/src/lib/publicCopy";
import { captureGroundedPublicCopy } from "../../client/src/lib/captureGroundedLanguage";

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
      "Sign-up is open for sites: anyone can start a job with an email and a video, and Blueprint also onboards sites by hand. Partner applications are reviewed before access. Starting a job is not a signed order or a commitment to run a pilot; the site confirms the brief and agrees any pilot terms with the deployment company before physical work.",
  },
  {
    term: "Exact-site world model",
    definition:
      "A derived evidence method tied to one real site-task. It may support a claim only within its qualified validation envelope; it is not the product, ground truth, or a physical promise.",
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
      "An explicit result-artifact permission such as evaluation or post-training eligibility. Eligibility does not show that training happened or that a policy improved.",
  },
  {
    term: "Evidence artifact",
    definition:
      "A fixture, simulation, provider, real-observation, or physical record with an exact reference, contract version, digest, evidence class, and permitted uses. An export does not by itself establish a scientific or physical claim.",
  },
  {
    term: "Physical Outcome Join",
    definition:
      "An authoritative physical observation joined to the exact decision, testbed version, method profile, and evidence artifact identifiers. A user note alone cannot recalibrate a method.",
  },
  {
    term: "Claim ceiling",
    definition:
      "The strongest conclusion supported by the current evidence. It keeps estimates, simulation, provider output, real observations, and physical results from being presented as interchangeable.",
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

// The public pages, in the words the pages themselves use (client/src/lib/publicCopy.ts).
const pages = [
  {
    path: "/",
    title: "Home",
    description:
      captureGroundedPublicCopy.seoDescription,
  },
  { path: "/how-it-works", title: "How it works", description: HOW_SEO_DESCRIPTION },
  {
    path: "/beta",
    title: "Questions",
    description:
      `${QUESTIONS_SEO_DESCRIPTION} Free for sites. Nothing is charged today.`,
  },
  { path: "/contact/site-operator", title: "Start a job", description: START_SEO_DESCRIPTION },
  { path: "/contact/robot-team", title: "Apply to see jobs", description: ROBOT_TEAM_SEO_DESCRIPTION },
  { path: "/partners", title: "For deployment companies", description: PARTNERS_SEO_DESCRIPTION },
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
  "robot task decision or abstention",
  "capture-backed robot evaluation evidence",
  "validation envelope robot evidence",
  "claim ceiling robot evaluation",
  "next cheapest robot experiment",
  "physical evidence required for robot claims",
  "site operator job evaluation request",
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
      sitemap: "/sitemap.xml",
      robots: "/robots.txt",
    },
  });
});

export default router;
