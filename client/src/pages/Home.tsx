import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
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
  "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=home-kiss";

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
    body: "The readiness scope starts with the pass bar the buyer actually needs.",
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
    body: "The report names likely assist points instead of hiding them behind a score.",
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
    icon: ClipboardCheck,
    label: "01",
    title: "Site/task readiness report",
    body: "One facility, task suite, robot profile, threshold set, failure modes, proof gaps, and next-step recommendation.",
  },
  {
    icon: PackageCheck,
    label: "02",
    title: "Capture-backed site package",
    body: "Walkthrough evidence, route context, provenance, rights posture, manifests, and export boundaries for the site.",
  },
  {
    icon: Route,
    label: "03",
    title: "Hosted evaluation",
    body: "A managed buyer review room when package, entitlement, and runtime proof support that request.",
  },
  {
    icon: Building2,
    label: "04",
    title: "Custom benchmark scope",
    body: "Private, multi-site, vendor-comparison, or operator-heavy work when one site review is too narrow.",
  },
];

const workflowSteps = [
  {
    title: "Capture or package one real site",
    body: "Start from a lawful capture, existing site package, or structured request for the facility in question.",
  },
  {
    title: "Define the robot task and pass bar",
    body: "Name the robot profile, task suite, success rate, cycle time, intervention rate, and safety threshold.",
  },
  {
    title: "Build the readiness packet",
    body: "Attach capture evidence, route context, scenario notes, missing proof, and package or hosted-review limits.",
  },
  {
    title: "Show what breaks",
    body: "Call out failure modes, site modifications, data needs, recapture needs, and proof that remains blocked.",
  },
  {
    title: "Decide the next step",
    body: "Proceed to a short pilot protocol, change the site, gather more evidence, compare vendors, or hold.",
  },
];

const pricingPlans = [
  {
    name: "Site/Task Readiness Review",
    price: "$2,100 - $3,400",
    summary:
      "One site, one task suite, one robot profile, one threshold set, and a pre-pilot recommendation.",
    href: requestHref,
  },
  {
    name: "Hosted Evaluation",
    price: "$16 - $29 / session-hour",
    summary:
      "Managed browser review, reruns, observations, export framing, and a direct buyer room when available.",
    href: hostedHref,
  },
  {
    name: "Custom Multi-Site Benchmark",
    price: "$50,000+ scoped",
    summary:
      "Private capture planning, vendor-neutral benchmark design, custom data package, and operator boundaries.",
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=custom-scope&path=world-model&source=home-kiss",
  },
];

const proofRows = [
  {
    sample: "Public samples",
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
    sample: "Readiness advisory",
    request: "Operational readiness",
    detail:
      "A readiness report is advisory until the missing proof exists for that exact site, robot, task, and threshold set.",
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
        title="Robot Deployment Readiness | Blueprint"
        description="Blueprint turns one real facility, one robot task, and one pass bar into a capture-backed readiness report before an expensive pilot."
        canonical="/"
        image={`https://tryblueprint.io${humanoidReadinessAssets.warehouseHero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Robot Deployment Readiness",
          description:
            "Blueprint turns one real facility, one robot task, and one pass bar into a capture-backed readiness report before an expensive pilot.",
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
            alt="Humanoid robot in a warehouse aisle used as illustrative readiness imagery"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/62" />
          <div className="relative mx-auto flex min-h-[74vh] max-w-[88rem] flex-col justify-end px-4 pb-12 pt-24 sm:px-6 lg:px-10">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-[#d8bd8d]">
                Site-specific robot deployment readiness
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-none md:text-7xl">
                Know what breaks before the robot pilot.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
                Blueprint turns one real facility, one robot task, and one pass
                bar into a capture-backed readiness report before teams spend
                months on-site.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
                >
                  Request readiness review
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
              title="A readiness answer for one site, not a giant marketplace."
              body="The public site now starts with the buyer decision: will this robot work in this facility, on this task, at the thresholds the team needs?"
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
                Turn pilot risk into an inspectable packet.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
                Blueprint keeps the workflow compact: site, task, pass bar,
                evidence, gaps, and the next proof step.
              </p>
              <img
                src={humanoidReadinessAssets.hostedDashboard}
                alt="Illustrative readiness dashboard for a hosted evaluation"
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
                title="Three ways to start."
                body="Pricing is intentionally simple. Public ranges help a buyer pick a path; live availability, rights, payment, and fulfillment are confirmed per request."
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
                    Request scope
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
                title="Public samples show the product shape. Request packets prove one site."
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
                  Request readiness review
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
                Ask for one site/task readiness review.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Bring the facility, task, robot profile, target thresholds,
                timeline, and proof you already have. Blueprint routes the next
                step to a readiness report, hosted evaluation, capture ask, or
                proof blocker.
              </p>
              <a
                href={requestHref}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request readiness review
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="grid content-start gap-3">
              {[
                "Requests do not grant package access, rights clearance, payment, fulfillment, or hosted-session availability by themselves.",
                "Readiness remains advisory until simulator traces, action logs, robot trials, safety review, rights proof, and runtime proof support a stronger claim.",
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
