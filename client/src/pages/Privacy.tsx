import { Shield, SlidersHorizontal, SquareStack, Waypoints } from "lucide-react";
import { SEO } from "@/components/SEO";
export const privacyPolicySections = [
  {
    title: "What we collect",
    body:
      "We collect the information you submit through forms, account creation, checkout, support requests, and capture-related workflows. Depending on the product area, that can include contact details, account information, company information, payment metadata from our payment processor, uploaded files, and technical logs tied to site packages or hosted sessions.",
    icon: SquareStack,
  },
  {
    title: "Capture and site data",
    body:
      "Blueprint may process walkthrough media, timestamps, poses, depth, device metadata, and site-level rights or privacy metadata when those records are part of a capture bundle, maintained testbed, or Task Evaluation Run. That data is part of the product record and may be used to package, deliver, operate, refresh, or audit the run and its authorized evidence review.",
    icon: Waypoints,
  },
  {
    title: "Sharing",
    body:
      "We do not sell personal data. We may share information with vetted service providers who help us host the product, store capture records, process payments, deliver analytics, support customer communication, or operate authorized model/runtime workflows. We may also share information when required by law or when needed to protect rights, privacy, security, or the integrity of the service.",
    icon: Shield,
  },
  {
    title: "Your choices",
    body:
      "Depending on your location, you may have rights to access, correct, delete, export, object to, or restrict certain personal data. Send privacy rights requests to privacy@tryblueprint.io. We verify identity or authority before changing capture, account, payout, or buyer records.",
    icon: SlidersHorizontal,
  },
] as const;

export const capturePrivacyAnnex = [
  ["Raw walkthrough media", "Used to package, review, redact, and audit exact-site outputs. Buyer visibility depends on listing rights and privacy state."],
  ["Faces, screens, and paperwork", "Expected to be avoided or redacted where practical before buyer-facing proof is presented."],
  ["Location and route metadata", "Used to keep proof tied to the exact site, capture window, allowed route, and restricted-zone boundaries."],
  ["Retention", "Retained under the beta schedule below unless a signed agreement, legal hold, security incident, or active privacy request requires a different handling path."],
  ["Buyer sharing", "Shared according to the listing, order form, rights sheet, hosted-review scope, or other written agreement."],
];

export const rolePrivacyAnnex = [
  {
    title: "Robot teams",
    body: "Buyer workspaces may include site requests, robot profiles, hosted-session notes, exports, and account activity.",
  },
  {
    title: "Site operators",
    body: "Operator records may include authority, access windows, restricted zones, commercialization preferences, and privacy instructions.",
  },
  {
    title: "Capturers",
    body: "Capturer records may include application details, city access, device metadata, submitted routes, review status, and payout eligibility state.",
  },
];

export const betaRetentionSchedule = [
  {
    record: "Raw capture truth and provenance",
    defaultWindow: "180 days after beta package closeout",
    notes:
      "Includes walkthrough media, timestamps, pose/depth/device metadata, rights/privacy review state, and capture integrity records.",
  },
  {
    record: "Temporary processing files",
    defaultWindow: "14 days after successful packaging",
    notes:
      "Includes transient renders, redaction intermediates, and failed-run scratch data unless an active incident or package investigation needs the file.",
  },
  {
    record: "Buyer package and hosted-session artifacts",
    defaultWindow: "365 days after package closeout or contract end",
    notes:
      "Includes buyer-facing evidence exports, hosted review media, Task Evaluation Run outputs, permitted-use records, and delivery manifests.",
  },
  {
    record: "Support, privacy request, and operational evidence",
    defaultWindow: "90 days after ticket or request closeout",
    notes:
      "Security, accounting, payout, tax, fraud-prevention, and legal records may be retained longer when law or a signed agreement requires it.",
  },
] as const;

export const privacyRightsRequestSteps = [
  "Email privacy@tryblueprint.io with the request type and the account, company, capture, package, or payout record involved.",
  "Blueprint acknowledges the request within 10 business days and targets completion within 30 calendar days after identity or authority verification.",
  "Deletion or restriction may be limited when capture truth, provenance, fraud prevention, payment records, legal hold, signed buyer delivery, or safety/security obligations require retention.",
] as const;

