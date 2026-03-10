import { useEffect, useState } from "react";
import { analyticsEvents } from "@/components/Analytics";
import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import { MarketSignalsSection } from "@/components/site/MarketSignalsSection";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  MapPinned,
  ScanLine,
  Sparkles,
} from "lucide-react";

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
    title: "Digital twin",
    badge: "Step 1",
    description:
      "Blueprint turns a real site into a site-specific digital twin your team can actually use.",
    bullets: [
      "We capture the real work area, route, and handoff points",
      "You get one shared picture of what the site looks like",
    ],
    ctaLabel: "Request a site twin",
    ctaHref: "/contact?interest=site-qualification",
    icon: <MapPinned className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Readiness Pack",
    badge: "Step 2",
    description:
      "The twin becomes a clear report on feasibility, blockers, and what needs to happen next.",
    bullets: [
      "Simple read on what is possible and what is blocked",
      "A short write-up your team can use right away",
    ],
    ctaLabel: "See the deliverable",
    ctaHref: "/readiness-pack",
    icon: <FileText className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Robot-team evaluation",
    badge: "Step 3",
    description:
      "Robot teams can evaluate against the twin before anyone burns pilot budget in the building.",
    bullets: [
      "Better fit checks before field time starts",
      "A faster path to pilots and deployments when the site is real",
    ],
    ctaLabel: "For robot teams",
    ctaHref: "/for-robot-integrators",
    icon: <Bot className="h-8 w-8 text-zinc-900" />,
  },
];

const whyBlueprint = [
  {
    title: "The site matters more than the pitch deck",
    description:
      "Most deployment trouble starts in the building. The twin makes the real constraints hard to ignore.",
  },
  {
    title: "Operators need a clear feasibility read",
    description:
      "Blueprint shows what is possible, what is blocked, and what would need to change.",
  },
  {
    title: "Robot teams need a real place to evaluate",
    description:
      "The twin gives teams a cleaner way to evaluate before they spend time on a live pilot.",
  },
];

const whatYouGet = [
  {
    title: "Site-specific digital twin",
    description: "A usable view of the real site, task area, route, and handoff points.",
  },
  {
    title: "Readiness and report",
    description: "A clear write-up on feasibility, blockers, readiness, and next steps.",
  },
  {
    title: "Robot-team evaluation path",
    description: "A simple way for teams to review the site and decide whether to go deeper.",
  },
];

const routeToMarket = [
  {
    title: "An operator starts with a site",
    description:
      "Blueprint builds the twin so the operator can understand what is feasible before inviting more pilot work.",
  },
  {
    title: "A robot team starts with a target site",
    description:
      "Blueprint builds the twin so the team can evaluate the real site before pushing toward deployment.",
  },
];

const labBullets = [
  "Evaluate against the twin before travel and field time",
  "See blockers early instead of finding them during a pilot",
  "Move faster when the site is ready for a real deployment",
];

const providerBullets = [
  "See what is possible, blocked, and still unknown",
  "Get a report back without losing the twin as the main asset",
];

export const HOME_HERO_VARIANTS: HomeHeroVariant[] = [
  {
    id: "platform",
    eyebrow: "Deployment Readiness Platform",
    headline: "The deployment readiness platform for physical AI.",
    body:
      "Blueprint turns a real site into a digital twin your team can use to see what is feasible, what is blocked, and what robot teams should evaluate next.",
    supportingPoints: ["Site twin", "Feasibility", "Team evaluation"],
  },
  {
    id: "sites-ready",
    eyebrow: "Deployment Readiness Platform",
    headline: "We help sites get ready for robot deployment.",
    body:
      "It starts with a site-specific digital twin, then a clear read on blockers, readiness, and the next step for the teams that fit.",
    supportingPoints: ["Digital twin", "Blockers", "Next step"],
  },
  {
    id: "deployable-opportunity",
    eyebrow: "Deployment Readiness Platform",
    headline: "Blueprint turns a real site into a deployable opportunity.",
    body:
      "We build the twin first, use it to show what is and is not possible, and help robot teams evaluate before a pilot.",
    supportingPoints: ["Build the twin", "Show feasibility", "Move to pilot"],
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
        title="Blueprint | Digital Twins For Robot Deployments"
        description="Blueprint turns a real site into a digital twin so operators can understand feasibility and robot teams can evaluate before pilots."
        canonical="/"
        image="https://tryblueprint.io/images/og-home.png"
      />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="relative pb-16 pt-10 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
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
                  primaryLabel="See how it works"
                  secondaryHref="/contact?interest=site-qualification"
                  secondaryLabel="Request a site twin"
                />

                <div className="pt-2 opacity-80 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0 sm:pt-4">
                  <LogoWall />
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                    <img
                      src="/images/hero-digital-twin-v3.svg"
                      alt="Illustration of a commercial site prepared for robot deployment review"
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                      What Blueprint Does
                    </div>
                    <p className="text-sm text-zinc-600">
                      Blueprint is the system that turns a real site into a digital twin, uses that
                      twin to show what is and is not feasible, and gives robot teams a way to
                      evaluate before burning pilot budget.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                <ScanLine className="h-3 w-3" />
                What You Get
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                A simple path from site twin to a clear next step.
              </h2>
              <p className="mt-4 text-zinc-600">
                First we build the twin. Then we use it to show feasibility, blockers, readiness,
                and what the right robot team should evaluate next.
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
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Two ways a project starts</h2>
            <p className="mt-4 text-zinc-600">
              Sometimes the operator starts with a site they want to understand. Sometimes a robot
              team starts with a site they want to evaluate. Either way, the twin comes first.
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

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">Why teams use Blueprint</h2>
              <p className="mt-2 text-zinc-600">
                The twin gives operators and robot teams the same view of the site before money and
                time start disappearing into a pilot.
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

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                For Robot Teams
              </p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">
                Evaluate against the twin before you burn pilot budget.
              </h3>
              <ul className="mt-4 space-y-2">
                {labBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/for-robot-integrators"
                className="mt-6 inline-flex rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                For robot teams
              </a>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-8 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                For Site Operators
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                See what is possible, what is blocked, and what needs to change.
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
                href="/readiness-pack"
                className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                See the Readiness Pack
              </a>
            </div>
          </div>
        </section>

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
                  <p className="font-semibold text-zinc-900">How it works</p>
                  <p className="text-sm text-zinc-500">From site to twin to evaluation</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/readiness-pack"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Readiness Pack</p>
                  <p className="text-sm text-zinc-500">See the report that comes out of the twin</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/for-robot-integrators"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">For robot teams</p>
                  <p className="text-sm text-zinc-500">Use the twin to evaluate before a pilot</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Share the site and workflow. We&apos;ll build the twin from there.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Blueprint builds the digital twin, shows what is feasible, and gives the right robot
              teams a better way to evaluate before the pilot starts.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/contact?interest=site-qualification"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Request a site twin
              </a>
              <a
                href="/readiness-pack"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                See the Readiness Pack
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
