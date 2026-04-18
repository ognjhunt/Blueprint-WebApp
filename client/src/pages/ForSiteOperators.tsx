import { SEO } from "@/components/SEO";
import { ArrowRight, CheckCircle2, Shield } from "lucide-react";

const benefits = [
  "Turn your site into a sellable digital asset without losing control of the rules",
  "Set scheduling, privacy, permission, and downstream-usage boundaries up front",
  "Earn on approved world-model sales tied to your facility",
];

const controlCards = [
  {
    title: "Register the facility",
    body: "Tell Blueprint what kind of space it is, what restrictions matter, and whether commercialization is even on the table.",
  },
  {
    title: "Approve capture windows",
    body: "Choose when capture can happen, which zones stay restricted, and what privacy rules must travel with the asset.",
  },
  {
    title: "Approve commercial use",
    body: "Blueprint keeps operator approval, access boundaries, and downstream usage tied to the site instead of treating capture like unbounded raw training material.",
  },
];

const facilityTypes = [
  "Warehouse",
  "Retail store",
  "Grocery store",
  "Office building",
  "Restaurant",
  "Gym or fitness center",
  "Hotel or hospitality",
  "University or campus",
  "Medical clinic",
  "Industrial facility",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Blueprint helps site operators control access, privacy, permissions, and commercialization around site-specific world-model products."
        canonical="/for-site-operators"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dde7df] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-black/10 bg-white/82 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                For Site Operators
              </div>
              <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.4rem]">
                Control how your facility becomes a world-model asset.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                Register the site, define the rules around access and privacy, and decide whether Blueprint can commercialize approved capture from your facility under terms you can actually read.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Operator Value</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
              What operators get.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {benefits.map((item, index) => (
              <article
                key={item}
                className={
                  index === 1
                    ? "rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]"
                    : "rounded-[1.85rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]"
                }
              >
                <p className={index === 1 ? "text-sm leading-7 text-white/78" : "text-sm leading-7 text-slate-700"}>
                  {item}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Controls</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                How it works and what you control.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="grid gap-4">
                {controlCards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-[1.85rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]"
                  >
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
                  </article>
                ))}
              </div>

              <article className="rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/10 p-3 text-white">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                      Operator standard
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/76">
                      Revenue share, privacy, and permissions stay under your rules. Blueprint should never make the operator guess what is allowed, when capture happens, or who can use the resulting asset.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Eligibility</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
              What kinds of spaces fit.
            </h2>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {facilityTypes.map((type) => (
              <span
                key={type}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                {type}
              </span>
            ))}
            <span className="rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-500">
              + other indoor facilities
            </span>
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:px-8">
            <a
              href="/contact?persona=site-operator"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              List your site
            </a>
            <a
              href="/governance"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Review rights and privacy
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
