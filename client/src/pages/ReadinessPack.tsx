import { SEO } from "@/components/SEO";
import {
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  LockKeyhole,
  Route,
  ShieldCheck,
} from "lucide-react";

const primaryContactHref =
  "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=readiness-hero";

const thresholds = [
  {
    label: "Success",
    value: "82%",
    target: "Target >= 92%",
    pct: 82,
    state: "Below bar",
  },
  {
    label: "Cycle",
    value: "118s",
    target: "Target <= 120s",
    pct: 86,
    state: "Review",
  },
  {
    label: "Intervene",
    value: "6%",
    target: "Target <= 5%",
    pct: 68,
    state: "Needs proof",
  },
  {
    label: "Safety",
    value: "0.96",
    target: "Target >= 0.95",
    pct: 94,
    state: "Review",
  },
];

const blockers = [
  {
    label: "Action logs",
    state: "Missing",
    detail: "Named manipulation traces",
  },
  { label: "Robot trial", state: "Missing", detail: "No owner-system run yet" },
  {
    label: "Safety review",
    state: "Open",
    detail: "Operator signoff required",
  },
];

const proofPacket = [
  { label: "Site Card", status: "Capture-grounded", icon: Camera },
  { label: "Task Cards", status: "Scoped", icon: Route },
  { label: "Scenario Cards", status: "Review needed", icon: ShieldCheck },
  { label: "Eval Cards", status: "Advisory", icon: Gauge },
  { label: "Proof boundary", status: "Fail-closed", icon: FileText },
];

const taskLanes = [
  {
    title: "Grocery shelf pick",
    image: humanoidReadinessAssets.groceryTask,
    checks: ["Reach", "Shelf face", "Handoff"],
  },
  {
    title: "Dock staging",
    image: humanoidReadinessAssets.loadingDock,
    checks: ["Turn", "Door state", "Traffic"],
  },
  {
    title: "Line-side assist",
    image: humanoidReadinessAssets.manufacturing,
    checks: ["Panel", "Fixture", "Payload"],
  },
  {
    title: "Cold aisle pull",
    image: humanoidReadinessAssets.coldStorage,
    checks: ["Fog", "Gloves", "Label"],
  },
];

const operatingFrames = [
  {
    label: "01 Capture",
    detail: "RGB/LiDAR evidence from the exact work area.",
  },
  { label: "02 Route", detail: "Start, stop, handoff, and restricted zones." },
  {
    label: "03 Pass bar",
    detail: "Success, cycle, intervention, and safety targets.",
  },
  {
    label: "04 Gaps",
    detail: "Simulator, action-log, trial, or safety blockers.",
  },
];

function ScoreRing({ score, label }: { score: number; label: string }) {
  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#d6b36a 0 ${score}%, rgba(255,255,255,0.14) ${score}% 100%)`,
        }}
      />
      <div className="absolute inset-3 rounded-full bg-slate-950" />
      <div className="relative text-center text-white">
        <p className="font-editorial text-5xl leading-none tracking-[-0.04em]">
          {score}
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
          {label}
        </p>
      </div>
    </div>
  );
}

