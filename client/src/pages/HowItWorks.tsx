import { SEO } from "@/components/SEO";
import { ScrollReveal, StaggerGroup } from "@/components/motion";
import { ArrowRight, BarChart3, Database, GitBranch, MapPinned } from "lucide-react";

const loopSteps = [
  {
    title: "Start from one exact site",
    description:
      "Blueprint starts from one real facility and one real workflow so the site, task context, and constraints are not guesses.",
    icon: MapPinned,
  },
  {
    title: "Inspect the listing first",
    description:
      "The listing should show the site, workflow, starting price, available artifacts, public demo status, and any obvious limits before your team asks for more.",
    icon: GitBranch,
  },
  {
    title: "Choose the access path",
    description:
      "Request site-package access when your team wants the exact-site bundle in its own workflow. Request hosted evaluation when you want Blueprint to run the site and send back results.",
    icon: BarChart3,
  },
  {
    title: "Use the outputs to decide next steps",
    description:
      "Use the walkthrough, exports, failure review, and runtime evidence to decide whether travel, a pilot, or deeper technical work is justified.",
    icon: Database,
  },
];

const comparisonRows = [
  {
    title: "Public listing",
    bestFor: "Initial fit checks before outreach or travel",
    weakOn: "It is the first proof layer, not the full evaluation surface",
  },
  {
    title: "Site package access",
    bestFor: "Internal review, integration planning, and teams that want the site in their own workflow",
    weakOn: "Your team still owns the work once the package is in your stack",
  },
  {
    title: "Hosted evaluation",
    bestFor: "Reruns, release comparison, failure review, and exports on the same exact site",
    weakOn: "Nothing here replaces final on-site validation or safety signoff",
  },
];

const useCaseCards = [
  {
    title: "Pre-deployment checks",
    body:
      "Run the real task on the real site before the first travel-heavy customer week starts.",
  },
  {
    title: "Release comparison",
    body:
      "Compare the same workflow after each autonomy update so weak releases show up earlier.",
  },
  {
    title: "Site-grounded exports",
    body:
      "Pull walkthrough and runtime outputs tied to the facility your team actually cares about.",
  },
  {
    title: "Operator alignment",
    body:
      "Get buyers, operators, and internal stakeholders aligned around the same exact site instead of abstract demos.",
  },
];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-slate-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-how"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-how)" />
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint helps robot teams answer exact-site deployment questions earlier: inspect the listing, choose the access path, and use the outputs to decide next steps."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white text-slate-900">
        <DotPattern />

        <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.96))] pb-16 pt-14 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
                How It Works
              </div>
              <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                How Blueprint helps teams answer exact-site questions earlier.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Blueprint starts from one real customer site, turns it into a clear listing, and
                lets the team move into site-package access or hosted evaluation only when the site
                looks worth deeper work.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/world-models"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Explore world models
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Request hosted evaluation
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50/60 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-10 max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  The operating idea
                </p>
                <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                  The product flow should be legible in four steps.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  A first-time visitor should be able to tell what the site is, what each listing
                  contains, and which path comes next without decoding internal language.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
              {loopSteps.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </article>
                );
              })}
            </StaggerGroup>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Comparison
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  What each surface is for
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The public site should make it obvious what a listing gives you, what the site
                  package gives you, and when hosted evaluation is the better next step.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {comparisonRows.map((row, index) => (
                <article
                  key={row.title}
                  className={`rounded-2xl border p-6 ${
                    index === 2 ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white"
                  }`}
                >
                  <h3 className={`text-2xl font-semibold ${index === 2 ? "text-white" : "text-slate-950"}`}>
                    {row.title}
                  </h3>
                  <div className="mt-5 space-y-4 text-sm leading-7">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${index === 2 ? "text-slate-300" : "text-slate-500"}`}>
                        Best for
                      </p>
                      <p className={index === 2 ? "text-slate-100" : "text-slate-700"}>{row.bestFor}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${index === 2 ? "text-slate-300" : "text-slate-500"}`}>
                        Watch-out
                      </p>
                      <p className={index === 2 ? "text-slate-200" : "text-slate-600"}>{row.weakOn}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50/60 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Common jobs
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Common jobs teams use it for
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  These are the practical jobs that matter once a robotics team starts working
                  against one specific customer site.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {useCaseCards.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ScrollReveal as="section" className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-slate-950 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Start with one real site and one deployment question.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              That is enough to decide whether you need the package, hosted evaluation, or a custom
              engagement. The rest of the workflow gets much cleaner once the site is grounded.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Explore world models
              </a>
              <a
                href="/faq"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Read the FAQ
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
