import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { exactSiteScopingCallPath } from "@/lib/booking";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, ShieldCheck } from "lucide-react";

const heroSignals = [
  "Site package",
  "Hosted session-hour",
  "Custom scope only when needed",
];

const choiceCards = [
  {
    title: "Package first",
    body:
      "Choose this when your team wants the site data contract and plans to run its own stack on that facility.",
  },
  {
    title: "Hosted first",
    body:
      "Choose this when your team wants runtime evidence, reruns, and exports before moving files into its own environment.",
  },
  {
    title: "Custom first",
    body:
      "Choose this when the site is private, rights are unusual, or higher-touch managed support changes the work from the start.",
  },
];

const scopeCards = [
  {
    title: "What changes scope",
    body:
      "Private-site work, unusual trust review, exclusive rights, and higher-touch managed support are quoted separately when they materially change the job.",
  },
  {
    title: "Typical first reply",
    body:
      "Public-listing and hosted-review pricing questions usually get a first reply within 1 business day. Request-scoped rights, privacy, export, or commercial review usually gets a first scoped answer within 2 business days.",
  },
  {
    title: "What pricing does not claim",
    body:
      "Public price visibility does not imply unrestricted export rights, blanket site approval, or a deployment guarantee. Exact-site proof and adjacent-site proof still need to stay clearly labeled.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Public pricing for Blueprint's exact-site buying paths: site packages, hosted session-hours, and custom scope when a real facility needs a private program."
        canonical="/pricing"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_38%),radial-gradient(circle_at_84%_12%,_rgba(14,116,144,0.12),_transparent_22%),linear-gradient(180deg,_rgba(255,255,255,0.76),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-6rem] top-24 h-56 w-56 rounded-full bg-[#dde6df] blur-3xl" />
          <div className="absolute right-[-8rem] top-10 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
              <div className="max-w-3xl">
                <SectionLabel>Pricing</SectionLabel>
                <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.5rem]">
                  Public pricing for the exact-site paths that matter first.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                  Most teams start with one of three moves: buy the site package, run the hosted path, or scope a custom program around one real facility.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href={publicDemoHref}
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Inspect sample site
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href={exactSiteScopingCallPath}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/85 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                  >
                    Book scoping call
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroSignals.map((item) => (
                  <article
                    key={item}
                    className="rounded-[1.65rem] border border-black/10 bg-white/82 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)]"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <OfferComparison className="" />
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>How To Choose</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.3rem]">
                How to choose the first move.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {choiceCards.map((card, index) => (
                <article
                  key={card.title}
                  className={
                    index === 1
                      ? "rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]"
                      : "rounded-[1.85rem] border border-black/10 bg-[#fbf9f5] p-6"
                  }
                >
                  <p
                    className={
                      index === 1
                        ? "text-xs font-semibold uppercase tracking-[0.18em] text-white/52"
                        : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                    }
                  >
                    Option {index + 1}
                  </p>
                  <h3
                    className={
                      index === 1
                        ? "mt-4 text-2xl font-semibold tracking-tight text-white"
                        : "mt-4 text-2xl font-semibold tracking-tight text-slate-900"
                    }
                  >
                    {card.title}
                  </h3>
                  <p
                    className={
                      index === 1
                        ? "mt-4 text-sm leading-7 text-white/78"
                        : "mt-4 text-sm leading-7 text-slate-600"
                    }
                  >
                    {card.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Scope And Trust</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
              What changes scope.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {scopeCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[1.85rem] border border-black/10 bg-white/85 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.3)]"
              >
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2.25rem] border border-black/10 bg-slate-950 px-6 py-10 text-white shadow-[0_30px_80px_-52px_rgba(15,23,42,0.85)] sm:px-8 lg:px-10 lg:py-12">
              <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
                <div className="max-w-2xl">
                  <SectionLabel>Custom Scope</SectionLabel>
                  <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-white sm:text-[3.1rem]">
                    Need a site that is not in the public catalog yet?
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    Use the custom path when one specific facility matters more than the current public inventory, or when the rights, privacy, or support model needs to be negotiated up front.
                  </p>
                </div>

                <div className="grid gap-3">
                  <a
                    href={exactSiteScopingCallPath}
                    className="inline-flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Book scoping call
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team&interest=enterprise"
                    className="inline-flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Request custom quote
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-transparent px-5 py-4 text-sm font-semibold text-white/88 transition hover:bg-white/8"
                  >
                    <ShieldCheck className="h-4 w-4 text-white/70" />
                    Email a short brief
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
