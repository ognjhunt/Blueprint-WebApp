import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary:
      "Blueprint captures real sites, packages them into site-specific world models, and provides hosted access for robot teams to evaluate and deploy.",
    pages: [
      {
        path: "/",
        title: "Home",
        description: "Overview of Blueprint's capture-first workflow for site-specific world models and hosted access.",
      },
      {
        path: "/how-it-works",
        title: "How It Works",
        description:
          "How Blueprint captures a real site, packages it into a site-specific world model, and layers in hosted access plus optional review outputs.",
      },
      {
        path: "/world-models",
        title: "World Models",
        description:
          "Site-specific world models teams can browse, open, and run once a site package is ready.",
      },
      {
        path: "/sample-deliverables",
        title: "Sample Deliverables",
        description:
          "Public examples of the walkthrough, exports, and trust details a robot team can inspect before buying.",
      },
      {
        path: "/case-studies",
        title: "Results",
        description:
          "Selected delivery examples with workflow summaries and concrete outcomes from Blueprint work.",
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
        description: "Tell Blueprint about a site and workflow so the team can review scope, rights, and next steps.",
      },
    ],
    safety: "This endpoint only returns public, non-sensitive summaries.",
  });
});

export default router;
