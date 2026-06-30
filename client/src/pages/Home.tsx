import { SEO } from "@/components/SEO";
import { Button, Eyebrow, PolicyRankBar, ProofBoundary } from "@/components/blueprint";
import { TileGrid } from "@/components/site/TileGrid";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { robotPolicyEvaluationBoundary } from "@/data/robotPolicyEvaluationClaims";
import { ArrowRight } from "lucide-react";

const requestHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home";

const heroProofChips = [
  "Captured real sites",
  "Provenance attached",
  "Rank fidelity, not guarantees",
] as const;

const heroReadout: Array<{
  label: string;
  value: number;
  rank: string;
  winner?: boolean;
}> = [
  { label: "Vendor B", value: 0.88, rank: "1", winner: true },
  { label: "Team v4", value: 0.72, rank: "2" },
  { label: "Team v3", value: 0.41, rank: "3" },
];

const steps: Array<{ num: string; title: string; body: string }> = [
  {
    num: "01",
    title: "Capture the site",
    body: "A capturer records the real indoor site as a task pack — walkthrough media, depth, poses, and capture notes.",
  },
  {
    num: "02",
    title: "Package the evidence",
    body: "The capture becomes a site-specific package with provenance, rights, and privacy limits attached and visible.",
  },
  {
    num: "03",
    title: "Run the comparison",
    body: "Your policy is ranked against earlier checkpoints, another team, or a vendor runner on the same task envelope.",
  },
  {
    num: "04",
    title: "Decide the next test",
    body: "Use the ranking, failure clusters, and missing-proof labels to pilot, tune, recapture, or hold.",
  },
];

const comparisonStack: Array<{
  label: string;
  value: number;
  rank: string;
  winner?: boolean;
}> = [
  { label: "Vendor B", value: 0.88, rank: "1", winner: true },
  { label: "Team v4", value: 0.72, rank: "2" },
  { label: "Team v3", value: 0.61, rank: "3" },
  { label: "Checkpoint v2", value: 0.38, rank: "4" },
];

