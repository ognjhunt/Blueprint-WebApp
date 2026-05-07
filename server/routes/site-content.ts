import { Router, Request, Response } from "express";

const router = Router();

const definitions = [
  {
    term: "Blueprint",
    definition:
      "Blueprint turns real-site capture into site-specific world-model products, hosted robot evaluation, and package access for robot teams.",
  },
  {
    term: "Exact-site world model",
    definition:
      "A digital environment tied to one real facility, public-facing place, or workflow, with capture provenance, rights, privacy, and package limits kept attached.",
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
    term: "Capture provenance",
    definition:
      "The capture record, timestamps, device/context metadata, privacy handling, rights posture, freshness, and restrictions attached to downstream outputs.",
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
      "Blueprint's product path for site-specific world models, site packages, hosted review, and provenance boundaries.",
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
  "site-specific world models for robotics",
  "capture-backed robot evaluation",
  "hosted robot evaluation",
  "robot deployment site evaluation",
  "site package for robot teams",
  "capture provenance for world models",
  "facility world model",
  "site operator robot evaluation access",
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
    summary:
      "Blueprint captures real sites, packages them into site-specific world models, and provides hosted robot evaluation or site package access for robot teams.",
    definitions,
    pages,
    queryThemes,
    privateOrNoindex,
    safety:
      "This endpoint only returns public, non-sensitive summaries. Do not infer customer results, ratings, prices, availability, rights state, capture provenance, or deployment proof beyond what public pages explicitly say.",
    machineReadableFiles: {
      llms: "/llms.txt",
      llmsFull: "/llms-full.txt",
      sitemap: "/sitemap.xml",
      robots: "/robots.txt",
    },
  });
});

export default router;
