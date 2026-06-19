import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Database,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type PricingPlan = {
  icon: LucideIcon;
  name: string;
  range: string;
  description: string;
  unit?: string;
  includes: string[];
  useCases?: string[];
  href: string;
  cta: string;
};

const taskEvaluationHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-review&requestedOutputs=Task%20Evaluation%20Run&source=pricing-task-evaluation";

const policyImprovementHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-improvement-run&path=policy-improvement-run&requestedOutputs=Policy%20Improvement%20Run&source=pricing-policy-improvement";

const siteOperatorHref = "/contact/site-operator?source=pricing-site-operator-free";

const plans: PricingPlan[] = [
  {
    icon: ClipboardCheck,
    name: "Task Evaluation Run",
    range: "From $6,500 / run",
    description:
      "Test one robot policy/profile against one real-site Task Pack.",
    unit:
      "One Task Evaluation Run = 1 site × 1 robot policy/profile × 1 Task Pack × up to 500 scenarios.",
    includes: [
      "Scenario manifest",
      "Start-state and variation set",
      "Target threshold set",
      "Pass/fail results",
      "Cycle-time results",
      "Intervention and failure notes",
      "Selected rollout evidence",
      "Exportable scenario/results manifest",
      "Short findings summary",
    ],
    href: taskEvaluationHref,
    cta: "Request Task Evaluation Run",
  },
  {
    icon: Database,
    name: "Policy Improvement Run",
    range: "From $35,000 / run",
    description:
      "Improve a customer-supplied robot policy inside a sim-only workflow.",
    includes: [
      "Baseline evaluation and dominant failure-mode diagnosis",
      "Twin and cousin scenario generation",
      "Curriculum construction for the target task",
      "Post-training of an adapter, task head, distilled skill, or complete policy",
      "Sealed scenario test for candidate versions",
      "Improved artifact and evidence report",
    ],
    useCases: [
      "sim-only policy lift",
      "customer-supplied policy improvement",
      "adapter or task-head post-training",
      "failure recovery",
      "pilot-threshold preparation",
    ],
    href: policyImprovementHref,
    cta: "Request Policy Improvement",
  },
];

const toteTransferExamples = [
  "normal tote transfer",
  "cart shifted left/right",
  "tote rotated",
  "dim lighting",
  "blocked approach",
  "human crossing",
  "recovery scenarios",
];

