import { SEO } from "@/components/SEO";

const principles = [
  "Start with the real site, not a generic benchmark.",
  "Say what the buyer receives in plain language.",
  "Keep rights, privacy, and workflow limits visible.",
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Blueprint helps robot teams get grounded on a real site before travel, tuning, or customer time starts."
        canonical="/about"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                About Blueprint
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Blueprint exists to make site-specific evaluation less fuzzy.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Most robotics teams do not fail because they lack another abstract benchmark. They
                fail because the real site shows up late, the workflow assumptions are muddy, and
                the customer context never gets translated into something the team can actually use.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Blueprint is built around that gap. The job is simple to describe and hard to do
                well: capture a real indoor site, package it clearly, and give buyers a believable
                way to review it before they burn field time.
              </p>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">What we optimize for</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {principles.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/contact?persona=robot-team"
                className="mt-6 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Talk to Blueprint
              </a>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
