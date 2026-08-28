import { Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { StructuralCompareFigure } from "@/components/site/runway/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { aboutHero } from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const principles = [
  "Capture the real workflow before choosing the evaluation method.",
  "Build only the part of the site the robot task actually needs.",
  "Keep raw site data controlled and permission every use.",
  "Report failures and unknowns instead of manufacturing a green light.",
  "Use real hardware to settle physical performance and safety claims.",
] as const;

export default function About() {
  return (
    <>
      <SEO
        title="About Blueprint | We evaluate robots for sites ready to buy"
        description="Blueprint turns the discovery and fit-testing every robot vendor repeats into one Task Evaluation Run, for sites that have a job and a budget."
        canonical="/about"
        jsonLd={[
          webPageJsonLd({
            path: "/about",
            name: "About Blueprint",
            description:
              "Why Blueprint automates the preparation work before onsite robot deployment.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={aboutHero.eyebrow}
        title={aboutHero.title}
        body={aboutHero.body}
        chips={aboutHero.chips}
        ctaHref="/how-it-works"
        ctaLabel="See the four steps"
        secondaryHref="/proof"
        secondaryLabel="Read the evidence"
        imageSrc="/redesign/robot-hero.png"
        imageAlt="Robot inside a real industrial workflow"
        imageCaption="Illustrative context · not customer proof"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-runway-signal">
                The thesis
              </p>
              <h2 className="mt-5 font-display uppercase text-[clamp(2.8rem,5vw,5.5rem)] font-semibold leading-[0.95] tracking-[0.005em] text-runway-text">
                Robot supply is scaling. The work of matching one to a job is not.
              </h2>
            </div>
            <p className="max-w-[40rem] text-body-l leading-8 text-runway-mute">
              Every new site still needs someone to understand the task,
              recreate the conditions, test fit, define success, protect the
              data, and prepare the onsite team. Blueprint makes that work
              reusable across robot providers.
            </p>
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Why a shared layer"
            title="Every robot company should not rebuild the same site from scratch."
          />
          <Reveal className="mt-14">
            <StructuralCompareFigure />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Five rules"
            title="Fast is useful only when the result stays honest."
          />
          <ul className="mt-14 divide-y divide-line border-y border-runway-line">
            {principles.map((principle, index) => (
              <Reveal key={principle} delay={index * 0.04}>
                <li className="grid gap-4 py-5 sm:grid-cols-[auto_1fr] sm:items-start">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-runway-signal/[0.08] text-runway-signal">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-body-l leading-8 text-runway-text">
                    {principle}
                  </p>
                </li>
              </Reveal>
            ))}
          </ul>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="One public product"
        title="One evaluation. One handoff to the install."
        body="The capture, testbed, simulation, permissions, and results are support layers inside the run—not separate products a buyer has to assemble."
        primaryHref="/how-it-works"
        primaryLabel="See how it works"
        secondaryHref="/pricing"
        secondaryLabel="See pricing"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Factory conveyor workflow prepared for robot evaluation"
      />
    </>
  );
}
