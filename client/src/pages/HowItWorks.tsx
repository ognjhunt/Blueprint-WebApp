import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import { ClaimThresholdChart, EvidenceLadderChart } from "@/components/site/figures";
import { Reveal, ScrollProgressRail } from "@/components/site/motion";
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
  closingCta,
  homeClaimMetricLabel,
  homeClaimThreshold,
  homeClaims,
  homeEvidenceRungs,
  homeLimits,
  howItWorksSplit,
  howItWorksSteps,
} from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=how-it-works";

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How a Task Evaluation Run works | Blueprint"
        description="From one real site-task to a maintained testbed, an evidence plan chosen per claim, an answer with its limits, and the next cheapest test."
        canonical="/how-it-works"
        jsonLd={[
          webPageJsonLd({
            path: "/how-it-works",
            name: "How a Task Evaluation Run works",
            description: "The Blueprint Task Evaluation Run lifecycle, step by step.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="How it works"
        title="Six steps, and one of them is allowed to say no."
        body="One real site-task becomes a testbed we keep. One decision becomes an evidence plan built claim by claim. What comes back is an answer with its edges drawn — not a backend you chose and not a ranking we owed you."
        ctaHref={runHref}
        ctaLabel="Request a Task Evaluation Run"
        secondaryHref="/pricing"
        secondaryLabel="How pricing works"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="An inspection bench task at a real working site"
        imageCaption="Real site · captured substrate"
        routeTrace
      />

      {/* Stepped walkthrough, bound together by a scroll-tracked rail. */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="The walkthrough"
            title="What actually happens, in order."
            lede="Two of these steps are yours. The rest are ours, and the split is deliberate: the hardest judgement in evaluation is method selection, and that is the last thing a buyer should be holding."
          />

          <ScrollProgressRail className="mt-16 pl-8 sm:pl-12" railClassName="left-0">
            <ol className="flex flex-col gap-14">
              {howItWorksSteps.map((step, index) => (
                <Reveal as="li" key={step.title} from="up" distance={20}>
                  <div className="relative">
                    <span
                      className="absolute -left-8 top-1 flex h-3 w-3 items-center justify-center sm:-left-12"
                      aria-hidden="true"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-brass-deep ring-4 ring-canvas" />
                    </span>
                    {/* Heading and body sit side by side from lg up so the
                        stepped list uses the full measure instead of leaving
                        half the page empty. */}
                    <div className="grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div>
                        <span className="font-mono text-[11px] tracking-[0.2em] text-brass-deep">
                          Step {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mt-3 max-w-[22ch] font-display text-[clamp(1.6rem,2.6vw,2.35rem)] font-medium leading-[1.1] tracking-[-0.03em] text-ink-900">
                          {step.title}
                        </h3>
                      </div>
                      <p className="max-w-[54ch] text-[15.5px] leading-[1.75] text-ink-600 lg:self-center">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>
          </ScrollProgressRail>
        </Inner>
      </Band>

      {/* Who owns what */}
      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Who owns what"
            title="A clean line between the record and the science."
            lede="Worth knowing, because it explains why the site will never turn a refusal to decide into a winner: the site does not get a vote on the verdict."
            onInk
          />
          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div className="border-t border-white/15 pt-6">
                <h3 className="font-display text-[1.6rem] font-medium leading-[1.15] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                  The website owns the record
                </h3>
                <ul className="mt-6 space-y-3.5">
                  {howItWorksSplit.blueprint.map((item) => (
                    <li key={item} className="flex gap-3 text-[14.5px] leading-[1.65] text-ink-300">
                      <span
                        aria-hidden="true"
                        className="mt-[0.5rem] h-1 w-4 shrink-0 bg-brass opacity-70"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="border-t border-white/15 pt-6">
                <h3 className="font-display text-[1.6rem] font-medium leading-[1.15] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                  The pipeline owns the verdict
                </h3>
                <ul className="mt-6 space-y-3.5">
                  {howItWorksSplit.pipeline.map((item) => (
                    <li key={item} className="flex gap-3 text-[14.5px] leading-[1.65] text-ink-300">
                      <span
                        aria-hidden="true"
                        className="mt-[0.5rem] h-1 w-4 shrink-0 bg-brass opacity-70"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="Step 03, in a picture"
            title="Routing, and where it stops."
          />
          <Reveal className="mt-14">
            <EvidenceLadderChart rungs={homeEvidenceRungs} />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="Step 05, in a picture"
            title="How the answer gets its edges."
          />
          <Reveal className="mt-14">
            <ClaimThresholdChart
              claims={homeClaims}
              threshold={homeClaimThreshold}
              metricLabel={homeClaimMetricLabel}
            />
          </Reveal>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="Unknown states fail closed">
                If a state cannot be established, it is not treated as a pass. The
                run reports the gap rather than defaulting to the answer that
                would be more convenient.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="Derived evidence stays derived">
                Simulated, generated, and provider-produced evidence is never
                silently promoted to the status of raw capture, and none of it is a
                physical guarantee. Safety approval stays external.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <FullBleedMedia
        src="/redesign/pov/factory-conveyor.jpg"
        alt="A conveyor line in a working plant"
        eyebrow="Step 06"
        title="Then we tell you the cheapest thing left to try."
        body="When the evidence falls short, the useful output is not an apology — it is the next experiment, its cost, and whether it can be done short of putting a robot on the floor."
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader index="05" eyebrow="Where we stop" title="The limits, stated plainly." onInk />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title={closingCta.title}
        body={closingCta.body}
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=how-it-works-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/pricing"
        secondaryLabel="How pricing works"
        imageSrc="/redesign/pov/dishwasher.jpg"
        imageAlt="A commercial kitchen task environment"
      />
    </>
  );
}
