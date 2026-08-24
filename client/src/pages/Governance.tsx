/**
 * Site data controls.
 *
 * This page is read by the operations lead and by the counsel they forward it
 * to, and it is held to a harder standard than the rest of the public copy:
 * every control it names was read in the pipeline source before it was written
 * here, and each one carries the module that enforces it so a sceptical reader
 * can re-check rather than trust us. See `client/src/data/dataHandling.ts` for
 * the verification note and the two claims that were deliberately reworded.
 *
 * The limits section is not an appendix. A trust page with no stated limits is
 * a trust page nobody in a procurement seat believes, so "we do not hold SOC 2"
 * gets the same visual weight as any promise above it.
 *
 * Two sections answer a different question from the controls: the controls say
 * what happens to the data, while permission granularity and egress say what a
 * robot team is allowed to *do* with an evaluation and what they actually
 * receive. Both predate this rewrite and are load-bearing — a provider may be
 * allowed to test an existing policy without being allowed to train on the
 * site's videos, objects, or process behaviour.
 */
import { Check, LockKeyhole, ShieldCheck, X } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  DataControlsFigure,
  HonestEdgesFigure,
} from "@/components/site/runway/figures";
import { PageHero } from "@/components/site/publicSections";
import {
  Band,
  Inner,
  Pullquote,
  RunwayCta,
  SectionHead,
} from "@/components/site/runway/shell";
import {
  accessLadder,
  accessLadderNote,
  closingNote,
  dataEgress,
  dataNeverDone,
  evaluationPermissions,
  permissionsNote,
  verificationNote,
} from "@/data/dataHandling";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const submitHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=governance";

export default function Governance() {
  return (
    <>
      <SEO
        title="Site data controls | Blueprint"
        description="Consent that fails closed, suppression proven against the source artifact, hosted-not-downloadable site files, and revocation that reaches what already shipped. Every control named here is enforced in the pipeline, with its limits stated."
        canonical="/governance"
        jsonLd={[
          webPageJsonLd({
            path: "/governance",
            name: "Blueprint site data controls",
            description:
              "How Blueprint handles captured site data: consent, suppression, hosting, revocation, provenance, and the limits of each.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Site data controls", path: "/governance" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Site data controls"
        title="Let robot teams test the site without giving them the site."
        body="Written for the operations lead and the counsel who will ask. Every mechanism below is enforced in the pipeline rather than in a policy binder — several of them block our own runs when a record is missing."
        chips={["Consent fails closed", "Hosted, not downloadable", "Revocable after delivery"]}
        ctaHref={submitHref}
        ctaLabel="Submit a site task"
        secondaryHref="/capture-visit"
        secondaryLabel="See the capture visit"
        imageSrc="/redesign/pov/loading-dock.jpg"
        imageAlt="A working site under controlled capture scope"
        imageCaption="One workcell · scope agreed in writing"
      />

      {/* 01 ── the controls */}
      <Band tone="black" rule grid>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The controls"
            title="Six mechanisms, and what enforces each one."
            lede={verificationNote.claim}
          />
          <div className="mt-14">
            <DataControlsFigure />
          </div>
          <Reveal className="mt-8">
            <p className="max-w-[70ch] text-[14px] leading-[1.75] text-runway-mute">
              {verificationNote.detail}
            </p>
          </Reveal>
        </Inner>
      </Band>

      {/* 02 ── progressive access */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="02"
            eyebrow="Progressive access"
            title="More detail only when the opportunity earns it."
            lede={accessLadderNote}
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-5">
            {accessLadder.map((tier, index) => (
              <Reveal key={tier.tier} as="li" delay={index * 0.05} className="bg-runway-panel p-6">
                <div>
                  <span className="runway-num text-[11px] tracking-[0.18em] text-runway-signal">
                    {tier.tier}
                  </span>
                  <h3 className="mt-4 text-[15.5px] font-semibold leading-6 tracking-[-0.02em] text-runway-text">
                    {tier.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-6 text-runway-mute">{tier.detail}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Inner>
      </Band>

      {/* 03 ── permission granularity */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="03"
            eyebrow="Evaluation is not training"
            title="Four permissions. Four different values."
            lede={permissionsNote}
          />
          <div className="mt-14 divide-y divide-runway-line border-y border-runway-line">
            {evaluationPermissions.map((item, index) => (
              <Reveal key={item.permission} delay={index * 0.04}>
                <div className="grid gap-3 py-5 sm:grid-cols-[0.34fr_0.66fr] sm:gap-10">
                  <h3 className="flex items-center gap-3 text-[14.5px] font-semibold text-runway-text">
                    {index === 0 ? (
                      <Check className="h-4 w-4 shrink-0 text-runway-green" aria-hidden="true" />
                    ) : (
                      <LockKeyhole className="h-4 w-4 shrink-0 text-runway-signal" aria-hidden="true" />
                    )}
                    {item.permission}
                  </h3>
                  <p className="text-[14px] leading-[1.75] text-runway-mute">{item.question}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      {/* 04 ── egress */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="04"
            eyebrow="The control model"
            title="What stays inside. What may come out."
          />
          <div className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-2">
            <Reveal as="article" className="bg-runway-panel p-7 lg:p-9">
              <div>
                <ShieldCheck className="h-6 w-6 text-runway-green" aria-hidden="true" />
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.03em] text-runway-text">
                  {dataEgress.inside.title}
                </h3>
                <p className="mt-4 text-[14px] leading-[1.75] text-runway-mute">
                  {dataEgress.inside.detail}
                </p>
              </div>
            </Reveal>
            <Reveal as="article" delay={0.06} className="bg-runway-panel p-7 lg:p-9">
              <div>
                <X className="h-6 w-6 text-runway-amber" aria-hidden="true" />
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.03em] text-runway-text">
                  {dataEgress.returned.title}
                </h3>
                <p className="mt-4 text-[14px] leading-[1.75] text-runway-mute">
                  {dataEgress.returned.detail}
                </p>
              </div>
            </Reveal>
          </div>
        </Inner>
      </Band>

      {/* 05 ── the negative space */}
      <Band tone="black" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="05"
            eyebrow="What we never do"
            title="Evaluation is the product. Not data harvesting."
          />
          <ol className="mt-14 grid gap-px border border-runway-line bg-runway-line lg:grid-cols-3">
            {dataNeverDone.map((item, index) => (
              <Reveal key={item} as="li" delay={index * 0.06} className="bg-runway-panel p-7">
                <div>
                  <span className="runway-meta text-runway-faint">Never</span>
                  <p className="mt-4 text-[13.5px] leading-[1.7] text-runway-mute">{item}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </Inner>
      </Band>

      {/* 06 ── the limits, at full weight */}
      <Band tone="deep" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="06"
            eyebrow="The honest edges"
            title="What we do not claim."
            lede="A trust page with no stated limits is one nobody in a procurement seat believes. These are ours."
          />
          <div className="mt-14">
            <HonestEdgesFigure />
          </div>
          <Pullquote className="mt-16" attribution="The design principle">
            A control that only fails for other people is not a control.
          </Pullquote>
        </Inner>
      </Band>

      <RunwayCta
        eyebrow="Set the boundary before capture starts"
        title="Bring your counsel to the scoping call."
        body={closingNote}
        primaryHref={submitHref}
        primaryLabel="Submit a site task"
        secondaryHref="/capture-visit"
        secondaryLabel="See the capture visit"
      />
    </>
  );
}
