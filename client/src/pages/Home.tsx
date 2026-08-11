import {
  ArrowRightIcon,
  CameraIcon,
  ChartBarSquareIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/outline";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  ClearanceMarginChart,
  DecisionShiftCompare,
  EvidenceLadderChart,
  RankingMarginChart,
  StatRow,
} from "@/components/site/figures";
import {
  KineticBenchmark,
  ResultDecisionPanel,
} from "@/components/site/KineticBenchmark";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  Inner,
  NoteCards,
  SectionHeader,
} from "@/components/site/publicSections";
import { RunFilm } from "@/components/site/runFilm";
import {
  homeClaimMetricLabel,
  homeDecisionCost,
  homeEvidenceRungs,
  homeLimits,
  homeRankingCandidates,
  homeRankingOodAxes,
  homeRankingResolutionFloorPp,
  homeRankingRolloutsPerCandidate,
  homeRankingTestbedVersion,
  homeScreeningMargins,
  homeStats,
} from "@/data/publicSiteCopy";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home";

const artifacts = [
  {
    number: "01",
    eyebrow: "Captured task",
    title: "The real site stays the reference.",
    body: "Geometry, task objects, access boundaries, and the conditions that matter to the decision.",
    image: "/redesign/pov/packing-cell.jpg",
    alt: "A packing cell captured from the operator point of view",
    Icon: CameraIcon,
  },
  {
    number: "02",
    eyebrow: "Simulation-ready twin",
    title: "The task becomes testable.",
    body: "SimReady objects, calibrated variation, lighting, and scenarios built around the job—not a generic scene.",
    image: "/kinetic/packing-cell-sim-twin.webp",
    alt: "A simulation-ready reconstruction of the same packing cell",
    Icon: CubeTransparentIcon,
  },
  {
    number: "03",
    eyebrow: "Decision packet",
    title: "The evidence becomes actionable.",
    body: "Ranking, uncertainty, failure slices, and what each candidate needs before the physical pilot.",
    image: "/generated/wam-policy-eval-2026-06-21/figure03-style-rollout-strip.png",
    alt: "An illustrative strip of robot policy evaluation rollouts",
    Icon: ChartBarSquareIcon,
  },
] as const;

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Turn a site walkthrough into a robot benchmark"
        description="Blueprint captures a prospective pilot site, rebuilds the task in simulation, runs your candidates, and returns a decision-ready evaluation before field time."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint field-to-sim robot benchmark",
            description:
              "A fixed-scope Task Evaluation Run that turns a real site walkthrough into a simulation-ready benchmark and bounded robot-policy decision.",
          }),
        ]}
      />

      <KineticBenchmark />

      <section className="bg-white">
        <div className="mx-auto max-w-[94rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-32">
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <p className="kinetic-eyebrow">What gets built</p>
                <h2 className="mt-6 max-w-[13ch] text-[clamp(2.8rem,5.6vw,6.2rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-kinetic-graphite">
                  One walk. Three artifacts. Target: one day.
                </h2>
              </div>
              <p className="max-w-[38rem] pb-2 text-lg leading-8 text-kinetic-muted lg:justify-self-end">
                You bring the site-task and the candidates. Blueprint handles the
                reconstruction, simulation design, evaluation runs, and report —
                targeting a result in 12–24 hours, back before you could
                schedule the pilot.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-7 lg:grid-cols-3">
            {artifacts.map((artifact, index) => (
              <Reveal key={artifact.number} delay={index * 0.07}>
                <article className="group">
                  <div className="relative overflow-hidden rounded-2xl bg-kinetic-dark">
                    <img
                      src={artifact.image}
                      alt={artifact.alt}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08111d]/55 via-transparent to-transparent" />
                    <span className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#06111d]/50 text-white backdrop-blur-xl">
                      <artifact.Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="absolute bottom-5 left-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/78">
                      {artifact.number} · {artifact.eyebrow}
                    </span>
                  </div>
                  <h3 className="mt-7 max-w-[15ch] text-[clamp(1.65rem,2.5vw,2.35rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-kinetic-graphite">
                    {artifact.title}
                  </h3>
                  <p className="mt-4 max-w-[29rem] text-[15px] leading-7 text-kinetic-muted">
                    {artifact.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ResultDecisionPanel />

      <section className="bg-kinetic-white">
        <div className="mx-auto max-w-[94rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-32">
          <Reveal>
            <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="relative overflow-hidden rounded-2xl bg-kinetic-dark shadow-[0_30px_80px_-46px_rgba(9,18,29,0.65)]">
                <img
                  src="/generated/wam-policy-eval-2026-06-21/figure03-style-hero.png"
                  alt="An illustrative humanoid robot evaluation environment"
                  loading="lazy"
                  className="aspect-[16/11] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#06111d]/85 to-transparent px-6 pb-6 pt-20 text-white">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Evidence envelope</p>
                    <p className="mt-2 text-lg font-medium">Simulation + paired site check</p>
                  </div>
                  <span className="rounded-full border border-white/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-white/72">
                    Illustrative
                  </span>
                </div>
              </div>

              <div>
                <p className="kinetic-eyebrow">Built for a decision</p>
                <h2 className="mt-6 max-w-[14ch] text-[clamp(2.7rem,5vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.058em] text-kinetic-graphite">
                  More signal before anyone books the robot.
                </h2>
                <p className="mt-7 max-w-[36rem] text-lg leading-8 text-kinetic-muted">
                  A run is not a synthetic demo or a claim that simulation replaces
                  reality. It is a faster way to eliminate weak candidates, expose
                  uncertainty, and arrive at pilot day with a sharper question.
                </p>
                <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-kinetic-line bg-kinetic-line">
                  {[
                    ["12–24h", "Target turnaround"],
                    ["$2,500+", "Fixed-scope starting point"],
                    ["1 task", "One decision boundary"],
                    ["Explicit", "Uncertainty or abstention"],
                  ].map(([value, label]) => (
                    <div key={label} className="bg-white p-5 sm:p-6">
                      <dt className="text-[clamp(1.45rem,2.3vw,2.2rem)] font-semibold tracking-[-0.04em] text-kinetic-graphite">{value}</dt>
                      <dd className="mt-2 text-xs leading-5 text-kinetic-muted">{label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/*
        The evidence half of the page. The kinetic panels above sell the shape of
        a run; everything below is what the run is allowed to claim, and it is
        deliberately in the same type size as the promises. Each block re-mounts
        the component that owns the claim, so the disclosure and the figure it
        qualifies can never drift apart in copy edits.
      */}
      <Band tone="ink">
        <Inner className="py-16 lg:py-20">
          <SectionHeader
            index="01"
            eyebrow="What you are buying"
            title="One service. Priced per decision."
            lede="Blueprint sells one thing: a Task Evaluation Run. Robot teams and site operators get their own explanation of it, then use the same intake, the same workflow, and the same result."
            onInk
          />
          <div className="mt-12 overflow-hidden rounded-lg border border-white/10 bg-[#ded7c8]">
            <StatRow tiles={homeStats} onInk />
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="What changes"
            title="A robot on site is a very expensive way to ask a question."
            lede="A run does not replace the visit. It makes the visit a test of something you have already narrowed down."
          />
          <Reveal className="mt-14">
            <DecisionShiftCompare rows={homeDecisionCost} />
          </Reveal>
        </Inner>
      </Band>

      {/* The seven acts, plus the two stamps a run is contractually barred from granting. */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="How a run moves"
            title="Seven moves from a real task to an answer."
            lede="Nothing here asks you to design an evaluation. You bring the job and the decision; the substrate and the method are ours to get right."
          />
          <RunFilm variant="compact" className="mt-16" />
        </Inner>
      </Band>

      {/* Screening — the only pass that can name a cause rather than an order. */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="Ruled out first"
            title="Some candidates the building will not take."
            lede="Reach, clearance, footprint, sightlines. These come off the capture as distances, not as predictions — which makes this the one part of a run that can tell you what stopped a candidate and by how much. It is also the cheapest, so it runs before anything else."
          />
          <Reveal className="mt-14">
            <ClearanceMarginChart rows={homeScreeningMargins} />
          </Reveal>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="Read the figure this way">
                The dock door misses by 18 cm against a 2 cm tolerance — the
                whole interval sits below zero, so that candidate is out on
                measurement. The rack upright is 4 cm short against a 5 cm
                tolerance, so this capture cannot call it either way, and the run
                says which one it is rather than picking.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="What screening does not tell you">
                That a candidate fits is not that a candidate works. Screening
                clears the floor for the comparison; it says nothing about
                whether the policy is any good. That is the next section, and it
                is a weaker kind of claim.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      {/* The ranking, shipped with its margin and its resolution floor. */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="05"
            eyebrow="The ranking"
            title="Then the survivors get ranked, with the margin."
            lede="One task, one pinned testbed version, the same conditions for every candidate. You get the order, the gap between each pair, the interval on that gap, and the smallest gap the design can separate at all."
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
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="Read the figure this way">
                A leads C by 24 points and the interval on that gap stays clear
                of zero, so it is a real lead. C leads D by 4 points, inside the
                floor this design can resolve, so they are reported as tied at
                this rollout count instead of ordered.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="Where the ranking stops">
                This is a ranking on this testbed, under these conditions. We
                have not measured how our rankings track real-world results,
                and we do not inherit anyone else's correlation figures as if
                they were ours.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="06"
            eyebrow="How we spend your budget"
            title="The cheapest evidence that is actually good enough."
            lede="You will not be asked to choose a simulator, a world model, or a provider. That choice depends on what each claim needs, which is exactly the part you are paying us to know. Cheaper is about cost, not about proving less — real capture stays the reference, and derived methods stay support."
          />
          <Reveal className="mt-14">
            <EvidenceLadderChart rungs={homeEvidenceRungs} />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="07"
            eyebrow="Where we stop"
            title="The limits, in the same size type as the promises."
            lede="If these are going to be a problem for your decision, it is cheaper for both of us to know now."
            onInk
          />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <section className="relative isolate overflow-hidden bg-kinetic-blue text-white">
        <img
          src="/kinetic/packing-cell-sim-twin.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.14] mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-kinetic-blue via-kinetic-blue/95 to-[#003dff]/75" />
        <div className="relative mx-auto grid max-w-[94rem] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">The next pilot</p>
            <h2 className="mt-5 max-w-[18ch] text-[clamp(2.65rem,5vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.058em]">
              Use pilot day to validate—not to discover.
            </h2>
          </div>
          <a
            href={runHref}
            className="inline-flex min-h-14 items-center justify-center gap-5 rounded-lg bg-white px-7 text-[15px] font-semibold text-kinetic-graphite shadow-xl transition duration-300 hover:-translate-y-0.5 hover:bg-kinetic-white"
          >
            Plan your first benchmark
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
