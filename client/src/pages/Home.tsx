import { SEO } from "@/components/SEO";
import {
  proofReferenceImageSrc,
  proofReelPosterSrc,
  publicDemoHref,
} from "@/lib/marketingProof";
import { ArrowRight } from "lucide-react";

const signalPills = [
  "Real capture provenance",
  "Site package licensing",
  "Hosted session access",
];

const siteCards = [
  {
    eyebrow: "Commercial exemplar",
    title: "Chicago grocery backroom",
    detail:
      "Dock-side tote handoff, aisle replenishment, and shelf staging on one exact site.",
    href: "/world-models/sw-chi-01",
    imageSrc: "/illustrations/sw-chi-01-runtime-proof.svg",
    imageAlt: "Runtime proof view for the Chicago grocery backroom site world.",
  },
  {
    eyebrow: "Public sample",
    title: "Media room walkthrough",
    detail:
      "The public listing that shows the site, package framing, and hosted path on one surface.",
    href: publicDemoHref,
    imageSrc: proofReelPosterSrc,
    imageAlt: "Presentation still from the public sample site listing.",
  },
  {
    eyebrow: "Runtime reference",
    title: "Hosted view reference",
    detail:
      "A buyer-visible runtime still that keeps the hosted path tied to the same facility.",
    href: publicDemoHref,
    imageSrc: proofReferenceImageSrc,
    imageAlt: "Runtime reference still for the public sample site.",
  },
];

const productCards = [
  {
    title: "Site Package",
    body:
      "License the capture-backed site package when your team wants the exact-site product in its own stack.",
    href: "/pricing",
    cta: "View package path",
  },
  {
    title: "Hosted Session",
    body:
      "Run the site with Blueprint when you need reruns, review, and exports before moving the package.",
    href: "/exact-site-hosted-review",
    cta: "See hosted path",
  },
];

const trustLines = [
  "Capture provenance stays attached to the site record.",
  "Rights, freshness, and restrictions stay visible.",
  "Package and hosted access stay tied to the same facility.",
];

