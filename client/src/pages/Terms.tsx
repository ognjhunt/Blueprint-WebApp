import { BadgeDollarSign, Briefcase, Gavel, Landmark, Mail, ShieldCheck } from "lucide-react";
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
    title: "Services",
    body:
      "Blueprint provides software and related services for capture intake, site-specific world-model packages, hosted sessions, and supporting buyer or operator workflows. Specific deliverables, usage rights, and commercial terms may also be set in an order form, statement of work, listing-specific terms, or other written agreement.",
    icon: Briefcase,
  },
  {
    title: "Payments and plans",
    body:
      "Fees are set in the applicable checkout flow, order form, or agreement. Unless a written agreement says otherwise, fees are non-refundable once digital access is granted or work has started.",
    icon: BadgeDollarSign,
  },
  {
    title: "Rights and ownership",
    body:
      "Blueprint keeps its pre-existing software, tooling, workflows, and other intellectual property. Buyers and operators receive only the rights granted in the applicable listing, checkout flow, or written agreement. Capture provenance, privacy metadata, and consent metadata remain part of the product record.",
    icon: ShieldCheck,
  },
  {
    title: "Operator rules",
    body:
      "If you provide access to a facility, you represent that you have the authority to do so or that you have obtained the permissions required to allow capture, packaging, or commercialization. Site-specific restrictions on access, privacy, and downstream use continue to apply after capture.",
    icon: Gavel,
  },
] as const;

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Service | Blueprint"
        description="Terms of service for Blueprint world-model packages, hosted sessions, capture workflows, and related services."
        canonical="/terms"
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Legal Reference Board" rightLabel="Contract Archive" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid gap-0 xl:grid-cols-[0.4fr_0.6fr]">
              <div className="border-b border-black/10 bg-[#f6f1e7] p-8 xl:border-b-0 xl:border-r lg:p-10">
                <SurfaceMiniLabel>Agreement Card</SurfaceMiniLabel>
                <h1 className="mt-5 text-[clamp(3.4rem,6vw,5.4rem)] font-semibold uppercase leading-[0.86] tracking-[-0.09em]">
                  Terms of
                  <br />
                  Service
                </h1>
                <p className="mt-5 max-w-[20rem] text-sm uppercase tracking-[0.2em] text-black/52">
                  Agreement to use Blueprint services and site products.
                </p>
                <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-black/10 bg-white">
                  <img
                    src={privateGeneratedAssets.termsContractBoard}
                    alt="Blueprint terms contract board"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SurfacePill>Effective March 23, 2026</SurfacePill>
                  <SurfacePill>Buyer-facing contract</SurfacePill>
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
                            <Icon className="h-4.5 w-4.5 text-black/64" />
                          </div>
                          <SurfaceMiniLabel>{section.title}</SurfaceMiniLabel>
                        </div>
                        <p className="mt-4 text-[1.5rem] font-semibold tracking-[-0.05em]">{section.title}</p>
                        <p className="mt-4 text-sm leading-7 text-black/62">{section.body}</p>
                      </SurfaceCard>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <SurfaceCard className="bg-[#faf7f1]">
                    <SurfaceMiniLabel>Disclaimer</SurfaceMiniLabel>
                    <p className="mt-4 text-sm leading-7 text-black/62">
                      Blueprint does not promise that a site package or hosted session is a
                      deployment guarantee. The product helps teams inspect a real site earlier and
                      make better decisions before travel or deployment work.
                    </p>
                  </SurfaceCard>

                  <SurfaceCard>
                    <div className="flex items-center gap-3">
                      <Landmark className="h-4.5 w-4.5 text-black/62" />
                      <SurfaceMiniLabel>Governing law and contact</SurfaceMiniLabel>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-black/62">
                      These terms are governed by the laws of the State of North Carolina, without
                      regard to conflict-of-law rules. Questions can be sent to Blueprint Legal.
                    </p>
                    <a href="mailto:legal@tryblueprint.io" className="mt-5 inline-flex items-center gap-3 text-sm font-semibold">
                      <Mail className="h-4 w-4" />
                      legal@tryblueprint.io
                    </a>
                  </SurfaceCard>
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
