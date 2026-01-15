import fs from "node:fs";
import path from "node:path";
import { publicRoutes } from "../client/src/routes/publicRoutes";
import { render } from "../client/src/entry-server";

const distRoot = path.resolve("dist", "public");
const templatePath = path.join(distRoot, "index.html");

if (!fs.existsSync(templatePath)) {
  throw new Error(
    `Missing ${templatePath}. Run the client build before prerendering.`,
  );
}

const template = fs.readFileSync(templatePath, "utf-8");

const normalizeRoute = (routePath: string) => {
  if (routePath === "/") {
    return "/";
  }
  return routePath.replace(/\/+$/, "");
};

const seen = new Set<string>();
const routes = publicRoutes
  .map((route) => normalizeRoute(route.path))
  .filter((route) => {
    if (seen.has(route)) {
      return false;
    }
    seen.add(route);
    return true;
  });

const hasHeadPlaceholder = template.includes("<!--app-head-->");
const hasHtmlPlaceholder = template.includes("<!--app-html-->");

if (!hasHeadPlaceholder || !hasHtmlPlaceholder) {
  throw new Error(
    "Prerender placeholders are missing from index.html. Add <!--app-head--> and <!--app-html-->.",
  );
}

for (const route of routes) {
  const { html, head } = render(route);
  const page = template
    .replace("<!--app-head-->", head)
    .replace("<!--app-html-->", html);

  const outputPath =
    route === "/"
      ? templatePath
      : path.join(distRoot, route.slice(1), "index.html");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, page, "utf-8");
  console.log(`Prerendered ${route} -> ${outputPath}`);
}