const proofTiles = [
  {
    title: "Capture provenance",
    body:
      "Walkthrough media, timestamps, poses, and source context stay readable instead of disappearing behind a generic demo.",
  },
  {
    title: "Package outputs",
    body:
      "The package path keeps the manifest, licensing surface, and export framing concrete before a buyer commits.",
  },
  {
    title: "Hosted session artifacts",
    body:
      "The managed path stays grounded to one exact site with reruns, rollouts, and sample artifacts.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Site-Specific World Models For Real Facilities"
        description="Blueprint helps robot teams inspect, license, and run exact-site world-model products built from real capture."
        canonical="/"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_42%),radial-gradient(circle_at_80%_12%,_rgba(14,116,144,0.16),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.72),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-6rem] top-24 h-48 w-48 rounded-full bg-[#d6eceb]/65 blur-3xl" />
          <div className="absolute right-[-8rem] top-16 h-64 w-64 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.98fr_1.02fr] lg:items-end">
              <div className="max-w-3xl">
                <SectionLabel>Blueprint</SectionLabel>
                <h1 className="font-editorial mt-5 max-w-3xl text-[3.4rem] leading-[0.93] tracking-[-0.05em] text-slate-950 sm:text-[4.7rem]">
                  Site-specific world models for real facilities.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.06rem]">
                  Blueprint helps robot teams inspect, license, and run exact-site
                  world-model products built from real capture.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Explore Sites
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                  >
                    Request Access
                  </a>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.08fr_0.72fr]">
                <article className="group relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#d8d5cd] shadow-[0_30px_80px_-54px_rgba(15,23,42,0.45)]">
                  <img
                    src={proofReelPosterSrc}
                    alt="Presentation still from a Blueprint sample listing."
                    className="h-full min-h-[26rem] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.65))]" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
                      Public sample listing
                    </p>
                    <h2 className="font-editorial mt-3 text-3xl tracking-[-0.04em] text-white">
                      One exact site. Two buying paths.
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-7 text-white/78">
                      Start with the listing. Move into the package path or the
                      hosted path only after the site itself is legible.
                    </p>
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-[1.75rem] border border-black/10 bg-white/80 p-5 shadow-[0_20px_60px_-46px_rgba(15,23,42,0.35)] backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Product
                    </p>
                    <p className="font-editorial mt-3 text-[2rem] leading-none tracking-[-0.05em] text-slate-950">
                      Site Package
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      License the exact-site product for your own stack.
                    </p>
                  </article>

                  <article className="rounded-[1.75rem] border border-black/10 bg-slate-950 p-5 text-white shadow-[0_20px_60px_-46px_rgba(15,23,42,0.6)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      Product
                    </p>
                    <p className="font-editorial mt-3 text-[2rem] leading-none tracking-[-0.05em]">
                      Hosted Session
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/72">
                      Run the site with Blueprint before moving the package.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white/45 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p className="text-sm font-medium text-slate-800">
              Built for teams that need the real site before deployment.
            </p>
            <div className="flex flex-wrap gap-2">
              {signalPills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <SectionLabel>Sites</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.5rem]">
              Real places. Real capture. Real buying surfaces.
            </h2>
          </div>

          <div className="mobile-snap-row mt-8 md:grid md:grid-cols-3">
            {siteCards.map((card) => (
              <a
                key={card.title}
                href={card.href}
                aria-label={card.title}
                className="group relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#d7d2c8] shadow-[0_24px_70px_-56px_rgba(15,23,42,0.55)]"
              >
                <img
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  className="h-full min-h-[24rem] w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.72))]" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                    {card.eyebrow}
                  </p>
                  <h3 className="font-editorial mt-3 text-[2rem] leading-none tracking-[-0.05em] text-white">
                    {card.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-white/78">
                    {card.detail}
                  </p>
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-white">
                    Explore
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
            <div>
              <SectionLabel>Products</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.4rem]">
                Two ways to work with one exact site.
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {productCards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-[1.85rem] border border-black/10 bg-[#fbf9f5] p-6"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {card.title}
                    </p>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{card.body}</p>
                    <a
                      href={card.href}
                      className="mt-6 inline-flex items-center text-sm font-semibold text-slate-950"
                    >
                      {card.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)]">
              <SectionLabel>What stays attached</SectionLabel>
              <h3 className="font-editorial mt-4 text-3xl tracking-[-0.05em] text-white">
                The site record should stay readable all the way through.
              </h3>
              <div className="mt-6 space-y-3">
                {trustLines.map((line) => (
                  <div
                    key={line}
                    className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/78"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
            <article className="overflow-hidden rounded-[2.2rem] border border-black/10 bg-[#f0ebe2] shadow-[0_30px_80px_-58px_rgba(15,23,42,0.45)]">
              <div className="border-b border-black/10 px-6 py-5 sm:px-7">
                <SectionLabel>Proof</SectionLabel>
                <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.25rem]">
                  See what a team gets before it commits.
                </h2>
              </div>

              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="relative min-h-[24rem] overflow-hidden border-b border-black/10 lg:border-b-0 lg:border-r">
                  <img
                    src={proofReferenceImageSrc}
                    alt="Runtime reference still for the Blueprint public sample site."
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.58))]" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68">
                      Public proof surface
                    </p>
                    <p className="font-editorial mt-3 text-[2rem] leading-none tracking-[-0.05em] text-white">
                      One site, shown before the sales motion starts.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-between p-6 sm:p-7">
                  <div className="space-y-3">
                    {proofTiles.map((tile) => (
                      <article
                        key={tile.title}
                        className="rounded-[1.5rem] border border-black/10 bg-white/75 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">{tile.title}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{tile.body}</p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a
                      href="/sample-deliverables"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      View sample deliverables
                    </a>
                    <a
                      href="/exact-site-hosted-review"
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white/80"
                    >
                      See hosted review
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2.4rem] border border-black/10 bg-slate-950 px-6 py-10 text-white shadow-[0_34px_90px_-60px_rgba(15,23,42,0.82)] sm:px-10 sm:py-12">
              <SectionLabel>Start</SectionLabel>
              <h2 className="font-editorial mt-4 max-w-3xl text-4xl tracking-[-0.05em] text-white sm:text-[3.5rem]">
                Start with the site that matters.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
                Browse a real listing or open a scoped access request.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/world-models"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Explore Sites
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  Request Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
