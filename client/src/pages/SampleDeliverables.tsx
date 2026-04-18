import { SEO } from "@/components/SEO";
import { ProofModule } from "@/components/site/ProofModule";
import {
  publicDemoHref,
  proofReferenceImageSrc,
  proofReelPosterSrc,
} from "@/lib/marketingProof";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const sampleManifestRows = [
  ["site_id", "siteworld-f5fd54898cfb"],
  ["capture_date", "2026-03-13"],
  ["proof_depth", "Public listing + sample artifact layouts"],
  ["rights_class", "Internal evaluation and approved exports only"],
  ["exports", "rollout_video, raw_bundle, dataset_export"],
];

const sampleRightsRows = [
  ["usage", "Internal evaluation and approved customer review"],
  ["sharing", "Named review parties only"],
  ["exports", "Listing-approved bundle types only"],
  ["restrictions", "Restricted zones, privacy redactions, and retention limits stay attached"],
];

const packageItems = [
  "Walkthrough media, timestamps, and camera poses tied to one real facility",
  "Intrinsics, depth, and geometry artifacts when source capture supports them",
  "Site notes, provenance, privacy, and rights metadata",
  "A package your team can integrate into its own stack",
];

const hostedItems = [
  "Repeatable runs on the same exact site",
  "Rollout video, failure review, and checkpoint comparison",
  "Dataset, raw bundle, and export generation tied to the listing",
  "A browser-accessible runtime session, no local setup required",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function SampleDeliverables() {
  return (
    <>
      <SEO
        title="Deliverables | Blueprint"
        description="See the sample contracts, exports, and package-vs-hosted deliverables tied to one exact-site Blueprint listing."
        canonical="/sample-deliverables"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dbe8e1] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <SectionLabel>Deliverables</SectionLabel>
              <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.45rem]">
                Sample deliverables from one real site.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                The point is not to describe every possible artifact. The point is to show the buyer what the sample contract, export shape, and package-versus-hosted deliverables look like before the conversation starts.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <ProofModule
            eyebrow="Public proof"
            title="One listing should make the deliverable shape obvious."
            description="The public sample proves the site is real. From there, a buyer should be able to inspect the representative manifest, rights sheet, and hosted-output framing without guessing what comes next."
            caption="Current capture and public product surfaces tied to the sample site."
          />
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Contracts</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                See the sample contract before the call.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
              <article className="rounded-[1.9rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Sample manifest layout</h3>
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  {sampleManifestRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[0.8fr_1.2fr] gap-4 border-t border-slate-200 bg-white px-4 py-3 text-sm first:border-t-0"
                    >
                      <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.9rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Buyer-readable rights sheet</h3>
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  {sampleRightsRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[0.75fr_1.25fr] gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm first:border-t-0"
                    >
                      <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
                <h3 className="text-2xl font-semibold tracking-tight">Sample export bundle</h3>
                <div className="mt-5 space-y-3">
                  {[
                    "Rollout video",
                    "Run summary",
                    "Comparison notes",
                    "Raw bundle references",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-5 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
                  Sample artifact layout
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Paths</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
              Package and hosted paths, side by side.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="overflow-hidden rounded-[1.9rem] border border-black/10 bg-white/88 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
              <img
                src={proofReelPosterSrc}
                alt="Walkthrough reference from the public Blueprint demo"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Site package</h3>
                <ul className="mt-5 space-y-3">
                  {packageItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="overflow-hidden rounded-[1.9rem] border border-black/10 bg-white/88 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
              <img
                src={proofReferenceImageSrc}
                alt="Runtime reference view from the public Blueprint demo"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Hosted evaluation</h3>
                <ul className="mt-5 space-y-3">
                  {hostedItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Sample artifact layout
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:px-8">
            <a
              href="/samples/sample-site-package-manifest.json"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              download
            >
              Download sample manifest
            </a>
            <a
              href="/samples/sample-rights-sheet.md"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              download
            >
              Download sample rights sheet
            </a>
            <a
              href={publicDemoHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View sample listing
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
