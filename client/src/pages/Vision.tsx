import { Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentTimeline } from "@/components/site/DeploymentTimeline";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  SectionHeader,
} from "@/components/site/publicSections";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const scaleEffects = [
  {
    title: "Sites explain work once",
    body: "A reusable task dossier replaces repeated tours, spreadsheets, videos, and vendor-specific intake.",
  },
  {
    title: "Robot teams see qualified demand",
    body: "Deployment engineers start with compatible workflows instead of treating every inbound lead as a discovery project.",
  },
  {
    title: "Evaluation becomes comparable",
    body: "The same task, conditions, permissions, and acceptance criteria follow every candidate and provider.",
  },
  {
    title: "Physical pilots get sharper",
    body: "The robot still proves itself onsite, but the visit begins with named risks and a frozen test plan.",
  },
] as const;

export default function Vision() {
  return (
    <>
      <SEO
        title="Vision | The deployment preparation layer for robots"
        description="Blueprint's vision is a reusable preparation layer between real sites and scarce robot deployment teams."
        canonical="/vision"
        jsonLd={[
          webPageJsonLd({
            path: "/vision",
            name: "Blueprint vision",
            description:
              "A capture-first deployment preparation layer for real sites and robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Vision", path: "/vision" },
          ]),
        ]}
      />

      <section className="bg-canvas">
        <div className="mx-auto max-w-[94rem] px-5 pb-20 pt-20 sm:px-8 lg:px-10 lg:pb-28 lg:pt-28">
          <Reveal>
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-action">
              Vision
            </p>
            <h1 className="mt-7 max-w-[14ch] text-[clamp(3.2rem,7vw,7rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-ink-900">
              Every robot should arrive with the site homework already done.
            </h1>
            <p className="mt-8 max-w-[42rem] text-body-l leading-8 text-ink-500">
              Robot capacity may become abundant. Deployment engineering will
              not. Blueprint makes the repeated preparation work reusable across
              sites, robots, and providers.
            </p>
          </Reveal>
        </div>
      </section>

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="The bottleneck"
            title="More robots create more months 0–2 work."
            lede="Every deployment still begins with task discovery, site recreation, compatibility checks, success criteria, data permissions, and a handoff."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 lg:grid-cols-4">
            {scaleEffects.map((effect, index) => (
              <Reveal key={effect.title} delay={index * 0.05}>
                <article className="h-full bg-ink p-6 lg:p-7">
                  <Check className="h-5 w-5 text-brass" aria-hidden="true" />
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-white">
                    {effect.title}
                  </h2>
                  <p className="mt-3 text-caption leading-6 text-ink-300">
                    {effect.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="The boundary"
            title="The preparation layer sits before the physical deployment."
          />
          <Reveal className="mt-14">
            <DeploymentTimeline />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">
                What never changes
              </p>
              <h2 className="mt-5 text-[clamp(2.6rem,4.6vw,4.8rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-ink-900">
                Capture first. Physical proof last.
              </h2>
            </div>
            <p className="max-w-[42rem] text-body-l leading-8 text-ink-500 lg:pt-12">
              Raw capture remains the source for the site. The task owner
              defines success. Derived tools help answer bounded questions. Real
              hardware settles physical performance. Scale should make that
              chain easier to reuse—not easier to blur.
            </p>
          </div>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start with one workflow"
        title="Make one site-task reusable before trying to make the market universal."
        body="Blueprint's current product is deliberately narrow: one Task Evaluation Run for one real workflow and one deployment decision."
        primaryHref="/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=vision"
        primaryLabel="Submit a site task"
        secondaryHref="/for-robot-teams"
        secondaryLabel="Robot-team use case"
        imageSrc="/redesign/pov/loading-dock.jpg"
        imageAlt="Loading-dock workflow considered for robot deployment"
      />
    </>
  );
}
