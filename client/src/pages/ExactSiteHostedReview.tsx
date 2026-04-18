import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { exactSiteScopingCallPath } from "@/lib/booking";
import {
  proofReferenceImageSrc,
  publicDemoHref,
} from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const heroSignals = [
  "One exact site",
  "Capture-backed hosted path",
  "Package or hosted next step",
];

const buyerProvides = [
  "The site your team wants reviewed",
  "The robot setup, policy, or checkpoint in scope",
  "The workflow question that matters before travel or pilot week",
];

const blueprintReturns = [
  "A managed hosted run on that same capture-backed site",
  "Run review, failure review, and export surfaces",
  "A concrete next step into package access, more hosted time, or custom scope",
];

const hostedLoop = [
  "Pick the site and workflow",
  "Confirm the robot setup",
  "Run the hosted review",
  "Decide the next commercial step",
];

const trustCards = [
  {
    title: "What stays explicit",
    body:
      "Hosted review is not a deployment guarantee. Rights, privacy, restrictions, and export boundaries stay explicit, and irreversible commitments remain human-gated.",
  },
  {
    title: "When this is a fit",
    body:
      "Use this path when one real facility already matters and your team needs run evidence before moving files around or sending the team on-site. Private-site work, unusual robot fit, or custom export requirements are scoped separately.",
  },
  {
    title: "Typical first reply",
    body:
      "Public-listing and hosted-review questions usually get a first reply within 1 business day. Request-scoped rights, privacy, or export review usually gets a first scoped answer within 2 business days.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

function HostedIllustrativePanel() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(241,245,249,0.94))] shadow-[0_24px_90px_-50px_rgba(15,23,42,0.5)]">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
          Illustrative product preview
        </p>
        <h2 className="mt-2 text-xl font-semibold">Hosted evaluation workspace</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
          This is a representative UI layout showing setup, run review, and export surfaces. It is an illustrative preview, not a claim that every screen below is already public product UI.
        </p>
      </div>
      <div className="grid gap-px bg-slate-200 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 bg-white p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Setup</p>
            <div className="mt-3 grid gap-3">
              {[
                ["Site", "Harborview Grocery Distribution Annex"],
                ["Robot", "Unitree G1 + wrist cam"],
                ["Policy", "aisle-pick-v4"],
                ["Scenario", "Default lane + clutter variation"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Sample artifact layout
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Export cards, failure summary, and rollout objects shown here are representative layouts tied to the hosted path.
            </p>
          </div>
        </div>
        <div className="space-y-4 bg-stone-50 p-5">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Run review</p>
                  <p className="mt-1 text-lg font-semibold">Setup to review to export</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  "Starting observation returned",
                  "Checkpoint compared against prior run",
                  "Failure review and export bundle prepared",
                ].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Loop step {index + 1}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: "Sample export bundle",
                  body: "Rollout video, run summary, comparison notes, and raw bundle references.",
                },
                {
                  title: "Sample artifact layout",
                  body: "Manifest-driven cards showing what a buyer can inspect without overstating customer outcomes.",
                },
                {
                  title: "Trust boundary",
                  body: "The hosted path stays tied to one capture-backed package with explicit rights and restriction metadata.",
                },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Hosted path
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {["Setup", "Run", "Inspect", "Export"].map((step, index) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{step}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width: `${55 + index * 12}%`,
                        animation: "pulse 2.4s ease-in-out infinite",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExactSiteHostedReview() {
  return (
    <>
      <SEO
        title="Exact-Site Hosted Review | Blueprint"
        description="Blueprint's hosted review path for one exact site: a capture-backed managed run with review surfaces, export framing, and a clear next step."
        canonical="/exact-site-hosted-review"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_10%,_rgba(14,116,144,0.14),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.76),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-6rem] top-28 h-56 w-56 rounded-full bg-[#dfe9de] blur-3xl" />
          <div className="absolute right-[-7rem] top-16 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:items-end">
              <div className="max-w-3xl">
                <SectionLabel>Hosted Review</SectionLabel>
                <h1 className="font-editorial mt-5 max-w-4xl text-[3.5rem] leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-[4.7rem]">
                  Run one exact site before your team travels.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                  Blueprint hosts the review, keeps it tied to the same capture-backed package, and returns the run evidence your team needs to decide the next move.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Scope hosted review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href="/sample-deliverables"
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/85 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                  >
                    See sample deliverables
                  </Link>
                  <Link
                    href={publicDemoHref}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-[#f3ede3] px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-[#ece4d8]"
                  >
                    Inspect sample listing
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  {heroSignals.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <article className="group relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#d8d5cd] shadow-[0_30px_80px_-54px_rgba(15,23,42,0.45)]">
                <img
                  src={proofReferenceImageSrc}
                  alt="Runtime reference still for Blueprint's public sample site."
                  className="h-full min-h-[27rem] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.74))]" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                    Exact-site review path
                  </p>
                  <h2 className="font-editorial mt-3 text-3xl tracking-[-0.04em] text-white">
                    Hosted review stays tied to the same site package.
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-7 text-white/80">
                    This path is for one real facility, one workflow lane, and one commercial decision. It is not a deployment guarantee or a generic benchmark pass.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.34fr_0.66fr] lg:items-start">
            <div className="max-w-md">
              <SectionLabel>Preview</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                See the hosted path before the call.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The preview shows representative setup, run review, and export framing for one exact site. It is an illustrative product preview, not a claim that every pictured panel is already public UI or customer proof.
              </p>
            </div>
            <HostedIllustrativePanel />
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Commercial Shape</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.35rem]">
                Bring the question. Get the run evidence.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <article className="rounded-[1.9rem] border border-black/10 bg-[#fbf9f5] p-6">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">What your team brings</h3>
                <ul className="mt-5 space-y-3">
                  {buyerProvides.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
                <h3 className="text-2xl font-semibold tracking-tight">What comes back</h3>
                <ul className="mt-5 space-y-3">
                  {blueprintReturns.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-7 text-white/80">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <article className="mt-5 rounded-[1.9rem] border border-black/10 bg-white p-6">
              <h3 className="text-2xl font-semibold tracking-tight text-slate-900">How the hosted path moves</h3>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {hostedLoop.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Trust And Fit</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.25rem]">
              Keep the decision clear.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {trustCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[1.85rem] border border-black/10 bg-white/85 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)]"
              >
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2.25rem] border border-black/10 bg-slate-950 px-6 py-10 text-white shadow-[0_30px_80px_-52px_rgba(15,23,42,0.85)] sm:px-8 lg:px-10 lg:py-12">
              <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
                <div className="max-w-2xl">
                  <SectionLabel>Next Step</SectionLabel>
                  <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-white sm:text-[3.2rem]">
                    Choose the next step for this site.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    Start the hosted-review scope, book a scoping call, or inspect the public sample listing first. Keep the conversation tied to one exact site and one concrete workflow question.
                  </p>
                </div>

                <div className="grid gap-3">
                  <Link
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package"
                    className="inline-flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Scope hosted review
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={exactSiteScopingCallPath}
                    className="inline-flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Book scoping call
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={publicDemoHref}
                    className="inline-flex items-center justify-between rounded-2xl border border-white/15 bg-transparent px-5 py-4 text-sm font-semibold text-white/88 transition hover:bg-white/8"
                  >
                    Inspect sample listing
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
