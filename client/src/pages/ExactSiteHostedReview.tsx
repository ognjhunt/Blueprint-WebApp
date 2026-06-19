import { SEO } from "@/components/SEO";
import { MonochromeMedia, ProofChip } from "@/components/site/editorial";
import { analyticsEvents } from "@/lib/analytics";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import {
  proofEvidencePacket,
  sampleExportTree,
  sampleHostedRunRows,
} from "@/lib/proofEvidence";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { breadcrumbJsonLd, productJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight, MapPinned, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import { useEffect } from "react";

const buyerFlow = [
  {
    label: "01",
    title: "Indoor site capture",
    body: "Record the real facility route, timestamps, device context, capture notes, access boundaries, and proof limits.",
    icon: Smartphone,
  },
  {
    label: "02",
    title: "Task suite and robot profile",
    body: "Name the task, scenario variations, robot embodiment, sensors, thresholds, and site-specific blockers before the estimate is written.",
    icon: MapPinned,
  },
  {
    label: "03",
    title: "Site package and hosted review",
    body: "Use capture-grounded site data, package manifests, generated support assets, and hosted review to inspect the real site before field time.",
    icon: ShieldCheck,
  },
  {
    label: "04",
    title: "Readiness report and pilot protocol",
    body: "Return an evidence-backed advisory, failure-mode report, site modifications, data needs, and the short pilot to run next.",
    icon: UsersRound,
  },
];

const categoryValidationRows = [
  {
    title: "Google validates real-place world models outdoors",
    body:
      "Genie and Street View make interactive worlds anchored to real places understandable for agents, robots, and buyers.",
  },
  {
    title: "Waymo validates counterfactual simulation for roads",
    body:
      "Autonomous-driving world models show why teams want rare, long-tail, and replayable scenarios before committing more pilot budget.",
  },
  {
    title: "Blueprint owns the indoor readiness layer",
    body:
      "Robot teams still need exact facilities, rights boundaries, provenance, hosted review, task thresholds, and pilot decisions for spaces public maps do not cover.",
  },
];

const packageLayers = [
  {
    title: "Capture proof",
    body: "Raw-bundle pointers, route notes, freshness, and provenance remain attached to the product record.",
  },
  {
    title: "World-model asset",
    body: "Model artifacts and previews sit behind stable evaluation and policy-improvement contracts; they inform readiness but do not become ground truth.",
  },
  {
    title: "Readiness report",
    body: "Task thresholds, scenario variations, failure modes, site modifications, data needs, and recommendation notes live in one evaluation surface.",
  },
  {
    title: "Commercial boundary",
    body: "Rights, privacy, export scope, and irreversible commitments stay request-scoped and review-gated.",
  },
];

const decisionOptions = [
  "Proceed to short-pilot protocol",
  "Request simulator or action-log evidence",
  "Ask for recapture or operator access",
  "Hold until rights or privacy review clears",
];

const proofBoundaries = [
  {
    title: "Sample assets are labeled",
    body: "The public sample package shows product shape and proof structure. It is not presented as customer traction.",
  },
  {
    title: "Hosted access is gated",
    body: "The page sells the policy evaluation set workflow while confirming session availability, runtime scope, and stronger readiness claims per site/request.",
  },
  {
    title: "Rights do not disappear",
    body: "Capture provenance, restrictions, privacy review, and export approvals stay visible through the buyer workflow.",
  },
];

const whatYouReceiveRows = [
  {
    path: "Site package access",
    receives:
      "Manifest, route notes, capture provenance, rights limits, export scope, and package files when approved.",
    definition: "A site package is the substrate for one exact site, task suite, and robot workflow.",
    firstAction: "Request the readiness report for one site/task.",
  },
  {
    path: "Readiness report",
    receives:
      "Pre-pilot estimate, task thresholds, failure modes, site modifications, data requirements, and short-pilot protocol.",
    definition: "A readiness report is advisory until owner-system simulator, action, robot, safety, rights, and runtime proof supports a stronger claim.",
    firstAction: "Request a site/task readiness evaluation.",
  },
  {
    path: "Custom scope",
    receives:
      "Private or multi-site capture planning, operator boundaries, deliverable spec, and governed handoff path.",
    definition: "Custom scope is request-specific delivery work when the public catalog path is too narrow.",
    firstAction: "Name the site class, facility, or route.",
  },
] as const;

const selectedStory = proofEvidencePacket.selectedStory;

export default function ExactSiteHostedReview() {
  useEffect(() => {
    analyticsEvents.exactSiteReviewView("product_page_world_model_buyer_workflow_v2");
  }, []);

  return (
    <>
      <SEO
        title="Product | Blueprint"
        description="Blueprint turns indoor exact-site capture into Task Evaluation Runs, Policy Improvement Runs, advisory support assets, and pilot decision evidence for robot teams."
        canonical="/product"
        type="product"
        jsonLd={[
          webPageJsonLd({
            path: "/product",
            name: "Blueprint Product",
            description:
              "Indoor exact-site capture, Task Evaluation Runs, Policy Improvement Runs, advisory support assets, and pilot decision evidence for robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Product", path: "/product" },
          ]),
          productJsonLd({
            path: "/product",
            name: "Blueprint Site-Specific Robot Evaluation Planning",
            description:
              "A capture-backed product workflow for indoor exact-site evaluation runs, sim-only policy improvement runs, generated support assets, and buyer decisions with proof attached.",
            image: publicCaptureGeneratedAssets.hostedReviewPublicRoute,
            category: "Site-specific robot evaluation planning platform",
            properties: [
              { name: "Capture basis", value: "Indoor exact-site capture with provenance metadata" },
              { name: "Readiness scope", value: "Task suite, robot profile, success-rate, cycle-time, intervention-rate, and safety thresholds" },
              { name: "Hosted access", value: "Evaluation path and runtime proof confirmed per request" },
            ],
          }),
        ]}
      />

      <div className="bg-[#f5f1e8] text-[#15130f]">
        <section className="relative border-b border-[#15130f]/10 bg-[#0d0d0b] text-white">
          <MonochromeMedia
            src={editorialGeneratedAssets.hostedReviewHero}
            alt="Blueprint policy evaluation set workspace"
            className="min-h-[46rem] rounded-none md:min-h-[43rem]"
            imageClassName="min-h-[46rem] md:min-h-[43rem]"
            loading="eager"
            overlayClassName="bg-[linear-gradient(90deg,rgba(13,13,11,0.95)_0%,rgba(13,13,11,0.82)_38%,rgba(13,13,11,0.18)_100%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.56fr_0.44fr] lg:px-10 lg:py-14">
                <div className="flex min-h-[29rem] flex-col justify-end lg:min-h-[34rem]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Blueprint product
                  </p>
                  <h1 className="font-editorial mt-5 max-w-[42rem] text-[2.85rem] leading-[0.98] tracking-normal text-white sm:text-[4.65rem] lg:text-[5.45rem] lg:leading-[0.94]">
                    Turn the exact site into a robot-readiness report.
                  </h1>
                  <p className="mt-5 max-w-[35rem] text-base leading-7 text-white/82 sm:leading-8">
                    Blueprint packages indoor capture, task suites, robot profiles, generated support assets, hosted review, and buyer proof around one site so teams can evaluate policies before field time.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    <ProofChip light>Capture-backed</ProofChip>
                    <ProofChip light>Threshold-scoped</ProofChip>
                    <ProofChip light>Advisory until proof-backed</ProofChip>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a
                      href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product-hero"
                      className="inline-flex w-full items-center justify-center border border-white bg-white px-6 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-[#f5f1e8] sm:w-auto"
                    >
                      Request evaluation
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product"
                      className="inline-flex w-full items-center justify-center border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                    >
                      See readiness workflow
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/proof"
                      className="inline-flex w-full items-center justify-center border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                    >
                      Inspect proof
                    </a>
                  </div>
                </div>

                <div className="hidden items-end lg:flex">
                  <div className="w-full border border-white/20 bg-[#0d0d0b]/75 backdrop-blur-sm">
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                        Product flow
                      </p>
                      <span className="text-[11px] text-white/50">buyer workflow</span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {buyerFlow.map((step) => (
                        <div key={step.title} className="grid grid-cols-[3.4rem_1fr] gap-4 px-5 py-4">
                          <span className="font-editorial text-3xl tracking-normal text-[#d0ad72]">
                            {step.label}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">{step.title}</p>
                            <p className="mt-1 text-sm leading-6 text-white/65">{step.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="border-b border-[#15130f]/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                Category validation
              </p>
              <h2 className="font-editorial mt-4 max-w-[26rem] text-4xl leading-[1] tracking-normal text-[#15130f] sm:text-[3.2rem]">
                Outdoor world models make the indoor gap obvious.
              </h2>
              <p className="mt-5 max-w-[28rem] text-sm leading-7 text-[#5c5141]">
                Google and Waymo are useful reference points for the category, not Blueprint partners or proof of Blueprint fulfillment.
              </p>
            </div>
            <div className="grid border border-[#15130f]/10 bg-[#15130f]/10 md:grid-cols-3">
              {categoryValidationRows.map((row) => (
                <article key={row.title} className="bg-[#f5f1e8] p-6">
                  <h3 className="text-base font-semibold text-[#15130f]">{row.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5c5141]">{row.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#15130f]/10 bg-[#f5f1e8]">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-14">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                  Buyer workflow
                </p>
                <h2 className="font-editorial mt-4 max-w-[24rem] text-4xl leading-[1] tracking-normal text-[#15130f] sm:text-[3.2rem]">
                One path from capture to readiness advisory.
              </h2>
            </div>
            <div className="grid border border-[#15130f]/10 bg-[#15130f]/10 md:grid-cols-2 xl:grid-cols-4">
              {buyerFlow.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="bg-white p-6">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-[#15130f]" />
                      <span className="font-editorial text-3xl tracking-normal text-[#c7a775]">
                        {step.label}
                      </span>
                    </div>
                    <h3 className="mt-8 text-base font-semibold text-[#15130f]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#5c5141]">{step.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-[#15130f]/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                What you receive
              </p>
              <h2 className="font-editorial mt-4 max-w-[25rem] text-4xl leading-[1] tracking-normal text-[#15130f] sm:text-[3.2rem]">
                Three buyer paths, one exact-site proof chain.
              </h2>
              <p className="mt-5 max-w-[28rem] text-sm leading-7 text-[#5c5141]">
                These are product paths, not generic model checkpoints. Each path starts with one
                site, one robot workflow, a pass bar, and the proof needed to decide the next step.
              </p>
            </div>
            <div className="overflow-x-auto border border-[#15130f]/10">
              <table className="min-w-[48rem] w-full border-collapse bg-white text-left text-sm">
                <thead className="bg-[#15130f] text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Path</th>
                    <th className="px-4 py-3 font-semibold">Buyer receives</th>
                    <th className="px-4 py-3 font-semibold">Plain-English definition</th>
                    <th className="px-4 py-3 font-semibold">Starts with</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#15130f]/10">
                  {whatYouReceiveRows.map((row) => (
                    <tr key={row.path}>
                      <td className="px-4 py-4 font-semibold text-[#15130f]">{row.path}</td>
                      <td className="px-4 py-4 leading-6 text-[#5c5141]">{row.receives}</td>
                      <td className="px-4 py-4 leading-6 text-[#5c5141]">{row.definition}</td>
                      <td className="px-4 py-4 leading-6 text-[#5c5141]">{row.firstAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-b border-[#15130f]/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-5 px-5 py-11 sm:px-8 lg:grid-cols-[0.52fr_0.48fr] lg:px-10 lg:py-14">
            <div className="min-h-[30rem]">
              <MonochromeMedia
                src={publicCaptureGeneratedAssets.hostedReviewPublicRoute}
                alt="Sample public route prepared for a policy evaluation set"
                className="h-full min-h-[30rem] rounded-none"
                imageClassName="h-full min-h-[30rem]"
                overlayClassName="bg-[linear-gradient(180deg,rgba(13,13,11,0.06),rgba(13,13,11,0.36))]"
              >
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                    Labeled sample
                  </p>
                  <h3 className="font-editorial mt-3 max-w-[28rem] text-4xl leading-[1] tracking-normal">
                    {selectedStory.locationName}
                  </h3>
                  <p className="mt-3 max-w-[30rem] text-sm leading-7 text-white/80">
                    {selectedStory.locationType}. Representative product evidence, not a customer result.
                  </p>
                </div>
              </MonochromeMedia>
            </div>
            <div className="flex flex-col justify-between bg-[#15130f] p-6 text-white sm:p-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d0ad72]">
                  Site package substrate
                </p>
                <h2 className="font-editorial mt-4 max-w-[34rem] text-4xl leading-[1] tracking-normal sm:text-[3.2rem]">
                  The site package is the substrate, not a detached demo.
                </h2>
                <p className="mt-5 max-w-[34rem] text-sm leading-7 text-white/70">
                  The package keeps capture proof, model output, hosted review, task thresholds, and commercial limits together. Model providers can change without breaking the readiness workflow.
                </p>
              </div>
              <div className="mt-8 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
                {packageLayers.map((layer) => (
                  <div key={layer.title} className="bg-[#15130f] p-5">
                    <h3 className="text-sm font-semibold text-white">{layer.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/65">{layer.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#15130f]/10 bg-[#efe7d8]">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                Hosted evaluation
              </p>
              <h2 className="font-editorial mt-4 max-w-[32rem] text-4xl leading-[1] tracking-normal text-[#15130f] sm:text-[3.2rem]">
                A buyer room for readiness evidence, limits, and next steps.
              </h2>
              <p className="mt-5 max-w-[30rem] text-sm leading-7 text-[#5c5141]">
                Hosted evaluation is the managed review layer between a listing and a pilot commitment. It turns the package into evidence a robot team can inspect while keeping claims tied to package artifacts.
              </p>
              <a
                href="/sample-deliverables"
                className="mt-7 inline-flex items-center justify-center border border-[#15130f] bg-[#15130f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2a251d]"
              >
                Inspect sample package
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/samples/sample-hosted-review-report.md"
                className="mt-3 inline-flex items-center justify-center border border-[#15130f]/20 px-6 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-white"
              >
                Open raw sample report
              </a>
            </div>
            <div className="grid gap-5">
              <div className="border border-[#15130f]/10 bg-white">
                <div className="grid grid-cols-[0.22fr_0.34fr_0.44fr] border-b border-[#15130f]/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6a51]">
                  <span>Run</span>
                  <span>Question</span>
                  <span>Decision evidence</span>
                </div>
                <div className="divide-y divide-[#15130f]/10">
                  {sampleHostedRunRows.slice(0, 3).map((row) => (
                    <div key={row.run} className="grid gap-3 px-4 py-4 text-sm leading-6 text-[#5c5141] md:grid-cols-[0.22fr_0.34fr_0.44fr]">
                      <span className="font-semibold text-[#15130f]">{row.run}</span>
                      <span>{row.scenario}</span>
                      <span>{row.observation}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-px border border-[#15130f]/10 bg-[#15130f]/10 sm:grid-cols-2">
                {decisionOptions.map((option) => (
                  <div key={option} className="bg-white px-5 py-4 text-sm font-semibold text-[#15130f]">
                    {option}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#15130f]/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10 lg:py-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                Proof boundary
              </p>
              <h2 className="font-editorial mt-4 max-w-[26rem] text-4xl leading-[1] tracking-normal text-[#15130f] sm:text-[3.2rem]">
                Commercially confident, verdicts evidence-gated.
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-[0.44fr_0.56fr]">
              <div className="border border-[#15130f]/10 bg-[#f5f1e8] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                  Package preview
                </p>
                <div className="mt-5 min-w-0 space-y-2 font-mono text-[12px] leading-6 text-[#4f4637]">
                  {sampleExportTree.slice(0, 6).map((item) => (
                    <div key={item} className="min-w-0 break-all border border-[#15130f]/10 bg-white px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-px border border-[#15130f]/10 bg-[#15130f]/10">
                {proofBoundaries.map((boundary) => (
                  <article key={boundary.title} className="bg-white p-5">
                    <h3 className="text-base font-semibold text-[#15130f]">{boundary.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#5c5141]">{boundary.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#15130f] px-5 py-12 text-white sm:px-8 lg:px-10 lg:py-14">
          <div className="mx-auto grid max-w-[88rem] gap-8 lg:grid-cols-[0.62fr_0.38fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d0ad72]">
                Next step
              </p>
              <h2 className="font-editorial mt-4 max-w-[42rem] text-4xl leading-[1] tracking-normal sm:text-[3.4rem]">
                Request the readiness review, or name the site to capture next.
              </h2>
              <p className="mt-5 max-w-[36rem] text-sm leading-7 text-white/70">
                The first useful answer is narrow: review a labeled exact-site sample, or tell Blueprint which site/task, robot profile, thresholds, and evidence needs would make the next report worth packaging.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <a
                href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product-bottom"
                className="inline-flex items-center justify-center border border-white bg-white px-6 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-[#f5f1e8]"
              >
                Request evaluation
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/proof"
                className="inline-flex items-center justify-center border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Inspect proof
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