const policyAccessModes = [
  {
    title: "Black-box evaluation",
    body:
      "Bring an API endpoint, container, private-cloud runner, sim plugin, or action traces. Blueprint runs the policy against task scenarios and reports baseline score, failures, cycle time, and intervention patterns. No source code required.",
  },
  {
    title: "Closed-stack improvement support",
    body:
      "When Blueprint cannot edit the policy directly, we generate twin/cousin scenarios, failure clusters, curriculum, regression packs, and recommended training changes. Your team applies changes internally; Blueprint retests new versions.",
  },
  {
    title: "Actual improved artifact",
    body:
      "Available when the team exposes a trainable surface: adapter hooks, task head, fine-tuning API, policy wrapper, controller layer, reward/training entrypoint, or approved distillation from rollouts.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Simple Blueprint pricing for robot teams: Task Evaluation Runs from $6,500 per run and Policy Improvement Runs from $35,000 per sim-only run. Site operators submit sites free."
        canonical="/pricing"
        image={`https://tryblueprint.io${humanoidReadinessAssets.hostedDashboard}`}
      />

      <div className="bg-[#f6f1e8] text-[#111110]">
        <section className="relative overflow-hidden bg-[#111110] px-4 py-20 text-white sm:px-6 lg:px-10">
          <img
            src={humanoidReadinessAssets.hostedDashboard}
            alt="Illustrative real-site robot evaluation dashboard"
            className="absolute inset-0 h-full w-full object-cover opacity-32"
          />
          <div className="absolute inset-0 bg-black/68" />
          <div className="relative mx-auto max-w-[88rem]">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#d8bd8d]">
              Pricing
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-none md:text-7xl">
              Simple pricing for real-site robot evaluation.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
              Blueprint sells two robot-team products: Task Evaluation Runs and
              Policy Improvement Runs. Site operators can submit sites for
              free.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={taskEvaluationHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request Task Evaluation Run
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={policyImprovementHref}
                className="inline-flex min-h-12 items-center justify-center border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Request Policy Improvement
              </a>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-4 lg:grid-cols-2">
            {plans.map((plan) => {
              const Icon = plan.icon;

              return (
                <article
                  key={plan.name}
                  className="border border-black/10 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Icon className="h-6 w-6 text-[#8b6f42]" aria-hidden="true" />
                    <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                      Robot-team product
                    </p>
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold leading-tight">
                    {plan.name}
                  </h2>
                  <p className="mt-4 text-3xl font-semibold">{plan.range}</p>
                  <p className="mt-4 text-sm leading-6 text-[#5f5a53]">
                    {plan.description}
                  </p>
                  {plan.unit ? (
                    <p className="mt-5 border border-black/10 bg-[#f8f4ec] p-4 text-sm font-semibold leading-6 text-[#111110]">
                      {plan.unit}
                    </p>
                  ) : null}
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                        Includes
                      </p>
                      <ul className="mt-3 space-y-3">
                        {plan.includes.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3 text-sm leading-6 text-[#4f4a43]"
                          >
                            <span className="mt-2 h-1.5 w-1.5 flex-none bg-[#8b6f42]" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {plan.useCases ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                          Use it for
                        </p>
                        <ul className="mt-3 space-y-3">
                          {plan.useCases.map((item) => (
                            <li
                              key={item}
                              className="flex gap-3 text-sm leading-6 text-[#4f4a43]"
                            >
                              <span className="mt-2 h-1.5 w-1.5 flex-none bg-[#8b6f42]" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <a
                    href={plan.href}
                    className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-[#111110] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2925]"
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#111110] px-4 py-14 text-white sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[88rem]">
            <div className="grid gap-6 lg:grid-cols-[0.36fr_0.64fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                  Full-stack robot teams
                </p>
                <h2 className="mt-3 text-4xl font-semibold leading-tight">
                  Source access is optional.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/72">
                  Policy Improvement Runs work with customer-supplied policies
                  through API, container, private runner, adapter, sim plugin,
                  or action-trace workflows. Producing an improved artifact
                  requires either a trainable interface or a customer-approved
                  wrapper/adapter path.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {policyAccessModes.map((mode) => (
                  <article key={mode.title} className="border border-white/15 bg-white/7 p-5">
                    <h3 className="text-xl font-semibold">{mode.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-white/72">{mode.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-8 lg:grid-cols-[0.42fr_0.58fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                What is a Task Pack?
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                A Task Pack is one job the robot needs to perform, tested across
                many scenarios.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#5f5a53]">
                Scenario = one test attempt. Task Pack = the full set of
                scenarios for that job. Task Evaluation Run = one policy tested
                against one Task Pack.
              </p>
            </div>
            <div className="grid gap-4">
              <article className="border border-black/10 bg-[#f8f4ec] p-5">
                <div className="flex items-start gap-3">
                  <Layers3 className="mt-1 h-5 w-5 flex-none text-[#8b6f42]" />
                  <div>
                    <h3 className="text-2xl font-semibold">
                      Example: Tote Transfer Task Pack
                    </h3>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {toteTransferExamples.map((item) => (
                        <li
                          key={item}
                          className="border border-black/10 bg-white px-3 py-2 text-sm leading-6 text-[#4f4a43]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
              <article className="border border-black/10 bg-white p-5">
                <h3 className="text-xl font-semibold">Multi-task pricing</h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5a53]">
                  Need the same policy tested across multiple Task Packs? Ask
                  for a bundle. A common bundle is 3 Task Evaluation Runs on the
                  same site and policy from $18,000.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-6 border border-black/10 bg-white p-6 md:grid-cols-[0.18fr_0.82fr] md:p-8">
            <Building2 className="h-10 w-10 text-[#8b6f42]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                Free site participation
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Site operators submit sites free.
              </h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-[#5f5a53]">
                Facility owners can submit or claim a site, define
                privacy/access boundaries, and review commercial-use terms
                before anything is shared.
              </p>
              <a
                href={siteOperatorHref}
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-[#111110] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2925]"
              >
                Submit site free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 bg-[#111110] px-4 py-14 text-white sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-6 md:grid-cols-[0.18fr_0.82fr]">
            <ShieldCheck className="h-10 w-10 text-[#d8bd8d]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                Evidence boundary
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Evaluation output is advisory.
              </h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-white/74">
                Evaluation and improvement outputs stay scoped to simulator
                traces, action logs, rights clearance, and site-specific package
                artifacts. Sim-only improvement is not deployment approval.
              </p>
              <a
                href="/proof"
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-[#d8bd8d] px-4 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                See proof details
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
