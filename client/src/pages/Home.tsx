import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import {
  proofHighlights,
  proofReelPosterSrc,
  proofReelVideoSrc,
  publicDemoHref,
  resultHighlights,
} from "@/lib/marketingProof";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  FolderOutput,
  ShieldCheck,
} from "lucide-react";

const buyerReasons = [
  {
    title: "Know the site before you burn travel time",
    body:
      "Review the real layout, constraints, and workflow area instead of relying on a generic stand-in.",
  },
  {
    title: "See the package and the eval path on the same listing",
    body:
      "Each listing shows what you can buy first, what the hosted path covers, and what limits come with that site.",
  },
  {
    title: "Reuse one site across review and testing",
    body:
      "Use the same site for release checks, customer review, and site-specific data generation without rebuilding the context each time.",
  },
];

const sampleDecision = [
  {
    title: "Pick one listing",
    body:
      "Start with the site that matches the workflow your robot actually needs to handle.",
    icon: FolderOutput,
  },
  {
    title: "Decide package or evaluation",
    body:
      "Check whether the package already answers the question or whether you need to run the site and export data from a hosted evaluation.",
    icon: ShieldCheck,
  },
  {
    title: "Send one clear request",
    body:
      "Send the site, task, and robot setup once so the follow-up starts from the real question.",
    icon: CheckCircle2,
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
        title="Blueprint | World Models For Robot Teams"
        description="Blueprint helps robot teams inspect the exact site they need before travel, buy the site package, or request a hosted evaluation on that same real facility."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div>
                <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  For Robot Teams
                </p>
                <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Inspect the exact site before your team books the visit.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                  Blueprint gives robot teams a world model of one real facility and workflow.
                  Start with the public demo, buy the site package, request a hosted evaluation on
                  that same site, or scope custom work before travel, pilots, or on-site debugging
                  begin.
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                  In the first minute, you should be able to tell what it is, whether it matches
                  your robot, and what the next step is.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={publicDemoHref}
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open public demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Browse world models
                  </a>
                  <a
                    href="/case-studies"
                    className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                  >
                    See results
                  </a>
                </div>
              </div>

              <div className="lg:pl-4">
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-stone-950 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.5)]">
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls={false}
                    poster={proofReelPosterSrc}
                    className="aspect-[16/10] h-full w-full object-cover"
                  >
                    <source src={proofReelVideoSrc} type="video/mp4" />
                  </video>
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white/80 p-5 backdrop-blur-sm sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Product proof
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    See the site, the deliverables, and the next step in one pass.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    The public demo is the fastest way to understand the product. It follows one
                    real listing from first look to hosted review and export-ready output.
                  </p>
                  <ul className="mt-5 space-y-3">
                    {proofHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={publicDemoHref}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Start with the demo
                    </a>
                    <a
                      href="/sample-deliverables"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      See sample deliverables
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <OfferComparison />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Why teams buy
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              The value is the real site, not more synthetic footage.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {buyerReasons.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                A typical first pass
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Three moves are usually enough.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                A buyer usually goes from listing to decision in a short loop. The goal is not to
                tell the whole company story. The goal is to answer the next real question.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {sampleDecision.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-stone-50 p-5">
                    <Icon className="h-5 w-5 text-slate-700" />
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Results
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Delivery examples with concrete outcomes.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The product proof is stronger when buyers can inspect examples of work that led to
                specific outcomes, not just the package anatomy.
              </p>
            </div>
            <a
              href="/case-studies"
              className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <BarChart3 className="h-4 w-4" />
              Open results page
            </a>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {resultHighlights.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.outcome}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-8">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <Camera className="h-4 w-4" />
                For Capturers
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Need the capture side instead?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Keep it lightweight. Capturers only need two public pages: a short explanation and
                the app handoff.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <a
                href="/capture"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Capture basics
              </a>
              <a
                href="/capture-app"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open capture app
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
