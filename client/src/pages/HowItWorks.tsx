/**
 * How it works — lean.
 *
 * Four steps, one screen, one boundary. Blueprint's version of months 0–2 is a
 * defined process with named steps and a named stopping point — not a consulting
 * engagement.
 */
import { SEO } from "@/components/SEO";
import { PreShipmentWork, QualifyingGatesFigure } from "@/components/site/runway/figures";
import { Band, BoundaryPanel, Inner, RunwayCta, SectionHead } from "@/components/site/runway/shell";
import { PageHero } from "@/components/site/publicSections";
import { deploymentBoundary } from "@/data/deploymentMarket";
import { qualifyingStandard } from "@/data/qualifyingEnvironments";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=how-it-works";

const blueprintSteps = [
  {
    step: "01",
    title: "Record the job",
    detail: "The work area, objects, routes, timing, exceptions and access rules. Not the whole building.",
  },
  {
    step: "02",
    title: "Rebuild it as a test",
    detail: "A secure, locked copy of the job, with the same pass mark for every robot team that takes it.",
  },
  {
    step: "03",
    title: "Run the robots",
    detail: "Rule out anything that physically will not fit — reach, clearance, footprint — then evaluate what survives.",
  },
  {
    step: "04",
    title: "Hand off the deployment",
    detail: "Shortlisted teams get the gaps, the pass mark and the onsite checklist before any hardware ships.",
  },
] as const;

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How Blueprint evaluates robots and prepares the deployment"
        description="Four steps: record a real job, rebuild it as a test, run the robots against it, and hand the winner to the install team — before anyone ships hardware."
        canonical="/how-it-works"
        jsonLd={[
          webPageJsonLd({
            path: "/how-it-works",
            name: "How Blueprint prepares a robot deployment",
            description: "The months 0–2 workflow, step by step.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="The method · the work before the robot ships"
        title="Record the job. Rebuild it. Run the robots. Hand it off."
        body="The work a robot company normally figures out from scratch, done once and packaged. Four steps, one secure record, no downloadable copy of your site."
        chips={["One workflow", "One secure test", "One onsite checklist"]}
        ctaHref={runHref}
        ctaLabel="Prepare a deployment"
        secondaryHref="/pricing"
        secondaryLabel="See pricing"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="A real inspection workflow prepared for robot evaluation"
        imageCaption="Before the robot arrives"
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
            eyebrow="The screen"
            title="Four questions, asked before anyone travels."
            lede={qualifyingStandard.claim}
          />
          <div className="mt-14">
            <QualifyingGatesFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="The honest boundary"
            title="We stop where the install begins."
          />
          <div className="mt-14">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Before the truck rolls"
        title="Give the deployment team a real starting point."
        body="Bring the workflow or bring the robot. We build the missing half."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/proof"
        secondaryLabel="See what counts as proof"
      />
    </>
  );
}
