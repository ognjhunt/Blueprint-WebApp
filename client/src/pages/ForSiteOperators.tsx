/**
 * For site operators — lean.
 *
 * The operator's real question is "will anyone send me a robot, and what do I
 * have to do to be worth sending one to." So: show the job, set the rules, see
 * who fits — then the biggest reason to do this at all, which is not paying for
 * the wrong physical pilot.
 */
import { LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { AvoidWrongPilotFigure, QualifyingGatesFigure } from "@/components/site/runway/figures";
import { PageHero } from "@/components/site/publicSections";
import {
  Band,
  BoundaryPanel,
  Inner,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import { deploymentBoundary } from "@/data/deploymentMarket";
import { qualifyingStandard } from "@/data/qualifyingEnvironments";
import { siteOperatorHero } from "@/data/publicSiteCopy";
import { serviceArea } from "@/data/serviceArea";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const submitHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=for-site-operators";

const siteSteps = [
  {
    title: "Show the job",
    body: "A phone video, plans, throughput, the exceptions — and a guided scan where one is available.",
    Icon: ScanSearch,
  },
  {
    title: "Set the rules",
    body: "Restricted areas, allowed uses, approved viewers, and whether anyone ever tests on your floor.",
    Icon: LockKeyhole,
  },
  {
    title: "See who fits",
    body: "Which robot types fit, what stays unknown, and which teams have earned deeper access.",
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
        body="Tell us one real job. We record it once and run every qualified team against the same test, so you compare measured results instead of demo reels — before anyone visits your floor."
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
            lede="You don't need to pick a robot to start. You just need to know the job."
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
          <Reveal className="mt-8 border-t border-runway-line pt-6">
            <p className="max-w-[68ch] text-[13.5px] leading-[1.7] text-runway-mute">
              {serviceArea.claim} {serviceArea.detail}
            </p>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="Progressive access"
            title="Robot teams see more only as they earn it."
            lede="Permission to test is not permission to train. The site model is never a download."
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
            {accessLevels.map((level, index) => (
              <Reveal key={level.step} as="li" delay={index * 0.06} className="bg-runway-panel p-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                      {level.step}
                    </span>
                    <span aria-hidden="true" className="h-px flex-1 bg-runway-line" />
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
            index="04"
            eyebrow="Why it's worth it"
            title="The point is not speed. It is not paying for the wrong pilot."
          />
          <div className="mt-14">
            <AvoidWrongPilotFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="Where Blueprint stops"
            title="The robot provider still owns onsite deployment."
          />
          <div className="mt-14">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Start with the job · $0 to submit"
        title="You don't need a robot vendor to begin."
        body="Describe the workflow, the conditions, what counts as success, and the access rules. We'll tell you what can be screened now and what evidence is still missing."
        primaryHref={submitHref}
        primaryLabel="Submit a job"
        secondaryHref="/pricing"
        secondaryLabel="See how pricing works"
      />
    </>
  );
}
