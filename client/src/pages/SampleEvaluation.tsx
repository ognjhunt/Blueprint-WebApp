import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFilmstrip,
  EditorialMetricStrip,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { siteWorldCards } from "@/data/siteWorlds";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { mediaRoomSampleEvaluation, sampleExportTree, sampleHostedRunRows } from "@/lib/proofEvidence";
import { publicDemoHref } from "@/lib/marketingProof";
import { getEditorialSiteImage } from "@/lib/siteEditorialContent";
import { ArrowRight, FileText, PackageOpen, Play, Route, ShieldCheck } from "lucide-react";

const demoSite =
  siteWorldCards.find((site) => site.id === mediaRoomSampleEvaluation.siteId)
  || siteWorldCards[0];

const sampleMetrics = [
  {
    label: "Capture basis",
    detail: mediaRoomSampleEvaluation.captureBasis,
  },
  {
    label: "Robot setup",
    detail: mediaRoomSampleEvaluation.robotSetup,
  },
  {
    label: "Workflow lane",
    detail: mediaRoomSampleEvaluation.workflowLane,
  },
  {
    label: "Truth boundary",
    detail: "Example material. Not a customer result or deployment guarantee.",
  },
];

const packetSteps = [
  {
    label: "01",
    title: "Capture-backed site record",
    body: "The sample starts with one exact site record, route, capture id, and freshness state.",
    icon: Route,
  },
  {
    label: "02",
    title: "Manifest and rights",
    body: "Package fields, export limits, privacy boundaries, and request-gated access rules stay visible.",
    icon: ShieldCheck,
  },
  {
    label: "03",
    title: "Hosted setup",
    body: "A robot profile, task, scenario, requested outputs, and notes become one scoped hosted-review request.",
    icon: Play,
  },
  {
    label: "04",
    title: "Evidence and export",
    body: "Run observations, route notes, report rows, and bundle files leave the review as an inspectable packet.",
    icon: PackageOpen,
  },
];

const sampleFrames = [
  {
    src: getEditorialSiteImage(demoSite),
    alt: "Media room route overview",
    time: "00",
    title: "Overview",
  },
  {
    src: editorialGeneratedAssets.sampleEvaluationProofBoard,
    alt: "Sample proof board",
    time: "01",
    title: "Packet",
  },
  {
    src: "/siteworld-f5fd54898cfb-runtime-reference.png",
    alt: "Runtime reference",
    time: "02",
    title: "Runtime",
  },
  {
    src: "/siteworld-f5fd54898cfb-presentation-reference.png",
    alt: "Presentation reference",
    time: "03",
    title: "Review",
  },
  {
    src: getEditorialSiteImage(demoSite),
    alt: "Exit route",
    time: "04",
    title: "Export",
  },
];

