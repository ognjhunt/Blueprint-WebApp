import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, Clock3, Database, ScanSearch, ShieldCheck, Workflow } from "lucide-react";

const buyerProvides = [
  "The exact facility or listing your team wants to evaluate",
  "The robot setup, stack, policy, or checkpoint you want reviewed",
  "The workflow question that matters before travel, pilot week, or deployment review",
  "Any rights, privacy, security, or commercial topics that should be surfaced early",
];

const blueprintReturns = [
  "A managed hosted run on one exact site tied to the same capture-backed package",
  "Run review, failure review, and comparison surfaces for the selected workflow",
  "Sample artifact layouts for rollout video, exports, and raw bundles tied to the listing",
  "A concrete next step toward package access, hosted session time, or custom scoping",
];

const hostedLoop = [
  "Pick the exact site and workflow lane.",
  "Confirm the robot setup or policy/checkpoint to review.",
  "Launch the managed runtime session on that site.",
  "Inspect the run, failure points, and export surfaces.",
  "Decide whether to continue with hosted time, package access, or a custom scope.",
];

const afterInquiry = [
  "Blueprint reviews the brief and confirms whether hosted evaluation is the right first step.",
  "The follow-up narrows the site, robot, and workflow scope instead of restarting discovery.",
  "If the request is workable, the next reply points to the exact commercial path: package, hosted session, or custom program.",
];

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
                  <p className="mt-1 text-lg font-semibold">Setup → Run → Inspect → Export</p>
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
              Looping runtime panel
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                "Setup",
                "Run",
                "Inspect",
                "Export",
              ].map((step, index) => (
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
        description="Blueprint's hosted evaluation path for one exact site: what the buyer provides, what Blueprint runs, what comes back, and what happens next."
        canonical="/exact-site-hosted-review"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Hosted Evaluation
                </p>
                <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Run the exact site before your robot team travels.
                </h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                  Hosted evaluation is the managed path for one exact site. Blueprint runs the site, keeps the session tied to the same capture-backed package, and returns the run review, export surfaces, and next commercial step your team needs.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Scope hosted evaluation
                  </Link>
                  <Link
                    href="/sample-deliverables"
                    className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
                  >
                    See a sample hosted flow
                  </Link>
                  <Link
                    href={publicDemoHref}
                    className="rounded-full border border-slate-300 bg-stone-100 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-stone-200"
                  >
                    Inspect sample listing
                  </Link>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_24px_90px_-44px_rgba(15,23,42,0.6)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  What this is
                </p>
                <h2 className="mt-3 text-2xl font-semibold">A managed path for one exact site.</h2>
                <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                  <p>One real facility. One workflow lane. One capture-backed package and hosted path.</p>
                  <p>Useful when your team needs runtime evidence before the expensive visit starts.</p>
                  <p className="text-slate-500">
                    Not a deployment guarantee, not a synthetic benchmark, and not a claim that every illustrated UI element is already public product surface.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <HostedIllustrativePanel />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <ScanSearch className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What your team provides
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">What your team provides</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                {buyerProvides.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What Blueprint runs and returns
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">What Blueprint runs and returns</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                {blueprintReturns.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    How the hosted loop works
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">How the hosted loop works</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
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

            <article className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-800 p-3 text-slate-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Trust boundary
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">What stays explicit</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                <li>The hosted path stays attached to the exact site and the same source record.</li>
                <li>Rights, privacy, restrictions, and export entitlements stay visible to the buyer.</li>
                <li>Pricing, legal, security, and irreversible commitments remain human-gated.</li>
                <li>Illustrative previews are labeled so they are not mistaken for customer proof.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What happens after inquiry
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">What happens after inquiry</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {afterInquiry.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Decision point
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Choose the next step that matches the question.</h2>
              <div className="mt-5 grid gap-3">
                <Link
                  href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package"
                  className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Scope hosted evaluation
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sample-deliverables"
                  className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  See a sample hosted flow
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={publicDemoHref}
                  className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Inspect sample listing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
