import { SEO } from "@/components/SEO";
import {
  proofReferenceImageSrc,
  proofReelPosterSrc,
  publicDemoHref,
} from "@/lib/marketingProof";
import { ArrowRight, GitBranch, MapPinned, PlayCircle } from "lucide-react";

const heroSignals = [
  "One exact site first",
  "Controlled variation second",
  "Run, review, and export on the same ground truth",
];

const loopCards = [
  {
    title: "Anchor to the site",
    body:
      "Blueprint starts from one real facility and one real workflow lane, so geometry, constraints, and task context are not guesses.",
    icon: MapPinned,
  },
  {
    title: "Branch realistic variation",
    body:
      "Once the site is grounded, teams can vary clutter, lighting, start states, and other conditions without losing the real-site anchor.",
    icon: GitBranch,
  },
  {
    title: "Run, compare, and export",
    body:
      "Teams can rerun policies, inspect failures, compare checkpoints, and export the useful outputs back into training and deployment review.",
    icon: PlayCircle,
  },
];

const proofChain = [
  {
    title: "Real site capture",
    body: "The workflow starts from the actual facility instead of an abstract environment.",
  },
  {
    title: "Package contract",
    body: "The listing and package path keep freshness, rights, provenance, and export shape visible.",
  },
  {
    title: "Hosted run review",
    body: "The same site supports run review, failure inspection, checkpoint comparison, and export generation.",
  },
];

