import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary:
      "Blueprint turns a real site into a digital twin so operators can see what is feasible and robot teams can evaluate before pilots.",
    pages: [
      {
        path: "/",
        title: "Home",
        description: "Overview of Blueprint's digital twin workflow for deployment readiness.",
      },
      {
        path: "/readiness-pack",
        title: "Readiness Pack",
        description:
          "Sample deliverable showing what a Blueprint site twin produces: feasibility, blockers, readiness, and next steps.",
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
          "Site briefs that robot teams can review and evaluate after Blueprint builds the twin and readiness picture.",
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
        description: "Tell Blueprint about a site and workflow so the team can build the twin and plan the next step.",
      },
    ],
    safety: "This endpoint only returns public, non-sensitive summaries.",
  });
});

export default router;
