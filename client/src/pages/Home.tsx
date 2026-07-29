import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  ClaimBoardFigure,
  EvidenceLadderFigure,
  FigureFrame,
  OutcomeFanFigure,
  ProvenanceChainFigure,
  RunFlowFigure,
  RunTicketFigure,
} from "@/components/site/figures";
import { CapturedSitesMarquee, Reveal, Stagger } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  MonoNote,
  PictureCard,
  Section,
  SectionHead,
} from "@/components/site/publicSections";
import { blueprintPositioning } from "@/data/robotPolicyEvaluationClaims";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const requestHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home";

const heroChips = [
  "A decision, not a backend menu",
  "Abstention is a real result",
  "Every number keeps its receipts",
];

// Illustrative environment stills. Labelled as such on the page — these stand
// for the kinds of places a site-task lives in, not customer captures.
const marqueeSites = [
  { src: "/redesign/pov/packing-cell.jpg", alt: "Packing cell with totes and a conveyor", label: "Packing cell" },
  { src: "/redesign/pov/loading-dock.jpg", alt: "Loading dock with cartons on pallets", label: "Loading dock" },
  { src: "/redesign/pov/warehouse-tote.jpg", alt: "Warehouse shelving stacked with totes", label: "Warehouse aisle" },
  { src: "/redesign/pov/cold-storage.jpg", alt: "Cold-storage shelving with frosted crates", label: "Cold storage" },
  { src: "/redesign/pov/factory-conveyor.jpg", alt: "Factory conveyor carrying small parts", label: "Factory conveyor" },
  { src: "/redesign/pov/machine-tending.jpg", alt: "Guarded industrial machine station", label: "Machine tending" },
  { src: "/redesign/pov/retail-backroom.jpg", alt: "Retail backroom aisle with packaged goods", label: "Retail backroom" },
  { src: "/redesign/pov/inspection-bench.jpg", alt: "Inspection bench with small components", label: "Inspection bench" },
  { src: "/redesign/pov/route-scan.jpg", alt: "Industrial aisle with route markers", label: "Route and traffic" },
];

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Task Evaluation Runs for real site-tasks"
        description="Blueprint turns a real site-task into a maintained testbed and returns a bounded decision or an explicit abstention using the least expensive qualified evidence."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint Task Evaluation Runs",
            description: blueprintPositioning,
          }),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <img
          src="/redesign/pov/packing-cell.jpg"
          alt="Real packing-cell task environment"
          loading="eager"
          decoding="sync"
          className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.62]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(100deg,rgba(13,13,11,0.95),rgba(13,13,11,0.74)_42%,rgba(13,13,11,0.34))]"
        />
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.13]" />

        <div className="relative mx-auto grid max-w-[88rem] gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1fr_23rem] lg:items-end lg:gap-12 lg:px-10 lg:pb-28 lg:pt-24">
          <Reveal y="2rem">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                One product · Task Evaluation Runs
              </span>
            </div>

            <h1 className="mt-7 max-w-[24ch] font-display text-[clamp(2.9rem,6.4vw,5.6rem)] font-medium leading-[0.96] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              Know what the real site will do to your robot.
            </h1>

            <p className="mt-7 max-w-[40rem] text-[1.125rem] leading-[1.75] text-white/70">
              Blueprint captures the place the work actually happens, keeps it as an exact
              versioned testbed, and answers the one decision in front of you with the cheapest
              evidence strong enough to trust. When nothing is strong enough, that is the answer
              you get — not a guess dressed up as a score.
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
                How it works
              </a>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
              {heroChips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/55"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brass" />
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={160} y="2.5rem">
            <RunTicketFigure />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ captured places ---- */}
      <Section tone="graphite" bleed divider>
        <div className="mx-auto max-w-[88rem] px-5 pt-20 sm:px-8 lg:px-10 lg:pt-24">
          <SectionHead
            index="01"
            eyebrow="Real places first"
            title={
              <>
                A testbed starts as a walk through <Accent onInk>a real building</Accent>.
              </>
            }
            lede="Aisle widths. Clutter that never appears in a spec. Light at the wrong hour. Traffic at shift change. Capture holds the timestamps, poses, device metadata, and rights record that make everything downstream checkable — and stays authoritative when derived evidence disagrees with it."
            onInk
          />
        </div>
        <div className="mt-14 pb-8">
          <CapturedSitesMarquee items={marqueeSites} />
        </div>
        <div className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 lg:px-10 lg:pb-24">
          <MonoNote label="On these frames" onInk>
            Illustrative environment stills showing the kinds of places a site-task lives in. They
            are not customer captures, and nothing on this page reports a measured result.
          </MonoNote>
        </div>
      </Section>

      {/* ------------------------------------------------------- claims ------ */}
      <Section tone="canvas">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="02"
              eyebrow="What a run answers"
              title={
                <>
                  Your decision breaks into claims. We answer them <Accent>one at a time</Accent>.
                </>
              }
              lede="State the decision and what it rests on. Each claim gets its own method, its own limits, and its own outcome — so a strong answer on reach never quietly covers for a weak one on clutter. Nothing is averaged into a single number."
            />
            <div className="mt-8 space-y-4">
              <MonoNote label="You bring">
                The decision, the claims, thresholds and units, what a false-safe would cost,
                budget, deadline, and the restrictions we have to work inside.
              </MonoNote>
              <MonoNote label="You never bring">
                A simulator choice, a provider, or a world-model preference. Method selection is
                ours, and it is per claim.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 01 — Decision envelope"
            title="One row per claim, and the honest rows stay empty"
            kind="structure"
            note="Illustrative structure of a returned envelope. Values and bands show how a result is laid out — they are not measured Blueprint output. Where no method is qualified at the required strength, no number is drawn at all."
          >
            <ClaimBoardFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* ------------------------------------------------ evidence ladder ---- */}
      <Section tone="ink">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="03"
              eyebrow="The router"
              title={
                <>
                  Start cheap. Climb only <Accent onInk>when the claim demands it</Accent>.
                </>
              }
              lede="Every claim is routed to the least expensive method currently qualified to answer it. Geometry before observation. Observation before simulation. Physical robot time last, because it is the most expensive thing you own — and it should go to the questions nothing cheaper can close."
              onInk
            />
            <div className="mt-8">
              <MonoNote label="Escalation rule" onInk>
                A method has to be qualified for this claim, at this strength, in this envelope.
                If it is not, the run escalates or abstains. It does not stretch.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 02 — Evidence ladder"
            title="Relative cost against the strength of claim a method can carry"
            kind="concept"
            onInk
            note="Conceptual ordering, not a price list or a benchmark. Which methods are qualified for a given claim is decided per run by the evidence router, and the ordering shifts with the claim."
          >
            <EvidenceLadderFigure onInk />
          </FigureFrame>
        </div>
      </Section>

      {/* ---------------------------------------------------------- flow ----- */}
      <Section tone="paper">
        <SectionHead
          index="04"
          eyebrow="The run"
          title={
            <>
              Six steps, and <Accent>you own the first one</Accent>.
            </>
          }
          lede="After intake, the complexity is ours: pinning the substrate, qualifying methods, measuring, aggregating, and drawing the line between what the evidence supports and what it does not."
          align="wide"
        />
        <div className="mt-14">
          <FigureFrame
            eyebrow="Figure 03 — Run lifecycle"
            title="From a stated decision to a bounded answer"
            kind="schematic"
            note="Blueprint owns intake, authorization, durable state, and access. Pipeline owns method qualification, routing, and the scientific verdict. Neither step invents the other's answer."
          >
            <RunFlowFigure onInk={false} />
          </FigureFrame>
        </div>
      </Section>

      {/* ------------------------------------------------------ outcomes ----- */}
      <Section tone="canvas">
        <SectionHead
          index="05"
          eyebrow="Truthful outcomes"
          title={
            <>
              Five ways a run can end. <Accent>All five are deliveries</Accent>.
            </>
          }
          lede="A useful run does not have to name a winner. It has to tell you what is supported, what is not, and what it would take to close the gap."
          align="wide"
        />
        <div className="mt-14">
          <FigureFrame
            eyebrow="Figure 04 — Outcome set"
            title="One request, five honest endings"
            kind="schematic"
            note="No frequencies are shown or implied: the point is that all five are valid deliveries. A run does not guarantee a ranking, shortlist, winner, pilot readiness, deployment, or safety approval."
          >
            <OutcomeFanFigure />
          </FigureFrame>
        </div>
        <Reveal className="mt-8">
          <ProofBoundary level="info" title="What abstention protects you from">
            Reachability can be supported while onsite outperformance stays unresolved. In that
            case you get a partial decision or an explicit abstention, the validation envelope,
            and the next evidence needed. Blueprint does not infer a winner from raw scores.
          </ProofBoundary>
        </Reveal>
      </Section>

      {/* ------------------------------------------------------ personas ----- */}
      <Section tone="white">
        <SectionHead
          index="06"
          eyebrow="Two ways in, one service"
          title={
            <>
              Same run, same result contract, <Accent>different first question</Accent>.
            </>
          }
          lede="The robot-team path starts from candidates and a field-time decision. The site-operator path starts from a task with no candidates yet. Both end in the same intake."
          align="wide"
        />
        <Stagger className="mt-14 grid gap-6 lg:grid-cols-2" step={110}>
          <PictureCard
            href="/for-robot-teams"
            imageSrc="/redesign/pov/warehouse-tote.jpg"
            imageAlt="Robot arm working near totes in a warehouse aisle"
            caption="Robot teams"
            meta="Illustrative"
            eyebrow="For robot teams"
            title="Spend field time where it will actually pay."
            body="Bring checkpoints or policies when you have them. Find the incompatibilities, the unresolved claims, and the one experiment that would change your mind — before you book a site visit."
            linkLabel="Robot-team use case"
          />
          <PictureCard
            href="/for-site-operators"
            imageSrc="/redesign/pov/loading-dock.jpg"
            imageAlt="Loading dock being prepared for a site-task capture"
            caption="Site operators"
            meta="Illustrative"
            eyebrow="For site operators"
            title="Your site is the test. Keep control of it."
            body="Turn one real workflow into a decision you can inspect, see exactly which claims your current capture can carry, and keep rights, privacy, access, and physical testing under your own approval."
            linkLabel="Site-operator use case"
          />
        </Stagger>
      </Section>

      {/* ---------------------------------------------------- provenance ----- */}
      <Section tone="ink">
        <SectionHead
          index="07"
          eyebrow="Provenance"
          title={
            <>
              Every number in a result <Accent onInk>keeps its receipts</Accent>.
            </>
          }
          lede="Raw capture stays authoritative. Derived geometry, simulation, generated media, and provider output never silently upgrade a claim — they arrive attached to the version, digest, and permitted uses they came from."
          onInk
          align="wide"
        />
        <div className="mt-14">
          <FigureFrame
            eyebrow="Figure 05 — Chain of custody"
            title="What a claim can be walked back through"
            kind="schematic"
            onInk
            note="Field names, not a real run. An evidence export does not prove that training happened or that a policy improved, and a physical outcome only joins a run through authoritative evidence and exact identifiers."
          >
            <ProvenanceChainFigure onInk />
          </FigureFrame>
        </div>
      </Section>

      <BigCta
        eyebrow="Start with the decision"
        title={
          <>
            Tell us the decision. <br className="hidden sm:block" />
            We will tell you what the evidence can carry.
          </>
        }
        body="Describe the site-task, the claims under it, thresholds, what a false-safe would cost, budget, deadline, and restrictions. The evidence plan is our problem."
        imageSrc="/redesign/pov/route-scan.jpg"
        imageAlt="Captured real-site route through an industrial aisle"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/pricing"
        secondaryLabel="How runs are scoped"
        footnote="One scoped run, quoted from what the decision actually requires. No subscription, no submission fee, no fixed campaign price."
      />
    </>
  );
}
