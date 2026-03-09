import { useEffect, useState } from "react";
import { analyticsEvents } from "@/components/Analytics";
import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import { MarketSignalsSection } from "@/components/site/MarketSignalsSection";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  MapPin,
  ScanLine,
  Shield,
  Sparkles,
} from "lucide-react";

// --- Data ---

type HomeHeroVariant = {
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  supportingPoints: string[];
};

const HOME_HERO_STORAGE_KEY = "bp_home_hero_variant_v2";
const HOME_HERO_QUERY_PARAM = "hero";

const offeringCards = [
  {
    title: "Site qualification",
    badge: "Step 1",
    description:
      "We review the site and the task before anyone spends time on a live pilot.",
    bullets: [
      "We scope the exact task, route, and work area",
      "We flag the obvious blockers early",
    ],
    ctaLabel: "Request site qualification",
    ctaHref: "/contact?interest=benchmark-packs",
    icon: <MapPin className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Readiness Pack",
    badge: "Step 2",
    description:
      "You get a simple answer: ready, risky, or not ready yet.",
    bullets: [
      "Clear task, safety, and site notes",
      "A short recommendation your team can act on",
    ],
    ctaLabel: "See site qualification",
    ctaHref: "/how-it-works",
    icon: <ScanLine className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Qualified opportunities",
    badge: "Step 3",
    description:
      "Once a site is qualified, the right robot teams can review it, respond, and buy deeper checks.",
    bullets: [
      "Operators get a clear brief instead of random inbound interest",
      "Teams can add evaluation, site data, or managed tuning later",
    ],
    ctaLabel: "View qualified opportunities",
    ctaHref: "/deployment-marketplace",
    icon: <Shield className="h-8 w-8 text-zinc-900" />,
  },
];

const whyBlueprint = [
  {
    title: "The site is usually the real problem",
    description:
      "Most pilot problems come from the site, the task, and the workflow, not the slide deck.",
  },
  {
    title: "You need a simple answer early",
    description:
      "Blueprint helps you decide whether to move forward, change the plan, or wait.",
  },
  {
    title: "Matching works better after qualification",
    description:
      "A qualified brief is much easier for the right robot team to review and respond to.",
  },
];

const whatYouGet = [
  {
    title: "Site review",
    description: "We look at the real site, the task, and the constraints that matter.",
  },
  {
    title: "Readiness pack",
    description: "You get a short decision package with the main risks and next steps.",
  },
  {
    title: "Qualified brief",
    description: "If the site is a fit, Blueprint can share a clear brief with the right teams.",
  },
];

const routeToMarket = [
  {
    title: "A site starts the process",
    description:
      "An operator asks Blueprint to qualify a site and workflow before opening the door to robot teams.",
  },
  {
    title: "A robot team brings us in",
    description:
      "A team with a target site uses Blueprint to get a cleaner read before pushing toward a pilot.",
  },
];

const labBullets = [
  "Review a qualified site before committing field time",
  "Buy evaluation or site data only when the site is a fit",
  "Use managed tuning later if the stack supports it",
];

const providerBullets = [
  "Start with a site and workflow review",
  "Open the brief to the right teams only after qualification",
];

export const HOME_HERO_VARIANTS: HomeHeroVariant[] = [
  {
    id: "humanoid-gap",
    eyebrow: "Site Qualification",
    headline: "We check if a site is ready for robots.",
    body:
      "Blueprint reviews the site and the task, then tells you what is ready, what is risky, and what needs work first.",
    supportingPoints: ["Review the site", "Score the task", "Decide next steps"],
  },
  {
    id: "site-readiness",
    eyebrow: "Before The Pilot",
    headline: "Most deployment problems start at the site.",
    body:
      "The hard part is usually task fit, safety, and how the real site behaves day to day.",
    supportingPoints: ["Task fit", "Safety", "Site conditions"],
  },
  {
    id: "field-confidence",
    eyebrow: "Qualified Demand",
    headline: "Qualified sites make matching much easier.",
    body:
      "Once Blueprint has scoped the site and workflow, the right robot teams can review it and respond with less guesswork.",
    supportingPoints: ["Qualified brief", "Team review", "Deeper checks later"],
  },
];

export const HERO_HEADLINES = HOME_HERO_VARIANTS.map((variant) => variant.headline);

function isHomeHeroVariantId(value: string | null): value is HomeHeroVariant["id"] {
  return HOME_HERO_VARIANTS.some((variant) => variant.id === value);
}

