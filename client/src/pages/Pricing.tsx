import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { WhenNotToBuyModule } from "@/components/site/WhenNotToBuyModule";
import { exactSiteScopingCallPath } from "@/lib/booking";
import { ArrowRight, ShieldCheck } from "lucide-react";

const pricingNotes = [
  {
    title: "Site package",
    body: "A one-time purchase of the full data bundle for one facility. Your team runs its own stack on the captured site data.",
  },
  {
    title: "Hosted evaluation",
    body: "Blueprint runs the site for you. Your team gets a managed runtime session for reruns, failure review, and exports — no local setup needed.",
  },
  {
    title: "Session-hour",
    body: "One hour of self-serve hosted runtime on one exact site, covering run time, inspection, and export generation.",
  },
  {
    title: "Custom scope",
    body: "Private sites, exclusive rights, managed support, and custom capture are quoted separately.",
  },
];

const pricingWorkflow = [
  "Inspect the listing and its trust labels first.",
  "Choose the package path, hosted evaluation, or a custom scope based on the real site question.",
  "Use contact or booking to narrow the exact site, workflow lane, and any trust boundaries that could change scope.",
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
              Most teams need one of two things first: all the site data for their own
              stack, or a Blueprint-managed runtime session on the exact site. Prices are on every
              listing so you do not need a sales call to understand what you are buying.
            </p>
          </header>

          <OfferComparison className="mt-10" />

          <section className="mt-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Typical first purchase
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Most teams do not need a bespoke program on day one.
              </h2>
              <div className="mt-5 grid gap-3">
                {[
                  "Package first: when your team wants the site data contract and plans to run its own stack.",
                  "Hosted evaluation first: when your team wants runtime evidence, reruns, and exports before moving files around.",
                  "Custom quote first: when the site is private, rights need negotiation, or managed support is part of the job.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                What happens after inquiry
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Pricing is public. Scope is still confirmed on the real site.
              </h2>
              <div className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                <p>1. Blueprint confirms the exact site, workflow lane, and trust boundaries.</p>
                <p>2. The reply points you to the package path, hosted evaluation, or a custom quote.</p>
                <p>3. Commercial follow-through narrows the scope instead of reopening discovery from scratch.</p>
              </div>
            </article>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Buyer workflow
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Pricing should sit next to proof, not replace it.</h2>
              <div className="mt-5 space-y-3">
                {pricingWorkflow.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-4 text-sm leading-7 text-slate-300">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">
                      {index + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Where to start
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                The clearest first move depends on how sure your team already is.
              </h2>
              <div className="mt-5 grid gap-3">
                {[
                  {
                    title: "Still validating the category",
                    body: "Inspect the sample listing and sample deliverables before asking for anything custom.",
                  },
                  {
                    title: "Know the site and question",
                    body: "Book the scoping call or send the short brief so the conversation stays anchored to one exact facility.",
                  },
                  {
                    title: "Need private or unusual terms",
                    body: "Use the custom path and say what about the site, rights model, or support layer changes the normal listing flow.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Proof path
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Exact-site proof vs adjacent-site proof
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Exact-site proof</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Use this when the site in the package or hosted session needs to be the actual place the buyer cares about. This is the higher-trust path for deployment-specific questions.
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Adjacent-site proof</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Use this when a clearly labeled nearby or similar site is enough to answer an earlier or lower-risk question. It should be labeled explicitly, not blurred into exact-site claims.
                </p>
              </article>
            </div>
          </section>

          <div className="mt-10">
            <WhenNotToBuyModule />
          </div>

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
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={exactSiteScopingCallPath}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Book a scoping call
                </a>
                <a
                  href="/contact?persona=robot-team&interest=enterprise"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Request a custom quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
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
