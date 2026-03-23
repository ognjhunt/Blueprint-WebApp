import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "Capture rights stay explicit",
    body:
      "Blueprint does not treat facility footage like free-floating training material. Each site needs a clear commercial path, and the rules for reuse and sharing should be visible before anyone buys access.",
  },
  {
    title: "Facility controls come first",
    body:
      "Site operators need control over restricted zones, timing windows, camera limits, and downstream permissions. If those controls are unclear, the site should not move forward as a public listing.",
  },
  {
    title: "Privacy and security are part of the product",
    body:
      "Privacy review, redaction, retention, and sharing controls are part of the product. Buyers and site operators both need to know what is stored, what is hidden, and how access is tracked.",
  },
  {
    title: "Hosted access needs clear boundaries",
    body:
      "Hosted evaluation lowers the friction to inspect a site, but it still needs clear entitlement boundaries, auditability, and a plain statement of what the session does and does not expose.",
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
                Rights, privacy, and control need to be easy to read.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Trust falls apart fast when nobody can tell who approved capture, what can be
                shared, or how long sensitive material stays around. Blueprint needs to be direct
                about all three.
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
