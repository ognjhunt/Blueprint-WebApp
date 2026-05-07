import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialMetricStrip,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  MonochromeVideo,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { siteWorldCards } from "@/data/siteWorlds";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { publicDemoHref, siteMotionLoopPosterSrc, siteMotionLoopVideoSrc } from "@/lib/marketingProof";
import { publicCaptureProofStories } from "@/lib/proofEvidence";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import {
  getEditorialFeaturedSites,
  getEditorialSiteLocation,
} from "@/lib/siteEditorialContent";
import { analyticsEvents } from "@/lib/analytics";
import { resolveExperimentVariant } from "@/lib/experiments";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from "@/lib/seoStructuredData";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const productPaths = [
  {
    title: "Site Package",
    body:
      "License the exact-site package when your team wants capture notes, routes, geometry when available, metadata, rights, and exports inside its own stack.",
    href: "/pricing",
    label: "View package path",
  },
  {
    title: "Hosted Evaluation",
    body:
      "Start with hosted review when your team needs reruns, observations, and a clear next step before moving files or sending people on-site.",
    href: "/exact-site-hosted-review",
    label: "See hosted path",
    dark: true,
  },
];

const proofItems = [
  "Capture provenance stays attached to the site record.",
  "Package and hosted paths stay tied to the same site.",
  "Rights, freshness, and restrictions stay visible before purchase.",
];

const captureExamples = [
  "Grocery aisles and retail backrooms",
  "Public customer areas and everyday service locations",
  "Lawfully accessible walkthroughs with privacy rules visible",
];

const homeDirectAnswers = [
  {
    question: "What is Blueprint?",
    answer:
      "Blueprint turns real-site capture into site-specific world-model products, hosted review, and package access for robot teams.",
  },
  {
    question: "What is a site-specific world model?",
    answer:
      "A site-specific world model is a digital environment tied to one real facility or public-facing place, with capture provenance, rights, privacy, and package limits kept attached.",
  },
  {
    question: "What does a robot team get?",
    answer:
      "A robot team can inspect a site package, request hosted evaluation, review sample exports, and move toward package access only when the exact site and proof path are clear.",
  },
  {
    question: "What is sample versus proof?",
    answer:
      "Public examples are labeled as samples unless they are tied to an approved listing, capture record, rights posture, and hosted-review result.",
  },
];

const HOME_ROBOT_TEAM_EXPERIMENT_KEY = "home_robot_team_conversion_v1";
const HOME_ROBOT_TEAM_CONVERSION_GOAL = "structured_robot_team_intake";
const homeRobotTeamVariants = ["hosted_review", "proof_pack"] as const;

type HomeRobotTeamVariant = (typeof homeRobotTeamVariants)[number];

const homeVariantContent: Record<
  HomeRobotTeamVariant,
  {
    title: string;
    description: string;
    primaryLabel: string;
    primaryPath: "hosted-evaluation" | "request-capture";
    secondaryLabel: string;
    secondaryHref: string;
    panelTitle: string;
    panelBody: string;
  }
> = {
  hosted_review: {
    title: "Site-specific world models for real places.",
    description:
      "Inspect real captured places, then send the site, workflow, and robot setup your team needs to evaluate next.",
    primaryLabel: "Request hosted review",
    primaryPath: "hosted-evaluation",
    secondaryLabel: "Inspect sample review",
    secondaryHref: "/sample-evaluation",
    panelTitle: "Start with one site",
    panelBody:
      "Tell us the place, the robot, and the decision your team needs to make. We will point you to the right listing, hosted evaluation, or capture path.",
  },
  proof_pack: {
    title: "Site-specific world models for real places.",
    description:
      "Start with the deployment question, not a generic demo. Blueprint keeps capture provenance, package scope, hosted review, and rights boundaries attached to one site.",
    primaryLabel: "Request site review",
    primaryPath: "request-capture",
    secondaryLabel: "Inspect sample site",
    secondaryHref: publicDemoHref,
    panelTitle: "Exact-site proof path",
    panelBody:
      "See what is already inspectable, then request the site or workflow your team actually needs.",
  },
};

