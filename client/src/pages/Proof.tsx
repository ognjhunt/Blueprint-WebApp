import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { getDemandCityMessaging, withDemandCityQuery } from "@/lib/cityDemandMessaging";
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
];

const proofSignals = [
  "The site is visible before the buyer commits to the path.",
  "Package and hosted paths remain tied to the same source record.",
  "Rights, privacy, and proof labels stay readable instead of implied.",
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
            src={editorialGeneratedAssets.proofBoardGovernance}
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
                  Start with the public proof surface, then inspect how the product works, what the deliverables look like, and how the exact-site path stays grounded in one real facility.
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
              src={editorialGeneratedAssets.proofBoardDeliverables}
              alt="Public demo proof surface"
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
	              eyebrow="Proof routes"
	              title="Proof routes."
	              description="The hub points into the next decision surface without losing the proof context."
	              className="max-w-3xl"
	            />
            <div className="mt-8 grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
              <div className="grid gap-4 md:grid-cols-3">
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
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Trust signals</p>
                <div className="mt-6 space-y-4 text-sm leading-7 text-white/72">
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
            imageSrc={editorialGeneratedAssets.proofBoardGovernance}
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
