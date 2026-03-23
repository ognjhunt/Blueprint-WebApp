import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import {
  ArrowRight,
  Building2,
  Camera,
  FolderOutput,
  Play,
  ShieldCheck,
} from "lucide-react";

const buyerReasons = [
  {
    title: "Train on the real site, not a proxy",
    body:
      "Fine-tune against the actual deployment layout, sightlines, and task geometry. The point is not to admire the site. It is to make your policy work better there.",
  },
  {
    title: "Evaluate against the place that matters",
    body:
      "Run the same release against the same facility before you spend travel, hardware, or customer time. Catch regressions, bad assumptions, and workflow mismatches early.",
  },
  {
    title: "Generate site-specific data on demand",
    body:
      "Vary scenarios, export rollouts, and build RLDS-style datasets tied to one real facility. That gives your team a grounded data surface for tuning, debugging, and internal review.",
  },
];

const secondaryPaths = [
  {
    title: "Capture App",
    body:
      "Capturers use the mobile app to record walkthroughs and get paid. If you are a robot team, this page is not your starting point.",
    href: "/capture-app",
    label: "Open capture app page",
    icon: Camera,
  },
  {
    title: "For Site Operators",
    body:
      "Facility teams can control access, set privacy rules, and earn revenue share on every world model sold from their space.",
    href: "/for-site-operators",
    label: "See site operator page",
    icon: Building2,
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
        title="Blueprint | Real Sites, Clear World Models"
        description="Blueprint helps robot teams train, evaluate, and generate data on site-specific world models built from real indoor capture."
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
                  Train, test, and ship on the real site.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                  Blueprint sells site-specific world models built from real indoor capture.
                  Use them to fine-tune policies, run evaluations, and generate training data
                  grounded to the actual facility your robot will work in. Not a synthetic
                  proxy. The real place.
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                  Think of each one as a site-faithful 3D environment with hosted runs,
                  exportable outputs, and clear rights around one exact facility.
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
                    href="/world-models/sw-chi-01"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    See sample deliverables
                  </a>
                  <a
                    href="/contact?persona=robot-team"
                    className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                  >
                    Talk to Blueprint
                  </a>
                </div>
              </div>

              <div className="lg:pl-4">
                <ProofModule
                  eyebrow="Product proof"
                  title="A robot team should see the site, the task, and the eval surface immediately."
                  description="This reel shows the current public proof path: one exact site, one concrete listing, and one hosted surface for review, evals, and dataset work. The product should feel usable on first glance."
                  caption="Current public proof built from the Media Room walkthrough and the hosted-session surface already in the repo."
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
              Your policy needs the real site, not a guess.
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
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Product shape
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                One catalog. One proof path. One clear next step.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-[1.5rem] border border-slate-200 bg-stone-50 p-5">
                <FolderOutput className="h-5 w-5 text-slate-700" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Package</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Review the site assets, workflow notes, and export surface before you commit engineering time.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-slate-200 bg-stone-50 p-5">
                <Play className="h-5 w-5 text-slate-700" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Hosted eval session</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Rerun the same site, compare checkpoints, and inspect failure cases without passing files around first.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-slate-200 bg-stone-50 p-5">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Rights and provenance</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep rights, privacy, and workflow limits visible instead of discovering them halfway through a deal.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Other ways in
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Keep the other audiences clear.
              </h2>
            </div>
            <a
              href="/faq"
              className="text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              Read the FAQ
            </a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {secondaryPaths.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                  <Icon className="h-5 w-5 text-slate-700" />
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                  <a href={item.href} className="mt-5 inline-flex text-sm font-semibold text-slate-900">
                    {item.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
