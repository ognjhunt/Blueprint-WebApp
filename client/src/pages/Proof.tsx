import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { getDemandCityMessaging, withDemandCityQuery } from "@/lib/cityDemandMessaging";
import {
  proofEvidencePacket,
  publicCaptureProofStories,
  sampleHostedRunRows,
  sampleProofTimeline,
} from "@/lib/proofEvidence";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

const proofRoutes = [
  {
    title: "How it works",
    body: "Follow the path from capture to package to run to delivery.",
    href: "/how-it-works",
  },
  {
    title: "Hosted review",
    body: "See how the managed review path stays tied to the same exact site.",
    href: "/exact-site-hosted-review",
  },
  {
    title: "Deliverables",
    body: "Inspect manifests, rights sheets, and output bundles tied to one listing.",
    href: "/sample-deliverables",
  },
  {
    title: "Capture examples",
    body: "Review grocery, retail, lobby, and common-area routes a capturer could submit.",
    href: "/case-studies",
  },
];

const proofSignals = [
  "The site is visible before the buyer commits to the path.",
  "Package and hosted paths remain tied to the same source record.",
  "Rights, privacy, and proof labels stay readable instead of implied.",
];

const proofLibrary = [
  {
    label: "Approved public proof",
    title: "Public demo listing",
    body: "A real inspectable demo path with listing, start flow, sample deliverables, and hosted-review report shape.",
    href: "/world-models/siteworld-f5fd54898cfb",
    action: "Open public demo",
  },
  {
    label: "Composite samples",
    title: "Launch case-study placeholders",
    body: "Polished grocery, hotel, retail, and mall examples that make the buyer story complete without claiming customer results.",
    href: "/case-studies",
    action: "View composite studies",
  },
  {
    label: "Request-gated proof",
    title: "Commercial listings",
    body: "Exact-site commercial pages can show approved metadata while package files, hosted sessions, and exports stay gated.",
    href: "/world-models",
    action: "Browse catalog",
  },
  {
    label: "Governance boundary",
    title: "What is not claimed",
    body: "No blanket site approval, unrestricted raw export, deployment guarantee, or private-area capture without authority.",
    href: "/governance",
    action: "Read governance",
  },
];

