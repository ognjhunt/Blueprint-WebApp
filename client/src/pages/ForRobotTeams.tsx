/**
 * For robot teams — lean.
 *
 * The pitch is not "more leads". A robot company with 100 buyers per available
 * robot has a qualification problem, and its binding constraint is
 * deployment-engineer weeks. Lead with that, show what arrives before the team
 * does, and show where the economics compound: retesting later software builds
 * against the same captured job.
 */
import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { AllocationFigure, RepeatEconomicsFigure } from "@/components/site/runway/figures";
import { PageHero } from "@/components/site/publicSections";
import {
  Band,
  Inner,
  MetricStrip,
  Pullquote,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import { marketSources } from "@/data/deploymentMarket";
import { robotTeamHero } from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const joinHref = "/signup/business?buyerType=robot_team&source=for-robot-teams";

const teamReceives = [
  {
    step: "01",
    title: "A task dossier",
    detail: "The workflow, objects, weights, cycle times, exceptions and the pass mark — in one standard shape.",
  },
  {
    step: "02",
    title: "A hosted testbed",
    detail: "Evaluate the job without receiving a downloadable copy of the site. Testing is not training.",
  },
  {
    step: "03",
    title: "A fit screen",
    detail: "Reach, clearance and footprint measured off the recording, before a rollout is spent on a site that will not take the robot.",
  },
  {
    step: "04",
    title: "The open questions",
    detail: "What failed, what is unresolved, and exactly what the onsite pilot still has to settle.",
  },
] as const;

export default function ForRobotTeams() {
  return (
    <>
      <SEO
        title="Real jobs at sites with budget | Blueprint for robot teams"
        description="Every job on Blueprint comes from a site with a budget and a named owner. Test against it before you send anyone onsite — then retest each software build against the same recording."
        canonical="/for-robot-teams"
        jsonLd={[
          webPageJsonLd({
            path: "/for-robot-teams",
            name: "Blueprint for robot teams",
            description:
              "Captured site tasks and standard pre-deployment evaluations for robot providers.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For robot teams", path: "/for-robot-teams" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={robotTeamHero.eyebrow}
        title={robotTeamHero.title}
        body="Tell us what your robot can do; we find matching work. The customer is qualified, the job is defined and the test is written before you fly — so your engineers commission instead of discover."
        chips={robotTeamHero.chips}
        ctaHref={joinHref}
        ctaLabel="Join the robot network"
        secondaryHref="/how-it-works"
        secondaryLabel="See the method"
        imageSrc="/generated/humanoid-readiness-2026-06-03/humanoid-warehouse-readiness-hero.png"
        imageAlt="Illustrative humanoid material-handling workflow"
        imageCaption="Illustrative task context · physical proof still required"
        routeTrace
      />

      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The real constraint"
            title="You are not short of leads. You are short of weeks."
            lede="A big contract that eats six engineers for four months can lose to a small one that needs almost no customisation."
          />
          <div className="mt-14">
            <AllocationFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="What arrives before you do"
            title="Four things your team normally spends two months building."
          />
          <Reveal className="mt-14">
            <ol className="grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
              {teamReceives.map((item) => (
                <li key={item.step} className="bg-runway-panel p-6">
                  <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold leading-6 tracking-[-0.015em] text-runway-text">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-[13px] leading-6 text-runway-mute">{item.detail}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="Where it compounds"
            title="The first run is real work. The tenth is nearly free."
            lede="Once the job is captured, a new software build skips the survey, the reconstruction and the physical setup."
          />
          <div className="mt-14">
            <RepeatEconomicsFigure />
          </div>
        </Inner>
      </Band>

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="Your place in the timeline"
            title="We prepare it. You install it and prove it."
            lede="The only published unit economics in the category put a five-figure preparation cost on each robot, before the recurring contract starts."
          />
          <MetricStrip
            className="mt-14"
            metrics={[
              {
                value: "~$15K",
                label: "Modelled deployment cost per robot, to the robot company",
                source: marketSources.agilityDeck,
                tone: "red",
              },
              {
                value: "~$8.5K",
                unit: "/mo",
                label: "Modelled recurring revenue per deployed robot",
                source: marketSources.agilityDeck,
                tone: "cyan",
              },
              {
                value: "2 of 6",
                label: "Months spent before a robot is ever crated",
                tone: "signal",
              },
              {
                value: "×1",
                label: "Times the site is recorded, instead of once per vendor",
                tone: "text",
              },
            ]}
          />
          <p className="runway-meta mt-5 max-w-[70ch] leading-5">
            Agility labels its per-robot figures management assumptions, not disclosed customer
            terms. They are charted because they are the only public unit economics in the category.
          </p>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-16 lg:py-24">
          <Pullquote attribution="Core access · no listing fee, no lead fee">
            Join, match and run standard evaluations free. You pay for exceptional compute, not for
            access.
          </Pullquote>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Before field engineering"
        title="Start with a job your team can inspect."
        body="Browse permission-matched opportunities, submit your robot spec, and use the shared recording before deciding whether the onsite pilot is worth the weeks."
        primaryHref={joinHref}
        primaryLabel="Join the robot network"
        secondaryHref="/pricing"
        secondaryLabel="See what stays free"
      />
    </>
  );
}
