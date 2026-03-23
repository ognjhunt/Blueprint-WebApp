import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ProofModule } from "@/components/site/ProofModule";
import {
  ArrowRight,
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
      "Each listing shows what you can buy first, what the hosted path looks like, and what limits come with that site.",
  },
  {
    title: "Reuse one site across review and testing",
    body:
      "Use the same site for release checks, customer review, and site-specific data work without rebuilding the context each time.",
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
      "Check whether the package already answers the question or whether you need runtime evidence from a hosted evaluation.",
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
        description="Blueprint helps robot teams buy access to the exact site they need, review concrete deliverables, and request hosted evaluations grounded in real indoor capture."
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
                  See the exact site before your robot shows up.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                  Blueprint sells site-specific world models built from real indoor capture. Buy
                  the scene package, request a hosted evaluation, or scope custom work around one
                  facility before travel, pilots, or on-site debugging starts.
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                  Most teams know what they need within a minute: the package, the evaluation
                  path, or a custom conversation.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Browse world models
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/sample-deliverables"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    See sample deliverables
                  </a>
                  <a
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                  >
                    Request evaluation
                  </a>
                </div>
              </div>

              <div className="lg:pl-4">
                <ProofModule
                  eyebrow="Product proof"
                  title="See the site, the deliverables, and the next step in one pass."
                  description="The public sample shows one real listing from first look through hosted review. It is the quickest way to understand what the product feels like in practice."
                  caption="Sample listing and hosted review surface from a Blueprint world model."
                  compact={true}
                />
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
