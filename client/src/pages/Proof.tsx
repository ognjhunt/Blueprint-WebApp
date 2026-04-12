import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import { getDemandCityMessaging, withDemandCityQuery } from "@/lib/cityDemandMessaging";
import {
  proofReferenceImageSrc,
  proofReelPosterSrc,
  publicDemoHref,
} from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

const proofRoutes = [
  {
    title: "How it works",
    body:
      "See why training on one real customer site outperforms generic simulation when the deployment question gets specific.",
    href: "/how-it-works",
    cta: "Open how it works",
  },
  {
    title: "Results",
    body:
      "Review concrete examples of how teams used exact-site data for policy training, fine-tuning, and deployment prep.",
    href: "/case-studies",
    cta: "Review results",
  },
  {
    title: "Deliverables",
    body:
      "See the package contents, training data exports, and hosted outputs your team gets from one Blueprint listing.",
    href: "/sample-deliverables",
    cta: "See deliverables",
  },
];

const packageArtifacts = [
  "Walkthrough media and camera poses tied to one real site",
  "Site geometry and depth artifacts for your training pipeline",
  "Rights context, freshness details, and provenance notes",
  "A package your team can integrate into its own stack",
];

const hostedArtifacts = [
  "Repeatable policy runs on the same site",
  "Rollout video, metrics, and failure review",
  "Scenario variation for edge-case training data",
  "Exportable datasets and raw bundles for offline training",
];

const trustSignals = [
  "The public demo listing lets buyers confirm the site before outreach.",
  "Each listing shows the package path and hosted-evaluation path side by side.",
  "Compatibility, privacy, freshness, and export scope stay visible on the listing.",
];

export default function Proof() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const cityMessaging = getDemandCityMessaging(searchParams.get("city"));

  return (
    <>
      <SEO
        title="Proof | Blueprint"
        description="Use Blueprint's proof hub to inspect the public demo listing, see how the product works, review sample deliverables, and read concrete exact-site training results."
        canonical="/proof"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Proof Hub
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              See the exact-site asset before you commit.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Start with the public demo listing, then check how the product works, what your team
              gets, and how others have used it for training, fine-tuning, and deployment prep.
            </p>
          </header>

          {cityMessaging ? (
            <section className="mt-8 rounded-2xl border border-sky-200 bg-sky-50/80 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                {cityMessaging.label}
              </p>
              <div className="mt-3 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {cityMessaging.proofHeading}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {cityMessaging.proofBody}
                  </p>
                </div>
                <ul className="space-y-3 text-sm leading-6 text-slate-700">
                  {cityMessaging.proofPoints.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <div className="mt-10">
            <ProofModule
              eyebrow="Public demo listing"
              title="The first proof is simple: the site is real and the workflow is specific."
              description="Blueprint uses the public demo listing to show the physical site, the task lane, and the buying options before a team ever fills out the intake form."
              caption="Public walkthrough from the live demo listing."
            />
          </div>

          <section className="mt-10 grid gap-4 md:grid-cols-3">
            {proofRoutes.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                <a
                  href={item.href}
                  className="mt-5 inline-flex items-center text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                >
                  {item.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </article>
            ))}
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={proofReelPosterSrc}
                alt="Public demo view from a sample Blueprint listing"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-slate-900">Public listing</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Confirm the site, workflow, and physical context before deciding whether you need
                  the site package for training and fine-tuning or a hosted evaluation for runtime
                  checks on the same site.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={proofReferenceImageSrc}
                alt="Runtime reference view from a sample Blueprint hosted evaluation"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-slate-900">Hosted evaluation</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Run policies on the same site, compare releases, review failure cases, and export
                  exact-site training data and evaluation results.
                </p>
              </div>
            </article>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Buy the site package</h2>
              <ul className="mt-5 space-y-3">
                {packageArtifacts.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Run a hosted evaluation</h2>
              <ul className="mt-5 space-y-3">
                {hostedArtifacts.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
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
            <a
              href={withDemandCityQuery("/contact?persona=robot-team", cityMessaging?.key ?? null)}
              className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              Contact Blueprint
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