const comparisonRows = [
  {
    title: "Generic simulation",
    bestFor: "Broad pretraining and early iteration",
    weakOn: "Customer-specific geometry, task semantics, and failure modes",
  },
  {
    title: "Exact site only",
    bestFor: "Grounding to the real geometry and basic fit checking",
    weakOn: "Edge-case probing if the environment stays static",
  },
  {
    title: "Exact site plus controlled variation",
    bestFor: "Site-specific training, checkpoint comparison, and earlier deployment review",
    weakOn: "Still requires final on-site validation and stack-specific signoff",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

function LoopDiagram() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/88 p-6 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.3)]">
      <svg
        viewBox="0 0 800 170"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        aria-label="Three-step loop: anchor, vary, run and export"
      >
        {[
          { cx: 135, label: "Anchor", color: "#0f172a" },
          { cx: 400, label: "Vary", color: "#0f172a" },
          { cx: 665, label: "Run / Export", color: "#0f172a" },
        ].map((step, index) => (
          <g key={step.label}>
            {index < 2 ? (
              <line
                x1={step.cx + 44}
                y1={62}
                x2={step.cx + 221}
                y2={62}
                stroke="#cbd5e1"
                strokeWidth={2}
                strokeDasharray="6 5"
              />
            ) : null}
            <circle cx={step.cx} cy={62} r={42} fill={step.color} opacity={0.08} />
            <circle cx={step.cx} cy={62} r={42} stroke={step.color} strokeWidth={2} fill="none" opacity={0.24} />
            <text x={step.cx} y={58} textAnchor="middle" fill={step.color} fontSize={17} fontWeight={700}>
              {index + 1}
            </text>
            <text x={step.cx} y={136} textAnchor="middle" fill="#334155" fontSize={16} fontWeight={600}>
              {step.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="Blueprint starts with one real site, branches realistic variation around it, and keeps training, run review, and exports tied to the same exact-site ground truth."
        canonical="/how-it-works"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.13),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dbe8e4] blur-3xl" />
          <div className="absolute right-[-8rem] top-14 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
              <div className="max-w-3xl">
                <SectionLabel>How It Works</SectionLabel>
                <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.55rem]">
                  Start with one real site. Train around it.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                  Blueprint anchors training and evaluation to one exact facility, then lets a team branch realistic variation without losing the real-site starting point.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Explore world models
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/sample-deliverables"
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/85 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                  >
                    See sample deliverables
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroSignals.map((item) => (
                  <article
                    key={item}
                    className="rounded-[1.65rem] border border-black/10 bg-white/82 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)]"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Loop</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.25rem]">
                The exact-site loop.
              </h2>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
              <div className="max-w-md">
                <p className="text-sm leading-7 text-slate-600">
                  The useful part is not just seeing the facility once. The useful part is keeping the site truthful while letting a team vary conditions, rerun the job, and export what matters from the same grounded environment.
                </p>
              </div>
              <LoopDiagram />
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {loopCards.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className={
                      index === 1
                        ? "rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]"
                        : "rounded-[1.85rem] border border-black/10 bg-[#fbf9f5] p-6"
                    }
                  >
                    <div
                      className={
                        index === 1
                          ? "flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white"
                          : "flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800"
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3
                      className={
                        index === 1
                          ? "mt-4 text-2xl font-semibold tracking-tight text-white"
                          : "mt-4 text-2xl font-semibold tracking-tight text-slate-900"
                      }
                    >
                      {item.title}
                    </h3>
                    <p
                      className={
                        index === 1
                          ? "mt-4 text-sm leading-7 text-white/78"
                          : "mt-4 text-sm leading-7 text-slate-600"
                      }
                    >
                      {item.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Proof Path</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
              Proof path, not abstract positioning.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
            <article className="rounded-[1.95rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.3)]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={proofReelPosterSrc}
                    alt="Real site capture proof for Blueprint's sample listing."
                    className="aspect-[16/10] w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={proofReferenceImageSrc}
                    alt="Hosted review reference still for Blueprint's sample listing."
                    className="aspect-[16/10] w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {proofChain.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[1.95rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Buyer Meaning
              </p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                The same site should carry the proof and the commercial path.
              </h3>
              <p className="mt-4 text-sm leading-7 text-white/76">
                The page should move from real-site evidence to package contract to hosted review to export shape. That sequence tells a buyer more than a long product philosophy paragraph ever will.
              </p>
              <a
                href={publicDemoHref}
                className="mt-6 inline-flex items-center text-sm font-semibold text-white underline-offset-4 hover:underline"
              >
                Inspect the sample listing
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </article>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Comparison</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                Where Blueprint fits in the training stack.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {comparisonRows.map((row, index) => (
                <article
                  key={row.title}
                  className={
                    index === 2
                      ? "rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]"
                      : "rounded-[1.85rem] border border-black/10 bg-[#fbf9f5] p-6"
                  }
                >
                  <h3
                    className={
                      index === 2
                        ? "text-2xl font-semibold tracking-tight text-white"
                        : "text-2xl font-semibold tracking-tight text-slate-900"
                    }
                  >
                    {row.title}
                  </h3>
                  <div className="mt-5 space-y-4 text-sm leading-7">
                    <div>
                      <p
                        className={
                          index === 2
                            ? "text-xs font-semibold uppercase tracking-[0.18em] text-slate-300"
                            : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                        }
                      >
                        Best for
                      </p>
                      <p className={index === 2 ? "text-slate-100" : "text-slate-700"}>
                        {row.bestFor}
                      </p>
                    </div>
                    <div>
                      <p
                        className={
                          index === 2
                            ? "text-xs font-semibold uppercase tracking-[0.18em] text-slate-300"
                            : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                        }
                      >
                        Watch-out
                      </p>
                      <p className={index === 2 ? "text-slate-200" : "text-slate-600"}>
                        {row.weakOn}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 pt-14 sm:pt-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2.15rem] border border-black/10 bg-slate-950 px-6 py-8 text-white shadow-[0_26px_70px_-48px_rgba(15,23,42,0.85)] sm:px-8">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Next Step
                  </p>
                  <h2 className="font-editorial mt-3 text-4xl tracking-[-0.05em] text-white sm:text-[3rem]">
                    Start with one real site and one deployment question.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    That is enough to decide whether you need the package, the hosted path, or a custom scope. The rest of the workflow gets much cleaner once the site is grounded.
                  </p>
                </div>
                <div className="grid gap-3">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Explore world models
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="/sample-deliverables"
                    className="inline-flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    See sample deliverables
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
