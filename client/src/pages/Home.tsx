import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Gauge,
  PackageCheck,
  Route,
  ShieldCheck,
  Target,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const requestHref =
  "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&requestedOutputs=Site%20data%20package%2C%20scenario%20data%2C%20policy%20evaluation%20access&source=home-kiss";

const hostedHref =
  "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=home-kiss";

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
    icon: PackageCheck,
    label: "01",
    title: "Site data package",
    body: "Capture-backed world model, walkthrough media, geometry when available, provenance, rights posture, and export limits.",
  },
  {
    icon: Route,
    label: "02",
    title: "Scenario data",
    body: "Task variations, start states, dynamic conditions, object zones, failure cases, and observed-vs-inferred labels.",
  },
  {
    icon: Gauge,
    label: "03",
    title: "Policy evaluation",
    body: "A fixed-scope manual or headless evaluation set across the site's task suite, with episode-level results and failure notes.",
  },
  {
    icon: Building2,
    label: "04",
    title: "Training exports",
    body: "Exportable data for post-training, fine-tuning, regression checks, and site-specific model improvement.",
  },
];

const workflowSteps = [
  {
    title: "Capture a real site",
    body: "Start from a lawful capture, existing site package, or structured request for the facility in question.",
  },
  {
    title: "Package world and scenario data",
    body: "Build the site world, task/scenario variations, provenance, rights labels, and export boundaries.",
  },
  {
    title: "Run the robot policy",
    body: "Use a manual browser session or a headless agent path to test the robot profile against site tasks.",
  },
  {
    title: "Generate the data your team needs",
    body: "Export observations, scenario results, failure cases, and data bundles for training or fine-tuning.",
  },
  {
    title: "Decide the next step",
    body: "Proceed to a short pilot, request more site data, tune on the exported set, or hold until missing proof clears.",
  },
];

const pricingPlans = [
  {
    name: "Policy Evaluation Set",
    price: "$6,500 / site evaluation",
    summary:
      "Robot teams run one policy/profile across the site's task suite by manual browser session or headless agent.",
    href: hostedHref,
    cta: "Request policy evaluation",
  },
  {
    name: "Site Data Package",
    price: "$3,500+ / site package",
    summary:
      "World model, scenario set, provenance, rights labels, and data exports for post-training or fine-tuning.",
    href: requestHref,
    cta: "Request site data",
  },
  {
    name: "Site Operators",
    price: "Free",
    summary:
      "Operators can submit a site, define access and privacy boundaries, and participate without paying Blueprint.",
    href: "/contact/site-operator?source=home-kiss-pricing",
    cta: "Submit site free",
  },
];

