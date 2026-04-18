import { SEO } from "@/components/SEO";
import { publicDemoHref } from "@/lib/marketingProof";
import { ArrowRight, ShieldCheck } from "lucide-react";

const heroSignals = [
  "Rights stay explicit",
  "Hosted access stays bounded",
  "No trust claims beyond the listing",
];

const readableCards = [
  {
    title: "Provenance and freshness",
    body:
      "A buyer should be able to see the facility identifier, capture date, freshness state, approval path, and proof depth before deciding whether the site is current enough for review.",
  },
  {
    title: "Rights and restrictions",
    body:
      "Rights class, export entitlements, restricted zones, and sharing limits should stay attached to the listing and manifest instead of being inferred from marketing copy.",
  },
  {
    title: "Hosted-access boundary",
    body:
      "Hosted sessions should make it clear what is launchable, what remains human-gated, and which outputs are sample layouts versus confirmed buyer-facing exports.",
  },
  {
    title: "Redaction and retention",
    body:
      "A buyer should be able to tell whether privacy processing ran, whether raw media is retained, and what downstream material remains visible or exportable.",
  },
];

const publishedToday = [
  "Proof depth, freshness, and commercial-status disclosure on listing surfaces",
  "Readable sample manifest, export bundle, and rights-sheet layouts for buyer inspection",
  "Hosted-access language that separates public proof from illustrative UI",
  "Privacy, retention, redaction, and restriction framing in the buyer path",
];

const notClaimed = [
  "Blanket site approval unless the listing says so explicitly",
  "Unrestricted commercialization or export rights by default",
  "Deployment guarantees, safety certification, or customer outcome claims",
  "Any certification or compliance posture Blueprint has not published explicitly",
];

const controlCards = [
  {
    title: "Public listing is still bounded",
    body:
      "A public listing means Blueprint is willing to show the site, the proof shape, and the trust labels publicly. It does not erase request-scoped rights, privacy, export, or buyer-specific review.",
  },
  {
    title: "Hosted access is authenticated and entitlement-controlled",
    body:
      "Hosted sessions are not public browse surfaces. Access follows account checks, listing-level entitlements, and explicit statements about what remains view-only versus exportable.",
  },
  {
    title: "Exceptions stay human-gated",
    body:
      "Irreversible rights exceptions, unusual access requests, and privacy-sensitive boundary changes should be reviewed and recorded instead of implied by default.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's buyer-readable trust page for rights, privacy, provenance, restrictions, and hosted-access boundaries."
        canonical="/governance"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.11),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dee6dd] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.96fr_1.04fr] lg:items-end">
              <div className="max-w-3xl">
                <SectionLabel>Governance</SectionLabel>
                <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.5rem]">
                  Trust should be readable before purchase.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                  Blueprint makes rights, privacy, provenance, restrictions, and hosted-access boundaries part of the buyer surface instead of hiding them behind sales copy.
                </p>
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
          <div className="max-w-2xl">
            <SectionLabel>Readable Trust</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.25rem]">
              What a buyer should be able to read.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {readableCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[1.85rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]"
              >
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Truth Boundary</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                What Blueprint shows and what it does not claim.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <article className="rounded-[1.9rem] border border-black/10 bg-[#fbf9f5] p-6">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Published today</h3>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                  {publishedToday.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
                <h3 className="text-2xl font-semibold tracking-tight">Not claimed</h3>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-white/78">
                  {notClaimed.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/45" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm leading-7 text-white/72">
                  No certification or compliance claim is implied unless Blueprint publishes it explicitly.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="pb-20 pt-14 sm:pt-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <SectionLabel>Controls</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                How the boundary stays controlled.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
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

            <div className="mt-6 overflow-hidden rounded-[2.15rem] border border-black/10 bg-slate-950 px-6 py-8 text-white shadow-[0_26px_70px_-48px_rgba(15,23,42,0.85)] sm:px-8">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Next Step
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/72">
                    Inspect the sample listing if you want to see how these boundaries show up in a public product surface, or contact Blueprint when your review needs request-scoped rights, privacy, or export clarification.
                  </p>
                </div>
                <div className="grid gap-3">
                  <a
                    href={publicDemoHref}
                    className="inline-flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Inspect sample listing
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <ShieldCheck className="h-4 w-4 text-white/72" />
                    Contact for scoped review
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
