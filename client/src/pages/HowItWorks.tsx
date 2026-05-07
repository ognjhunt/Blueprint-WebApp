import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import {
  publicDemoHref,
} from "@/lib/marketingProof";
import { ArrowRight } from "lucide-react";

const chapterCards = [
  {
    id: "01",
    title: "Capture",
    body: "We capture the facility as it is, at site scale.",
    proof: "12,842 frames · 278 scan positions · 3.2 cm RMS",
  },
  {
    id: "02",
    title: "Package",
    body: "We organize the capture into a site-specific package.",
    proof: "Manifest locked · versioned metadata · explicit rights sheet",
  },
  {
    id: "03",
    title: "Run",
    body: "Your robot runs against a site-specific world model.",
    proof: "Routes validated · decisions replayable · coverage visible",
  },
  {
    id: "04",
    title: "Deliver",
    body: "You get a versioned world model and the files needed to use it.",
    proof: "Export complete · review bundle · run-ready package",
  },
];

function ChapterLabel({
  id,
  title,
  body,
  proof,
}: {
  id: string;
  title: string;
  body: string;
  proof: string;
}) {
  return (
    <div className="border-r border-black/10 bg-[#f3f1ec] px-6 py-8 lg:px-8 lg:py-10">
      <p className="text-[3rem] leading-none tracking-[-0.05em] text-slate-300">{id}</p>
      <h2 className="font-editorial mt-4 text-[3.4rem] leading-[0.92] tracking-[-0.05em] text-slate-950">
        {title}
      </h2>
      <p className="mt-6 max-w-[15rem] text-base leading-7 text-slate-700">{body}</p>
      <div className="mt-10 border-t border-black/10 pt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Sample values
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{proof}</p>
      </div>
    </div>
  );
}

