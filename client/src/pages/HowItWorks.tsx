import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  Eyebrow,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { TileGrid } from "@/components/site/TileGrid";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyScreeningValue,
} from "@/data/robotPolicyEvaluationClaims";
import {
  Boxes,
  ClipboardList,
  FileCheck2,
  GitCompareArrows,
  MapPin,
  ShieldCheck,
} from "lucide-react";

type PipelineStep = {
  step: string;
  badge: string;
  title: string;
  body: string;
  src: string;
  alt: string;
  proof: string[];
};

const pipelineSteps: PipelineStep[] = [
  {
    step: "01",
    badge: "Capture",
    title: "Capture the real indoor site.",
    body: "A vetted capturer walks the exact route a robot would run — recording the walkthrough, geometry where it is available, timestamps, and the conditions on the floor. The capture is the source of truth everything downstream points back to.",
    src: "/redesign/pov/route-scan.jpg",
    alt: "Capturer walking an indoor facility route",
    proof: [
      "Walkthrough media",
      "Capture timestamps",
      "Floor conditions and notes",
    ],
  },
  {
    step: "02",
    badge: "Package",
    title: "Package the proof and the limits.",
    body: "The raw capture becomes a versioned, site-specific package: a Site Card, Task Cards, scenario context, and a rights packet. Provenance and missing-evidence flags travel with it so nothing is implied that the capture cannot support.",
    src: "/redesign/pov/warehouse-tote.jpg",
    alt: "Warehouse tote handling station",
    proof: [
      "Site and Task Cards",
      "Provenance record",
      "Rights and privacy packet",
    ],
  },
  {
    step: "03",
    badge: "Evaluate",
    title: "Evaluate policies against the site.",
    body: "This is the payload of the run. Robot teams compare policies, checkpoints, and vendor runners on the packaged site, and the run returns the two or three strongest candidates for an onsite pilot — or reports that the ranking is inconclusive or that no candidate met the threshold. Blueprint never manufactures a winner. The output is a rank-fidelity comparison with failure clusters and review media — an estimate of relative readiness, never a guarantee of field success, and never a safety certification.",
    src: "/redesign/pov/loading-dock.jpg",
    alt: "Warehouse loading dock staging lane where mobile bases stage and move",
    proof: [
      "Ranked policy shortlist",
      "Failure clusters",
      "Review-support media",
    ],
  },
  {
    step: "04",
    badge: "Decide",
    title: "Decide the next test.",
    body: "Every run ends in a decision a team can act on: export the data package, request a recapture, narrow the scenario, or move to a field pilot. The proof boundary stays attached so the decision is grounded in what was actually captured.",
    src: "/redesign/pov/loading-dock.jpg",
    alt: "Loading dock staging area",
    proof: [
      "Export request",
      "Recapture call",
      "Next-test record",
    ],
  },
];

type VocabularyTile = {
  eyebrow: string;
  term: string;
  mono: string;
  body: string;
};

const vocabulary: VocabularyTile[] = [
  {
    eyebrow: "Package object",
    term: "Task Card",
    mono: "task_card",
    body: "A single job to evaluate on the site, with the start state, success condition, and constraints made explicit.",
  },
  {
    eyebrow: "Package object",
    term: "Eval Card",
    mono: "eval_card",
    body: "The record of one comparison run: policies, episode counts, thresholds, and the simulator-backed comparison support.",
  },
  {
    eyebrow: "Trust artifact",
    term: "Provenance record",
    mono: "provenance_record",
    body: "The chain of custody — capturer, device, timestamps, and processing steps — proving where each value came from.",
  },
  {
    eyebrow: "Trust artifact",
    term: "Rights packet",
    mono: "rights_packet",
    body: "The use-scope, consent, and commercialization terms attached to the capture and carried into every export.",
  },
];

type TruthRow = {
  num: string;
  label: string;
  tone: "proof" | "info" | "warn";
  chip: string;
  accent: string;
  body: string;
};

const truthHierarchy: TruthRow[] = [
  {
    num: "01",
    label: "Raw capture",
    tone: "proof",
    chip: "Proof",
    accent: "#1f6b4f",
    body: "The recorded walkthrough, geometry, and timestamps from the real site. This is the only ground truth — everything else is derived from or measured against it.",
  },
  {
    num: "02",
    label: "Derived data",
    tone: "info",
    chip: "Info",
    accent: "#2563a6",
    body: "Maps, segmentations, and metrics computed from the capture. Reliable for review, but labeled as derived so it is never mistaken for the raw record itself.",
  },
  {
    num: "03",
    label: "Sim preflight",
    tone: "warn",
    chip: "Advisory",
    accent: "#9a6a16",
    body: "Simulated rollouts run before field time. Useful for ranking and triage, but an estimate of relative readiness — never a guarantee or safety certification — not a measurement of how the policy behaves on the floor.",
  },
  {
    num: "04",
    label: "Generated media",
    tone: "warn",
    chip: "Review support",
    accent: "#9a6a16",
    body: "Rendered or generated clips that help a reviewer reason about a run. Always labeled as review support, never presented as real-world proof of an outcome.",
  },
];

