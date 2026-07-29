import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  ClaimBoardFigure,
  ClaimCeilingFigure,
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
} from "@/components/site/publicSections";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

type Stage = {
  index: string;
  title: string;
  lede: string;
  yours: string;
  ours: string;
  image: string;
  imageAlt: string;
  caption: string;
};

const stages: Stage[] = [
  {
    index: "01",
    title: "Say what you need to decide",
    lede: "Not \"evaluate our policy\" — the actual decision. Does candidate A deserve field time at this dock? Can this cell be worked at all by the class of robot we can afford?",
    yours: "The question, the claims under it, thresholds with units, what a false-safe would cost, acceptable risk, budget, deadline, the evidence you already have, and the restrictions we must respect.",
    ours: "Turning that into a structured request with an idempotent identity, an authorization trail, and a durable place to live.",
    image: "/redesign/pov/inspection-bench.jpg",
    imageAlt: "Inspection bench where a real site-task is defined",
    caption: "Intake · one decision",
  },
  {
    index: "02",
    title: "Pin the run to an exact site",
    lede: "A run is never aimed at \"a warehouse\". It names one captured Site-Task Testbed — a specific version of a specific real place, with a digest that cannot drift underneath the result.",
    yours: "Access, capture windows, restricted areas, and the rights record. Or an existing testbed if the site is already captured.",
    ours: "Immutable raw capture with timestamps, poses, and device metadata; a maintained versioned testbed; and the rule that raw capture stays authoritative when derived evidence disagrees.",
    image: "/redesign/pov/route-scan.jpg",
    imageAlt: "Industrial aisle with route markers being captured",
    caption: "Substrate · versioned",
  },
  {
    index: "03",
    title: "Plan the cheapest qualified evidence",
    lede: "Each claim is routed separately. Geometry can settle reach. Only real observation can settle what the aisle looks like at shift change. Nothing is stretched past what it has been qualified to answer.",
    yours: "Nothing. There is no simulator menu, no provider dropdown, no world-model preference to pick.",
    ours: "Qualifying and selecting from fixture data, geometry, real observations, traditional simulation, world models, provider tools, and physical evidence — claim by claim, escalating only when a claim demands it.",
    image: "/redesign/pov/factory-conveyor.jpg",
    imageAlt: "Factory conveyor carrying small parts",
    caption: "Router · per claim",
  },
  {
    index: "04",
    title: "Measure, and record where the measurement is valid",
    lede: "A number without an envelope is decoration. Every method reports what it measured, the profile it was qualified under, how uncertain it is, and the conditions outside which it says nothing.",
    yours: "Nothing, unless a claim needs access you control.",
    ours: "Normalized evidence results, coverage, uncertainty, disagreements between methods, correlated-evidence warnings, and the exact artifact versions and digests behind each figure.",
    image: "/redesign/pov/machine-tending.jpg",
    imageAlt: "Guarded industrial machine station under evaluation",
    caption: "Measurement · envelope",
  },
  {
    index: "05",
    title: "Decide, or abstain out loud",
    lede: "The result is a set of per-claim conclusions, not one score. Positive, negative, partial, blocked, or abstained — and the strongest claim the evidence permits, printed next to the answer.",
    yours: "Reading the envelope, not just the headline.",
    ours: "Failing closed on unknown states, and never converting an abstention into a winner from raw scores.",
    image: "/redesign/pov/packing-cell.jpg",
    imageAlt: "Packing cell where a task decision is applied",
    caption: "Decision · bounded",
  },
  {
    index: "06",
    title: "Name the next cheapest experiment",
    lede: "If the answer is not strong enough, the useful output is the next test — the least expensive thing that would move the decision, and whether it has to happen with a real robot on a real floor.",
    yours: "Deciding whether that experiment is worth it. Authorising physical work if it is.",
    ours: "Identifying it, pricing it honestly, and joining any authoritative physical outcome back to the exact decision and testbed identifiers.",
    image: "/redesign/pov/cold-storage.jpg",
    imageAlt: "Cold-storage aisle requiring physical evidence",
    caption: "Loop · physical when required",
  },
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How a Task Evaluation Run works | Blueprint"
        description="From real site-task to maintained testbed, qualified evidence plan, bounded decision or abstention, and physical learning loop."
        canonical="/how-it-works"
        jsonLd={[
          webPageJsonLd({
            path: "/how-it-works",
            name: "How a Task Evaluation Run works",
            description: "The Blueprint Task Evaluation Run lifecycle.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 pb-16 pt-16 sm:px-8 lg:px-10 lg:pb-20 lg:pt-24">
          <Reveal y="1.75rem" className="max-w-[52rem]">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass-deep/60" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-ink-500">
                How it works
              </span>
            </div>
            <h1 className="mt-7 font-display text-[clamp(2.7rem,5.4vw,4.9rem)] font-medium leading-[0.98] tracking-[-0.045em] text-ink-900">
              One real task in. One bounded answer out.
            </h1>
            <p className="mt-7 max-w-[42rem] text-[1.125rem] leading-[1.75] text-ink-500">
              A Task Evaluation Run has six steps. You own the first one. Everything after it is our
              problem — pinning the substrate, qualifying methods, measuring, aggregating, and
              drawing the line between what the evidence supports and what it never will.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto max-w-[88rem] px-5 pb-16 sm:px-8 lg:px-10 lg:pb-24">
          <FigureFrame
            eyebrow="Figure 01 — Run lifecycle"
            title="The whole run on one rail"
            kind="schematic"
            note="Blueprint owns intake, authorization, durable state, projection, and artifact access. Pipeline owns method qualification, routing, normalized evidence, and the scientific verdict."
          >
            <RunFlowFigure onInk={false} />
          </FigureFrame>
        </div>
      </section>

      {/* --------------------------------------------------------- stages ---- */}
      {stages.map((stage, index) => (
        <Section
          key={stage.index}
          tone={index % 2 === 0 ? "white" : "paper"}
          divider={index === 0}
          innerClassName="py-16 lg:py-24"
        >
          <div
            className={
              index % 2 === 0
                ? "grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-16"
                : "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16"
            }
          >
            <Reveal className={index % 2 === 0 ? "" : "lg:order-2"}>
              <CinematicMedia
                src={stage.image}
                alt={stage.imageAlt}
                caption={stage.caption}
                meta={`Step ${stage.index}`}
                wash="soft"
                className="aspect-[4/3] w-full"
              />
            </Reveal>

            <Reveal delay={90} className={index % 2 === 0 ? "" : "lg:order-1"}>
              <div className="flex items-baseline gap-4">
                <span className="font-display text-[3.25rem] font-medium leading-none tracking-[-0.04em] text-brass-deep/70">
                  {stage.index}
                </span>
                <h2 className="font-display text-[clamp(1.75rem,2.6vw,2.5rem)] font-medium leading-[1.06] tracking-[-0.03em] text-ink-900">
                  {stage.title}
                </h2>
              </div>

              <p className="mt-6 max-w-[36rem] text-[1rem] leading-[1.8] text-ink-600">
                {stage.lede}
              </p>

              <dl className="mt-8 grid gap-px bg-line sm:grid-cols-2">
                <div className="bg-white p-5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep">
                    Yours
                  </dt>
                  <dd className="mt-2.5 text-[13.5px] leading-6 text-ink-500">{stage.yours}</dd>
                </div>
                <div className="bg-white p-5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    Ours
                  </dt>
                  <dd className="mt-2.5 text-[13.5px] leading-6 text-ink-500">{stage.ours}</dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </Section>
      ))}

      {/* --------------------------------------------------------- ladder ---- */}
      <Section tone="ink">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              eyebrow="Step 03, in detail"
              title={
                <>
                  The router, <Accent onInk>rung by rung</Accent>.
                </>
              }
              lede="Each rung answers a different kind of question and costs a different amount. The run climbs only as high as the claim in front of it requires, which is why physical robot time is the last resort rather than the default."
              onInk
            />
            <div className="mt-8">
              <MonoNote label="Qualification" onInk>
                A method must be qualified for this claim, at this strength, inside this envelope.
                Unqualified is treated as unavailable, not as good enough.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 02 — Evidence ladder"
            title="Relative cost against the strength of claim a method can carry"
            kind="concept"
            onInk
            note="Conceptual ordering, not a price list or a benchmark. Which rung answers a given claim is decided per run."
          >
            <EvidenceLadderFigure onInk />
          </FigureFrame>
        </div>
      </Section>

      {/* ---------------------------------------------------------- result ---- */}
      <Section tone="canvas">
        <SectionHead
          eyebrow="Step 05, in detail"
          title={
            <>
              What the result actually looks like — <Accent>claim by claim</Accent>.
            </>
          }
          lede="Per-claim outcomes, the method that answered each one, the measured band against your threshold, and blank space where nothing qualified could answer at all."
          align="wide"
        />
        <div className="mt-14">
          <FigureFrame
            eyebrow="Figure 03 — Decision envelope"
            title="One row per claim, and the honest rows stay empty"
            kind="structure"
            note="Illustrative structure of a returned envelope. Values and bands show layout, not measured Blueprint output."
          >
            <ClaimBoardFigure />
          </FigureFrame>
        </div>
        <Reveal className="mt-8">
          <ProofBoundary level="info" title="Router in plain language">
            Blueprint uses the least expensive evidence that is trustworthy enough for each
            question, and asks for stronger evidence only when it has to.
          </ProofBoundary>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- ceiling ---- */}
      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              eyebrow="The limit"
              title={
                <>
                  Every run states <Accent>the strongest claim it is allowed to make</Accent>.
                </>
              }
              lede="Simulation, generated evidence, provider availability, and export eligibility are not physical guarantees. The ceiling is part of the deliverable, not a disclaimer buried at the bottom."
            />
            <Reveal className="mt-8">
              <ProofBoundary level="warn" title="Claim ceiling">
                A run returns only the decisions supported inside its stated validation envelope.
                Estimates are not physical guarantees, safety approval remains external, and claims
                that cannot be supported virtually still require physical evidence.
              </ProofBoundary>
            </Reveal>
          </div>

          <FigureFrame
            eyebrow="Figure 04 — Claim ceiling"
            title="What a run carries, and what sits above the line"
            kind="schematic"
            note="Schematic. The hatched rows are never delivered by a run at any price or evidence strength."
          >
            <ClaimCeilingFigure />
          </FigureFrame>
        </div>
      </Section>

      <BigCta
        eyebrow="One intake"
        title={
          <>
            Robot teams and site operators <br className="hidden sm:block" />
            use the same six steps.
          </>
        }
        body="Same request contract, same result model, same call to action. The only difference is which question you walk in with."
        imageSrc="/redesign/pov/retail-backroom.jpg"
        imageAlt="Retail backroom aisle used as a real site-task"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=how-it-works"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/pricing"
        secondaryLabel="How runs are scoped"
      />
    </>
  );
}
