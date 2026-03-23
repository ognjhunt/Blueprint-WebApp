import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "Capture rights stay explicit",
    body:
      "Blueprint does not treat facility footage as free-floating training material. Each site needs a clear commercial path, and the rules for reuse and sharing should be visible before anyone buys access.",
  },
  {
    title: "Facility controls come first",
    body:
      "Site operators should be able to define restricted zones, timing windows, camera limits, and downstream permissions. If those controls are not clear, the site should not move forward as a sellable listing.",
  },
  {
    title: "Privacy and security are part of the product",
    body:
      "Privacy review, redaction, retention, and sharing controls are not side notes. They are part of whether a world model is credible enough to buy and safe enough to use inside a customer workflow.",
  },
  {
    title: "Hosted access needs limits",
    body:
      "Hosted sessions are useful because they lower the friction to inspect a site. They still need clear entitlement boundaries, auditability, and a plain statement of what a session does and does not expose.",
  },
];

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's approach to capture rights, privacy, restricted zones, retention, and hosted access controls."
        canonical="/governance"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Governance
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Rights, privacy, and control have to be legible.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                The fastest way to lose trust is to blur who approved capture, what can be shared,
                or how long sensitive material stays around. Blueprint needs to be crisp about all
                three.
              </p>
            </div>

            <div className="space-y-4">
              {sections.map((section) => (
                <section key={section.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
