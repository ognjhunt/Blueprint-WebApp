import { SEO } from "@/components/SEO";
import {
  mediaRoomSampleEvaluation,
  proofEvidencePacket,
  sampleExportTree,
  sampleHostedRunRows,
  sampleProofTimeline,
} from "@/lib/proofEvidence";
import {
  ArrowUpRight,
  BadgeCheck,
  Binary,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  MapPinned,
  PackageCheck,
  Route,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const heroImage = "/generated/2026-05-13-brand-system/blueprint-hero-proof-room-gpt-image-2.png";
const sampleStillImage = "/proof/grocery-aisle-proof-capture.png";

type IconItem = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
};

type LedgerRow = {
  label: string;
  value: string;
  detail: string;
};

const boundaryRows: LedgerRow[] = [
  {
    label: "Public page state",
    value: "Sample proof system",
    detail:
      "This page shows the shape of a Blueprint proof packet. It is a labeled sample, not proof from a customer site, and it does not imply rights approval for a real site.",
  },
  {
    label: "Live buyer state",
    value: "Request-specific proof packet",
    detail:
      "A request-specific packet appears only after the site-specific capture, rights/privacy review, package manifest, and hosted-session path exist for that request.",
  },
  {
    label: "What the buyer gets",
    value: "Decision-ready evidence",
    detail:
      "The buyer can see what is capture-grounded, what is model-inferred, what exports are allowed, and what remains blocked before purchase or hosted review.",
  },
];

const heroPacketRows = [
  ["Capture", "Source route, freshness, and provenance"],
  ["Package", "Manifest, model output, and export scope"],
  ["Review", "Hosted notes and buyer next step"],
];

const proofPacketExample: IconItem[] = [
  {
    icon: Route,
    label: "01",
    title: "Source capture",
    body: "Where the route came from, when it was captured, and which public-facing path it covers.",
  },
  {
    icon: FileText,
    label: "02",
    title: "Manifest",
    body: "The site id, capture id, files, route notes, quality checks, and included export modes.",
  },
  {
    icon: ShieldCheck,
    label: "03",
    title: "Rights sheet",
    body: "Use limits, privacy posture, redactions, restricted zones, and sharing boundaries.",
  },
  {
    icon: ClipboardCheck,
    label: "04",
    title: "Hosted report",
    body: "Run notes, observations, requested outputs, and unresolved review questions.",
  },
  {
    icon: PackageCheck,
    label: "05",
    title: "Export decision",
    body: "Whether the buyer should proceed, request more capture, narrow the export, or hold.",
  },
];

const trustSystemCards: IconItem[] = [
  {
    icon: Fingerprint,
    label: "01",
    title: "Capture stays attached",
    body:
      "Raw media, timestamps, route notes, device metadata, and package identifiers remain tied to the world model instead of becoming a detached demo.",
  },
  {
    icon: ShieldCheck,
    label: "02",
    title: "Rights are visible",
    body:
      "Usage scope, sharing limits, privacy review, restricted zones, and export boundaries are buyer-readable before commercial access expands.",
  },
  {
    icon: Binary,
    label: "03",
    title: "Model output is labeled",
    body:
      "Blueprint separates capture-grounded evidence from model-inferred or provider-generated output, so confidence never depends on vague AI polish.",
  },
  {
    icon: PackageCheck,
    label: "04",
    title: "Hosted review has a hierarchy",
    body:
      "Session notes, observations, exports, and recommendations point back to the same source packet and never become deployment guarantees.",
  },
];

const proofHierarchy: IconItem[] = [
  {
    icon: Route,
    label: "Capture-grounded",
    title: "Source capture record",
    body:
      "Walkthrough media, route context, timestamps, poses, device metadata, and source identifiers are the root truth.",
  },
  {
    icon: FileText,
    label: "Package contract",
    title: "World-model manifest",
    body:
      "The manifest names the site, capture basis, freshness state, proof depth, export types, and known restrictions.",
  },
  {
    icon: LockKeyhole,
    label: "Rights gate",
    title: "Privacy and use sheet",
    body:
      "The rights sheet states what can be viewed, exported, shared, retained, or kept blocked for that exact request.",
  },
  {
    icon: Sparkles,
    label: "Model-inferred",
    title: "Hosted evaluation output",
    body:
      "Run observations, route notes, and recommendations are useful only because they stay attached to the evidence packet.",
  },
];

