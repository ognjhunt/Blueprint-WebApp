import { SEO } from "@/components/SEO";
import { ExactSitePreviewSection } from "@/components/site/ExactSitePreviewSection";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialMetricStrip,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { siteWorldCards } from "@/data/siteWorlds";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import {
  publicDemoHref,
  publicDemoPlyPreviewSrc,
  publicDemoSiteWorldId,
  publicDemoSpzPreviewSrc,
} from "@/lib/marketingProof";
import { publicCaptureProofStories } from "@/lib/proofEvidence";
import {
  getEditorialFeaturedSites,
  getEditorialSiteLocation,
} from "@/lib/siteEditorialContent";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { analyticsEvents } from "@/lib/analytics";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from "@/lib/seoStructuredData";
import type { PublicSiteWorldRecord } from "@/types/inbound-request";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const productPaths = [
  {
    title: "Site Package Access",
    body:
      "One real place, packaged with capture route, manifest, proof notes, rights limits, export scope, and geometry when available.",
    href: "/pricing",
    label: "View package access",
  },
  {
    title: "Hosted Review",
    body:
      "A hosted review path for task scenarios, observations, and buyer notes before export, travel, or integration work.",
    href: "/product",
    label: "See hosted workflow",
    dark: true,
  },
  {
    title: "Buyer Request Path",
    body:
      "Structured intake turns a robot-team question into the next site, package scope, hosted evaluation, or capture run.",
    href:
      "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-product-review",
    label: "Start request",
  },
];

const personaEntryPoints = [
  {
    audience: "Robot team",
    question: "I need a real place my robot can train or evaluate against.",
    title: "Request an exact-site package.",
    body:
      "Name the facility, route, task, and robot setup. Blueprint routes you to a listing, new capture request, or hosted evaluation.",
    primaryHref:
      "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-persona-robot-team",
    primaryLabel: "Request world model",
    secondaryHref: "/world-models",
    secondaryLabel: "Browse world models",
  },
  {
    audience: "Site operator",
    question: "I control or influence a facility.",
    title: "Set site boundaries.",
    body:
      "Define access rules, privacy constraints, restricted zones, and commercialization terms before a package is released.",
    primaryHref: "/contact/site-operator",
    primaryLabel: "Submit or claim a site",
    secondaryHref: "/governance",
    secondaryLabel: "Review boundaries",
  },
  {
    audience: "Capturer",
    question: "I can record real public-facing places.",
    title: "Apply for capture access.",
    body:
      "Capture work remains city- and approval-gated. Open the launch path before recording, routing, or expecting assignment payout.",
    primaryHref: "/capture-app/launch-access?role=capturer&source=home-persona-capturer",
    primaryLabel: "Check capture access",
    secondaryHref: "/capture",
    secondaryLabel: "How capture works",
  },
];

const categoryValidationItems = [
  {
    title: "Outdoor worlds are getting grounded",
    body:
      "Google's Genie and Street View work make the category legible: agents can explore worlds anchored to real places.",
  },
  {
    title: "Indoor spaces are still missing",
    body:
      "Warehouses, stores, labs, hotels, back rooms, and service corridors are rights-sensitive, task-specific, and rarely captured at robot-evaluation depth.",
  },
  {
    title: "Blueprint captures the indoor layer",
    body:
      "Blueprint turns those unscanned spaces into capture-backed packages, hosted review paths, proof boundaries, and export decisions for robot teams.",
  },
];

const proofItems = [
  "Samples and demo worlds are labeled inside the proof flow.",
  "Approved listings keep capture basis, freshness, rights, restrictions, and package scope attached.",
  "Hosted access and exports open after site-specific review confirms the path.",
];

const homeDirectAnswers = [
  {
    question: "What does Blueprint sell?",
    answer:
      "Blueprint sells capture-backed indoor world-model packages, hosted evaluation paths, and buyer review workflows for robot teams evaluating real operating environments.",
  },
  {
    question: "Why does exact-site capture matter?",
    answer:
      "Street View can help ground outdoor worlds, but indoor operating spaces need lawful capture, provenance, freshness, occlusion detail, and rights boundaries attached to the package.",
  },
  {
    question: "What proof is attached?",
    answer:
      "Public examples show the proof shape. Approved listings can attach capture provenance, site and capture ids, restrictions, freshness, package scope, and hosted-review notes when available.",
  },
  {
    question: "What should a buyer request next?",
    answer:
      "Request one exact site, one robot task, and the review path you need: package access, hosted evaluation, new capture, or a proof packet for internal buyer review.",
  },
];

