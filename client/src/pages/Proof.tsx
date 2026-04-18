import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import { getDemandCityMessaging, withDemandCityQuery } from "@/lib/cityDemandMessaging";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

const proofRoutes = [
  {
    title: "How it works",
    body: "Why exact-site grounding beats generic simulation once the deployment question gets specific.",
    href: "/how-it-works",
    cta: "Open how it works",
  },
  {
    title: "Results",
    body: "Concrete examples of how teams used exact-site data for tuning, review, and deployment prep.",
    href: "/case-studies",
    cta: "Review results",
  },
  {
    title: "Deliverables",
    body: "The package contents, export layouts, and hosted outputs tied to one Blueprint listing.",
    href: "/sample-deliverables",
    cta: "See deliverables",
  },
];

const proofSignals = [
  "The public sample listing lets buyers confirm the site before outreach.",
  "Package and hosted paths stay tied to the same source record.",
  "Compatibility, privacy, freshness, and export scope stay visible instead of implied.",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

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

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dce7df] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <SectionLabel>Proof Hub</SectionLabel>
              <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.45rem]">
                See the site before you commit to the path.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                Start with the public sample listing, then inspect how the product works, what the deliverables look like, and how the exact-site path stays grounded in one real facility.
              </p>
            </div>
          </div>
        </section>

        {cityMessaging ? (
          <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
            <article className="rounded-[1.9rem] border border-sky-200 bg-sky-50/85 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                {cityMessaging.label}
              </p>
              <div className="mt-3 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">{cityMessaging.proofHeading}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{cityMessaging.proofBody}</p>
                </div>
                <ul className="space-y-3 text-sm leading-6 text-slate-700">
                  {cityMessaging.proofPoints.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <ProofModule
            eyebrow="Public demo listing"
            title="The first proof is simple: the site is real and the workflow is specific."
            description="Blueprint uses the public sample listing to show the physical site, the task lane, and the buying paths before a team ever fills out the intake form."
            caption="Public walkthrough from the live demo listing."
          />
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Routes</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                Proof routes.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-[1.9rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
                <div className="grid gap-3 sm:grid-cols-3">
                  {proofRoutes.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                      <a
                        href={item.href}
                        className="mt-4 inline-flex items-center text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                      >
                        {item.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Trust signals
                </div>
                <ul className="mt-5 space-y-3">
                  {proofSignals.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/78">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="pb-20 pt-14 sm:pt-18">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:px-8">
            <a
              href={publicDemoHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View sample listing
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="/world-models"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Explore world models
            </a>
            <a
              href={withDemandCityQuery("/contact?persona=robot-team", cityMessaging?.key ?? null)}
              className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              Contact Blueprint
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