export default function Proof() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const cityMessaging = getDemandCityMessaging(searchParams.get("city"));

  return (
    <>
      <SEO
        title="Proof | Blueprint"
        description="Inspect the public proof path first: the sample listing, how it works, deliverables, and the next exact-site commercial step."
        canonical="/proof"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={publicCaptureGeneratedAssets.governancePublicCaptureExplainer}
            alt="Proof hub hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.74)_34%,rgba(255,255,255,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[34rem] flex-col justify-end">
                <EditorialSectionLabel>Proof</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  See the site before you commit to the path.
                </h1>
                <p className="mt-6 text-base leading-8 text-slate-700">
                  Start with the public listing, then inspect how the product works, what the deliverables look like, and how the exact-site path stays grounded in one real facility.
                </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        {cityMessaging ? (
          <section className="mx-auto max-w-[88rem] px-5 pt-8 sm:px-8 lg:px-10">
            <div className="border border-black/10 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{cityMessaging.label}</p>
              <h2 className="font-editorial mt-4 text-[2.5rem] leading-[0.94] tracking-[-0.04em] text-slate-950">
                {cityMessaging.proofHeading}
              </h2>
              <p className="mt-4 max-w-[42rem] text-sm leading-7 text-slate-600">
                {cityMessaging.proofBody}
              </p>
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-[0.48fr_0.52fr]">
            <MonochromeMedia
              src={publicCaptureGeneratedAssets.cedarMarketProofBoard}
              alt="Public demo proof board"
              className="min-h-[30rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.12))]"
            />
            <div className="bg-white px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Public proof"
                title="The first proof is simple: the site is real and the workflow is specific."
                description="Blueprint uses the public sample listing to show the physical site, the task lane, and the buying paths before any form is submitted."
              />
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Proof library"
              title="Know which evidence is real, sample, gated, or not claimed."
              description="This is the launch trust index: buyers can inspect public proof, composite examples, request-gated proof paths, and the limits Blueprint refuses to blur."
              className="max-w-3xl"
            />
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {proofLibrary.map((item) => (
                <a key={item.title} href={item.href} className="group border border-black/10 bg-[#f5f3ef] p-5 transition hover:bg-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <h2 className="font-editorial mt-4 text-[2rem] leading-[0.95] tracking-[-0.04em] text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                  <span className="mt-6 inline-flex items-center text-sm font-semibold text-slate-950">
                    {item.action}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-4 lg:grid-cols-[0.36fr_0.64fr]">
              <div className="bg-[#f5f3ef] p-6 lg:p-8">
                <EditorialSectionIntro
                  eyebrow="Sample packet"
                  title={proofEvidencePacket.headline}
                  description={proofEvidencePacket.summary}
                />
                <p className="mt-5 text-sm leading-7 text-slate-600">
                  {proofEvidencePacket.disclosure}
                </p>
              </div>
              <div className="grid gap-px bg-black/10 md:grid-cols-4">
                {sampleProofTimeline.map((item) => (
                  <div key={item.label} className="bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-4 text-sm leading-6 text-slate-700">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Public-facing examples"
            title="Useful sites are not warehouse-only."
            description="Everyday public areas can be valuable when the route is legal to capture, privacy rules are visible, and the robot question is specific."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {publicCaptureProofStories.map((story) => (
              <article key={story.id} className="overflow-hidden border border-black/10 bg-white">
                <MonochromeMedia
                  src={story.image}
                  alt={story.locationName}
                  className="aspect-[4/3] rounded-none"
                  imageClassName="aspect-[4/3]"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.34))]"
                />
                <div className="p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{story.label}</p>
                  <h2 className="mt-3 text-xl font-semibold leading-tight text-slate-950">
                    {story.locationName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{story.locationType} / {story.city}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{story.robotQuestion}</p>
                  <a
                    href="/sample-deliverables"
                    className="mt-5 inline-flex items-center text-sm font-semibold text-slate-950"
                  >
                    Inspect example files
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-12">
            <div className="border border-black/10 bg-[#f5f3ef] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Hosted report preview</p>
              <div className="mt-5 divide-y divide-black/10 border border-black/10 bg-white">
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
            <div className="bg-slate-950 p-6 text-white">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What this proves</p>
              <h2 className="font-editorial mt-4 text-[2.6rem] leading-[0.94] tracking-[-0.05em]">
                Route, rights, report, and next step.
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/70">
                The proof is ready when a buyer can see where the capture came from, which public areas were in scope, what was redacted, what the hosted review observed, and which package or hosted path comes next.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
	            <EditorialSectionIntro
	              eyebrow="Next routes"
	              title="Choose what to inspect next."
	              description="Move from the proof hub into the page that answers your next buyer, operator, or capturer question."
	              className="max-w-3xl"
	            />
            <div className="mt-8 grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {proofRoutes.map((route) => (
                  <a key={route.href} href={route.href} className="border border-black/10 bg-[#f5f3ef] p-5 transition hover:bg-white">
                    <h2 className="font-editorial text-[1.8rem] leading-[0.95] tracking-[-0.04em] text-slate-950">
                      {route.title}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{route.body}</p>
                  </a>
                ))}
              </div>
              <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Trust signals</p>
                <div className="mt-6 space-y-4 text-sm leading-7 text-white/70">
                  {proofSignals.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Move from proof into the exact-site path."
            description="Inspect the listing first, then continue into deliverables, hosted review, or a direct buyer brief."
            imageSrc={publicCaptureGeneratedAssets.governancePublicCaptureExplainer}
            imageAlt="Proof board"
            primaryHref="/world-models"
            primaryLabel="View sample listing"
            secondaryHref={withDemandCityQuery("/contact?persona=robot-team", cityMessaging?.key ?? null)}
            secondaryLabel="Contact Blueprint"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
