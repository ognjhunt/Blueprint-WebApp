/**
 * Vision.
 *
 * The homepage sells the product. This page argues the thesis behind it, and it
 * is allowed to be longer and more speculative — but only in one direction. It
 * reasons forward from things that are already true (the installation gap, the
 * published deployment timelines, the way scarce physical capacity has been
 * allocated in four prior markets) toward a claim about where the constraint
 * goes next.
 *
 * What it must not do is dress a forecast as a measurement. Anything forward-
 * looking on this page is written as a conditional and marked as one; every
 * number is a third party's published figure with the link attached.
 */
import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  AnaloguesFigure,
  BottleneckChainFigure,
  FlywheelFigure,
  HumanoidShareFigure,
  InstallationGapChart,
  ObservedDeploymentsFigure,
  ProgramAdoptionFigure,
  RegionalShareBar,
} from "@/components/site/runway/figures";
import {
  Band,
  BoundaryPanel,
  FigureFrame,
  Inner,
  MetricStrip,
  Pullquote,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import {
  analogueLesson,
  bottleneckThesis,
  humanoidShare,
  deploymentBoundary,
  installationTotals,
  marketSources,
  observedDeploymentsNote,
} from "@/data/deploymentMarket";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=vision";

/**
 * The forward-looking part, kept explicitly conditional. Each line is a claim
 * about consequence, not a prediction with a date on it.
 */
const conditionals = [
  {
    step: "01",
    title: "If capability keeps improving",
    detail:
      "The scarce thing stops being a policy that can do the task and becomes a site that has been made ready for one.",
  },
  {
    step: "02",
    title: "Then robots get allocated",
    detail:
      "Scarce, long-lived, physically located capacity is assigned on risk-adjusted output — the way aircraft, rigs, and fab capacity already are.",
  },
  {
    step: "03",
    title: "Then readiness becomes leverage",
    detail:
      "A site that can be productive in days beats one that needs months, and it wins the allocation even at a lower rate.",
  },
  {
    step: "04",
    title: "So preparation is the choke point",
    detail:
      "Whoever makes site-and-task readiness cheap and repeatable sets how fast the whole industry can deploy.",
  },
] as const;

export default function Vision() {
  return (
    <>
      <SEO
        title="Vision | Deployment is the bottleneck"
        description="Robot capability is improving faster than the industry's ability to deploy it. Blueprint's thesis: the scarce unit is a validated robot–task–site configuration, and making those cheap decides how fast robots reach real work."
        canonical="/vision"
        jsonLd={[
          webPageJsonLd({
            path: "/vision",
            name: "Blueprint vision",
            description:
              "Why deployment preparation, not robot capability, is the binding constraint on robot adoption.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Vision", path: "/vision" },
          ]),
        ]}
      />

      <section className="relative overflow-hidden bg-runway-black">
        <div aria-hidden="true" className="runway-grid absolute inset-0 opacity-70" />
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-runway-signal/[0.08] blur-[110px]"
        />
        <div className="relative mx-auto max-w-[92rem] px-5 pb-20 pt-20 sm:px-8 lg:px-10 lg:pb-28 lg:pt-28">
          <Reveal>
            <p className="flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-runway-signal">
              <span
                aria-hidden="true"
                className="runway-pulse h-1.5 w-1.5 rounded-full bg-runway-signal"
              />
              Vision
            </p>
            <h1 className="mt-8 max-w-[15ch] text-[clamp(2.9rem,6.4vw,6.4rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-runway-text">
              The country that deploys fastest wins.
            </h1>
            <p className="mt-8 max-w-[46rem] text-[clamp(1rem,1.2vw,1.15rem)] leading-[1.7] text-runway-mute">
              Robot capability is improving faster than anyone's ability to put it to work. That
              gap is the whole opportunity — and right now it is being closed by someone else.
            </p>
          </Reveal>

          <MetricStrip
            className="mt-16"
            metrics={[
              {
                value: "295,000",
                label: "Industrial robots installed in China in 2024",
                source: marketSources.ifr2025,
                tone: "red",
              },
              {
                value: "34,200",
                label: "Installed in the United States, down 9% year over year",
                source: marketSources.ifr2025,
                tone: "signal",
              },
              {
                value: "97 of 100",
                label: "Humanoids shipped in H1 2026 that came from a Chinese maker",
                source: marketSources.sagHumanoid,
                tone: "text",
              },
              {
                value: `${(installationTotals.chinaStock / 1_000_000).toFixed(0)}M+`,
                label: "China's operational robot stock — about five times the US base",
                tone: "cyan",
              },
            ]}
          />
        </div>
      </section>

      {/* 01 ── the gap, in full */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The measurement"
            title="This is not close."
            lede="Annual installations are the flow number — how fast a country can actually put robots into production, and the capacity that gets inherited when humanoid volume arrives. On the leading edge the gap is wider still."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 01"
              title="Annual industrial-robot installations, 2024"
              basis="published"
              sources={[marketSources.ifr2025]}
              caveat={`Global installations totalled ${installationTotals.global.toLocaleString()} units across an operational stock of ${(installationTotals.globalStock / 1_000_000).toFixed(1)} million robots.`}
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
              title="Regional share of 2024 installations"
              basis="published"
              sources={[marketSources.ifr2025]}
            >
              <RegionalShareBar />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      {/* 02 ── the diagnosis */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="The diagnosis"
            title="A robot nobody has matched to a job is inventory."
            lede="The constraint has been moving down this chain for a decade. It is not sitting on capability any more."
          />
          <div className="mt-14">
            <BottleneckChainFigure />
          </div>
          <Pullquote className="mt-16" attribution="The thesis, in one line">
            {bottleneckThesis.claim}
          </Pullquote>
          <p className="mt-8 max-w-[62ch] text-[14.5px] leading-[1.75] text-runway-mute">
            {bottleneckThesis.consequence}
          </p>
        </Inner>
      </Band>

      {/* 03 ── the evidence that it is slow */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="The evidence"
            title="Every deployment in the public record took months."
            lede="Three humanoid programs have published enough to time. None of them skipped the site-specific evaluation, and none of them did it quickly."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 04"
              title="Elapsed time on publicly documented humanoid deployments"
              basis="published"
              caveat={observedDeploymentsNote}
            >
              <ObservedDeploymentsFigure />
            </FigureFrame>
          </Reveal>

          <Reveal className="mt-8">
            <FigureFrame
              label="Fig. 05"
              title="How many went through a standardised preparation program"
              basis="published"
              sources={[marketSources.agilityDeck]}
              caveat="The leading humanoid maker's own footnote. Its standardised preparation program is new enough that four of its five named commercial customers were deployed without it — one bespoke engagement at a time."
            >
              <ProgramAdoptionFigure />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      {/* 04 ── the forward argument, marked as conditional */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="The conditional"
            title="What follows if capability keeps improving."
            lede="Stated as consequences rather than predictions. Each step depends on the one before it, and the last one is the business."
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
            {conditionals.map((item, index) => (
              <Reveal
                key={item.step}
                as="li"
                delay={index * 0.07}
                className="bg-runway-panel p-6 lg:p-7"
              >
                <div>
                  <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold leading-6 tracking-[-0.02em] text-runway-text">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-6 text-runway-mute">{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Inner>
      </Band>

      {/* 05 ── precedent */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="Precedent"
            title="Scarce physical capacity has been allocated before."
            lede="Four markets already solved a version of this. Each contributes one piece of the shape — and none of them was won by a listings board."
          />
          <div className="mt-14">
            <AnaloguesFigure />
          </div>
          <Pullquote className="mt-14">{analogueLesson}</Pullquote>
        </Inner>
      </Band>

      {/* 06 ── the compounding */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="06"
            eyebrow="Why it compounds"
            title="Cheaper preparation means more pilots get tried at all."
            lede="Most automation projects die before anyone builds anything, because qualifying them costs more than the answer is worth. Lower that cost and the denominator changes."
          />
          <div className="mt-14">
            <FlywheelFigure />
          </div>
        </Inner>
      </Band>

      {/* 07 ── what never changes */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="07"
            eyebrow="What never changes"
            title="Capture first. Physical proof last."
            lede="A more ambitious thesis does not loosen the evidence rules. It makes them matter more."
          />
          <div className="mt-14">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="The work starts with one site"
        title="More deployments. Sooner. That's the whole goal."
        body="Bring a workflow or bring a robot. Everything above is only worth arguing if the first two months actually get faster."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/how-it-works"
        secondaryLabel="See the method"
      />
    </>
  );
}
