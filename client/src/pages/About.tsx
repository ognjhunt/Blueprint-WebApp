import { SEO } from "@/components/SEO";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

const heroSignals = [
  "Real-site product surfaces",
  "Rights and provenance stay visible",
  "Built for serious robot-team decisions",
];

const companyCards = [
  {
    title: "What Blueprint is",
    body:
      "A buyer-facing system for turning one real facility into site packages, hosted review, and clear trust surfaces tied to the same capture-backed source record.",
  },
  {
    title: "What Blueprint is not",
    body:
      "Not a generic AI marketplace, not a model-demo theater, and not a deployment-guarantee layer pretending uncertainty has disappeared.",
  },
];

const storySteps = [
  "A robot team has one real facility and one workflow question before a field visit starts.",
  "Blueprint's job is to make that site legible earlier through truthful proof, package framing, and hosted review.",
  "That lets the team decide whether to keep moving on the exact site instead of spending time on vague assumptions.",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why Blueprint exists and how it turns real facilities into site packages, hosted review, and buyer-readable trust surfaces."
        canonical="/about"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dbe7df] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
              <div className="max-w-3xl">
                <SectionLabel>About Blueprint</SectionLabel>
                <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.5rem]">
                  Blueprint exists to make one real site legible earlier.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                  Blueprint helps robot teams inspect one exact facility sooner, choose the right product path, and keep rights, privacy, provenance, and hosted-access boundaries readable along the way.
                </p>
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

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="grid gap-4 lg:grid-cols-[0.42fr_0.58fr]">
            <article className="rounded-[1.95rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/10 p-3 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Founder
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Built by Nijel Hunt.</h2>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-white/76">
                Background in robotics simulation, 3D capture, and deployment operations. Blueprint is built around the gap between an interesting robotics demo and serious site-specific deployment work.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://www.linkedin.com/in/nijelhunt/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Founder LinkedIn
                </a>
                <a
                  href="mailto:hello@tryblueprint.io"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Mail className="h-4 w-4" />
                  hello@tryblueprint.io
                </a>
              </div>
            </article>

            <article className="rounded-[1.95rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
              <SectionLabel>Company Framing</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                What Blueprint is and what it is not.
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {companyCards.map((card) => (
                  <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Decision Story</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                Why this matters before the expensive part starts.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {storySteps.map((step, index) => (
                <article
                  key={step}
                  className="rounded-[1.85rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.26)]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{step}</p>
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
                  <p className="mt-3 text-sm leading-7 text-white/72">
                    Start with the public catalog if you want to inspect the proof style, or contact Blueprint when your team already has one exact site and one real question in mind.
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
                    href="/contact?persona=robot-team"
                    className="inline-flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Contact Blueprint
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
