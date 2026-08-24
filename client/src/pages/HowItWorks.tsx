/**
 * How it works — the method page.
 *
 * The homepage argues that months 0–2 are the bottleneck. This page's only job
 * is to show that Blueprint's version of those two months is a defined process
 * and not a consulting engagement: named inputs, named steps, named outputs,
 * and a named stopping point.
 */
import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  CompilerFigure,
  DeploymentPipelineChart,
  PreShipmentWork,
  StructuralCompareFigure,
} from "@/components/site/runway/figures";
import {
  Band,
  BoundaryPanel,
  FigureFrame,
  Inner,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import { PageHero } from "@/components/site/publicSections";
import {
  deploymentBoundary,
  deploymentPipelineMeta,
  monthsZeroToTwo,
  monthsZeroToTwoSource,
} from "@/data/deploymentMarket";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=how-it-works";

const blueprintSteps = [
  {
    step: "01",
    title: "Capture one workflow",
    detail:
      "The task area, objects, routes, timing, exceptions, systems, and access rules. Not the whole building.",
  },
  {
    step: "02",
    title: "Build the testbed",
    detail:
      "A secure, versioned recreation of the job, with the same success criteria for every robot team that sees it.",
  },
  {
    step: "03",
    title: "Screen and evaluate",
    detail:
      "Rule out on measured envelope first — reach, clearance, footprint. Then run controlled evaluations where the evidence supports them.",
  },
  {
    step: "04",
    title: "Hand off the homework",
    detail:
      "Shortlisted teams get the gaps, the assumptions, the acceptance test, and the onsite checklist before hardware ships.",
  },
] as const;

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How Blueprint compiles a robot deployment"
        description="Four steps turn one real workflow into a secure testbed, a screened robot-fit result, and an onsite deployment handoff — before anyone ships hardware."
        canonical="/how-it-works"
        jsonLd={[
          webPageJsonLd({
            path: "/how-it-works",
            name: "How Blueprint compiles a robot deployment",
            description: "The months 0–2 workflow, step by step.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="The method · months 0–2"
        title="Capture the job. Recreate it. Test fit. Hand it off."
        body="The work a robot company normally discovers from scratch, done once and packaged. Four steps, one controlled record, no downloadable copy of your site."
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

      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The four steps"
            title="A process, not an engagement."
            lede="Same sequence every time. That is what makes the second site cheaper than the first."
          />
          <div className="mt-14">
            <PreShipmentWork steps={blueprintSteps} />
          </div>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="Inputs and outputs"
            title="One workflow in. One qualified deployment out."
            lede="A site never picks a simulator. A robot team never receives unrestricted site files. Blueprint runs the layer between them."
          />
          <div className="mt-14">
            <CompilerFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="What the OEM does in the same window"
            title="We are doing the work they would be doing."
            lede="The published preparation sequence, from the only humanoid maker that has described one in public."
          />
          <div className="mt-14">
            <PreShipmentWork steps={monthsZeroToTwo} />
          </div>
          <p className="runway-meta mt-5">
            Source ·{" "}
            <a
              href={monthsZeroToTwoSource.source.href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 transition-colors hover:text-runway-signal"
            >
              {monthsZeroToTwoSource.source.label}
            </a>
          </p>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="Where we sit"
            title="Blueprint ends where onsite deployment begins."
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

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="Why it costs less"
            title="Once per site. Not once per vendor."
          />
          <div className="mt-14">
            <StructuralCompareFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="06"
            eyebrow="The honest boundary"
            title="What Blueprint does — and what it does not."
          />
          <div className="mt-14">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Before the truck rolls"
        title="Give the deployment team a real starting point."
        body="Bring the site workflow or bring the robot. Blueprint builds the missing half into a testable, permissioned work package."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/proof"
        secondaryLabel="See what counts as proof"
      />
    </>
  );
}
