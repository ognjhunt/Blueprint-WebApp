import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import RobotTeamEval from "@/pages/RobotTeamEval";
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
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyBeachheadShort,
} from "@/data/robotPolicyEvaluationClaims";

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
    body: "Rank rigid tote-handling and pick-and-place policies on a captured aisle before committing integration time to a live facility.",
  },
  {
    image: "/redesign/pov/route-scan.jpg",
    title: "Autonomous navigation",
    body: "Compare mobile-base movement and aisle-traversal policies on a captured indoor route, with OOD flags surfaced per run.",
  },
  {
    image: "/redesign/pov/loading-dock.jpg",
    title: "Rigid load / unload",
    body: "Rank checkpoints on a captured dock or staging cell for rigid load and unload, with cycle-time and OOD evidence attached.",
  },
];

const included = [
  "Site-specific capture package with manifest and provenance",
  "Task suite, episode budget, and success thresholds you control",
  "PolicyRankBar comparison across your submitted policies",
  "Failure clusters and out-of-distribution flags per run",
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
                    Rank your policies on a real site — before field time.
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
                      href="#intake"
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

        {/* After the ranking — Policy Improvement Runs demoted to a follow-on teaser */}
        <section className="border-t border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-12 lg:py-14">
            <div className="grid gap-6 rounded-md border border-line bg-white p-6 lg:grid-cols-[0.34fr_0.66fr] lg:items-center lg:p-8">
              <div>
                <Eyebrow tone="muted">Follow-on, later</Eyebrow>
                <h2 className="mt-3 text-title-m font-semibold tracking-tight text-ink-900">
                  After the ranking: Policy Improvement Runs.
                </h2>
              </div>
              <div>
                <p className="text-sm leading-[1.7] text-ink-500">
                  Ranking is the front door. Once you know where a policy falls
                  short, a separate sim-only improvement loop can work the dominant
                  failure modes on the same captured site — baseline eval, failure
                  diagnosis, twin/cousin scenarios, curriculum, and a sealed
                  regression set. An improved policy artifact is delivered only when
                  your team exposes an approved trainable surface — an adapter,
                  controller, reward, fine-tuning endpoint, or distillation path;
                  black-box-only engagements get evidence and recommendations, not
                  edited weights.
                </p>
                <a
                  href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-improvement-run&requestedOutputs=Policy%20Improvement%20Run&source=for-robot-teams"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 underline underline-offset-4 hover:text-ink-900"
                >
                  Scope an improvement run later
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing — Policy Shortlist, one fixed-price campaign */}
        <section className="border-y border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              eyebrow="Pricing"
              title="One campaign. One shortlist. $3,000."
              description="A Policy Shortlist evaluates up to five of your policies or checkpoints against the same captured site and task, then names the two or three strongest for an onsite pilot. Fixed price — no subscription to start."
              className="max-w-3xl"
            />
            <TileGrid cols={2} className="mt-10">
              {/* Policy Shortlist — the one campaign, highlighted dark */}
              <div className="relative flex h-full flex-col overflow-hidden bg-ink p-8 text-[color:var(--text-on-ink)]">
                <div className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-25" />
                <div className="relative flex items-center justify-between">
                  <Eyebrow tone="onInk">Policy Shortlist</Eyebrow>
                  <StatusChip tone="info" square dot={false}>
                    Campaign
                  </StatusChip>
                </div>
                <div className="relative mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-[2.5rem] font-medium leading-none tracking-tight text-[color:var(--text-on-ink)]">
                    $3,000
                  </span>
                  <span className="font-mono text-sm text-ink-300">/ campaign</span>
                </div>
                <p className="relative mt-4 text-sm leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
                  You already have a site and several candidate policies. Blueprint
                  ranks them on the same captured site and task, and returns the two
                  or three that deserve an onsite pilot.
                </p>
                <ul className="relative mt-6 flex flex-1 flex-col gap-3">
                  {[
                    "One site and deployment task",
                    "Up to five policies or checkpoints",
                    "Confidence-aware comparative evaluation",
                    "Failure patterns and review media",
                    "Onsite pilot recommendation",
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
                  Capture of a normal local site is included. The result may be
                  &ldquo;ranking inconclusive&rdquo; — Blueprint never manufactures a
                  winner.
                </p>
                <Button asChild variant="brass" size="lg" full className="relative mt-6">
                  <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-shortlist&requestedOutputs=Policy%20Shortlist&source=for-robot-teams">
                    Rank my policies
                  </a>
                </Button>
              </div>

              {/* Repeat campaigns — volume, no subscription until a real cadence */}
              <div className="flex h-full flex-col bg-white p-8">
                <Eyebrow tone="muted">Repeat campaigns</Eyebrow>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-[2.5rem] font-medium leading-none tracking-tight text-ink-900">
                    Volume
                  </span>
                  <span className="font-mono text-sm text-ink-500">/ negotiated</span>
                </div>
                <p className="mt-4 text-sm leading-[1.7] text-ink-500">
                  Running campaigns on a cadence? Repeat campaigns get privately
                  negotiated volume pricing instead of a subscription you do not
                  need yet.
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {[
                    "Example: four campaigns for $10,000",
                    "Or a quarterly campaign commitment",
                    "Priority capture and recapture routing",
                    "A subscription only after a real cadence",
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
                  Best for teams comparing policies on a recurring cadence.
                </p>
                <Button asChild variant="secondary" size="lg" full className="mt-6">
                  <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=volume-campaigns&requestedOutputs=Volume%20Campaigns&source=for-robot-teams">
                    Discuss volume
                  </a>
                </Button>
              </div>
            </TileGrid>
            <ProofBoundary level="info" title="What the campaign is — and is not" className="mt-8">
              A Policy Shortlist ranks candidates inside Blueprint&rsquo;s configured
              evaluator and estimates their suitability for an onsite pilot. It does
              not prove physical performance, safety, reliability, or deployment
              readiness — you are buying a better pilot decision, not a guarantee.
              <a
                href="/pricing"
                className="ml-2 font-semibold text-blue-700"
              >
                See full pricing
              </a>
            </ProofBoundary>
          </div>
        </section>

        {/* Private hardware — compressed to a compact inset */}
        <section className="border-t border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-12 lg:py-14">
            <div className="rounded-md border border-line bg-white p-6 lg:p-8">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between">
                <div>
                  <Eyebrow tone="muted">Private hardware · secondary</Eyebrow>
                  <h2 className="mt-2 text-title-m font-semibold tracking-tight text-ink-900">
                    Keep checkpoints inside your perimeter.
                  </h2>
                </div>
                <p className="max-w-[38rem] text-sm leading-[1.7] text-ink-500">
                  Same evaluation runtime, same proof discipline —{" "}
                  {hostingModels
                    .map((m) => `${m.name} (${m.price})`)
                    .join(", ")}
                  . Available for teams that cannot send policy weights off their own
                  infrastructure.
                </p>
              </div>
              <div className="mt-6">
                <ProofBoundary level="info" title="Where evaluation runs">
                  Hosting model does not change the proof boundary. Generated and
                  simulated media stay labeled as review support, and predicted-success
                  figures remain estimates of rank fidelity — never a claim of field
                  outcome.
                </ProofBoundary>
              </div>
            </div>
          </div>
        </section>

        {/* Use cases — 3 image cards */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialSectionIntro
            eyebrow="Use cases"
            title="Built for the tasks robots actually run."
            description="Captured sites lead with mobility and navigation plus rigid pick-and-place — the indoor movement and load/unload work where the evidence is strongest today. The imagery below is illustrative and does not represent live supply."
            className="max-w-3xl"
          />
          <p className="mt-5 max-w-3xl text-sm leading-[1.7] text-ink-500">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
              {robotPolicyBeachheadShort}
            </span>
            <span className="mt-2 block">{robotPolicyEvaluationBeachhead}</span>
          </p>
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

        {/* Robot-team evaluation intake — merged in from the former /robot-team/eval page */}
        <RobotTeamEval embedded />

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
