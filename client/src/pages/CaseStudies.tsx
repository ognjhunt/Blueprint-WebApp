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

export default function CaseStudies() {
  return (
    <>
      <SEO
        title="Proof Stories | Blueprint"
        description="Composite proof stories showing how public-facing captures can become buyer-readable site packages and hosted review evidence."
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
                  <EditorialSectionLabel light>Proof Stories</EditorialSectionLabel>
                  <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                    Everyday places, made inspectable.
                  </h1>
                  <p className="mt-6 text-base leading-8 text-white/76">
                    Composite stories showing how grocery, retail, lobby, and common-area captures become proof packets. These are sample narratives, not named customer outcomes.
                  </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Story set"
            title="The missing evidence becomes a packet, not a paragraph."
            description="Each story shows the public-facing location type, capture app cue, buyer question, evidence opened, guardrails, and decision note. Swap the composite names for real data as captures become approved."
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
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{story.label}</p>
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

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Turn a public-facing capture into buyer evidence."
            description="Start with the sample listing, the capture app, or a short brief tied to one site and workflow question."
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
