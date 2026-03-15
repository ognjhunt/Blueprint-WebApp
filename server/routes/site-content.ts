import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary:
      "Blueprint qualifies real sites for robot deployment, routes the right opportunities, and prepares downstream evaluation assets when needed.",
    pages: [
      {
        path: "/",
        title: "Home",
        description: "Overview of Blueprint's qualification-first workflow for deployment readiness.",
      },
      {
        path: "/quality-standard",
        title: "Quality Standard",
        description:
          "Sample deliverable showing what a Blueprint qualification record produces: feasibility, blockers, readiness, and next steps.",
      },
      {
        path: "/world-models",
        title: "World Models",
        description:
          "Site-specific world models teams can review, open, and run once a site is known or qualified.",
      },
      {
        path: "/qualified-opportunities",
        title: "Qualified Opportunities",
        description:
          "Site briefs that robot teams can review after Blueprint qualifies the site and workflow.",
      },
      {
        path: "/qualified-opportunities-guide",
        title: "Qualified Opportunities Guide",
        description:
          "Beginner-friendly explainer of Blueprint's site qualification and qualified opportunities workflow.",
      },
      {
        path: "/docs",
        title: "Docs",
        description: "Product documentation, onboarding, and platform guides.",
      },
      {
        path: "/pricing",
        title: "Pricing",
        description: "Plan options and pricing details for teams and enterprises.",
      },
      {
        path: "/solutions",
        title: "Solutions",
        description: "Use cases for robotics, autonomy, and AI evaluation workflows.",
      },
      {
        path: "/contact",
        title: "Contact",
        description: "Tell Blueprint about a site and workflow so the team can qualify it and plan the next step.",
      },
    ],
    safety: "This endpoint only returns public, non-sensitive summaries.",
  });
});

export default router;
