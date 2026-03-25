import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import {
  hostedEvaluationDefinition,
  sessionHourDefinition,
  sitePackageDefinition,
} from "@/data/marketingDefinitions";
import { ArrowRight, ShieldCheck } from "lucide-react";

const pricingNotes = [
  {
    title: "Site package",
    body: sitePackageDefinition,
  },
  {
    title: "Hosted evaluation",
    body: hostedEvaluationDefinition,
  },
  {
    title: "Session-hour",
    body: sessionHourDefinition,
  },
  {
    title: "Custom scope",
    body:
      "Private sites, exclusive rights, managed support, and custom capture are quoted separately instead of being hidden inside the self-serve pricing.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint pricing for robot teams: site packages for grounding your own world model, hosted evaluation on one exact site, and custom engagements."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pricing
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Start with the package or the hosted runtime.
            </h1>
            <p className="text-lg leading-8 text-slate-600">
              Most teams need one of two things first: the full grounding bundle for their own
              stack, or a Blueprint-managed runtime session on the exact site. The catalog shows
              the range openly so buyers do not need a sales call just to understand the shape of
              the product.
            </p>
          </header>

          <OfferComparison className="mt-10" />

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            {pricingNotes.map((note) => (
              <article
                key={note.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900">{note.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{note.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Custom scope
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Need a site that is not in the public catalog yet?
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Use the custom path when one specific facility matters more than the public
                inventory, or when the rights and privacy model need to be negotiated up front.
              </p>
              <a
                href="/contact?persona=robot-team&interest=enterprise"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Request a custom quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
            <a
              href="mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            >
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Not ready for the full form? Email a short brief.
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
