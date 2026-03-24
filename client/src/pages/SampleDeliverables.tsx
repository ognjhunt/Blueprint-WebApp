import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import {
  publicDemoHref,
  proofReferenceImageSrc,
  proofReelPosterSrc,
} from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const packageArtifacts = [
  "Walkthrough video and camera poses",
  "Site notes tied to one workflow lane",
  "Geometry and depth artifacts when available",
  "Rights, freshness, and provenance notes",
];

const hostedArtifacts = [
  "Repeatable runs on the same site",
  "Rollout video and failure review",
  "Metrics summary and checkpoint comparison",
  "Raw bundle and RLDS-style dataset export",
];

const trustPanel = [
  "Capture source and site scope stay attached to the listing.",
  "Usage rights and privacy constraints stay visible before access is granted.",
  "Freshness is treated as a listing property, not a vague promise.",
];

const sampleDecision = [
  "A robot team opens one listing before a grocery-site deployment sprint.",
  "They review the walkthrough, confirm the lane, and decide whether they need the package or a hosted eval loop.",
  "If they need runtime evidence, they request hosted evaluation and inspect rollout video, metrics, failure cases, and exports before anyone books travel.",
];

export default function SampleDeliverables() {
  return (
    <>
      <SEO
        title="Sample Deliverables | Blueprint"
        description="See the walkthrough, runtime reference, exported outputs, and trust details a robot team can expect from a Blueprint world-model listing."
        canonical="/sample-deliverables"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sample deliverables
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              See what a robot team can run and export.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              This page shows the public walkthrough, the runtime reference, the typical package
              contents, and the outputs teams use for evals, release comparison, and site-grounded
              data generation.
            </p>
          </header>

          <div className="mt-10">
            <ProofModule
              eyebrow="Public proof"
              title="One listing, one site, one clear path into the product."
              description="The public sample proves the site is real. From there, a buyer can decide whether the package is enough or whether they need hosted evaluation tied to the same site."
              caption="Public reel from the current demo listing."
            />
          </div>

          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <img
                src={proofReelPosterSrc}
                alt="Public walkthrough surface from a sample Blueprint listing"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-slate-900">Walkthrough surface</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  This is the first proof layer. A buyer confirms the site, the lane, and the
                  physical context before choosing a package or evaluation path.
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
                <h2 className="text-2xl font-semibold text-slate-900">Runtime reference</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  This is the hosted side. It is where teams rerun the same site, compare
                  checkpoints, and review failure cases without losing the link back to the
                  original facility.
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
                Trust details
              </div>
              <ul className="mt-5 space-y-3">
                {trustPanel.map((item) => (
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
              Sample eval path
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              How a team uses this before deployment
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {sampleDecision.map((item, index) => (
                <article key={item} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-600">
              The point is not to replace the real visit. It is to make the first real visit less
              blind, easier to scope, and more informed by usable data.
            </p>
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
          </div>
        </div>
      </div>
    </>
  );
}
