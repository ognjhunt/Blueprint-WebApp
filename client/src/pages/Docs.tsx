import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "What is standardized",
    body:
      "Across listings, buyers should expect the same basic product contract: a site package tied to one real facility, a hosted-evaluation path tied to that same site, and visible provenance, privacy, and rights metadata around both.",
  },
  {
    title: "What varies by listing",
    body:
      "The exact export set, geometry depth coverage, available scenarios, supported tasks, and robot-fit details can differ from site to site. Buyers should read those from the listing rather than assume one global promise applies everywhere.",
  },
  {
    title: "Typical site-package contents",
    body:
      "A site package can include walkthrough media, camera poses, site notes, geometry or depth artifacts when available, plus rights and usage framing for that listing.",
  },
  {
    title: "Typical hosted-evaluation outputs",
    body:
      "Hosted evaluation is the managed runtime path. Teams should expect reruns on one exact site, rollout evidence, comparison surfaces, and exports that stay tied to the same listing.",
  },
  {
    title: "Robot compatibility framing",
    body:
      "Compatibility is practical, not magical. The buyer surface should call out robot assumptions, sensor expectations, path or reach constraints when known, and where a deeper hosted evaluation is the right way to confirm fit.",
  },
  {
    title: "Governance and freshness",
    body:
      "Freshness, privacy, sharing rights, and export entitlements belong on the listing. If the site changed or exports are limited, the public surface should say that directly instead of hiding it in follow-up email.",
  },
];

export default function Docs() {
  return (
    <>
      <SEO
        title="Compatibility and Exports | Blueprint"
        description="What stays standardized across Blueprint listings, what varies by site, and how buyers should think about compatibility, exports, privacy, and freshness."
        canonical="/docs"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Compatibility and exports
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Practical answers about formats, compatibility, and what a listing can actually support.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This page is for technical buyers. It separates the stable product contract from the
              listing-specific details so your team knows what can be assumed early and what should
              be confirmed on a site by site basis.
            </p>
          </div>

          <div className="mt-12 grid gap-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
              >
                <h2 className="text-2xl font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