const robotTeamDecisionSteps = [
  {
    title: "Pick the place",
    body: "Start with one facility, site class, or route your team needs to understand before spending more time.",
  },
  {
    title: "Check the evidence",
    body: "Look at the sample listing, capture notes, rights limits, freshness, hosted review report, and export shape.",
  },
  {
    title: "Request the next step",
    body: "Ask for package access, hosted evaluation, or a new capture when the exact place is not available yet.",
  },
];

function buildRobotTeamContactHref(
  variantId: HomeRobotTeamVariant,
  source: string,
  path: "hosted-evaluation" | "request-capture",
) {
  const params = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "evaluation-package",
    path,
    source,
    utm_source: "homepage",
    utm_medium: "website",
    utm_campaign: HOME_ROBOT_TEAM_EXPERIMENT_KEY,
    utm_content: `${variantId}:${source}`,
  });

  return `/contact?${params.toString()}`;
}

function HomeSiteCard({
  title,
  href,
  image,
  location,
}: {
  title: string;
  href: string;
  image: string;
  location: string;
}) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-[1.7rem] border border-black/10 bg-slate-950 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.38)]"
    >
      <MonochromeMedia
        src={image}
        alt={title}
        className="min-h-[23rem] rounded-none"
        imageClassName="min-h-[23rem] transition duration-700 group-hover:scale-[1.03]"
        overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.76))]"
      />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
          {location}
        </p>
        <h3 className="font-editorial mt-3 text-[2rem] leading-[0.95] tracking-[-0.04em]">
          {title}
        </h3>
        <div className="mt-5 inline-flex items-center text-sm font-semibold text-white/80">
          Explore
          <ArrowRight className="ml-2 h-4 w-4" />
        </div>
      </div>
    </a>
  );
}

