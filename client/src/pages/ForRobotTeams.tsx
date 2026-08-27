/**
 * For robot teams.
 *
 * The pitch is deliberately not "more leads." A robot company with 100 credible
 * buyers per available robot does not have a lead problem — it has a
 * qualification problem, and its binding constraint is deployment-engineer
 * weeks. So this page leads with allocation: what an opportunity has to look
 * like before it is worth spending those weeks on, and what Blueprint hands
 * over so that judgement can be made before anyone travels.
 */
import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  AllocationFigure,
  CompilerFigure,
  DeploymentPipelineChart,
  ObservedDeploymentsFigure,
} from "@/components/site/runway/figures";
import { PageHero } from "@/components/site/publicSections";
import {
  Band,
  FigureFrame,
  Inner,
  MetricStrip,
  Pullquote,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import {
  deploymentPipelineMeta,
  marketSources,
  observedDeploymentsNote,
} from "@/data/deploymentMarket";
import { robotTeamHero } from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const joinHref = "/signup/business?buyerType=robot_team&source=for-robot-teams";

const teamReceives = [
  {
    step: "01",
    title: "A task dossier",
    detail:
      "Workflow, objects, weights, cycle times, exceptions, systems, and the acceptance criteria — in one standard shape.",
  },
  {
    step: "02",
    title: "A permissioned testbed",
    detail:
      "Evaluate the job without receiving unrestricted site files. Evaluation rights are not training rights.",
  },
  {
    step: "03",
    title: "A screened envelope",
    detail:
      "Reach, clearance, footprint, and sightlines measured off the capture, before a rollout is spent on a site that will not take the robot.",
  },
  {
    step: "04",
    title: "The open questions",
    detail:
      "What failed, what is unresolved, and exactly what the onsite proof of concept still has to settle.",
  },
] as const;

export default function ForRobotTeams() {
  return (
    <>
      <SEO
        title="Real jobs at sites with budget | Blueprint for robot teams"
        description="Every job on Blueprint comes from a site with a named budget, an internal owner, and a procurement path. Test against it before you send anyone onsite."
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
        body={robotTeamHero.body}
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
            lede="A larger contract that consumes six engineers for four months can lose to a smaller one that needs almost no customisation."
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
            title="The four things your team normally spends two months building."
          />
          <div className="mt-14">
            <CompilerFigure />
          </div>
          <Reveal className="mt-8">
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
            eyebrow="What it is worth"
            title="Every month removed from months 0–2 is a month of fleet revenue."
            lede="The only published unit economics in the category put a five-figure preparation cost on each robot, before the recurring contract starts."
          />
          <MetricStrip
            className="mt-14"
            metrics={[
              {
                value: "~$15K",
                label: "Modelled deployment cost per robot, to the OEM",
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
                label: "Times the site has to be discovered, instead of once per vendor",
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

      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="Your place in the timeline"
            title="We prepare it. You install it and prove it."
            lede="The handoff makes onsite work narrower and better informed. It does not claim a virtual test deployed your robot."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 01"
              title="Path to scaled deployment"
              basis="illustrative"
              sources={[deploymentPipelineMeta.source]}
              caveat={deploymentPipelineMeta.caveat}
            >
              <DeploymentPipelineChart />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 02"
              title="Elapsed time on publicly documented humanoid deployments"
              basis="published"
              caveat={observedDeploymentsNote}
            >
              <ObservedDeploymentsFigure />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="black" rule>
        <Inner className="py-16 lg:py-24">
          <Pullquote attribution="Core access · no listing fee, no lead fee">
            Join, match, and run standard evaluations free. You pay for exceptional compute, not
            for access.
          </Pullquote>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Before field engineering"
        title="Start with a job your team can inspect."
        body="Browse permission-matched opportunities, submit your robot specification, and use the shared testbed before deciding whether the onsite proof of concept is worth the weeks."
        primaryHref={joinHref}
        primaryLabel="Join the robot network"
        secondaryHref="/pricing"
        secondaryLabel="See what stays free"
      />
    </>
  );
}
