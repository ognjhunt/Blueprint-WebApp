import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

import {
  Button,
  Card,
  Eyebrow,
  PolicyRankBar,
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
import { cn } from "@/lib/utils";

const HERO_IMAGE = "/redesign/pov/factory-conveyor.jpg";

const workflowSteps = [
  {
    step: "01",
    title: "Real indoor site",
    body: "Evaluation begins on a real captured facility — a factory line, warehouse, or packing cell — not an abstract benchmark or a simulated stage.",
    proof: "Site Card · task context · indoor route",
  },
  {
    step: "02",
    title: "Capture & provenance",
    body: "The walkthrough becomes a site-specific package with the capture manifest, timestamps, and rights and privacy notes attached.",
    proof: "Capture manifest · provenance record · rights packet",
  },
  {
    step: "03",
    title: "Task suite & thresholds",
    body: "You define the task suite, episode budget, and success thresholds the comparison will rank against — set per site, not assumed.",
    proof: "Task Card · 100 / 500 episodes · thresholds",
  },
  {
    step: "04",
    title: "Readiness evidence",
    body: "Policies are ranked by predicted success with failure clusters and OOD flags surfaced — an estimate of rank fidelity, never a guarantee of field outcome.",
    proof: "PolicyRankBar · failure clusters · OOD flags",
  },
  {
    step: "05",
    title: "Policy improvement",
    body: "Convert measured failures into prioritized scenarios, curriculum recommendations, and a sealed regression set. An improved policy artifact is included only when your team provides an approved trainable adapter, controller, reward, or fine-tuning path.",
    proof: "Failure clusters · curriculum · sealed regression set",
  },
  {
    step: "06",
    title: "Pilot protocol",
    body: "The request ends in a decision: export the package, kick off a narrower follow-up, recapture, or move the leading policy into a scoped pilot protocol.",
    proof: "Export request · pilot protocol · next-step record",
  },
];

const hostingModels = [
  {
    name: "Hosted runtime",
    price: "Included",
    body: "Run comparisons against the site package on Blueprint-hosted runtime. No hardware to stand up — request a run and review the readiness evidence.",
    points: ["Managed compute", "No on-prem setup", "Review-scoped access windows"],
  },
  {
    name: "Private cloud",
    price: "Custom",
    body: "Bring your own VPC. Blueprint deploys the evaluation runtime into your cloud account so packages and policy endpoints stay inside your perimeter.",
    points: ["Your VPC / account", "Egress controls", "Provenance preserved"],
  },
  {
    name: "On-site hardware",
    price: "Custom",
    body: "For teams that keep checkpoints air-gapped, the runtime ships to dedicated on-site hardware with the same proof boundaries and manifest discipline.",
    points: ["Air-gapped option", "Dedicated hardware", "Same proof discipline"],
  },
];

const useCases = [
  {
    image: "/redesign/pov/warehouse-tote.jpg",
    title: "Warehouse picking",
    body: "Rank tote-handling policies on a captured aisle before committing integration time to a live facility.",
  },
  {
    image: "/redesign/pov/machine-tending.jpg",
    title: "Machine tending",
    body: "Compare checkpoints on a real machine-tending cell with cycle-time and OOD evidence attached.",
  },
  {
    image: "/redesign/pov/packing-cell.jpg",
    title: "Packing & kitting",
    body: "Test manipulation policies against a packing cell's real clutter and lighting, not a clean benchmark.",
  },
];

const included = [
  "Site-specific capture package with manifest and provenance",
  "Task suite, episode budget, and success thresholds you control",
  "PolicyRankBar comparison across your submitted policies",
  "Failure clusters and out-of-distribution flags per run",
  "Policy Improvement Run path from measured failures to sealed regression",
  "Rights and privacy packet attached to every export",
  "Hosted review path with scoped access windows",
];

function HeroRankCard() {
  return (
    <div className="w-full max-w-[20rem] border border-white/10 bg-[rgba(13,13,11,0.5)] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <Eyebrow tone="onInk">Sample readout</Eyebrow>
        <StatusChip tone="info" square dot={false}>
          Illustrative run
        </StatusChip>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <PolicyRankBar
          onInk
          rank="1"
          winner
          label="Vendor B"
          value={0.88}
          metric="0.88"
        />
        <PolicyRankBar onInk rank="2" label="Team v4" value={0.72} metric="0.72" />
        <PolicyRankBar onInk rank="3" label="Team v3" value={0.61} metric="0.61" />
      </div>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-300">
        Predicted success · 500 episodes · est. rank fidelity
      </p>
    </div>
  );
}

export default function ForRobotTeams() {
  return (
    <>
      <SEO
        title="For Robot Teams | Blueprint"
        description="Blueprint ranks robot policies on real captured indoor sites — with provenance, task thresholds, and readiness evidence — before you commit field time."
        canonical="/for-robot-teams"
        jsonLd={[
          webPageJsonLd({
            path: "/for-robot-teams",
            name: "Blueprint for Robot Teams",
            description:
              "Policy evaluation for robot teams: submit a policy API endpoint, Docker container, model checkpoint, traces, or teleop demos and rank policies on captured real-site task packs before field time.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For Robot Teams", path: "/for-robot-teams" },
          ]),
        ]}
      />

      <div className="bg-canvas text-ink">
        {/* Hero */}
        <section className="relative">
          <MonochromeMedia
            src={HERO_IMAGE}
            alt="Captured factory conveyor line used as a robot evaluation site"
            loading="eager"
            radius="none"
            overlay="heroL"
            className="min-h-[44rem]"
            imageClassName="min-h-[44rem]"
          >
            <div className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-40" />
            <RouteTraceOverlay className="opacity-70" />
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] items-end gap-10 px-7 py-14 lg:grid-cols-[0.62fr_0.38fr] lg:py-20">
                <div className="flex min-h-[34rem] flex-col justify-end">
                  <Eyebrow tone="brass" rule>
                    For Robot Teams
                  </Eyebrow>
                  <h1 className="mt-6 max-w-[40rem] font-display text-[clamp(3rem,5.4vw,5rem)] font-medium leading-[0.95] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
                    Rank robot policies on real sites before field time.
                  </h1>
                  <p className="mt-6 max-w-[34rem] text-[1.1rem] leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
                    Submit your checkpoints and compare them on a captured indoor
                    facility — with the task suite, thresholds, and provenance you
                    control. You get an estimate of rank fidelity, not a promise of
                    field success.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    <ProofChip light>Capture-backed sites</ProofChip>
                    <ProofChip light>Proof-gated verdicts</ProofChip>
                    <ProofChip light>Rights travel with exports</ProofChip>
                  </div>
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="brass" size="lg" iconRight={<ArrowRight />}>
                      <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&source=for-robot-teams">
                        Request evaluation
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="text-[color:var(--text-on-ink)] hover:bg-white/5"
                    >
                      <a href="/sites">Browse site records</a>
                    </Button>
                  </div>
                  <p className="mt-4 text-sm text-[color:var(--text-on-ink)] opacity-75">
                    Already know the policy modalities and robot interface?{" "}
                    <a
                      href="/robot-team/eval"
                      className="font-semibold underline underline-offset-4 hover:opacity-100"
                    >
                      Configure policy inputs
                    </a>
                    .
                  </p>
                </div>
                <div className="hidden items-end justify-end lg:flex">
                  <HeroRankCard />
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        {/* Workflow — evaluation through improvement */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialSectionIntro
            eyebrow="Workflow"
            title="From a real site to a ranked, improvable decision."
            description="Six steps move a captured facility into evaluation evidence, then turn measured failures into a scoped improvement path. Each step keeps its proof attached."
            className="max-w-3xl"
          />
          <TileGrid cols={3} className="mt-10">
            {workflowSteps.map((item) => (
              <div key={item.step} className="flex h-full flex-col bg-white p-6">
                <span className="font-mono text-[0.8rem] font-semibold text-brass-deep">
                  {item.step}
                </span>
                <h3 className="mt-4 text-title-m font-semibold tracking-tight text-ink-900">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-[1.7] text-ink-500">
                  {item.body}
                </p>
                <p className="mt-6 border-t border-line-soft pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                  {item.proof}
                </p>
              </div>
            ))}
          </TileGrid>
        </section>

        {/* Policy Improvement Runs — the second half of the wedge */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              eyebrow="After the ranking"
              title="Policy Improvement Runs: close the gap in simulation."
              description="When an evaluation shows where your policy falls short, a sim-only improvement loop works the dominant failure modes on the same captured site — baseline eval, failure diagnosis, twin/cousin scenarios, curriculum, sealed scenario tests, and an evidence report."
              className="max-w-3xl"
            />
            <TileGrid cols={3} className="mt-10">
              {[
                {
                  title: "Source-access optional",
                  body: "Run black-box through an API endpoint, container, private-cloud runner, sim plugin, or action traces. Your weights never have to leave your stack.",
                  proof: "Black-box runner · action traces",
                },
                {
                  title: "Closed-stack support",
                  body: "Failure clusters, twin/cousin scenarios, curriculum, regression packs, and recommended training changes — usable even when we never touch the policy internals.",
                  proof: "Failure clusters · curriculum · regression packs",
                },
                {
                  title: "Improved artifacts, gated honestly",
                  body: "An improved policy artifact is delivered only when you expose a trainable surface — adapter hooks, a task head, a fine-tuning API, or a policy wrapper. Black-box-only engagements get evidence and recommendations, not edited weights.",
                  proof: "Trainable surface required for artifacts",
                },
              ].map((item) => (
                <div key={item.title} className="flex h-full flex-col bg-white p-6">
                  <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-[1.7] text-ink-500">
                    {item.body}
                  </p>
                  <p className="mt-6 border-t border-line-soft pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                    {item.proof}
                  </p>
                </div>
              ))}
            </TileGrid>
            <div className="mt-8">
              <Button asChild variant="secondary" size="lg" iconRight={<ArrowRight />}>
                <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-improvement-run&requestedOutputs=Policy%20Improvement%20Run&source=for-robot-teams">
                  Scope an improvement run
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Pricing — 2-col, subscription highlighted dark */}
        <section className="border-y border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              eyebrow="Pricing"
              title="Priced as evaluation infrastructure."
              description="Start with a single quick-look comparison, or move to a subscription when policy iteration is continuous. All figures below are illustrative."
              className="max-w-3xl"
            />
            <TileGrid cols={2} className="mt-10">
              {/* Quick-look */}
              <div className="flex h-full flex-col bg-white p-8">
                <Eyebrow tone="muted">Quick-look</Eyebrow>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-[2.5rem] font-medium leading-none tracking-tight text-ink-900">
                    $5–8k
                  </span>
                  <span className="font-mono text-sm text-ink-500">/ comparison</span>
                </div>
                <p className="mt-4 text-sm leading-[1.7] text-ink-500">
                  One ranked comparison on a captured site. Right-sized for a single
                  go / no-go decision before field time.
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {[
                    "One site package, one task suite",
                    "Up to 100 episodes per policy",
                    "PolicyRankBar + failure clusters",
                    "Export with rights packet attached",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-brass-deep"
                        strokeWidth={2}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[13px] text-ink-400">
                  Best for a first evaluation on a single facility.
                </p>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  full
                  className="mt-6"
                >
                  <a href="/contact/robot-team?persona=robot-team&plan=quick-look&source=for-robot-teams">
                    Request a quick-look
                  </a>
                </Button>
              </div>

              {/* Subscription — highlighted dark */}
              <div className="flex h-full flex-col bg-ink p-8 text-[color:var(--text-on-ink)]">
                <div className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-25" />
                <div className="relative flex items-center justify-between">
                  <Eyebrow tone="onInk">Robot-team subscription</Eyebrow>
                  <StatusChip tone="info" square dot={false}>
                    Primary
                  </StatusChip>
                </div>
                <div className="relative mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-[2.5rem] font-medium leading-none tracking-tight text-[color:var(--text-on-ink)]">
                    $15k
                  </span>
                  <span className="font-mono text-sm text-ink-300">/ month</span>
                </div>
                <p className="relative mt-4 text-sm leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
                  Continuous policy iteration across multiple sites and task suites,
                  with larger episode budgets and a hosted review path.
                </p>
                <ul className="relative mt-6 flex flex-1 flex-col gap-3">
                  {[
                    "Multiple site packages & task suites",
                    "Up to 500 episodes per policy",
                    "Comparison history across runs",
                    "Hosted runtime with access windows",
                    "Priority capture & recapture requests",
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-[color:var(--text-on-ink)] opacity-90"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-brass"
                        strokeWidth={2}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="relative mt-6 text-[13px] text-ink-300">
                  Best for teams shipping policy updates on a cadence.
                </p>
                <Button asChild variant="brass" size="lg" full className="relative mt-6">
                  <a href="/contact/robot-team?persona=robot-team&plan=subscription&source=for-robot-teams">
                    Talk to us about a subscription
                  </a>
                </Button>
              </div>
            </TileGrid>
            <ProofBoundary level="info" title="Policy Improvement Runs are source-access optional" className="mt-8">
              Blueprint can deliver failure prioritization, scenario design, curriculum recommendations,
              and a sealed regression pack from run evidence alone. Delivering an improved policy
              artifact additionally requires an approved trainable interface—such as an adapter,
              controller, reward, fine-tuning endpoint, or distillation path.
              <a
                href="/contact/robot-team?persona=robot-team&interest=policy-improvement-run&requestedOutputs=Policy%20Improvement%20Run&source=for-robot-teams"
                className="ml-2 font-semibold text-blue-700"
              >
                Scope an improvement run
              </a>
            </ProofBoundary>
          </div>
        </section>

        {/* Private hardware — dark section, 3 hosting models */}
        <section className="relative overflow-hidden bg-ink text-[color:var(--text-on-ink)]">
          <div className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              light
              eyebrow="Private hardware"
              title="Keep checkpoints inside your perimeter."
              description="Some teams cannot send policy weights off their own infrastructure. The same evaluation runtime — and the same proof discipline — deploys where your security model requires."
              className="max-w-3xl"
            />
            <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 lg:grid-cols-3">
              {hostingModels.map((model) => (
                <div key={model.name} className="bg-ink p-7">
                  <div className="flex items-center justify-between">
                    <h3 className="text-title-m font-semibold tracking-tight text-[color:var(--text-on-ink)]">
                      {model.name}
                    </h3>
                    <span className="font-mono text-[13px] text-brass">
                      {model.price}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-[1.7] text-[color:var(--text-on-ink)] opacity-75">
                    {model.body}
                  </p>
                  <ul className="mt-5 flex flex-col gap-2">
                    {model.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-300"
                      >
                        <span className="h-1 w-1 shrink-0 rounded-full bg-brass" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <ProofBoundary level="info" title="Where evaluation runs">
                Hosting model does not change the proof boundary. Generated and
                simulated media stay labeled as review support, and predicted-success
                figures remain estimates of rank fidelity — never a claim of field
                outcome.
              </ProofBoundary>
            </div>
          </div>
        </section>

        {/* Use cases — 3 image cards */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialSectionIntro
            eyebrow="Use cases"
            title="Built for the tasks robots actually run."
            description="Captured sites span the indoor environments where manipulation and mobility policies have to hold up. Imagery below is placeholder capture, shown as review support."
            className="max-w-3xl"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {useCases.map((uc) => (
              <Card key={uc.title} tone="card" pad="none" className="overflow-hidden">
                <MonochromeMedia
                  src={uc.image}
                  alt={`${uc.title} captured site`}
                  radius="none"
                  overlay="bg"
                  className="aspect-[4/3]"
                >
                  <span className="absolute left-3 top-3">
                    <StatusChip tone="ink" square dot={false}>
                      Review support
                    </StatusChip>
                  </span>
                </MonochromeMedia>
                <div className="p-6">
                  <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                    {uc.title}
                  </h3>
                  <p className="mt-3 text-sm leading-[1.7] text-ink-500">{uc.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Included checklist */}
        <section className="border-t border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.4fr_0.6fr]">
              <EditorialSectionIntro
                eyebrow="Included"
                title="What every evaluation ships with."
                description="No matter the tier, the package carries its own evidence and limits so results can be trusted and exports stay in scope."
              />
              <ul className="grid gap-px self-start overflow-hidden rounded-md border border-line bg-[#ded7c8] sm:grid-cols-2">
                {included.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      "flex items-start gap-3 bg-white p-5 text-sm leading-[1.6] text-ink-700",
                    )}
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-brass-deep"
                      strokeWidth={2}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-[88rem] px-7 pb-20 pt-4">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Bring your policies to a real site."
            description="Request an evaluation to compare your checkpoints on a captured facility with provenance, thresholds, and readiness evidence attached. Results are estimates of rank fidelity, not a guarantee of field outcome."
            imageSrc={HERO_IMAGE}
            imageAlt="Captured factory site for robot evaluation"
            primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&source=for-robot-teams-cta"
            primaryLabel="Request evaluation"
            secondaryHref="/sites"
            secondaryLabel="Browse site records"
            dark
          />
        </section>
      </div>
    </>
  );
}
