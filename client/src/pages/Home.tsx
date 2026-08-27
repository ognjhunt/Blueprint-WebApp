/**
 * The homepage.
 *
 * Structure is an argument, in order, and each step is a figure rather than a
 * paragraph:
 *
 *   01  The US is losing the deployment race, by an order of magnitude.
 *   02  The binding constraint is no longer capability. It is deployment.
 *   03  Deployment takes six-plus months, and two of them happen before the
 *       robot is crated.
 *   04  That is not a forecast — it is what every public deployment did.
 *   05  Those months cost real money, and the split is not public.
 *   06  Blueprint compiles that front half, once per site instead of once per
 *       vendor.
 *   07  Which is the whole structural claim: ×1, not ×N.
 *   08  And it compounds.
 *
 * The reader can stop after any section and still hold a complete thought. No
 * section asserts a Blueprint performance number, because Blueprint has not run
 * enough deployments to have one: the argument is built from other companies'
 * published figures and from arithmetic, which is the only honest way to make
 * it today.
 */
import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  BomVersusDeploymentFigure,
  BottleneckChainFigure,
  CompilerFigure,
  CostSplitFigure,
  DeploymentPipelineChart,
  FlywheelFigure,
  HumanoidShareFigure,
  InstallationGapChart,
  ObservedDeploymentsFigure,
  PreShipmentWork,
  ProgramAdoptionFigure,
  QualifyingGatesFigure,
  RegionalShareBar,
  StructuralCompareFigure,
  UnitEconomicsChart,
} from "@/components/site/runway/figures";
import { RunwayHero } from "@/components/site/runway/RunwayHero";
import {
  Band,
  BoundaryPanel,
  FigureFrame,
  Inner,
  Pullquote,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import {
  bottleneckThesis,
  humanoidShare,
  deploymentBoundary,
  deploymentPipelineMeta,
  installationTotals,
  marketSources,
  monthsZeroToTwo,
  monthsZeroToTwoSource,
  observedDeploymentsNote,
} from "@/data/deploymentMarket";
import { qualifyingStandard } from "@/data/qualifyingEnvironments";
import { demandQualifier, homeHero } from "@/data/publicSiteCopy";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const siteHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=home";
const robotHref = "/signup/business?buyerType=robot_team&source=home";
const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home";

/**
 * What a site has to put on the table before its job becomes an evaluation.
 * Each row is a required intake field, not a sentiment: budget range is
 * `BudgetBucket`, and the owner/procurement answers are the pilot-opportunity
 * fields. Keep them mapped that way — the band is only honest while the form
 * behind it still asks.
 */
const siteEntryBar = [
  {
    title: "A real job",
    body: "One specific workflow on one floor, with its objects, timing, shifts, and the failures the site will not accept.",
  },
  {
    title: "A budget",
    body: "A range they are prepared to spend on a pilot or deployment. Sites that will not name one do not enter the network.",
  },
  {
    title: "Someone who owns it",
    body: "A named person inside the building, a pilot area, a timeline, and the path this actually gets bought through.",
  },
] as const;

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Evaluate robots. Deploy the one that works."
        description="We record a real job at a site that has budget to fill it, rebuild it as one test every robot takes, and help get the winner deployed. Deployment is the bottleneck, not capability."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint robot evaluation and deployment",
            description:
              "Evaluating robots against one real site job and preparing the deployment — the months 0–2 work between a site with a job and a robot that can do it.",
          }),
        ]}
      />

      <RunwayHero
        eyebrow={homeHero.eyebrow}
        title={homeHero.title}
        titleLines={homeHero.titleLines}
        body={homeHero.body}
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/how-it-works"
        secondaryLabel="See the method"
        boundaryNote="We do the two months before the truck rolls. Onsite integration, commissioning, and the physical pilot stay with the robot company."
        readouts={[
          {
            value: "Every job",
            label: "Comes from a site with a budget and someone inside who owns it",
            tone: "cyan",
          },
          {
            value: "97 of 100",
            label: "Humanoids shipped in H1 2026 that came from a Chinese maker",
            tone: "red",
          },
          {
            value: "6+ mo",
            label: "Published path from first contact to scaled deployment",
            tone: "text",
          },
          {
            value: "2 of 6",
            label: "Months that happen before a robot is ever crated",
            tone: "signal",
          },
        ]}
      />

      {/* 01 ─────────────────────────────────────────────── the gap */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The gap"
            title="China ships 97 of every 100 humanoids."
            lede="Two measurements of the same race. Industrial installations show the deployment capacity a country already has; humanoid share shows the leading edge — and the gap is far wider there."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 01"
              title="Annual industrial-robot installations, 2024"
              basis="published"
              sources={[marketSources.ifr2025]}
              caveat={`Global installations totalled ${installationTotals.global.toLocaleString()} units. China's operational stock passed two million — roughly five times the US installed base.`}
            >
              <InstallationGapChart />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 02"
              title={`Humanoid shipment share, ${humanoidShare.period}`}
              basis="published"
              sources={humanoidShare.sources}
              caveat="Share of shipments by vendor nationality. Shipments are not deployments — the panel inside this figure says what the difference is and why it matters."
            >
              <HumanoidShareFigure />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 03"
              title="Where those installations went"
              basis="published"
              sources={[marketSources.ifr2025]}
            >
              <RegionalShareBar />
            </FigureFrame>
          </Reveal>

          <Pullquote className="mt-16" attribution="The reason this company exists">
            A country does not fall behind on robots because it cannot build them. It falls behind
            because it cannot deploy them fast enough.
          </Pullquote>
        </Inner>
      </Band>

      {/* 02 ─────────────────────────────────────── the bottleneck migrates */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="Where the constraint sits"
            title="Capability stopped being the hard part."
            lede="Every constraint in this chain has eased or is being funded. The one in the middle is not, and it is where the queue forms."
          />
          <div className="mt-14">
            <BottleneckChainFigure />
          </div>

          <Reveal className="mt-14 grid gap-8 border-t border-runway-line pt-12 lg:grid-cols-2 lg:gap-16">
            <p className="text-[clamp(1.3rem,2.2vw,1.85rem)] font-medium leading-[1.3] tracking-[-0.03em] text-runway-text">
              {bottleneckThesis.claim}
            </p>
            <p className="self-center text-[14.5px] leading-[1.75] text-runway-mute">
              {bottleneckThesis.consequence}
            </p>
          </Reveal>
        </Inner>
      </Band>

      {/* 03 ────────────────────────────────────────── the six-month path */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="The published path"
            title="Two of the six months happen before the robot is crated."
            lede="A leading humanoid maker put its deployment timeline in an SEC filing. The first block is preparation — and it is the block Blueprint automates."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 04"
              title="Path to scaled deployment"
              basis="illustrative"
              sources={[deploymentPipelineMeta.source, deploymentPipelineMeta.processSource]}
              caveat={deploymentPipelineMeta.caveat}
            >
              <DeploymentPipelineChart />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-16">
            <p className="runway-eyebrow-muted">Inside months 0–2</p>
            <h3 className="mt-4 max-w-[30ch] text-[clamp(1.5rem,2.6vw,2.2rem)] font-semibold leading-tight tracking-[-0.035em] text-runway-text">
              Understand the task. Recreate the place. Run the robot against it.
            </h3>
          </Reveal>
          <div className="mt-8">
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

      {/* 04 ──────────────────────────────────────────── the actual record */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="What the record shows"
            title="Nobody has done this quickly. Almost nobody has done it twice the same way."
            lede="Three deployments have enough in the public record to time. And of the five named commercial customers at the leading humanoid maker, four were deployed before it had a standardised program at all."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 05"
              title="Elapsed time on publicly documented humanoid deployments"
              basis="published"
              caveat={observedDeploymentsNote}
            >
              <ObservedDeploymentsFigure />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 06"
              title="How many went through a standardised preparation program"
              basis="published"
              sources={[marketSources.agilityDeck]}
              caveat="Agility's own footnote: of its current commercial deployments, only Mercado Libre participated in its Customer Acceleration Program. The rest pre-date it."
            >
              <ProgramAdoptionFigure />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      {/* 05 ────────────────────────────────────────────── the economics */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="The economics"
            title="Every deployment carries a five-figure preparation bill."
            lede="Per robot, per site — and the model that produces it is the only one any humanoid maker has published."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 07"
              title="Modelled per-robot deployment economics"
              basis="illustrative"
              sources={[marketSources.agilityDeck]}
              caveat="Agility labels these management assumptions, not disclosed customer terms. Charted because they are the only public unit economics in the category — not because they are a market price."
            >
              <UnitEconomicsChart />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 08"
              title="How the deployment cost splits"
              basis="illustrative"
              sources={[marketSources.agilityDeck, marketSources.agilityProcess]}
            >
              <CostSplitFigure />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 09"
              title="Building the robot vs. deploying it"
              basis="illustrative"
              sources={[marketSources.agilityDeck]}
              caveat="Bill-of-materials cost falls with manufacturing volume. Deployment cost is paid again at every site, and volume does not make an unfamiliar building easier to model."
            >
              <BomVersusDeploymentFigure />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      {/* 06 ────────────────────────────────────────────── the product */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="06"
            eyebrow="The product"
            title="One workflow in. One qualified deployment out."
            lede="A site describes its job once. Blueprint builds the testbed, screens the envelope, runs the evaluation, and hands every permitted robot team the same package."
          />
          <div className="mt-14">
            <CompilerFigure />
          </div>

          <Reveal className="mt-16 border-t border-runway-line pt-12">
            <p className="runway-eyebrow-muted">What &ldquo;qualified&rdquo; means</p>
            <h3 className="mt-4 max-w-[30ch] text-[clamp(1.5rem,2.6vw,2.2rem)] font-semibold leading-tight tracking-[-0.035em] text-runway-text">
              Four gates, checked before anyone travels.
            </h3>
            <p className="mt-4 max-w-[62ch] text-[14.5px] leading-[1.75] text-runway-mute">
              {qualifyingStandard.claim}
            </p>
          </Reveal>
          <div className="mt-8">
            <QualifyingGatesFigure compact />
          </div>
          <Reveal className="mt-6">
            <a
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-runway-signal underline-offset-4 hover:underline"
              href="/for-site-operators"
            >
              See which environments already pass
            </a>
          </Reveal>
        </Inner>
      </Band>

      {/* 07 ─────────────────────────────────────────────── the demand */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="07"
            eyebrow="Who we work with"
            title={demandQualifier.short}
            lede={demandQualifier.body}
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-runway-line bg-runway-line lg:grid-cols-3">
            {siteEntryBar.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.06}>
                <article className="h-full bg-runway-black p-6 lg:p-8">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-runway-signal">
                    0{index + 1}
                  </span>
                  <h3 className="mt-5 text-[clamp(1.35rem,2.2vw,1.9rem)] font-semibold leading-tight tracking-[-0.035em] text-runway-text">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-[1.75] text-runway-mute">
                    {item.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8">
            <p className="max-w-[62ch] text-[14.5px] leading-[1.75] text-runway-mute">
              {demandQualifier.note}
            </p>
          </Reveal>
        </Inner>
      </Band>

      {/* 08 ──────────────────────────────────────── the structural claim */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="08"
            eyebrow="Why it is cheaper"
            title="Do the work once. Not once per vendor."
            lede="Nothing here claims a faster robot. It claims the same discovery work stops being repeated inside every vendor relationship."
          />
          <div className="mt-14">
            <StructuralCompareFigure />
          </div>
        </Inner>
      </Band>

      {/* 09 ────────────────────────────────────────────── the flywheel */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="09"
            eyebrow="Why it compounds"
            title="Cheaper preparation means more pilots get tried at all."
            lede="The loop closes on the last stage: every prepared deployment sharpens what fit and failure look like, which makes the next one cheaper to prepare."
          />
          <div className="mt-14">
            <FlywheelFigure />
          </div>
        </Inner>
      </Band>

      {/* 10 ────────────────────────────────────────────── the boundary */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="10"
            eyebrow="The line we keep"
            title="Prepare the deployment. Don't pretend you deployed the robot."
          />
          <div className="mt-14">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      {/* Two-sided entry, before the single CTA. */}
      <Band tone="black" rule>
        <Inner className="py-16 lg:py-20">
          <div className="grid gap-px border border-runway-line bg-runway-line lg:grid-cols-2">
            <Reveal className="bg-runway-panel p-8 lg:p-10">
              <div>
                <p className="runway-eyebrow">For sites</p>
                <h3 className="mt-5 max-w-[18ch] text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.035em] text-runway-text">
                  You have the job. Submit it once.
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-runway-mute">
                  One capture, one testbed, one acceptance test — and you control which robot teams
                  can see it.
                </p>
                <a className="runway-cta mt-8" href={siteHref}>
                  Submit a job
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="bg-runway-panel p-8 lg:p-10">
              <div>
                <p className="runway-eyebrow-muted">For robot teams</p>
                <h3 className="mt-5 max-w-[18ch] text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.035em] text-runway-text">
                  You have the robot. Skip the discovery.
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-runway-mute">
                  Qualified opportunities that arrive with the task defined, the site modelled, and
                  the fit already screened.
                </p>
                <a className="runway-cta-ghost mt-8" href={robotHref}>
                  Join as a robot team
                </a>
              </div>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="The first onsite visit"
        title="Use it to validate. Not to discover."
        body="Blueprint packages the task, the testbed, the known gaps, and the acceptance criteria before the robot company begins onsite commissioning."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/proof"
        secondaryLabel="Read the proof boundary"
      />
    </>
  );
}
