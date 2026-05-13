import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFilmstrip,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import {
  proofEvidencePacket,
  publicCaptureProofStories,
  sampleExportTree,
  sampleHostedRunRows,
} from "@/lib/proofEvidence";
import { analyticsEvents } from "@/lib/analytics";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { hostedFilmstripFrames } from "@/lib/siteEditorialContent";
import { breadcrumbJsonLd, productJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight, MapPinned, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import { useEffect } from "react";

const trustCards = [
  {
    title: "What stays explicit",
    body: "Hosted evaluation is not a deployment guarantee. Rights, privacy, restrictions, and export boundaries stay visible and irreversible commitments remain human-gated.",
  },
  {
    title: "When this is a fit",
    body: "Use this path when one real site already matters and the team needs run evidence before moving files around or sending people on-site.",
  },
  {
    title: "Typical first reply",
    body: "Public-listing and hosted-evaluation questions usually get a first reply within 1 business day. Rights or export review usually gets a first scoped answer within 2 business days.",
  },
];

const reviewSteps = [
  {
    title: "Scope",
    body: "Name one listing or facility, one workflow, and the robot setup or policy question that matters.",
  },
  {
    title: "Run",
    body: "Blueprint opens a hosted evaluation session against the exact-site world model and records task outcomes, route behavior, observations, and limits.",
  },
  {
    title: "Export",
    body: "The buyer leaves with a review summary, run evidence, export framing, and a clear recommendation for what to do next.",
  },
];

const hostedOutputs = [
  "Review summary and next-step recommendation",
  "Observation frames and route/replay notes when available",
  "Export bundle scope, dataset references, and raw-bundle pointers",
  "Rights, restrictions, and non-guarantee language attached to the result",
];

export default function ExactSiteHostedReview() {
  useEffect(() => {
    analyticsEvents.exactSiteReviewView("exact_site_hosted_review_v1");
  }, []);

  return (
    <>
      <SEO
        title="Product | Blueprint"
        description="See how Blueprint turns real-site capture into site-specific world models, package access, and hosted evaluation for robot teams."
        canonical="/product"
        type="product"
        jsonLd={[
          webPageJsonLd({
            path: "/product",
            name: "Blueprint Product",
            description:
              "Real-site capture, site-specific world models, package access, hosted evaluation, and provenance boundaries for robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Product", path: "/product" },
          ]),
          productJsonLd({
            path: "/product",
            name: "Blueprint Site-Specific World Models",
            description:
              "A capture-backed product path for one real site, one workflow, package access, hosted evaluation, and clear export boundaries.",
            image: publicCaptureGeneratedAssets.hostedReviewPublicRoute,
            category: "Site-specific world-model product",
            properties: [
              { name: "Capture basis", value: "Real-site capture with provenance metadata" },
              { name: "Output", value: "World model, site package, hosted evaluation, export scope, and next-step recommendation" },
              { name: "Boundary", value: "Not a deployment guarantee" },
            ],
          }),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.hostedReviewHero}
            alt="Hosted evaluation hero"
            className="min-h-[42rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[42rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_34%,rgba(0,0,0,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.6fr_0.4fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[34rem] flex-col justify-end selection:bg-white/20 selection:text-white">
                <EditorialSectionLabel light>Product</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[36rem] text-[3.55rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[4.8rem]">
                  Exact-site world models, hosted for buyer review.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-white/[0.86]">
                  Blueprint starts with real capture, then keeps the world model, package scope, hosted session, and proof boundaries attached to the same site.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <ProofChip light>Site package</ProofChip>
                  <ProofChip light>Request-gated access</ProofChip>
                  <ProofChip light>Hosted evaluation</ProofChip>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
	                    href="/world-models"
                    className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
	                    Browse world models
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
	                    href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=product"
                    className="inline-flex items-center justify-center border border-white/[0.16] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  >
	                    Request hosted evaluation
                  </a>
                </div>
              </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[24rem] overflow-hidden border border-white/[0.14] bg-black/[0.42] text-white backdrop-blur-sm">
                  <div className="border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/[0.44]">
                    Hosted evaluation workspace
                  </div>
                  <div className="grid gap-3 p-5">
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.08] p-4 text-sm text-white/[0.72]">
                    Site: one real place
                    </div>
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.08] p-4 text-sm text-white/[0.72]">
                    Eval: task runs, observations, exports
                    </div>
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.08] p-4 text-sm text-white/[0.72]">
                    Output: next step stays explicit
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
	          <div className="grid gap-6 lg:grid-cols-[0.38fr_0.62fr]">
	            <EditorialSectionIntro
	              eyebrow="Preview"
	              title="See the product path quickly."
	              description="Start with a real site. Then choose package access, managed hosted evaluation, or a narrower capture request."
	            />
            <div className="overflow-hidden border border-black/10 bg-slate-950 p-4 text-white">
              <EditorialFilmstrip frames={hostedFilmstripFrames.map((frame, index) => ({
                ...frame,
                src: publicCaptureProofStories[index % publicCaptureProofStories.length].image,
              }))} />
            </div>
	          </div>
	        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-4 lg:grid-cols-[0.44fr_0.56fr]">
              <div className="bg-[#f5f3ef] p-6 lg:p-8">
                <EditorialSectionIntro
                  eyebrow="Sample review packet"
                  title="A sample shows the path without pretending to be customer proof."
                  description="The grocery route is a sample. It shows the motion: a capturer records an everyday place, Blueprint reviews privacy and restrictions, and a robot team gets evidence it can evaluate."
                />
                <div className="mt-7 space-y-3">
                  {[
                    ["Location", `${proofEvidencePacket.selectedStory.locationName}, ${proofEvidencePacket.selectedStory.city}`],
                    ["Capture cue", proofEvidencePacket.selectedStory.captureAppCue],
                    ["Buyer", `${proofEvidencePacket.selectedStory.buyerPersona}, ${proofEvidencePacket.selectedStory.buyerRole}`],
                    ["Boundary", "Example sample, not a customer result"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-3 border border-black/10 bg-white px-4 py-3 text-sm md:grid-cols-[0.28fr_0.72fr]">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
                      <span className="text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-px bg-black/10 md:grid-cols-3">
                  {[
                    {
                      icon: Smartphone,
                      label: "Capture",
                      body: "Record a public-facing route from common areas and submit it for review.",
                    },
                    {
                      icon: ShieldCheck,
                      label: "Review",
                      body: "Privacy, rights, restrictions, and usefulness are checked before buyer framing.",
                    },
                    {
                      icon: UsersRound,
                      label: "Buyer room",
                      body: "Robot teams compare run evidence, limits, and export scope before committing.",
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="bg-white p-5">
                        <Icon className="h-5 w-5 text-slate-950" />
                        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{item.body}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="border border-black/10 bg-slate-950 p-5 text-white">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                    <MapPinned className="h-4 w-4" />
                    Capture example set
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {publicCaptureProofStories.map((story) => (
                      <div key={story.id} className="border border-white/10 bg-white/5 p-4">
                        <p className="text-sm font-semibold text-white">{story.locationName}</p>
                        <p className="mt-2 text-xs leading-5 text-white/60">
                          {story.locationType} / {story.captureAppCue}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Session"
                  title="What happens in a hosted evaluation."
                  description="The setup stays narrow so the result can answer a robot-team question instead of becoming a generic demo."
              />
              <a
                href="/samples/sample-hosted-review-report.md"
                className="mt-7 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open sample report
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {reviewSteps.map((step) => (
                <div key={step.title} className="bg-white p-6">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{step.title}</p>
                  <p className="mt-5 text-sm leading-7 text-slate-700">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] min-w-0 gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-12">
            <div className="min-w-0 border border-black/10 bg-[#f5f3ef] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Run evidence example</p>
              <div className="mt-5 divide-y divide-black/10 border border-black/10 bg-white">
                {sampleHostedRunRows.map((row) => (
                  <div key={row.run} className="grid min-w-0 gap-3 p-4 text-sm leading-6 text-slate-700 md:grid-cols-[0.16fr_0.3fr_0.34fr_0.2fr]">
                    <span className="min-w-0 font-semibold text-slate-950">{row.run}</span>
                    <span className="min-w-0 break-words">{row.scenario}</span>
                    <span className="min-w-0 break-words">{row.observation}</span>
                    <span className="min-w-0 break-words text-slate-950">{row.output}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="min-w-0 border border-black/10 bg-slate-950 p-6 text-white lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Export evidence</p>
              <h2 className="font-editorial mt-4 text-[2.4rem] leading-[0.94] tracking-[-0.05em]">
                What leaves the session.
              </h2>
              <div className="mt-5 space-y-2 font-mono text-[12px] leading-6 text-white/70">
                {sampleExportTree.slice(0, 6).map((item) => (
                  <div key={item} className="min-w-0 break-all border border-white/10 bg-white/5 px-3 py-2">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-4 lg:grid-cols-[0.5fr_0.5fr]">
              <MonochromeMedia
                src={publicCaptureGeneratedAssets.hostedReviewPublicRoute}
                alt="Hosted evaluation interior"
                className="min-h-[28rem]"
                overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.24))]"
              />
              <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
                <EditorialSectionIntro
                  eyebrow="Commercial shape"
                  title="Hosted evaluation sits between listing and commitment."
                  description="It is the managed eval path for one site-specific world model, not a generic benchmark console or deployment guarantee."
                />
                  <div className="mt-8 space-y-3 text-sm leading-7 text-slate-700">
                    <div>1. Pick the site and workflow.</div>
                    <div>2. Confirm the robot setup in scope.</div>
                    <div>3. Run the hosted evaluation and compare the evidence.</div>
                    <div>4. Decide what to do next with the proof still attached.</div>
                  </div>
                  <div className="mt-8 border border-black/10 bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">What you receive</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      {hostedOutputs.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Trust and fit"
            title="What this path is good for and what it does not claim."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {trustCards.map((card, index) => (
              <div
                key={card.title}
                className={index === 1 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
              >
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em]">
                  {card.title}
                </h2>
                <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-white/[0.72]" : "text-slate-600"}`}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Start with one world model and one workflow."
            description="Browse the catalog, open sample proof, or send the world model your team needs when it is not listed yet."
            imageSrc={editorialGeneratedAssets.hostedReviewHero}
            imageAlt="Hosted evaluation hero"
            primaryHref="/proof"
            primaryLabel="Open sample proof"
            secondaryHref="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=product-bottom"
            secondaryLabel="Request hosted evaluation"
          />
        </section>
      </div>
    </>
  );
}