const surfaceTiles = [
  {
    eyebrow: "Surface",
    label: "Buyer app",
    description:
      "Where robot teams configure a Task Evaluation Run per site, rank policies into a shortlist, and export a data package inside their access scope.",
    href: "/for-robot-teams",
  },
];

// Secondary, follow-on surfaces — supply and ops paths that support the run but
// are not co-equal product front doors.
const secondarySurfaces = [
  { label: "Capture app", href: "/capture" },
  { label: "Ops console", href: "/contact" },
  { label: "Public listings", href: "/sites" },
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="Capture first, package the proof, evaluate policies, and decide the next test. See how Blueprint moves from a real indoor capture to a rank-fidelity comparison without overclaiming readiness."
        canonical="/how-it-works"
        jsonLd={[
          webPageJsonLd({
            path: "/how-it-works",
            name: "How Blueprint Works",
            description:
              "How Blueprint moves from a real indoor capture to a rank-fidelity policy comparison: capture first, package the proof, evaluate policies, and decide the next test.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "How It Works", path: "/how-it-works" },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink">
        <MonochromeMedia
          src="/redesign/pov/route-scan.jpg"
          alt="Capturer scanning an indoor facility route"
          loading="eager"
          radius="none"
          overlay="heroL"
          className="absolute inset-0 h-full w-full"
          imageClassName="h-full w-full"
        />
        <RouteTraceOverlay className="opacity-90" />
        <div className="relative mx-auto flex min-h-[34rem] max-w-[88rem] flex-col justify-end px-5 pb-14 pt-28 sm:px-8 lg:px-10 lg:pb-20 lg:pt-36">
          <div className="max-w-[44rem]">
            <Eyebrow tone="onInk" rule>
              How it works
            </Eyebrow>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              How a Task Evaluation Run works.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
              Blueprint turns one real indoor capture into a versioned, rights-attached
              package that robot teams can evaluate against — so the next test is a
              decision, not a guess.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <ProofChip light>Capture-backed</ProofChip>
              <ProofChip light>Provenance attached</ProofChip>
              <ProofChip light>Rank fidelity, not guarantees</ProofChip>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="The pipeline"
            title="Four steps from real site to a decision."
            description="Blueprint sells one thing two ways: a Policy Shortlist for a robot team that brings its own candidates, or a Robot Match for a site operator comparing robot teams. Both capture the site first, package the proof, then rank candidates — the shortlist is the destination, not a middle step. Nothing is asserted that the capture cannot support."
          />
          <p className="mt-6 max-w-[46rem] text-[15px] leading-[1.7] text-ink-600">
            {robotPolicyScreeningValue}
          </p>
          <p className="mt-3 max-w-[46rem] rounded-sm border border-line bg-inset px-4 py-3 text-[14px] leading-[1.65] text-ink-600">
            <span className="font-semibold text-ink-900">Where the evidence is strongest today. </span>
            {robotPolicyEvaluationBeachhead}
          </p>

          <div className="mt-12 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8]">
            {pipelineSteps.map((stage) => (
              <article
                key={stage.step}
                className="grid bg-white lg:grid-cols-[0.34fr_0.66fr]"
              >
                <div className="relative min-h-[15rem] border-b border-line lg:border-b-0 lg:border-r">
                  <MonochromeMedia
                    src={stage.src}
                    alt={stage.alt}
                    radius="none"
                    overlay="bg"
                    className="h-full w-full"
                    imageClassName="h-full w-full"
                  />
                  <StatusChip
                    tone="ink"
                    square
                    dot={false}
                    className="absolute left-4 top-4 border-brass/40 bg-ink text-brass"
                  >
                    Step {stage.step} · {stage.badge}
                  </StatusChip>
                </div>
                <div className="flex flex-col justify-center gap-4 p-6 lg:p-10">
                  <Eyebrow tone="brass">{stage.badge}</Eyebrow>
                  <h3 className="font-display text-[1.7rem] font-medium leading-[1.05] tracking-[-0.03em] text-ink-900">
                    {stage.title}
                  </h3>
                  <p className="max-w-[40rem] text-[15px] leading-[1.7] text-ink-500">
                    {stage.body}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {stage.proof.map((item) => (
                      <li
                        key={item}
                        className="inline-flex items-center gap-2 border border-line bg-inset px-[0.6rem] py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-600"
                      >
                        <span
                          aria-hidden="true"
                          className="h-[0.4rem] w-[0.4rem] shrink-0 rounded-full bg-brass"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-line bg-paper p-6 lg:p-8">
            <Eyebrow tone="muted">After the run (later)</Eyebrow>
            <p className="mt-3 max-w-[52rem] text-[14px] leading-[1.7] text-ink-500">
              The ranked shortlist is where the run ends. Everything past it is a
              secondary, follow-on path a team can opt into later — never the reason to
              start. You can export the ranked comparison as a data package, request a
              recapture, narrow the scenario, or move to a field pilot; the proof boundary
              stays attached so any next step is grounded in what was actually captured.
              A <span className="font-medium text-ink-600">Policy Improvement Run</span> is
              an even-later add-on that turns measured failure clusters into prioritized
              scenarios, curriculum recommendations, and a sealed regression set — and an
              improved policy artifact requires a separately approved trainable interface.
            </p>
          </div>
        </div>
      </section>

      {/* Vocabulary */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="The vocabulary"
            title="The objects a package is built from."
            description="Every Blueprint package is assembled from the same named parts. The mono identifiers are how each object is referenced across the app, the API, and the manifest."
          />

          <TileGrid cols={4} className="mt-12">
            {vocabulary.map((item) => {
              const Icon =
                item.mono === "site_card"
                  ? MapPin
                  : item.mono === "task_card"
                    ? ClipboardList
                    : item.mono === "scenario_card"
                      ? GitCompareArrows
                      : item.mono === "eval_card"
                        ? FileCheck2
                        : item.mono === "rights_packet"
                          ? ShieldCheck
                          : Boxes;
              return (
                <div key={item.mono} className="flex h-full flex-col gap-4 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <Eyebrow tone="muted">{item.eyebrow}</Eyebrow>
                    <Icon
                      className="h-5 w-5 text-brass"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                      {item.term}
                    </h3>
                    <p className="mt-1 font-mono text-[13px] text-ink-500">
                      {item.mono}
                    </p>
                  </div>
                  <p className="text-sm leading-[1.65] text-ink-500">{item.body}</p>
                </div>
              );
            })}
          </TileGrid>
        </div>
      </section>

      {/* Truth hierarchy */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="Truth hierarchy"
            title="Not every value is proof."
            description="Blueprint keeps a strict order of trust. The raw capture is the only ground truth; everything derived, simulated, or generated is labeled as exactly that."
          />

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.62fr_0.38fr] lg:items-start">
            <div className="flex flex-col gap-3">
              {truthHierarchy.map((row) => (
                <div
                  key={row.num}
                  className="flex items-start gap-4 rounded-sm border border-line bg-white p-5"
                  style={{ borderLeft: `3px solid ${row.accent}` }}
                >
                  <span className="font-mono text-[1.4rem] font-medium leading-none text-ink-300">
                    {row.num}
                  </span>
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-ink-900">
                        {row.label}
                      </h3>
                      <StatusChip tone={row.tone} square>
                        {row.chip}
                      </StatusChip>
                    </div>
                    <p className="text-sm leading-[1.65] text-ink-500">{row.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <ProofBoundary
              level="proof"
              title="Never overclaimed"
              icon={ShieldCheck}
              className="lg:sticky lg:top-24"
            >
              <p>
                Derived metrics, simulated preflight, and generated media are useful for
                review and ranking — but they are always labeled as such and never
                presented as real-world proof of an outcome.
              </p>
              <p className="mt-3">
                Blueprint reports rank fidelity and estimates of relative readiness. It
                does not claim a policy is &ldquo;deployment ready&rdquo; or guarantee
                field success.
              </p>
            </ProofBoundary>
          </div>
        </div>
      </section>

      {/* Four surfaces */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="The buyer surface"
            title="Where robot teams run the evaluation."
            description="The Buyer app is the front door for robot and foundation-model teams — the one place the Task Evaluation Run is configured, ranked, and exported."
          />
          <TileGrid cols={1} items={surfaceTiles} className="mt-12" />
          <p className="mt-6 max-w-[52rem] text-[14px] leading-[1.65] text-ink-500">
            <span className="font-semibold text-ink-600">Supporting surfaces (secondary). </span>
            The capture-first truth chain also runs across the paid-supply and ops paths —{" "}
            {secondarySurfaces.map((surface, index) => (
              <span key={surface.href}>
                <a href={surface.href} className="underline decoration-line underline-offset-2 hover:text-ink-700">
                  {surface.label}
                </a>
                {index < secondarySurfaces.length - 1 ? ", " : ""}
              </span>
            ))}
            {" "}— but these support the run rather than serve as co-equal product front doors.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 lg:px-10 lg:pb-28">
          <EditorialCtaBand
            eyebrow="For robot & foundation-model teams"
            title="Rank your policies before you spend field time."
            description="Bring your candidate policies and a target site. A Task Evaluation Run returns a ranked shortlist — cheap screening that tells you which policy earns a pilot slot first, so scarce robot and field time goes to the strongest. An estimate and decision-support screen, never a guarantee or safety certification."
            imageSrc="/redesign/pov/cold-storage.jpg"
            imageAlt="Cold-storage warehouse aisle where a mobile base navigates and stages totes"
            primaryHref="/contact/robot-team?persona=robot-team&source=how-it-works"
            primaryLabel="Request evaluation"
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
        </div>
      </section>
    </>
  );
}
