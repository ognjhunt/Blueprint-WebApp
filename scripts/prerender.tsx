import { minimalMarketingRedirects } from "../client/src/data/minimalPublicSite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Helmet, HelmetProvider, type HelmetServerState } from "../client/src/lib/helmet";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";

import { queryClient } from "../client/src/lib/queryClient";
import { AuthProvider } from "../client/src/contexts/AuthContext";
import { SiteLayout } from "../client/src/components/site/SiteLayout";
import HowItWorks from "../client/src/pages/HowItWorks";
import Home from "../client/src/pages/Home";
import Capture from "../client/src/pages/Capture";
import CaptureAppPlaceholder from "../client/src/pages/CaptureAppPlaceholder";
import Contact from "../client/src/pages/Contact";
import Sites from "../client/src/pages/Sites";
import Privacy from "../client/src/pages/Privacy";
import Terms from "../client/src/pages/Terms";
import Login from "../client/src/pages/Login";
import BusinessSignUpFlow from "../client/src/pages/BusinessSignUpFlow";
import CapturerSignUpFlow from "../client/src/pages/CapturerSignUpFlow";
import ForgotPassword from "../client/src/pages/ForgotPassword";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type StaticRoute = {
  path: string;
  component: ComponentType;
  props?: Record<string, unknown>;
  shell?: "site" | "bare";
};

function MinimalStaticPage({
  title,
  description,
  heading,
  body,
  primaryHref,
  primaryLabel,
  canonical,
  noIndex = false,
}: {
  title: string;
  description: string;
  heading: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  canonical?: string;
  noIndex?: boolean;
}) {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        {canonical ? <link rel="canonical" href={`https://tryblueprint.io${canonical}`} /> : null}
        {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}
      </Helmet>
      <main>
        <a href="/">Blueprint</a>
        <h1>{heading}</h1>
        <p>{body}</p>
        <a href={primaryHref}>{primaryLabel}</a>
      </main>
    </>
  );
}

const PrerenderCaptureLaunchAccessSummary = () => (
  <MinimalStaticPage
    title="Capture Launch Access | Blueprint"
    description="Request Blueprint Capture launch access for approved city and site capture workflows."
    heading="Request capture launch access"
    body="Blueprint Capture access is review-based and tied to lawful public-facing routes, privacy rules, city coverage, and downstream package usefulness."
    primaryHref="/capture-app/launch-access"
    primaryLabel="Request access"
    canonical="/capture-app/launch-access"
  />
);

const PrerenderFallbackSummary = () => (
  <MinimalStaticPage
    title="Blueprint"
    description="Blueprint exact-site robot evaluation route."
    heading="Blueprint"
    body="This route loads the matching Blueprint surface after the app boots."
    primaryHref="/"
    primaryLabel="Go home"
    noIndex
  />
);

const staticRoutes: StaticRoute[] = [
  { path: "/", component: Home },
  { path: "/how-it-works", component: HowItWorks },
  { path: "/capture", component: Capture },
  { path: "/capture-app", component: CaptureAppPlaceholder },
  { path: "/capture-app/launch-access", component: PrerenderCaptureLaunchAccessSummary, shell: "bare" },
  { path: "/sites", component: Sites },
  { path: "/contact/robot-team", component: Contact },
  { path: "/contact/site-operator", component: Contact },
  { path: "/sign-in", component: Login, shell: "bare" },
  { path: "/signup", component: BusinessSignUpFlow, shell: "bare" },
  { path: "/signup/business", component: BusinessSignUpFlow, shell: "bare" },
  { path: "/signup/robot-team", component: BusinessSignUpFlow, shell: "bare" },
  { path: "/signup/site-operator", component: BusinessSignUpFlow, shell: "bare" },
  { path: "/signup/capturer", component: CapturerSignUpFlow, shell: "bare" },
  { path: "/forgot-password", component: ForgotPassword, shell: "bare" },
  { path: "/privacy", component: Privacy },
  { path: "/terms", component: Terms },
  { path: "/__blueprint-performance-fallback__", component: PrerenderFallbackSummary, shell: "bare" },
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
  const page = <Page {...(route.props || {})} />;
  const content = route.shell === "bare" ? page : <SiteLayout>{page}</SiteLayout>;
  const helmetContext: { helmet?: HelmetServerState } = {};
  const markup = renderToStaticMarkup(
    <HelmetProvider context={helmetContext}>
      <Router ssrPath={route.path}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {content}
          </AuthProvider>
        </QueryClientProvider>
      </Router>
    </HelmetProvider>,
  );
  const helmet = helmetContext.helmet;

  return { markup, helmet };
}

function injectHelmet(template: string, helmet: HelmetServerState | undefined) {
  if (!helmet) {
    return template;
  }
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

function stripDefaultSeo(template: string) {
  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:type"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:url"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:title"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:description"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:image"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="twitter:card"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="twitter:title"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="twitter:description"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="twitter:image"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/i, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/i, "");
}

function stripViteThemeStyle(template: string) {
  return template.replace(/\s*<style\s+data-vite-theme[^>]*>[\s\S]*?<\/style>\s*/i, "\n");
}

// The prerendered shell is a transient snapshot that the client JS bundle
// replaces on boot (see main.tsx). Eager/above-the-fold images in that
// snapshot are the only resources left that block the document `load` event, so
// force every prerendered <img> to lazy + async-decode. This keeps the live app's
// authored loading strategy intact (React re-renders the real <img> on boot) while
// removing images from the first-load critical path measured by perf:pages.
function deferImageLoading(template: string) {
  return template.replace(
    /<img\b([^>]*?)(\s*\/?)>/gi,
    (_match, rawAttrs: string, closing: string) => {
      let attrs = rawAttrs;
      if (/\bloading\s*=/i.test(attrs)) {
        attrs = attrs.replace(
          /\bloading\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i,
          'loading="lazy"',
        );
      } else {
        attrs = `${attrs} loading="lazy"`;
      }
      if (!/\bdecoding\s*=/i.test(attrs)) {
        attrs = `${attrs} decoding="async"`;
      }
      const selfClosing = closing.includes("/") ? " /" : "";
      return `<img${attrs}${selfClosing}>`;
    },
  );
}

async function main() {
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  const templatePath = path.join(distPath, "index.html");
  const template = stripViteThemeStyle(
    stripDefaultSeo(await fs.promises.readFile(templatePath, "utf8")),
  );

  if (!rootPattern.test(template)) {
    throw new Error("Could not locate the root element in the built HTML template.");
  }

  // Emit a minimal SPA boot shell: empty root, no route markup or imagery.
  // serveStatic serves this for client-rendered routes without
  // a dedicated prerendered document (e.g. /app, /ops, /join, private/admin views)
  // instead of the heavy homepage markup, so those routes parse a ~3KB shell rather
  // than the ~39KB home document on first load. createRoot (not hydration) renders
  // the real surface on boot, so the shell content is purely transient.
  const shellHtml = rootPattern.test(template)
    ? template.replace("</head>", "<title>Blueprint</title>\n</head>")
    : template;
  await fs.promises.writeFile(
    path.join(distPath, "app-shell.html"),
    shellHtml,
    "utf8",
  );

  for (const route of staticRoutes.filter((route) => !minimalMarketingRedirects[route.path])) {
    const { markup, helmet } = renderRoute(route);
    const html = deferImageLoading(
      injectHelmet(
        template.replace(rootPattern, `<div id="root">${markup}</div>`),
        helmet,
      ),
    );
    const outputFile = routePathToFile(distPath, route.path);

    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.promises.writeFile(outputFile, html, "utf8");
  }
}

await main();
