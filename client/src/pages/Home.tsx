import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ProofModule } from "@/components/site/ProofModule";
import { WhenNotToBuyModule } from "@/components/site/WhenNotToBuyModule";
import {
  companyTrustItems,
  hostedEvaluationDefinition,
  sitePackageDefinition,
  worldModelDefinition,
} from "@/data/marketingDefinitions";
import { publicDemoHref, publicProofAssets } from "@/lib/marketingProof";
import { ArrowRight, Clock3, ScanSearch, ShieldCheck, Workflow } from "lucide-react";

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

const workflowSteps = [
  {
    title: "Inspect the proof first",
    body: "Open the sample listing, runtime still, and deliverables so your team can verify the site, lane, and trust labels before any sales conversation.",
  },
  {
    title: "Choose the buying path",
    body: "Decide whether you need the site package, a Blueprint-run hosted evaluation, or a request-scoped program around a private or higher-friction site.",
  },
  {
    title: "Scope one real question",
    body: "Bring the exact site, the robot setup, and the deployment-fit question that matters before travel, pilot spend, or rollout work starts.",
  },
  {
    title: "Leave with a concrete next step",
    body: "The output is a package path, hosted evaluation path, or a clearly scoped custom program instead of another vague discovery cycle.",
  },
];

const workflowValue = [
  {
    title: "Deployment fit",
    body: "Use one exact site to see whether localization, visibility, reach, traffic, and handoff conditions are worth deeper work before the expensive visit starts.",
  },
  {
    title: "Commercial clarity",
    body: "Keep pricing, proof depth, freshness, restrictions, and rights attached to the listing so the buyer does not have to infer what is actually ready.",
  },
  {
    title: "Repeatable review",
    body: "Run the same lane again after autonomy updates so regressions show up on the environment that matters, not on a nearby stand-in.",
  },
];

const publicNowCards = [
  ...publicProofAssets,
  {
    title: "Hosted evaluation scoping",
    label: "Current public path",
    href: "/exact-site-hosted-review",
    detail: "A dedicated page showing what your team brings, what Blueprint runs, and how hosted evaluation stays tied to the same capture-backed package.",
  },
];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-slate-200 [mask-image:radial-gradient(84%_84%_at_top_right,white,transparent)]"
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
        title="Blueprint | Test The Exact Site Before Deployment"
        description="Blueprint helps robot teams inspect a real facility, choose the right exact-site product path, and answer deployment questions earlier with package and hosted evaluation surfaces grounded in real capture."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(12,74,110,0.1),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.99),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
              <div className="max-w-4xl">
                <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  For Robot Teams
                </p>
                <h1 className="mt-5 text-[3.3rem] font-semibold tracking-tight text-slate-950 sm:text-[4.2rem] sm:leading-[0.95]">
                  Test the exact site before deployment.
                </h1>
                <p className="mt-4 max-w-3xl text-[1.08rem] leading-8 text-slate-600">
                  Blueprint turns one real facility into a site-specific package or hosted evaluation
                  surface so your team can answer a deployment-fit question before travel, pilot spend,
                  and rollout work begin.
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  Start with the proof. Stay tied to the same capture-backed source record. Choose the
                  package path or the Blueprint-run hosted path only after the site itself is legible.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href={publicDemoHref}
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Inspect a real site
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Request hosted evaluation
                  </a>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Already know the facility and workflow lane?{" "}
                  <a href="/book-exact-site-review" className="font-semibold text-slate-900 hover:underline">
                    Book a scoping call.
                  </a>
                </p>
              </div>

              <aside className="rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.5)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  What a buyer should know fast
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    "You can inspect a real public sample before contacting anyone.",
                    "Package and hosted evaluation are different buying motions on the same site.",
                    "Rights, freshness, restrictions, and export boundaries should stay visible.",
                    "Blueprint sells earlier site-specific answers, not deployment guarantees.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              What's public now
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Start with what a serious buyer can inspect today.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The strongest starting point is not a manifesto. It is the live proof surface: the
              sample listing, the runtime reference, the sample artifact layout, and the hosted
              evaluation path that explains the commercial next step.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {publicNowCards.map((asset) => (
              <a
                key={asset.title}
                href={asset.href}
                className="rounded-[1.7rem] border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {asset.label}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{asset.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{asset.detail}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.45)] sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Understand the offer
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                One site, two main product paths, one trust layer.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {definitionCards.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <OfferComparison
            eyebrow="Choose the buying path"
            title="Buy the site data or run the site with Blueprint."
            description="The package path is for teams that want the capture-backed data contract in their own stack. Hosted evaluation is for teams that want Blueprint to run the exact site first. Custom scope is for private or more complex commercial situations."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <ProofModule
            eyebrow="Visual proof"
            title="See the real site first, then inspect the product around it."
            description="The public sample listing is the trust anchor. It proves the site is real, the package is grounded to that site, and the hosted path stays attached to the same facility instead of drifting into generic platform language."
            caption="Real listing footage and public sample assets are shown where available. Product-interface callouts are labeled when they are illustrative previews rather than public product UI."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Real-site workflow
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                    How a buyer should move through the site.
                  </h2>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {workflowSteps.map((step, index) => (
                  <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-800 p-3 text-slate-300">
                  <ScanSearch className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Why teams use it
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                    Earlier answers on the site that matters.
                  </h2>
                </div>
              </div>
              <div className="mt-6 grid gap-3">
                {workflowValue.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What happens next
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                    A short brief should narrow the path, not restart discovery.
                  </h2>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  1. Blueprint reviews the site, workflow lane, and robot context first.
                </p>
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  2. The next reply points you to the package path, hosted evaluation path, or the
                  narrow custom scope that actually matches the site.
                </p>
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  3. Rights, privacy, freshness, and restrictions stay explicit rather than getting
                  buried in vague follow-up language.
                </p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Trust surfaces
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                    What should stay visible all the way through.
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {companyTrustItems.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-600">
                  Public proof, sample artifact layouts, and hosted-access boundaries should be
                  distinguishable at a glance instead of blurred together.
                </div>
              </div>
            </article>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <WhenNotToBuyModule />
        </div>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white sm:p-10">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Start with the proof path that already exists.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Inspect the public sample if you are skeptical. Open hosted evaluation if your team
              needs the managed runtime path. Use contact only after the site and question are real.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={publicDemoHref}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Inspect a real site
              </a>
              <a
                href="/exact-site-hosted-review"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                See hosted evaluation
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