export default function Home() {
  const featuredSites = useMemo(
    () => getEditorialFeaturedSites(siteWorldCards, 3),
    [],
  );
  const heroSite = featuredSites[0];
  const [heroVariant, setHeroVariant] =
    useState<HomeRobotTeamVariant>("hosted_review");
  const heroContent = homeVariantContent[heroVariant];
  const heroPrimaryHref = buildRobotTeamContactHref(
    heroVariant,
    "home-hero-primary",
    heroContent.primaryPath,
  );
  const decisionPathHref = buildRobotTeamContactHref(
    heroVariant,
    "home-decision-path",
    "hosted-evaluation",
  );
  const bottomCtaHref = buildRobotTeamContactHref(
    heroVariant,
    "home-bottom",
    heroContent.primaryPath,
  );

  const metrics = useMemo(
    () => [
      {
        label: "World model",
        detail: "A site-specific digital environment built from real capture of one place and workflow.",
      },
      {
        label: "Site package",
        detail: "Walkthrough media, poses, metadata, geometry when available, rights, and export scope.",
      },
      {
        label: "Hosted review",
        detail: "Managed reruns, observations, evidence exports, and next-step recommendation on the same site.",
      },
      {
        label: "Decision",
        detail: "Use it before the team commits travel, rollout spend, custom sim work, or deeper integration.",
      },
    ],
    [],
  );

  useEffect(() => {
    let isMounted = true;

    void resolveExperimentVariant(
      HOME_ROBOT_TEAM_EXPERIMENT_KEY,
      homeRobotTeamVariants,
    ).then((resolvedVariant) => {
      if (!isMounted) return;
      const nextVariant = resolvedVariant as HomeRobotTeamVariant;
      setHeroVariant(nextVariant);
      analyticsEvents.experimentExposure(
        HOME_ROBOT_TEAM_EXPERIMENT_KEY,
        nextVariant,
        "home",
      );
      analyticsEvents.homeHeroView({
        variantId: nextVariant,
        source: "home",
        conversionGoal: HOME_ROBOT_TEAM_CONVERSION_GOAL,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    const seenSections = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const section = entry.target.getAttribute("data-home-section");
          if (!section || seenSections.has(section)) return;
          seenSections.add(section);
          analyticsEvents.homeSectionViewed({
            variantId: heroVariant,
            section,
            conversionGoal: HOME_ROBOT_TEAM_CONVERSION_GOAL,
          });
        });
      },
      { threshold: 0.35 },
    );

    document.querySelectorAll<HTMLElement>("[data-home-section]").forEach((node) => {
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [heroVariant]);

  const trackHomeCtaClick = (
    ctaId: string,
    ctaLabel: string,
    destination: string,
    source: string,
  ) => {
    analyticsEvents.homeConversionCtaClicked({
      variantId: heroVariant,
      ctaId,
      ctaLabel,
      destination,
      source,
      conversionGoal: HOME_ROBOT_TEAM_CONVERSION_GOAL,
    });
  };

  if (!heroSite) {
    return null;
  }

  return (
    <>
      <SEO
        title="Blueprint | Site-Specific World Models For Real Places"
        description="Blueprint helps robot teams inspect exact-site world models, hosted robot evaluation, and site packages built from real capture."
        canonical="/"
        jsonLd={[
          organizationJsonLd(),
          websiteJsonLd(),
          webPageJsonLd({
            path: "/",
            name: "Blueprint",
            description:
              "Site-specific world models, hosted robot evaluation, and capture-backed site packages for robot teams.",
          }),
          breadcrumbJsonLd([{ name: "Home", path: "/" }]),
          faqJsonLd(homeDirectAnswers),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10" data-home-section="hero">
          <MonochromeMedia
            src={editorialGeneratedAssets.homeHero}
            alt={heroSite.siteName}
            className="min-h-[42rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[42rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />
            <RouteTraceOverlay className="opacity-60" />

            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[34rem] flex-col justify-end">
                <EditorialSectionLabel light>Blueprint</EditorialSectionLabel>
	                <h1 className="font-editorial mt-6 max-w-[38rem] text-[3.45rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[4.9rem]">
	                  {heroContent.title}
	                </h1>
	                <p className="mt-6 max-w-[32rem] text-base leading-8 text-white opacity-90 sm:text-[1.03rem]">
	                  {heroContent.description}
	                </p>

	                <div className="mt-8 flex flex-wrap gap-3">
	                  <a
	                    href={heroPrimaryHref}
                      onClick={() =>
                        trackHomeCtaClick(
                          "home_hero_primary",
                          heroContent.primaryLabel,
                          heroPrimaryHref,
                          "home-hero-primary",
                        )
                      }
	                    className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
	                  >
	                    {heroContent.primaryLabel}
	                    <ArrowRight className="ml-2 h-4 w-4" />
	                  </a>
	                  <a
	                    href={heroContent.secondaryHref}
                      onClick={() =>
                        trackHomeCtaClick(
                          "home_hero_secondary",
                          heroContent.secondaryLabel,
                          heroContent.secondaryHref,
                          "home-hero-secondary",
                        )
                      }
	                    className="inline-flex items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
	                  >
	                    {heroContent.secondaryLabel}
	                  </a>
                </div>
              </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[18rem] border border-white/15 bg-black/35 p-5 text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.58)] backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                    Robot-team next step
                  </p>
                  <h2 className="mt-4 text-lg font-semibold">{heroContent.panelTitle}</h2>
                  <p className="mt-2 text-sm text-white/60">
                    {heroContent.panelBody}
                  </p>
                  <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/70">
                    One exact site. One workflow. Proof stays attached.
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10" data-home-section="metrics">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="border-y border-black/10 bg-white" data-home-section="robot-team-path">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.35fr_0.65fr] lg:px-10">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="For robot teams"
                title="Start with the site your robot needs to understand."
                description="Blueprint helps your team inspect what exists, request what is missing, and move toward hosted evaluation without a long discovery loop."
              />
              <a
                href={decisionPathHref}
                onClick={() =>
                  trackHomeCtaClick(
                    "home_decision_path",
                    "Request site review",
                    decisionPathHref,
                    "home-decision-path",
                  )
                }
                className="mt-7 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Request site review
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {robotTeamDecisionSteps.map((step, index) => (
                <div
                  key={step.title}
                  className={index === 1 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
                >
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${index === 1 ? "text-white/45" : "text-slate-400"}`}>
                    0{index + 1}
                  </p>
                  <h2 className="font-editorial mt-4 text-[2rem] leading-[0.95] tracking-[-0.04em]">
                    {step.title}
                  </h2>
                  <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-white/70" : "text-slate-600"}`}>
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white" data-home-section="sample-evaluation">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.38fr_0.62fr] lg:px-10">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
	              <EditorialSectionIntro
	                eyebrow="Sample evaluation"
	                title="Start with one complete proof journey."
	                description="Before you request a new site, inspect the sample path: one exact site, one package, one hosted-review request, and limits that stay visible."
	              />
	              <div className="mt-7 flex flex-wrap gap-3">
	                <a
	                  href="/sample-evaluation"
                    onClick={() =>
                      trackHomeCtaClick(
                        "home_sample_evaluation_primary",
                        "Open sample evaluation",
                        "/sample-evaluation",
                        "home-sample-evaluation",
                      )
                    }
	                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
	                >
	                  Open sample evaluation
	                  <ArrowRight className="ml-2 h-4 w-4" />
	                </a>
	                <a
	                  href={publicDemoHref}
                    onClick={() =>
                      trackHomeCtaClick(
                        "home_sample_site_secondary",
                        "Inspect sample site",
                        publicDemoHref,
                        "home-sample-evaluation",
                      )
                    }
	                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
	                >
	                  Inspect sample site
	                </a>
	              </div>
	            </div>
	            <MonochromeVideo
	              src={siteMotionLoopVideoSrc}
	              poster={siteMotionLoopPosterSrc}
	              title="Blueprint exact-site walkthrough"
	              className="min-h-[30rem] rounded-none"
	              videoClassName="min-h-[30rem]"
	              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.16))]"
            />
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-10" data-home-section="catalog">
          <EditorialSectionIntro
                eyebrow="Real places"
                title="Everyday places can become robot-team evidence."
                description="Blueprint is not limited to warehouses. Public-facing grocery, retail, service, and common-area locations can become capture-backed site products when the walkthrough is lawful, privacy-safe, and useful."
                className="max-w-3xl"
              />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {featuredSites.map((site) => (
              <HomeSiteCard
                key={site.id}
                title={site.siteName}
                href={`/world-models/${site.id}`}
                image={
                  site.id === featuredSites[0]?.id
                    ? editorialGeneratedAssets.groceryBackroom
                    : site.id === featuredSites[1]?.id
                      ? editorialGeneratedAssets.warehouseAisle
                      : editorialGeneratedAssets.homeHero
                }
                location={getEditorialSiteLocation(site)}
              />
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white" data-home-section="product-paths">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.44fr_0.56fr] lg:px-10">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Products"
                title="Two ways to work with one exact site."
                description="Start with the listing, then choose package access or hosted review."
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-2">
              {productPaths.map((path) => (
                <div
                  key={path.title}
                  className={path.dark ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
                >
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${path.dark ? "text-white/45" : "text-slate-400"}`}>
                    {path.title}
                  </p>
                  <h3 className="font-editorial mt-4 text-[2.3rem] leading-[0.92] tracking-[-0.04em]">
                    {path.title}
                  </h3>
                  <p className={`mt-4 text-sm leading-7 ${path.dark ? "text-white/70" : "text-slate-600"}`}>
                    {path.body}
                  </p>
                  <a
                    href={path.href}
                    onClick={() =>
                      trackHomeCtaClick(
                        `home_product_${path.title.toLowerCase().replace(/\s+/g, "_")}`,
                        path.label,
                        path.href,
                        "home-product-paths",
                      )
                    }
                    className={`mt-6 inline-flex items-center text-sm font-semibold ${path.dark ? "text-white" : "text-slate-950"}`}
                  >
                    {path.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12" data-home-section="direct-answers">
          <EditorialFaq
            title="Direct answers"
            description="Short definitions for teams comparing exact-site packages, hosted review, capture provenance, rights, and sample boundaries."
            items={homeDirectAnswers}
          />
        </section>

	        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12" data-home-section="proof">
	          <div className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-white lg:grid-cols-[0.46fr_0.54fr]">
            <MonochromeMedia
              src={publicCaptureGeneratedAssets.cedarMarketProofBoard}
              alt="Blueprint public proof board"
              className="min-h-[32rem] rounded-none"
              imageClassName="min-h-[32rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.4))]"
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:58px_58px] opacity-30" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white lg:p-8">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  Public proof board
                </p>
                <h2 className="font-editorial mt-4 max-w-[20rem] text-[3rem] leading-[0.94] tracking-[-0.05em]">
                  One site, shown before the sales motion starts.
                </h2>
              </div>
            </MonochromeMedia>

            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
	              <EditorialSectionIntro
	                eyebrow="Proof"
	                title="See what is attached before you commit."
	                description="The listing keeps the package, hosted path, rights, freshness, and restrictions readable before your team moves forward."
	              />
              <div className="mt-8 space-y-3">
                {proofItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-full border border-black/10 bg-white px-5 py-4 text-sm text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/sample-deliverables"
                  onClick={() =>
                    trackHomeCtaClick(
                      "home_sample_deliverables",
                      "View sample deliverables",
                      "/sample-deliverables",
                      "home-proof",
                    )
                  }
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View sample deliverables
                </a>
                <a
                  href="/exact-site-hosted-review"
                  onClick={() =>
                    trackHomeCtaClick(
                      "home_hosted_review",
                      "See hosted review",
                      "/exact-site-hosted-review",
                      "home-proof",
                    )
                  }
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  See hosted review
                </a>
              </div>
            </div>
          </div>
	        </section>

        <section className="border-y border-black/10 bg-white" data-home-section="capture-examples">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10">
            <EditorialSectionIntro
              eyebrow="Capture examples"
              title="See what a robot team would inspect."
              description="Grocery aisles, retail floors, hotel lobbies, and mall corridors can all become useful site evidence when the route is lawful, privacy-safe, and tied to a real robot question."
              className="max-w-3xl"
            />
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {publicCaptureProofStories.map((story) => (
                <a
                  key={story.id}
                  href="/proof"
                  className="group overflow-hidden border border-black/10 bg-[#f5f3ef] transition hover:bg-white"
                >
                  <MonochromeMedia
                    src={story.image}
                    alt={story.locationName}
                    className="aspect-[4/3] rounded-none"
                    imageClassName="aspect-[4/3] transition duration-700 group-hover:scale-[1.03]"
                    overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.32))]"
                  />
                  <div className="p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{story.city}</p>
                    <h2 className="mt-3 text-lg font-semibold leading-tight text-slate-950">
                      {story.locationName}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{story.captureAppCue}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white" data-home-section="capture-supply">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.38fr_0.62fr] lg:px-10">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Capture supply"
                title="Everyday capture expands the catalog."
                description="The Capture app path is for everyday places people can actually reach, not only industrial facilities."
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {captureExamples.map((item) => (
                <div key={item} className="bg-white p-6 text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

	        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14" data-home-section="bottom-cta">
          <EditorialCtaBand
            eyebrow="Start"
            title="Start with the site, task, and robot question."
            description="Blueprint can give a better answer when your request names the place, workflow, and robot setup your team needs to evaluate."
            imageSrc={editorialGeneratedAssets.homeHero}
            imageAlt="Blueprint hosted review still"
            primaryHref={bottomCtaHref}
            primaryLabel={heroContent.primaryLabel}
            primaryOnClick={() =>
              trackHomeCtaClick(
                "home_bottom_primary",
                heroContent.primaryLabel,
                bottomCtaHref,
                "home-bottom",
              )
            }
            secondaryHref={heroContent.secondaryHref}
            secondaryLabel={heroContent.secondaryLabel}
            secondaryOnClick={() =>
              trackHomeCtaClick(
                "home_bottom_secondary",
                heroContent.secondaryLabel,
                heroContent.secondaryHref,
                "home-bottom",
              )
            }
          />
        </section>
      </div>
    </>
  );
}
