import { SEO } from "@/components/SEO";
import {
  ScrollReveal,
  StaggerGroup,
  InteractiveCard,
  AnimatedCounter,
  HeroPipelineGraphic,
} from "@/components/motion";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Building2,
  Camera,
  CheckCircle2,
  DollarSign,
  Glasses,
  Globe,
  MapPinned,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";

const offeringCards = [
  {
    title: "Capture & Earn",
    description:
      "Walk through any indoor space with your glasses or phone. Grocery stores, offices, warehouses, gyms -- anywhere. Get paid per capture.",
    bullets: [
      "No robotics knowledge needed",
      "Use smart glasses or iPhone with LiDAR",
      "Quality-based pay with device multipliers",
    ],
    ctaLabel: "Start earning",
    ctaHref: "/capture",
    icon: <Camera className="h-8 w-8 text-zinc-900" />,
    accent: "indigo" as const,
  },
  {
    title: "World Models",
    description:
      "Train on the exact site you're deploying to. Site-specific world models dramatically outperform generalized simulations. Browse thousands of real locations.",
    bullets: [
      "Qualification-verified spatial data",
      "Simulation-ready environments",
      "Any indoor location type",
    ],
    ctaLabel: "Browse world models",
    ctaHref: "/world-models",
    icon: <Globe className="h-8 w-8 text-zinc-900" />,
    accent: "emerald" as const,
  },
  {
    title: "Enterprise",
    description:
      "Need a specific location captured? Request on-demand captures, get exclusive access, or add managed deployment support.",
    bullets: [
      "On-demand capture requests",
      "Exclusive world model access",
      "Managed deployment assistance",
    ],
    ctaLabel: "Contact us",
    ctaHref: "/contact?interest=enterprise",
    icon: <Building2 className="h-8 w-8 text-zinc-900" />,
    accent: "violet" as const,
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Capture",
    description:
      "People walk through indoor spaces wearing smart glasses or using their phones. Video, depth, and sensor data are collected automatically.",
    icon: <Glasses className="h-6 w-6" />,
  },
  {
    step: "02",
    title: "Qualify",
    description:
      "Every capture passes through automated quality gates -- coverage checks, blur detection, completeness scoring. Only verified data becomes a world model.",
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    step: "03",
    title: "Deploy",
    description:
      "Robot teams buy site-specific world models, run simulations, and train on the exact environments they'll deploy to. No more generalized guesswork.",
    icon: <Bot className="h-6 w-6" />,
  },
];

const whyBlueprint = [
  {
    title: "Site-specific beats generalized",
    description:
      "Research shows training on an actual site twin gives dramatically better results than generalizing. Blueprint gives robot teams the exact environment they need.",
    icon: <MapPinned className="h-5 w-5" />,
  },
  {
    title: "Qualification is the quality moat",
    description:
      "Anyone can collect raw spatial data. Blueprint's automated qualification pipeline ensures every world model meets a verified readiness standard.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: "The long tail is the strategy",
    description:
      "Grocery stores, coffee shops, clinics, gyms, offices, warehouses -- the more diverse the capture network, the more likely you find your exact target environment.",
    icon: <Globe className="h-5 w-5" />,
  },
];

const forPersonas = {
  capturers: {
    label: "For Capturers",
    headline: "Earn money walking through buildings.",
    bullets: [
      "Any indoor space counts -- no special access required",
      "Use your iPhone, iPad, or smart glasses",
      "Most approved captures land around $40, cash out at $25",
      "Referral program: 10% lifetime on invites",
    ],
    ctaLabel: "Start capturing",
    ctaHref: "/capture",
  },
  robotTeams: {
    label: "For Robot Teams",
    headline: "Train on the exact site you're deploying to.",
    bullets: [
      "Browse world models by location type and robot compatibility",
      "Run simulations in qualification-verified environments",
      "Subscription access for teams with ongoing deployment needs",
      "Request on-demand captures of specific locations",
    ],
    ctaLabel: "Browse world models",
    ctaHref: "/world-models",
  },
  siteOperators: {
    label: "For Site Operators",
    headline: "Your facility is an asset. Earn from it.",
    bullets: [
      "Register your space and approve capture windows",
      "Earn 15-25% of every world model sale from your facility",
      "Get a free qualification report of your space",
      "Attract robot teams ready to deploy at your site",
    ],
    ctaLabel: "Register your space",
    ctaHref: "/for-site-operators",
  },
};

