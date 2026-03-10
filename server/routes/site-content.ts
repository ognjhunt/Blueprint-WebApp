import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary:
      "Blueprint checks whether a site and task are ready for robots, then turns qualified demand into clear opportunities for the right teams.",
    pages: [
      {
        path: "/",
        title: "Home",
        description: "Overview of Blueprint's qualification-first workflow for robot deployment readiness.",
      },
      {
        path: "/marketplace",
        title: "Marketplace",
        description: "Secondary legacy catalog of scenes and datasets. Not the primary product path.",
      },
      {
        path: "/qualified-opportunities",
        title: "Qualified Opportunities",
        description:
          "Qualified site briefs that robot teams can review, evaluate, and respond to after site qualification.",
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
        description: "Ways to reach the Blueprint team for sales and support.",
      },
    ],
    safety: "This endpoint only returns public, non-sensitive summaries.",
  });
});

export default router;
