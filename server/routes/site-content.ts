import { Router, Request, Response } from "express";
import { FIRST_LOOK_WHEN_READY, HOW_SEO_DESCRIPTION, PARTNERS_PAGE_NAME, PARTNERS_SEO_DESCRIPTION, QUESTIONS_SEO_DESCRIPTION, ROBOT_TEAM_SEO_DESCRIPTION, START_SEO_DESCRIPTION } from "../../client/src/lib/publicCopy";
import { captureGroundedPublicCopy } from "../../client/src/lib/captureGroundedLanguage";
import { COMPANY } from "../../client/src/data/company";

const router = Router();

// The words an agent needs for the public pages, and only those (launch copy, 2026-11-20: Pipeline's internal vocabulary
// is not public).
const definitions = [
  {
    term: "Blueprint",
    definition: captureGroundedPublicCopy.productSummary,
  },
  {
    term: "Site sign-up",
    definition:
      "Sign-up is open for sites: anyone can start a job with an email, where the job is, and a video of the job. Deployment companies apply, and Blueprint approves each company before it sees jobs. Any work is agreed between the site and the company.",
  },
  {
    term: "Job packet",
    definition:
      `Blueprint's one service for a site. The job packet gives the site's description of one recurring job and what counts as done when known. ${FIRST_LOOK_WHEN_READY} It includes the sound-free video and simulation when available. Blueprint sends it automatically to the deployment companies it has approved.`,
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
  { path: "/jobs", title: PARTNERS_PAGE_NAME, description: PARTNERS_SEO_DESCRIPTION },
  {
    path: "/privacy",
    title: "Privacy",
    // The legal pages' own descriptions (`Privacy.tsx`, `Terms.tsx`).
    description: `How ${COMPANY.legalName} collects, uses and protects information on tryblueprint.io and in the Blueprint service.`,
  },
  {
    path: "/terms",
    title: "Terms",
    description: `The terms for using Blueprint, from ${COMPANY.legalName}.`,
  },
];

const queryThemes = [
  "post a job for robots",
  "robot deployment companies",
  "automate a repetitive job with a robot",
  "find jobs for the robots you deploy",
  "simulation of a site for robot deployment",
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
