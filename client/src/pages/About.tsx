import { SEO } from "@/components/SEO";

const principles = [
  "Start with the real site. Generic stand-ins are useful until they are not.",
  "Keep capture truth, rights, privacy, and provenance visible all the way through the product.",
  "Treat hosted access and site packages as the product, not as side effects of a model demo.",
  "Stay flexible on runtimes and providers so the buyer surface survives backend swaps.",
];

const trustReasons = [
  "The buyer surface stays tied to one real facility and workflow lane instead of vague simulation claims.",
  "Pricing, package framing, and hosted-evaluation framing are visible before the first call.",
  "Rights, privacy, freshness, and export assumptions are intended to stay visible on the listing surface.",
];

const credibilitySignals = [
  {
    title: "Built for robotics deployment decisions",
    body:
      "The product is framed around the exact questions robot teams ask before travel: can the robot handle the lane, what breaks first, and what should the team export or compare before the visit?",
  },
  {
    title: "Not locked to one backend story",
    body:
      "The long-lived value is the real-site package, hosted-evaluation contract, and buyer workflow. Providers and runtime implementations can change without changing what the buyer is purchasing.",
  },
  {
    title: "Designed to reduce avoidable field surprises",
    body:
      "Blueprint is meant to make the first real visit less blind by grounding review, evaluation, and export decisions on one exact site earlier in the process.",
  },
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why robot teams trust Blueprint: real-site proof, clear packaging, visible governance, and a product surface designed for deployment decisions."
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
                Blueprint exists to make real customer sites legible before the expensive part starts.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                A lot of robotics work goes sideways for a simple reason: the real site shows up
                too late. Teams talk in abstractions, pilots get scoped around vague assumptions,
                and then the actual building changes the whole conversation.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Blueprint is built around that gap. The job is to capture real indoor spaces, turn
                them into site-specific world-model products, and give buyers a clean way to browse,
                buy, and run those products before travel, tuning, and customer time pile up.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                The company is not built around one permanent runtime or one permanent world-model
                provider. That part will keep moving. What stays stable is the capture,
                provenance, site package, hosted-evaluation contract, and buyer surface around
                them.
              </p>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Why teams trust the surface</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {trustReasons.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-semibold text-slate-900">What we optimize for</p>
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

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {credibilitySignals.map((item) => (
              <section
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-white p-6"
              >
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
