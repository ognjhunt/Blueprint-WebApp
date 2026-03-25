import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary:
      "Blueprint gives robot teams exact-site world models, site-package access, and hosted evaluation built from real indoor capture.",
    pages: [
      {
        path: "/",
        title: "Home",
        description: "Overview of Blueprint's exact-site product for robot deployment readiness.",
      },
      {
        path: "/world-models",
        title: "World Models",
        description:
          "Exact-site world models teams can review before requesting site-package access or hosted evaluation.",
      },
      {
        path: "/how-it-works",
        title: "How It Works",
        description:
          "Explains the listing-first workflow, the access paths, and how teams use the outputs before deployment.",
      },
      {
        path: "/docs",
        title: "Docs",
        description: "Technical documentation for the stable product contract, exports, and listing-specific variation.",
      },
      {
        path: "/pricing",
        title: "Pricing",
        description: "Listing-specific starting prices for site-package access, hosted evaluation, and custom engagements.",
      },
      {
        path: "/faq",
        title: "FAQ",
        description: "Straight answers about world models, hosted evaluation, exports, freshness, and trust.",
      },
      {
        path: "/contact",
        title: "Contact",
        description: "Tell Blueprint about a site and workflow so the team can confirm the right next step.",
      },
    ],
    safety: "This endpoint only returns public, non-sensitive summaries.",
  });
});

export default router;
