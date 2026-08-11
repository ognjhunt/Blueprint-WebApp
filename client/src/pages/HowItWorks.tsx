import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import { ClaimThresholdChart, EvidenceLadderChart } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import { RunFilm } from "@/components/site/runFilm";
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
        title="Walk the site. We build the benchmark. You get the decision."
        body="Capture one real task with an iPhone Pro or 360 camera. Blueprint reconstructs the scene, adds the task-specific variation, runs your candidates, and returns the ranking, likely failure modes, and uncertainty."
        ctaHref={runHref}
        ctaLabel="Scope a benchmark"
        secondaryHref="/pricing"
        secondaryLabel="How pricing works"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="An inspection bench task at a real working site"
        imageCaption="Real site · captured substrate"
        routeTrace
      />

      {/* 01 — the run film. This replaces the stepped prose list rather than
          adding to it: the acts are the steps, and a newcomer retains the
          machine working far better than six numbered paragraphs. */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="The walkthrough"
            title="What actually happens, in order."
            lede="Two of these are yours. The rest are ours, and the split is deliberate: the hardest judgement in evaluation is method selection, and that is the last thing a buyer should be holding."
          />
          <RunFilm className="mt-14" />
        </Inner>
      </Band>

      {/* Who owns what */}
      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Who owns what"
            title="A clean line between the record and the science."
            lede="Worth knowing, because it explains why the ranking you get is the one the evidence produced: the site collects the request and shows the result, but it does not get a vote on the verdict."
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
            eyebrow="Act 05, in a picture"
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
            eyebrow="Act 07, in a picture"
            title="How each claim gets read."
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
        eyebrow="After the answer"
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
        primaryLabel="Scope a benchmark"
        secondaryHref="/pricing"
        secondaryLabel="How pricing works"
        imageSrc="/redesign/pov/dishwasher.jpg"
        imageAlt="A commercial kitchen task environment"
      />
    </>
  );
}
