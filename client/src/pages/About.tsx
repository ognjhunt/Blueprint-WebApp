import { SEO } from "@/components/SEO";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { companyTrustItems } from "@/data/marketingDefinitions";

const credibilityBlocks = [
  {
    title: "What Blueprint does",
    body: "Blueprint turns real facilities into buyer-ready world-model products: site packages, hosted evaluation, and trust surfaces tied to the same capture-backed source record.",
  },
  {
    title: "Why teams trust Blueprint",
    body: "The company is careful about provenance, rights, privacy, and truthful labeling. The product is designed to help a buyer answer a deployment question earlier, not to overstate certainty.",
  },
  {
    title: "How Blueprint works with real sites",
    body: "Blueprint treats facility access, restricted zones, redaction, retention, and export boundaries as part of the product contract rather than afterthoughts.",
  },
];

const operatingSignals = [
  "Buyer-facing listings, package manifests, and hosted-session surfaces are anchored to real capture.",
  "Pricing, legal, privacy, security, and other irreversible topics stay human-gated.",
  "Hosted evaluation is a concrete commercial path, not a vague consulting placeholder.",
];

const companyFacts = [
  {
    title: "Current focus",
    body: "One narrow wedge: exact-site package access and hosted evaluation for robot teams that need a real facility earlier.",
  },
  {
    title: "What Blueprint operates",
    body: "Buyer-facing listings, rights-aware package surfaces, hosted evaluation paths, and the supporting ops layer around those products.",
  },
  {
    title: "What Blueprint avoids",
    body: "Generic marketplace language, fake readiness states, blanket permissions, and model-demo theater disconnected from real capture provenance.",
  },
];

const deploymentStory = [
  "An autonomy team needed to answer a narrow question before a field visit: whether a workflow lane on one facility was worth deeper integration work.",
  "Blueprint's role was not to promise deployment success. It was to get the exact site in front of the team earlier, package the evidence clearly, and make the next step legible.",
  "That is the kind of decision Blueprint is built to support: less blind travel, fewer vague assumptions, and a cleaner path from curiosity to real site work.",
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why Blueprint exists, how it works with real sites, and why robot teams can trust its site-package and hosted-evaluation workflow."
        canonical="/about"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                About Blueprint
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Blueprint turns real facilities into buyer-ready world-model products.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                Blueprint exists to help robot teams inspect one exact site earlier, choose the right product path, and keep rights, privacy, provenance, and hosted-access boundaries readable along the way.
              </p>
              <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold text-slate-900">Founded by</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Nijel Hunt — background in robotics simulation, 3D capture, and deployment operations. Blueprint is built around the operational gap between “interesting robotics demo” and “serious site-specific deployment work.”
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="https://www.linkedin.com/in/nijelhunt/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Founder LinkedIn
                  </a>
                  <a
                    href="mailto:hello@tryblueprint.io"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    <Mail className="h-4 w-4" />
                    hello@tryblueprint.io
                  </a>
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-800 p-3 text-slate-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Operating posture
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">Built for real-site buying decisions.</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                {operatingSignals.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
                <p className="text-sm font-semibold text-white">Trust posture</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
                  {companyTrustItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <section className="mt-10 grid gap-4 md:grid-cols-3">
            {credibilityBlocks.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-10 grid gap-4 md:grid-cols-3">
            {companyFacts.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-stone-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Company fact
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-stone-50 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              An anonymized deployment-decision story
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              An anonymized deployment-decision story
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {deploymentStory.map((paragraph, index) => (
                <article key={paragraph} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{paragraph}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Public product surfaces
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                What a skeptical buyer can inspect without a call.
              </h2>
              <div className="mt-5 grid gap-3">
                {[
                  "The public sample listing that ties the site, package framing, and hosted path together",
                  "Pricing and package-vs-hosted framing without requiring a sales conversation",
                  "Deliverables, governance, and trust language that stay attached to the product story",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Operating standard
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Make the next step obvious.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Blueprint should not ask a careful buyer to reverse-engineer the commercial motion.
                The company standard is straightforward: one real site, one truthful proof path,
                one clear next action.
              </p>
            </article>
          </section>

          <section className="mt-10 rounded-3xl bg-slate-950 p-8 text-white sm:p-10">
            <h2 className="text-3xl font-semibold tracking-tight">
              Blueprint is designed to look serious because the work itself is serious.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              The product should help a skeptical buyer understand what is real, what is sample or illustrative, what is permitted, and what the next step actually is. That is the commercial standard Blueprint is trying to meet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Explore world models
              </a>
              <a
                href="/governance"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Read governance and trust
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
