import { Mail, Shield, SlidersHorizontal, SquareStack, Waypoints } from "lucide-react";
import { SEO } from "@/components/SEO";
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

const sections = [
  {
    title: "What we collect",
    body:
      "We collect the information you submit through forms, account creation, checkout, support requests, and capture-related workflows. Depending on the product surface, that can include contact details, account information, company information, payment metadata from our payment processor, uploaded files, and technical logs tied to site packages or hosted sessions.",
    icon: SquareStack,
  },
  {
    title: "Capture and site data",
    body:
      "Blueprint may process walkthrough media, timestamps, poses, depth, device metadata, and site-level rights or privacy metadata when those records are part of a capture bundle or world-model package. That data is part of the product record and may be used to package, deliver, operate, refresh, or audit a listing or hosted session.",
    icon: Waypoints,
  },
  {
    title: "Sharing",
    body:
      "We do not sell personal data. We may share information with service providers who help us host the product, process payments, deliver analytics, or support customer communication. We may also share information when required by law or when needed to protect rights, privacy, security, or the integrity of the service.",
    icon: Shield,
  },
  {
    title: "Your choices",
    body:
      "Depending on your location, you may have rights to access, correct, delete, or restrict certain personal data. You can also opt out of non-essential marketing messages at any time.",
    icon: SlidersHorizontal,
  },
] as const;

const captureAnnex = [
  ["Raw walkthrough media", "Used to package, review, redact, and audit exact-site outputs. Buyer visibility depends on listing rights and privacy state."],
  ["Faces, screens, and paperwork", "Expected to be avoided or redacted where practical before buyer-facing proof is presented."],
  ["Location and route metadata", "Used to keep proof tied to the exact site, capture window, allowed route, and restricted-zone boundaries."],
  ["Retention", "Kept only as needed for service operation, legal obligations, product records, hosted sessions, audits, and agreed refresh paths."],
  ["Buyer sharing", "Shared according to the listing, order form, rights sheet, hosted-review scope, or other written agreement."],
];

const roleAnnex = [
  {
    title: "Robot teams",
    body: "Buyer workspaces may include requests, site briefs, robot profiles, hosted-session notes, exports, and account activity.",
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

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy | Blueprint"
        description="Privacy policy for Blueprint's website, capture workflows, world-model packages, hosted sessions, and related services."
        canonical="/privacy"
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
                  {sections.map((section) => {
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
                    <SurfaceMiniLabel>Rights, privacy, and retention</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      Blueprint keeps rights and privacy metadata attached to the product record
                      because those limits matter after capture, not just during intake. We retain
                      information for as long as needed to operate the service, meet legal
                      obligations, enforce product terms, and manage package or hosted-session
                      records.
                    </p>
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

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
                  <SurfaceCard className="bg-[#111110] text-white">
                    <SurfaceMiniLabel className="text-white/50">Capture privacy annex</SurfaceMiniLabel>
                    <div className="mt-5 divide-y divide-white/10 border border-white/10">
                      {captureAnnex.map(([label, detail]) => (
                        <div key={label} className="grid gap-2 p-4 text-sm leading-6 md:grid-cols-[0.34fr_0.66fr]">
                          <span className="font-semibold text-white">{label}</span>
                          <span className="text-white/65">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <div className="grid gap-4">
                    {roleAnnex.map((item) => (
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
