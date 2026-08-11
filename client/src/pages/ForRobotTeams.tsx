import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  EvidenceLadderChart,
  OutcomeSpectrum,
  RankingMarginChart,
  RunLifecycleRail,
} from "@/components/site/figures";
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
import { robotPolicyEvaluationBoundary } from "@/data/robotPolicyEvaluationClaims";
import {
  closingCta,
  homeClaimMetricLabel,
  homeEvidenceRungs,
  homeLimits,
  homeOutcomes,
  homeRankingCandidates,
  homeRankingOodAxes,
  homeRankingResolutionFloorPp,
  homeRankingRolloutsPerCandidate,
  homeRankingTestbedVersion,
  robotTeamFlow,
  robotTeamHero,
  robotTeamValue,
} from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-robot-teams";
const runCtaHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-robot-teams-cta";

export default function ForRobotTeams() {
  return (
    <>
      <SEO
        title="Task Evaluation Runs for robot teams | Blueprint"
        description="Rank your own candidates in the building you are quoting: incompatibilities ruled out on measurement, the rest ordered with the margin on every gap."
        canonical="/for-robot-teams"
        jsonLd={[
          webPageJsonLd({
            path: "/for-robot-teams",
            name: "Task Evaluation Runs for robot teams",
            description: "One decision-oriented evaluation service, explained for robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For robot teams", path: "/for-robot-teams" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={robotTeamHero.eyebrow}
        title={robotTeamHero.title}
        body={robotTeamHero.body}
        chips={robotTeamHero.chips}
        ctaHref={runHref}
        ctaLabel="Scope a benchmark"
        secondaryHref="/how-it-works"
        secondaryLabel="How it works"
        imageSrc="/redesign/pov/warehouse-tote.jpg"
        imageAlt="A robot arm working a tote task in a real warehouse aisle"
        imageCaption="Illustrative task context"
        routeTrace
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="The wedge"
            title="Bring candidates. Get them screened, then ordered."
            lede="A run is organised around your decision, not around a tournament. Candidates the site will not physically take are eliminated on measurement; the rest come back ranked, and any pair the design cannot separate is named as tied rather than ordered."
            onInk
          />
          <div className="mt-14 grid gap-x-10 gap-y-10 lg:grid-cols-3">
            {robotTeamValue.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.07}>
                <div className="border-t border-white/15 pt-6">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-brass">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 font-display text-[1.5rem] font-medium leading-[1.15] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-3.5 max-w-[42ch] text-[14.5px] leading-[1.72] text-ink-300">
                    {item.body}
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
            eyebrow="What a result looks like"
            title="An order, each margin, and the gap you cannot see."
            lede="Your threshold, your units, your definition of a wrong yes. The candidates come back ordered on one pinned testbed, and every adjacent gap carries the interval that says whether it is a lead or a tie."
          />
          <Reveal className="mt-14">
            <RankingMarginChart
              candidates={homeRankingCandidates}
              rolloutsPerCandidate={homeRankingRolloutsPerCandidate}
              resolutionFloorPp={homeRankingResolutionFloorPp}
              testbedVersion={homeRankingTestbedVersion}
              oodAxes={homeRankingOodAxes}
              metricLabel={homeClaimMetricLabel}
            />
          </Reveal>
          <div className="mt-14">
            <OutcomeSpectrum bands={homeOutcomes} />
          </div>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="One lifecycle"
            title="From site-task to a call you can defend internally."
            lede="You describe the decision. We maintain the substrate, and the evidence routing happens on our side of the line."
          />
          <div className="mt-16">
            <RunLifecycleRail stages={robotTeamFlow} />
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="Why you do not pick the backend">
                The right method depends on the claim, not on preference. Asking a
                buyer to choose between simulators moves the hardest judgement in
                the process onto the person with the least information about it.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="Where the evidence stops">
                {robotPolicyEvaluationBoundary}
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="How the budget is spent"
            title="We pay for the method the claim needs, and no more."
            lede="Methods are qualified per claim, not ranked against each other. A costlier derived method does not outrank real capture — it covers conditions the capture could not."
          />
          <Reveal className="mt-14">
            <EvidenceLadderChart rungs={homeEvidenceRungs} />
          </Reveal>
        </Inner>
      </Band>

      <FullBleedMedia
        src="/redesign/pov/machine-tending.jpg"
        alt="A machine-tending station in a working facility"
        eyebrow="Before the trip"
        title="Find the incompatibility here, not at the door."
        body="Reach, footprint, clearance, observation and action mismatches, environmental limits. These are the failures that waste an entire site visit, and they are the cheapest ones to catch."
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="05"
            eyebrow="Where we stop"
            title="The limits, stated plainly."
            onInk
          />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title="Tell us what you need to decide."
        body="The site-task, the candidates, the threshold, what a wrong yes would cost, and anything we may not do. The evidence plan is ours to build."
        primaryHref={runCtaHref}
        primaryLabel="Scope a benchmark"
        secondaryHref="/pricing"
        secondaryLabel="How pricing works"
        imageSrc="/redesign/pov/packing-cell.jpg"
        imageAlt="A packing cell used as a real-site task context"
      />
    </>
  );
}
