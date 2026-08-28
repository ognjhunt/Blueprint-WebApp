/**
 * For site operators.
 *
 * The operator's real question is not "which robot should I buy" — it is
 * "will anyone send me one, and what do I have to do to be worth sending one
 * to." So the page is organised around queue position: robot capacity is
 * allocated, not merely sold, and a site that arrives already captured,
 * modelled, and screened is cheaper to say yes to than one that arrives as a
 * phone call.
 *
 * The access ladder is given its own section because the objection that kills
 * these conversations is never price. It is "I am not handing my facility
 * model to eight vendors."
 */
import { LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  AllocationFigure,
  DeploymentPipelineChart,
  QualifyingGatesFigure,
  QualifyingMatrixFigure,
  StructuralCompareFigure,
} from "@/components/site/runway/figures";
import { PageHero } from "@/components/site/publicSections";
import {
  Band,
  BoundaryPanel,
  FigureFrame,
  Inner,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import { deploymentBoundary, deploymentPipelineMeta } from "@/data/deploymentMarket";
import { qualifyingStandard } from "@/data/qualifyingEnvironments";
import { siteOperatorHero } from "@/data/publicSiteCopy";
import { serviceArea } from "@/data/serviceArea";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const submitHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=for-site-operators";

const siteSteps = [
  {
    title: "Show the job",
    body: "Phone video, plans, measurements, throughput, exceptions — and a guided scan where one is available.",
    Icon: ScanSearch,
  },
  {
    title: "Set the rules",
    body: "Restricted areas, allowed uses, approved viewers, and whether physical access is ever permitted.",
    Icon: LockKeyhole,
  },
  {
    title: "Review qualified fit",
    body: "Which robot categories fit, what stays unknown, and which teams have earned deeper access.",
    Icon: ShieldCheck,
  },
] as const;

const accessLevels = [
  {
    step: "01",
    title: "Anonymous summary",
    detail: "Task type, region, operating window, rough volume. No site identity.",
  },
  {
    step: "02",
    title: "Standard benchmark",
    detail: "Object ranges, task metrics, environment class, expected throughput.",
  },
  {
    step: "03",
    title: "Controlled evaluation",
    detail: "Approved teams run approved tests. The site model stays hosted by Blueprint.",
  },
  {
    step: "04",
    title: "Shortlisted package",
    detail: "Detailed layouts and integration specifics — only for teams you have approved.",
  },
] as const;

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="Find the robot that can do your job | Blueprint for sites"
        description="Describe one real job once. We rebuild it as a test, run robot teams against it, and show you who actually fits — before anyone visits your floor."
        canonical="/for-site-operators"
        jsonLd={[
          webPageJsonLd({
            path: "/for-site-operators",
            name: "Blueprint for site operators",
            description:
              "A private workflow package and Task Evaluation Run for prospective robot deployments.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For site operators", path: "/for-site-operators" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={siteOperatorHero.eyebrow}
        title={siteOperatorHero.title}
        body={siteOperatorHero.body}
        chips={siteOperatorHero.chips}
        ctaHref={submitHref}
        ctaLabel="Submit a job"
        secondaryHref="/capture-visit"
        secondaryLabel="See the capture visit"
        imageSrc="/redesign/pov/loading-dock.jpg"
        imageAlt="A loading-dock workflow prepared for robot evaluation"
        imageCaption="One workflow · not the whole facility"
        routeTrace
      />

      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="What you do"
            title="Show the job. Set the rules. See who fits."
            lede="You do not have to pick a robot, a simulator, or an evaluation stack to start. You just have to know the job you want done."
          />
          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-3">
            {siteSteps.map(({ title, body, Icon }, index) => (
              <Reveal key={title} delay={index * 0.06} className="bg-runway-panel p-7 lg:p-8">
                <div>
                  <Icon className="h-5 w-5 text-runway-signal" aria-hidden="true" />
                  <h2 className="mt-6 text-[17px] font-semibold tracking-[-0.025em] text-runway-text">
                    {title}
                  </h2>
                  <p className="mt-3 text-[13.5px] leading-6 text-runway-mute">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="The screen"
            title="Four things decide whether a robot can work here."
            lede={qualifyingStandard.claim}
          />
          <div className="mt-14">
            <QualifyingGatesFigure />
          </div>
          <Reveal className="mt-10 border-t border-runway-line pt-8">
            <p className="max-w-[68ch] text-[14.5px] leading-[1.75] text-runway-mute">
              {qualifyingStandard.consequence}
            </p>
            <p className="mt-4 max-w-[68ch] text-[14.5px] leading-[1.75] text-runway-text">
              {qualifyingStandard.secondOrder}
            </p>
          </Reveal>

          {/*
            The fifth practical condition. A site can clear all four gates above
            and still be somewhere we cannot send an operator, so the geography
            is stated next to the screen rather than discovered on a call.
          */}
          <Reveal delay={0.12} className="mt-10 border-t border-runway-line pt-8">
            <div className="grid gap-x-14 gap-y-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div>
                <span className="runway-meta text-runway-signal">And one more</span>
                <p className="mt-3 text-[17px] font-semibold leading-[1.35] tracking-[-0.025em] text-runway-text">
                  {serviceArea.claim}
                </p>
              </div>
              <div>
                <p className="max-w-[56ch] text-[14px] leading-[1.75] text-runway-mute">
                  {serviceArea.detail}
                </p>
                <p className="mt-3 max-w-[56ch] text-[13px] leading-[1.7] text-runway-faint">
                  {serviceArea.outside}
                </p>
              </div>
            </div>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="Where it already holds"
            title="The environments that pass, and the ones that nearly do."
            lede="Each of these is somebody else's deployment, cited to show the pattern is real. The empty cells are the diagnosis: an emerging environment is one that misses a specific gate."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 01"
              title="Documented environments against the four conditions"
              caveat="The environments and their evidence are published third-party deployments, each linked below. The four columns are Blueprint's screening criteria, and the marks are Blueprint's assessment of each environment against them."
            >
              <QualifyingMatrixFigure />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="Why this decides your queue position"
            title="Robot capacity is allocated, not just sold."
            lede="A robot company weighs these four things before it commits deployment engineers. A captured, screened site answers all four before the first call."
          />
          <div className="mt-14">
            <AllocationFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="Progressive access"
            title="Robot teams see more only as they earn it."
            lede="Permission to test is not permission to train. The site model is never a download."
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
            {accessLevels.map((level, index) => (
              <Reveal
                key={level.step}
                as="li"
                delay={index * 0.06}
                className="bg-runway-panel p-6"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                      {level.step}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-runway-line"
                    />
                    <LockKeyhole className="h-3.5 w-3.5 text-runway-faint" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold leading-6 tracking-[-0.015em] text-runway-text">
                    {level.title}
                  </h3>
                  <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">{level.detail}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="06"
            eyebrow="Why not do it yourself"
            title="Stop explaining the same job to every vendor."
          />
          <div className="mt-14">
            <StructuralCompareFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="07"
            eyebrow="Where Blueprint stops"
            title="The robot provider still owns onsite deployment."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 02"
              title="Path to scaled deployment"
              basis="illustrative"
              sources={[deploymentPipelineMeta.source]}
              caveat={deploymentPipelineMeta.caveat}
            >
              <DeploymentPipelineChart />
            </FigureFrame>
          </Reveal>
          <div className="mt-8">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Start with the job · $0 to submit"
        title="You don't need a robot vendor to begin."
        body="Describe the workflow, the operating conditions, the success criteria, and the access rules. Blueprint will tell you what can be screened now and what evidence is still missing."
        primaryHref={submitHref}
        primaryLabel="Submit a job"
        secondaryHref="/pricing"
        secondaryLabel="See how pricing works"
      />
    </>
  );
}