export default function SampleEvaluation() {
  return (
    <>
      <SEO
        title="Sample Evaluation | Blueprint"
        description="Inspect one example exact-site evaluation: capture basis, manifest, rights, hosted setup, run evidence, export bundle, and limits."
        canonical="/sample-evaluation"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.sampleEvaluationProofBoard}
            alt="Blueprint sample evaluation proof board"
            className="min-h-[42rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[42rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.54)_32%,rgba(0,0,0,0.10)_78%)]"
          >
            <RouteTraceOverlay className="opacity-55" />
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] items-end gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-16">
                <div className="text-white">
                  <EditorialSectionLabel light>Sample Evaluation</EditorialSectionLabel>
                  <h1 className="font-editorial mt-6 max-w-[38rem] text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5.2rem]">
                    One exact site, end to end.
                  </h1>
                  <p className="mt-6 max-w-[31rem] text-base leading-8 text-white/85">
                    An example showing how Blueprint turns a captured site into
                    manifest, rights, hosted setup, run evidence, export shape, and limits.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    <ProofChip light>Example sample</ProofChip>
                    <ProofChip light>Capture-backed route</ProofChip>
                    <ProofChip light>Request-gated runtime</ProofChip>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href={publicDemoHref}
                      className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                    >
                      Inspect sample site
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&source=sample-evaluation&path=hosted-evaluation&siteName=Media%20Room%20Demo%20Walkthrough"
                      className="inline-flex items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Scope hosted evaluation
                    </a>
                  </div>
                </div>

                <div className="hidden justify-end lg:flex">
                  <div className="w-full max-w-[22rem] border border-white/15 bg-black/40 p-5 text-white backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                      Packet
                    </p>
                    <h2 className="mt-4 text-xl font-semibold">{mediaRoomSampleEvaluation.siteName}</h2>
                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {mediaRoomSampleEvaluation.buyerQuestion}
                    </p>
                    <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/60">
                      {mediaRoomSampleEvaluation.packetId}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10">
          <EditorialMetricStrip items={sampleMetrics} />
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.38fr_0.62fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] p-6 lg:p-8">
              <EditorialSectionIntro
                eyebrow="Packet flow"
                title="The site stays attached from capture to export."
                description="This page stays focused on one exact site so a robot team can see the path without mixing in unrelated examples."
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-2">
              {packetSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="bg-white p-5">
                    <Icon className="h-5 w-5 text-slate-950" />
                    <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {step.label}
                    </p>
                    <h2 className="mt-3 text-xl font-semibold leading-tight text-slate-950">
                      {step.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-[0.56fr_0.44fr]">
            <div className="bg-slate-950 p-4 text-white">
              <EditorialFilmstrip frames={sampleFrames} />
            </div>
            <div className="border border-black/10 bg-white p-6 lg:p-8">
              <EditorialSectionIntro
                eyebrow="Truth boundary"
                title="Polished sample, explicit limits."
                description={mediaRoomSampleEvaluation.disclosure}
              />
              <div className="mt-6 grid gap-2">
                {mediaRoomSampleEvaluation.truthBoundaries.map((item) => (
                  <div key={item} className="border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-y border-black/10 bg-white">
          <div className="mx-auto grid min-w-0 max-w-[88rem] gap-4 overflow-hidden px-4 py-10 sm:px-8 lg:grid-cols-[0.46fr_0.54fr] lg:px-10 lg:py-12">
            <div className="min-w-0 overflow-hidden border border-black/10 bg-[#f5f3ef] p-5 sm:p-6 lg:p-8">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <FileText className="h-4 w-4" />
                What the buyer inspects
              </div>
              <div className="mt-5 grid gap-3">
                {mediaRoomSampleEvaluation.artifacts.map((item) => (
                  <div key={item} className="border border-black/10 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid min-w-0 gap-4">
              <div className="min-w-0 overflow-hidden border border-black/10 bg-[#f5f3ef] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Hosted run evidence</p>
                <div className="mt-4 divide-y divide-black/10 border border-black/10 bg-white">
                  {sampleHostedRunRows.map((row) => (
                    <div key={row.run} className="grid gap-3 p-4 text-sm leading-6 text-slate-700 md:grid-cols-[0.16fr_0.28fr_0.36fr_0.2fr]">
                      <span className="font-semibold text-slate-950">{row.run}</span>
                      <span>{row.scenario}</span>
                      <span>{row.observation}</span>
                      <span className="text-slate-950">{row.output}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0 overflow-hidden border border-black/10 bg-slate-950 p-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Export bundle</p>
                <div className="mt-4 grid gap-2 font-mono text-[12px] leading-6 text-white/70 md:grid-cols-2">
                  {sampleExportTree.map((item) => (
                    <div key={item} className="border border-white/10 bg-white/5 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Turn the sample into a real request."
            description="Start from the public sample site, then scope package access or hosted evaluation around the exact site and robot question your team needs answered."
            imageSrc={editorialGeneratedAssets.sampleEvaluationProofBoard}
            imageAlt="Sample evaluation proof board"
            primaryHref={publicDemoHref}
            primaryLabel="Inspect sample site"
            secondaryHref="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&source=sample-evaluation&path=hosted-evaluation&siteName=Media%20Room%20Demo%20Walkthrough"
            secondaryLabel="Scope hosted evaluation"
          />
        </section>
      </div>
    </>
  );
}
