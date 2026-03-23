import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "What stays stable",
    body:
      "Blueprint is built around stable product contracts: the capture bundle, timestamps, poses, device metadata, rights and privacy metadata, site package manifests, and hosted-session contracts. Those are the pieces buyers and operators should be able to rely on even if the runtime backend changes later.",
  },
  {
    title: "Typical package contents",
    body:
      "A site package can include walkthrough media, camera poses, site notes, geometry or depth artifacts when available, and the package-level rights and usage framing for that listing. The exact export set is listing-specific and should be read from the package surface, not guessed from a generic promise.",
  },
  {
    title: "Hosted session contract",
    body:
      "Hosted sessions are tied to one exact site. Buyers should be able to launch, reset, rerun, compare policy behavior, and export results through the same session contract. That contract should survive backend swaps even when the underlying runtime improves.",
  },
  {
    title: "Provenance and privacy",
    body:
      "Capture truth is authoritative. That includes walkthrough video, timestamps, poses, depth when present, device metadata, and any site-level privacy or rights metadata attached to the package. Downstream readiness or review layers are useful, but they should not rewrite the underlying capture truth.",
  },
  {
    title: "Freshness and refresh state",
    body:
      "Site packages are only as current as the capture behind them. When a package has freshness metadata, refresh state, or recapture requirements, that information belongs on the listing. If a site changed, the answer should be a refresh decision, not softer wording.",
  },
  {
    title: "Backend flexibility",
    body:
      "Blueprint should not read like a product tied forever to one provider, checkpoint family, or runtime trick. The long-lived value is in real-site capture, packaging, hosted access, and buyer workflow. The model backend is important, but it should remain replaceable.",
  },
];

export default function Docs() {
  return (
    <>
      <SEO
        title="Docs | Blueprint"
        description="Technical notes on Blueprint world-model packages, hosted-session contracts, exports, provenance, privacy, and freshness."
        canonical="/docs"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Docs
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              What stays consistent across listings.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This is the short version of the product contract: what the package contains, what
              the hosted path does, and what details should stay visible even if the backend
              changes later.
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