const povClips: Array<{ id: string; alt: string; span?: string }> = [
  { id: "factory-conveyor", alt: "First-person review clip of a factory conveyor task", span: "sm:col-span-2 sm:row-span-2" },
  { id: "warehouse-tote", alt: "First-person review clip of a warehouse tote task" },
  { id: "packing-cell", alt: "First-person review clip of a packing-cell task" },
  { id: "inspection-bench", alt: "First-person review clip of an inspection-bench task" },
  { id: "machine-tending", alt: "First-person review clip of a machine-tending task" },
  { id: "loading-dock", alt: "First-person review clip of a loading-dock task", span: "sm:col-span-2" },
  { id: "laundry-folding", alt: "First-person review clip of a laundry-folding task" },
  { id: "cold-storage", alt: "First-person review clip of a cold-storage task" },
  { id: "dishwasher", alt: "First-person review clip of a dishwasher task" },
  { id: "retail-backroom", alt: "First-person review clip of a retail-backroom task" },
];

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Test Robot Policies Before Field Time"
        description="Blueprint helps robot teams compare policies on captured real-site task packs, with provenance, rights, and proof boundaries attached. Rank policies before committing field time."
        canonical="/"
        image="https://tryblueprint.io/redesign/robot-hero.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Robot Policy Evaluation",
          description:
            "Capture-backed policy evaluation for comparing robot policies before field time.",
          url: "https://tryblueprint.io/",
        }}
      />

      <main className="bg-canvas text-ink-900">
        {/* (1) Hero — full-bleed monochrome media with animated route trace */}
        <section className="relative">
          {/* Height tracks robot-hero.png's native 1672x941 ratio (56.28vw) above the
              ~1308px width where that ratio exceeds 46rem, so object-cover stops
              cropping more of the image as the viewport gets wider; 70rem caps how
              tall the hero gets on ultrawide/4K screens. */}
          <MonochromeMedia
            src="/redesign/robot-hero.png"
            alt="Humanoid robot moving a tote inside a captured indoor facility"
            loading="eager"
            overlay="heroL"
            radius="none"
            className="h-[clamp(46rem,56.28vw,70rem)] w-full"
            imageClassName="h-full"
          >
            <RouteTraceOverlay className="opacity-90" />
            <div className="absolute inset-0 flex items-end">
              <div className="mx-auto grid w-full max-w-container gap-10 px-7 pb-14 lg:grid-cols-[0.62fr_0.38fr] lg:items-end">
                <div className="bp-fade-up">
                  <Eyebrow tone="brass" rule>
                    Real-site robot evaluation
                  </Eyebrow>
                  <h1 className="mt-5 max-w-[18ch] font-display font-medium leading-[1.0] tracking-[-0.045em] text-[color:var(--text-on-ink)] [font-size:clamp(3rem,5.4vw,5rem)]">
                    Test robot policies before field time.
                  </h1>
                  <p className="mt-6 max-w-[34rem] text-[1.1rem] leading-[1.6] text-[#f3efe6]/80">
                    Compare your policy against earlier checkpoints, another team,
                    or a vendor runner on the same captured task pack — with
                    provenance and proof boundaries attached.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {heroProofChips.map((chip) => (
                      <ProofChip key={chip} light>
                        {chip}
                      </ProofChip>
                    ))}
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      variant="brass"
                      size="lg"
                      iconRight={<ArrowRight aria-hidden="true" />}
                    >
                      <a href={requestHref}>Request evaluation</a>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="text-[color:var(--text-on-ink)] hover:bg-white/10"
                    >
                      <a href="/how-it-works">See how it works</a>
                    </Button>
                  </div>
                </div>

                {/* Right: glass policy-rank readout card */}
                <div
                  className="bp-fade-up rounded-md border border-white/12 p-5 backdrop-blur-md"
                  style={{ backgroundColor: "rgba(13,13,11,0.5)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f3efe6]/70">
                      Policy rank
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-brass-lit">
                      RUN-2049
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-[#f3efe6]/55">
                    Packing cell · 500 episodes · rank fidelity
                  </p>
                  <div className="mt-5 grid gap-3.5">
                    {heroReadout.map((row) => (
                      <PolicyRankBar
                        key={row.label}
                        onInk
                        label={row.label}
                        value={row.value}
                        rank={row.rank}
                        winner={row.winner}
                      />
                    ))}
                  </div>
                  <p className="mt-5 border-t border-white/10 pt-3 font-mono text-[11px] leading-[1.5] text-[#f3efe6]/55">
                    Illustrative readout. Generated and simulated media is review
                    support — not real-world proof.
                  </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        {/* (2) How it works — 4-step TileGrid */}
        <section className="border-b border-line bg-canvas">
          <div className="mx-auto max-w-container px-7 py-16">
            <EditorialSectionIntro
              eyebrow="How it works"
              title="Capture first. Package the proof. Decide the next test."
              description="A run is configured per site. Blueprint turns a real captured site into a comparable task envelope so you can rank policies before spending scarce robot time."
            />
            <TileGrid cols={4} className="mt-10">
              {steps.map((step) => (
                <div key={step.num} className="flex h-full flex-col gap-6 bg-white p-6">
                  <span className="font-mono text-[1.6rem] font-semibold leading-none text-brass-deep">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="text-title-m font-semibold text-ink-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-body-s leading-[1.55] text-ink-500">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </TileGrid>
          </div>
        </section>

        {/* (3) Comparison band */}
        <section className="border-b border-line bg-inset">
          <div className="mx-auto grid max-w-container gap-12 px-7 py-16 lg:grid-cols-[0.42fr_0.58fr] lg:items-center">
            <EditorialSectionIntro
              eyebrow="Same task, same robot"
              title="One captured envelope. A clear policy ranking."
              description="Compare your own checkpoints or policies submitted by other teams and vendors under one captured site, task, and threshold scope. Rankings are diagnostic rank fidelity, not a universal accuracy guarantee."
            />
            <div className="rounded-md border border-line bg-white p-6 shadow-md">
              <div className="flex items-center justify-between gap-3 border-b border-line-soft pb-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  Predicted success
                </span>
                <span className="font-mono text-[12px] text-ink-500">
                  RUN-2049 · 500 episodes
                </span>
              </div>
              <div className="mt-5 grid gap-4">
                {comparisonStack.map((row) => (
                  <PolicyRankBar
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    rank={row.rank}
                    winner={row.winner}
                  />
                ))}
              </div>
              <p className="mt-5 border-t border-line-soft pt-4 font-mono text-[11px] leading-[1.5] text-ink-400">
                Illustrative values. Correlation reference 0.929 (SC3-Eval).
              </p>
            </div>
          </div>
        </section>

        {/* (4) Command-center band — POV clip mosaic */}
        <section className="relative overflow-hidden bg-ink text-[color:var(--text-on-ink)]">
          <div className="pointer-events-none absolute inset-0 bp-evidence-grid opacity-60" aria-hidden="true" />
          <div className="relative mx-auto max-w-container px-7 py-16">
            <div className="grid gap-10 lg:grid-cols-[0.34fr_0.66fr] lg:items-start">
              <div className="max-w-md">
                <EditorialSectionIntro
                  light
                  eyebrow="Command center"
                  title="See the clips."
                  description="First-person POV clips make policy failures easier to review across factory, warehouse, industrial, and home-task variants."
                />
                <div className="mt-7">
                  <ProofBoundary
                    level="warn"
                    title="Review media, not real-world proof"
                    className="bg-warn-bg/95"
                  >
                    Generated and simulated POV clips are review support for
                    inspecting failure modes. Raw capture is the only real-world
                    proof in a package.
                  </ProofBoundary>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:auto-rows-[8.5rem]">
                {povClips.map((clip) => (
                  <figure
                    key={clip.id}
                    className={`overflow-hidden rounded-md border border-white/10 ${clip.span ?? ""}`}
                  >
                    <MonochromeMedia
                      src={`/redesign/pov/${clip.id}.jpg`}
                      alt={clip.alt}
                      radius="none"
                      overlay="soft"
                      className="h-full w-full"
                      imageClassName="h-full"
                    />
                  </figure>
                ))}
              </div>
            </div>

            <p className="mt-10 max-w-4xl border-t border-white/10 pt-6 font-mono text-[11px] leading-[1.6] text-[#f3efe6]/55">
              Boundary: {robotPolicyEvaluationBoundary}
            </p>
          </div>
        </section>

        {/* (5) CTA close */}
        <section className="bg-canvas">
          <div className="mx-auto max-w-container px-7 py-16">
            <EditorialCtaBand
              eyebrow="Request evaluation"
              title="Rank your policies before field time."
              description="Bring your checkpoints, a teammate's policy, or a vendor runner. We package a captured real site and return a ranked, proof-bounded readout."
              imageSrc="/redesign/pov/route-scan.jpg"
              imageAlt="Monochrome capture of an indoor route scan"
              primaryHref={requestHref}
              primaryLabel="Request evaluation"
              secondaryHref="/how-it-works"
              secondaryLabel="See how it works"
            />
          </div>
        </section>
      </main>
    </>
  );
}
