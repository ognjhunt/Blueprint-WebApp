import { SEO } from "@/components/SEO";
import {
  humanoidReadinessAssets,
  robotMosaicHeroAssets,
} from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  Building2,
  Clock,
  Gauge,
  PackageCheck,
  Route,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const requestHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home-policy-evaluation";

const hostedHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=100&source=home-policy-evaluation-secondary";

const pricingHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home-pricing-policy-evaluation";

const operatorHref = "/contact/site-operator?source=home-kiss";

type IconBlock = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
};

const buyerBars: IconBlock[] = [
  {
    icon: Target,
    label: "Predicted success",
    title: "Which policy is most likely to complete the task?",
    body: "Rank 1-3 policies/checkpoints against the same captured task pack before field time.",
  },
  {
    icon: Gauge,
    label: "Policy ranking",
    title: "Which checkpoint deserves validation first?",
    body: "Compare per-scenario metrics, rank order, and uncertainty flags instead of relying on a single aggregate score.",
  },
  {
    icon: Clock,
    label: "Failure taxonomy",
    title: "Where does behavior break down?",
    body: "Group collisions, stalls, perception misses, recovery loops, and timing misses into a reviewable failure map.",
  },
  {
    icon: ShieldCheck,
    label: "Validation targets",
    title: "What should real-world rollouts test next?",
    body: "Use OOD flags and scenario metrics to choose the smallest useful set of robot-time validation targets.",
  },
];

const offerItems: IconBlock[] = [
  {
    icon: Route,
    label: "Scope",
    title: "Policy Evaluation Run",
    body: "100 or 500 WAM-eval episodes across 1 site package, 1 task pack, 1 robot embodiment, and 1-3 policies/checkpoints.",
  },
  {
    icon: PackageCheck,
    label: "Outputs",
    title: "Ranked policy evidence packet",
    body: "Predicted success, policy ranking, failure taxonomy, per-scenario metrics, OOD/uncertainty flags, generated rollout clips, and recommended real-world validation targets.",
  },
];

const workflowSteps = [
  {
    title: "Select the captured task pack",
    body: "Anchor the run to 1 real-site package and 1 task pack with clear starts, goals, constraints, and scenario variants.",
  },
  {
    title: "Lock robot embodiment and policies",
    body: "Choose 1 robot embodiment and submit 1-3 policies/checkpoints for the same evaluation envelope.",
  },
  {
    title: "Pick 100 or 500 WAM-eval episodes",
    body: "Use the smaller run for fast ranking and the larger run when scenario coverage or failure discovery needs more depth.",
  },
  {
    title: "Review rankings and failures",
    body: "Inspect predicted success, rank order, failure taxonomy, per-scenario metrics, OOD/uncertainty flags, and generated rollout clips.",
  },
  {
    title: "Choose real-world validation targets",
    body: "WAM/VLA output ranks and discovers failures before robot time; field validation targets stay scoped to the same robot/task/site envelope.",
  },
];

const pricingPlans = [
  {
    name: "100 WAM-eval episodes",
    price: "From $6,500 / run",
    summary:
      "Policy Evaluation Run for 1 site package, 1 task pack, 1 robot embodiment, and 1-3 policies/checkpoints when you need fast pre-field ranking.",
    href: hostedHref,
    cta: "Request 100-episode run",
  },
  {
    name: "500 WAM-eval episodes",
    price: "From $18,000 / run",
    summary:
      "Expanded Policy Evaluation Run with deeper failure discovery, per-scenario metrics, OOD/uncertainty flags, rollout clips, and validation target recommendations.",
    href: pricingHref,
    cta: "Request 500-episode run",
  },
];

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-4xl font-semibold leading-tight text-[#111110] md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#4f4a43] md:text-lg">
        {body}
      </p>
    </div>
  );
}

