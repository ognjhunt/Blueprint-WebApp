import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import {
  editorialGeneratedAssets,
} from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const useCases = [
  {
    title: "Tote transfer and cart-to-conveyor",
    body: "Estimate whether a robot can clear the route, handoff, timing, and intervention bar before a facility pilot starts.",
    image: editorialGeneratedAssets.homeHero,
  },
  {
    title: "Line-side delivery and bin interaction",
    body: "Review aisle geometry, work-cell access, shelf/bin contact assumptions, route conflicts, and data gaps before integration spend.",
    image: editorialGeneratedAssets.groceryBackroom,
  },
  {
    title: "Inspection routes and equipment checks",
    body: "Scope gauge, valve, equipment-state, and route-inspection evidence for evaluation datasets.",
    image: editorialGeneratedAssets.warehouseAisle,
  },
];

const workflowSteps = [
  {
    id: "01",
    title: "Real indoor site",
    body:
      "Name the facility, route, robot task, and site context. The product starts with the real place, not a generic benchmark.",
  },
  {
    id: "02",
    title: "Capture and provenance",
    body:
      "Blueprint records the walkthrough basis, timestamps, device context, privacy limits, access boundaries, and source notes.",
  },
  {
    id: "03",
    title: "Task suite and thresholds",
    body:
      "Define success rate, cycle time, intervention rate, safety threshold, scenario variations, robot profile, and the pilot decision owner.",
  },
  {
    id: "04",
    title: "Readiness evidence",
    body:
      "Robot teams review site package assets, hosted observations, failure modes, data requirements, and the missing simulator/action/robot proof.",
  },
  {
    id: "05",
    title: "Pilot protocol",
    body:
      "The next step is explicit: short pilot, site modification, more data, recapture, vendor comparison, operator access, or a hold until proof clears.",
  },
];

const categoryRows = [
  {
    title: "Google made the category simple",
    body:
      "Genie plus Street View shows why real-place interactive worlds matter for agents and robots.",
  },
  {
    title: "Robot teams need deployment-readiness answers next",
    body:
      "The useful operating spaces are often indoors, rights-sensitive, and specific to one deployment workflow, pass bar, and safety envelope.",
  },
  {
    title: "Blueprint is the capture-backed layer",
    body:
      "The product is the indoor site package, hosted review path, readiness report, proof boundary, and pilot decision around one exact site/task.",
  },
];

const includedItems = [
  "A request-scoped readiness report for one real indoor facility, task suite, and robot profile",
  "Capture provenance, rights notes, freshness, and restricted-zone boundaries",
  "Success-rate, cycle-time, intervention-rate, and safety-threshold questions structured before the pilot",
  "Failure-mode report, site modification recommendations, data requirements, and short-pilot protocol tied back to source capture",
];

const pricingRows = [
  {
    title: "Robot-team subscription",
    price: "$15,000/month",
    body:
      "Unlimited evaluation cycles during active development up to the agreed active-policy cap, with overage pricing above the cap.",
  },
  {
    title: "Lite quick-look eval",
    price: "$5,000-$8,000/eval",
    body:
      "~50 episodes for one policy with a ranking-only report. No failure taxonomy, calibration, or deployment guarantee.",
  },
  {
    title: "Site supply review",
    price: "$5,000/site",
    body:
      "Low-cost operator-side supply creation for facilities that can become useful robot-team evaluation targets.",
  },
  {
    title: "Site monitoring subscription",
    price: "$30,000-$40,000/year/site",
    body:
      "Yearly operator-side monitoring for deployed sites when multiple new policy versions need site-specific report cards.",
  },
];

