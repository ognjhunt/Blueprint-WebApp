import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ProofModule } from "@/components/site/ProofModule";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

const heroSignals = [
  "Inspect one real customer site before anyone books travel.",
  "Choose between buying the site package or asking Blueprint to run it.",
  "Export evidence, failure cases, and site-specific data from the same site.",
];

const firstScreenAnswers = [
  {
    title: "What it is",
    body: "A site-specific world model built from one real customer facility.",
  },
  {
    title: "Who it is for",
    body: "Robot teams that need clearer deployment answers before a pilot or visit.",
  },
  {
    title: "How to buy",
    body: "Buy the site package or request a hosted evaluation on the same site.",
  },
];

const useCaseCards = [
  {
    title: "Pre-deployment evaluation",
    body:
      "Check whether the robot can handle the layout, task lane, and handoff points before the field week starts.",
  },
  {
    title: "Site-specific data generation",
    body:
      "Pull back rollouts, observations, and failure cases from the exact place your robot needs to work.",
  },
  {
    title: "Release comparison",
    body:
      "Run the same site after each autonomy update so regressions show up before they reach a customer.",
  },
  {
    title: "Customer and operator review",
    body:
      "Share one clear site reference across the robot team, buyer, and on-site stakeholders.",
  },
];

const buyerSteps = [
  {
    title: "Pick one real site",
    body: "Start from the customer facility and workflow that actually matters for the next decision.",
  },
  {
    title: "Choose the buying path",
    body: "Buy the site package for your own stack, or request a hosted evaluation if you need runs and exports now.",
  },
  {
    title: "Use the outputs",
    body: "Review results, compare releases, and bring site-grounded evidence back into tuning and planning.",
  },
];

const proofCards = [
  {
    title: "How it works",
    body: "See why exact-site grounding beats generic simulation once the deployment question gets specific.",
    href: "/how-it-works",
    cta: "Open how it works",
  },
  {
    title: "Results",
    body: "Review concrete delivery examples and the outcomes teams cared about before they went on site.",
    href: "/case-studies",
    cta: "Open results",
  },
  {
    title: "Deliverables",
    body: "Inspect the package contents, hosted outputs, and trust details a buyer can expect from one listing.",
    href: "/sample-deliverables",
    cta: "See deliverables",
  },
];

const trustCards = [
  {
    title: "Public proof before outreach",
    body:
      "A buyer can inspect the public demo listing before filling out a form, so the first interaction is grounded in a real site.",
  },
  {
    title: "Clear buying options",
    body:
      "Every listing points back to the same two choices: buy the site package or request a hosted evaluation.",
  },
  {
    title: "Visible compatibility and governance",
    body:
      "Robot assumptions, export scope, privacy notes, and freshness details stay visible where buyers make decisions.",
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
        title="Blueprint | Exact-Site Testing For Robot Teams"
        description="Blueprint helps robot teams test on the exact customer site before travel. Browse the site package or request a hosted evaluation on the same site."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div className="max-w-[42rem]">
                <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  For Robot Teams
                </p>
                <h1 className="mt-5 max-w-4xl text-[3.5rem] font-semibold tracking-tight text-slate-950 sm:text-[4.3rem] sm:leading-[0.93]">
                  Test your robot on the exact customer site before you travel.
                </h1>
                <p className="mt-4 max-w-2xl text-[1.05rem] leading-8 text-slate-600">
                  Blueprint turns one real customer site into a working model your team can inspect,
                  buy, or run before a pilot. Start with the site package, or ask Blueprint to run a
                  hosted evaluation on the same site.
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
                    Browse world models
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
                    View public demo listing
                  </a>
                </div>
                <a
                  href="mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                >
                  <Mail className="h-4 w-4" />
                  Prefer a lighter first step? Email a short brief.
                </a>
              </div>

              <div className="grid gap-4">
                {firstScreenAnswers.map((item) => (
                  <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {item.title}
                    </p>
                    <p className="mt-3 text-base font-semibold text-slate-900">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <ProofModule
            eyebrow="Start with proof"
            title="See the real site first, then decide how deep you need to go."
            description="The public demo listing answers the first trust question fast: is this a real site with a real workflow? From there, your team can decide whether to buy the site package or request a hosted evaluation."
            caption="Public walkthrough from the live demo listing."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <OfferComparison
            eyebrow="Two main buying paths"
            title="Buy the site package or run the site with Blueprint."
            description="Most teams need one of two things: the site package in their own stack, or a hosted evaluation that lets them test, compare, and export on the same site without moving files first."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Common jobs
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              What teams actually use Blueprint for
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Once the deployment question narrows to one customer site, teams use Blueprint to
              test, compare, and collect evidence on the place that matters.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {useCaseCards.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Buyer path
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                A first decision usually takes three moves.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {buyerSteps.map((item) => (
                <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-stone-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Proof Hub
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Proof, results, and deliverables now live in one path.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                If a buyer wants to understand the product quickly, these are the three pages that
                answer how it works, what teams get, and what real outcomes look like.
              </p>
            </div>
            <a
              href="/proof"
              className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Open proof hub
            </a>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {proofCards.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                <a
                  href={item.href}
                  className="mt-5 inline-flex items-center text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                >
                  {item.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Trust
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Buyers should not have to guess what is real, supported, or allowed.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Blueprint keeps the trust layer close to the listing so technical buyers can make a
                decision without a long back-and-forth first.
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
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {trustCards.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
