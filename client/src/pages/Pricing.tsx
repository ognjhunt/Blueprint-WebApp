import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ArrowRight, ShieldCheck } from "lucide-react";

const pricingNotes = [
  {
    title: "Listing prices stay close to the work",
    body:
      "Every world-model listing shows its own package price and hosted evaluation rate. You do not need a sales call to understand the range.",
  },
  {
    title: "Hosted rates cover the runtime layer",
    body:
      "Use hosted evaluation when the question is about repeatable runs, failure review, exports, or release comparison on one site.",
  },
  {
    title: "Custom work is quoted separately",
    body:
      "If you need a private site, exclusive rights, or managed support, Blueprint scopes that as enterprise work instead of hiding it inside the self-serve pricing.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint pricing for robot teams: site-specific world model packages, hosted evaluations, and custom engagements."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pricing
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Three ways to buy in.
            </h1>
            <p className="text-lg leading-8 text-slate-600">
              Most teams start with one scene package or one hosted evaluation request. Enterprise
              is there when you need custom capture, private access, or higher-touch support.
            </p>
          </header>

          <OfferComparison className="mt-10" />

          <section className="mt-10 grid gap-4 md:grid-cols-3">
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
                Need a site that is not in the catalog yet?
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Ask about custom capture or a private engagement. That is the right path when one
                facility matters more than the public catalog.
              </p>
              <a
                href="/contact?persona=robot-team&interest=enterprise"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Request a custom quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Capture payouts live in the app handoff. Buyer pricing stays on the buyer-facing
              site.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
