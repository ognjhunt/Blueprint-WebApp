import { SEO } from "@/components/SEO";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

const trustReasons = [
  "Blueprint starts from one real customer site instead of a generic robotics demo.",
  "The buying surface stays clear: public listing, site package, hosted evaluation, then deeper custom work only if needed.",
  "Rights, privacy, freshness, and export scope stay attached to the listing so teams know what they are buying.",
];

const companyFacts = [
  {
    title: "What Blueprint is",
    body:
      "Blueprint is a product company focused on turning real indoor sites into site-specific world models and hosted evaluation paths for robot teams.",
  },
  {
    title: "Who it serves",
    body:
      "The product is built for robot teams that need better answers before a pilot, field visit, or customer deployment sprint.",
  },
  {
    title: "What makes it credible",
    body:
      "The offer is grounded in real-site capture, visible packaging, hosted evaluation outputs, and a buyer flow that stays tied to one exact facility.",
  },
];

const principles = [
  "Start with the real site, not a vague stand-in.",
  "Keep provenance, privacy, and rights visible all the way through the product.",
  "Make buying paths clear before a sales conversation starts.",
  "Keep the runtime swappable while the customer-facing contract stays stable.",
];

const expectations = [
  "A public listing or concrete site reference before deeper work starts",
  "A clear split between buying the package and requesting hosted evaluation",
  "Straight answers about compatibility, freshness, and export limits",
  "A follow-up from the team that narrows scope instead of reopening discovery",
];

const realityChecks = [
  {
    title: "Built around deployment questions",
    body:
      "Blueprint is shaped around the questions robot teams actually ask: Can the robot handle this lane? What breaks first? What should we review before we travel?",
  },
  {
    title: "Designed for technical buyers",
    body:
      "Pricing, outputs, and constraints are shown in public because serious buyers need enough detail to qualify the opportunity before a meeting.",
  },
  {
    title: "Honest about what it does not replace",
    body:
      "Blueprint helps teams arrive with better evidence. It does not replace final on-site safety review, SAT, or real-world validation.",
  },
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Blueprint helps robot teams inspect, buy, and run exact-site world models before deployment. Learn what the company does, what buyers can expect, and why the product is built this way."
        canonical="/about"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                About Blueprint
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Blueprint exists to make one real customer site understandable before the expensive part starts.
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
                Robotics projects often go sideways for a simple reason: the real site shows up too
                late. Teams discuss the work in abstractions, then the actual building changes the
                whole plan. Blueprint is built to close that gap.
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                We turn real indoor capture into site-specific world models, package those sites in
                a way buyers can understand, and offer a hosted evaluation path when teams need to
                run the exact site before deployment.
              </p>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Why teams trust the surface</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {trustReasons.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">What buyers can expect</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {expectations.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/contact?persona=robot-team"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Contact Blueprint
                </a>
                <a
                  href="mailto:hello@tryblueprint.io"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <Mail className="h-4 w-4" />
                  Email the team
                </a>
              </div>
            </aside>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {companyFacts.map((item) => (
              <section key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Operating principles
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                The product stays grounded in four rules.
              </h2>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-600">
                {principles.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Why this matters
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                Blueprint is meant to reduce avoidable field surprises, not to sell a fantasy.
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {realityChecks.map((item) => (
                  <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-12 rounded-3xl bg-slate-950 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Start with one site and one deployment question.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              That is usually enough to decide whether your team needs the site package, a hosted
              evaluation, or a custom engagement.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Browse world models
              </a>
              <a
                href="/contact?persona=robot-team"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Contact Blueprint
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
