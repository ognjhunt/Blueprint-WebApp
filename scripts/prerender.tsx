import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Helmet } from "react-helmet";
import { SiteLayout } from "../client/src/components/site/SiteLayout";
import Home from "../client/src/pages/Home";
import WhySimulation from "../client/src/pages/WhySimulation";
import Environments from "../client/src/pages/Environments";
import Solutions from "../client/src/pages/Solutions";
import Pricing from "../client/src/pages/Pricing";
import Learn from "../client/src/pages/Learn";
import Docs from "../client/src/pages/Docs";
import Evals from "../client/src/pages/Evals";
import RLTraining from "../client/src/pages/RLTraining";
import CaseStudies from "../client/src/pages/CaseStudies";
import Careers from "../client/src/pages/Careers";
import Contact from "../client/src/pages/Contact";
import PartnerProgram from "../client/src/pages/PartnerProgram";
import Portal from "../client/src/pages/Portal";
import Login from "../client/src/pages/Login";
import ForgotPassword from "../client/src/pages/ForgotPassword";
import Privacy from "../client/src/pages/Privacy";
import Terms from "../client/src/pages/Terms";
import NotFound from "../client/src/pages/NotFound";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentMap: Record<string, React.ComponentType> = {
  Home,
  WhySimulation,
  Environments,
  Solutions,
  Pricing,
  Learn,
  Docs,
  Evals,
  RLTraining,
  CaseStudies,
  Careers,
  Contact,
  PartnerProgram,
  Portal,
  Login,
  ForgotPassword,
  Privacy,
  Terms,
  NotFound,
};

const routePattern =
  /<Route\s+path="([^"]+)"[\s\S]*?component=\{withLayout\(([^)]+)\)\}[\s\S]*?\/>/g;

const rootPattern = /<div id="root"><\/div>/;

function routePathToFile(distPath: string, routePath: string) {
  if (routePath === "/") {
    return path.join(distPath, "index.html");
  }

  return path.join(distPath, routePath.replace(/^\//, ""), "index.html");
}

function renderRoute(component: React.ComponentType) {
  const markup = renderToStaticMarkup(
    <SiteLayout>
      {React.createElement(component)}
    </SiteLayout>
  );
  const helmet = Helmet.renderStatic();

  return {
    markup,
    helmet,
  };
}

async function main() {
  const mainPath = path.resolve(__dirname, "..", "client", "src", "main.tsx");
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  const templatePath = path.join(distPath, "index.html");

  const [mainSource, template] = await Promise.all([
    fs.promises.readFile(mainPath, "utf8"),
    fs.promises.readFile(templatePath, "utf8"),
  ]);

  if (!rootPattern.test(template)) {
    throw new Error("Could not locate the root element in the template HTML.");
  }

  const routes = Array.from(mainSource.matchAll(routePattern)).map((match) => ({
    path: match[1],
    componentName: match[2],
  }));

  const staticRoutes = routes.filter(
    (route) => !route.path.includes(":") && route.path.length > 0
  );

  if (staticRoutes.length === 0) {
    throw new Error("No static routes found for prerendering.");
  }

  for (const route of staticRoutes) {
    const component = componentMap[route.componentName];
    if (!component) {
      throw new Error(
        `Missing component mapping for ${route.componentName} (${route.path}).`
      );
    }

    const { markup, helmet } = renderRoute(component);
    const html = template
      .replace(rootPattern, `<div id="root">${markup}</div>`)
      .replace(
        "</head>",
        [
          helmet.title.toString(),
          helmet.meta.toString(),
          helmet.link.toString(),
          helmet.script.toString(),
        ].join("\n") + "\n</head>"
      );

    const outputFile = routePathToFile(distPath, route.path);
    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.promises.writeFile(outputFile, html, "utf8");
  }
}

await main();
