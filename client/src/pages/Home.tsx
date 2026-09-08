/**
 * Home — the boundary, stated once, and nothing more.
 *
 * Blueprint owns the site. The robot company owns the robot. The page is short
 * on purpose: the thesis, the boundary, why it takes months, and the two doors.
 * No jargon detours, no figure that does not carry the argument.
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
import { deploymentPipelineMeta, theRightClaim } from "@/data/deploymentMarket";
import {
  identity,
  preShipmentWork,
  promise,
  robotCompanyWork,
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
        description="Robots are getting good fast. Getting one working at your site is still slow, manual and expensive — and almost all of that work happens before the robot ships. Blueprint does it once, up front."
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
        eyebrow="The work before the robot ships"
        title={`${identity.headline} ${identity.subhead}`}
        titleLines={[identity.headline, identity.subhead]}
        body="Robots are getting good fast. Getting one working at your site is still slow, manual and expensive — and almost all of that work happens before the robot arrives. Blueprint does it once, so the real robot only shows up for the tests that need it."
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
            label: "Times the site is recorded, however many teams evaluate it",
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

          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="bg-runway-black p-7 lg:p-9">
              <p className="runway-eyebrow">Blueprint does this, before the robot ships</p>
              <ul className="mt-7 grid gap-3">
                {preShipmentWork.map((group) => (
                  <li
                    key={group.id}
                    className="flex gap-[10px] text-[14px] leading-[1.55] text-runway-body"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-runway-signal"
                    />
                    {group.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-runway-black p-7 lg:p-9">
              <p className="runway-eyebrow-muted">{robotCompanyWork.label}</p>
              <ul className="mt-7 grid gap-[10px]">
                {robotCompanyWork.items.map((item) => (
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

      {/* 02 ─────────────────────────────────── why it takes months */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="Why it takes months"
            title="Two of the six months happen before the robot is crated."
            lede="The only published programme puts a third of the timeline before anything ships. That third is the part Blueprint does."
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

          <Pullquote className="mt-14">{theRightClaim.commercial}</Pullquote>
        </Inner>
      </Band>

      {/* ─────────────────────────────────────────────────── both sides */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <div className="grid gap-px border border-runway-line bg-runway-line lg:grid-cols-2">
            <Reveal className="bg-runway-black p-8 lg:p-10">
              <div>
                <p className="runway-eyebrow">For sites</p>
                <h3 className="mt-5 max-w-[18ch] font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold uppercase leading-tight tracking-[0.005em] text-runway-text">
                  One recording. Every team sees the same job.
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-runway-mute">
                  Set the bar once. Compare measured results, not demo reels. Free.
                </p>
                <a className="runway-cta mt-8" href={siteHref}>
                  Submit a job
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="bg-runway-black p-8 lg:p-10">
              <div>
                <p className="runway-eyebrow-muted">For robot teams</p>
                <h3 className="mt-5 max-w-[18ch] font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold uppercase leading-tight tracking-[0.005em] text-runway-text">
                  Arrive with the robot. Not before it.
                </h3>
                <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-runway-mute">
                  The customer is qualified, the job is defined, the test is written before you fly.
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
        body="The task, the recreated site, the gaps and the pass mark — packaged before anyone flies."
        primaryHref={runHref}
        primaryLabel="Prepare a deployment"
        secondaryHref="/proof"
        secondaryLabel="Read the proof boundary"
      />
    </>
  );
}
