import { caseStudies } from "@/data/content";

export default function CaseStudies() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Case studies
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          SimReady scenes powering robotic wins.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Explore how Blueprint scenes accelerate robotics R&D—from manipulation policies to AMR workflows. Each example below shipped with Isaac validation and articulation coverage tuned to the customer’s tasks.
        </p>
      </header>

      <div className="grid gap-8 sm:grid-cols-2">
        {caseStudies.map((study) => (
          <article
            key={study.slug}
            className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={study.hero}
                alt={study.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
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
              <p className="text-sm text-slate-600">{study.body}</p>
              <a
                href="/contact"
                className="mt-auto inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
              >
                {study.cta}
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
