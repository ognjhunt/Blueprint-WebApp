import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  ClaimThresholdChart,
  EvidenceLadderChart,
  DecisionShiftCompare,
  OutcomeSpectrum,
  StatRow,
} from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import { RunFilm } from "@/components/site/runFilm";
import {
  Band,
  ClosingCta,
  FullBleedMedia,
  Inner,
  MediaSplit,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { blueprintPositioning } from "@/data/robotPolicyEvaluationClaims";
import {
  closingCta,
  homeClaimMetricLabel,
  homeClaimThreshold,
  homeClaims,
  homeDecisionCost,
  homeEvidenceRungs,
  homeHero,
  homeLimits,
  homeOutcomes,
  homeStats,
} from "@/data/publicSiteCopy";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home";
const runCtaHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home-cta";

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Task Evaluation Runs for real site-tasks"
        description="Blueprint turns a real site-task into a maintained testbed and answers the decision claim by claim — including when the evidence cannot answer it yet."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint Task Evaluation Runs",
            description: blueprintPositioning,
          }),
        ]}
      />

      <PageHero
        eyebrow={homeHero.eyebrow}
        title={homeHero.title}
        body={homeHero.body}
        chips={homeHero.chips}
        ctaHref={runHref}
        ctaLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="How it works"
        imageSrc="/redesign/pov/packing-cell.jpg"
        imageAlt="A real packing cell, the kind of site-task a run is built around"
        imageCaption="Real site · captured substrate"
        routeTrace
      />

      {/* 01 — what you are actually buying */}
      <Band tone="ink">
        <Inner className="py-16 lg:py-20">
          <SectionHeader
            index="01"
            eyebrow="What you are buying"
            title="One service. Priced per decision."
            lede="Blueprint used to sell several loosely related things. It now sells one: a Task Evaluation Run. Robot teams and site operators get their own explanation of it, then use the same intake, the same workflow, and the same result."
            onInk
          />
          <div className="mt-12 overflow-hidden rounded-lg border border-white/10 bg-[#ded7c8]">
            <StatRow tiles={homeStats} onInk />
          </div>
        </Inner>
      </Band>

      {/* 02 — the problem, with the before/after figure */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <MediaSplit
            imageSrc="/redesign/pov/loading-dock.jpg"
            imageAlt="A loading dock where a robot task would have to work in real conditions"
            imageCaption="Where the answer has to hold"
            flip
          >
            <div>
              <p className="inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-brass-deep">
                <span aria-hidden="true" className="h-px w-6 shrink-0 bg-current opacity-50" />
                02 · The problem
              </p>
              <h2 className="mt-6 max-w-[22ch] font-display text-[clamp(2rem,3.6vw,3.2rem)] font-medium leading-[1.03] tracking-[-0.035em] text-ink-900">
                A robot on site is a very expensive way to ask a question.
              </h2>
              <p className="mt-6 max-w-[46ch] text-[15.5px] leading-[1.75] text-ink-600">
                By the time a policy is failing on a real floor, you have already
                spent the trip, the crew, the slot, and the goodwill of whoever
                let you in. The information you needed was cheap. Getting it that
                way was not.
              </p>
              <p className="mt-4 max-w-[46ch] text-[15.5px] leading-[1.75] text-ink-600">
                A run does not replace the visit. It makes the visit a test of
                something you have already narrowed down.
              </p>
            </div>
          </MediaSplit>

          <Reveal className="mt-16">
            <DecisionShiftCompare rows={homeDecisionCost} />
          </Reveal>
        </Inner>
      </Band>

      {/* 03 — lifecycle */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="How a run moves"
            title="Seven moves from a real task to an answer."
            lede="Nothing here asks you to design an evaluation. You bring the job and the decision; the substrate and the method are ours to get right."
          />
          {/* The compact cut of the run film, in place of the static rail. */}
          <RunFilm variant="compact" className="mt-16" />
        </Inner>
      </Band>

      {/* 04 — the abstention chart: the centrepiece */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="The honest part"
            title="A run is allowed to tell you it cannot tell you."
            lede="Most evaluation products always produce a ranking, because a ranking is what looks like a deliverable. If the evidence under a claim will not carry it, we report that instead of rounding a guess into a verdict."
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
              <ProofBoundary level="info" title="Read the figure this way">
                Reachability clears the line with room to spare, so it is
                supported. Dock clearance falls short, so it is ruled out. Onsite
                outperformance has a point estimate above the line and an
                interval that crosses it — which is not a win, and is not
                reported as one.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="What that means commercially">
                You can buy a run and be told no. You can buy a run and be told
                not yet. Both are cheaper than the version of that answer you get
                from a robot standing in a warehouse.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      {/* 05 — outcome spectrum */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="05"
            eyebrow="What comes back"
            title="Five ways a run can end. Four of them are not a winner."
            lede="The result is a set of per-claim findings with their conditions attached — never one score standing in for the whole decision."
          />
          <div className="mt-14">
            <OutcomeSpectrum bands={homeOutcomes} />
          </div>
        </Inner>
      </Band>

      {/* 06 — evidence ladder */}
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

      <FullBleedMedia
        src="/redesign/pov/route-scan.jpg"
        alt="A captured route through a real working site"
        eyebrow="The substrate"
        title="One captured site-task, kept and versioned."
        body="A testbed is not a one-off scene. It is maintained, digest-pinned, and reused, so an answer you get next quarter is comparable to the one you got today — and so raw capture stays the source of truth rather than whatever was derived from it."
      />

      {/* 07 — personas */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="07"
            eyebrow="Two ways in"
            title="Same run. Different starting point."
          />
          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <MediaSplitCard
                href="/for-robot-teams"
                imageSrc="/redesign/pov/warehouse-tote.jpg"
                imageAlt="A robot arm working a tote task at a real site"
                eyebrow="For robot teams"
                title="Spend field time on the candidate that earned it."
                body="Bring checkpoints or policies. Find the disqualifiers early, see which claims the current evidence can already close, and decide whether the trip is justified."
                linkLabel="Robot-team use case"
              />
            </Reveal>
            <Reveal delay={0.08}>
              <MediaSplitCard
                href="/for-site-operators"
                imageSrc="/redesign/pov/retail-backroom.jpg"
                imageAlt="A retail backroom being considered for robot work"
                eyebrow="For site operators"
                title="Find out what a robot could do here first."
                body="You do not need a vendor or a policy to start. Describe the job and the terms, and keep control of access, privacy, and whether anyone tests on your floor."
                linkLabel="Site-operator use case"
              />
            </Reveal>
          </div>
        </Inner>
      </Band>

      {/* 08 — limits */}
      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="08"
            eyebrow="Where we stop"
            title="The limits, in the same size type as the promises."
            lede="If these are going to be a problem for your decision, it is cheaper for both of us to know now."
            onInk
          />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title={closingCta.title}
        body={closingCta.body}
        primaryHref={runCtaHref}
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/pricing"
        secondaryLabel="How pricing works"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="An industrial line of the kind a site-task is captured from"
      />
    </>
  );
}

/**
 * Persona card — large media over a short pitch. Local to Home because it is the
 * only place two personas are presented side by side at this size.
 */
function MediaSplitCard({
  href,
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  body,
  linkLabel,
}: {
  href: string;
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  body: string;
  linkLabel: string;
}) {
  return (
    <a href={href} className="group block">
      <div className="overflow-hidden rounded-lg border border-line">
        <img
          src={imageSrc}
          alt={imageAlt}
          loading="lazy"
          className="aspect-[16/10] w-full object-cover grayscale contrast-[1.03] brightness-[0.82] transition-transform duration-700 ease-out-bp group-hover:scale-[1.03]"
        />
      </div>
      <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-deep">
        {eyebrow}
      </p>
      <h3 className="mt-4 max-w-[24ch] font-display text-[clamp(1.5rem,2.2vw,2.05rem)] font-medium leading-[1.1] tracking-[-0.03em] text-ink-900">
        {title}
      </h3>
      <p className="mt-4 max-w-[44ch] text-[14.5px] leading-[1.72] text-ink-500">{body}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-900 underline decoration-brass decoration-2 underline-offset-[6px] transition-colors group-hover:text-brass-deep">
        {linkLabel}
      </span>
    </a>
  );
}