function RouteMap() {
  const points = [
    ["Entry", 58, 230],
    ["Cross", 155, 152],
    ["Pick", 256, 178],
    ["Handoff", 355, 104],
    ["Exit", 464, 162],
  ] as const;

  return (
    <div className="relative overflow-hidden border border-white/10 bg-slate-950 p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Site route
        </p>
        <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
          Advisory
        </span>
      </div>
      <svg viewBox="0 0 520 300" className="mt-4 h-[19rem] w-full">
        <defs>
          <pattern
            id="readiness-floor-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path d="M28 0H0V28" fill="none" stroke="rgba(255,255,255,0.08)" />
          </pattern>
        </defs>
        <rect
          x="0"
          y="0"
          width="520"
          height="300"
          fill="url(#readiness-floor-grid)"
        />
        <path
          d="M42 246H124V92H214V52H318V118H486V238H380V202H248V246H42Z"
          fill="rgba(255,255,255,0.025)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="2"
        />
        <path
          d="M58 230C102 230 100 152 155 152C206 152 204 178 256 178C316 178 318 104 355 104C414 104 420 162 464 162"
          fill="none"
          stroke="#d6b36a"
          strokeLinecap="round"
          strokeWidth="6"
        />
        {points.map(([label, cx, cy], index) => (
          <g key={label}>
            <circle
              cx={cx}
              cy={cy}
              r="15"
              fill="#0f172a"
              stroke="#d6b36a"
              strokeWidth="4"
            />
            <text
              x={cx}
              y={cy + 4}
              fill="#fff7df"
              fontSize="12"
              fontWeight="700"
              textAnchor="middle"
            >
              {index + 1}
            </text>
          </g>
        ))}
        <circle cx="168" cy="82" r="12" fill="#ef4444" opacity="0.95" />
        <circle cx="417" cy="224" r="12" fill="#ef4444" opacity="0.95" />
      </svg>
      <div className="grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-5">
        {points.map(([label]) => (
          <div
            key={label}
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThresholdGauge({ item }: { item: (typeof thresholds)[number] }) {
  const belowBar = item.state === "Below bar" || item.state === "Needs proof";

  return (
    <div className="border border-black/10 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {item.value}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
            belowBar
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {item.state}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden bg-slate-100">
        <div
          className={`h-full ${belowBar ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${item.pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">{item.target}</p>
    </div>
  );
}

function ProofTile({ item }: { item: (typeof proofPacket)[number] }) {
  const Icon = item.icon;

  return (
    <div className="border border-white/10 bg-white/[0.04] p-4 text-white">
      <Icon className="h-5 w-5 text-amber-200" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
        {item.label}
      </p>
      <p className="mt-1 text-sm font-semibold">{item.status}</p>
    </div>
  );
}

export default function ReadinessPack() {
  return (
    <>
      <SEO
        title="Real-Site Robot Eval Cards | Blueprint"
        description="Blueprint produces request-scoped Site, Task, Scenario, and Eval Cards for humanoid robot teams evaluating success rate, cycle time, intervention rate, and safety thresholds before an on-site pilot."
        canonical="/readiness"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="relative border-b border-black/10">
          <MonochromeMedia
            src={humanoidReadinessAssets.warehouseHero}
            alt="Humanoid robot carrying a tote through a warehouse aisle"
            className="min-h-[44rem] rounded-none lg:min-h-[47rem]"
            imageClassName="min-h-[44rem] lg:min-h-[47rem]"
            loading="eager"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.68)_38%,rgba(0,0,0,0.12)_100%)]"
          >
            <RouteTraceOverlay className="opacity-70" />
            <div className="absolute inset-0 mx-auto grid max-w-[88rem] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.54fr_0.46fr] lg:px-10 lg:py-16">
              <div className="flex min-h-[35rem] flex-col justify-end">
                <div className="mb-5 flex flex-wrap gap-2">
                  <ProofChip light>Humanoid tasks</ProofChip>
                  <ProofChip light>Exact site</ProofChip>
                  <ProofChip light>Eval cards stay advisory</ProofChip>
                </div>
                <h1 className="font-editorial max-w-[42rem] text-[3.6rem] leading-[0.88] tracking-[-0.06em] text-white sm:text-[5.7rem]">
                  Humanoid eval cards for one real site.
                </h1>
                <p className="mt-6 max-w-[32rem] text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
                  A capture-backed card workflow for the site, task, scenario,
                  eval status, blockers, and next pilot proof.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={primaryContactHref}
                    className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Request eval dataset
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/proof"
                    className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Inspect proof boundaries
                  </a>
                </div>
              </div>

              <div className="hidden items-end lg:flex">
                <div className="w-full border border-white/20 bg-slate-950/80 p-5 text-white shadow-[0_34px_90px_-52px_rgba(0,0,0,0.72)] backdrop-blur">
                  <div className="flex items-center justify-between gap-6">
                    <ScoreRing score={78} label="score" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Hosted eval-card review
                      </p>
                      <h2 className="mt-4 font-editorial text-[2.45rem] leading-none tracking-[-0.05em]">
                        Two proof blockers remain.
                      </h2>
                      <p className="mt-4 text-sm leading-6 text-white/70">
                        Route evidence is inspectable. Action logs and
                        robot-trial proof are still missing.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    {blockers.map((blocker) => (
                      <div
                        key={blocker.label}
                        className="border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                          {blocker.label}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-amber-100">
                          {blocker.state}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px bg-black/10 px-5 py-6 sm:px-8 lg:grid-cols-4 lg:px-10">
            {operatingFrames.map((frame) => (
              <div key={frame.label} className="bg-[#f8f6f1] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {frame.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {frame.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[0.56fr_0.44fr]">
            <RouteMap />

            <div className="grid gap-4">
              <div className="border border-black/10 bg-white px-5 py-5">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-slate-950" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Pass bar
                    </p>
                    <h2 className="font-editorial mt-1 text-[2.5rem] leading-none tracking-[-0.05em]">
                      What must be proven.
                    </h2>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {thresholds.map((item) => (
                  <ThresholdGauge key={item.label} item={item} />
                ))}
              </div>
              <div className="border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm leading-6">
                    No deployment verdict without robot trials, action logs, and
                    safety review from the systems that own those facts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.48fr_0.52fr] lg:px-10 lg:py-12">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
                Sample report surface
              </p>
              <h2 className="font-editorial mt-5 text-[3rem] leading-[0.92] tracking-[-0.05em] sm:text-[4.4rem]">
                Less prose. More proof state.
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {proofPacket.map((item) => (
                  <ProofTile key={item.label} item={item} />
                ))}
              </div>
            </div>

            <div className="overflow-hidden border border-white/10 bg-black/30">
              <img
                src={humanoidReadinessAssets.hostedDashboard}
                alt="Hosted readiness dashboard showing route, thresholds, blockers, and proof packet state"
                className="h-full min-h-[25rem] w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-5 lg:grid-cols-[0.32fr_0.68fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Humanoid task lanes
              </p>
              <h2 className="font-editorial mt-5 text-[3rem] leading-[0.95] tracking-[-0.05em]">
                Same platform. Different site physics.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {taskLanes.map((lane) => (
                <article
                  key={lane.title}
                  className="overflow-hidden border border-black/10 bg-white"
                >
                  <img
                    src={lane.image}
                    alt={`${lane.title} humanoid robot readiness scene`}
                    className="aspect-[16/9] w-full object-cover"
                    loading="lazy"
                  />
                  <div className="grid gap-px bg-black/10 sm:grid-cols-[0.46fr_0.54fr]">
                    <div className="bg-white p-4">
                      <h3 className="text-base font-semibold text-slate-950">
                        {lane.title}
                      </h3>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Request-scoped
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-black/10 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {lane.checks.map((check) => (
                        <span key={check} className="bg-[#f8f6f1] px-2 py-4">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div className="border border-black/10 bg-[#f8f6f1] p-6">
              <ClipboardCheck className="h-6 w-6 text-slate-950" />
              <h2 className="font-editorial mt-5 text-[2.7rem] leading-[0.95] tracking-[-0.05em]">
                What the buyer receives.
              </h2>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {[
                [
                  "Readiness packet",
                "Site Card, Task Cards, Scenario Cards, Eval Cards.",
                ],
                [
                  "Proof boundary",
                  "What is sample, reviewed, missing, or owner-system proof.",
                ],
                [
                  "Pilot protocol",
                "A bounded next test, not a broad readiness guarantee.",
                ],
              ].map(([title, body]) => (
                <div key={title} className="bg-white p-6">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="mt-4 text-base font-semibold text-slate-950">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-20">
          <div className="grid gap-6 overflow-hidden border border-black/10 bg-slate-950 p-6 text-white lg:grid-cols-[0.5fr_0.5fr] lg:p-8">
            <div className="overflow-hidden border border-white/10">
              <img
                src={humanoidReadinessAssets.proofBoard}
                alt="Humanoid robot readiness proof board with route, rights, thresholds, blockers, and provenance"
                className="h-full min-h-[18rem] w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex flex-col justify-center">
              <ProofChip light>
                Capture-backed. Request-scoped. Humanoid-first.
              </ProofChip>
              <h2 className="font-editorial mt-5 text-[3rem] leading-[0.95] tracking-[-0.05em] sm:text-[3.6rem]">
                Turn pilot risk into a visible proof queue.
              </h2>
              <p className="mt-4 max-w-[31rem] text-sm leading-7 text-white/70">
                Blueprint shows what is inspectable now and what must be proven
                before a stronger robot-readiness claim can be made.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={primaryContactHref}
                  className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Request eval dataset
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/proof"
                  className="inline-flex items-center justify-center border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  Inspect proof boundaries
                </a>
              </div>
              <div className="mt-6 flex items-start gap-3 text-xs leading-5 text-white/50">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Requests do not charge, clear rights, start providers,
                  validate safety, or open hosted access by themselves.
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
