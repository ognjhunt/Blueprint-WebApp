import { SEO } from "@/components/SEO";
import { caseStudies } from "@/data/content";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight } from "lucide-react";

export default function CaseStudies() {
  return (
    <>
      <SEO
        title="Proof Stories | Blueprint"
        description="Anonymized deployment-decision stories showing how Blueprint's site packages, hosted evaluation, and trust surfaces help robot teams make exact-site decisions earlier."
        canonical="/case-studies"
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Proof Stories
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Anonymized deployment-decision stories.
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            These are anonymized proof stories showing how a real buyer might use Blueprint to decide whether one exact site is worth deeper work. They are grounded in the product workflow, but they do not claim named customer outcomes the site cannot publicly prove yet.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={publicDemoHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Inspect the sample listing
            </a>
            <a
              href="/contact?persona=robot-team"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Scope your site
            </a>
          </div>
        </header>

        <div className="grid gap-8 sm:grid-cols-2">
          {caseStudies.map((study, index) => (
            <article
              key={study.slug}
              className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-50">
                <img
                  src={study.hero}
                  alt={study.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Anonymized proof story
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {study.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{study.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Question", `Decision story ${index + 1}`],
                    ["Path", index % 2 === 0 ? "Hosted evaluation first" : "Package first"],
                    ["Proof", "Exact-site or clearly labeled sample artifact"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>

                <ul className="space-y-2 text-sm text-slate-600">
                  {study.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm leading-7 text-slate-600">{study.body}</p>
                <div className="mt-auto flex flex-wrap gap-3">
                  <a
                    href={publicDemoHref}
                    className="inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                  >
                    Inspect the sample listing
                  </a>
                  <a
                    href="/contact?persona=robot-team"
                    className="inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                  >
                    Scope your site
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
