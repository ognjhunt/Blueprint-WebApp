import { useEffect, useState } from "react";
import { analyticsEvents } from "@/components/Analytics";
import { CTAButtons } from "@/components/site/CTAButtons";
import { CurrentRobotStateSection } from "@/components/site/CurrentRobotStateSection";
import { LogoWall } from "@/components/site/LogoWall";
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
    title: "Readiness Pack",
    badge: "Step 1",
    description:
      "Start with the site, the task, and a clear readiness decision before anyone buys deeper work.",
    bullets: [
      "Low-friction qualification for site operators",
      "A scoped brief and recommendation the team can use right away",
    ],
    ctaLabel: "Start with qualification",
    ctaHref: "/contact?interest=site-qualification",
    icon: <FileText className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Qualified Opportunity",
    badge: "Step 2",
    description:
      "Robot teams should review qualified site briefs, not random inbound opportunities.",
    bullets: [
      "Monetize better opportunities, not cold leads",
      "Open the right sites to the right teams after qualification",
    ],
    ctaLabel: "View qualified opportunities",
    ctaHref: "/qualified-opportunities",
    icon: <MapPinned className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Technical Evaluation",
    badge: "Step 3",
    description:
      "When both sides are serious, Blueprint adds deeper site-specific diligence for that exact site and team.",
    bullets: [
      "Premium technical upsell once the site is real",
      "A cleaner decision on whether to move toward deployment prep",
    ],
    ctaLabel: "For robot teams",
    ctaHref: "/for-robot-integrators",
    icon: <Bot className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Deployment Prep",
    badge: "Step 4",
    description:
      "Only selected programs move into managed tuning, validation packages, and later data or licensing work.",
    bullets: [
      "Highest-touch enterprise layer",
      "Scene, validation, tuning, and licensing when justified",
    ],
    ctaLabel: "See pricing",
    ctaHref: "/pricing",
    icon: <ScanLine className="h-8 w-8 text-zinc-900" />,
  },
];

const whyBlueprint = [
  {
    title: "The site matters more than the pitch deck",
    description:
      "Most deployment trouble starts in the building. A clean qualification record makes the real constraints hard to ignore.",
  },
  {
    title: "Qualification is the front door",
    description:
      "The first product is a clear readiness call, not a generic marketplace listing.",
  },
  {
    title: "The marketplace comes later",
    description:
      "Robot teams should pay for qualified opportunities and deeper checks only after a site is scoped.",
  },
];

const whatYouGet = [
  {
    title: "Readiness Pack",
    description: "A clear qualification record, blockers, and next-step recommendation.",
  },
  {
    title: "Qualified opportunity",
    description: "A handoff-ready site brief that the right robot teams can actually review.",
  },
  {
    title: "Technical and deployment lanes",
    description: "Deeper evaluation, deployment prep, tuning, or licensing only when the site earns it.",
  },
];

const routeToMarket = [
  {
    title: "An operator starts with a site",
    description:
      "Blueprint qualifies the site first so the operator can understand whether the opportunity is worth opening up.",
  },
  {
    title: "A robot team starts with a qualified brief",
    description:
      "Robot teams review a real, qualified site before buying deeper technical work or deployment prep.",
  },
];

const labBullets = [
  "Review a qualified site before travel and field time",
  "See blockers early instead of finding them during a pilot",
  "Move faster when the site is ready for a real deployment",
];

const providerBullets = [
  "See what is possible, blocked, and still unknown",
  "Get a readiness record first and add downstream assets only when needed",
];

export const HOME_HERO_VARIANTS: HomeHeroVariant[] = [
  {
    id: "platform",
    eyebrow: "Deployment Readiness Platform",
    headline: "The deployment readiness platform for physical AI.",
    body:
      "Blueprint starts with qualification, turns good sites into qualified opportunities, and only then opens deeper evaluation, deployment prep, and later tuning work.",
    supportingPoints: ["Qualification", "Qualified opportunities", "Technical evaluation"],
  },
  {
    id: "sites-ready",
    eyebrow: "Deployment Readiness Platform",
    headline: "We help sites get ready for robot deployment.",
    body:
      "It starts with a low-friction readiness pack, then a cleaner handoff to the right robot teams when the site is real.",
    supportingPoints: ["Readiness pack", "Qualified brief", "Next step"],
  },
  {
    id: "deployable-opportunity",
    eyebrow: "Deployment Readiness Platform",
    headline: "Blueprint turns a real site into a deployable opportunity.",
    body:
      "We do not lead with a generic marketplace. We qualify the site first, open it to the right teams second, and sell deeper technical work only when it is justified.",
    supportingPoints: ["Qualify first", "Open to teams", "Go deeper only when needed"],
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
        title="Blueprint | Qualification For Robot Deployments"
        description="Blueprint qualifies real sites for robot deployment, routes the right opportunities, and prepares downstream evaluation assets only when needed."
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
                  secondaryLabel="Request qualification"
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
                      Blueprint qualifies a real site, shows what is and is not feasible, and
                      gives robot teams a cleaner way to review the opportunity before burning
                      pilot budget.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mobile-snap-row md:grid md:grid-cols-3 md:gap-6">
            {offeringCards.map((offering) => (
              <article
                key={offering.title}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md sm:p-6"
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

        <CurrentRobotStateSection />

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                <ScanLine className="h-3 w-3" />
                What You Get
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                A simple path from site intake to a clear next step.
              </h2>
              <p className="mt-4 text-zinc-600">
                First we qualify the site. Then we route the right next step, whether that is a
                qualified opportunity, a preview asset, or a deeper evaluation package.
              </p>
            </div>
            <div className="mobile-snap-row mt-8 md:grid md:grid-cols-3 md:gap-4">
              {whatYouGet.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Two ways a project starts</h2>
            <p className="mt-4 text-zinc-600">
              Sometimes the operator starts with a site they want to understand. Sometimes a robot
              team starts with a site they want to evaluate. Either way, qualification comes first.
            </p>
          </div>
          <div className="mobile-snap-row mt-8 md:grid md:grid-cols-2 md:gap-6">
            {routeToMarket.map((item) => (
              <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">Why teams use Blueprint</h2>
              <p className="mt-2 text-zinc-600">
                The qualification record gives operators and robot teams the same view of the site
                before money and time start disappearing into a pilot.
              </p>
            </div>

            <div className="mobile-snap-row md:grid md:grid-cols-3 md:gap-6">
              {whyBlueprint.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-6"
                >
                  <h3 className="font-bold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mobile-snap-row md:grid md:grid-cols-2 md:gap-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                For Robot Teams
              </p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">
                Review a qualified site before you burn pilot budget.
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

            <div className="rounded-2xl bg-zinc-900 p-6 text-white sm:p-8">
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

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mobile-snap-row md:grid md:grid-cols-3 md:gap-4">
            <a
              href="/how-it-works"
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">How it works</p>
                  <p className="text-sm text-zinc-500">From site intake to qualification and routing</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/readiness-pack"
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Readiness Pack</p>
                  <p className="text-sm text-zinc-500">See the report that comes out of qualification</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/for-robot-integrators"
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">For robot teams</p>
                  <p className="text-sm text-zinc-500">Review qualified opportunities before a pilot</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Share the site and workflow. We&apos;ll qualify it from there.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Blueprint returns a readiness record first, then opens the right downstream lane only
              when the site earns it.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/contact?interest=site-qualification"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Request qualification
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
