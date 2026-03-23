import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import {
  ArrowRight,
  Camera,
  FolderOutput,
  Play,
  ShieldCheck,
} from "lucide-react";

const buyerReasons = [
  {
    title: "See the exact site before deployment work starts",
    body:
      "Review the actual layout, constraints, and workflow area instead of using a generic stand-in environment.",
  },
  {
    title: "Decide faster with real deliverables",
    body:
      "Each listing shows the package, hosted evaluation path, and the limits attached to that site so your team can make a concrete call.",
  },
  {
    title: "Use one site across tuning, evals, and review",
    body:
      "Run the same site for checkpoint comparisons, customer review, and site-specific data work without reinventing the environment each time.",
  },
];

const buyerJourney = [
  {
    title: "Browse the catalog",
    body:
      "Start with a site that matches the workflow your robot needs to handle.",
    icon: FolderOutput,
  },
  {
    title: "Review deliverables",
    body:
      "Inspect the package scope, hosted evaluation path, outputs, and rights before you spend engineering time.",
    icon: ShieldCheck,
  },
  {
    title: "Request the next step",
    body:
      "Ask for the package or a hosted evaluation with the site, task, and robot details already filled in.",
    icon: Play,
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
                  Buy access to the exact site your robot needs.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                  Blueprint sells site-specific world models built from real indoor capture. Use
                  them to review the actual facility, request concrete deliverables, and run hosted
                  evaluations before travel, pilots, or on-site debugging starts.
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                  The site is organized around one buyer journey: find the right facility, inspect
                  what you get, and move to the next step quickly.
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
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Request hosted eval
                  </a>
                  <a
                    href="/world-models/sw-chi-01"
                    className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                  >
                    See sample deliverables
                  </a>
                </div>
              </div>

              <div className="lg:pl-4">
                <ProofModule
                  eyebrow="Product proof"
                  title="A buyer should see the site, the deliverables, and the hosted path immediately."
                  description="The proof reel is there to show one concrete listing end to end: the real site, the buyer-facing deliverables, and the review surface your team would actually use."
                  caption="Sample listing and hosted review surface from a real Blueprint world model."
                  compact={true}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Why teams buy
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              The value is specificity, not volume.
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
                Buyer journey
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Keep the path simple.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The public site should answer three things quickly: what site is available, what
                your team gets, and how to request the right next step.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {buyerJourney.map((item) => {
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
                the mobile app handoff.
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