const rightsRows: LedgerRow[] = [
  {
    label: "Access basis",
    value: "Common-area sample",
    detail:
      "The public example uses a common customer-area route. Private, staff-only, or operator-restricted areas require a different review path.",
  },
  {
    label: "Privacy posture",
    value: "Review before export",
    detail:
      "Faces, screens, receipts, payment areas, paperwork, and sensitive zones are redaction or exclusion triggers, not buyer-ready proof.",
  },
  {
    label: "Commercial scope",
    value: "Request-specific",
    detail:
      "Live licensing, sharing, retention, and transfer terms attach to the buyer packet only after the specific site and workflow are approved.",
  },
  {
    label: "Failure mode",
    value: "Fail closed",
    detail:
      "Missing rights, missing provenance, missing hosted runtime, or unsupported export scope blocks the claim instead of being smoothed over.",
  },
];

const hostedHierarchy: IconItem[] = [
  {
    icon: Boxes,
    label: "Base layer",
    title: "Package evidence",
    body:
      "Manifest, capture notes, source media references, route context, and allowed files form the durable source for evaluation.",
  },
  {
    icon: ClipboardCheck,
    label: "Review layer",
    title: "Hosted session",
    body:
      "Blueprint opens a scoped review path when the package and rights posture support it. Public sample pages do not imply live availability.",
  },
  {
    icon: BadgeCheck,
    label: "Decision layer",
    title: "Buyer recommendation",
    body:
      "The output ends in a practical next step: proceed, request more capture, narrow the export, or hold until a blocker is resolved.",
  },
];

const decisionFrames = [
  {
    title: "Proceed to hosted evaluation",
    body:
      "The packet has enough site-specific evidence, rights posture, and package scope for a buyer to inspect the world model in a browser.",
  },
  {
    title: "Request more capture",
    body:
      "Coverage, route shape, lighting, privacy, or workflow evidence is not strong enough for the buyer question yet.",
  },
  {
    title: "Hold the purchase",
    body:
      "Rights, export scope, runtime availability, or provenance is missing. Blueprint should block the claim until that evidence exists.",
  },
];

