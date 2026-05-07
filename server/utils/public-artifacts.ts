import path from "node:path";
import { siteWorldCards } from "../../client/src/data/siteWorlds";

export type SitemapRoute = {
  changefreq: "weekly" | "monthly" | "yearly";
  path: string;
  priority: number;
};

export const sitemapBaseUrl = "https://tryblueprint.io";

const staticSitemapRoutes: SitemapRoute[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/product", changefreq: "weekly", priority: 0.9 },
  { path: "/world-models", changefreq: "weekly", priority: 0.9 },
  { path: "/proof", changefreq: "weekly", priority: 0.8 },
  { path: "/capture", changefreq: "monthly", priority: 0.7 },
  { path: "/pricing", changefreq: "monthly", priority: 0.7 },
  { path: "/contact", changefreq: "monthly", priority: 0.7 },
  { path: "/updates", changefreq: "monthly", priority: 0.6 },
  { path: "/capture-app/launch-access", changefreq: "monthly", priority: 0.6 },
  { path: "/governance", changefreq: "monthly", priority: 0.5 },
  { path: "/help", changefreq: "monthly", priority: 0.5 },
  { path: "/faq", changefreq: "monthly", priority: 0.5 },
  { path: "/about", changefreq: "monthly", priority: 0.5 },
  { path: "/careers", changefreq: "weekly", priority: 0.5 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/terms", changefreq: "yearly", priority: 0.3 },
];

export const sitemapRoutes: SitemapRoute[] = [
  ...staticSitemapRoutes,
  ...siteWorldCards.map(
    (site): SitemapRoute => ({
      path: `/world-models/${site.id}`,
      changefreq: "weekly",
      priority: 0.8,
    }),
  ),
];

export function getPublicAssetDir(isProduction: boolean) {
  return path.resolve(process.cwd(), isProduction ? "dist/public" : "client/public");
}

export function getPublicAssetPath(isProduction: boolean, fileName: string) {
  return path.join(getPublicAssetDir(isProduction), fileName);
}

export function getSitemapBuildDate() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceDateEpoch && Number.isFinite(Number(sourceDateEpoch))) {
    return new Date(Number(sourceDateEpoch) * 1000).toISOString().slice(0, 10);
  }

  const sitemapLastModDate = process.env.SITEMAP_LASTMOD_DATE;
  if (sitemapLastModDate && sitemapLastModDate.trim()) {
    return new Date(`${sitemapLastModDate.trim()}T00:00:00.000Z`)
      .toISOString()
      .slice(0, 10);
  }

  return "2026-05-07";
}

export function buildSitemapXml(buildDate = getSitemapBuildDate()) {
  const xml = sitemapRoutes
    .map(({ path: routePath, changefreq, priority }) => {
      const loc = routePath === "/" ? `${sitemapBaseUrl}/` : `${sitemapBaseUrl}${routePath}`;
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${buildDate}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xml}\n</urlset>\n`;
}
