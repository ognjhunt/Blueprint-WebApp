import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://tryblueprint.io";
const BUILD_DATE = new Date().toISOString().slice(0, 10);

const routes = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/how-it-works", changefreq: "weekly", priority: 0.9 },
  { path: "/readiness-pack", changefreq: "weekly", priority: 0.9 },
  { path: "/qualified-opportunities", changefreq: "weekly", priority: 0.7 },
  { path: "/qualified-opportunities-guide", changefreq: "weekly", priority: 0.8 },
  { path: "/marketplace", changefreq: "monthly", priority: 0.4 },
  { path: "/solutions", changefreq: "monthly", priority: 0.8 },
  { path: "/pricing", changefreq: "monthly", priority: 0.8 },
  { path: "/contact", changefreq: "monthly", priority: 0.6 },
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

const outputPath = path.resolve("client", "public", "sitemap.xml");
fs.writeFileSync(outputPath, xml, "utf8");

console.log(`Sitemap written to ${outputPath}`);