function StatusBadge({
  tone,
  children,
}: {
  tone: "sample" | "attached" | "blocked";
  children: string;
}) {
  const toneClass =
    tone === "sample"
      ? "border-[#b58d45]/40 bg-[#f7eddc] text-[#5d4520]"
      : tone === "attached"
        ? "border-[#2f7d6b]/35 bg-[#e6f3ef] text-[#174f43]"
        : "border-[#c2410c]/30 bg-[#fff0e8] text-[#7c2d12]";

  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${toneClass}`}>
      {tone === "blocked" ? <TriangleAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

function LedgerLine({ row }: { row: LedgerRow }) {
  return (
    <div className="grid gap-3 border-b border-black/10 py-5 last:border-b-0 md:grid-cols-[0.28fr_0.3fr_0.42fr]">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{row.label}</p>
      <p className="text-sm font-semibold leading-6 text-slate-950">{row.value}</p>
      <p className="text-sm leading-6 text-slate-600">{row.detail}</p>
    </div>
  );
}

function IconPanel({ item }: { item: IconItem }) {
  const Icon = item.icon;

  return (
    <div className="border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <Icon className="h-5 w-5 text-slate-950" />
        <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{item.label}</span>
      </div>
      <h3 className="mt-5 text-xl font-semibold leading-7 tracking-normal text-slate-950">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
    </div>
  );
}

export default function Proof() {
  return (
    <>
      <SEO
        title="Proof System | Blueprint"
        description="Blueprint's proof system shows the capture provenance, rights posture, hosted outputs, and sample-vs-live boundaries attached to a site-specific world model before purchase or hosted evaluation."
        canonical="/proof"
      />

      <div className="bg-white text-slate-950">
        <section className="relative overflow-hidden border-b border-black/10 bg-[#171613] text-white">
          <img
            src={heroImage}
            alt="Illustrative Blueprint proof room with sample evidence boards"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="eager"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.76)_42%,rgba(0,0,0,0.34)_100%)]" />
          <div className="relative mx-auto grid min-h-[43rem] max-w-[90rem] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-14">
            <div className="flex min-h-[35rem] flex-col justify-end">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[#d4b06b]">Blueprint proof</p>
              <h1 className="mt-6 max-w-[43rem] text-5xl font-semibold leading-none tracking-normal text-white sm:text-7xl">
                See what is attached before your team commits.
              </h1>
              <p className="mt-5 max-w-[36rem] text-base leading-7 text-white/80 sm:leading-8">
                Blueprint proof keeps capture provenance, rights posture, package scope, hosted outputs, and buyer decisions visible in one packet.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <StatusBadge tone="attached">Capture provenance</StatusBadge>
                <StatusBadge tone="attached">Rights posture</StatusBadge>
                <StatusBadge tone="sample">Hosted review context</StatusBadge>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-hero"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-[#f1efe7] sm:w-auto"
                >
                  Request world model
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href="/world-models"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                >
                  Browse world models
                </a>
              </div>
            </div>

            <aside className="self-end border border-white/20 bg-black/40 p-5 backdrop-blur-md">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="attached">Buyer proof packet</StatusBadge>
                <StatusBadge tone="sample">Sample packet view</StatusBadge>
              </div>
              <div className="mt-6 grid gap-px bg-white/10">
                {heroPacketRows.map(([label, value]) => (
                  <div key={label} className="bg-black/50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-normal text-white/50">{label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white">{value}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10">
            <div className="grid gap-6 lg:grid-cols-[0.3fr_0.7fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                  Proof packet example
                </p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-normal text-slate-950">
                  One packet, five buyer checks.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The public sample makes these checks inspectable without claiming customer proof.
                </p>
                <a
                  href="/sample-deliverables"
                  className="mt-6 inline-flex items-center rounded-md border border-black/10 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Inspect sample package
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </div>
              <div className="grid gap-px bg-black/10 md:grid-cols-5">
                {proofPacketExample.map((item) => (
                  <IconPanel key={item.title} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-[#f4f1ea]">
          <div className="mx-auto grid max-w-[90rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10 lg:py-12">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Trust system</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                Proof is a product capability.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
                The trust system is not a footnote after checkout. It is how Blueprint makes exact-site world models inspectable, requestable, and commercially usable without blurring sample assets into live proof.
              </p>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-2 xl:grid-cols-4">
              {trustSystemCards.map((item) => (
                <IconPanel key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[90rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.48fr_0.52fr] lg:px-10 lg:py-12">
            <div className="relative min-h-[25rem] overflow-hidden bg-slate-950">
              <img
                src={sampleStillImage}
                alt="Illustrative grocery aisle sample still with route and obstruction labels"
                className="h-full min-h-[25rem] w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.72)_100%)]" />
              <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-2">
                <StatusBadge tone="sample">Sample artifact still</StatusBadge>
                <StatusBadge tone="blocked">Displayed values are illustrative</StatusBadge>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-white/60">
                  {proofEvidencePacket.selectedStory.label}
                </p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-normal">
                  {proofEvidencePacket.selectedStory.locationName}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
                  This sample shows how a buyer-facing packet can organize route evidence, not that this exact site is live, rights-approved, or commercially available.
                </p>
              </div>
            </div>

            <div className="border border-black/10 bg-[#f8f6f1] p-6 lg:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Sample vs live</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                The public packet teaches the workflow. The request packet proves one site.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Blueprint can show a polished sample without pretending it is a customer result. For a buyer, the proof becomes operational only when it points to a concrete site, request, package, rights posture, and hosted-evaluation path.
              </p>
              <div className="mt-5 border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-800">
                This is the launch-ready public surface and buyer workflow. Live availability, rights, and fulfillment are confirmed per site/request.
              </div>
              <div className="mt-7 border-y border-black/10">
                {boundaryRows.map((row) => (
                  <LedgerLine key={row.label} row={row} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-[#171613] text-white">
          <div className="mx-auto max-w-[90rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-8 lg:grid-cols-[0.34fr_0.66fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-normal text-[#d4b06b]">Attached hierarchy</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal">
                  Every output should point back to the source packet.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  Blueprint can use different model providers over time, but the buyer-visible contract stays stable: capture truth, package truth, rights truth, hosted-session truth, and clear labels for model-inferred output.
                </p>
              </div>
              <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-4">
                {proofHierarchy.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="bg-[#211f1b] p-5">
                      <Icon className="h-5 w-5 text-[#d4b06b]" />
                      <p className="mt-5 text-[11px] font-semibold uppercase tracking-normal text-white/50">{item.label}</p>
                      <h3 className="mt-3 text-xl font-semibold leading-7 tracking-normal text-white">{item.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-white/60">{item.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[90rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Rights and provenance</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                Buyer confidence comes from visible limits.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The best proof page does not sound less confident because it has boundaries. It sounds more commercial because the buyer can see where the packet is strong, where access is scoped, and where the system will stop.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <StatusBadge tone="attached">Provenance attached</StatusBadge>
                <StatusBadge tone="attached">Rights posture attached</StatusBadge>
                <StatusBadge tone="blocked">Claims fail closed</StatusBadge>
              </div>
            </div>
            <div className="border border-black/10 bg-[#f8f6f1] px-5">
              {rightsRows.map((row) => (
                <LedgerLine key={row.label} row={row} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-[#f4f1ea]">
          <div className="mx-auto max-w-[90rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-6 lg:grid-cols-[0.36fr_0.64fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Hosted output</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                  Hosted review is the buyer room, not the proof source.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Hosted outputs are strongest when they inherit the packet instead of replacing it. The session helps the buyer inspect, compare, and decide, while the source evidence keeps the result honest.
                </p>
              </div>
              <div className="grid gap-px bg-black/10 md:grid-cols-3">
                {hostedHierarchy.map((item) => (
                  <IconPanel key={item.title} item={item} />
                ))}
              </div>
            </div>

            <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[0.58fr_0.42fr]">
              <div className="min-w-0 overflow-hidden border border-black/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Sample hosted rows</p>
                    <h3 className="mt-2 text-2xl font-semibold leading-8 tracking-normal text-slate-950">
                      What a buyer can evaluate in the session.
                    </h3>
                  </div>
                  <StatusBadge tone="sample">Sample rows only</StatusBadge>
                </div>
                <div className="mt-5 divide-y divide-black/10">
                  {sampleHostedRunRows.map((row) => (
                    <div key={row.run} className="grid gap-3 py-4 md:grid-cols-[0.16fr_0.3fr_0.3fr_0.24fr]">
                      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{row.run}</p>
                      <p className="text-sm font-semibold leading-6 text-slate-950">{row.scenario}</p>
                      <p className="text-sm leading-6 text-slate-600">{row.observation}</p>
                      <p className="text-sm leading-6 text-slate-700">{row.output}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 overflow-hidden border border-black/10 bg-slate-950 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-white/50">Sample export tree</p>
                <h3 className="mt-2 text-2xl font-semibold leading-8 tracking-normal text-white">
                  Files stay attached to the packet.
                </h3>
                <div className="mt-5 space-y-2 font-mono text-[12px] leading-6 text-white/70">
                  {sampleExportTree.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <KeyRound className="mt-1 h-3.5 w-3.5 shrink-0 text-[#d4b06b]" />
                      <span className="min-w-0 break-all">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[90rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.44fr_0.56fr] lg:px-10 lg:py-12">
            <div className="border border-black/10 bg-slate-950 p-6 text-white lg:p-8">
              <MapPinned className="h-5 w-5 text-[#d4b06b]" />
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-normal text-white/50">Representative packet</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal">
                {mediaRoomSampleEvaluation.siteName}
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">{mediaRoomSampleEvaluation.disclosure}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {sampleProofTimeline.map((item) => (
                  <div key={item.label} className="border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-normal text-white/50">{item.label}</p>
                    <p className="mt-3 text-sm leading-6 text-white/70">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-black/10 bg-[#f8f6f1] p-6 lg:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Buyer decision frame</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
                A proof packet should make the next decision obvious.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The page sells the intended product path without pretending every path is live today. The buyer sees the strongest supported move and the exact reason a different move may be blocked.
              </p>
              <div className="mt-7 grid gap-px bg-black/10">
                {decisionFrames.map((item) => (
                  <div key={item.title} className="bg-white p-5">
                    <h3 className="text-xl font-semibold leading-7 tracking-normal text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#171613] text-white">
          <div className="mx-auto grid max-w-[90rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-12">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[#d4b06b]">Trust before access</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal">
                Ask for the packet when one exact site matters.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
                Blueprint can scope the proof path around a sample catalog listing, a site you already know, or a new capture request. The packet stays honest: sample until request-specific evidence exists, with access opened after rights and hosted availability are ready.
              </p>
            </div>
            <div className="flex flex-col justify-end gap-3 sm:flex-row lg:flex-col">
              <a
                href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-bottom"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-md bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-[#f1efe7]"
              >
                Request world model
                <ArrowUpRight className="h-5 w-5" />
              </a>
              <a
                href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=proof-bottom"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-md border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Request hosted review
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
