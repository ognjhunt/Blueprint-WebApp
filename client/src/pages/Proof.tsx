import { ArrowUpRight, Check, TriangleAlert } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentPipelineChart } from "@/components/site/runway/figures";
import { FigureFrame } from "@/components/site/runway/shell";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  deploymentPipelineMeta,
  marketSources,
} from "@/data/deploymentMarket";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const evidenceLayers = [
  {
    title: "Captured fact",
    body: "The site, task, objects, timing, access rules, and provenance recorded from the real workflow.",
  },
  {
    title: "Derived test",
    body: "Geometry checks, simulation, generated conditions, and provider tools used only inside their qualified scope.",
  },
  {
    title: "Physical proof",
    body: "The robot running at the real site. This is what settles onsite performance and safety—not a digital twin.",
  },
] as const;

const publicAnchors = [
  {
    label: "Six-plus-month deployment path",
    fact: "Agility's June 2026 investor presentation labels months 0–2 as Proof of Tech, months 2–3 as onsite POC, months 4–6 as a RaaS pilot, and month 6+ as the path to scale.",
    href: marketSources.agilityDeck.href,
  },
  {
    label: "What happens in months 0–2",
    fact: "Agility says it defines the win, studies layout and objects, recreates site conditions in simulation and physically at Agility, then tests and refines the workflow.",
    href: marketSources.agilityProcess.href,
  },
  {
    label: "A real early deployment took time",
    fact: "GXO announced its Digit proof of concept on December 6, 2023. Digit entered regular operations on June 5, 2024. That deployment predates Agility's formal CAP program.",
    href: marketSources.gxoAgreement.href,
  },
] as const;

export default function Proof() {
  return (
    <>
      <SEO
        title="Evidence behind the months 0–2 deployment problem | Blueprint"
        description="The primary-source timeline, illustrative economics, and proof boundaries behind Blueprint's deployment-preparation use case."
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
        body="Agility's published timeline puts workflow definition, site recreation, and robot testing before onsite integration. Blueprint automates that phase without pretending it deployed the robot."
        chips={[
          "Primary sources",
          "Illustrative prices labeled",
          "Physical proof stays physical",
        ]}
        ctaHref="/how-it-works"
        ctaLabel="See Blueprint's four steps"
        secondaryHref="/faq"
        secondaryLabel="Read the plain-English FAQ"
        imageSrc="/redesign/pov/route-scan.jpg"
        imageAlt="A real facility route used as source evidence"
        imageCaption="Captured site evidence · not deployment proof"
      />

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="The published process"
            title="Blueprint is built for the first highlighted phase."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 01"
              title="Path to scaled deployment"
              basis="illustrative"
              sources={[deploymentPipelineMeta.source, deploymentPipelineMeta.processSource]}
              caveat={deploymentPipelineMeta.caveat}
            >
              <DeploymentPipelineChart />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="The source record"
            title="Three facts. Three direct links."
          />
          <div className="mt-14 divide-y divide-runway-line border-y border-runway-line">
            {publicAnchors.map((anchor, index) => (
              <Reveal key={anchor.label} delay={index * 0.05}>
                <a
                  href={anchor.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid gap-4 py-6 sm:grid-cols-[0.32fr_0.68fr] sm:gap-10"
                >
                  <span className="flex items-start justify-between gap-3 text-body-s font-semibold text-runway-text">
                    {anchor.label}
                    <ArrowUpRight
                      className="mt-1 h-4 w-4 shrink-0 text-runway-mute group-hover:text-action"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-body-s leading-7 text-runway-mute">
                    {anchor.fact}
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="Read the money correctly"
            title="Published anchor — not a market price"
            lede="Agility's June 2026 investor model uses an illustrative ~$15,000 one-time deployment cost and ~$25,000 deployment fee per Digit. It does not publish how that cost splits between months 0–2 and onsite work, and it does not disclose a typical total site contract value."
            onInk
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-runway-line bg-runway-line sm:grid-cols-3">
            {[
              ["~$15K", "Illustrative one-time deployment cost per Digit"],
              ["~$25K", "Illustrative one-time RaaS deployment fee per Digit"],
              ["Unknown", "Published split between prep and onsite work"],
            ].map(([value, label]) => (
              <div key={value} className="bg-runway-panel p-6">
                <p className="font-mono text-title-l font-semibold text-runway-text">
                  {value}
                </p>
                <p className="mt-3 text-caption leading-6 text-runway-mute">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="Blueprint's claim boundary"
            title="A useful filter is not a deployment certificate."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-runway-line bg-runway-line lg:grid-cols-3">
            {evidenceLayers.map((layer, index) => (
              <Reveal key={layer.title} delay={index * 0.06}>
                <article className="h-full bg-runway-panel p-6 lg:p-8">
                  {index < 2 ? (
                    <Check className="h-5 w-5 text-runway-signal" aria-hidden="true" />
                  ) : (
                    <TriangleAlert
                      className="h-5 w-5 text-runway-amber"
                      aria-hidden="true"
                    />
                  )}
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-runway-text">
                    {layer.title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-runway-mute">
                    {layer.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="The practical result"
        title="Use simulation to narrow the trip. Use hardware to prove the deployment."
        body="Blueprint reports what fits, what fails, what remains unknown, and what the onsite proof of concept must settle."
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
