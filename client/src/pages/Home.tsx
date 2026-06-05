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
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-review&requestedOutputs=Task%20Evaluation%20Run&source=home-kiss";

const hostedHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-review&source=home-kiss";

const dataPackageHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=post-training-data-package&path=data-package&requestedOutputs=Post-Training%20Data%20Package&source=home-post-training-data";

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
    label: "Success rate",
    title: "Can the robot complete the task often enough?",
    body: "The evaluation starts with the pass bar the robot team actually needs.",
  },
  {
    icon: Clock,
    label: "Cycle time",
    title: "Can it keep up with the site rhythm?",
    body: "Blueprint frames the task against target timing, bottlenecks, and site drift.",
  },
  {
    icon: Gauge,
    label: "Intervention rate",
    title: "Where will people still need to step in?",
    body: "Blueprint keeps assist points visible instead of hiding them behind a score.",
  },
  {
    icon: ShieldCheck,
    label: "Safety threshold",
    title: "What still needs review before field exposure?",
    body: "Safety stays scoped to the request and does not become a blanket validation claim.",
  },
];

const offerItems: IconBlock[] = [
  {
    icon: Route,
    label: "01",
    title: "Task Evaluation Run",
    body: "One site, one robot policy/profile, one Task Pack, and up to 500 scenarios.",
  },
  {
    icon: PackageCheck,
    label: "02",
    title: "Post-Training Data Package",
    body: "Curated robot POV clips, scenario labels, synthetic variations, failure cases, and export format for model improvement.",
  },
];

const workflowSteps = [
  {
    title: "Start with a real site",
    body: "Use an existing site package, lawful capture, or structured facility request.",
  },
  {
    title: "Define the task pack",
    body: "Set the robot profile, task, thresholds, start states, and scenario variations.",
  },
  {
    title: "Run the policy",
    body: "Run through a policy API, vendor container, action trace, simulation workflow, or assisted review.",
  },
  {
    title: "Score the scenarios",
    body: "Measure success, cycle time, intervention points, safety events, and failure modes.",
  },
  {
    title: "Decide the next proof step",
    body: "Proceed to pilot, request more data, tune on the exported set, or hold until blockers clear.",
  },
];

const pricingPlans = [
  {
    name: "Task Evaluation Run",
    price: "From $6,500 / run",
    summary:
      "Test one robot policy/profile against one real-site Task Pack, up to 500 scenarios.",
    href: hostedHref,
    cta: "Request Task Evaluation Run",
  },
  {
    name: "Post-Training Data Package",
    price: "From $25,000+",
    summary:
      "Curated robot POV clips, scenario labels, synthetic variations, failure cases, and matched export format.",
    href: dataPackageHref,
    cta: "Request Data Package",
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
        description="Blueprint helps robot teams test policies and scenarios on capture-backed site packages before pilots or deployment. Site operators participate free."
        canonical="/"
        image={`https://tryblueprint.io${humanoidReadinessAssets.warehouseHero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Real-Site Robot Evaluation",
          description:
            "Blueprint helps robot teams test policies and scenarios on capture-backed site packages before pilots or deployment. Site operators participate free.",
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
                Evaluate robots on real sites before deployment.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
                Blueprint turns captured facilities into robot task packs so
                teams can test policies, find failure modes, and prepare for
                shorter field pilots.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Robot teams pay for evaluations. Site operators can submit sites
                free.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
                >
                  Request evaluation
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
                Task Evaluation Run
              </p>
              <p className="mt-2 text-xl font-semibold leading-snug text-[#111110] md:text-2xl">
                One Task Evaluation Run = 1 site × 1 robot policy/profile × 1
                Task Pack × up to 500 scenarios.
              </p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {buyerBars.map((item) => (
                <IconCard key={item.label} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-10" data-home-section="offer">
          <div className="mx-auto max-w-[88rem]">
            <SectionHeading
              eyebrow="What Blueprint sells"
              title="Two robot-team products."
              body="Start with a Task Evaluation Run when you need a scoped answer before field time. Add a Post-Training Data Package when the robot team needs curated data to improve the model."
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
                Turn a real site into an evaluation plan.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
                Blueprint keeps the workflow compact: one site, one policy, one
                task pack, scored scenarios, and the next proof step.
              </p>
              <img
                src={humanoidReadinessAssets.hostedDashboard}
                alt="Illustrative dashboard for site policy evaluation"
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
                title="Two paid robot-team products. Site operators submit free."
                body="Task Evaluation Runs start at $6,500 per run. Post-Training Data Packages start at $25,000+. Site operators can submit sites for free."
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
                <article key={plan.name} className="border border-black/10 bg-white p-6">
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
              <Building2 className="h-8 w-8 text-[#8b6f42]" aria-hidden="true" />
              <div>
                <h3 className="text-2xl font-semibold text-[#111110]">
                  Site operators submit sites free.
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#5f5a53]">
                  Facility owners can submit or claim a site, define privacy/access
                  boundaries, and review commercial-use terms before anything is
                  shared.
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
                title="Public examples show the workflow shape."
                body="A request packet proves one site, robot profile, task pack, thresholds, rights posture, and missing proof. Evaluation output remains advisory until supported by simulator traces, action logs, robot trials, safety review, and runtime evidence."
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
                Have one real site or task to evaluate?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Bring one site, task, robot profile, and target threshold. We'll
                recommend the right evaluation scope, scenario count, and next
                proof step.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row md:flex-col">
              <a
                href={requestHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request evaluation
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
