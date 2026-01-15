import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    summary:
      "Blueprint provides SimReady 3D environments, datasets, evaluation tooling, and marketplace content for robotics and AI teams.",
    pages: [
      {
        path: "/",
        title: "Home",
        description: "Overview of Blueprint's robotics data platform and core value proposition.",
      },
      {
        path: "/marketplace",
        title: "Marketplace",
        description: "Discover curated 3D assets, datasets, and simulation-ready content.",
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
