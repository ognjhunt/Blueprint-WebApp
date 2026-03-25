import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "Stable contract",
    body:
      "These parts of the product stay the same regardless of which site or runtime backend is used.",
    bullets: [
      "Capture truth: walkthrough media, timestamps, poses, and device metadata",
      "Rights, privacy, consent, and provenance metadata",
      "Package manifests and hosted-session contracts",
      "Buyer-facing licensing, export, and access rules",
    ],
  },
  {
    title: "Site package contents",
    body:
      "The site package gives your team everything it needs to run its own world model stack on that facility.",
    bullets: [
      "Walkthrough video, timestamps, and camera poses tied to one real facility",
      "Intrinsics, depth, and geometry artifacts when the source capture supports them",
      "Site notes, provenance, privacy, and rights metadata",
      "Package manifest and reference material for building your own world model",
    ],
  },
  {
    title: "Hosted evaluation outputs",
    body:
      "Hosted evaluation is a managed runtime session on one exact site. Your team can run, review, and export without moving data into your own stack first.",
    bullets: [
      "Repeatable runs on the same exact site",
      "Rollout video, failure review, and checkpoint comparison",
      "Dataset, raw bundle, and export generation tied to the listing",
      "A browser-accessible runtime session — no local setup required",
    ],
  },
  {
    title: "What varies by listing",
    body:
      "Not every site has the same artifacts or export options. Check the listing before assuming every lane supports the same depth of work.",
    bullets: [
      "Depth and geometry coverage",
      "Available scenario variations and start states",
      "Robot assumptions and sensor requirements",
      "Export set, freshness state, and any restricted zones",
    ],
  },
];

export default function Docs() {
  return (
    <>
      <SEO
        title="Compatibility and Exports | Blueprint"
        description="The stable Blueprint product contract, the site package structure, the hosted evaluation path, and the listing details that can vary."
        canonical="/docs"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Compatibility and exports
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              What stays stable, what the package contains, and what can vary by site.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This page is for technical buyers. It separates the stable product contract from the
              listing-specific details so your team can tell what is safe to assume and what should
              be checked on the exact site.
            </p>
          </div>

          <div className="mt-12 grid gap-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <h2 className="text-2xl font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                  {section.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
