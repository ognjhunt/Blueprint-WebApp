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
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const sampleDecision = [
  "A robot team opens one listing before a customer deployment sprint.",
  "It confirms the facility, the workflow lane, and whether the package has the evidence needed to ground its own stack.",
  "If the team needs runtime evidence instead, it opens hosted evaluation on the same site and exports the results it needs.",
];

export default function SampleDeliverables() {
  return (
    <>
      <SEO
        title="Sample Deliverables | Blueprint"
        description="See the package contents, hosted outputs, and trust metadata a robot team should expect from a Blueprint listing."
        canonical="/sample-deliverables"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sample deliverables
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              What a buyer actually gets.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              This page makes the product concrete. It shows what is in the site package, what
              comes back from hosted evaluation, and what metadata stays attached to every listing.
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
                  The hosted side keeps the team on the same site. It is where reruns, checkpoint
                  comparison, failure review, and exports happen.
                </p>
              </div>
            </article>
          </section>

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
                Everything your team needs to run its own world model on that facility — walkthrough
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

          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Stable contract
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                What should stay stable across sites and runtime swaps
              </h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                {stableContractItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Listing-specific variation
              </div>
              <ul className="mt-5 space-y-3">
                {listingVariationItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sample eval path
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              How a buyer uses these surfaces in practice
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {sampleDecision.map((item, index) => (
                <article key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
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