function selectHomeHeroVariant(): { variant: HomeHeroVariant; source: string } {
  if (typeof window === "undefined") {
    return { variant: HOME_HERO_VARIANTS[0], source: "default" };
  }

  const params = new URLSearchParams(window.location.search);
  const requestedVariant = params.get(HOME_HERO_QUERY_PARAM);

  if (isHomeHeroVariantId(requestedVariant)) {
    window.localStorage.setItem(HOME_HERO_STORAGE_KEY, requestedVariant);
    return {
      variant: HOME_HERO_VARIANTS.find((variant) => variant.id === requestedVariant)!,
      source: "query",
    };
  }

  const storedVariant = window.localStorage.getItem(HOME_HERO_STORAGE_KEY);
  if (isHomeHeroVariantId(storedVariant)) {
    return {
      variant: HOME_HERO_VARIANTS.find((variant) => variant.id === storedVariant)!,
      source: "storage",
    };
  }

  const randomVariant =
    HOME_HERO_VARIANTS[Math.floor(Math.random() * HOME_HERO_VARIANTS.length)];
  window.localStorage.setItem(HOME_HERO_STORAGE_KEY, randomVariant.id);
  return { variant: randomVariant, source: "random" };
}

// --- Component ---

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />
    </svg>
  );
}

export default function Home() {
  const [{ variant: heroVariant, source: heroVariantSource }] = useState(selectHomeHeroVariant);

  useEffect(() => {
    analyticsEvents.homeHeroView(heroVariant.id, heroVariantSource);
  }, [heroVariant.id, heroVariantSource]);

  return (
    <>
      <SEO
        title="Blueprint | Site Qualification For Robot Deployments"
        description="Blueprint checks whether a site and task are ready for robots, then turns qualified demand into clear opportunities for the right teams."
        canonical="/"
        image="https://tryblueprint.io/images/og-home.png"
      />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        {/* --- Hero Section --- */}
        <div className="relative pb-16 pt-10 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
              {/* Hero Content */}
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-4 sm:space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    {heroVariant.eyebrow}
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                    {heroVariant.headline}
                  </h1>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                    {heroVariant.body}
                  </p>
                  <ul className="flex flex-wrap gap-2 pt-1">
                    {heroVariant.supportingPoints.map((point) => (
                      <li
                        key={point}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <CTAButtons
                  primaryHref="/how-it-works"
                  primaryLabel="See site qualification"
                  secondaryHref="/contact"
                  secondaryLabel="Request site qualification"
                />

                <div className="pt-2 opacity-80 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0 sm:pt-4">
                  <LogoWall />
                </div>
              </div>

              {/* Hero Visual */}
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                    <img
                      src="/images/hero-digital-twin-v3.svg"
                      alt="Illustration of a commercial site prepared for humanoid deployment review"
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                      What Blueprint Does
                    </div>
                    <p className="text-sm text-zinc-600">
                      We review warehouses, factories, retail backrooms, hospitality sites, and
                      other structured indoor spaces before teams commit to a pilot.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Offering Cards --- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {offeringCards.map((offering) => (
              <article
                key={offering.title}
                className="group flex h-full flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-zinc-100 p-3 text-zinc-900 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                    {offering.icon}
                  </div>
                  <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {offering.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{offering.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{offering.description}</p>
                </div>

                <ul className="space-y-2 text-sm text-zinc-600">
                  {offering.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  <a
                    href={offering.ctaHref}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                  >
                    {offering.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <MarketSignalsSection />

        {/* --- What You Get --- */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 mb-4">
                <ScanLine className="h-3 w-3" />
                What You Get
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                A simple path from site review to a clear next step.
              </h2>
              <p className="mt-4 text-zinc-600">
                First we review the site and task. Then we tell you whether to move forward,
                adjust the plan, or wait.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {whatYouGet.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                Two ways a project starts
              </h2>
              <p className="mt-4 text-zinc-600">
                Sometimes the operator starts with a site they want reviewed. Sometimes a robot
                team brings in a known site and asks for a cleaner read before a pilot.
              </p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {routeToMarket.map((item) => (
              <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Why Blueprint --- */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">Why teams use Blueprint</h2>
              <p className="mt-2 text-zinc-600">
                Blueprint helps teams understand the site before travel, integration work, and
                pilot spend start piling up.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {whyBlueprint.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
                >
                  <h3 className="font-bold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- Personas --- */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Robotics Team Persona */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                For Robot Teams
              </p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">
                Start with the site check. Add deeper work only if it is worth it.
              </h3>
              <ul className="mt-4 space-y-2">
                {labBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Facility Provider Persona */}
            <div className="rounded-2xl bg-zinc-900 p-8 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                For Site Operators
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                Get a clear read on your site before you invite more pilot risk.
              </h3>
              <ul className="mt-4 space-y-2">
                {providerBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/deployment-marketplace"
                className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                View qualified opportunities
              </a>
            </div>
          </div>
        </section>

        {/* --- Feature Highlights (Teasers) --- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/how-it-works"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">How the service works</p>
                  <p className="text-sm text-zinc-500">From site review to a clear next step</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/deployment-marketplace-guide"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Humanoid readiness review</p>
                  <p className="text-sm text-zinc-500">See what a simple qualification flow looks like</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/deployment-marketplace"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Qualified opportunities</p>
                  <p className="text-sm text-zinc-500">See the briefs teams can review after qualification</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Bring the right site-specific artifacts into your next deployment.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Share the facility and the workflow you want to prove. We&apos;ll scope the twin,
              the readiness pack, and the artifact path that makes sense whether you are bringing
              a known site or opening the door to marketplace demand.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/solutions"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                See Solutions
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
