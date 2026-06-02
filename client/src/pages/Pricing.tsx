import type { ReactNode } from "react";

import { SEO } from "@/components/SEO";
import {
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { publicDemoHref } from "@/lib/marketingProof";
import {
  ArrowRight,
  Boxes,
  ClipboardCheck,
  CirclePlay,
  Map,
  ScanEye,
  ShieldCheck,
} from "lucide-react";

const packageBullets = [
  "Site/task scope, robot profile, and readiness question",
  "Success-rate, cycle-time, intervention-rate, and safety thresholds",
  "Capture manifest, route evidence, site notes, and provenance",
  "Failure modes, site modifications, data needs, and short-pilot protocol",
  "Explicit blockers where simulator, action-log, robot-trial, or safety proof is missing",
];

const hostedBullets = [
  "Managed browser review when the site and entitlement path are confirmed",
  "Scoped route replay, scenario variation, and readiness observations",
  "Sharable notes tied to the same site/task readiness report",
  "Vendor or robot-team comparison when multiple options are in scope",
  "Run evidence with package, hosted, and export limits called out",
];

const enterpriseBullets = [
  "Custom capture and private onboarding",
  "Multi-site rollout planning",
  "Role-based access and audit logs",
  "Benchmark design across facilities, vendors, or robot releases",
  "SLA, support, and success planning after request review",
];

const comparisonArtifacts = [
  { label: "Readiness report", detail: "The site/task advisory starts here.", icon: ClipboardCheck },
  { label: "Package manifest", detail: "Capture-backed files keep the advisory grounded.", icon: Boxes },
  { label: "Rights sheet", detail: "Use, sharing, and export limits stay attached.", icon: ShieldCheck },
  { label: "Hosted review", detail: "The managed session path starts in the browser.", icon: CirclePlay },
  { label: "Threshold record", detail: "Success, cycle, intervention, and safety bars stay visible.", icon: ScanEye },
  { label: "Pilot protocol", detail: "Next field work stays bounded to the evidence.", icon: Map },
];

const accessModels = [
  {
    title: "Readiness review first",
    price: "$2,100-$3,400",
    body: "Use this when your team wants a pre-pilot advisory for one exact site/task before committing field time.",
    items: ["Threshold scope", "Failure modes", "Pilot protocol"],
  },
  {
    title: "Hosted review first",
    price: "$16-$29 / session-hour",
    body: "Use this when your team wants Blueprint to run a managed buyer room before deeper package work or pilot protocol.",
    items: ["Browser session", "Reruns and notes", "Readiness limits"],
  },
  {
    title: "Multi-site benchmark first",
    price: "Scoped",
    body: "Use this when sites, vendors, or robot releases need a private benchmark design across multiple workflows.",
    items: ["Capture plan", "Vendor comparison", "Commercial terms"],
  },
];

const scopeFactors = [
  "Site size, task count, and capture depth",
  "Private-site access or custom rights review",
  "Robot profile, threshold, and evidence requirements",
  "Recapture, change detection, vendor comparison, or multi-site rollout",
];

const trustNotes = [
  {
    title: "Readiness report",
    body: "A readiness report is advisory and request-scoped. It does not claim a robot is ready to deploy unless owner-system proof supports that stronger verdict.",
  },
  {
    title: "Hosted evaluation",
    body: "A hosted evaluation gives your team managed session access, run evidence, and next-step notes. It is not a package license by itself.",
  },
  {
    title: "Planning ranges",
    body: "Public ranges help buyers choose a path. Live availability, rights, payment, and fulfillment are confirmed per site/request.",
  },
];

const pricingPathRows = [
  {
    path: "Site/Task Readiness Review",
    bestFor: "Robot teams or site operators deciding whether one exact task deserves pilot time.",
    startsWith: "One site, robot task, robot profile, and required success/cycle/intervention/safety threshold.",
    receivesFirst: "Readiness advisory, failure modes, site modifications, data needs, short-pilot protocol, and package scope.",
    gatedBy: "Capture/provenance depth, rights/privacy review, freshness, threshold scope, and missing simulator/action/robot/safety proof.",
    priceRange: "$2,100-$3,400",
    cta: "Request readiness review",
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing-package-table",
  },
  {
    path: "Hosted Evaluation",
    bestFor: "Teams that want Blueprint to run a managed exact-site review before pilot protocol or file handoff.",
    startsWith: "A site package or sample listing plus the task, threshold, and evidence question your team wants to inspect.",
    receivesFirst: "Review room request, scoped run notes, readiness observations, limits, and output decisions.",
    gatedBy: "Account access, entitlement, package readiness, threshold scope, and hosted-session availability.",
    priceRange: "$16-$29 / session-hour",
    cta: "Request hosted evaluation",
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing-hosted-table",
  },
  {
    path: "Custom Multi-Site Benchmark",
    bestFor: "Private, multi-site, vendor-comparison, or operator-heavy work where one catalog path is too narrow.",
    startsWith: "Facilities, task suite, site boundaries, commercialization posture, vendors, and pilot decision goal.",
    receivesFirst: "Benchmark brief, capture plan, operator boundary review, readiness methodology, and delivery estimate.",
    gatedBy: "Operator authority, custom rights/privacy terms, delivery capacity, evidence requirements, and commercial review.",
    priceRange: "$50,000+ scoped",
    cta: "Request benchmark scope",
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=custom-scope&path=world-model&source=pricing-custom-table",
  },
] as const;

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
        <p className={`text-sm ${dark ? "text-white/50" : "text-slate-400"}`}>{index}</p>
        <h2 className="font-editorial mt-4 text-[3.2rem] leading-[0.95] tracking-[-0.05em]">
          {title}
        </h2>
        <p className={`mt-3 text-[11px] uppercase tracking-[0.2em] ${dark ? "text-white/50" : "text-slate-500"}`}>
          {eyebrow}
        </p>
        <p className={`mt-5 text-base leading-7 ${dark ? "text-white/75" : "text-slate-700"}`}>
          {body}
        </p>
        <p className={`mt-6 text-lg font-semibold ${dark ? "text-white" : "text-slate-950"}`}>{price}</p>
        <ul className={`mt-6 space-y-3 text-sm leading-6 ${dark ? "text-white/70" : "text-slate-600"}`}>
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <span className={`mt-2 h-1.5 w-1.5 rounded-full ${dark ? "bg-white/45" : "bg-slate-400"}`} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative min-h-[42rem] border-t border-black/10 sm:min-h-[34rem] md:min-h-[25rem] lg:border-l lg:border-t-0">
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
        description="Choose a site/task readiness review, hosted evaluation, or custom multi-site benchmark for an indoor exact site your robot team needs to evaluate before a pilot."
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
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.82)_54%,rgba(255,255,255,0.2)_100%)] sm:bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.34)_30%,rgba(255,255,255,0.04)_72%)]"
          >
            <div className="absolute inset-0 mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
              <div className="max-w-[34rem]">
                <EditorialSectionLabel>Pricing</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-slate-950 sm:text-[5.1rem]">
                  Price the readiness question before the pilot.
                </h1>
                <p className="mt-6 text-lg leading-8 text-slate-900 sm:text-slate-700">
                  Robot teams can start with a site/task readiness advisory, a managed buyer room, or a custom benchmark. Blueprint keeps proof, rights, thresholds, price range, and access review tied to the indoor exact site before anything becomes payment, fulfillment, or hosted access.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing-hero"
                    className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Request readiness evaluation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing-hero"
                    className="inline-flex items-center justify-center border border-black/10 bg-white/75 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
                  >
                    Request hosted evaluation
                  </a>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Compare paths"
              title="Pick by the first buyer decision."
              description="Readiness review, hosted evaluation, and custom benchmark are separate starts. Each remains tied to one indoor exact site, request review, thresholds, and proof boundaries."
              className="max-w-3xl"
            />
            <div className="mt-7 overflow-x-auto border border-black/10">
              <table className="min-w-[62rem] w-full border-collapse bg-white text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Path</th>
                    <th className="px-4 py-3 font-semibold">Best for</th>
                    <th className="px-4 py-3 font-semibold">Starts with</th>
                    <th className="px-4 py-3 font-semibold">Buyer receives first</th>
                    <th className="px-4 py-3 font-semibold">Gated by</th>
                    <th className="px-4 py-3 font-semibold">Price range</th>
                    <th className="px-4 py-3 font-semibold">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {pricingPathRows.map((row) => (
                    <tr key={row.path}>
                      <td className="px-4 py-4 font-semibold text-slate-950">{row.path}</td>
                      <td className="px-4 py-4 leading-6 text-slate-700">{row.bestFor}</td>
                      <td className="px-4 py-4 leading-6 text-slate-700">{row.startsWith}</td>
                      <td className="px-4 py-4 leading-6 text-slate-700">{row.receivesFirst}</td>
                      <td className="px-4 py-4 leading-6 text-slate-700">{row.gatedBy}</td>
                      <td className="px-4 py-4 font-semibold text-slate-950">{row.priceRange}</td>
                      <td className="px-4 py-4">
                        <a
                          href={row.href}
                          className="inline-flex whitespace-nowrap border border-black/10 bg-[#f8f6f1] px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-white"
                        >
                          {row.cta}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] space-y-4 px-5 py-10 sm:px-8 lg:px-10">
          <PricePanel
            index="01"
            eyebrow="Files and license for your stack."
            title="Site/Task Readiness Review"
            price="$2,100 – $3,400"
            body="Scope a readiness report for one exact site/task: site package, robot profile, thresholds, failure modes, site modifications, data requirements, and short-pilot protocol."
            bullets={packageBullets}
            image="/generated/editorial/pricing-hero.png"
            imageAlt="Site package illustration"
            dark
          >
            <div className="absolute inset-y-0 right-0 flex w-full items-end justify-center p-6 lg:justify-end lg:p-8">
              <div className="grid w-full max-w-[32rem] gap-4 md:grid-cols-[0.52fr_0.48fr]">
                <div className="rounded-[1.6rem] border border-white/10 bg-black/55 p-5 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Blueprint readiness review</p>
                  <p className="mt-5 text-2xl font-semibold">Market Hall Grocery</p>
                  <p className="mt-3 text-sm text-white/60">Sample packet date · Mar 13, 2026</p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/90 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Thresholds</p>
                    <p className="mt-2 text-sm text-slate-700">Success, cycle, intervention, and safety bars named.</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/90 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Evidence boundary</p>
                    <p className="mt-2 text-sm text-slate-700">Advisory until owner-system proof supports more.</p>
                  </div>
                </div>
              </div>
            </div>
          </PricePanel>

          <PricePanel
            index="02"
            eyebrow="Managed session before file handoff."
            title="Hosted Evaluation"
            price="$16 – $29 / session-hour"
            body="Blueprint hosts the exact-site package in a managed buyer room so your team can review configured routes, scenario variations, observations, and readiness limits before deciding whether package access or pilot protocol should open next."
            bullets={hostedBullets}
            image="/generated/editorial/hosted-hero.png"
            imageAlt="Hosted evaluation panel"
          >
            <div className="absolute inset-0 flex items-center justify-center p-6 lg:justify-end lg:p-8">
              <div className="w-full max-w-[34rem] overflow-hidden rounded-[1.8rem] border border-white/15 bg-black/70 text-white shadow-[0_24px_60px_-36px_rgba(0,0,0,0.62)]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/50">
                  <span>Session playback</span>
                  <span>Example hosted view</span>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-[0.64fr_0.36fr]">
                  <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/35">
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
            title="Custom Multi-Site Benchmark"
            price="$50,000+ scoped"
            body="Use this path when the site is private, the rights model is custom, or your team needs Blueprint-managed readiness benchmarking across multiple locations, vendors, or robot releases."
            bullets={enterpriseBullets}
            image="/generated/editorial/manufacturing-plant.png"
            imageAlt="Custom operations view"
            dark
          >
            <div className="absolute inset-0 flex items-center justify-center p-6 lg:justify-end lg:p-8">
              <div className="w-full max-w-[34rem] overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/70 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.62)]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  <span>Custom scope overview</span>
                  <span>Example rollout view</span>
                </div>
                <div className="grid gap-px bg-white/10 md:grid-cols-[0.62fr_0.38fr]">
                  <div className="bg-black/35 px-5 py-4 text-sm text-white/70">
                    {[
                      ["Sample site package", "Review"],
                      ["Private facility", "Rights check"],
                      ["Multi-site request", "Scoped"],
                      ["Recapture need", "Pending"],
                    ].map(([name, state]) => (
                      <div key={name} className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
                        <span>{name}</span>
                        <span className="text-white/45">{state}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-black/30 px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Rollout map</p>
                    <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/35 p-4">
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
                eyebrow="Access model"
                title="Choose by the first decision your team needs to make."
                description="Readiness review means advisory evidence for one site/task. Hosted evaluation means managed browser sessions and run notes. Custom benchmark is for private, vendor-comparison, or multi-site work."
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
              {accessModels.map((example) => (
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
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {trustNotes.map((note) => (
              <article key={note.title} className="border border-black/10 bg-[#ebe7dd] p-5">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">{note.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">{note.body}</p>
              </article>
            ))}
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
            <div className="border-b border-black/10 px-6 py-5">
              <EditorialSectionIntro
                eyebrow="What you get"
                title="What each path unlocks first."
                description="The readiness path starts with the advisory and its proof boundary. The hosted path starts with a managed review session tied to the same exact site."
                className="max-w-3xl"
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3 xl:grid-cols-6">
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
              className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open sample site package
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing"
              className="inline-flex items-center justify-center border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
            >
              Request hosted evaluation
            </a>
            <a
              href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing"
              className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Request readiness evaluation
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
