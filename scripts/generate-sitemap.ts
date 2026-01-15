import fs from "node:fs";
import path from "node:path";
import { publicRoutes } from "../client/src/routes/publicRoutes";

const BASE_URL = "https://tryblueprint.io";
const BUILD_DATE = new Date().toISOString().slice(0, 10);

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  publicRoutes
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
