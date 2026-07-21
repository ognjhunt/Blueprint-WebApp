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
      "Blueprint may process walkthrough media, timestamps, poses, depth, device metadata, and site-level rights or privacy metadata when those records are part of a capture bundle, Task Evaluation Run, or Policy Improvement Run. That data is part of the product record and may be used to package, deliver, operate, refresh, or audit a listing or hosted session.",
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
      "Includes buyer-facing exports, hosted review media, Task Evaluation Run outputs, Policy Improvement Run support artifacts, and delivery manifests.",
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
  return (
    <>
      <SEO
        title="Privacy Policy | Blueprint"
        description="Privacy policy for Blueprint's website, capture workflows, robot evaluation runs, sim-only policy improvement runs, hosted sessions, and related services."
        canonical="/privacy"
        jsonLd={[
          webPageJsonLd({
            path: "/privacy",
            name: "Blueprint privacy policy",
            description:
              "Privacy policy for Blueprint website, capture workflows, robot evaluation runs, policy improvement runs, hosted sessions, and related services.",
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
              <div className="border-b border-black/10 bg-[#f7f3eb] p-8 xl:border-b-0 xl:border-r lg:p-10">
                <SurfaceMiniLabel>Policy Card</SurfaceMiniLabel>
                <h1 className="mt-5 text-[clamp(3.5rem,6vw,5.4rem)] font-semibold uppercase leading-[0.86] tracking-[-0.09em]">
                  Privacy
                  <br />
                  Policy
                </h1>
                <p className="mt-5 max-w-[20rem] text-sm uppercase tracking-[0.2em] text-black/50">
                  How we handle information with respect and transparency.
                </p>
                <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-black/10 bg-white">
                  <img
                    src={privateGeneratedAssets.privacyArchiveBoard}
                    alt="Blueprint privacy archive board"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SurfacePill>Effective March 23, 2026</SurfacePill>
                  <SurfacePill>Archive reference</SurfacePill>
                </div>
              </div>

              <div className="bg-white p-8 lg:p-10">
                <div className="grid gap-5 md:grid-cols-2">
                  {privacyPolicySections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <SurfaceCard key={section.title} className="h-full">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-[#faf6ef]">
                            <Icon className="h-4.5 w-4.5 text-black/65" />
                          </div>
                          <SurfaceMiniLabel>{section.title}</SurfaceMiniLabel>
                        </div>
                        <p className="mt-4 text-[1.5rem] font-semibold tracking-[-0.05em]">{section.title}</p>
                        <p className="mt-4 text-sm leading-7 text-black/60">{section.body}</p>
                      </SurfaceCard>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SurfaceCard className="bg-[#faf7f1]">
                    <SurfaceMiniLabel>Retention</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      We keep each category only as long as it serves the purpose it was collected
                      for, then delete or anonymize it. Rights and privacy limits stay attached to
                      the relevant product record while it exists. A signed agreement, legal hold,
                      security incident, or active privacy request may require stricter handling.
                    </p>
                    <div className="mt-4 divide-y divide-black/10 border border-black/10">
                      {[
                        ["Raw capture & PII in it", "Kept while a capture is being processed into a product record and while rights/consent are in force; deleted or redacted when the linked product record is deleted or on a verified deletion request."],
                        ["Product records & packages", "Retained for the life of the buyer entitlement or hosted-session license, then removed after the license term ends."],
                        ["Account & contact data", "Retained while your account is active and deleted or anonymized after account closure or a verified deletion request."],
                        ["Payment & tax records", "Retained as required by law (US tax records are typically retained for up to 7 years)."],
                      ].map(([label, detail]) => (
                        <div key={label} className="grid gap-1 p-4 text-sm leading-6 md:grid-cols-[0.4fr_0.6fr]">
                          <span className="font-semibold text-black/80">{label}</span>
                          <span className="text-black/55">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard>
                    <SurfaceMiniLabel>Your rights &amp; how to exercise them</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      Depending on where you live, you can request access to, correction of, a copy of,
                      or deletion of your personal information, and you can withdraw capture consent.
                      Email{" "}
                      <a href="mailto:privacy@tryblueprint.io" className="font-semibold underline">
                        privacy@tryblueprint.io
                      </a>{" "}
                      from the address on your account (or include enough detail to verify you). We
                      acknowledge requests promptly and respond within 30 days; if we need more time
                      we will tell you why. We do not charge for or retaliate against a request.
                    </p>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SurfaceCard className="bg-[#faf7f1]">
                    <SurfaceMiniLabel>Subprocessors</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      We share personal information only with the service providers that run Blueprint,
                      each under a data-processing agreement and only for the function listed:
                    </p>
                    <div className="mt-4 divide-y divide-black/10 border border-black/10">
                      {[
                        ["Google (Firebase / Google Cloud)", "Authentication, database, capture storage, and hosting."],
                        ["Stripe", "Buyer payments and capturer payouts."],
                        ["Render", "Application and API hosting."],
                        ["Managed Redis", "Caching and background job queues."],
                        ["Notion", "Internal operations and support records."],
                      ].map(([label, detail]) => (
                        <div key={label} className="grid gap-1 p-4 text-sm leading-6 md:grid-cols-[0.4fr_0.6fr]">
                          <span className="font-semibold text-black/80">{label}</span>
                          <span className="text-black/55">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard>
                    <SurfaceMiniLabel>Contact</SurfaceMiniLabel>
                    <p className="mt-4 text-[1.5rem] font-semibold tracking-[-0.05em]">Questions or privacy requests?</p>
                    <a href="mailto:privacy@tryblueprint.io" className="mt-5 inline-flex items-center gap-3 text-sm font-semibold">
                      <Mail className="h-4 w-4" />
                      privacy@tryblueprint.io
                    </a>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.6fr_0.4fr]">
                  <SurfaceCard>
                    <SurfaceMiniLabel>Beta retention schedule</SurfaceMiniLabel>
                    <div className="mt-5 divide-y divide-black/10 border border-black/10">
                      {betaRetentionSchedule.map((item) => (
                        <div key={item.record} className="grid gap-2 p-4 text-sm leading-6 md:grid-cols-[0.28fr_0.28fr_0.44fr]">
                          <span className="font-semibold text-black">{item.record}</span>
                          <span className="text-black/70">{item.defaultWindow}</span>
                          <span className="text-black/55">{item.notes}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className="bg-[#faf7f1]">
                    <SurfaceMiniLabel>Privacy rights requests</SurfaceMiniLabel>
                    <div className="mt-5 space-y-4">
                      {privacyRightsRequestSteps.map((step) => (
                        <p key={step} className="text-sm leading-7 text-black/60">
                          {step}
                        </p>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <SurfaceCard>
                    <SurfaceMiniLabel>Subprocessors</SurfaceMiniLabel>
                    <div className="mt-5 divide-y divide-black/10 border border-black/10">
                      {privacySubprocessorCategories.map((item) => (
                        <div key={item.category} className="grid gap-2 p-4 text-sm leading-6 md:grid-cols-[0.34fr_0.66fr]">
                          <span className="font-semibold text-black">{item.category}</span>
                          <span className="text-black/60">{item.examples}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className="bg-[#111110] text-white">
                    <SurfaceMiniLabel className="text-white/50">Data residency and transfers</SurfaceMiniLabel>
                    <div className="mt-5 divide-y divide-white/10 border border-white/10">
                      {betaResidencyTransferRows.map((item) => (
                        <div key={item.label} className="grid gap-2 p-4 text-sm leading-6 md:grid-cols-[0.32fr_0.68fr]">
                          <span className="font-semibold text-white">{item.label}</span>
                          <span className="text-white/65">{item.detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
                  <SurfaceCard className="bg-[#111110] text-white">
                    <SurfaceMiniLabel className="text-white/50">Capture privacy annex</SurfaceMiniLabel>
                    <div className="mt-5 divide-y divide-white/10 border border-white/10">
                      {capturePrivacyAnnex.map(([label, detail]) => (
                        <div key={label} className="grid gap-2 p-4 text-sm leading-6 md:grid-cols-[0.34fr_0.66fr]">
                          <span className="font-semibold text-white">{label}</span>
                          <span className="text-white/65">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <div className="grid gap-4">
                    {rolePrivacyAnnex.map((item) => (
                      <SurfaceCard key={item.title}>
                        <SurfaceMiniLabel>{item.title}</SurfaceMiniLabel>
                        <p className="mt-3 text-sm leading-7 text-black/60">{item.body}</p>
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
