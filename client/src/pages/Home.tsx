/**
 * Home — the boundary, stated once.
 *
 * Blueprint owns the site. The robot company owns the robot. Every section
 * below is a consequence of that one line, and the page is deliberately short:
 * five sections, no repetition, no figure that does not carry an argument.
 */

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { DeploymentPipelineChart } from "@/components/site/runway/figures";
import { RunwayHero } from "@/components/site/runway/RunwayHero";
import {
  Band,
  FigureFrame,
  Inner,
  Pullquote,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import { deploymentPipelineMeta } from "@/data/deploymentMarket";
import {
  crossVendorRecord,
  identity,
  preShipmentWork,
  promise,
  qualifiedDeployableWorkcell,
  robotCompanyWork,
  sharedGroundTruth,
  sourcingLoop,
} from "@/data/positioning";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home";
const siteHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=home";
const robotHref = "/signup/business?buyerType=robot_team&source=home";

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Real jobs, fully specified."
        description="Blueprint finds and qualifies real automation demand, turns each job into a fully specified digital opportunity, and lets the robotics market prove who can solve it."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint deployment preparation",
            description: identity.full,
          }),
        ]}
      />

      <RunwayHero
        eyebrow="Qualified automation demand"
        title={`${identity.headline} ${identity.subhead}`}
        titleLines={[identity.headline, identity.subhead]}
        body={identity.body}
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/how-it-works"
        secondaryLabel="See the method"
        boundaryNote="Blueprint owns the site. You own the robot. Commissioning, safety sign-off and service stay with you — some of it genuinely cannot be finished until the hardware is in the building."
        readouts={[
          { value: promise.metric.target, label: promise.metric.label, tone: "signal" },
          {
            value: "2 of 6",
            label: "Months of a published deployment that happen before a robot is crated",
            tone: "cyan",
          },
          {
            value: "Once",
            label: "Times the site is captured, however many teams evaluate it",
            tone: "text",
          },
        ]}
      />

      {/* 01 ───────────────────────────────────────────── the boundary */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The boundary"
            title={promise.headline}
            lede={promise.subhead}
          />

          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="bg-runway-black p-7 lg:p-9">
              <p className="runway-eyebrow">Blueprint does this</p>
              <div className="mt-7 grid gap-7 sm:grid-cols-2">
                {preShipmentWork.map((group, index) => (
                  <Reveal key={group.id} delay={index * 0.05}>
                    <h3 className="font-display text-[15px] font-semibold uppercase tracking-[0.005em] text-runway-text">
                      {group.label}
                    </h3>
                    <ul className="mt-3 grid gap-[6px]">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="flex gap-[10px] text-[13px] leading-[1.5] text-runway-mute"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-runway-signal"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                ))}
              </div>
            </div>

            <div className="bg-runway-black p-7 lg:p-9">
              <p className="runway-eyebrow-muted">{robotCompanyWork.label}</p>
              <ul className="mt-7 grid gap-[10px]">
                {robotCompanyWork.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-[10px] text-[13.5px] leading-[1.55] text-runway-body"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-runway-faint"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-7 border-t border-runway-line pt-6 text-[13px] leading-[1.6] text-runway-faint">
                Some of it cannot be finished until the hardware is in the building. The rest is
                their technology and their liability.
              </p>
            </div>
          </div>

          <Pullquote className="mt-14" attribution={promise.metric.note}>
            {promise.metric.label} → {promise.metric.target}
          </Pullquote>
        </Inner>
      </Band>

      {/* 02 ─────────────────────────────────── what the months are worth */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="Why it takes months"
            title="Two of the six months happen before the robot is crated."
            lede="The only published programme puts a third of the timeline before anything ships."
          />
          <FigureFrame
            className="mt-14"
            label="Fig. 01"
            title="Path to scaled deployment"
            basis={deploymentPipelineMeta.basis}
            sources={[deploymentPipelineMeta.source]}
            caveat={deploymentPipelineMeta.caveat}
          >
            <DeploymentPipelineChart />
          </FigureFrame>
        </Inner>
      </Band>

      {/* 03 ────────────────────────────────────────────────── the unit */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="The unit"
            title="A qualified deployable workcell."
            lede="A workcell counts only when all eight are true."
          />
          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
            {qualifiedDeployableWorkcell.criteria.map((criterion, index) => (
              <Reveal key={criterion} delay={index * 0.04} className="bg-runway-black p-6">
                <span className="runway-num text-[11px] tracking-[0.16em] text-runway-signal">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-[14px] leading-[1.55] text-runway-body">{criterion}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-[15px] leading-[1.7] text-runway-mute">
            Fifty of these beat five thousand interested sites.
          </p>
        </Inner>
      </Band>

      {/* 04 ──────────────────────────────────────── once, not per vendor */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="Shared ground truth"
            title={sharedGroundTruth.title}
            lede={sharedGroundTruth.today}
          />
          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="bg-runway-deep p-7 lg:p-9">
              <p className="runway-eyebrow">Instead</p>
              <p className="mt-4 text-[15px] leading-[1.7] text-runway-body">
                {sharedGroundTruth.instead}
              </p>
              <p className="mt-6 border-t border-runway-line pt-6 text-[14px] leading-[1.65] text-runway-mute">
                Blueprint owns {sharedGroundTruth.blueprintOwns.toLowerCase()}
              </p>
            </div>
            <div className="bg-runway-deep p-7 lg:p-9">
              <p className="runway-eyebrow-muted">{sharedGroundTruth.keeps.label}</p>
              <ul className="mt-5 grid gap-[10px]">
                {sharedGroundTruth.keeps.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-[10px] text-[13.5px] leading-[1.55] text-runway-mute"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-runway-faint"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Inner>
      </Band>

      {/* 05 ───────────────────────────────────────────── how it sources */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="How supply is built"
            title="Robot teams say what they can do. We go find it."
            lede="Capability envelopes are the sourcing spec, not an afterthought."
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
            {sourcingLoop.map((stage, index) => (
              <Reveal key={stage.step} delay={index * 0.04} className="bg-runway-black p-6">
                <li>
                  <span className="runway-num text-[11px] tracking-[0.16em] text-runway-signal">
                    {stage.step}
                  </span>
                  <h3 className="mt-3 font-display text-[15px] font-semibold uppercase tracking-[0.005em] text-runway-text">
                    {stage.label}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.55] text-runway-mute">{stage.detail}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <div className="mt-12 border border-runway-line p-7 lg:p-9">
            <p className="runway-eyebrow">{crossVendorRecord.title}</p>
            <p className="mt-4 max-w-[74ch] text-[15px] leading-[1.7] text-runway-body">
              {crossVendorRecord.lines[1]}
            </p>
            <p className="mt-4 text-[12.5px] leading-[1.6] text-runway-faint">
              {crossVendorRecord.honesty}
            </p>
          </div>
        </Inner>
      </Band>

      {/* ─────────────────────────────────────────────────── both sides */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <div className="grid gap-px border border-runway-line bg-runway-line lg:grid-cols-2">
            <Reveal className="bg-runway-deep p-8 lg:p-10">
              <div>
                <p className="runway-eyebrow">For sites</p>
                <h3 className="mt-5 max-w-[18ch] font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold uppercase leading-tight tracking-[0.005em] text-runway-text">
                  One capture. Every team sees the same job.
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-runway-mute">
                  Set the bar once. Compare real results, not demo reels. Free.
                </p>
                <a className="runway-cta mt-8" href={siteHref}>
                  Submit a job
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="bg-runway-deep p-8 lg:p-10">
              <div>
                <p className="runway-eyebrow-muted">For robot teams</p>
                <h3 className="mt-5 max-w-[18ch] font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold uppercase leading-tight tracking-[0.005em] text-runway-text">
                  Arrive with the robot. Not before it.
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-runway-mute">
                  Customer qualified, task defined, site modelled, acceptance test written.
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
        title="Use it to commission. Not to discover."
        body="The task, the testbed, the gaps and the acceptance criteria — packaged before anyone flies."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/proof"
        secondaryLabel="Read the proof boundary"
      />
    </>
  );
}
