import { Mail, Shield, SlidersHorizontal, SquareStack, Waypoints } from "lucide-react";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  SurfaceBrowserFrame,
  SurfaceCard,
  SurfaceMiniLabel,
  SurfacePage,
  SurfacePill,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

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

const panelCard = "rounded-none border-runway-line bg-runway-panel";
const bandCard = "rounded-none border-runway-line bg-runway-black";
const sectionHeading =
  "font-display text-[1.35rem] font-semibold uppercase leading-[1.05] tracking-[0.005em] text-runway-text";
const subHeading =
  "font-display text-[1.05rem] font-semibold uppercase leading-[1.1] tracking-[0.005em] text-runway-text";
const prose = "text-[16px] leading-[1.7] text-runway-body";
const rowGrid = "grid gap-2 p-4 text-[15px] leading-[1.7]";
const rowLabel = "font-semibold text-runway-text";
const rowDetail = "text-runway-mute";
const metaPill =
  "rounded-none border-runway-line bg-runway-panel font-mono text-[10px] tracking-[0.16em] text-runway-mute";

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy | Blueprint"
        description="Privacy policy for Blueprint's website, capture workflows, Task Evaluation Runs, evidence artifacts, historical compatibility records, and related services."
        canonical="/privacy"
        jsonLd={[
          webPageJsonLd({
            path: "/privacy",
            name: "Blueprint privacy policy",
            description:
              "Privacy policy for Blueprint website, capture workflows, Task Evaluation Runs, evidence artifacts, historical compatibility records, and related services.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Privacy", path: "/privacy" },
          ]),
        ]}
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Legal Reference Board" rightLabel="Privacy by Design" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid gap-0 xl:grid-cols-[0.38fr_0.62fr]">
              <div className="border-b border-runway-line bg-runway-black p-8 xl:border-b-0 xl:border-r lg:p-10">
                <SurfaceMiniLabel className="font-mono text-runway-faint">Policy Card</SurfaceMiniLabel>
                <h1 className="mt-5 font-display uppercase text-[clamp(3.5rem,6vw,5.4rem)] font-semibold uppercase leading-[0.86] tracking-[0.005em] text-runway-text">
                  Privacy
                  <br />
                  Policy
                </h1>
                <p className="mt-5 max-w-[26ch] text-[16px] leading-[1.7] text-runway-body">
                  How we handle information with respect and transparency.
                </p>
                <div className="mt-8 overflow-hidden border border-runway-line bg-runway-panel">
                  <img
                    src={privateGeneratedAssets.privacyArchiveBoard}
                    alt="Blueprint privacy archive board"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SurfacePill className={metaPill}>Effective March 23, 2026</SurfacePill>
                  <SurfacePill className={metaPill}>Archive reference</SurfacePill>
                </div>
              </div>

              <div className="bg-runway-deep p-8 lg:p-10">
                <div className="grid gap-5 md:grid-cols-2">
                  {privacyPolicySections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <SurfaceCard key={section.title} className={`${panelCard} h-full`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center border border-runway-line bg-runway-black">
                            <Icon className="h-4.5 w-4.5 text-runway-mute" />
                          </div>
                          <h2 className={sectionHeading}>{section.title}</h2>
                        </div>
                        <p className={`mt-4 max-w-[68ch] ${prose}`}>{section.body}</p>
                      </SurfaceCard>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SurfaceCard className={bandCard}>
                    <h2 className={sectionHeading}>Retention</h2>
                    <p className={`mt-4 max-w-[68ch] ${prose}`}>
                      We keep each category only as long as it serves the purpose it was collected
                      for, then delete or anonymize it. Rights and privacy limits stay attached to
                      the relevant product record while it exists. A signed agreement, legal hold,
                      security incident, or active privacy request may require stricter handling.
                    </p>
                    <div className="mt-4 divide-y divide-runway-line-soft border border-runway-line">
                      {[
                        ["Raw capture & PII in it", "Kept while a capture is being processed into a product record and while rights/consent are in force; deleted or redacted when the linked product record is deleted or on a verified deletion request."],
                        ["Product records & packages", "Retained for the life of the buyer entitlement or hosted-session license, then removed after the license term ends."],
                        ["Account & contact data", "Retained while your account is active and deleted or anonymized after account closure or a verified deletion request."],
                        ["Payment & tax records", "Retained as required by law (US tax records are typically retained for up to 7 years)."],
                      ].map(([label, detail]) => (
                        <div key={label} className={rowGrid + " md:grid-cols-[0.4fr_0.6fr]"}>
                          <span className={rowLabel}>{label}</span>
                          <span className={rowDetail}>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className={panelCard}>
                    <h2 className={sectionHeading}>Your rights &amp; how to exercise them</h2>
                    <p className={`mt-4 max-w-[68ch] ${prose}`}>
                      Depending on where you live, you can request access to, correction of, a copy of,
                      or deletion of your personal information, and you can withdraw capture consent.
                      Email{" "}
                      <a href="mailto:privacy@tryblueprint.io" className="font-medium text-runway-signal underline underline-offset-2">
                        privacy@tryblueprint.io
                      </a>{" "}
                      from the address on your account (or include enough detail to verify you). We
                      acknowledge requests promptly and respond within 30 days; if we need more time
                      we will tell you why. We do not charge for or retaliate against a request.
                    </p>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SurfaceCard className={bandCard}>
                    <h2 className={sectionHeading}>Subprocessors</h2>
                    <p className={`mt-4 max-w-[68ch] ${prose}`}>
                      We share personal information only with the service providers that run Blueprint,
                      each under a data-processing agreement and only for the function listed:
                    </p>
                    <div className="mt-4 divide-y divide-runway-line-soft border border-runway-line">
                      {[
                        ["Google (Firebase / Google Cloud)", "Authentication, database, capture storage, and hosting."],
                        ["Stripe", "Buyer payments and capturer payouts."],
                        ["Render", "Application and API hosting."],
                        ["Managed Redis", "Caching and background job queues."],
                        ["Notion", "Internal operations and support records."],
                      ].map(([label, detail]) => (
                        <div key={label} className={rowGrid + " md:grid-cols-[0.4fr_0.6fr]"}>
                          <span className={rowLabel}>{label}</span>
                          <span className={rowDetail}>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className={panelCard}>
                    <h2 className={sectionHeading}>Contact</h2>
                    <p className={`mt-4 max-w-[68ch] ${prose}`}>Questions or privacy requests?</p>
                    <a href="mailto:privacy@tryblueprint.io" className="mt-5 inline-flex items-center gap-3 font-mono text-[13px] text-runway-signal">
                      <Mail className="h-4 w-4" />
                      privacy@tryblueprint.io
                    </a>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.6fr_0.4fr]">
                  <SurfaceCard className={panelCard}>
                    <h2 className={sectionHeading}>Beta retention schedule</h2>
                    <div className="mt-5 divide-y divide-runway-line-soft border border-runway-line">
                      {betaRetentionSchedule.map((item) => (
                        <div key={item.record} className={rowGrid + " md:grid-cols-[0.28fr_0.28fr_0.44fr]"}>
                          <span className={rowLabel}>{item.record}</span>
                          <span className="runway-num text-[13px] text-runway-body">{item.defaultWindow}</span>
                          <span className={rowDetail}>{item.notes}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className={bandCard}>
                    <h2 className={sectionHeading}>Privacy rights requests</h2>
                    <div className="mt-5 space-y-4">
                      {privacyRightsRequestSteps.map((step) => (
                        <p key={step} className={`max-w-[68ch] ${prose}`}>
                          {step}
                        </p>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <SurfaceCard className={panelCard}>
                    <h2 className={sectionHeading}>Subprocessors</h2>
                    <div className="mt-5 divide-y divide-runway-line-soft border border-runway-line">
                      {privacySubprocessorCategories.map((item) => (
                        <div key={item.category} className={rowGrid + " md:grid-cols-[0.34fr_0.66fr]"}>
                          <span className={rowLabel}>{item.category}</span>
                          <span className={rowDetail}>{item.examples}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className={bandCard}>
                    <h2 className={sectionHeading}>Data residency and transfers</h2>
                    <div className="mt-5 divide-y divide-runway-line-soft border border-runway-line">
                      {betaResidencyTransferRows.map((item) => (
                        <div key={item.label} className={rowGrid + " md:grid-cols-[0.32fr_0.68fr]"}>
                          <span className={rowLabel}>{item.label}</span>
                          <span className={rowDetail}>{item.detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
                  <SurfaceCard className={bandCard}>
                    <h2 className={sectionHeading}>Capture privacy annex</h2>
                    <div className="mt-5 divide-y divide-runway-line-soft border border-runway-line">
                      {capturePrivacyAnnex.map(([label, detail]) => (
                        <div key={label} className={rowGrid + " md:grid-cols-[0.34fr_0.66fr]"}>
                          <span className={rowLabel}>{label}</span>
                          <span className={rowDetail}>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <div className="grid gap-4">
                    {rolePrivacyAnnex.map((item) => (
                      <SurfaceCard key={item.title} className={panelCard}>
                        <h3 className={subHeading}>{item.title}</h3>
                        <p className={`mt-3 max-w-[68ch] ${prose}`}>{item.body}</p>
                      </SurfaceCard>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
