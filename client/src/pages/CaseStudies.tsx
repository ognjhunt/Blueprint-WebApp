import { SEO } from "@/components/SEO";
import { illustrativeLabel } from "@/data/marketingDefinitions";
import { caseStudies } from "@/data/content";

export default function CaseStudies() {
  return (
    <>
      <SEO
        title="Examples | Blueprint"
        description="Illustrative Blueprint examples showing how site packages, hosted evaluation, and exports can be framed before public customer case studies are available."
        canonical="/case-studies"
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Examples
          </p>
          <h1 className="text-4xl font-semibold text-slate-900">
            Example workflows by industry.
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            These examples show how Blueprint packages and hosted evaluation would be framed for
            different facility types. Named customer references will be added as they become
            available.
          </p>
        </header>

        <div className="grid gap-8 sm:grid-cols-2">
          {caseStudies.map((study) => (
            <article
              key={study.slug}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
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
                    {illustrativeLabel}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {study.title}
                  </h2>
                  <p className="mt-3 text-sm text-slate-600">{study.summary}</p>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  {study.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm leading-7 text-slate-600">{study.body}</p>
                <a
                  href="/contact?persona=robot-team"
                  className="mt-auto inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                >
                  {study.cta}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
