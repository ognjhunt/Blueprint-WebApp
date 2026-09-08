import { Check, TriangleAlert } from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  PreDeploymentCostFigure,
  TodayProcessFigure,
} from "@/components/site/runway/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { theRightClaim } from "@/data/deploymentMarket";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const evidenceLayers = [
  {
    title: "Captured fact",
    body: "The site, task, objects, and timing recorded from the real workflow.",
  },
  {
    title: "Derived test",
    body: "Geometry checks and simulation, used only inside their qualified scope.",
  },
  {
    title: "Physical proof",
    body: "The robot running at the real site. This settles onsite performance and safety—not a digital twin.",
  },
] as const;

export default function Proof() {
  return (
    <>
      <SEO
        title="Evidence behind the months 0–2 problem | Blueprint"
        description="What the pre-pilot work is, what it costs today, and exactly where Blueprint helps — with every figure sourced."
        canonical="/proof"
        jsonLd={[
          webPageJsonLd({
            path: "/proof",
            name: "Blueprint deployment-preparation evidence",
            description:
              "Primary-source industry anchors and Blueprint's evidence boundaries.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Proof", path: "/proof" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Proof, not pitch"
        title="The first two months are real work."
        body="Before a robot can start work, a long list of manual jobs runs on both sides — and almost none of it needs the robot present. Here is that work, what it costs, and where Blueprint helps. Sourced figures, and our own numbers labelled as modelled."
        chips={["Primary sources", "Modelled targets labelled", "Physical proof stays physical"]}
        ctaHref="/how-it-works"
        ctaLabel="See Blueprint's four steps"
        secondaryHref="/faq"
        secondaryLabel="Read the plain-English FAQ"
        imageSrc="/redesign/pov/route-scan.jpg"
        imageAlt="A real facility route used as source evidence"
        imageCaption="Captured site evidence · not deployment proof"
      />

      {/* 01 — the two-sided process */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="What happens today"
            title="A pilot starts with weeks of manual work — on both sides."
            lede="None of it needs the robot present. Today both sides redo it from scratch, for every vendor."
          />
          <Reveal className="mt-14">
            <TodayProcessFigure />
          </Reveal>
        </Inner>
      </Band>

      {/* 02 — what it costs today */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="What it costs"
            title="One to two months and tens of thousands of dollars, before anyone has strong evidence."
            lede="The anchors are published. The person-month ranges are our planning model, labelled as modelled."
          />
          <Reveal className="mt-14">
            <PreDeploymentCostFigure />
          </Reveal>
        </Inner>
      </Band>

      {/* 03 — the boundary + the honest claim */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="Blueprint's claim boundary"
            title="A good filter is not a deployment certificate."
            lede="Blueprint narrows the trip. Real hardware still settles physical performance and safety."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-runway-line bg-runway-line lg:grid-cols-3">
            {evidenceLayers.map((layer, index) => (
              <Reveal key={layer.title} delay={index * 0.06}>
                <article className="h-full bg-runway-panel p-6 lg:p-8">
                  {index < 2 ? (
                    <Check className="h-5 w-5 text-runway-signal" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="h-5 w-5 text-runway-amber" aria-hidden="true" />
                  )}
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-runway-text">
                    {layer.title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-runway-mute">{layer.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 border-l-2 border-runway-signal pl-6 sm:pl-8">
            <p className="max-w-[62ch] text-body-l leading-8 text-runway-text">
              {theRightClaim.commercial}
            </p>
            <p className="runway-meta mt-4">The claim we make · not “six months to two weeks”</p>
          </Reveal>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="The practical result"
        title="Simulation narrows the trip. Hardware proves the deployment."
        body="Blueprint reports what fits, what fails, what is still unknown, and what the onsite pilot must settle."
        primaryHref="/how-it-works"
        primaryLabel="See how it works"
        secondaryHref="/governance"
        secondaryLabel="See data controls"
        imageSrc="/redesign/pov/cold-storage.jpg"
        imageAlt="Cold-storage workflow considered for robot deployment"
      />
    </>
  );
}
