import { Check, X } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentTimeline } from "@/components/site/DeploymentTimeline";
import { DeploymentWorkPackage } from "@/components/site/DeploymentWorkPackage";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  deploymentPrepBoundaries,
  deploymentPrepSteps,
} from "@/data/deploymentPrep";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=how-it-works";

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How Blueprint prepares a robot deployment"
        description="Four steps turn one real workflow into a secure testbed, controlled robot-fit evaluation, and onsite deployment handoff."
        canonical="/how-it-works"
        jsonLd={[
          webPageJsonLd({
            path: "/how-it-works",
            name: "How Blueprint prepares a robot deployment",
            description:
              "The months 0–2 Task Evaluation Run workflow, step by step.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="How it works · months 0–2"
        title="Capture the job. Recreate it. Test fit. Hand it off."
        body="Blueprint packages the work a robot provider normally has to discover before onsite integration. Four steps, one controlled record, no downloadable site twin."
        chips={["One workflow", "One secure testbed", "One onsite checklist"]}
        ctaHref={runHref}
        ctaLabel="Prepare a deployment"
        secondaryHref="/pricing"
        secondaryLabel="See pricing"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="A real inspection workflow prepared for robot evaluation"
        imageCaption="Months 0–2 · before the robot arrives"
        routeTrace
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Four steps"
            title="The deployment homework, made repeatable."
            onInk
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 lg:grid-cols-4">
            {deploymentPrepSteps.map((step, index) => (
              <Reveal
                key={step.number}
                as="li"
                delay={index * 0.06}
                className="h-full bg-ink p-6 lg:p-7"
              >
                <div>
                  <span className="font-mono text-micro text-brass">
                    {step.number}
                  </span>
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-white">
                    {step.title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-ink-300">
                    {step.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="The work package"
            title="Simple inputs. A controlled evaluation. A useful handoff."
            lede="A site does not need to choose a simulator. A robot team does not need unrestricted access to the raw site model. Blueprint runs the common evaluation layer between them."
          />
          <Reveal className="mt-14">
            <DeploymentWorkPackage />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="Where it sits"
            title="Blueprint ends where onsite deployment begins."
          />
          <Reveal className="mt-14">
            <DeploymentTimeline />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="The honest boundary"
            title="What Blueprint does—and what it does not do."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
            {deploymentPrepBoundaries.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.06}>
                <article className="h-full bg-white p-6 lg:p-8">
                  {index === 0 ? (
                    <Check
                      className="h-5 w-5 text-proof-fg"
                      aria-hidden="true"
                    />
                  ) : (
                    <X className="h-5 w-5 text-warn-fg" aria-hidden="true" />
                  )}
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-ink-900">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-ink-500">
                    {item.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Before the truck rolls"
        title="Give the deployment team a real starting point."
        body="Bring the site workflow or the robot capability. Blueprint turns the missing half into a testable, permissioned work package."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/proof"
        secondaryLabel="See what counts as proof"
        imageSrc="/redesign/pov/packing-cell.jpg"
        imageAlt="A packing task prepared for a robot deployment team"
      />
    </>
  );
}