const privateHardwareRows = [
  {
    title: "Blueprint-hosted private asset",
    body:
      "If your team can share a private Robot Embodiment Pack under NDA, Blueprint can host the robot asset inside a private eval lane while keeping raw capture and scoring internals controlled.",
  },
  {
    title: "Customer-hosted sealed capsule",
    body:
      "For closed stacks, keep your URDF/MJCF/USD, simulator, controller, and policy runtime in your environment. Blueprint sends a least-privilege eval packet and receives owner proof.",
  },
  {
    title: "Physical robot evidence bridge",
    body:
      "For hardware runs, your bridge returns camera refs, action logs, robot state, timestamps, outcomes, checksums, and operator attestation joined to exact scenario IDs.",
  },
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Robot Teams | Blueprint"
        description="Blueprint helps robot teams evaluate site/task fit before a costly pilot with capture-backed site packages, evaluation reports, and hosted review."
        canonical="/for-robot-teams"
        jsonLd={[
          webPageJsonLd({
            path: "/for-robot-teams",
            name: "Blueprint for Robot Teams",
            description:
              "How robotics teams use Blueprint for pre-sales site/task evaluation, capture-backed site packages, policy evaluation sets, and evidence-gated pilot planning.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For Robot Teams", path: "/for-robot-teams" },
          ]),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.warehouseAisle}
            alt="Robot team hero"
            className="min-h-[40rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[40rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <RouteTraceOverlay className="opacity-60" />
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[32rem] flex-col justify-end">
                <EditorialSectionLabel light>For Robot Teams</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[38rem] text-[3.35rem] leading-[0.92] tracking-[-0.06em] text-white sm:text-[4.7rem]">
                  We help robot teams safely adapt foundation policies to real customer sites.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-white/70">
                  Before a long pilot, Blueprint helps you frame the site/task question: required success rate, cycle time, intervention rate, and evidence gaps on the facility workflow. Capture and provenance stay attached to the package.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <ProofChip light>Indoor exact sites</ProofChip>
                  <ProofChip light>Readiness report</ProofChip>
                  <ProofChip light>Proof-gated verdicts</ProofChip>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Robot%20Team%20Subscription&source=robot-teams-hero"
                    className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Request evaluation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/how-it-works"
                    className="inline-flex items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    See how it works
                  </a>
                </div>
              </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[18rem] border border-white/15 bg-black/35 p-5 text-white backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                    Indoor site review
                  </p>
                  <p className="mt-4 text-lg font-semibold">One facility. One robot question.</p>
                <p className="mt-3 text-sm leading-6 text-white/60">
                    The product is not generic environment access. The product is a site/task readiness packet grounded in one indoor exact-site package.
                  </p>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Workflow"
            title="From indoor site to pre-pilot readiness decision."
            description="The path is intentionally simple: real indoor site, capture and provenance, task suite and thresholds, readiness evidence, then pilot protocol or proof blocker."
            className="max-w-3xl"
          />

          <div className="mt-8 grid gap-px bg-black/10 lg:grid-cols-5">
            {workflowSteps.map((step) => (
              <article key={step.id} className="bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {step.id}
                </p>
                <h2 className="mt-4 text-base font-semibold text-slate-950">{step.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Pricing"
                title="Subscriptions first; quick-look evals only as the ramp."
                description="Robot teams should treat Blueprint as recurring evaluation infrastructure when policy development is active. The cheap first run exists to prove fit, not to become the default purchase."
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-2 xl:grid-cols-4">
              {pricingRows.map((row) => (
                <article key={row.title} className="bg-white p-6">
                  <p className="text-sm font-semibold text-slate-500">{row.title}</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                    {row.price}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{row.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Private hardware"
                title="Closed robot stacks do not require either side to hand over everything."
                description="Blueprint protects its site, scenario, and harness IP while robot teams keep private robot models, controllers, and hardware bridges inside their own environment when needed."
                light
              />
              <div className="mt-8 space-y-3 text-sm leading-7 text-white/70">
                <p>
                  Customer-hosted connectors receive a sealed, least-privilege packet:
                  task IDs, scenario run IDs, redacted scene anchors, schemas,
                  thresholds, and the evidence contract.
                </p>
                <p>
                  Raw captures, full scene assets, the full scoring harness, hidden
                  failure labels, and sealed audit seeds stay withheld by default.
                </p>
              </div>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {privateHardwareRows.map((row) => (
                <article key={row.title} className="bg-[#f5f3ef] p-6">
                  <h2 className="text-base font-semibold text-slate-950">{row.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{row.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Category signal"
                title="The outdoor proof makes the indoor deployment gap easier to explain."
                description="Blueprint references Google and Waymo as category validation only. The Blueprint claim is narrower: capture-backed indoor readiness reports and site packages for robot-team evaluation."
                light
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {categoryRows.map((row) => (
                <article key={row.title} className="bg-white p-6">
                  <h2 className="text-base font-semibold text-slate-950">{row.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{row.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Common jobs"
            title="Use exact-site readiness for the work that usually gets expensive late."
            description="The strongest fit is a known warehouse, factory, material-handling, or inspection site where a team needs to de-risk a narrow deployment question before pilot spend."
            className="max-w-3xl"
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {useCases.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-[1.8rem] border border-black/10 bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.24)]"
              >
                <MonochromeMedia
                  src={item.image}
                  alt={item.title}
                  className="aspect-[4/3] rounded-none"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.3))]"
                />
                <div className="p-6">
                  <h2 className="font-editorial text-[2.2rem] leading-[0.94] tracking-[-0.04em] text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
	              <EditorialSectionIntro
                eyebrow="What this is"
                title="Pre-sales and pre-deployment eval infrastructure, not a generic benchmark."
                description="This path makes the site package, readiness estimate, policy evaluation sets, and limits visible before more pilot budget goes in."
	                light
	              />
              <p className="mt-8 text-sm leading-7 text-white/70">
                This path works well for policy fine-tuning, training data generation, release comparison, and policy evaluation sets built from site/task evidence.
              </p>
            </div>
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionLabel>Included</EditorialSectionLabel>
              <div className="mt-6 space-y-4">
                {includedItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Move from curiosity to one site/task pass bar."
            description="Start in the site-package catalog when you want to evaluate current proof, or request a readiness evaluation when a facility, robot, and task threshold are already in scope."
            imageSrc={editorialGeneratedAssets.homeHero}
            imageAlt="Hosted evaluation still"
            primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Robot%20Team%20Subscription&source=robot-teams-bottom"
            primaryLabel="Request evaluation"
            secondaryHref="/world-models"
            secondaryLabel="Browse site packages"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
