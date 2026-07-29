import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  CandidateMatrixFigure,
  EvidenceGapFigure,
  EvidenceLadderFigure,
  FigureFrame,
  RunFlowFigure,
} from "@/components/site/figures";
import { CinematicMedia, Reveal } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  MonoNote,
  Section,
  SectionHead,
  StatementList,
} from "@/components/site/publicSections";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyEvaluationBoundary,
} from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const requestHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-robot-teams";

const decisions = [
  {
    title: "Is this site even survivable for our hardware?",
    body: "Reach, footprint, clearance, observation, and action mismatches surface before anyone books a truck. An eliminated candidate is a real, useful result.",
  },
  {
    title: "Which of our checkpoints belongs on the trailer?",
    body: "Candidates enter one decision, one task, one threshold, one provenance scope. Where the comparison claim itself cannot be answered at the strength you need, you get an abstention instead of a leaderboard.",
  },
  {
    title: "What is the one experiment worth running next?",
    body: "Unresolved claims, uncertainty, and the claim ceiling point at the cheapest stronger test — recapture, narrow the task, escalate the method, go physical, or stop.",
  },
];

export default function ForRobotTeams() {
  return (
    <>
      <SEO
        title="Task Evaluation Runs for robot teams | Blueprint"
        description="Compare internal policies or checkpoints, test real-task compatibility, discover failure conditions, and decide whether field time is justified."
        canonical="/for-robot-teams"
        jsonLd={[
          webPageJsonLd({
            path: "/for-robot-teams",
            name: "Task Evaluation Runs for robot teams",
            description: "One decision-oriented evaluation service for robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For robot teams", path: "/for-robot-teams" },
          ]),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.1]" />
        <div className="relative mx-auto grid max-w-[88rem] items-center gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:px-10 lg:pb-24 lg:pt-24">
          <Reveal y="2rem">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                Task Evaluation Run · robot teams
              </span>
            </div>

            <h1 className="mt-7 max-w-[22ch] font-display text-[clamp(2.7rem,5.6vw,5rem)] font-medium leading-[0.97] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              Spend field time where it will actually pay.
            </h1>

            <p className="mt-7 max-w-[38rem] text-[1.0625rem] leading-[1.75] text-white/70">
              A site visit costs you a week, a truck, and your best engineers. Blueprint tells you
              what the site does to your candidates first — which ones it eliminates, which claims
              are still open, and which single experiment would settle the rest.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={requestHref}
                className="inline-flex h-12 items-center justify-center gap-2 bg-brass px-6 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors duration-200 hover:bg-brass-lit"
              >
                Request a Task Evaluation Run
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/how-it-works"
                className="inline-flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] transition-colors duration-200 hover:border-white/50 hover:bg-white/5"
              >
                How a run works
              </a>
            </div>
          </Reveal>

          <Reveal delay={140} y="2.5rem">
            <CinematicMedia
              src="/redesign/pov/warehouse-tote.jpg"
              alt="Robot arm working near totes at a real warehouse aisle"
              caption="Warehouse aisle · tote handling"
              meta="Illustrative"
              priority
              wash="soft"
              className="aspect-[16/11] w-full"
            />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ decisions ---- */}
      <Section tone="canvas">
        <SectionHead
          index="01"
          eyebrow="The wedge"
          title={
            <>
              Three decisions robot teams bring us, <Accent>none of them a leaderboard</Accent>.
            </>
          }
          lede="A run is organised around the decision and the claims under it — not a tournament between candidates."
          align="wide"
        />
        <div className="mt-12">
          <StatementList items={decisions} />
        </div>
      </Section>

      {/* ------------------------------------------------------- matrix ------ */}
      <Section tone="ink">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="02"
              eyebrow="Candidates"
              title={
                <>
                  Bring candidates when they matter. <Accent onInk>A ranking is not promised</Accent>.
                </>
              }
              lede="Each candidate meets each claim separately. A candidate can be supported, rejected, eliminated as incompatible, left unresolved, or wrapped into an explicit abstention — and the head-to-head comparison is itself just another claim that has to earn its answer."
              onInk
            />
            <div className="mt-8">
              <MonoNote label="Why it matters" onInk>
                Raw scores exist inside a run. They are not permitted to become a winner when the
                comparison claim abstains.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 01 — Candidate × claim board"
            title="Where the comparison claim itself abstains"
            kind="structure"
            onInk
            note="Illustrative structure, not measured results. Note the bottom row: three candidates, and no qualified method at the required strength for the head-to-head claim. That row abstains rather than resolving itself from the rows above it."
          >
            <CandidateMatrixFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* --------------------------------------------------------- ladder ---- */}
      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="03"
              eyebrow="Method selection"
              title={
                <>
                  You never pick the backend. <Accent>We route per claim</Accent>.
                </>
              }
              lede="No simulator menu, no provider dropdown, no world-model preference. Each claim goes to the least expensive method currently qualified for it, and escalates only when the claim demands more."
            />
            <div className="mt-8">
              <MonoNote label="Plain language">
                Blueprint uses the cheapest evidence that is trustworthy enough for each question,
                and asks for stronger evidence only when it has to.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 02 — Evidence ladder"
            title="Cheapest qualified method first, physical robot time last"
            kind="concept"
            note="Conceptual ordering, not a price list or a benchmark. Qualification is decided per claim, per run."
          >
            <EvidenceLadderFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* ------------------------------------------------------- strength ---- */}
      <Section tone="canvas">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <SectionHead
              index="04"
              eyebrow="Honest coverage"
              title={
                <>
                  Where virtual evidence is strong today — <Accent>and where it is not</Accent>.
                </>
              }
              lede={robotPolicyEvaluationBeachhead}
            />
            <Reveal className="mt-8">
              <ProofBoundary level="warn" title="Evidence boundary">
                {robotPolicyEvaluationBoundary}
              </ProofBoundary>
            </Reveal>
          </div>

          <FigureFrame
            eyebrow="Figure 03 — Claim areas"
            title="What virtual evidence can carry, by claim area"
            kind="concept"
            note="Conceptual ordering of where virtual evidence is currently strongest — not a measured coverage score for your site. Contact-rich and safety-critical claims need a stronger envelope and often physical evidence."
          >
            <EvidenceGapFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* ----------------------------------------------------------- flow ---- */}
      <Section tone="graphite">
        <SectionHead
          index="05"
          eyebrow="The run"
          title={
            <>
              From your decision to a bounded answer, <Accent onInk>in six steps</Accent>.
            </>
          }
          lede="You describe the decision. Blueprint maintains the substrate; Pipeline owns method qualification and the scientific verdict."
          onInk
          align="wide"
        />
        <div className="mt-14">
          <FigureFrame
            eyebrow="Figure 04 — Run lifecycle"
            title="Where your work ends and ours begins"
            kind="schematic"
            onInk
            note="A run does not guarantee a ranking, winner, field recommendation, deployment, or safety approval. Unknown future states fail closed."
          >
            <RunFlowFigure onInk />
          </FigureFrame>
        </div>
      </Section>

      <BigCta
        eyebrow="Start with the decision"
        title={
          <>
            Before the truck. <br className="hidden sm:block" />
            Before the week onsite.
          </>
        }
        body="Tell us the site-task, the candidates if you have them, the claims, thresholds, consequences, budget, deadline, and restrictions. The method plan is ours to build."
        imageSrc="/redesign/pov/packing-cell.jpg"
        imageAlt="Warehouse packing-cell task environment"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-robot-teams-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/pricing"
        secondaryLabel="How runs are scoped"
        footnote="One scoped run, quoted from the decision and the evidence it needs. Post-training use of qualifying evidence is a permission inside a run, never a separate package."
      />
    </>
  );
}