const HOME_ROBOT_TEAM_EXPERIMENT_KEY = "home_robot_team_conversion_v1";
const HOME_ROBOT_TEAM_CONVERSION_GOAL = "structured_robot_team_intake";
const GOOGLE_GENIE_STREET_VIEW_URL =
  "https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie-expands/";

const homeRobotTeamVariants = ["outdoor_street_view", "street_view_grounds"] as const;

type HomeRobotTeamVariant = (typeof homeRobotTeamVariants)[number];

const homeVariantContent: Record<
  HomeRobotTeamVariant,
  {
    title: string;
    description: ReactNode;
    primaryLabel: string;
    primaryPath: "world-model" | "hosted-evaluation" | "request-capture";
    secondaryLabel: string;
    secondaryHref: string;
    panelTitle: string;
    panelBody: string;
  }
> = {
  outdoor_street_view: {
    title: "Site-specific world models from real capture.",
    description:
      <>
        Google's{" "}
        <a
          href={GOOGLE_GENIE_STREET_VIEW_URL}
          target="_blank"
          rel="noreferrer"
          className="!text-white underline decoration-white/70 underline-offset-4 transition visited:!text-white hover:!text-white hover:decoration-white"
        >
          Street View-grounded Genie
        </a>{" "}
        makes real-place world models easier to understand. Blueprint gives robot
        teams the indoor layer: capture-backed packages, provenance, rights limits,
        and hosted review for the exact facility before field time.
      </>,
    primaryLabel: "Request world model",
    primaryPath: "world-model",
    secondaryLabel: "Browse world models",
    secondaryHref: "/world-models",
    panelTitle: "Start here",
    panelBody:
      "Name one indoor site, robot task, and review path. Proof stays attached before access expands.",
  },
  street_view_grounds: {
    title: "Site-specific world models from real capture.",
    description:
      <>
        Google's{" "}
        <a
          href={GOOGLE_GENIE_STREET_VIEW_URL}
          target="_blank"
          rel="noreferrer"
          className="!text-white underline decoration-white/70 underline-offset-4 transition visited:!text-white hover:!text-white hover:decoration-white"
        >
          Street View-grounded Genie
        </a>{" "}
        makes real-place world models easier to understand. Blueprint gives robot
        teams the indoor layer: capture-backed packages, provenance, rights limits,
        and hosted review for the exact facility before field time.
      </>,
    primaryLabel: "Request world model",
    primaryPath: "world-model",
    secondaryLabel: "Browse world models",
    secondaryHref: "/world-models",
    panelTitle: "Start here",
    panelBody:
      "Name one indoor site, robot task, and review path. Blueprint routes the request without treating sample proof as approved output.",
  },
};

const robotTeamDecisionSteps = [
  {
    title: "Capture the indoor site",
    body: "Start from the facility, route, workflow, and public-facing or permissioned capture path with provenance and limits attached.",
  },
  {
    title: "Ground the world model",
    body: "Turn capture into a site package with manifest, route context, rights notes, freshness, exports, and hosted review context.",
  },
  {
    title: "Decide before field time",
    body: "Use hosted review, scenario replay, or package access to approve export, request recapture, or narrow the deployment question.",
  },
];

const firstScreenDefinitions = [
  {
    term: "World model",
    definition: "A capture-backed indoor environment for one real site and robot workflow.",
  },
  {
    term: "Site package",
    definition: "The manifest, route, proof, rights notes, exports, and files tied to that site.",
  },
  {
    term: "Hosted review",
    definition: "Blueprint runs the site model in a review room before your team takes files into its own stack.",
  },
  {
    term: "Provenance",
    definition: "The record of where the capture came from, when it was captured, what route it covered, and what limits apply.",
  },
];

