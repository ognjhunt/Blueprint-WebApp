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
import Home from "../client/src/pages/Home";
import Capture from "../client/src/pages/Capture";
import CaptureAppPlaceholder from "../client/src/pages/CaptureAppPlaceholder";
import Contact from "../client/src/pages/Contact";
import Sites from "../client/src/pages/Sites";
import SiteDetail from "../client/src/pages/SiteDetail";
import Pricing from "../client/src/pages/Pricing";
import Privacy from "../client/src/pages/Privacy";
import Terms from "../client/src/pages/Terms";
import Login from "../client/src/pages/Login";
import HowItWorks from "../client/src/pages/HowItWorks";
import About from "../client/src/pages/About";
import Vision from "../client/src/pages/Vision";
import Governance from "../client/src/pages/Governance";
import ForSiteOperators from "../client/src/pages/ForSiteOperators";
import { siteLibrarySites } from "../client/src/data/siteLibrary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type StaticRoute = {
  path: string;
  component: ComponentType;
  props?: Record<string, unknown>;
  shell?: "site" | "bare";
};

function BareStaticPage({
  title,
  description,
  eyebrow,
  heading,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  rows,
  canonical,
  noIndex = false,
}: {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  rows: string[];
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
      <main className="min-h-screen bg-[#f8f4ec] px-6 py-8 text-[#111110]">
        <section className="mx-auto max-w-[72rem] overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_30px_90px_-70px_rgba(17,17,16,0.5)]">
          <div className="border-b border-black/10 bg-[#111110] px-6 py-4 text-white">
            <a href="/" className="font-serif text-3xl tracking-[-0.05em]">
              Blueprint
            </a>
          </div>
          <div className="grid gap-8 p-7 lg:grid-cols-[0.6fr_0.4fr] lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/46">
                {eyebrow}
              </p>
              <h1 className="mt-5 max-w-[12ch] text-[clamp(3rem,6vw,5.4rem)] font-semibold leading-[0.88] tracking-[-0.08em]">
                {heading}
              </h1>
              <p className="mt-6 max-w-[34rem] text-base leading-8 text-black/62">{body}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={primaryHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#111110] px-6 text-sm font-semibold text-white"
                >
                  {primaryLabel}
                </a>
                {secondaryHref && secondaryLabel ? (
                  <a
                    href={secondaryHref}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 px-6 text-sm font-semibold text-[#111110]"
                  >
                    {secondaryLabel}
                  </a>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row} className="rounded-[1.25rem] border border-black/10 bg-[#faf7f1] p-5 text-sm leading-7 text-black/62">
                  {row}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

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

const PrerenderPortal = () => (
  <BareStaticPage
    title="Portal | Blueprint"
    description="Private operations hub for protected Blueprint requests and review workflows."
    eyebrow="Private Workspace"
    heading="Private operations hub"
    body="The Blueprint portal is invite-only. Sign in to view protected request queues, assignments, evidence packages, and hosted-review workflow state."
    primaryHref="/sign-in"
    primaryLabel="Sign in"
    secondaryHref="/contact?persona=robot-team"
    secondaryLabel="Request access"
    rows={[
      "Protected request and package state stays behind authenticated access.",
      "Hosted review outputs, exports, and rights context are visible only to approved users.",
      "New teams should request buyer access before expecting a private portal workspace.",
    ]}
    canonical="/portal"
    noIndex
  />
);

const PrerenderBusinessSignup = () => (
  <BareStaticPage
    title="Buyer Access Request | Blueprint"
    description="Request buyer access for exact-site packages and hosted evaluation."
    eyebrow="Buyer Access Request"
    heading="Request exact-site access"
    body="Use this path when your team needs a site-specific world-model package, hosted review, or private buyer workflow grounded in one real facility."
    primaryHref="/signup/business"
    primaryLabel="Open buyer request"
    secondaryHref="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=signup-prerender"
    secondaryLabel="Request site review"
    rows={[
      "Blueprint reviews organization, site, robot, workflow, and requested lane before opening access.",
      "Package and hosted-review requests stay tied to capture provenance, rights, privacy, and export scope.",
      "Existing portal users should sign in instead of creating a second account path.",
    ]}
    canonical="/signup/business"
    noIndex
  />
);

const PrerenderCapturerSignup = () => (
  <BareStaticPage
    title="Capturer Access | Blueprint"
    description="Apply for capturer access and complete the Blueprint mobile capture handoff."
    eyebrow="Capturer Access"
    heading="Apply to capture real places"
    body="Capturer access is review-based by market. Apply on web, then use Blueprint Capture only for lawful public-facing routes with privacy and restricted-zone rules visible."
    primaryHref="/signup/capturer"
    primaryLabel="Open capturer application"
    secondaryHref="/capture-app/launch-access"
    secondaryLabel="Request city access"
    rows={[
      "Accepted captures focus on everyday public-facing spaces, not private or restricted areas.",
      "Blueprint reviews coverage, privacy, usefulness, and market fit before a capture becomes downstream output.",
      "Approval and payout eligibility are not automatic; each submission remains review-gated.",
    ]}
    canonical="/signup/capturer"
    noIndex
  />
);

const PrerenderForgotPassword = () => (
  <BareStaticPage
    title="Reset Password | Blueprint"
    description="Reset your Blueprint account password."
    eyebrow="Secure Access Recovery"
    heading="Reset your password"
    body="Use the secure reset flow if you already have a Blueprint account. The live form sends a reset link without exposing whether an account exists."
    primaryHref="/forgot-password"
    primaryLabel="Open reset flow"
    secondaryHref="/sign-in"
    secondaryLabel="Back to sign in"
    rows={[
      "Password reset is for existing Blueprint portal users.",
      "New robot teams should request buyer access; capturers should use the capturer application.",
      "If the reset link does not arrive, contact Blueprint from the same work email.",
    ]}
    canonical="/forgot-password"
    noIndex
  />
);

const PrerenderProofSummary = () => (
  <MinimalStaticPage
    title="Proof | Blueprint"
    description="Blueprint keeps policy evaluation claims scoped to the site, task, robot, and evidence behind each run."
    heading="Proof stays scoped"
    body="Generated clips help review. Real-world validation requires the matched robot, task, and site envelope."
    primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run"
    primaryLabel="Start"
    canonical="/proof"
  />
);

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

const PrerenderRobotTeamEvalSummary = () => (
  <MinimalStaticPage
    title="Robot Team Evaluation | Blueprint"
    description="Start a four-step policy evaluation request for a captured task pack."
    heading="Start an evaluation"
    body="Pick a site task, add policies, tell us the robot, and choose 100 or 500 episodes."
    primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run"
    primaryLabel="Start"
    canonical="/robot-team/eval"
  />
);

const PrerenderAdminCityLaunchSummary = () => (
  <MinimalStaticPage
    title="City Launch Scorecard | Blueprint"
    description="Protected city-launch scorecard shell for Blueprint operators."
    heading="City launch scorecard"
    body="This protected operations route loads the city-launch scorecard for approved Blueprint operators after sign-in."
    primaryHref="/sign-in"
    primaryLabel="Sign in"
    canonical="/admin/city-launch/austin"
    noIndex
  />
);

const PrerenderAdminQueueSummary = () => (
  <MinimalStaticPage
    title="Admin Queue | Blueprint"
    description="Protected Blueprint admin queue shell."
    heading="Protected admin queue"
    body="This protected operations route loads approved Blueprint queue details after sign-in."
    primaryHref="/sign-in"
    primaryLabel="Sign in"
    canonical="/admin/leads"
    noIndex
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

const PrerenderHomeSummary = () => (
  <MinimalStaticPage
    title="Blueprint | Test Robot Policies Before Field Time"
    description="Blueprint helps robot teams test and rank policies on captured real-site task packs before field time."
    heading="Test robot policies before field time"
    body="Use captured real-site tasks to see what works before the robot goes onsite."
    primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run"
    primaryLabel="Start"
    canonical="/"
  />
);

function makePrerenderSiteAccessSummary(site: (typeof siteLibrarySites)[number]) {
  return function PrerenderSiteAccessSummary() {
    return (
      <MinimalStaticPage
        title={`${site.name} Access | Blueprint`}
        description={`Request access to the ${site.name} exact-site package and hosted evaluation workspace.`}
        heading="Request site package access"
        body={`${site.name} is shown as a request-scoped exact-site package surface. Access, export scope, rights, and hosted review depend on the approved buyer request.`}
        primaryHref={`/sites/${site.slug}`}
        primaryLabel="View site package"
        canonical={`/sites/${site.slug}`}
      />
    );
  };
}

const captureAliasRoutes = [
  "/capture-jobs",
  "/capture-network",
  "/capturer",
  "/capturers",
  "/capturer-access",
  "/become-a-capturer",
  "/for-capturers",
  "/earn",
].map((routePath) => ({ path: routePath, component: Capture }));

const contactAliasRoutes = [
  "/launch-map",
  "/city/austin",
  "/agents",
  "/contact",
  "/help",
  "/help/contact",
  "/help/category/capture",
  "/help/article/package-access",
  "/book-exact-site-review",
  "/careers",
  "/partners",
].map((routePath) => ({ path: routePath, component: Contact }));

const homeAliasRoutes = [
  "/for-robot-integrators",
  "/product",
  "/readiness",
  "/readiness-pack",
  "/exact-site-hosted-review",
  "/updates",
  "/blog",
  "/solutions",
  "/quality-standard",
].map((routePath) => ({ path: routePath, component: PrerenderHomeSummary, shell: "bare" as const }));

const proofAliasRoutes = [
  "/sample-evaluation",
  "/sample-deliverables",
  "/case-studies",
  "/faq",
  "/docs",
  "/qualified-opportunities",
  "/qualified-opportunities-guide",
  "/pilot-exchange",
  "/pilot-exchange-guide",
  "/environments",
].map((routePath) => ({ path: routePath, component: PrerenderProofSummary, shell: "bare" as const }));

const staticRoutes: StaticRoute[] = [
  { path: "/", component: Home },
  ...homeAliasRoutes,
  { path: "/capture", component: Capture },
  ...captureAliasRoutes,
  { path: "/capture-app", component: CaptureAppPlaceholder },
  { path: "/capture-app/launch-access", component: PrerenderCaptureLaunchAccessSummary, shell: "bare" },
  // Prerender the real pricing page: crawlers, link previews, and no-JS
  // agents must see the actual tiers and prices, not a summary that omits
  // them (WSPEC context: the summary shell made /pricing look price-free).
  { path: "/pricing", component: Pricing },
  { path: "/sites", component: Sites },
  { path: "/world-models", component: Sites },
  { path: "/site-worlds", component: Sites },
  { path: "/marketplace", component: Sites },
  ...siteLibrarySites.map((site) => ({
    path: `/sites/${site.slug}`,
    component: SiteDetail as ComponentType<any>,
    props: { params: { slug: site.slug } },
  })),
  ...siteLibrarySites.flatMap((site) =>
    [
      `/world-models/${site.slug}`,
      `/world-models/${site.slug}/start`,
      `/site-worlds/${site.slug}`,
      `/site-worlds/${site.slug}/start`,
      `/site-worlds/${site.slug}/workspace`,
    ].map((routePath) => ({
      path: routePath,
      component: makePrerenderSiteAccessSummary(site),
      shell: "bare" as const,
    })),
  ),
  { path: "/proof", component: PrerenderProofSummary, shell: "bare" },
  ...proofAliasRoutes,
  { path: "/for-robot-teams", component: PrerenderRobotTeamEvalSummary, shell: "bare" },
  { path: "/robot-team/eval", component: PrerenderRobotTeamEvalSummary, shell: "bare" },
  // Live public pages (also advertised in the sitemap) prerender as their
  // real components so crawlers and no-JS agents see the actual content.
  { path: "/for-site-operators", component: ForSiteOperators },
  { path: "/how-it-works", component: HowItWorks },
  { path: "/about", component: About },
  { path: "/vision", component: Vision },
  { path: "/governance", component: Governance },
  ...contactAliasRoutes,
  { path: "/contact/robot-team", component: Contact },
  { path: "/contact/site-operator", component: Contact },
  { path: "/sign-in", component: Login },
  { path: "/login", component: Login },
  { path: "/portal", component: PrerenderPortal, shell: "bare" },
  { path: "/signup", component: PrerenderBusinessSignup, shell: "bare" },
  { path: "/signup/business", component: PrerenderBusinessSignup, shell: "bare" },
  { path: "/signup/robot-team", component: PrerenderBusinessSignup, shell: "bare" },
  { path: "/signup/site-operator", component: PrerenderBusinessSignup, shell: "bare" },
  { path: "/signup/capturer", component: PrerenderCapturerSignup, shell: "bare" },
  { path: "/forgot-password", component: PrerenderForgotPassword, shell: "bare" },
  { path: "/privacy", component: Privacy, shell: "bare" },
  { path: "/terms", component: Terms, shell: "bare" },
  { path: "/admin/leads", component: PrerenderAdminQueueSummary, shell: "bare" },
  { path: "/admin/leads/perf-request", component: PrerenderAdminQueueSummary, shell: "bare" },
  { path: "/admin/submissions", component: PrerenderAdminQueueSummary, shell: "bare" },
  { path: "/admin/submissions/perf-request", component: PrerenderAdminQueueSummary, shell: "bare" },
  { path: "/admin/city-launch/austin", component: PrerenderAdminCityLaunchSummary, shell: "bare" },
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

  for (const route of staticRoutes) {
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