function PackagePanel() {
  return (
    <div className="grid h-full place-items-center bg-[#f8f6f2] p-6 lg:p-10">
      <div className="grid max-w-[42rem] gap-4 md:grid-cols-[0.6fr_0.4fr]">
        <div className="rotate-[-3deg] rounded-[1.8rem] border border-black/10 bg-white p-6 shadow-[0_26px_50px_-36px_rgba(15,23,42,0.22)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Sample manifest
          </p>
          <h3 className="mt-5 text-2xl font-semibold text-slate-950">Plant 7</h3>
          <div className="mt-6 grid gap-y-3 text-sm text-slate-700">
            <div className="flex justify-between border-b border-black/5 pb-3">
              <span>Capture date</span>
              <span>04 / 18 / 2025</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-3">
              <span>Package ID</span>
              <span>BP7-250418-01</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-3">
              <span>Images</span>
              <span>12,842</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-3">
              <span>LiDAR scans</span>
              <span>278</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-3">
              <span>Annotations</span>
              <span>236</span>
            </div>
            <div className="flex justify-between">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[1.8rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_24px_44px_-34px_rgba(15,23,42,0.5)]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Package</p>
            <p className="mt-4 text-2xl font-semibold">Blueprint package</p>
            <p className="mt-5 text-sm leading-7 text-white/70">
              Versioned geometry, routes, metadata, rights, and exports tied to one exact site.
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-black/10 bg-white p-6 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.16)]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Rights sheet</p>
            <p className="mt-4 text-lg font-semibold text-slate-950">Use scope attached</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Example scope only. Real rights and export sharing remain listing- and request-scoped.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliverPanel() {
  return (
    <div className="grid h-full place-items-center bg-[#f5f3ef] p-6 lg:p-10">
      <div className="grid max-w-[44rem] gap-6 md:grid-cols-[0.58fr_0.42fr]">
        <div className="space-y-3">
          {[
            "World model (optimized)",
            "Navigation graph",
            "Asset bundle",
            "Metadata & maps",
            "SDK & integration",
            "Documentation",
          ].map((item, index) => (
            <div
              key={item}
              className="rounded-[1.1rem] border border-white/10 bg-slate-950 px-5 py-4 text-sm font-medium text-white shadow-[0_18px_34px_-28px_rgba(15,23,42,0.55)]"
              style={{ marginLeft: `${index * 8}px` }}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-[1.7rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_24px_42px_-32px_rgba(15,23,42,0.52)]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">World model card</p>
            <p className="mt-5 text-[1.75rem] font-semibold leading-tight">Plant 7 world model</p>
            <p className="mt-3 text-sm text-white/55">BP7-250418-01 · v1.0.0</p>
          </div>
          <div className="rounded-[1.3rem] border border-black/10 bg-white px-5 py-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.18)]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Export bundle</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              MP4 sessions, JSON maps, ZIP observations, logs, and package metadata ready to review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="See how Blueprint moves from real capture to site package, run-ready world model, and delivery files."
        canonical="/how-it-works"
      />

      <div className="bg-[#f3f1ec] text-slate-950">
        <section className="border-b border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.06),_transparent_28%),linear-gradient(180deg,#f7f5f1_0%,#efede7_100%)]">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-8 lg:grid-cols-[0.37fr_0.63fr]">
              <div className="pt-16 lg:pt-24">
                <EditorialSectionLabel>How It Works</EditorialSectionLabel>
                <h1 className="font-editorial mt-8 text-[3.8rem] leading-[0.9] tracking-[-0.06em] sm:text-[5.2rem]">
                  Capture to world model.
                </h1>
                <p className="mt-6 max-w-[18rem] text-sm uppercase tracking-[0.2em] text-slate-500">
                  Real places. Real routes. Site-specific world models that robots can run.
                </p>
                <p className="mt-5 max-w-[19rem] text-xs leading-6 text-slate-500">
                  Metrics shown on this page are sample values unless a listing marks them as
                  approved real-site proof.
                </p>
              </div>

              <div className="relative min-h-[34rem]">
                <div className="absolute right-[4%] top-0 z-20 rotate-[1deg] rounded-[0.2rem] bg-white px-5 py-4 shadow-[0_16px_30px_-20px_rgba(15,23,42,0.24)]">
                  <p className="font-editorial text-[1.1rem] italic">Sample site: Plant 7</p>
                  <p className="mt-2 text-sm text-slate-700">Sample date: 04 / 18</p>
                  <p className="text-sm text-slate-700">Sample capture: 2 of 3</p>
                </div>
                <div className="absolute left-[22%] right-[8%] top-[2.5rem] rounded-[1.3rem] border border-black/10 bg-white p-3 shadow-[0_24px_44px_-26px_rgba(15,23,42,0.2)]">
                  <div className="grid gap-3 md:grid-cols-3">
                    {["/generated/editorial/world-models-hero.png", "/generated/editorial/proof-board.png", "/generated/editorial/cross-dock.png"].map((src) => (
                      <MonochromeMedia
                        key={src}
                        src={src}
                        alt="Capture frame"
                        className="aspect-[4/3] border border-black/10"
                        overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.2))]"
                      />
                    ))}
                  </div>
                </div>
                <div className="absolute left-4 right-4 top-[11rem] z-10 rotate-[-2deg] overflow-hidden rounded-[1.4rem] border border-black/10 bg-slate-950 p-4 shadow-[0_28px_50px_-28px_rgba(15,23,42,0.4)] sm:left-[18%] sm:right-auto">
                  <svg viewBox="0 0 380 220" className="h-[11.5rem] w-full max-w-[18rem] sm:h-[13rem] sm:w-[18rem]">
                    <rect x="18" y="18" width="344" height="184" rx="22" fill="rgba(255,255,255,0.03)" />
                    <path d="M28 44H352" stroke="rgba(255,255,255,0.12)" strokeDasharray="6 8" />
                    <path d="M52 176C112 176 118 74 182 74C228 74 230 138 298 138C322 138 334 108 342 108" fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="5" strokeLinecap="round" />
                    {[52, 182, 298, 342].map((cx, index) => (
                      <circle key={cx} cx={cx} cy={[176, 74, 138, 108][index]} r="7" fill="white" />
                    ))}
                  </svg>
                </div>
                <div className="absolute bottom-0 left-[10%] right-0 grid gap-3 rounded-[1.4rem] border border-black/10 bg-white/90 p-3 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.16)] md:grid-cols-5">
                  {["/generated/editorial/world-models-hero.png", "/generated/editorial/proof-board.png", "/generated/editorial/cross-dock.png", "/generated/editorial/hosted-hero.png", "/generated/editorial/grocery-fulfillment.png"].map((src, index) => (
                    <MonochromeMedia
                      key={`${src}-${index}`}
                      src={src}
                      alt="Timeline frame"
                      className="aspect-[16/10] border border-black/10"
                      overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.14))]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] border-x border-black/10">
          <div className="grid min-h-[32rem] lg:grid-cols-[0.32fr_0.68fr]">
            <ChapterLabel {...chapterCards[0]} />
            <div className="relative border-t border-black/10 lg:border-t-0">
              <MonochromeMedia
                src="/generated/editorial/hosted-hero.png"
                alt="Capture proof"
                className="h-full rounded-none"
                imageClassName="h-full"
                overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.14),rgba(0,0,0,0.42))]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_52%)]" />
                <div className="absolute inset-y-0 left-[8%] w-px bg-white/25" />
                <div className="absolute inset-y-0 left-[18%] w-px bg-white/20" />
                <div className="absolute inset-y-0 right-[18%] w-px bg-white/20" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_40%,rgba(255,255,255,0.18)_0_2px,transparent_2px_100%)] bg-[size:14px_14px] opacity-40" />
                <div className="absolute bottom-6 right-6 w-[10rem] rounded-[1.1rem] border border-white/15 bg-black/40 p-3 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Scan path</p>
                  <div className="mt-3 rounded-[0.9rem] border border-white/10 bg-black/50 p-2">
                    <svg viewBox="0 0 140 110" className="h-20 w-full">
                      <path d="M10 90C26 90 22 26 50 26C76 26 78 82 114 82C124 82 130 56 132 56" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </MonochromeMedia>
            </div>
          </div>

          <div className="grid min-h-[26rem] border-t border-black/10 lg:grid-cols-[0.32fr_0.68fr]">
            <ChapterLabel {...chapterCards[1]} />
            <div className="border-t border-black/10 lg:border-t-0">
              <PackagePanel />
            </div>
          </div>

          <div className="grid min-h-[28rem] border-t border-black/10 lg:grid-cols-[0.32fr_0.68fr]">
            <ChapterLabel {...chapterCards[2]} />
            <div className="relative border-t border-black/10 bg-slate-950 lg:border-t-0">
              <MonochromeMedia
                src="/generated/editorial/manufacturing-plant.png"
                alt="Run overlay"
                className="h-full rounded-none"
                imageClassName="h-full"
                overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.62))]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16)_0_1px,transparent_1px_100%)] bg-[size:12px_12px] opacity-40" />
                <RouteTraceOverlay className="opacity-90" />
                <div className="absolute bottom-6 right-6 w-[13rem] rounded-[1.2rem] border border-white/10 bg-black/40 p-4 text-white shadow-[0_18px_36px_-24px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">World model preview</p>
                  <p className="mt-4 text-sm leading-6 text-white/70">
                    Route overlays, robot pose, and site geometry remain tied to the same package truth.
                  </p>
                </div>
              </MonochromeMedia>
            </div>
          </div>

          <div className="grid min-h-[26rem] border-t border-black/10 lg:grid-cols-[0.32fr_0.68fr]">
            <ChapterLabel {...chapterCards[3]} />
            <div className="border-t border-black/10 lg:border-t-0">
              <DeliverPanel />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-20">
          <div className="grid gap-6 overflow-hidden rounded-[2rem] border border-black/10 bg-slate-950 px-6 py-8 text-white lg:grid-cols-[0.5fr_0.5fr] lg:px-8">
            <MonochromeMedia
              src="/generated/editorial/cross-dock.png"
              alt="Call to action background"
              className="min-h-[14rem] border border-white/10"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.52))]"
            />
            <div className="flex flex-col justify-center">
              <ProofChip light>Real site. Real route. Real package.</ProofChip>
              <h2 className="font-editorial mt-5 text-[3rem] leading-[0.95] tracking-[-0.05em]">
                See the exact site before you start the sales motion.
              </h2>
              <p className="mt-4 max-w-[28rem] text-sm leading-7 text-white/70">
                The public sample listing shows how capture, package framing, and hosted review stay attached to one facility.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={publicDemoHref}
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Inspect a real site
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/proof"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  View sample deliverables
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