function buildRobotTeamContactHref(
  variantId: HomeRobotTeamVariant,
  source: string,
  path: "world-model" | "hosted-evaluation" | "request-capture",
) {
  const interest =
    path === "hosted-evaluation"
      ? "hosted-evaluation"
      : path === "request-capture"
        ? "capture-access"
        : "world-model";
  const params = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest,
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
    useState<HomeRobotTeamVariant>("outdoor_street_view");
  const [liveExactSitePreview, setLiveExactSitePreview] =
    useState<PublicSiteWorldRecord | null>(null);
  const heroContent = homeVariantContent[heroVariant];
  const heroPrimaryHref = buildRobotTeamContactHref(
    heroVariant,
    "home-hero-primary",
    heroContent.primaryPath,
  );
  const decisionPathHref = buildRobotTeamContactHref(
    heroVariant,
    "home-decision-path",
    "world-model",
  );
  const bottomCtaHref = buildRobotTeamContactHref(
    heroVariant,
    "home-bottom",
    heroContent.primaryPath,
  );
  const exactSitePreviewSeed = useMemo(
    () => siteWorldCards.find((site) => site.id === publicDemoSiteWorldId) || heroSite,
    [heroSite],
  );
  const exactSitePreviewSite = useMemo(() => {
    const site = liveExactSitePreview || exactSitePreviewSeed || heroSite;
    if (!site) {
      return site;
    }

    const preview = site.worldLabsPreview || { status: "ready" as const };
    const spzUrls = preview.spzUrls?.length ? preview.spzUrls : [publicDemoSpzPreviewSrc];
    const previewWithSplat = {
      ...preview,
      status: preview.status || "ready",
      spzUrls,
      plyUrls: [publicDemoPlyPreviewSrc],
    };

    return {
      ...site,
      worldLabsPreview: previewWithSplat,
    };
  }, [exactSitePreviewSeed, heroSite, liveExactSitePreview]);

  const metrics = useMemo(
    () => [
      {
        label: "Outdoor validation",
        detail: "Street View-grounded world models validate real-place simulation; Blueprint focuses that demand indoors.",
      },
      {
        label: "Indoor capture",
        detail: "A walkthrough or site record starts the product. Provenance, rights, and limits stay attached.",
      },
      {
        label: "Site package",
        detail: "Blueprint packages the capture into a site-specific world model, buyer listing, and export scope.",
      },
      {
        label: "Hosted decision",
        detail: "Use hosted review and proof before committing travel, rollout spend, or deeper integration.",
      },
    ],
    [],
  );

  useEffect(() => {
    const nextVariant =
      homeRobotTeamVariants[Math.floor(Math.random() * homeRobotTeamVariants.length)];
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchSiteWorldDetail(publicDemoSiteWorldId)
      .then((site) => {
        if (!cancelled) {
          setLiveExactSitePreview(site);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveExactSitePreview(null);
        }
      });

    return () => {
      cancelled = true;
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
        title="Blueprint | Indoor World Models For Robot Teams"
        description="Street View grounds outdoor worlds. Blueprint captures indoor spaces and turns them into site-specific world models, hosted review paths, and package requests for robot teams."
        canonical="/"
        jsonLd={[
          organizationJsonLd(),
          websiteJsonLd(),
          webPageJsonLd({
            path: "/",
            name: "Blueprint",
            description:
              "Indoor real-site capture, site-specific world models, hosted evaluation, and clear paths for robot teams, site operators, and capturers.",
          }),
          breadcrumbJsonLd([{ name: "Home", path: "/" }]),
          faqJsonLd(homeDirectAnswers),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10" data-home-section="hero">
          <MonochromeMedia
            src="/generated/editorial/world-models-hero.png"
            alt={heroSite.siteName}
            className="min-h-[39rem] rounded-none sm:min-h-[42rem]"
            loading="eager"
            imageClassName="min-h-[39rem] sm:min-h-[42rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_34%,rgba(0,0,0,0.2)_82%)]"
          >
            <RouteTraceOverlay className="opacity-60" />

            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[31rem] flex-col justify-end sm:min-h-[34rem]">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <ProofChip light>Indoor capture</ProofChip>
                    <ProofChip light>Exact-site world models</ProofChip>
                    <ProofChip light>Hosted review</ProofChip>
                  </div>
                  <h1 className="font-editorial max-w-[40rem] text-[2.85rem] leading-[0.92] tracking-[-0.04em] text-white sm:text-[4.35rem]">
                    {heroContent.title}
                  </h1>
                  <p className="mt-5 max-w-[31rem] text-base leading-7 text-white/90 sm:text-[1.03rem] sm:leading-8">
                    {heroContent.description}
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                      className="inline-flex w-full items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
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
                      className="inline-flex w-full items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                    >
                      {heroContent.secondaryLabel}
                    </a>
                  </div>
                </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[19rem] border border-white/15 bg-black/35 p-5 text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.58)] backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Robot-team next step
                    </p>
                    <h2 className="mt-4 text-lg font-semibold">{heroContent.panelTitle}</h2>
                    <p className="mt-2 text-sm text-white/60">
                      {heroContent.panelBody}
                    </p>
                    <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/70">
                      Capture first. Package next. Review before commitment.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <ExactSitePreviewSection
          site={exactSitePreviewSite}
          primaryHref={decisionPathHref}
          onCtaClick={trackHomeCtaClick}
        />

        <section className="border-b border-black/10 bg-white" data-home-section="category-validation">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Category signal"
                title="Real-place world models are no longer abstract."
                description="The public category is moving from generated scenes toward places agents and robots can navigate. Blueprint's wedge is the indoor site layer that public maps do not solve."
                light
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {categoryValidationItems.map((item) => (
                <article key={item.title} className="bg-white p-6">
                  <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white" data-home-section="first-route">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-8 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-10">
            <div className="bg-[#f5f3ef] p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Choose your path
              </p>
              <div className="mt-4 grid gap-2">
                {[
                  ["For robot teams", heroPrimaryHref],
                  ["For site operators", "/contact/site-operator"],
                  ["For capturers", "/capture-app/launch-access?role=capturer&source=home-top-persona"],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    className="flex min-h-12 items-center justify-between border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
                  >
                    {label}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-4">
              {firstScreenDefinitions.map((item) => (
                <div key={item.term} className="bg-white p-5">
                  <p className="text-sm font-semibold text-slate-950">{item.term}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.definition}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-[#101310] text-white" data-home-section="product-stack">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.43fr_0.57fr] lg:px-10 lg:py-14">
            <div className="max-w-xl">
              <ProofChip light>Commercial product</ProofChip>
              <h2 className="font-editorial mt-5 text-[3rem] leading-[0.9] tracking-[-0.05em] sm:text-[4.15rem]">
                Blueprint sells indoor exact-site products, not generic demos.
              </h2>
              <p className="mt-6 text-base leading-8 text-white/76">
                Blueprint turns indoor capture into site-specific packages, hosted review paths, and
                buyer decisions tied to the same facility, route, and proof record.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={decisionPathHref}
                  onClick={() =>
                    trackHomeCtaClick(
                      "home_product_stack_primary",
                      "Request world model",
                      decisionPathHref,
                      "home-product-stack",
                    )
                  }
                  className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Request world model
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/world-models"
                  onClick={() =>
                    trackHomeCtaClick(
                      "home_product_stack_catalog",
                      "Browse world models",
                      "/world-models",
                      "home-product-stack",
                    )
                  }
                  className="inline-flex items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Browse world models
                </a>
              </div>
            </div>

            <div className="grid gap-px bg-white/10 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {productPaths.map((path, index) => (
                <article
                  key={path.title}
                  className={index === 1 ? "bg-[#e8efe8] p-6 text-slate-950" : "bg-white/[0.06] p-6 text-white"}
                >
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${index === 1 ? "text-slate-500" : "text-white/45"}`}>
                    0{index + 1}
                  </p>
                  <h3 className="font-editorial mt-5 text-[2.25rem] leading-[0.92] tracking-[-0.04em]">
                    {path.title}
                  </h3>
                  <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-slate-700" : "text-white/68"}`}>
                    {path.body}
                  </p>
                  <a
                    href={path.href}
                    onClick={() =>
                      trackHomeCtaClick(
                        `home_product_stack_${path.title.toLowerCase().replace(/\s+/g, "_")}`,
                        path.label,
                        path.href,
                        "home-product-stack",
                      )
                    }
                    className={`mt-7 inline-flex items-center text-sm font-semibold ${index === 1 ? "text-slate-950" : "text-white"}`}
                  >
                    {path.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-10" data-home-section="metrics">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="border-y border-black/10 bg-white" data-home-section="robot-team-path">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.35fr_0.65fr] lg:px-10">
            <div className="bg-[#e8efe8] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="For robot teams"
                title="Start with the exact site your robot needs to understand."
                description="A buyer request should name the indoor place, workflow, and robot question. Blueprint then keeps the capture-backed proof, package scope, and hosted path together."
              />
              <a
                href={decisionPathHref}
                onClick={() =>
                  trackHomeCtaClick(
                          "home_decision_path",
                          "Request world model",
                          decisionPathHref,
                          "home-decision-path",
                  )
                }
                className="mt-7 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Request world model
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

        <section className="border-y border-black/10 bg-[#f5f3ef]" data-home-section="proof-story">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.52fr_0.48fr] lg:px-10 lg:py-12">
            <MonochromeMedia
              src={publicCaptureProofStories[0]?.image || editorialGeneratedAssets.groceryBackroom}
              alt="Blueprint exact-site proof route"
              className="min-h-[29rem] rounded-none"
              imageClassName="min-h-[29rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.18))]"
            />
            <div className="bg-white px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Proof boundary"
                title="The proof travels with the product."
                description="A polished sample is useful only when it stays honest. Blueprint labels public examples, keeps approved proof attached to the exact site, and gates hosted access until the request is reviewed."
              />
              <div className="mt-8 divide-y divide-black/10 border-y border-black/10">
                {proofItems.map((item) => (
                  <div key={item} className="py-4 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/proof"
                  onClick={() =>
                  trackHomeCtaClick(
                      "home_proof_primary",
                      "Inspect proof",
                      "/proof",
                      "home-proof-story",
                    )
                  }
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Inspect proof
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={publicDemoHref}
                  onClick={() =>
                    trackHomeCtaClick(
                      "home_sample_site_secondary",
                      "Open sample world model",
                      publicDemoHref,
                      "home-proof-story",
                    )
                  }
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Open sample world model
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12" data-home-section="catalog">
          <EditorialSectionIntro
            eyebrow="World-model catalog"
            title="Sample worlds show the package shape."
            description="Browse public examples to inspect the proof format, then request the exact facility or route your team needs when it is not already listed."
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

        <section className="border-y border-black/10 bg-white" data-home-section="capture-examples">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10">
            <EditorialSectionIntro
              eyebrow="Why capture matters"
              title="Indoor capture turns vague simulation demand into a buyer-ready package."
              description="The useful details are local: aisle width, signage, occlusions, access boundaries, restricted areas, and the robot task a team is actually deciding on."
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
                    loading="eager"
                    className="aspect-[4/3] rounded-none"
                    imageClassName="aspect-[4/3] transition duration-700 group-hover:scale-[1.03]"
                    overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.32))]"
                  />
                  <div className="p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{story.label}</p>
                    <h2 className="mt-3 text-lg font-semibold leading-tight text-slate-950">
                      {story.locationName}
                    </h2>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {story.city}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{story.robotQuestion}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#101310] text-white" data-home-section="persona-paths">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.31fr_0.69fr] lg:px-10 lg:py-12">
            <div className="bg-white/[0.06] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Request next"
                title="Three ways into the same product path."
                description="Robot teams, site operators, and capturers enter from different sides. The package still resolves around one exact site and its proof."
                light
              />
            </div>
            <div className="grid gap-px bg-white/10 md:grid-cols-3">
              {personaEntryPoints.map((entry, index) => (
                <article
                  key={entry.audience}
                  className={index === 0 ? "bg-[#e8efe8] p-6 text-slate-950" : "bg-white/[0.06] p-6 text-white"}
                >
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${index === 0 ? "text-slate-500" : "text-white/45"}`}>
                    {entry.audience}
                  </p>
                  <p className={`mt-3 text-sm leading-6 ${index === 0 ? "text-slate-600" : "text-white/62"}`}>
                    {entry.question}
                  </p>
                  <h2 className="font-editorial mt-5 text-[2rem] leading-[0.95] tracking-[-0.04em]">
                    {entry.title}
                  </h2>
                  <p className={`mt-4 text-sm leading-7 ${index === 0 ? "text-slate-700" : "text-white/70"}`}>
                    {entry.body}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a
                      href={entry.primaryHref}
                      onClick={() =>
                        trackHomeCtaClick(
                          `home_persona_${entry.audience.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_primary`,
                          entry.primaryLabel,
                          entry.primaryHref,
                          "home-persona-paths",
                        )
                      }
                      className={index === 0
                        ? "inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        : "inline-flex items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"}
                    >
                      {entry.primaryLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href={entry.secondaryHref}
                      onClick={() =>
                        trackHomeCtaClick(
                          `home_persona_${entry.audience.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_secondary`,
                          entry.secondaryLabel,
                          entry.secondaryHref,
                          "home-persona-paths",
                        )
                      }
                      className={index === 0
                        ? "inline-flex items-center justify-center border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                        : "inline-flex items-center justify-center border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"}
                    >
                      {entry.secondaryLabel}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12" data-home-section="direct-answers">
          <EditorialFaq
            title="Buyer answers"
            description="Short definitions for investors and robot teams comparing exact-site packages, hosted evaluation, provenance, rights, and sample boundaries."
            items={homeDirectAnswers}
          />
        </section>

	        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14" data-home-section="bottom-cta">
          <EditorialCtaBand
            eyebrow="Start"
            title="Request one indoor exact-site world model."
            description="Name the place, workflow, robot setup, and review path. Blueprint will route the request to a current listing, new capture, package access, or hosted evaluation without blurring sample proof into approved output."
            imageSrc={editorialGeneratedAssets.homeHero}
            imageAlt="Blueprint hosted evaluation still"
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
