import { SEO } from "@/components/SEO";

const principles = [
  {
    title: "Capture rights stay explicit",
    body: "Blueprint does not treat facility footage like unbounded training material. Listings need a visible commercial path and readable rules for reuse, sharing, and export.",
  },
  {
    title: "Facility controls come first",
    body: "Restricted zones, timing windows, redaction requirements, and buyer entitlements should be easy to inspect before any purchase path moves forward.",
  },
  {
    title: "Privacy and security are product surfaces",
    body: "Privacy review, redaction, retention, and hosted-access controls are part of the buyer contract, not legal fine print hiding somewhere else.",
  },
  {
    title: "Hosted access needs clear boundaries",
    body: "Hosted evaluation lowers friction, but it still needs entitlement boundaries, auditability, and plain statements about what the session does and does not expose.",
  },
];

const trustCards = [
  {
    title: "Sample provenance card",
    body: "Facility identifier, capture date, freshness state, approval path, and proof depth are displayed together so the buyer can judge whether the site is current enough for review.",
  },
  {
    title: "Sample rights and restrictions",
    body: "Rights class, export entitlements, restricted zones, sharing limits, and retention policy should be attached to the listing and manifest, not inferred from marketing copy.",
  },
  {
    title: "Hosted access boundary",
    body: "Hosted sessions should show what is launchable, what remains human-gated, and which outputs are sample layouts versus confirmed buyer-facing exports.",
  },
  {
    title: "Retention and redaction",
    body: "A buyer should be able to see whether privacy processing ran, whether raw media is retained, and what downstream material is visible in the public product path.",
  },
];

const publishedToday = [
  "Public proof depth, freshness, and commercial-status disclosure on listing surfaces",
  "Readable sample manifest, export bundle, and rights-sheet layouts for buyer inspection",
  "Hosted-access boundary language that separates public proof from illustrative UI",
  "Privacy, retention, redaction, and restriction framing in the buyer path",
];

const notClaimed = [
  "Blanket site approval unless the listing says so explicitly",
  "Unrestricted commercialization or export rights by default",
  "Deployment guarantees, safety certification, or customer outcome claims",
  "Security or compliance certifications that Blueprint has not published explicitly",
];

const controlCards = [
  {
    title: "Access and entitlement controls",
    body: "Hosted sessions should run behind authenticated access, listing-level entitlements, and request-specific approval steps. Public listings are for buyer review, not unrestricted runtime access.",
  },
  {
    title: "Redaction and privacy processing",
    body: "Blueprint treats redaction state, restricted zones, and privacy processing as product metadata. If media was transformed or withheld for privacy reasons, that should be visible instead of buried.",
  },
  {
    title: "Retention and export boundaries",
    body: "Retention policy, export entitlements, and sharing limits should stay attached to the listing and package contract so a buyer can tell what continues after purchase.",
  },
  {
    title: "Auditability and human gates",
    body: "Irreversible access, rights exceptions, and unusual hosted-session requests should remain human-gated with clear records of what changed and why.",
  },
];

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's buyer-readable trust center for capture rights, provenance, privacy, retention, restrictions, and hosted-access boundaries."
        canonical="/governance"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Governance
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Rights, privacy, provenance, and hosted access should be easy to read.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Trust falls apart when nobody can tell who approved capture, what can be exported, how long material is retained, or where hosted access stops. Blueprint treats those boundaries as part of the product surface.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {trustCards.map((card) => (
                <section key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
                </section>
              ))}
            </div>
          </div>

          <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {principles.map((section) => (
              <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-950 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Buyer-readable trust layer
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              A serious buyer should be able to answer these questions before purchase.
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "Who approved capture and what is the proof depth on this listing?",
                "What can be exported, shared, or retained after package purchase or hosted evaluation?",
                "Which restrictions, redactions, and restricted zones apply to this site?",
                "What remains sample or illustrative, and what is already part of the public product contract?",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-4 text-sm leading-7 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Truth boundary
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                What Blueprint publishes today versus what it does not claim.
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Published today</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {publishedToday.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Not claimed</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {notClaimed.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                No certification claims are implied unless Blueprint publishes them explicitly.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-stone-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Operational controls
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Security, privacy, and access controls buyers should expect to read.
              </h2>
              <div className="mt-5 grid gap-4">
                {controlCards.map((card) => (
                  <section key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                  </section>
                ))}
              </div>
            </article>
          </section>
        </div>
      </div>
    </>
  );
}