const personaKeys = ["capturers", "robotTeams", "siteOperators"] as const;

const devices = [
  { name: "iPhone / iPad", detail: "ARKit + LiDAR", available: true },
  { name: "Meta Ray-Ban", detail: "DAT SDK", available: true },
  { name: "Android XR Glasses", detail: "Google / Samsung", available: false },
  { name: "Apple Glasses", detail: "Coming 2027", available: false },
];

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
  const [activePersona, setActivePersona] = useState<typeof personaKeys[number]>("capturers");
  const shouldReduce = useReducedMotion();
  const persona = forPersonas[activePersona];

  return (
    <>
      <SEO
        title="Blueprint | The Indoor Spatial Data Marketplace for Robotics"
        description="People capture real indoor spaces with smart glasses and phones. Robot teams buy qualification-verified world models. Train on the exact site you're deploying to."
        canonical="/"
        image="https://tryblueprint.io/images/og-home.png"
      />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        {/* ── Hero ── */}
        <div className="relative pb-16 pt-10 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-4 sm:space-y-6">
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600"
                  >
                    <Sparkles className="h-3 w-3" />
                    Indoor Spatial Data Marketplace
                  </motion.div>
                  <motion.h1
                    initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl"
                  >
                    The indoor spatial data marketplace for robotics.
                  </motion.h1>
                  <motion.p
                    initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg"
                  >
                    People capture real indoor spaces with smart glasses and phones. Robot teams
                    train on the actual sites they'll deploy to. Every world model is
                    qualification-verified.
                  </motion.p>
                  <motion.ul
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35, duration: 0.4 }}
                    className="flex flex-wrap gap-2 pt-1"
                  >
                    {["Capture & earn", "World models", "Qualification-verified"].map(
                      (point) => (
                        <li
                          key={point}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                        >
                          {point}
                        </li>
                      ),
                    )}
                  </motion.ul>
                </div>

                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <a
                    href="/capture"
                    className="group inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-700 hover:shadow-lg"
                  >
                    Start earning
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition-all hover:bg-zinc-50 hover:shadow-sm"
                  >
                    Browse world models
                  </a>
                </motion.div>
              </div>

              {/* Animated hero graphic — replaces static SVG */}
              <HeroPipelineGraphic />
            </div>
          </div>
        </div>

        {/* ── Offering cards ── */}
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
          <StaggerGroup className="mobile-snap-row md:grid md:grid-cols-3 md:gap-6" stagger={0.12}>
            {offeringCards.map((offering) => (
              <InteractiveCard
                key={offering.title}
                accent={offering.accent}
                className="flex h-full flex-col gap-4 p-5 sm:p-6"
              >
                <div className="rounded-xl bg-zinc-100 p-3 text-zinc-900 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  {offering.icon}
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
                    className="group/link inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                  >
                    {offering.ctaLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" />
                  </a>
                </div>
              </InteractiveCard>
            ))}
          </StaggerGroup>
        </section>

        {/* ── How it works ── */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  <ScanLine className="h-3 w-3" />
                  How It Works
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  Capture. Qualify. Deploy.
                </h2>
                <p className="mt-4 text-zinc-600">
                  A three-step pipeline from real-world capture to robot-ready world models.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup
              className="mt-8 mobile-snap-row md:grid md:grid-cols-3 md:gap-4"
              stagger={0.15}
              baseDelay={0.1}
            >
              {howItWorks.map((item) => (
                <InteractiveCard key={item.step} accent="emerald" className="p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-sm font-bold text-indigo-600">{item.step}</p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="mt-3 font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </InteractiveCard>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* ── Why Blueprint ── */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <ScrollReveal>
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Why Blueprint</h2>
              <p className="mt-2 text-zinc-600">
                The only marketplace where every world model is built from real captures and
                passes a verified qualification standard.
              </p>
            </div>
          </ScrollReveal>

          <StaggerGroup className="mobile-snap-row md:grid md:grid-cols-3 md:gap-6" stagger={0.12}>
            {whyBlueprint.map((item) => (
              <InteractiveCard key={item.title} className="p-5 sm:p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  {item.icon}
                </div>
                <h3 className="font-bold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
              </InteractiveCard>
            ))}
          </StaggerGroup>
        </section>

        {/* ── Three personas — interactive tabs ── */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Built for every side of the market</h2>
                <p className="mt-2 text-zinc-600">
                  Whether you capture, build robots, or operate facilities — Blueprint works for you.
                </p>
              </div>
            </ScrollReveal>

            {/* Tab buttons */}
            <ScrollReveal delay={0.1}>
              <div className="mb-6 flex flex-wrap gap-2">
                {personaKeys.map((key) => {
                  const isActive = activePersona === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActivePersona(key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-zinc-900 text-white shadow-md"
                          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {forPersonas[key].label}
                    </button>
                  );
                })}
              </div>
            </ScrollReveal>

            {/* Active persona content */}
            <motion.div
              key={activePersona}
              initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`rounded-2xl p-6 sm:p-8 ${
                activePersona === "capturers"
                  ? "bg-indigo-900 text-white"
                  : activePersona === "siteOperators"
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-white"
              }`}
            >
              <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-widest ${
                      activePersona === "robotTeams" ? "text-zinc-400" : "text-white/60"
                    }`}
                  >
                    {persona.label}
                  </p>
                  <h3
                    className={`mt-2 text-2xl font-bold ${
                      activePersona === "robotTeams" ? "text-zinc-900" : "text-white"
                    }`}
                  >
                    {persona.headline}
                  </h3>
                </div>
                <div>
                  <ul className="space-y-2">
                    {persona.bullets.map((item) => (
                      <li
                        key={item}
                        className={`flex items-start gap-2 text-sm ${
                          activePersona === "robotTeams" ? "text-zinc-600" : "text-white/80"
                        }`}
                      >
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            activePersona === "robotTeams" ? "text-emerald-500" : "text-emerald-400"
                          }`}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={persona.ctaHref}
                    className={`mt-6 inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:shadow-md ${
                      activePersona === "robotTeams"
                        ? "border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                        : "bg-white text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    {persona.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Supported devices ── */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <ScrollReveal>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900">Capture with any device</h2>
              <p className="mt-2 text-zinc-600">
                Start with your iPhone today. LiDAR-equipped iPhone and iPad captures earn the
                highest rates.
              </p>
            </div>
          </ScrollReveal>

          <StaggerGroup className="mobile-snap-row md:grid md:grid-cols-4 md:gap-4" stagger={0.08}>
            {devices.map((device) => (
              <InteractiveCard
                key={device.name}
                accent={device.available ? "emerald" : "zinc"}
                className="p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                    {device.name.includes("iPhone") ? (
                      <Smartphone className="h-5 w-5 text-zinc-700" />
                    ) : (
                      <Glasses className="h-5 w-5 text-zinc-700" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{device.name}</p>
                    <p className="text-xs text-zinc-500">{device.detail}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {device.available ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                      Coming soon
                    </span>
                  )}
                </div>
              </InteractiveCard>
            ))}
          </StaggerGroup>
        </section>

        {/* ── Bottom nav links ── */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <StaggerGroup className="mobile-snap-row md:grid md:grid-cols-3 md:gap-4" stagger={0.1}>
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
                  <p className="text-sm text-zinc-500">Capture, qualify, deploy</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/capture"
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Start earning</p>
                  <p className="text-sm text-zinc-500">Get paid to capture indoor spaces</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/for-robot-teams"
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">For robot teams</p>
                  <p className="text-sm text-zinc-500">Site-specific world models for deployment</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </StaggerGroup>
        </section>

        {/* ── Final CTA ── */}
        <ScrollReveal as="section" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            {/* Subtle animated glow */}
            <motion.div
              animate={shouldReduce ? {} : {
                opacity: [0.3, 0.5, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-indigo-500/20 blur-3xl"
            />
            <motion.div
              animate={shouldReduce ? {} : {
                opacity: [0.2, 0.4, 0.2],
                scale: [1, 1.08, 1],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl"
            />

            <div className="relative">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                The world&apos;s indoor spaces, captured and qualified for robotics.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
                Whether you want to earn by capturing, deploy robots to real sites, or monetize
                your facility -- Blueprint connects every side of the market.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <a
                  href="/capture"
                  className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-all hover:bg-zinc-100 hover:shadow-lg"
                >
                  Start earning
                </a>
                <a
                  href="/world-models"
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800"
                >
                  Browse world models
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
