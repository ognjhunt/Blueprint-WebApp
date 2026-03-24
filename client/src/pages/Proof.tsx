import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import {
  proofReferenceImageSrc,
  proofReelPosterSrc,
  publicDemoHref,
  resultHighlights,
} from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const packageArtifacts = [
  "Walkthrough video and camera poses tied to one real site",
  "Site notes attached to one workflow lane",
  "Geometry and depth artifacts when available",
  "Rights, freshness, and provenance notes visible before deeper work starts",
];

const hostedArtifacts = [
  "Repeatable runs on the same site",
  "Rollout video and failure review",
  "Metrics summary and checkpoint comparison",
  "Exportable raw bundles and site-specific datasets when supported",
];

const trustSignals = [
  "Pricing is visible before a call so buyers understand the package path and the hosted path early.",
  "Each listing stays anchored to one real site instead of drifting into generic robotics marketing language.",
  "Governance, privacy, freshness, and export constraints are meant to stay on the buyer surface.",
];

export default function Proof() {
  return (
    <>
      <SEO
        title="Proof | Blueprint"
        description="See the public demo, example package outputs, hosted-evaluation evidence, and buyer trust signals behind Blueprint."
        canonical="/proof"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Proof
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              One place to verify what Blueprint sells and why teams trust it.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Start with the public demo, then inspect the site package, hosted evaluation outputs,
              and validation examples that make the product easier to trust.
            </p>
          </header>

          <div className="mt-10">
            <ProofModule
              eyebrow="Public demo"
              title="The real site is the anchor. The product is what your team can do from there."
              description="The public demo should answer the first trust question fast: is this a real site with a real workflow lane? From there, the package path and hosted evaluation path should read as concrete buyer options."
              caption="Public reel from the current demo listing."
            />
          </div>

          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <img
                src={proofReelPosterSrc}
                alt="Public demo view from a sample Blueprint listing"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-slate-900">Public demo</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Buyers confirm the site, the workflow, and the physical context before deciding
                  whether to buy the site package or request hosted evaluation.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <img
                src={proofReferenceImageSrc}
                alt="Runtime reference view from a sample Blueprint hosted evaluation"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-slate-900">Hosted evaluation evidence</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Teams use the hosted path to rerun one exact site, compare checkpoints, inspect
                  failure cases, and export what they need without losing the link back to the real
                  facility.
                </p>
              </div>
            </article>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Site package</h2>
              <ul className="mt-5 space-y-3">
                {packageArtifacts.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Hosted evaluation</h2>
              <ul className="mt-5 space-y-3">
                {hostedArtifacts.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Trust signals
              </div>
              <ul className="mt-5 space-y-3">
                {trustSignals.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Validation examples
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Concrete examples of how better packaging and proof should communicate value.
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {resultHighlights.map((item) => (
                <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.outcome}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={publicDemoHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open public demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="/world-models"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Browse world models
            </a>
            <a
              href="/contact?persona=robot-team"
              className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              Talk to Blueprint
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
