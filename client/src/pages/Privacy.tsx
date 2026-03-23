import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "1. What we collect",
    body:
      "We collect the information you submit through forms, account creation, checkout, support requests, and capture-related workflows. Depending on the product surface, that can include contact details, account information, company information, payment metadata from our payment processor, uploaded files, and technical logs tied to site packages or hosted sessions.",
  },
  {
    title: "2. Capture and site data",
    body:
      "Blueprint may process walkthrough media, timestamps, poses, depth, device metadata, and site-level rights or privacy metadata when those records are part of a capture bundle or world-model package. That data is part of the product record and may be used to package, deliver, operate, refresh, or audit a listing or hosted session.",
  },
  {
    title: "3. How we use information",
    body:
      "We use information to operate the site, provide packages and hosted sessions, process payments, respond to support requests, maintain security, enforce rights and privacy limits, and improve the product. We may also use aggregate usage information to understand how buyers and operators use the service.",
  },
  {
    title: "4. Sharing",
    body:
      "We do not sell personal data. We may share information with service providers who help us host the product, process payments, deliver analytics, or support customer communication. We may also share information when required by law or when needed to protect rights, privacy, security, or the integrity of the service.",
  },
  {
    title: "5. Rights, privacy, and retention",
    body:
      "Blueprint keeps rights and privacy metadata attached to the product record because those limits matter after capture, not just during intake. We retain information for as long as needed to operate the service, meet legal obligations, enforce product terms, and manage package or hosted-session records.",
  },
  {
    title: "6. Security",
    body:
      "We use reasonable safeguards to protect data in transit and at rest, but no system is perfectly secure. If you think a Blueprint account or package has been accessed improperly, contact us right away.",
  },
  {
    title: "7. Your choices",
    body:
      "Depending on your location, you may have rights to access, correct, delete, or restrict certain personal data. You can also opt out of non-essential marketing messages at any time.",
  },
  {
    title: "8. Contact",
    body:
      "Questions about this policy or privacy requests can be sent to privacy@tryblueprint.io.",
  },
];

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy | Blueprint"
        description="Privacy policy for Blueprint's website, capture workflows, world-model packages, hosted sessions, and related services."
        canonical="/privacy"
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-16 sm:px-6">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Legal</p>
          <h1 className="text-4xl font-semibold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Effective date:</span> March 23, 2026.{" "}
            <span className="font-medium">Last updated:</span> March 23, 2026.
          </p>
          <p className="text-sm text-slate-600">
            This policy explains how Blueprint collects, uses, and protects information across the
            website, capture workflows, world-model packages, hosted sessions, and related services.
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
