import path from "node:path";

export type SitemapRoute = {
  changefreq: "weekly" | "monthly" | "yearly";
  path: string;
  priority: number;
};

export const sitemapBaseUrl = "https://tryblueprint.io";

const staticSitemapRoutes: SitemapRoute[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/sites", changefreq: "weekly", priority: 0.9 },
  { path: "/capture", changefreq: "weekly", priority: 0.8 },
  { path: "/pricing", changefreq: "monthly", priority: 0.8 },
  { path: "/proof", changefreq: "monthly", priority: 0.8 },
  { path: "/faq", changefreq: "monthly", priority: 0.7 },
  { path: "/for-robot-teams", changefreq: "monthly", priority: 0.8 },
  { path: "/for-site-operators", changefreq: "monthly", priority: 0.8 },
  { path: "/how-it-works", changefreq: "monthly", priority: 0.8 },
  { path: "/contact/robot-team", changefreq: "monthly", priority: 0.8 },
  { path: "/contact/site-operator", changefreq: "monthly", priority: 0.7 },
  { path: "/about", changefreq: "monthly", priority: 0.5 },
  { path: "/vision", changefreq: "monthly", priority: 0.5 },
  { path: "/governance", changefreq: "monthly", priority: 0.5 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/terms", changefreq: "yearly", priority: 0.3 },
];

export const sitemapRoutes: SitemapRoute[] = staticSitemapRoutes;

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

  return new Date().toISOString().slice(0, 10);
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
