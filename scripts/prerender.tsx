import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";

import { queryClient } from "../client/src/lib/queryClient";
import { AuthProvider } from "../client/src/contexts/AuthContext";
import { SiteLayout } from "../client/src/components/site/SiteLayout";
import Home from "../client/src/pages/Home";
import Capture from "../client/src/pages/Capture";
import CaptureAppPlaceholder from "../client/src/pages/CaptureAppPlaceholder";
import SiteWorlds from "../client/src/pages/SiteWorlds";
import SiteWorldDetail from "../client/src/pages/SiteWorldDetail";
import ForSiteOperators from "../client/src/pages/ForSiteOperators";
import ForRobotIntegrators from "../client/src/pages/ForRobotIntegrators";
import Solutions from "../client/src/pages/Solutions";
import Pricing from "../client/src/pages/Pricing";
import Contact from "../client/src/pages/Contact";
import HowItWorks from "../client/src/pages/HowItWorks";
import FAQ from "../client/src/pages/FAQ";
import Governance from "../client/src/pages/Governance";
import About from "../client/src/pages/About";
import Careers from "../client/src/pages/Careers";
import ReadinessPack from "../client/src/pages/ReadinessPack";
import PilotExchange from "../client/src/pages/PilotExchange";
import PilotExchangeGuide from "../client/src/pages/PilotExchangeGuide";
import Privacy from "../client/src/pages/Privacy";
import Terms from "../client/src/pages/Terms";
import Login from "../client/src/pages/Login";
import Blog from "../client/src/pages/Blog";
import Docs from "../client/src/pages/Docs";
import { siteWorldCards } from "../client/src/data/siteWorlds";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type StaticRoute = {
  path: string;
  component: ComponentType;
  props?: Record<string, unknown>;
};

const staticRoutes: StaticRoute[] = [
  { path: "/", component: Home },
  { path: "/capture", component: Capture },
  { path: "/world-models", component: SiteWorlds },
  { path: "/site-worlds", component: SiteWorlds },
  { path: "/capture-app", component: CaptureAppPlaceholder },
  { path: "/for-site-operators", component: ForSiteOperators },
  { path: "/for-robot-teams", component: ForRobotIntegrators },
  { path: "/for-robot-integrators", component: ForRobotIntegrators },
  { path: "/solutions", component: Solutions },
  { path: "/pricing", component: Pricing },
  { path: "/contact", component: Contact },
  { path: "/how-it-works", component: HowItWorks },
  { path: "/faq", component: FAQ },
  { path: "/governance", component: Governance },
  { path: "/about", component: About },
  { path: "/docs", component: Docs },
  { path: "/blog", component: Blog },
  { path: "/careers", component: Careers },
  { path: "/sign-in", component: Login },
  { path: "/quality-standard", component: ReadinessPack },
  { path: "/readiness-pack", component: ReadinessPack },
  { path: "/qualified-opportunities", component: PilotExchange },
  { path: "/qualified-opportunities-guide", component: PilotExchangeGuide },
  { path: "/pilot-exchange", component: PilotExchange },
  { path: "/pilot-exchange-guide", component: PilotExchangeGuide },
  { path: "/partners", component: Contact },
  { path: "/privacy", component: Privacy },
  { path: "/terms", component: Terms },
  ...siteWorldCards.map((site) => ({
    path: `/world-models/${site.id}`,
    component: SiteWorldDetail,
    props: { params: { slug: site.id } },
  })),
];

const rootPattern = /<div id="root"><\/div>/;

function routePathToFile(distPath: string, routePath: string) {
  if (routePath === "/") {
    return path.join(distPath, "index.html");
  }

  return path.join(distPath, routePath.replace(/^\//, ""), "index.html");
}

function renderRoute(route: StaticRoute) {
  const Page = route.component;
  const markup = renderToStaticMarkup(
    <Router ssrPath={route.path}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SiteLayout>
            <Page {...(route.props || {})} />
          </SiteLayout>
        </AuthProvider>
      </QueryClientProvider>
    </Router>,
  );
  const helmet = Helmet.renderStatic();

  return { markup, helmet };
}

function injectHelmet(template: string, helmet: ReturnType<typeof Helmet.renderStatic>) {
  const injectedHead = [
    helmet.title.toString(),
    helmet.priority?.toString?.() ?? "",
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.script.toString(),
  ]
    .filter(Boolean)
    .join("\n");

  return template.replace("</head>", `${injectedHead}\n</head>`);
}

async function main() {
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  const templatePath = path.join(distPath, "index.html");
  const template = await fs.promises.readFile(templatePath, "utf8");

  if (!rootPattern.test(template)) {
    throw new Error("Could not locate the root element in the built HTML template.");
  }

  for (const route of staticRoutes) {
    const { markup, helmet } = renderRoute(route);
    const html = injectHelmet(
      template.replace(rootPattern, `<div id="root">${markup}</div>`),
      helmet,
    );
    const outputFile = routePathToFile(distPath, route.path);

    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.promises.writeFile(outputFile, html, "utf8");
  }
}

await main();
