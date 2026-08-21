import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentComparison } from "@/components/site/DeploymentComparison";
import { DeploymentTimeline } from "@/components/site/DeploymentTimeline";
import { DeploymentWorkPackage } from "@/components/site/DeploymentWorkPackage";
import { KineticBenchmark } from "@/components/site/KineticBenchmark";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  SectionHeader,
} from "@/components/site/publicSections";
import { deploymentPrepBoundaries } from "@/data/deploymentPrep";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const siteHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=home";
const robotHref = "/signup/business?buyerType=robot_team&source=home";

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Automate months 0–2 of robot deployment"
        description="Capture one real workflow, rebuild it as a secure testbed, and test robot fit before the OEM sends people or hardware onsite."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint deployment preparation",
            description:
              "A capture-first Task Evaluation Run for the discovery, recreation, and robot-fit work that happens before onsite deployment.",
          }),
        ]}
      />

      <KineticBenchmark />

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="The industry path"
            title="A leading robot OEM puts two months before the robot reaches your site."
            lede="Agility publicly describes a 6+ month path to scaled deployment. Blueprint focuses on the first box: define the task, recreate the conditions, test fit, and prepare the handoff."
          />
          <Reveal className="mt-14">
            <DeploymentTimeline />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Blueprint vs. doing it yourself"
            title="Do the work once—not again for every robot company."
            lede="The usual process repeats discovery, modeling, and testing inside each vendor relationship. Blueprint turns that work into one controlled reference."
          />
          <Reveal className="mt-14">
            <DeploymentComparison />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="The product"
            title="One workflow becomes one robot-ready work package."
            lede="The public product is one Task Evaluation Run. The testbed, simulation, permissions, and report are the machinery inside it."
          />
          <Reveal className="mt-14">
            <DeploymentWorkPackage />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="The line we keep"
            title="Prepare the deployment. Do not pretend you deployed the robot."
            lede="Blueprint moves discovery and evaluation upstream. The physical work still has an owner."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 lg:grid-cols-3">
            {deploymentPrepBoundaries.map((boundary, index) => (
              <Reveal key={boundary.title} delay={index * 0.06}>
                <article className="h-full bg-ink p-6 lg:p-8">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-brass">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-6 text-title-m font-semibold tracking-tight text-white">
                    {boundary.title}
                  </h3>
                  <p className="mt-3 text-body-s leading-7 text-ink-300">
                    {boundary.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <section className="bg-action text-white">
        <div className="mx-auto grid max-w-[94rem] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-20">
          <div>
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-white/70">
              Start with either side
            </p>
            <h2 className="mt-4 max-w-[18ch] text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
              Bring the task or bring the robot.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-ink-900"
              href={siteHref}
            >
              Submit a site task{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/40 px-6 font-semibold text-white"
              href={robotHref}
            >
              Join as a robot team
            </a>
          </div>
        </div>
      </section>

      <ClosingCta
        eyebrow="The first onsite visit"
        title="Use it to validate—not to discover."
        body="Blueprint packages the task, testbed, gaps, and acceptance criteria before the robot provider begins onsite commissioning."
        primaryHref="/how-it-works"
        primaryLabel="See the four steps"
        secondaryHref="/proof"
        secondaryLabel="Read the proof boundary"
        imageSrc="/redesign/pov/packing-cell.jpg"
        imageAlt="A packing workflow prepared for robot evaluation"
      />
    </>
  );
}
