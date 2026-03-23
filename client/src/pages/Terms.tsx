import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "1. Services",
    body:
      "Blueprint provides software and related services for capture intake, site-specific world-model packages, hosted sessions, and supporting buyer or operator workflows. Specific deliverables, usage rights, and commercial terms may also be set in an order form, statement of work, listing-specific terms, or other written agreement.",
  },
  {
    title: "2. Accounts and access",
    body:
      "You are responsible for the account information you provide and for activity under your account. Do not share credentials with people who should not have access to the package, hosted session, or site data tied to your account.",
  },
  {
    title: "3. Payments and refunds",
    body:
      "Fees are set in the applicable checkout flow, order form, or agreement. Unless a written agreement says otherwise, fees are non-refundable once digital access is granted or work has started.",
  },
  {
    title: "4. Site packages, hosted sessions, and limits",
    body:
      "A world-model package or hosted session is tied to one site and one set of stated usage rights. Some listings are meant for public proof or walkthrough only. Others are paid products. Buyers should follow the rights, privacy, retention, and export limits attached to the listing or contract.",
  },
  {
    title: "5. Rights and ownership",
    body:
      "Blueprint keeps its pre-existing software, tooling, workflows, and other intellectual property. Buyers and operators receive only the rights granted in the applicable listing, checkout flow, or written agreement. Capture provenance, privacy metadata, and consent metadata remain part of the product record and are not optional decoration.",
  },
  {
    title: "6. Operator and facility rules",
    body:
      "If you provide access to a facility, you represent that you have the authority to do so or that you have obtained the permissions required to allow capture, packaging, or commercialization. Site-specific restrictions on access, privacy, and downstream use continue to apply after capture.",
  },
  {
    title: "7. Disclaimer",
    body:
      "Blueprint does not promise that a site package or hosted session is a deployment guarantee. The product is meant to help teams inspect a real site earlier and make better decisions before travel or deployment work. Final validation still belongs to the buyer's own testing, safety review, and on-site process.",
  },
  {
    title: "8. Limitation of liability",
    body:
      "To the fullest extent allowed by law, Blueprint is not liable for indirect, incidental, special, consequential, or punitive damages. Blueprint's total liability for claims arising out of the services is limited to the amount paid for the applicable service in the twelve months before the claim.",
  },
  {
    title: "9. Governing law",
    body:
      "These terms are governed by the laws of the State of North Carolina, without regard to conflict-of-law rules. Disputes will be brought in the state or federal courts located in Durham County, North Carolina, unless a written agreement says otherwise.",
  },
  {
    title: "10. Contact",
    body:
      "Questions about these terms can be sent to legal@tryblueprint.io.",
  },
];

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Service | Blueprint"
        description="Terms of service for Blueprint world-model packages, hosted sessions, capture workflows, and related services."
        canonical="/terms"
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-16 sm:px-6">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Legal</p>
          <h1 className="text-4xl font-semibold text-slate-900">Terms of Service</h1>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Effective date:</span> March 23, 2026.{" "}
            <span className="font-medium">Last updated:</span> March 23, 2026.
          </p>
          <p className="text-sm text-slate-600">
            These terms govern access to Blueprint's website, world-model packages, hosted
            sessions, capture workflows, and related services.
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="space-y-3 text-sm text-slate-600">
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </>
  );
}
