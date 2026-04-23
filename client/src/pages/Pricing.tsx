import type { ReactNode } from "react";

import { SEO } from "@/components/SEO";
import {
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { exactSiteScopingCallUrl } from "@/lib/booking";
import { publicDemoHref } from "@/lib/marketingProof";
import {
  ArrowRight,
  Boxes,
  CirclePlay,
  Map,
  ScanEye,
  ShieldCheck,
} from "lucide-react";

const packageBullets = [
  "Capture manifest, site notes, and provenance",
  "Geometry/depth assets when the package supports them",
  "Route graph and workflow lanes for the selected site",
  "Rights sheet, freshness state, and export limits",
  "Offline export bundle for your stack",
];

const hostedBullets = [
  "Hosted exact-site environment",
  "Scoped route replay and scenario variation",
  "Observation frames from the hosted review surface",
  "Sharable session notes and result exports",
  "Run evidence with truthful limits called out",
];

const enterpriseBullets = [
  "Custom capture and private onboarding",
  "Multi-site rollout planning",
  "Role-based access and audit logs",
  "Detection and recapture workflows",
  "SLA, support, and success planning",
];

const comparisonArtifacts = [
  { label: "Capture record", detail: "Where evidence came from", icon: Boxes },
  { label: "Route graph", detail: "Site-specific paths", icon: Map },
  { label: "Rights sheet", detail: "Use and export limits", icon: ShieldCheck },
  { label: "Hosted review", detail: "Scoped reruns", icon: CirclePlay },
  { label: "Observation frames", detail: "Review what the run saw", icon: ScanEye },
  { label: "Change state", detail: "Freshness and recapture notes", icon: ShieldCheck },
];

const pricingExamples = [
  {
    title: "First exact-site evaluation",
    price: "$2,150-$3,500 typical",
    body: "One public or commercial site package plus three hosted review hours. Useful when the team needs one concrete site decision before travel, pilot planning, or integration work.",
    items: ["Site package", "3 hosted hours", "Manifest, rights sheet, hosted report"],
  },
  {
    title: "Hosted-only fit check",
    price: "$160-$435 typical",
    body: "Five to fifteen hosted review hours on a request-scoped site. Useful when the team wants reruns and evidence before moving a full package into its own stack.",
    items: ["Hosted setup", "Run notes", "Evidence export"],
  },
  {
    title: "Bring your site",
    price: "Scoped",
    body: "A grocery, retail, service, campus, or private facility can enter the capture path when lawful access, privacy handling, and buyer usefulness are clear enough to review.",
    items: ["Capture scope", "Privacy review", "Package or hosted path"],
  },
];

const scopeFactors = [
  "Site size and capture depth",
  "Private-site access or custom rights review",
  "Export format and integration requirements",
  "Recapture, change detection, or multi-site rollout",
];

function PricePanel({
  index,
  eyebrow,
  title,
  price,
  body,
  bullets,
  image,
  imageAlt,
  dark = false,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  price: string;
  body: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  dark?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={`grid overflow-hidden rounded-[2rem] border border-black/10 ${dark ? "bg-slate-950" : "bg-white"} lg:grid-cols-[0.34fr_0.66fr]`}>
      <div className={`px-6 py-7 lg:px-8 lg:py-9 ${dark ? "text-white" : "text-slate-950"}`}>
        <p className={`text-sm ${dark ? "text-white/48" : "text-slate-400"}`}>{index}</p>
        <h2 className="font-editorial mt-4 text-[3.2rem] leading-[0.95] tracking-[-0.05em]">
          {title}
        </h2>
        <p className={`mt-3 text-[11px] uppercase tracking-[0.2em] ${dark ? "text-white/48" : "text-slate-500"}`}>
          {eyebrow}
        </p>
        <p className={`mt-5 text-base leading-7 ${dark ? "text-white/74" : "text-slate-700"}`}>
          {body}
        </p>
        <p className={`mt-6 text-lg font-semibold ${dark ? "text-white" : "text-slate-950"}`}>{price}</p>
        <ul className={`mt-6 space-y-3 text-sm leading-6 ${dark ? "text-white/68" : "text-slate-600"}`}>
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <span className={`mt-2 h-1.5 w-1.5 rounded-full ${dark ? "bg-white/46" : "bg-slate-400"}`} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative min-h-[25rem] border-t border-black/10 lg:border-l lg:border-t-0">
        <MonochromeMedia
          src={image}
          alt={imageAlt}
          className="h-full rounded-none"
          imageClassName="h-full"
          overlayClassName={dark ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.48))]" : "bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.36))]"}
        >
          {children}
        </MonochromeMedia>
      </div>
    </section>
  );
}

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Choose the right path into one exact-site world model: site package, hosted evaluation, or enterprise scope."
        canonical="/pricing"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src="/generated/editorial/pricing-hero.png"
            alt="Pricing hero"
            className="min-h-[35rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[35rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.34)_30%,rgba(255,255,255,0.04)_72%)]"
          >
            <div className="absolute inset-0 mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
              <div className="max-w-[34rem]">
                <EditorialSectionLabel>Pricing</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-slate-950 sm:text-[5.1rem]">
                  Choose the right path.
                </h1>
                <p className="mt-6 text-lg leading-8 text-slate-700">
                  Exact-site world models for real locations, from everyday public-facing places to private deployment sites.
                </p>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] space-y-4 px-5 py-10 sm:px-8 lg:px-10">
          <PricePanel
            index="01"
            eyebrow="Own your exact-site world model."
            title="Site Package"
            price="$2,100 – $3,400"
            body="License one captured site package with the manifest, routes, rights notes, and exports your team needs to evaluate the exact place."
            bullets={packageBullets}
            image="/generated/editorial/pricing-hero.png"
            imageAlt="Site package illustration"
            dark
          >
            <div className="absolute inset-y-0 right-0 flex w-full items-end justify-center p-6 lg:justify-end lg:p-8">
              <div className="grid w-full max-w-[32rem] gap-4 md:grid-cols-[0.52fr_0.48fr]">
                <div className="rounded-[1.6rem] border border-white/10 bg-black/56 p-5 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Blueprint site package</p>
                  <p className="mt-5 text-2xl font-semibold">Market Hall Grocery</p>
                  <p className="mt-3 text-sm text-white/62">Sample capture date · Mar 13, 2026</p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/90 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Manifest</p>
                    <p className="mt-2 text-sm text-slate-700">Routes, site notes, rights, freshness, and provenance attached.</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/90 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Coverage map</p>
                    <p className="mt-2 text-sm text-slate-700">Exact-site path coverage and export boundaries visible.</p>
                  </div>
                </div>
              </div>
            </div>
          </PricePanel>

          <PricePanel
            index="02"
            eyebrow="Test on your site. Remotely."
            title="Hosted Evaluation"
            price="$16 – $29 / session-hour"
            body="Blueprint hosts the exact-site world model so your team can review configured routes, reruns, observations, and outputs before moving deeper."
            bullets={hostedBullets}
            image="/generated/editorial/hosted-hero.png"
            imageAlt="Hosted evaluation panel"
          >
            <div className="absolute inset-0 flex items-center justify-center p-6 lg:justify-end lg:p-8">
              <div className="w-full max-w-[34rem] overflow-hidden rounded-[1.8rem] border border-white/14 bg-black/72 text-white shadow-[0_24px_60px_-36px_rgba(0,0,0,0.62)]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/48">
                  <span>Session playback</span>
                  <span>Illustrative hosted surface</span>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-[0.64fr_0.36fr]">
                  <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/36">
                    <div className="absolute hidden" />
                    <svg viewBox="0 0 360 220" className="h-[13rem] w-full">
                      <path d="M26 186V42H112V84H204V28H328V178H232V138H138V186Z" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                      <path d="M56 164C92 164 96 112 142 112C190 112 196 70 244 70C288 70 298 140 324 140" fill="none" stroke="rgba(255,255,255,0.86)" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="space-y-3">
                    {["/generated/editorial/world-models-hero.png", "/generated/editorial/grocery-fulfillment.png"].map((src, index) => (
                      <MonochromeMedia
                        key={`${src}-${index}`}
                        src={src}
                        alt="Observation view"
                        className="aspect-[16/10] border border-white/10"
                        overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.16))]"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </PricePanel>

          <PricePanel
            index="03"
            eyebrow="Private sites, multiple markets, or deeper ops."
            title="Enterprise"
            price="$50,000+ scoped"
            body="Use this path when the site is private, the rights model is custom, or your team needs Blueprint-managed rollout support across multiple locations."
            bullets={enterpriseBullets}
            image="/generated/editorial/manufacturing-plant.png"
            imageAlt="Enterprise operations view"
            dark
          >
            <div className="absolute inset-0 flex items-center justify-center p-6 lg:justify-end lg:p-8">
              <div className="w-full max-w-[34rem] overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/70 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.62)]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/46">
                  <span>Enterprise overview</span>
                  <span>Illustrative ops surface</span>
                </div>
                <div className="grid gap-px bg-white/8 md:grid-cols-[0.62fr_0.38fr]">
                  <div className="bg-black/36 px-5 py-4 text-sm text-white/72">
                    {[
                      ["Rivergate DC 01", "Live"],
                      ["Northfield Fulfillment", "Live"],
                      ["Lakeside Manufacturing", "Review"],
                      ["Southpoint DC", "Updating"],
                    ].map(([name, state]) => (
                      <div key={name} className="flex items-center justify-between border-b border-white/8 py-3 last:border-b-0">
                        <span>{name}</span>
                        <span className="text-white/46">{state}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-black/28 px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Rollout map</p>
                    <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/36 p-4">
                      <svg viewBox="0 0 210 120" className="h-28 w-full">
                        <path d="M16 90L44 28L72 38L84 20L128 28L166 42L194 76L176 98L138 90L116 102L68 96L44 112Z" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="2.5" />
                        {[44, 92, 136, 168].map((cx, index) => (
                          <circle key={cx} cx={cx} cy={[64, 82, 52, 72][index]} r="4.5" fill="white" />
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PricePanel>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-8 sm:px-8 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-[0.42fr_0.58fr]">
            <div className="border border-black/10 bg-white p-6 lg:p-8">
              <EditorialSectionIntro
                eyebrow="Example scopes"
                title="What the first bill usually means."
                description="Pricing changes when the place is larger, the rights path is custom, or the export contract needs deeper integration work."
              />
              <div className="mt-6 border-t border-black/10 pt-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Scope changes with</p>
                <div className="mt-4 grid gap-2">
                  {scopeFactors.map((item) => (
                    <div key={item} className="border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {pricingExamples.map((example) => (
                <article key={example.title} className="border border-black/10 bg-white p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{example.price}</p>
                  <h2 className="mt-4 text-[1.55rem] leading-[1.02] tracking-[-0.04em] text-slate-950">
                    {example.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{example.body}</p>
                  <div className="mt-5 grid gap-2">
                    {example.items.map((item) => (
                      <span key={item} className="border border-black/10 bg-[#f8f6f1] px-3 py-2 text-sm text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-16 sm:px-8 lg:px-10 lg:pb-20">
          <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
            <div className="border-b border-black/10 px-6 py-5">
              <EditorialSectionIntro
                eyebrow="What you get"
                title="A simpler visual comparison."
                description="Compare the first artifact a buyer sees on each commercial path instead of reading through a dense pricing table."
                className="max-w-3xl"
              />
            </div>
            <div className="grid gap-px bg-black/8 md:grid-cols-3 xl:grid-cols-6">
              {comparisonArtifacts.map((artifact) => {
                const Icon = artifact.icon;
                return (
                  <div key={artifact.label} className="bg-white px-5 py-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-sm font-semibold text-slate-950">{artifact.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{artifact.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <a
              href={publicDemoHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Inspect a real site
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href={exactSiteScopingCallUrl}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
            >
              Book scoping call
            </a>
            <a
              href="/contact?persona=robot-team&interest=enterprise"
              className="inline-flex items-center justify-center rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Request custom quote
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
