import fs from "node:fs";
import path from "node:path";
import { siteWorldCards } from "../client/src/data/siteWorlds";

const BASE_URL = "https://tryblueprint.io";
const BUILD_DATE =
  process.env.SITEMAP_LASTMOD_DATE || process.env.SOURCE_DATE_EPOCH
    ? new Date(
        Number.isFinite(Number(process.env.SOURCE_DATE_EPOCH))
          ? Number(process.env.SOURCE_DATE_EPOCH) * 1000
          : `${process.env.SITEMAP_LASTMOD_DATE}T00:00:00.000Z`,
      )
        .toISOString()
        .slice(0, 10)
    : "2026-03-13";

const routes = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/how-it-works", changefreq: "weekly", priority: 0.9 },
  { path: "/world-models", changefreq: "weekly", priority: 0.9 },
  { path: "/sample-deliverables", changefreq: "weekly", priority: 0.8 },
  { path: "/case-studies", changefreq: "weekly", priority: 0.8 },
  ...siteWorldCards.map((site) => ({
    path: `/world-models/${site.id}`,
    changefreq: "weekly",
    priority: 0.8,
  })),
  { path: "/for-robot-teams", changefreq: "weekly", priority: 0.8 },
  { path: "/for-site-operators", changefreq: "monthly", priority: 0.7 },
  { path: "/solutions", changefreq: "monthly", priority: 0.7 },
  { path: "/pricing", changefreq: "monthly", priority: 0.7 },
  { path: "/contact", changefreq: "monthly", priority: 0.6 },
  { path: "/faq", changefreq: "monthly", priority: 0.6 },
  { path: "/docs", changefreq: "monthly", priority: 0.6 },
  { path: "/blog", changefreq: "monthly", priority: 0.5 },
  { path: "/governance", changefreq: "monthly", priority: 0.5 },
  { path: "/about", changefreq: "monthly", priority: 0.5 },
  { path: "/careers", changefreq: "weekly", priority: 0.5 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/terms", changefreq: "yearly", priority: 0.3 },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  routes
    .map(({ path: routePath, changefreq, priority }) => {
      const loc = routePath === "/" ? `${BASE_URL}/` : `${BASE_URL}${routePath}`;
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${BUILD_DATE}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n") +
  "\n</urlset>\n";

const outputPath = path.resolve("dist", "public", "sitemap.xml");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, xml, "utf8");

console.log(`Sitemap written to ${outputPath}`);
