import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ProofModule } from "@/components/site/ProofModule";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

const heroSignals = [
  "Train and evaluate policies on the exact customer facility.",
  "Generate site-specific data for fine-tuning before anyone books travel.",
  "Compare releases on the same site so regressions show up early.",
];

const useCaseCards = [
  {
    title: "Policy evaluation",
    body: "Run your policy on the exact site layout, task lane, and handoff points. Know what breaks before the field week starts.",
  },
  {
    title: "Site-specific fine-tuning",
    body: "Generate rollouts, observations, and failure cases from the real facility and feed them back into training.",
  },
  {
    title: "Release comparison",
    body: "Run the same site after each autonomy update. Catch regressions before they reach a customer.",
  },
  {
    title: "Data generation",
    body: "Export site-grounded datasets, varied scenarios, and edge-case rollouts for offline training and adaptation.",
  },
];

const buyerSteps = [
  {
    title: "Pick one real site",
    body: "Start from the customer facility and workflow that actually matters for your next deployment.",
  },
  {
    title: "Choose how to access",
    body: "Buy the site package to train in your own stack, or request hosted evaluation for managed runs and exports.",
  },
  {
    title: "Train and ship",
    body: "Fine-tune policies, compare releases, and bring site-grounded evidence into your deployment decision.",
  },
];

const trustCards = [
  {
    title: "Real sites, not synthetic stand-ins",
    body: "Every world model is built from real indoor capture of the actual facility your robot needs to work in.",
  },
  {
    title: "Clear buying options",
    body: "Every listing points to the same two choices: buy the site package or request a hosted evaluation.",
  },
  {
    title: "Visible compatibility",
    body: "Robot assumptions, export formats, privacy notes, and freshness details stay visible where you make decisions.",
  },
];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-slate-200 [mask-image:radial-gradient(80%_80%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern id="home-grid" width={36} height={36} x="50%" y={-1} patternUnits="userSpaceOnUse">
          <path d="M.5 36V.5H36" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#home-grid)" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Train Your Robot On The Exact Customer Site"
        description="Blueprint gives robot teams site-specific world models for policy evaluation, fine-tuning, and data generation — built from real indoor capture of exact customer facilities."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        {/* Hero */}
        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                For Robot Teams
              </p>
              <h1 className="mt-5 text-[3.5rem] font-semibold tracking-tight text-slate-950 sm:text-[4.3rem] sm:leading-[0.93]">
                Train your robot on the exact customer site before you visit.
              </h1>
              <p className="mt-4 max-w-2xl text-[1.05rem] leading-8 text-slate-600">
                Blueprint turns real customer facilities into site-specific world models your team
                can evaluate policies on, generate training data from, and fine-tune against — before
                anyone books travel.
              </p>
              <div className="mt-5 grid gap-2.5">
                {heroSignals.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/world-models"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Explore world models
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Request hosted evaluation
                </a>
                <a
                  href={publicDemoHref}
                  className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                >
                  View public demo
                </a>
              </div>
              <a
                href="mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <Mail className="h-4 w-4" />
                Prefer email? Send a short brief.
              </a>
            </div>
          </div>
        </section>

        {/* Proof */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <ProofModule
            eyebrow="Start with proof"
            title="See the real site first, then decide how deep to go."
            description="The public demo listing answers the first trust question: is this a real site? From there, decide whether to buy the site package for your own training pipeline or request hosted evaluation."
            caption="Public walkthrough from the live demo listing."
          />
        </section>

        {/* Buying paths */}
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <OfferComparison
            eyebrow="Two access paths"
            title="Buy the site package or run it with Blueprint."
            description="Use the site package when you need exact-site data in your own training pipeline. Use hosted evaluation when you want Blueprint to run evaluations, generate data, and export results."
          />
        </section>

        {/* Use cases */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Why this works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Policies trained on exact sites outperform generic sim.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              MIT's RialTo and similar sim-to-real studies found 50-200% gains when teams trained on reconstructed target environments instead of generic scenes. Blueprint gives your team that exact environment.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {useCaseCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Buyer path */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Three steps from site to shipping.
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {buyerSteps.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-stone-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                No guessing about what is real, supported, or allowed.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The trust layer sits right next to the listing so technical buyers can decide without a long back-and-forth.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/about"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                About Blueprint
              </a>
              <a
                href="/docs"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Compatibility & exports
              </a>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {trustCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
