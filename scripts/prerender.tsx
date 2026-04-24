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
import CaptureLaunchAccess from "../client/src/pages/CaptureLaunchAccess";
import SiteWorlds from "../client/src/pages/SiteWorlds";
import SiteWorldDetail from "../client/src/pages/SiteWorldDetail";
import HostedSessionSetup from "../client/src/pages/HostedSessionSetup";
import ForSiteOperators from "../client/src/pages/ForSiteOperators";
import ForRobotIntegrators from "../client/src/pages/ForRobotIntegrators";
import Solutions from "../client/src/pages/Solutions";
import Pricing from "../client/src/pages/Pricing";
import SampleDeliverables from "../client/src/pages/SampleDeliverables";
import SampleEvaluation from "../client/src/pages/SampleEvaluation";
import CaseStudies from "../client/src/pages/CaseStudies";
import Contact from "../client/src/pages/Contact";
import Support from "../client/src/pages/Support";
import ExactSiteHostedReview from "../client/src/pages/ExactSiteHostedReview";
import BookExactSiteReview from "../client/src/pages/BookExactSiteReview";
import HowItWorks from "../client/src/pages/HowItWorks";
import FAQ from "../client/src/pages/FAQ";
import Governance from "../client/src/pages/Governance";
import Proof from "../client/src/pages/Proof";
import About from "../client/src/pages/About";
import Careers from "../client/src/pages/Careers";
import Privacy from "../client/src/pages/Privacy";
import Terms from "../client/src/pages/Terms";
import Login from "../client/src/pages/Login";
import Blog from "../client/src/pages/Blog";
import Docs from "../client/src/pages/Docs";
import LaunchMap from "../client/src/pages/LaunchMap";
import { siteWorldCards } from "../client/src/data/siteWorlds";

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
}) {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
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
    secondaryHref="/book-exact-site-review"
    secondaryLabel="Book a scoping call"
    rows={[
      "Blueprint reviews organization, site, robot, workflow, and requested lane before opening access.",
      "Package and hosted-review requests stay tied to capture provenance, rights, privacy, and export scope.",
      "Existing portal users should sign in instead of creating a second account path.",
    ]}
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
  />
);

const staticRoutes: StaticRoute[] = [
  { path: "/", component: Home },
  { path: "/capture", component: Capture },
  { path: "/world-models", component: SiteWorlds },
  { path: "/site-worlds", component: SiteWorlds },
  { path: "/capture-app", component: CaptureAppPlaceholder },
  { path: "/capture-app/launch-access", component: CaptureLaunchAccess },
  { path: "/for-site-operators", component: ForSiteOperators },
  { path: "/for-robot-teams", component: ForRobotIntegrators },
  { path: "/solutions", component: Solutions },
  { path: "/pricing", component: Pricing },
  { path: "/proof", component: Proof },
  { path: "/sample-evaluation", component: SampleEvaluation },
  { path: "/sample-deliverables", component: SampleDeliverables },
  { path: "/case-studies", component: CaseStudies },
  { path: "/contact", component: Contact },
  { path: "/contact/site-operator", component: Contact },
  { path: "/help", component: Support },
  { path: "/exact-site-hosted-review", component: ExactSiteHostedReview },
  { path: "/book-exact-site-review", component: BookExactSiteReview },
  { path: "/how-it-works", component: HowItWorks },
  { path: "/launch-map", component: LaunchMap },
  { path: "/faq", component: FAQ },
  { path: "/governance", component: Governance },
  { path: "/about", component: About },
  { path: "/docs", component: Docs },
  { path: "/blog", component: Blog },
  { path: "/careers", component: Careers },
  { path: "/sign-in", component: Login },
  { path: "/portal", component: PrerenderPortal, shell: "bare" },
  { path: "/signup", component: PrerenderBusinessSignup, shell: "bare" },
  { path: "/signup/business", component: PrerenderBusinessSignup, shell: "bare" },
  { path: "/signup/capturer", component: PrerenderCapturerSignup, shell: "bare" },
  { path: "/forgot-password", component: PrerenderForgotPassword, shell: "bare" },
  { path: "/partners", component: Contact },
  { path: "/privacy", component: Privacy },
  { path: "/terms", component: Terms },
  ...siteWorldCards.map((site) => ({
    path: `/world-models/${site.id}`,
    component: SiteWorldDetail,
    props: { params: { slug: site.id } },
  })),
  ...siteWorldCards.map((site) => ({
    path: `/world-models/${site.id}/start`,
    component: HostedSessionSetup,
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
  const page = <Page {...(route.props || {})} />;
  const content = route.shell === "bare" ? page : <SiteLayout>{page}</SiteLayout>;
  const markup = renderToStaticMarkup(
    <Router ssrPath={route.path}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {content}
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

async function main() {
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  const templatePath = path.join(distPath, "index.html");
  const template = stripDefaultSeo(await fs.promises.readFile(templatePath, "utf8"));

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
