import { ArrowUpRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import { ClaimThresholdChart, EvidenceLadderChart } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  FullBleedMedia,
  Inner,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyEvaluationBoundary,
  robotPolicyResearchSignals,
  robotPolicyResearchSignalsNote,
} from "@/data/robotPolicyEvaluationClaims";
import {
  closingCta,
  homeClaimMetricLabel,
  homeClaimThreshold,
  homeClaims,
  homeEvidenceRungs,
  homeLimits,
} from "@/data/publicSiteCopy";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=task-evaluation-run&path=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=proof";

const sourceLayers = [
  {
    label: "Raw capture",
    body:
      "Timestamps, poses, rights and privacy records. This is the source of truth, and nothing derived from it is allowed to outrank it.",
  },
  {
    label: "Derived evidence",
    body:
      "Simulation, generated observations, provider tools. Useful, bounded, and always labelled as derived — never quietly promoted to fact.",
  },
  {
    label: "Physical outcomes",
    body:
      "Results from real hardware. The only thing that settles a physical claim, joined back to the exact decision and testbed version it belongs to.",
  },
];

const faqEntries = [
  {
    question: "Does the 0.929 figure mean Blueprint claims 93% accuracy?",
    answer:
      "No. SC3-Eval reports a 0.929 closed-loop Pearson correlation across seven VLA policies. That is published third-party research about a category of method. It is not a Blueprint result, not an accuracy guarantee, and not a claim about your site.",
  },
  {
    question: "What does a Task Evaluation Run actually return?",
    answer:
      "An outcome per claim, the evidence method behind each and why it was chosen, what it measured, the conditions the answer holds under, uncertainty, any disagreement between methods, the strongest claim the evidence permits, the cheapest next test, whether physical evidence is required, and exact artifact provenance. A ranking appears only when the evidence supports one.",
  },
];

export default function Proof() {
  return (
    <>
      <SEO
        title="Proof boundaries | Blueprint"
        description="What Blueprint treats as evidence, what it treats as support, and the claims it will not make on either."
        canonical="/proof"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.rolloutStrip}`}
        jsonLd={[
          webPageJsonLd({
            path: "/proof",
            name: "Blueprint proof boundaries",
            description:
              "How Blueprint separates raw capture from derived evidence and physical outcomes, and which claims it declines to make.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Proof", path: "/proof" },
          ]),
          faqJsonLd(faqEntries),
        ]}
      />

      <PageHero
        eyebrow="Proof boundaries"
        title="Proof stays scoped."
        body="Every number a run returns carries the conditions it was measured under. Outside them it is not a weaker claim — it is not a claim. This page is the short version of what we will and will not say, and why."
        chips={["Raw capture outranks derived", "Research is context, not result", "Safety approval stays external"]}
        ctaHref={runHref}
        ctaLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="How it works"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="An inspection bench task at a real working site"
        imageCaption="Real capture · source of truth"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Three kinds of evidence"
            title="They are not interchangeable, and we do not let them blur."
            lede={robotPolicyEvaluationBeachhead}
            onInk
          />
          <div className="mt-14 grid gap-x-10 gap-y-10 lg:grid-cols-3">
            {sourceLayers.map((layer, index) => (
              <Reveal key={layer.label} delay={index * 0.07}>
                <div className="border-t border-white/15 pt-6">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-brass">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 font-display text-[1.5rem] font-medium leading-[1.15] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                    {layer.label}
                  </h3>
                  <p className="mt-3.5 max-w-[42ch] text-[14.5px] leading-[1.72] text-ink-300">
                    {layer.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="The boundary in practice"
            title="Where an answer stops being an answer."
            lede="The threshold, the interval, and the claim that will not resolve — this is the mechanism behind every honest no on this site."
          />
          <Reveal className="mt-14">
            <ClaimThresholdChart
              claims={homeClaims}
              threshold={homeClaimThreshold}
              metricLabel={homeClaimMetricLabel}
            />
          </Reveal>
          <Reveal className="mt-14">
            <EvidenceLadderChart rungs={homeEvidenceRungs} />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="What we cite"
            title="Research can motivate a method. It cannot stand in for a result."
            lede={robotPolicyResearchSignalsNote}
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {robotPolicyResearchSignals.map((signal, index) => (
              <Reveal key={signal.label} delay={index * 0.07}>
                <a
                  href={signal.href}
                  className="group flex h-full flex-col rounded-lg border border-line bg-white p-6 transition-colors hover:bg-inset"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-[1.5rem] font-medium leading-[1.15] tracking-[-0.03em] text-ink-900">
                      {signal.label}
                    </h3>
                    <ArrowUpRight
                      className="mt-1 h-4 w-4 shrink-0 text-ink-400 transition-colors group-hover:text-brass-deep"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-deep">
                    {signal.stat}
                  </p>
                  <p className="mt-3 text-[14px] leading-[1.7] text-ink-500">{signal.body}</p>
                </a>
              </Reveal>
            ))}
          </div>
          <div className="mt-10">
            <Reveal>
              <ProofBoundary level="warn" title="On the 0.929 figure specifically">
                SC3-Eval's published 0.929 closed-loop correlation is third-party
                research context. It is not a Blueprint result, not an accuracy
                claim, and not a statement about any site or policy of yours.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <FullBleedMedia
        src="/redesign/pov/route-scan.jpg"
        alt="A captured route through a real working site"
        eyebrow="What we do not claim"
        title="A run is evidence. It is not permission."
        body={`${robotPolicyEvaluationBoundary} A result reports metrics only inside the matched robot, task, and site envelope — and never as a safety certification.`}
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader index="04" eyebrow="Where we stop" title="The limits, stated plainly." onInk />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title={closingCta.title}
        body={closingCta.body}
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=proof-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/faq"
        secondaryLabel="Read the FAQ"
        imageSrc="/redesign/pov/cold-storage.jpg"
        imageAlt="A cold-storage aisle used as a real-site task context"
      />
    </>
  );
}
