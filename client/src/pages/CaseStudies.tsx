import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { publicDemoHref } from "@/lib/marketingProof";
import {
  publicCaptureProofStories,
  sampleHostedRunRows,
} from "@/lib/proofEvidence";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { ArrowRight } from "lucide-react";

const compositeOutcomes = [
  {
    title: "Grocery aisle scanning",
    metric: "4 route risks surfaced",
    body: "Endcaps, refrigeration glass, checkout-adjacent exclusions, and cart occlusion became visible before a robot team asked for a private site walk.",
  },
  {
    title: "Hotel delivery transfer",
    metric: "3 approval questions clarified",
    body: "Lobby access, elevator threshold, and front-desk privacy boundaries became the operator discussion instead of an abstract demo request.",
  },
  {
    title: "Retail patrol review",
    metric: "2 buyer paths separated",
    body: "Hosted review could proceed with public sales-floor evidence while raw export stayed gated behind listing-specific rights review.",
  },
];

const launchStudyStages = [
  "Capture a lawful public-facing route or operator-approved facility path.",
  "Attach manifest, rights, privacy, restricted-zone, and freshness labels.",
  "Open a hosted report with observations and non-guarantee limits a buyer can read.",
  "Route the serious buyer into package access, hosted review, or operator permissioning.",
];

export default function CaseStudies() {
  return (
    <>
      <SEO
        title="Capture Examples | Blueprint"
        description="Sample case studies showing how public-facing captures can become site packages and hosted review evidence for robot teams."
        canonical="/case-studies"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={publicCaptureGeneratedAssets.everydayPlacesCollage}
            alt="Public-facing proof story hero"
            className="min-h-[40rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[40rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.16)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[34rem] flex-col justify-end text-white">
                  <EditorialSectionLabel light>Capture Examples</EditorialSectionLabel>
                  <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                    Complete examples, clearly marked as samples.
                  </h1>
                  <p className="mt-6 text-base leading-8 text-white/75">
                    Sample studies for grocery, retail, lobby, and common-area routes. They show the evidence structure without claiming real customer results.
                  </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Examples"
            title="A case study is useful only when the evidence path is visible."
            description="Each sample study shows the location type, capture cue, robot question, evidence a buyer would inspect, rules for the capturer, and the next decision."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {publicCaptureProofStories.map((story) => (
              <article key={story.id} className="overflow-hidden border border-black/10 bg-white">
                <div className="grid gap-px bg-black/10 md:grid-cols-[0.42fr_0.58fr]">
                  <MonochromeMedia
                    src={story.image}
                    alt={story.locationName}
                    className="min-h-[24rem] rounded-none"
                    imageClassName="min-h-[24rem]"
                    overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.42))]"
                  />
                  <div className="bg-white p-6">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sample example / {story.label}</p>
                    <h2 className="font-editorial mt-4 text-[2.5rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                      {story.locationName}
                    </h2>
                    <p className="mt-3 text-sm text-slate-500">{story.locationType} / {story.city}</p>
                    <p className="mt-5 text-sm leading-7 text-slate-700">{story.robotQuestion}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="border border-black/10 bg-[#f5f3ef] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Capture app cue</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{story.captureAppCue}</p>
                      </div>
                      <div className="border border-black/10 bg-[#f5f3ef] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Buyer</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {story.buyerPersona}, {story.buyerRole}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-px bg-black/10 md:grid-cols-3">
                  {story.evidenceOpened.map((item) => (
                    <div key={item} className="bg-[#f8f6f1] p-5 text-sm leading-7 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 bg-white p-5">
                  <p className="max-w-[44rem] text-sm leading-7 text-slate-700">{story.decisionNote}</p>
                  <a
                    href="/sample-deliverables"
                    className="inline-flex items-center text-sm font-semibold text-slate-950"
                  >
                    Inspect sample packet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 p-6 text-white lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Sample outcome board</p>
              <h2 className="font-editorial mt-4 text-[2.7rem] leading-[0.94] tracking-[-0.05em]">
                The story looks real because the workflow is concrete.
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/70">
                These are not customer testimonials. They show how Blueprint should present approved real case studies when customer proof is available.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {compositeOutcomes.map((item) => (
                <div key={item.title} className="border border-black/10 bg-[#f5f3ef] p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.metric}</p>
                  <h2 className="font-editorial mt-4 text-[2rem] leading-[0.95] tracking-[-0.04em]">{item.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.38fr_0.62fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] p-6 lg:p-8">
              <EditorialSectionIntro
                eyebrow="Hosted report"
                title="The story ends in run evidence."
                description="A story is useful only if the buyer can see what was run, what was observed, and what the next step is."
              />
            </div>
            <div className="divide-y divide-black/10 border border-black/10 bg-white">
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
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-[0.4fr_0.6fr]">
            <div className="bg-[#f5f3ef] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Case-study checklist</p>
              <h2 className="font-editorial mt-4 text-[2.7rem] leading-[0.94] tracking-[-0.05em]">
                Keep the proof visible when a real story is approved.
              </h2>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-4">
              {launchStudyStages.map((stage, index) => (
                <div key={stage} className="bg-white p-5 text-sm leading-7 text-slate-700">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</p>
                  <p className="mt-3">{stage}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Turn a public-facing capture into buyer evidence."
            description="Start with the sample listing, the capture app, or a direct request tied to one site and workflow question."
            imageSrc={publicCaptureGeneratedAssets.cedarMarketProofBoard}
            imageAlt="Proof packet board"
            primaryHref={publicDemoHref}
            primaryLabel="Inspect sample listing"
            secondaryHref="/capture-app"
            secondaryLabel="Open capture app"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
