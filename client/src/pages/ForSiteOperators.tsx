import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  ControlBoundaryFigure,
  EvidenceGapFigure,
  FigureFrame,
  OutcomeFanFigure,
  ProvenanceChainFigure,
  type GapRow,
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
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const requestHref =
  "/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-site-operators";

const operatorSteps = [
  {
    title: "Describe the work, not a robot spec",
    body: "The workflow, the conditions it runs under, what counts as good enough, what failure is unacceptable, when it can be observed, and where nobody is allowed to go.",
  },
  {
    title: "See which claims your site can already answer",
    body: "A run separates what today's capture can carry from what needs a second window, a narrower task, or a real robot on the floor.",
  },
  {
    title: "Evaluate candidates when they turn up",
    body: "If a vendor or a robot team brings a policy or checkpoint, it enters the same request, the same claims, and the same per-claim evidence model. No separate submission fee, no vendor portal.",
  },
  {
    title: "Get an answer you can hand to someone else",
    body: "Positive, negative, partial, or an explicit abstention — each with the conditions it holds inside and the next cheapest experiment named.",
  },
];

// Operator-facing view of the same coverage fact: framed as claim areas at
// their site rather than the robot team's candidate questions.
const operatorGapRows: GapRow[] = [
  { area: "Layout, fit, and clearance", covered: 88, gapNeeds: "Recapture only when the layout changes" },
  { area: "Traffic and timing on the floor", covered: 74, gapNeeds: "A second capture window at peak" },
  { area: "Routine pick and place", covered: 61, gapNeeds: "Scenario variation, then review" },
  { area: "Delicate or contact-rich handling", covered: 32, gapNeeds: "Physical evidence, on your terms" },
  { area: "Work beside people or guarded machinery", covered: 12, gapNeeds: "Physical evidence and your safety process" },
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="Task Evaluation Runs for site operators | Blueprint"
        description="Turn a real site-task into a maintained testbed and a bounded decision, with missing evidence and physical requirements made explicit."
        canonical="/for-site-operators"
        jsonLd={[
          webPageJsonLd({
            path: "/for-site-operators",
            name: "Task Evaluation Runs for site operators",
            description: "The same Task Evaluation Run used by robot teams, explained for site operators.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For site operators", path: "/for-site-operators" },
          ]),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <img
          src="/redesign/pov/loading-dock.jpg"
          alt="Real loading dock used to define a site-task"
          loading="eager"
          decoding="sync"
          className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.62]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(100deg,rgba(13,13,11,0.95),rgba(13,13,11,0.72)_44%,rgba(13,13,11,0.3))]"
        />

        <div className="relative mx-auto max-w-[88rem] px-5 pb-20 pt-16 sm:px-8 lg:px-10 lg:pb-28 lg:pt-24">
          <Reveal y="2rem" className="max-w-[46rem]">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                Task Evaluation Run · site operators
              </span>
            </div>

            <h1 className="mt-7 font-display text-[clamp(2.7rem,5.6vw,5rem)] font-medium leading-[0.97] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              Your site is the test. Keep control of it.
            </h1>

            <p className="mt-7 max-w-[38rem] text-[1.0625rem] leading-[1.75] text-white/70">
              You do not need to design an evaluation stack, buy a simulator, or trust a vendor's
              demo. Describe one real task. Blueprint captures it, keeps it as a versioned testbed,
              and tells you which claims the evidence can carry today — with capture windows,
              restricted areas, permitted uses, and physical access staying under your approval.
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
                href="/governance"
                className="inline-flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] transition-colors duration-200 hover:border-white/50 hover:bg-white/5"
              >
                Rights and privacy
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- steps ---- */}
      <Section tone="canvas">
        <SectionHead
          index="01"
          eyebrow="Same service, different first question"
          title={
            <>
              Start from the task. <Accent>Candidates are optional</Accent>.
            </>
          }
          lede="The robot-team path starts from candidates. Yours can start with nothing but a workflow that has to keep running — and still end in a decision you can defend."
          align="wide"
        />
        <div className="mt-12">
          <StatementList items={operatorSteps} />
        </div>
      </Section>

      {/* --------------------------------------------------------- control ---- */}
      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="02"
              eyebrow="Boundaries"
              title={
                <>
                  A hard line between <Accent>what you decide</Accent> and what we owe you.
                </>
              }
              lede="Nothing crosses that line implicitly. Access, redaction, and permitted evidence use are recorded, not assumed, and a virtual result is never presented as a physical guarantee."
            />
            <Reveal className="mt-8">
              <ProofBoundary level="warn" title="Safety stays where it belongs">
                Capture windows, privacy, restricted areas, evidence use, physical access, and
                safety approval remain explicitly controlled by you. A Task Evaluation Run is
                evidence for a decision — not a safety certification and not a deployment approval.
              </ProofBoundary>
            </Reveal>
          </div>

          <FigureFrame
            eyebrow="Figure 01 — Control boundary"
            title="Who holds which decision"
            kind="schematic"
            note="Schematic of the accountability split recorded per site and per run. Individual restrictions are captured in your own request and rights record."
          >
            <ControlBoundaryFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* ------------------------------------------------------------ gaps ---- */}
      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="03"
              eyebrow="Missing evidence"
              title={
                <>
                  The gap gets named, <Accent>not papered over</Accent>.
                </>
              }
              lede="A run separates the claims your current capture can already carry from the ones that need a second window, a narrower task, or a real robot on the floor. The hatched half of this figure is the part most evaluation decks leave out."
            />
            <div className="mt-8">
              <MonoNote label="What you do with it">
                Decide whether to capture again, narrow the task, wait for stronger methods, or
                authorise physical work — with the cost of each option stated before you commit.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 02 — Coverage and gap"
            title="What capture can carry, by claim area"
            kind="concept"
            note="Conceptual ordering of where virtual evidence is currently strongest, not a measured coverage score for your site. Your own run reports coverage against your stated claims."
          >
            <EvidenceGapFigure rows={operatorGapRows} />
          </FigureFrame>
        </div>
      </Section>

      {/* -------------------------------------------------------- outcomes ---- */}
      <Section tone="canvas">
        <SectionHead
          index="04"
          eyebrow="What comes back"
          title={
            <>
              An answer you can hand to <Accent>someone who was not in the room</Accent>.
            </>
          }
          lede="Every ending is a delivery, and every one of them carries the conditions it holds inside."
          align="wide"
        />
        <div className="mt-14">
          <FigureFrame
            eyebrow="Figure 03 — Outcome set"
            title="One request, five honest endings"
            kind="schematic"
            note="No frequencies are shown or implied. A run does not guarantee a ranking, shortlist, winner, pilot readiness, deployment, or safety approval."
          >
            <OutcomeFanFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* ------------------------------------------------------ provenance ---- */}
      <Section tone="ink">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <SectionHead
              index="05"
              eyebrow="Provenance and learning"
              title={
                <>
                  Physical outcomes only join a run <Accent onInk>through real evidence</Accent>.
                </>
              }
              lede="When a claim cannot be closed virtually, targeted physical evidence joins the exact decision and testbed identifiers it belongs to. A note typed into a form is not evidence and cannot recalibrate a method."
              onInk
            />
            <div className="mt-8">
              <MonoNote label="Kept authoritative" onInk>
                Raw capture, timestamps, poses, device metadata, and the rights record. Derived
                geometry, simulation, and generated media never quietly outrank them.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 04 — Chain of custody"
            title="From your floor to the decision envelope"
            kind="schematic"
            onInk
            note="Field names, not a real run. An evidence export does not prove that training happened or that a policy improved."
          >
            <ProvenanceChainFigure onInk />
          </FigureFrame>
        </div>
      </Section>

      <BigCta
        eyebrow="Start with the task"
        title={
          <>
            One real workflow. <br className="hidden sm:block" />
            One decision you can inspect.
          </>
        }
        body="Describe the work and the decision it should inform. Candidates are optional at intake and can be linked whenever they exist."
        imageSrc="/redesign/pov/cold-storage.jpg"
        imageAlt="Cold-storage site-task environment"
        primaryHref="/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-site-operators-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/governance"
        secondaryLabel="Review rights and privacy"
        footnote="Same run, same result contract, same intake as robot teams. Rights, privacy, access, and physical testing stay under your explicit control."
      />
    </>
  );
}