const proofRows = [
  {
    sample: "Public product samples",
    request: "Request packets",
    detail:
      "Samples show the product shape. Request packets prove one site with provenance, rights, thresholds, and gaps attached.",
  },
  {
    sample: "Generated or model-derived visuals",
    request: "Owner-system evidence",
    detail:
      "Generated outputs can support review, but simulator traces, action logs, robot trials, safety review, rights proof, and runtime artifacts own stronger claims.",
  },
  {
    sample: "Evaluation output",
    request: "Operational readiness",
    detail:
      "Policy-evaluation output stays advisory until the missing proof exists for that exact site, robot, task, and threshold set.",
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
        title="Real-Site Robot Data Marketplace | Blueprint"
        description="Blueprint turns real sites into world-model data packages and policy-evaluation sets for robot teams. Site operators participate free."
        canonical="/"
        image={`https://tryblueprint.io${humanoidReadinessAssets.warehouseHero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Real-Site Robot Data Marketplace",
          description:
            "Blueprint turns real sites into world-model data packages and policy-evaluation sets for robot teams. Site operators participate free.",
          url: "https://tryblueprint.io/",
        }}
      />

      <div className="bg-[#f6f1e8] text-[#111110]">
        <section
          className="relative min-h-[74vh] overflow-hidden bg-[#111110] text-white"
          data-home-section="hero"
        >
          <img
            src={humanoidReadinessAssets.warehouseHero}
            alt="Humanoid robot in a warehouse aisle used as illustrative site-data marketplace imagery"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/62" />
          <div className="relative mx-auto flex min-h-[74vh] max-w-[88rem] flex-col justify-end px-4 pb-12 pt-24 sm:px-6 lg:px-10">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-[#d8bd8d]">
                Open robot-team marketplace for real-site data
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-none md:text-7xl">
                Real-site data for robot teams before the pilot.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
                Evaluate policies, test scenarios, and generate training data
                from capture-backed sites. Robot teams pay for evaluation sets and data;
                site operators participate free.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
                >
                  Request site data
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="#pricing"
                  className="inline-flex min-h-12 items-center justify-center border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  See pricing
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-4 md:grid-cols-4">
            {buyerBars.map((item) => (
              <IconCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-10" data-home-section="offer">
          <div className="mx-auto max-w-[88rem]">
            <SectionHeading
              eyebrow="What Blueprint sells"
              title="A service for site data, policy evaluation, and training exports."
              body="Blueprint turns capture and pipeline evidence into a robot-team marketplace: what the site is, which scenarios matter, how policies behave, and what data can be exported for model improvement."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                Turn a real site into policy runs and training data.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
                Blueprint keeps the workflow compact: real site, robot task,
                scenario variation, policy run, exported data, and the next
                proof step.
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
                title="Two paid robot-team products. Operators are free."
                body="Robot teams pay for policy evaluation sets or site data packages. Operators can submit sites and define boundaries without paying Blueprint."
              />
              <a
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-black/15 bg-white px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f0e7d8]"
              >
                Open pricing page
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
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
          </div>
        </section>

        <section
          id="proof"
          className="border-y border-black/10 bg-white px-4 py-16 sm:px-6 lg:px-10"
          data-home-section="proof"
        >
          <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[0.44fr_0.56fr]">
            <div>
              <SectionHeading
                eyebrow="Proof boundary"
                title="Public samples show the workflow. Request packets prove one site."
                body="Blueprint can look ready and polished without pretending a robot has passed deployment, safety, payment, provider, rights, or hosted-session checks that still need owner-system proof."
              />
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/proof"
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#111110] px-5 text-sm font-semibold text-white transition hover:bg-[#2b2925]"
                >
                  See proof details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center border border-black/15 px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f0e7d8]"
                >
                  Request site data
                </a>
              </div>
            </div>
            <div className="space-y-3">
              {proofRows.map((row) => (
                <article
                  key={row.sample}
                  className="border border-black/10 bg-[#f8f4ec] p-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                        Sample
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">{row.sample}</h3>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                        Stronger proof
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">{row.request}</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#5f5a53]">{row.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="request"
          className="px-4 py-16 sm:px-6 lg:px-10"
          data-home-section="request"
        >
          <div className="mx-auto grid max-w-[88rem] gap-8 border border-black/10 bg-[#111110] p-6 text-white md:grid-cols-[0.55fr_0.45fr] md:p-8 lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                First request
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
                Ask for one real site to evaluate or train on.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Bring the facility, task, robot profile, target thresholds,
                timeline, and proof you already have. Blueprint routes the next
                step to a site data package, policy evaluation, capture ask, or
                proof blocker.
              </p>
              <a
                href={requestHref}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request site data
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="grid content-start gap-3">
              {[
                "Requests do not grant package access, rights clearance, payment, fulfillment, or hosted-session availability by themselves.",
                "Policy-evaluation output remains advisory until simulator traces, action logs, robot trials, safety review, rights proof, and runtime proof support a stronger claim.",
                "Site operators can submit and govern a site for free; paid usage starts with robot-team evaluation sets or data access.",
                "Generated imagery on the public site is illustrative, not customer or robot-trial proof.",
              ].map((item) => (
                <div key={item} className="flex gap-3 border border-white/15 bg-white/[0.04] p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-[#d8bd8d]" aria-hidden="true" />
                  <p className="text-sm leading-6 text-white/76">{item}</p>
                </div>
              ))}
              <div className="flex gap-3 border border-[#d8bd8d]/35 bg-[#d8bd8d]/10 p-4">
                <TriangleAlert className="mt-1 h-5 w-5 flex-none text-[#d8bd8d]" aria-hidden="true" />
                <p className="text-sm leading-6 text-white/76">
                  Public Launch Ready copy is allowed. Operational Launch Ready
                  claims still require proof from the system that owns them.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
