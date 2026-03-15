import { SEO } from "@/components/SEO";
import {
  ScrollReveal,
  StaggerGroup,
  InteractiveCard,
  AnimatedCounter,
  PipelineDiagram,
} from "@/components/motion";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
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
} from "lucide-react";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-how"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-how)" />
    </svg>
  );
}

const threeWhy = [
  {
    title: "Site-specific beats generalized",
    description:
      "Research shows training on an actual site twin gives dramatically better results. Blueprint gives robot teams the exact environment they need.",
    icon: <MapPinned className="h-6 w-6" />,
  },
  {
    title: "Qualification is the quality moat",
    description:
      "Anyone can collect raw spatial data. Blueprint's automated pipeline ensures every world model passes coverage, completeness, and readiness checks.",
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    title: "Crowdsourced scale",
    description:
      "Instead of expensive professional scanning teams, Blueprint's capture network covers any indoor location -- from grocery stores to warehouses to gyms.",
    icon: <Globe className="h-6 w-6" />,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Capture any indoor space",
    icon: <Camera className="h-5 w-5" />,
    description:
      "Capturers walk through real indoor locations using iPhones or smart glasses. Video, depth, and sensor data are collected automatically during a 15-30 minute session.",
  },
  {
    step: "02",
    title: "Automated quality pipeline",
    icon: <ScanLine className="h-5 w-5" />,
    description:
      "Every capture passes through coverage checks, blur detection, and completeness scoring. Only captures that meet the quality bar become world models.",
  },
  {
    step: "03",
    title: "Qualification verification",
    icon: <ShieldCheck className="h-5 w-5" />,
    description:
      "World models are scored against Blueprint's readiness standard -- physical access, environmental conditions, safety constraints, and task feasibility.",
  },
  {
    step: "04",
    title: "Robot teams train and deploy",
    icon: <Bot className="h-5 w-5" />,
    description:
      "Robot teams browse the marketplace, purchase site-specific world models, run simulations, and train on the exact locations they'll deploy to.",
  },
];

const whoEarns = [
  {
    persona: "Capturers",
    icon: <Camera className="h-5 w-5" />,
    stat: 40,
    statPrefix: "$",
    statSuffix: "",
    statLabel: "avg per capture",
    description: "Get paid about $20-$60 per capture session, with most approved captures landing around $40. Quality bonuses and device multipliers increase earnings.",
  },
  {
    persona: "Site Operators",
    icon: <MapPinned className="h-5 w-5" />,
    stat: 25,
    statPrefix: "",
    statSuffix: "%",
    statLabel: "revenue share",
    description: "Earn 15-25% revenue share on every world model sold from your facility. Zero upfront cost.",
  },
  {
    persona: "Blueprint",
    icon: <Globe className="h-5 w-5" />,
    stat: 0,
    statPrefix: "",
    statSuffix: "",
    statLabel: "",
    description: "Operates the marketplace, runs the quality pipeline, and connects supply with demand.",
  },
];

const devices = [
  { name: "iPhone / iPad", detail: "ARKit + LiDAR", icon: <Smartphone className="h-5 w-5" /> },
  { name: "Meta Ray-Ban", detail: "720p + IMU via DAT SDK", icon: <Glasses className="h-5 w-5" /> },
  { name: "Android XR", detail: "Google/Samsung, coming 2026", icon: <Glasses className="h-5 w-5" /> },
  { name: "Apple Glasses", detail: "Coming 2027", icon: <Glasses className="h-5 w-5" /> },
];

