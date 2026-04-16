import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import {
  hostedEvaluationOutputs,
  illustrativeLabel,
  listingVariationItems,
  sampleArtifactLabel,
  sitePackageIncludes,
  stableContractItems,
} from "@/data/marketingDefinitions";
import {
  publicDemoHref,
  proofReferenceImageSrc,
  proofReelPosterSrc,
} from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, FileCheck, Layers, Monitor, ShieldCheck } from "lucide-react";

const sampleDecision = [
  "A robot team opens one listing before a customer deployment sprint.",
  "It confirms the facility, the workflow lane, and whether the package has the evidence needed to ground its own stack.",
  "If the team needs runtime evidence instead, it opens hosted evaluation on the same site and exports the results it needs.",
];

const sampleManifestRows = [
  ["site_id", "siteworld-f5fd54898cfb"],
  ["capture_date", "2026-03-13"],
  ["proof_depth", "Public listing + sample artifact layouts"],
  ["rights_class", "Internal evaluation and approved exports only"],
  ["exports", "rollout_video, raw_bundle, dataset_export"],
];

const inputOutputContract = [
  {
    title: "Input",
    body: "Site identifier, robot setup, policy/checkpoint reference, scenario selection, and any approved constraints tied to the listing.",
  },
  {
    title: "Runtime",
    body: "One exact-site session tied to the same capture-backed package, with replayable run review and comparison surfaces.",
  },
  {
    title: "Output",
    body: "Sample artifact layouts for rollout video, export bundles, run summaries, and raw run references tied to the listing.",
  },
];

export default function SampleDeliverables() {
  return (
    <>
      <SEO
        title="Deliverables | Blueprint"
        description="See the package contents, hosted outputs, technical compatibility, and trust metadata a robot team should expect from a Blueprint listing."
        canonical="/sample-deliverables"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Deliverables
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              What a buyer actually gets.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Package contents, hosted outputs, and the technical contract that stays stable across
              every listing.
            </p>
          </header>

          <div className="mt-10">
            <ProofModule
              eyebrow="Public proof"
              title="Start from a real site, then inspect what comes with it."
              description="The public sample proves the site is real. From there, the buyer can decide whether to get the full site package or run hosted evaluation on that same facility."
              caption="This reel shows current capture and product surfaces. Additional views are added as the product develops."
            />
          </div>

          {/* Walkthrough + Runtime visual cards */}
          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={proofReelPosterSrc}
                alt="Walkthrough reference from the public Blueprint demo"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {sampleArtifactLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Walkthrough surface</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  The walkthrough is the first proof layer. Buyers use it to confirm the facility,
                  the lane, and the physical context before they decide how much access they need.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={proofReferenceImageSrc}
                alt="Runtime reference view from the public Blueprint demo"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {sampleArtifactLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Runtime reference</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  The hosted side keeps the team on the same site. Reruns, checkpoint
                  comparison, failure review, and exports all happen here.
                </p>
                <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Illustrative product preview
                </div>
              </div>
            </article>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sample manifest layout
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Sample manifest layout
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                This is a buyer-readable representative manifest layout showing the fields a serious visitor expects to inspect before purchase.
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                {sampleManifestRows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[0.8fr_1.2fr] gap-4 border-t border-slate-200 bg-white px-4 py-3 text-sm first:border-t-0">
                    <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sample export bundle
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Sample export bundle
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Representative output cards for the hosted path. These are sample artifact layouts showing how exports are grouped and described to the buyer.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Run summary",
                    body: "Session metadata, scenario selection, run duration, and checkpoint reference.",
                  },
                  {
                    title: "Rollout video",
                    body: "Buyer-facing review video tied to one exact site and the selected task lane.",
                  },
                  {
                    title: "Raw bundle",
                    body: "Reference to the raw run package, export manifest, and listing-specific output notes.",
                  },
                ].map((card) => (
                  <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                    <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Sample artifact layout
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          {/* Site package + Hosted evaluation with diagrams */}
          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img
                  src="/illustrations/site-package-diagram.svg"
                  alt="Illustrative site package diagram"
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {illustrativeLabel}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Site package</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Everything your team needs to run its own world model on that facility: walkthrough
                media, geometry, metadata, and rights.
              </p>
              <ul className="mt-5 space-y-3">
                {sitePackageIncludes.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img
                  src="/illustrations/export-bundle-diagram.svg"
                  alt="Illustrative hosted export bundle diagram"
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {sampleArtifactLabel}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Hosted evaluation</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Blueprint runs the site for you. Rerun tasks, review failures, compare checkpoints,
                and export results without moving data into your own stack first.
              </p>
              <ul className="mt-5 space-y-3">
                {hostedEvaluationOutputs.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          {/* Technical reference — absorbed from /docs */}
          <section className="mt-10">
            <div className="mb-6 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Technical reference
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                What stays stable, what ships per site.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                For technical buyers. The stable product contract vs. the details that change per
                listing, so your team knows what to assume and what to verify on the actual site.
              </p>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Input/output contract
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Input/output contract
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {inputOutputContract.map((item) => (
                  <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{item.title}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Stable contract */}
              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FileCheck className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Stable contract</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  These parts of the product stay the same regardless of which site or runtime
                  backend is used.
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  {stableContractItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              {/* Listing-specific variation */}
              <article className="rounded-2xl border border-slate-950 bg-slate-950 p-6 text-white">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white">What varies by listing</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Not every site has the same artifacts or export options. Check the listing before
                  assuming every lane supports the same depth of work.
                </p>
                <ul className="mt-4 space-y-3">
                  {listingVariationItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Site package contents + Hosted outputs (detailed) */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Site package contents</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  The site package gives your team everything it needs to run its own world model
                  stack on that facility.
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  {[
                    "Walkthrough video, timestamps, and camera poses tied to one real facility",
                    "Intrinsics, depth, and geometry artifacts when the source capture supports them",
                    "Site notes, provenance, privacy, and rights metadata",
                    "Package manifest and reference material for building your own world model",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <Monitor className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Hosted evaluation outputs</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Hosted evaluation is a managed runtime session on one exact site. Your team can
                  run, review, and export without moving data into your own stack first.
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  {[
                    "Repeatable runs on the same exact site",
                    "Rollout video, failure review, and checkpoint comparison",
                    "Dataset, raw bundle, and export generation tied to the listing",
                    "A browser-accessible runtime session, no local setup required",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          {/* Sample eval path */}
          <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sample eval path
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              How a buyer uses these surfaces in practice
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {sampleDecision.map((item, index) => (
                <article key={item} className="relative rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={publicDemoHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View sample listing
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="/world-models"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Explore world models
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
