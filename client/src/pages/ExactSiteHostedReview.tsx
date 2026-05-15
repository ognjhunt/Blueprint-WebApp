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
    title: "Exact-site capture",
    body: "Record the real route, timestamps, device context, capture notes, and access boundaries.",
    icon: Smartphone,
  },
  {
    label: "02",
    title: "World model package",
    body: "Package the site into a site-specific product with manifest, media, restrictions, and review artifacts.",
    icon: MapPinned,
  },
  {
    label: "03",
    title: "Hosted evaluation",
    body: "Open a buyer room for task runs, route review, observations, and export framing.",
    icon: ShieldCheck,
  },
  {
    label: "04",
    title: "Buyer decision",
    body: "Approve export, request recapture, scope the next workflow, or leave the package in review.",
    icon: UsersRound,
  },
];

const packageLayers = [
  {
    title: "Capture proof",
    body: "Raw-bundle pointers, route notes, freshness, and provenance remain attached to the product record.",
  },
  {
    title: "World output",
    body: "Model artifacts and previews sit behind stable site-package contracts, not a permanent model backend.",
  },
  {
    title: "Hosted buyer room",
    body: "Run evidence, observations, limitations, and recommendation notes are reviewed in one evaluation surface.",
  },
  {
    title: "Commercial boundary",
    body: "Rights, privacy, export scope, and irreversible commitments stay request-scoped and review-gated.",
  },
];

const decisionOptions = [
  "Approve a scoped export",
  "Request a deeper hosted run",
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
    body: "The page sells the hosted evaluation workflow while confirming session availability and runtime scope per site/request.",
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
    definition: "A site package is the deliverable set for one exact site and robot workflow.",
    firstAction: "Request package access for one site.",
  },
  {
    path: "Hosted review",
    receives:
      "Blueprint-run review room, scoped tasks, observations, run notes, output links, and export decision context.",
    definition: "Hosted review means Blueprint runs the site model for inspection before file handoff.",
    firstAction: "Request a hosted evaluation path.",
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
        description="Blueprint turns exact-site capture into site-specific world model packages, hosted evaluation, and buyer decision evidence for robot teams."
        canonical="/product"
        type="product"
        jsonLd={[
          webPageJsonLd({
            path: "/product",
            name: "Blueprint Product",
            description:
              "Exact-site capture, site-specific world model packages, hosted evaluation, and buyer decision evidence for robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Product", path: "/product" },
          ]),
          productJsonLd({
            path: "/product",
            name: "Blueprint Site-Specific World Model Packages",
            description:
              "A capture-backed product workflow for exact-site world model packages, hosted evaluation requests, and buyer decisions with proof attached.",
            image: publicCaptureGeneratedAssets.hostedReviewPublicRoute,
            category: "Site-specific world-model product",
            properties: [
              { name: "Capture basis", value: "Exact-site capture with provenance metadata" },
              { name: "Package", value: "Site manifest, model artifacts, hosted review, and export scope" },
              { name: "Hosted access", value: "Evaluation path confirmed per request" },
            ],
          }),
        ]}
      />

      <div className="bg-[#f5f1e8] text-[#15130f]">
        <section className="relative border-b border-[#15130f]/10 bg-[#0d0d0b] text-white">
          <MonochromeMedia
            src={editorialGeneratedAssets.hostedReviewHero}
            alt="Blueprint hosted evaluation workspace"
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
                    Turn the exact site into a decision-ready world model.
                  </h1>
                  <p className="mt-5 max-w-[35rem] text-base leading-7 text-white/82 sm:leading-8">
                    Blueprint packages capture, world-model output, hosted review, and buyer proof around one site so robot teams can decide before field time.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    <ProofChip light>Capture-backed</ProofChip>
                    <ProofChip light>Site package access</ProofChip>
                    <ProofChip light>Hosted buyer review</ProofChip>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a
                      href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product"
                      className="inline-flex w-full items-center justify-center border border-white bg-white px-6 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-[#f5f1e8] sm:w-auto"
                    >
                      Request hosted review
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

        <section className="border-b border-[#15130f]/10 bg-[#f5f1e8]">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6a51]">
                Buyer workflow
              </p>
              <h2 className="font-editorial mt-4 max-w-[24rem] text-4xl leading-[1] tracking-normal text-[#15130f] sm:text-[3.2rem]">
                One path from capture to decision.
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
                site, one robot workflow, and the proof needed to decide the next step.
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
                alt="Sample public route prepared for hosted evaluation"
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
                  World model package
                </p>
                <h2 className="font-editorial mt-4 max-w-[34rem] text-4xl leading-[1] tracking-normal sm:text-[3.2rem]">
                  The sellable product is the site package, not a detached demo.
                </h2>
                <p className="mt-5 max-w-[34rem] text-sm leading-7 text-white/70">
                  The package keeps capture proof, model output, hosted review, and commercial limits together. Model providers can change without breaking the buyer workflow.
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
                A buyer room for runs, limits, and next steps.
              </h2>
              <p className="mt-5 max-w-[30rem] text-sm leading-7 text-[#5c5141]">
                Hosted evaluation is the managed review layer between a listing and a commercial commitment. It turns the package into evidence a robot team can act on.
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
                Commercially confident, proof honest.
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
                Request the review, or name the site to capture next.
              </h2>
              <p className="mt-5 max-w-[36rem] text-sm leading-7 text-white/70">
                The first useful answer is narrow: review a labeled exact-site sample, or tell Blueprint which workflow would make the next capture worth packaging.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <a
                href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=product-bottom"
                className="inline-flex items-center justify-center border border-white bg-white px-6 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-[#f5f1e8]"
              >
                Request hosted review
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
