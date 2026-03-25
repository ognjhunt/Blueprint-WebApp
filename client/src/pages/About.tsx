import { SEO } from "@/components/SEO";
import { ArrowRight, Mail } from "lucide-react";
import {
  companyTrustItems,
  hostedEvaluationDefinition,
  sitePackageDefinition,
  worldModelDefinition,
} from "@/data/marketingDefinitions";

const companyFacts = [
  {
    title: "What Blueprint sells",
    body:
      "Blueprint sells site-specific world models, site packages, and hosted evaluation built from real indoor capture.",
  },
  {
    title: "Who it is for",
    body:
      "Robot teams preparing for a pilot, field visit, or deployment question that depends on one exact facility.",
  },
  {
    title: "What it does not claim",
    body:
      "Blueprint does not claim that one package or one hosted session replaces final on-site validation, safety review, or deployment signoff.",
  },
];

const references = [
  { label: "Company LinkedIn", href: "https://www.linkedin.com/company/blueprintsim/" },
  { label: "Governance", href: "/governance" },
  { label: "Compatibility & exports", href: "/docs" },
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="What Blueprint is, what it sells, and how it handles world-model packages, hosted evaluation, and trust metadata."
        canonical="/about"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                About Blueprint
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Blueprint is the buyer and hosted-access surface around real-site capture.
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
                The company is capture-first and world-model-product-first. It turns real indoor
                facilities into products that robot teams can inspect, buy, run, and manage without
                starting from a generic simulation scene.
              </p>
              <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm leading-7 text-slate-700">{worldModelDefinition}</p>
                <p className="text-sm leading-7 text-slate-700">{sitePackageDefinition}</p>
                <p className="text-sm leading-7 text-slate-700">{hostedEvaluationDefinition}</p>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Trust posture</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {companyTrustItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Company references</p>
                <div className="mt-4 flex flex-col gap-3">
                  {references.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/contact?persona=robot-team"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Contact Blueprint
                </a>
                <a
                  href="mailto:hello@tryblueprint.io"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <Mail className="h-4 w-4" />
                  hello@tryblueprint.io
                </a>
              </div>
            </aside>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {companyFacts.map((item) => (
              <section key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </section>
            ))}
          </div>

          <section className="mt-12 rounded-2xl bg-slate-950 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Start with the site your robot actually needs to work in.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              That is usually enough to decide whether the next step is the package, the hosted
              runtime, or a custom engagement around one facility.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Explore world models
              </a>
              <a
                href="/contact?persona=robot-team"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Contact Blueprint
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