export const privacySubprocessorCategories = [
  {
    category: "Cloud hosting and storage",
    examples: "Firebase/Google Cloud, Render, Backblaze B2, and Redis-backed cache or queue services when configured.",
  },
  {
    category: "Payments and payouts",
    examples: "Stripe and related financial infrastructure used for checkout, invoices, payout onboarding, treasury, and ledger records.",
  },
  {
    category: "Communication, analytics, and support",
    examples: "Email, support, product analytics, error monitoring, and internal workflow tools used to operate customer requests.",
  },
  {
    category: "Authorized model or runtime providers",
    examples: "Provider access is request-scoped and used only when a workflow is configured, authorized, and logged for the relevant run.",
  },
] as const;

export const betaResidencyTransferRows = [
  {
    label: "External beta default",
    detail:
      "Blueprint's external beta is scoped to US testers and US capture sites unless a written review approves a different region.",
  },
  {
    label: "Non-US participation",
    detail:
      "Non-US testers, capture sites, or buyer delivery paths require signed transfer terms, such as a DPA, SCCs or equivalent transfer mechanism, and approved retention/residency terms before capture or sharing.",
  },
  {
    label: "Provider boundaries",
    detail:
      "Subprocessor and runtime access must stay tied to the customer workflow, support ticket, or run artifact being processed; raw capture and rights/privacy records are not treated as generic training data.",
  },
] as const;

export default function Privacy() {
  return <>
    <SEO title="Privacy Policy | Blueprint" description="How Blueprint handles information across its website, capture workflows, and Task Evaluation Runs." canonical="/privacy" image="https://tryblueprint.io/images/site-led/workcell.webp" />
    <article className="ms-legal ms-container">
      <h1>Privacy Policy</h1>
      <p>Effective March 23, 2026</p>
      <p>How we handle information with respect and transparency.</p>
      {privacyPolicySections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
      <section><h2>Retention</h2><p>We keep each category only as long as it serves the purpose it was collected for, then delete or anonymize it. Rights and privacy limits stay attached to the relevant product record while it exists. A signed agreement, legal hold, security incident, or active privacy request may require stricter handling.</p>
        <LegalRows rows={[
          ["Raw capture & PII in it", "Kept while a capture is being processed into a product record and while rights/consent are in force; deleted or redacted when the linked product record is deleted or on a verified deletion request."],
          ["Product records & packages", "Retained for the life of the buyer entitlement or hosted-session license, then removed after the license term ends."],
          ["Account & contact data", "Retained while your account is active and deleted or anonymized after account closure or a verified deletion request."],
          ["Payment & tax records", "Retained as required by law (US tax records are typically retained for up to 7 years)."],
        ]} />
      </section>
      <section><h2>Your rights &amp; how to exercise them</h2><p>Depending on where you live, you can request access to, correction of, a copy of, or deletion of your personal information, and you can withdraw capture consent. Email <a href="mailto:privacy@tryblueprint.io">privacy@tryblueprint.io</a> from the address on your account (or include enough detail to verify you). We acknowledge requests promptly and respond within 30 days; if we need more time we will tell you why. We do not charge for or retaliate against a request.</p></section>
      <section><h2>Subprocessors</h2><p>We share personal information only with the service providers that run Blueprint, each under a data-processing agreement and only for the function listed:</p>
        <LegalRows rows={[
          ["Google (Firebase / Google Cloud)", "Authentication, database, capture storage, and hosting."],
          ["Stripe", "Buyer payments and capturer payouts."],
          ["Render", "Application and API hosting."],
          ["Managed Redis", "Caching and background job queues."],
          ["Notion", "Internal operations and support records."],
        ]} />
        <LegalRows rows={privacySubprocessorCategories.map((item) => [item.category, item.examples])} />
      </section>
      <section><h2>Beta retention schedule</h2><LegalRows rows={betaRetentionSchedule.map((item) => [item.record, item.defaultWindow + ". " + item.notes])} /></section>
      <section><h2>Privacy rights requests</h2>{privacyRightsRequestSteps.map((step) => <p key={step}>{step}</p>)}</section>
      <section><h2>Data residency and transfers</h2><LegalRows rows={betaResidencyTransferRows.map((item) => [item.label, item.detail])} /></section>
      <section><h2>Capture privacy annex</h2><LegalRows rows={capturePrivacyAnnex} />{rolePrivacyAnnex.map((item) => <div key={item.title}><h3>{item.title}</h3><p>{item.body}</p></div>)}</section>
      <section><h2>Contact</h2><p>Questions or privacy requests? <a href="mailto:privacy@tryblueprint.io">privacy@tryblueprint.io</a></p></section>
    </article>
  </>;
}

function LegalRows({ rows }: { rows: ReadonlyArray<ReadonlyArray<string>> }) {
  return <dl className="ms-legal-rows">{rows.map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>;
}
