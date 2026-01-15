export type RouteChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type PublicRouteEntry = {
  path: string;
  label: string;
  summary: string;
  changefreq: RouteChangeFrequency;
  priority: number;
};

export const publicRoutes: PublicRouteEntry[] = [
  {
    path: "/",
    label: "Home",
    summary:
      "Top-level product narrative for Blueprint as a complete data platform for robotics AI.",
    changefreq: "weekly",
    priority: 1.0,
  },
  {
    path: "/why-simulation",
    label: "Why Simulation",
    summary:
      "Explains the case for simulation-first robotics development and validation.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/marketplace",
    label: "Marketplace",
    summary:
      "Browse SimReady environments, datasets, and bundles available for purchase.",
    changefreq: "daily",
    priority: 0.9,
  },
  {
    path: "/solutions",
    label: "Solutions",
    summary:
      "Use-case oriented summaries for teams applying Blueprint to specific workflows.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/pricing",
    label: "Pricing",
    summary:
      "Plan options for marketplace access, datasets, and services.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/learn",
    label: "Learn",
    summary:
      "Educational content on simulation, data quality, and best practices.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/docs",
    label: "Docs",
    summary:
      "Technical overview of the SimReady spec, semantics, and integration guidance.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/evals",
    label: "Evaluations",
    summary:
      "Overview of evaluation tooling and benchmarking workflows.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/benchmarks",
    label: "Benchmarks",
    summary:
      "Catalog of benchmark suites and evaluation programs offered by Blueprint.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/rl-training",
    label: "RL Training",
    summary:
      "Guidance on reinforcement learning training workflows with SimReady data.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/case-studies",
    label: "Case Studies",
    summary:
      "Examples of how teams use Blueprint environments to accelerate R&D.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/careers",
    label: "Careers",
    summary:
      "Hiring and contractor opportunities focused on simulation-ready assets.",
    changefreq: "weekly",
    priority: 0.6,
  },
  {
    path: "/contact",
    label: "Contact",
    summary:
      "Sales and partnership intake for marketplace procurement and custom scenes.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/partners",
    label: "Partner Program",
    summary:
      "Partnership opportunities for studios and robotics teams collaborating with Blueprint.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/privacy",
    label: "Privacy",
    summary:
      "Privacy policy covering data collection, usage, and vendor relationships.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/terms",
    label: "Terms",
    summary:
      "Terms of service for Blueprint services and marketplace purchases.",
    changefreq: "yearly",
    priority: 0.3,
  },
];

export const publicRouteAliases = [
  {
    path: "/environments",
    aliasFor: "/marketplace",
    reason: "Backwards-compatible alias for the marketplace route.",
  },
];

export const excludedPrivateRoutes = [
  {
    path: "/marketplace/:slug",
    reason: "Environment detail pages require authentication and include gated content.",
  },
  {
    path: "/environments/:slug",
    reason: "Legacy environment detail pages require authentication.",
  },
  {
    path: "/benchmarks/:slug",
    reason: "Benchmark detail pages are user-specific and gated.",
  },
  {
    path: "/portal",
    reason: "Partner portal content is not intended for public discovery.",
  },
  {
    path: "/login",
    reason: "Authentication entry point, not a content page.",
  },
  {
    path: "/forgot-password",
    reason: "Password recovery flow, not a content page.",
  },
  {
    path: "/settings",
    reason: "User settings are account-specific and private.",
  },
];