export default function HowItWorks() {
  const shouldReduce = useReducedMotion();

  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint turns crowdsourced indoor captures into qualification-verified world models for robot deployment."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-8">
                <div className="space-y-6">
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600"
                  >
                    <Sparkles className="h-3 w-3" />
                    How It Works
                  </motion.div>
                  <motion.h1
                    initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl"
                  >
                    Capture. Qualify. Deploy.
                  </motion.h1>
                  <motion.p
                    initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="max-w-2xl text-lg leading-relaxed text-zinc-600"
                  >
                    People capture real indoor spaces with smart glasses and phones. Blueprint
                    qualifies the data and builds world models. Robot teams train on the exact
                    environments they'll deploy to.
                  </motion.p>
                </div>

                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
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
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition-all hover:bg-zinc-50"
                  >
                    Browse world models
                  </a>
                </motion.div>
              </div>

              {/* Hero sidebar card */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative"
              >
                <div className="absolute -inset-6 rounded-full bg-indigo-500/15 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-start gap-4">
                    <motion.div
                      animate={shouldReduce ? {} : { rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800"
                    >
                      <Globe className="h-5 w-5" />
                    </motion.div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        Three-sided marketplace
                      </p>
                      <p className="text-sm text-zinc-600">
                        Capturers earn money. Robot teams get site-specific world models. Site
                        operators earn passive income from their facilities.
                      </p>
                    </div>
                  </div>

                  {/* Animated stats row */}
                  <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900">
                        <AnimatedCounter value={3} duration={800} />
                      </p>
                      <p className="text-xs text-zinc-500">market sides</p>
                    </div>
                    <div className="h-6 w-px bg-zinc-200" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900">
                        <AnimatedCounter value={40} prefix="$" duration={1000} />
                      </p>
                      <p className="text-xs text-zinc-500">avg payout</p>
                    </div>
                    <div className="h-6 w-px bg-zinc-200" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900">
                        <AnimatedCounter value={100} suffix="%" duration={1200} />
                      </p>
                      <p className="text-xs text-zinc-500">verified</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-10 max-w-2xl">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  Why this works
                </h2>
                <p className="mt-4 text-zinc-600">
                  Professional 3D scanning costs $1,000-$3,500 per site and doesn't scale.
                  Blueprint crowdsources captures at a fraction of the cost and covers every type
                  of indoor location.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup className="mobile-snap-row md:grid md:grid-cols-3 md:gap-6" stagger={0.12}>
              {threeWhy.map((item) => (
                <InteractiveCard key={item.title} accent="indigo" className="p-5 sm:p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
                </InteractiveCard>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Pipeline — now with animated connected diagram */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-12 max-w-3xl">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  The pipeline
                </h2>
                <p className="mt-4 text-lg text-zinc-600">
                  From a person walking through a building to a robot training on that exact
                  environment.
                </p>
              </div>
            </ScrollReveal>

            <PipelineDiagram steps={pipelineSteps} />
          </div>
        </section>

        {/* Who earns — with animated counters */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-10">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  Everyone benefits
                </h2>
              </div>
            </ScrollReveal>

            <StaggerGroup className="grid gap-6 md:grid-cols-3" stagger={0.12}>
              {whoEarns.map((item) => (
                <InteractiveCard key={item.persona} accent="emerald" className="p-5 sm:p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-zinc-900">{item.persona}</h3>
                  {item.stat > 0 && (
                    <p className="mt-1 text-2xl font-bold text-emerald-600">
                      <AnimatedCounter
                        value={item.stat}
                        prefix={item.statPrefix}
                        suffix={item.statSuffix}
                        duration={1000}
                      />
                    </p>
                  )}
                  {item.statLabel && (
                    <p className="text-xs text-zinc-500">{item.statLabel}</p>
                  )}
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </InteractiveCard>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Supported devices */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900">Supported capture devices</h2>
                <p className="mt-2 text-zinc-600">
                  Start with your iPhone today. LiDAR-equipped iPhone and iPad captures earn the highest rates.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
              {devices.map((device) => (
                <InteractiveCard key={device.name} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                      {device.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">{device.name}</p>
                      <p className="text-xs text-zinc-500">{device.detail}</p>
                    </div>
                  </div>
                </InteractiveCard>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* CTA */}
        <ScrollReveal as="section" className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <motion.div
              animate={shouldReduce ? {} : {
                opacity: [0.3, 0.5, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
            />

            <div className="relative">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Ready to get started?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
                Whether you want to earn by capturing spaces, buy world models for robot
                deployment, or register your facility -- there's a place for you.
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
