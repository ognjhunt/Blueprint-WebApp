import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ProofModule } from "@/components/site/ProofModule";
import {
  companyTrustItems,
  hostedEvaluationDefinition,
  hostedEvaluationOutputs,
  illustrativeLabel,
  sessionHourDefinition,
  sitePackageDefinition,
  sitePackageIncludes,
  worldModelDefinition,
} from "@/data/marketingDefinitions";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

const heroSignals = [
  "Start from one real customer facility instead of a generic scene.",
  "Inspect the site, workflow, pricing, and access path before your team travels.",
  "Choose site-package access or hosted evaluation only after the listing looks worth deeper work.",
];

const definitionCards = [
  {
    title: "World model",
    body: worldModelDefinition,
  },
  {
    title: "Site package",
    body: sitePackageDefinition,
  },
  {
    title: "Hosted evaluation",
    body: hostedEvaluationDefinition,
  },
];

const workflowCards = [
  {
    title: "Deployment fit",
    body: "Use one exact site to see whether the robot can localize, fit, see the task, and finish the job before the expensive visit starts.",
  },
  {
    title: "Pilot scoping",
    body: "Ground the conversation around one real facility before the first customer week turns into guesswork.",
  },
  {
    title: "Checkpoint comparison",
    body: "Run the same lane after each autonomy update so regressions show up on the exact environment that matters.",
  },
  {
    title: "Site-grounded exports",
    body: "Pull out the walkthrough, runtime outputs, and review artifacts tied to the facility your team actually cares about.",
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
        title="Blueprint | See And Evaluate The Exact Customer Site Before You Travel"
        description="Blueprint helps robot teams inspect exact customer facilities, request site-package access, and run hosted evaluation built from real indoor capture."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                For Robot Teams
              </p>
              <h1 className="mt-5 text-[3.3rem] font-semibold tracking-tight text-slate-950 sm:text-[4.2rem] sm:leading-[0.95]">
                See and evaluate the exact customer site before you travel.
              </h1>
              <p className="mt-4 max-w-3xl text-[1.05rem] leading-8 text-slate-600">
                Blueprint turns real indoor capture into exact-site world models your team can
                inspect before a pilot, field visit, or deployment sprint. Start with the listing,
                then request site-package access or hosted evaluation if the site is worth deeper work.
              </p>
              <p className="mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                <span className="font-semibold text-slate-900">Plain-English version:</span> a
                world model is a site-specific digital environment built from real capture of one
                facility and one workflow lane.
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
                  href={publicDemoHref}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
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

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              What Blueprint is
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Three terms the site should explain in plain English.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The product story is simple: capture one real site, publish a listing that explains
              what exists, then let the buyer choose between site-package access and hosted evaluation.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {definitionCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-3 text-base leading-7 text-slate-700">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <ProofModule
            eyebrow="Visual proof"
            title="See the real site first, then inspect the product around it."
            description="The public demo listing is the first trust check. It shows that the site is real, what workflow is being discussed, and how the site package and hosted path stay tied to the same facility."
            caption="Sample artifact. This proof reel uses current demo assets plus labeled placeholder graphics for the package and export surfaces."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <OfferComparison
            eyebrow="What teams get"
            title="Start with the path that matches the work."
            description="Request site-package access if your team wants the exact-site bundle in its own workflow. Request hosted evaluation if you want Blueprint to run the site, compare checkpoints, and export results before the real visit."
          />
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img
                src="/illustrations/site-package-diagram.svg"
                alt="Illustrative diagram of the site package structure"
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {illustrativeLabel}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">What goes into the site package</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {sitePackageIncludes.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img
                src="/illustrations/export-bundle-diagram.svg"
                alt="Illustrative diagram of hosted evaluation outputs"
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sample artifact
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">What comes back from hosted evaluation</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {hostedEvaluationOutputs.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {sessionHourDefinition}
            </p>
          </article>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              How teams use it
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Use one exact site to answer one expensive question earlier.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Trust and governance
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Clear enough for a skeptical buyer.
              </h2>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
                {companyTrustItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-stone-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Company references</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Blueprint gives robot teams a clearer view of one exact facility before the team
                commits travel, customer time, or deeper technical work. It does not replace final
                on-site validation.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <a href="/about" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  Read about Blueprint
                </a>
                <a href="/governance" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  Review governance and privacy
                </a>
                <a href="/docs" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  See compatibility and export notes
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
