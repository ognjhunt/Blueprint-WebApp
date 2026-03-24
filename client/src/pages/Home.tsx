import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import { OfferComparison } from "@/components/site/OfferComparison";
import { SiteGroundedLoopGraphic } from "@/components/site/SiteGroundedLoopGraphic";
import { publicDemoHref, resultHighlights } from "@/lib/marketingProof";
import { ArrowRight, Camera, CheckCircle2 } from "lucide-react";

const heroSignals = [
  "Evaluate checkpoints on the exact customer site",
  "Generate site-grounded data for training and debugging",
  "Compare releases before travel, pilots, or customer demos",
];

const useCaseCards = [
  {
    title: "Checkpoint evaluation",
    body:
      "Hold the site fixed and rerun the same task so your team can tell whether a new policy is actually better.",
  },
  {
    title: "Site-grounded data generation",
    body:
      "Pull back rollouts, observations, and failures from one real facility instead of guessing from a broad synthetic scene.",
  },
  {
    title: "Controlled variation",
    body:
      "Start from the exact site, then branch into lighting changes, clutter spikes, and start-state shifts that expose weak spots.",
  },
  {
    title: "Pre-deployment readiness",
    body:
      "Use the same grounded environment for operator prep, customer review, and remote debugging before the real visit starts.",
  },
];

const comparisonCards = [
  {
    title: "Generic sim",
    eyebrow: "Useful early",
    body:
      "Good for broad pretraining and fast iteration. Weak when the question depends on one customer's geometry, workflow, and failure modes.",
  },
  {
    title: "Exact site only",
    eyebrow: "Better anchor",
    body:
      "Now the layout, occlusions, and handoff points are real. Good for buyer confidence, but still too static if you need to probe edge cases.",
  },
  {
    title: "Exact site plus variation",
    eyebrow: "Where the loop closes",
    body:
      "This is the Blueprint story: anchor to the site, branch controlled scenarios, then export the results back into eval, training, and release decisions.",
  },
];

const buyerSteps = [
  {
    title: "Choose one exact site",
    body:
      "Start with the facility and workflow that actually matters for the deployment question in front of you.",
  },
  {
    title: "Pick package or hosted evaluation",
    body:
      "Use the package when you need the site assets. Use hosted evaluation when you need runs, exports, and failure review on the same site.",
  },
  {
    title: "Feed the result back into the stack",
    body:
      "Review the output, compare checkpoints, and export site-grounded data instead of restarting the conversation from scratch.",
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
        title="Blueprint | Site-Grounded World Models For Robot Teams"
        description="Blueprint turns one real facility into a site-grounded world model your robot team can evaluate, vary, and export from before travel, pilots, or deployment."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div>
                <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  For Robot Teams
                </p>
                <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Use the exact site before deployment.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                  Blueprint turns one real facility into a site-grounded world model your team can
                  evaluate, vary, and export from. Use it to test checkpoints, generate
                  site-specific data, compare releases, and walk into the real site with fewer bad
                  assumptions.
                </p>
                <div className="mt-6 grid gap-3">
                  {heroSignals.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                    Open public demo
                  </a>
                  <a
                    href="/how-it-works"
                    className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                  >
                    Why it works
                  </a>
                </div>
              </div>

              <div className="lg:pl-2">
                <SiteGroundedLoopGraphic />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <ProofModule
            eyebrow="Public proof"
            title="A real site is the anchor. The value is what your team does with it."
            description="The public demo proves the site is real. From there, the product should read as a working surface for evaluation, export, and release comparison, not just a walkthrough."
            caption="Public reel from the current demo listing."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <OfferComparison
            eyebrow="Start here"
            title="Choose the access layer that matches the question."
            description="Most teams either need the grounded site assets or they need to run the site now. Both paths stay tied to one real facility so your evals, exports, and internal review start from the same place."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              What teams use this for
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              The point is not just seeing the site.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The point is using the exact site as a grounded surface for evaluation, data
              generation, and deployment decisions.
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
                Why this beats generic sim
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                The real lift comes from exact site plus controlled variation.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Broad simulation still matters. But once the deployment question narrows to one
                customer site, the useful move is to anchor the model to that place and branch
                realistic variations around it.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {comparisonCards.map((item, index) => (
                <article
                  key={item.title}
                  className={`rounded-[1.75rem] border p-6 ${
                    index === 2 ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-stone-50"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                      index === 2 ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {item.eyebrow}
                  </p>
                  <h3 className={`mt-3 text-2xl font-semibold ${index === 2 ? "text-white" : "text-slate-950"}`}>
                    {item.title}
                  </h3>
                  <p className={`mt-4 text-sm leading-7 ${index === 2 ? "text-slate-200" : "text-slate-600"}`}>
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Buyer path
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Three moves usually get a team to the right next step.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {buyerSteps.map((item) => (
              <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
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
                The claims land better when buyers can inspect examples of grounded work that led
                to usable outputs and better deployment calls.
              </p>
            </div>
            <a
              href="/case-studies"
              className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
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
                Keep it lightweight. Capturers only need a short explanation and the app handoff.
                The buyer-facing site should stay focused on robot teams and deployment questions.
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