function IconCard({ item }: { item: IconBlock }) {
  const Icon = item.icon;

  return (
    <article className="border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
          {item.label}
        </span>
        <Icon className="h-5 w-5 text-[#111110]" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-semibold leading-snug text-[#111110]">
        {item.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-[#5f5a53]">{item.body}</p>
    </article>
  );
}

export default function Home() {
  return (
    <>
      <SEO
        title="Real-Site Robot Evaluation | Blueprint"
        description="Blueprint helps robot teams evaluate and rank 1-3 policies on captured real-site task packs with 100 or 500 WAM-eval episodes before field time."
        canonical="/"
        image={`https://tryblueprint.io${humanoidReadinessAssets.warehouseHero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Real-Site Robot Evaluation",
          description:
            "Blueprint helps robot teams evaluate and rank 1-3 policies on captured real-site task packs with 100 or 500 WAM-eval episodes before field time.",
          url: "https://tryblueprint.io/",
        }}
      />

      <div className="bg-[#f6f1e8] text-[#111110]">
        <section
          className="relative min-h-[78vh] overflow-hidden bg-[#111110] text-white"
          data-home-section="hero"
        >
          <img
            src={robotMosaicHeroAssets.industrialScenarioMosaic}
            alt="Generated mosaic of Figure-style humanoid robots handling warehouse and factory evaluation tasks"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_56%,rgba(216,189,141,0.16),transparent_24%),linear-gradient(90deg,rgba(0,0,0,0.52),rgba(0,0,0,0.28)_42%,rgba(0,0,0,0.58))]" />
          <div className="absolute inset-0 bg-black/28" />
          <div className="relative mx-auto flex min-h-[78vh] max-w-[88rem] flex-col justify-end px-4 pb-12 pt-24 sm:px-6 lg:px-10">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-[#d8bd8d]">
                Real-site robot evaluation
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-none md:text-7xl">
                Evaluate and rank robot policies on captured real-site task
                packs before field time.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
                Blueprint runs Policy Evaluation Runs: 100 or 500 WAM-eval
                episodes across 1 site package, 1 task pack, 1 robot embodiment,
                and 1-3 policies/checkpoints.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Outputs include predicted success, policy ranking, failure
                taxonomy, per-scenario metrics, OOD/uncertainty flags, generated
                rollout clips, and recommended real-world validation targets.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
                >
                  Request policy evaluation
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={operatorHref}
                  className="inline-flex min-h-12 items-center justify-center border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Submit site free
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white px-4 py-10 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[88rem]">
            <div className="border border-black/10 bg-[#f8f4ec] p-5">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                Policy Evaluation Run
              </p>
              <p className="mt-2 text-xl font-semibold leading-snug text-[#111110] md:text-2xl">
                One Policy Evaluation Run = 100 or 500 WAM-eval episodes × 1
                site package × 1 task pack × 1 robot embodiment × 1-3
                policies/checkpoints.
              </p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {buyerBars.map((item) => (
                <IconCard key={item.label} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section
          className="px-4 py-16 sm:px-6 lg:px-10"
          data-home-section="offer"
        >
          <div className="mx-auto max-w-[88rem]">
            <SectionHeading
              eyebrow="What Blueprint sells"
              title="One primary pre-field offer."
              body="Use a Policy Evaluation Run to compare checkpoints on captured real-site tasks, find the failure modes worth fixing, and pick the scenarios that deserve robot time next."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {offerItems.map((item) => (
                <IconCard key={item.label} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-black/10 bg-[#111110] px-4 py-16 text-white sm:px-6 lg:px-10"
          data-home-section="how-it-works"
        >
          <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[0.42fr_0.58fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                How it works
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
                Turn a captured task pack into a policy ranking.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
                Blueprint keeps the run compact: 1 site package, 1 task pack, 1
                robot embodiment, 1-3 policies/checkpoints, 100 or 500 WAM-eval
                episodes, and a ranked evidence packet.
              </p>
              <img
                src={humanoidReadinessAssets.robotTeamEvalWorkflow}
                alt="Generated visual of a humanoid robot in a warehouse evaluation bay with site scan overlays"
                className="mt-8 aspect-[4/3] w-full border border-white/15 object-cover"
              />
            </div>
            <div className="grid gap-3">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="grid gap-4 border border-white/15 bg-white/[0.04] p-5 sm:grid-cols-[3rem_1fr]"
                >
                  <span className="flex h-10 w-10 items-center justify-center border border-[#d8bd8d]/50 text-sm font-semibold text-[#d8bd8d]">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      {step.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="px-4 py-16 sm:px-6 lg:px-10"
          data-home-section="pricing"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <SectionHeading
                eyebrow="Planning ranges"
                title="Policy Evaluation Run pricing preview."
                body="Choose 100 or 500 WAM-eval episodes for 1 site package, 1 task pack, 1 robot embodiment, and 1-3 policies/checkpoints. Site operators submit sites free."
              />
              <a
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-black/15 bg-white px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f0e7d8]"
              >
                Open pricing page
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.name}
                  className="border border-black/10 bg-white p-6"
                >
                  <h3 className="text-2xl font-semibold text-[#111110]">
                    {plan.name}
                  </h3>
                  <p className="mt-4 text-3xl font-semibold text-[#111110]">
                    {plan.price}
                  </p>
                  <p className="mt-4 min-h-[5rem] text-sm leading-6 text-[#5f5a53]">
                    {plan.summary}
                  </p>
                  <a
                    href={plan.href}
                    className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-[#111110] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2925]"
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
            <div className="mt-4 grid gap-4 border border-black/10 bg-white p-5 md:grid-cols-[0.22fr_0.78fr]">
              <Building2
                className="h-8 w-8 text-[#8b6f42]"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-2xl font-semibold text-[#111110]">
                  Site operators submit sites free.
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5a53]">
                  Facility owners can submit or claim a site, define
                  privacy/access boundaries, and review commercial-use terms
                  before anything is shared.
                </p>
                <a
                  href={`${operatorHref}-pricing`}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 border border-black/15 px-4 text-sm font-semibold text-[#111110] transition hover:bg-[#f0e7d8]"
                >
                  Submit site free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          id="proof"
          className="border-y border-black/10 bg-white px-4 py-16 sm:px-6 lg:px-10"
          data-home-section="proof"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="grid gap-8 border border-black/10 bg-[#f8f4ec] p-6 md:grid-cols-[0.42fr_0.58fr] md:p-8">
              <SectionHeading
                eyebrow="Evidence boundary"
                title="Keep WAM/VLA claims inside their proof boundary."
                body="WAM/VLA output ranks and discovers failures before robot time. Quantitative Pearson/Spearman/SRCC/rank-fidelity claims require paired real-world validation rollouts and apply only to the validated robot/task/site envelope. Generated rollout clips are support media, not proof."
              />
              <div className="flex flex-col justify-end gap-3 sm:flex-row md:items-end">
                <a
                  href="/proof"
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#111110] px-5 text-sm font-semibold text-white transition hover:bg-[#2b2925]"
                >
                  See proof details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          id="request"
          className="px-4 py-16 sm:px-6 lg:px-10"
          data-home-section="request"
        >
          <div className="mx-auto grid max-w-[88rem] gap-8 border border-black/10 bg-[#111110] p-6 text-white md:grid-cols-[0.62fr_0.38fr] md:p-8 lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                First request
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
                Have policies to rank before field time?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Bring 1 site package, 1 task pack, 1 robot embodiment, and 1-3
                policies/checkpoints. We'll recommend 100 or 500 WAM-eval
                episodes and the real-world validation targets to inspect next.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row md:flex-col">
              <a
                href={requestHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request policy evaluation
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={operatorHref}
                className="inline-flex min-h-12 items-center justify-center border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Submit site free
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
