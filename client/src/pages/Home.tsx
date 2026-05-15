import { SEO } from "@/components/SEO";
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
import { publicDemoHref } from "@/lib/marketingProof";
import { publicCaptureProofStories } from "@/lib/proofEvidence";
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
    title: "Exact-Site World Model Package",
    body:
      "One real place, packaged with capture route, manifest, proof notes, rights limits, export scope, and geometry when available.",
    href: "/pricing",
    label: "View package access",
  },
  {
    title: "Hosted Evaluation",
    body:
      "A hosted review path for task scenarios, observations, and buyer notes before export, travel, or integration work.",
    href: "/product",
    label: "See hosted workflow",
    dark: true,
  },
  {
    title: "Buyer Review",
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

const proofItems = [
  "Samples and demo worlds are labeled inside the proof flow.",
  "Approved listings keep capture basis, freshness, rights, restrictions, and package scope attached.",
  "Hosted access and exports open after site-specific review confirms the path.",
];

const homeDirectAnswers = [
  {
    question: "What does Blueprint sell?",
    answer:
      "Blueprint sells capture-backed exact-site world-model packages, hosted evaluation paths, and buyer review workflows for robot teams evaluating real operating environments.",
  },
  {
    question: "Why does exact-site capture matter?",
    answer:
      "A generic scene cannot preserve the route, occlusions, constraints, freshness, and rights posture of the real place your robot may enter. Blueprint keeps that context attached to the package.",
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
const homeRobotTeamVariants = ["hosted_review", "proof_pack"] as const;

type HomeRobotTeamVariant = (typeof homeRobotTeamVariants)[number];

const homeVariantContent: Record<
  HomeRobotTeamVariant,
  {
    title: string;
    description: string;
    primaryLabel: string;
    primaryPath: "world-model" | "hosted-evaluation" | "request-capture";
    secondaryLabel: string;
    secondaryHref: string;
    panelTitle: string;
    panelBody: string;
  }
> = {
  hosted_review: {
    title: "Site-specific world models from real capture.",
    description:
      "Request one exact site, inspect proof, and choose package access, hosted review, or new capture without losing provenance.",
    primaryLabel: "Request world model",
    primaryPath: "world-model",
    secondaryLabel: "Browse world models",
    secondaryHref: "/world-models",
    panelTitle: "Start here",
    panelBody:
      "Name one site and workflow. Proof stays attached before access expands.",
  },
  proof_pack: {
    title: "Site-specific world models from real capture.",
    description:
      "Start with one real place and the robot task you need to prove. Capture source, rights, package scope, and hosted review stay tied together.",
    primaryLabel: "Request world model",
    primaryPath: "world-model",
    secondaryLabel: "Browse world models",
    secondaryHref: "/world-models",
    panelTitle: "Start here",
    panelBody:
      "Browse what exists, request what is missing, or ask for hosted review.",
  },
};

const robotTeamDecisionSteps = [
  {
    title: "Name the exact site",
    body: "Bring the facility, route, site class, or operating context your team needs to test.",
  },
  {
    title: "Review attached proof",
    body: "Inspect capture basis, freshness, rights limits, package scope, and sample-vs-approved status.",
  },
  {
    title: "Choose the buyer path",
    body: "Move into package access, hosted evaluation, or a capture request when the catalog does not yet show the exact world.",
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
    "world-model",
  );
  const bottomCtaHref = buildRobotTeamContactHref(
    heroVariant,
    "home-bottom",
    heroContent.primaryPath,
  );

  const metrics = useMemo(
    () => [
      {
        label: "Real capture",
        detail: "A walkthrough or site record starts the product. Provenance and limits stay attached.",
      },
      {
        label: "Site product",
        detail: "Blueprint packages the capture into a site-specific world model, buyer listing, and export scope.",
      },
      {
        label: "Hosted eval",
        detail: "A managed review path lets robot teams inspect task scenarios before file handoff.",
      },
      {
        label: "Buyer proof",
        detail: "Use the proof before committing travel, rollout spend, or deeper integration.",
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
        title="Blueprint | Site-Specific World Models For Robot Training And Evaluation"
        description="Blueprint turns real-site capture into site-specific world models robot teams can train on, evaluate against, license, and review before deployment work."
        canonical="/"
        jsonLd={[
          organizationJsonLd(),
          websiteJsonLd(),
          webPageJsonLd({
            path: "/",
            name: "Blueprint",
            description:
              "Real-site capture, site-specific world models, hosted evaluation, and clear paths for robot teams, site operators, and capturers.",
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
                    <ProofChip light>Exact-site world models</ProofChip>
                    <ProofChip light>Hosted review</ProofChip>
                  </div>
                  <h1 className="font-editorial max-w-[40rem] text-[2.85rem] leading-[0.92] tracking-[-0.04em] text-white sm:text-[4.35rem]">
                    {heroContent.title}
                  </h1>
                  <p className="mt-5 max-w-[31rem] text-base leading-7 text-white opacity-90 sm:text-[1.03rem] sm:leading-8">
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
                  <div className="w-full max-w-[18rem] border border-white/15 bg-black/35 p-5 text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.58)] backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                    Robot-team next step
                  </p>
                  <h2 className="mt-4 text-lg font-semibold">{heroContent.panelTitle}</h2>
                  <p className="mt-2 text-sm text-white/60">
                    {heroContent.panelBody}
                  </p>
                  <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/70">
                    Capture first. World-model product next. Review before commitment.
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="border-b border-black/10 bg-[#101310] text-white" data-home-section="product-stack">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.43fr_0.57fr] lg:px-10 lg:py-14">
            <div className="max-w-xl">
              <ProofChip light>Commercial product</ProofChip>
              <h2 className="font-editorial mt-5 text-[3rem] leading-[0.9] tracking-[-0.05em] sm:text-[4.15rem]">
                Blueprint sells exact-site products, not generic demos.
              </h2>
              <p className="mt-6 text-base leading-8 text-white/76">
                Blueprint turns real capture into site-specific packages, hosted review paths, and
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
                description="A buyer request should name the place, workflow, and robot question. Blueprint then keeps the capture-backed proof, package scope, and hosted path together."
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
              title="Exact-site capture turns vague simulation demand into a buyer-ready package."
              description="The useful details are local: aisle width, signage, occlusions, public access boundaries, restricted areas, and the robot task a team is actually deciding on."
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
            title="Request one exact-site world model."
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
