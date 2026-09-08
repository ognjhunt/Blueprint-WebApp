/**
 * Vision — lean.
 *
 * One argument: robot capability is outrunning the ability to deploy it, so the
 * scarce thing is a site made ready for a robot. Three beats — the gap, the
 * diagnosis, the boundary — each anchored to a published figure. Forecasts stay
 * conditional; every number links to its third-party source.
 */
import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { BottleneckChainFigure, InstallationGapChart } from "@/components/site/runway/figures";
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
  bottleneckThesis,
  deploymentBoundary,
  installationTotals,
  marketSources,
} from "@/data/deploymentMarket";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=vision";

export default function Vision() {
  return (
    <>
      <SEO
        title="Vision | Deployment is the bottleneck"
        description="Robot capability is improving faster than the industry can deploy it. Blueprint's thesis: the scarce unit is a site made ready for a robot, and making those ready decides how fast robots reach real work."
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
              <span aria-hidden="true" className="runway-pulse h-1.5 w-1.5 rounded-full bg-runway-signal" />
              Vision
            </p>
            <h1 className="mt-8 max-w-[15ch] font-display uppercase text-[clamp(2.9rem,6.4vw,6.4rem)] font-semibold leading-[0.94] tracking-[0.005em] text-runway-text">
              The country that deploys fastest wins.
            </h1>
            <p className="mt-8 max-w-[46rem] text-[clamp(1rem,1.2vw,1.15rem)] leading-[1.7] text-runway-mute">
              Robots are getting good faster than anyone can put them to work. That gap is the whole
              opportunity — and right now it is being closed by someone else.
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
                label: "China's working robot stock — about five times the US base",
                source: marketSources.ifr2025,
                tone: "cyan",
              },
            ]}
          />
        </div>
      </section>

      {/* 01 — the gap */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The measurement"
            title="This is not close."
            lede="Installations are how fast a country actually puts robots on the floor. The US installs a fraction of what China does, and the gap is widening."
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
        </Inner>
      </Band>

      {/* 02 — the diagnosis */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="The diagnosis"
            title="A robot nobody has matched to a job is inventory."
            lede="For a decade the constraint has moved down this chain. It is not sitting on capability any more — it is sitting on deployment."
          />
          <div className="mt-14">
            <BottleneckChainFigure />
          </div>
          <Pullquote className="mt-16" attribution="The thesis, in one line">
            {bottleneckThesis.claim}
          </Pullquote>
        </Inner>
      </Band>

      {/* 03 — what never changes */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="What never changes"
            title="Capture first. Physical proof last."
            lede="A bigger thesis does not loosen the evidence rules. It makes them matter more."
          />
          <div className="mt-14">
            <BoundaryPanel items={deploymentBoundary} />
          </div>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="The work starts with one site"
        title="More deployments. Sooner. That's the whole goal."
        body="Bring a workflow or bring a robot. All of this only matters if the work before the pilot actually gets faster."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/how-it-works"
        secondaryLabel="See the method"
      />
    </>
  );
}
