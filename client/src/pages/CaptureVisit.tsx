/**
 * The capture visit.
 *
 * A site operator's unspoken question is never "is this valuable" — it is "what
 * is this going to cost me operationally, and what am I on the hook for." Every
 * other page argues value. This one answers that question and does nothing
 * else.
 *
 * Three corrections to what a reader assumes, in the order the page makes them:
 *
 *   1. A capture is not booked. It is the last step of qualification, and it
 *      only happens once a task has a plausible counterparty on the robot side.
 *      Leading with the run order would imply the visit is the product.
 *   2. Blueprint sends the operator. "Handheld rig" reads as self-serve unless
 *      the opposite is said outright, so it is said outright.
 *   3. Capture runs in one metro. Silence there implies a national footprint we
 *      do not have.
 *
 * The page states no wall-clock visit duration. An earlier version did, taken
 * from a GTM draft rather than a measured capture — see the comment on
 * `visitSchedule` in `@/data/captureVisit`. What ships instead is the run
 * order, the access window we ask the site to set aside, and the one ceiling
 * that is enforced in software.
 */
import { Check, X } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { VisitScheduleFigure } from "@/components/site/runway/figures";
import { PageHero } from "@/components/site/publicSections";
import {
  Band,
  FigureFrame,
  Inner,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import {
  afterTheVisit,
  captureOperator,
  capturePasses,
  captureScope,
  normalCellNote,
  partnerNeverHasTo,
  visitConfirmation,
  visitConfirmationNote,
  visitGate,
  visitGateNote,
} from "@/data/captureVisit";
import { serviceArea } from "@/data/serviceArea";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const submitHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=capture-visit";

export default function CaptureVisit() {
  return (
    <>
      <SEO
        title="The capture visit | Blueprint"
        description="A capture is the last step of qualification, not the first step of an engagement. Once a task matches a robot team we are in talks with, Blueprint sends an operator to your Austin-metro site: one workcell, two passes, one access window. Nothing installed, nothing left behind."
        canonical="/capture-visit"
        jsonLd={[
          webPageJsonLd({
            path: "/capture-visit",
            name: "The Blueprint capture visit",
            description:
              "How a capture visit gets scheduled, what it involves for a site operator, and what is confirmed in writing before anyone travels.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "The capture visit", path: "/capture-visit" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="The capture visit"
        title="We come to you. One access window. Nothing left behind."
        body="A capture happens only after your task matches a robot team we are actually in conversation with. When it does, we send a trained operator with a 360 camera and phone rig — one workcell, two passes, and a named escort from your team. This is the only part of the service your site physically experiences."
        chips={["Match first, then capture", "We send the operator", "Austin metro"]}
        ctaHref={submitHref}
        ctaLabel="Submit a site task"
        secondaryHref="/governance"
        secondaryLabel="See data controls"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="A working cell being captured for robot evaluation"
        imageCaption="One workcell · not the facility"
      />

      {/* 01 ── the gate, because the visit is not the starting point */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="How a visit gets scheduled"
            title="Capture is the last step of qualification."
            lede="Not the first step of an engagement. The intake filters, the call qualifies, and the match decides. Any one of them can end in an honest no."
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4">
            {visitGate.map((stage, index) => (
              <Reveal key={stage.id} as="li" delay={index * 0.06} className="bg-runway-panel p-7">
                <div className="flex h-full flex-col">
                  <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                    {`0${index + 1}`}
                  </span>
                  <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.025em] text-runway-text">
                    {stage.stage}
                  </h2>
                  <p className="mt-3 text-[13px] leading-6 text-runway-mute">{stage.what}</p>
                  <p className="runway-meta mt-auto pt-6 leading-5 text-runway-faint">
                    → {stage.outcome}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={0.28} className="mt-10 border-t border-runway-line pt-8">
            <div className="grid gap-x-14 gap-y-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <h3 className="text-[clamp(1.3rem,2.2vw,1.75rem)] font-semibold leading-[1.15] tracking-[-0.035em] text-runway-text">
                {visitGateNote.claim}
              </h3>
              <p className="max-w-[56ch] self-center text-[14px] leading-[1.75] text-runway-mute">
                {visitGateNote.detail}
              </p>
            </div>
          </Reveal>
        </Inner>
      </Band>

      {/* 02 ── the day itself */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="The day"
            title="Here is the whole visit, in order."
            lede="Two passes with a QA review before we leave. The highlighted steps are the only ones where someone from your team is needed."
          />
          <Reveal className="mt-14">
            <FigureFrame label="Fig. 01" title="Capture-day run order">
              <VisitScheduleFigure />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      {/* 03 ── what is captured */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="What is captured"
            title={captureScope.claim}
            lede={captureScope.detail}
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-2">
            {capturePasses.map((pass, index) => (
              <Reveal key={pass.id} as="li" delay={index * 0.06} className="bg-runway-panel p-7">
                <div>
                  <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                    {`0${index + 1}`}
                  </span>
                  <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.025em] text-runway-text">
                    {pass.name}
                  </h2>
                  <p className="mt-3 text-[13.5px] leading-6 text-runway-mute">{pass.detail}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <p className="runway-meta mt-5 max-w-[70ch] leading-5">
            The clean-background pass runs first. The two passes are registered against each
            other, so the pair is the input — not two separate recordings.
          </p>
        </Inner>
      </Band>

      {/* 04 ── who actually does the capture, and where */}
      <Band tone="deep" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="Who does the capture"
            title={captureOperator.claim}
            lede={captureOperator.detail}
          />
          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-2">
            {captureOperator.contrast.map((side, index) => (
              <Reveal key={side.label} delay={index * 0.06} className="bg-runway-panel p-7 lg:p-9">
                <div>
                  <span
                    className={
                      index === 0
                        ? "runway-meta text-runway-signal"
                        : "runway-meta text-runway-faint"
                    }
                  >
                    {side.label}
                  </span>
                  <p className="mt-4 text-[15px] leading-[1.7] text-runway-text">{side.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.16} className="mt-10 border-t border-runway-line pt-10">
            <div className="grid gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <span className="runway-meta text-runway-faint">Where we operate</span>
                <h3 className="mt-4 text-[clamp(1.5rem,2.4vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-runway-text">
                  {serviceArea.claim}
                </h3>
              </div>
              <div>
                <p className="max-w-[52ch] text-[14px] leading-[1.75] text-runway-mute">
                  {serviceArea.detail}
                </p>
                <p className="mt-4 max-w-[52ch] text-[13px] leading-[1.7] text-runway-faint">
                  {serviceArea.outside}
                </p>
              </div>
            </div>
          </Reveal>
        </Inner>
      </Band>

      {/* 05 ── the pre-travel gate that keeps the day from going wrong */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="Before anyone travels"
            title="Six lines, confirmed in writing."
            lede={visitConfirmationNote.claim}
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-3">
            {visitConfirmation.map((line, index) => (
              <Reveal key={line.id} as="li" delay={index * 0.05} className="bg-runway-panel p-6">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                      {`0${index + 1}`}
                    </span>
                    <h2 className="text-[15.5px] font-semibold leading-6 tracking-[-0.02em] text-runway-text">
                      {line.field}
                    </h2>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-runway-mute">{line.detail}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.3} className="mt-8">
            <p className="max-w-[70ch] text-[14px] leading-[1.75] text-runway-mute">
              {visitConfirmationNote.detail}
            </p>
          </Reveal>
        </Inner>
      </Band>

      {/* 06 ── after */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="06"
            eyebrow="What happens next"
            title="The build starts the same day."
          />
          <Reveal className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-3">
            <div className="bg-runway-panel p-7">
              <p className="runway-meta">Immediately</p>
              <p className="mt-4 text-[14px] leading-6 text-runway-text">{afterTheVisit.start}</p>
            </div>
            <div className="bg-runway-panel p-7">
              <p className="runway-meta text-runway-signal">Capture to report</p>
              <p className="runway-num mt-4 text-[1.9rem] leading-none text-runway-signal">
                {afterTheVisit.turnaround}
              </p>
              <p className="mt-3 text-[12.5px] leading-6 text-runway-faint">
                {afterTheVisit.turnaroundQualifier}
              </p>
            </div>
            <div className="bg-runway-panel p-7">
              <p className="runway-meta">Throughout</p>
              <p className="mt-4 text-[14px] leading-6 text-runway-text">{afterTheVisit.contact}</p>
            </div>
          </Reveal>
        </Inner>
      </Band>

      {/* 07 ── the objection killer */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="07"
            eyebrow="What you never have to do"
            title="A normal working cell is the correct input."
            lede={normalCellNote}
          />
          <ul className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-3">
            {partnerNeverHasTo.map((item, index) => (
              <Reveal
                key={item}
                as="li"
                delay={index * 0.05}
                className="flex items-start gap-3 bg-runway-panel p-6"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-runway-line text-runway-faint">
                  <X className="h-3 w-3" aria-hidden="true" />
                </span>
                <span className="text-[13.5px] leading-6 text-runway-mute">{item}</span>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.25} className="mt-10 flex items-start gap-3 border-t border-runway-line pt-8">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-runway-signal text-runway-signal">
              <Check className="h-3 w-3" aria-hidden="true" />
            </span>
            <p className="max-w-[64ch] text-[14.5px] leading-[1.75] text-runway-text">
              What you do bring: one specific task at one station, and the person who can say
              what counts as success.
            </p>
          </Reveal>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Before anything is scheduled"
        title="Describe the workflow first."
        body="Nothing is captured until the task is scoped, matched to a robot team, and the no-capture list and consent are agreed in writing. Start with the workflow, not with a date."
        primaryHref={submitHref}
        primaryLabel="Submit a site task"
        secondaryHref="/governance"
        secondaryLabel="See how the data is handled"
      />
    </>
  );
}
