import { SEO } from "@/components/SEO";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Eye,
  FileText,
  LockKeyhole,
  Map,
  MessageSquare,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Sun,
  Warehouse,
} from "lucide-react";

const captureImage = "/proof/grocery-aisle-proof-capture.png";

const proofSummary = [
  {
    icon: Building2,
    label: "Site type",
    value: "Grocery retail - supermarket",
  },
  {
    icon: Route,
    label: "Capture route",
    value: "Aisle 12, cereal to snacks",
    action: "View route map",
  },
  {
    icon: ShieldCheck,
    label: "Rights posture",
    value: "Example packet",
    note: "Lawful route required for your site",
  },
  {
    icon: LockKeyhole,
    label: "Privacy posture",
    value: "Privacy-safe review",
    note: "No faces or PII captured",
  },
  {
    icon: Sparkles,
    label: "Robot question",
    value: "Can our robot navigate this aisle, detect obstructions, and inspect shelf fronts?",
  },
  {
    icon: CheckCircle2,
    label: "Evidence status",
    value: "Example packet",
    note: "For evaluation and planning only",
  },
];

const inspectionItems = [
  {
    icon: Eye,
    title: "Aisle geometry",
    detail: "Widths, clearances, turn points",
  },
  {
    icon: Sun,
    title: "Lighting and reflection",
    detail: "Illumination, glare, floor reflectance",
  },
  {
    icon: Warehouse,
    title: "Shelf visibility",
    detail: "Front facings, occlusions, sightlines",
  },
  {
    icon: ClipboardCheck,
    title: "Delivery and ops notes",
    detail: "Typical stock times, doorways, staging",
  },
  {
    icon: Route,
    title: "Traffic and obstruction points",
    detail: "Carts, displays, floor stock, cross-traffic",
  },
];

const provenanceRows = [
  ["Capture device", "Insta360 Titan (8K)"],
  ["Date / time", "May 14, 2025 at 10:42 AM local"],
  ["Route type", "Autonomous cart-mounted"],
  ["Route length", "128 m"],
  ["Frames", "2,184 panoramic frames"],
  ["Coverage", "98% of navigable path"],
  ["Hash", "a7f9c2e4...9b21d0f7"],
];

const hostedOutputs = [
  ["Navigability assessment", "Clearance map, bottlenecks, turn feasibility"],
  ["Shelf inspection summary", "Shelf visibility, occlusions, low-edge gaps"],
  ["Obstruction events", "Locations, sizes, and frequency"],
  ["Recommendations", "Route adjustments and inspection strategy"],
];

function MiniMap() {
  return (
    <div className="relative h-full min-h-[8.75rem] overflow-hidden rounded-md bg-[#101418]">
      <div className="absolute left-6 top-5 h-24 w-36 rotate-[-8deg] border border-white/15 bg-white/5" />
      <div className="absolute right-7 top-8 h-14 w-24 rotate-[12deg] border border-white/15 bg-white/5" />
      <div className="absolute bottom-5 left-12 h-12 w-28 rotate-[6deg] border border-white/15 bg-white/5" />
      <div className="absolute inset-x-8 top-1/2 h-px bg-white/20" />
      <div className="absolute left-[28%] top-[28%] h-16 w-28 rounded-[50%] border border-emerald-300/70" />
      <div className="absolute left-[36%] top-[35%] h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
      <div className="absolute right-[24%] top-[42%] h-2.5 w-2.5 rounded-full bg-red-300 shadow-[0_0_16px_rgba(252,165,165,0.9)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 150" fill="none" aria-hidden="true">
        <path
          d="M35 112 C68 92 90 88 114 68 C138 48 158 48 198 35"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <path d="M112 68 L198 35" stroke="#f59e0b" strokeWidth="2" />
      </svg>
    </div>
  );
}

export default function Proof() {
  return (
    <>
      <SEO
        title="Grocery aisle proof packet | Blueprint"
        description="A Blueprint example proof packet for a grocery aisle robot inspection, including route capture, provenance, privacy posture, and hosted-review outputs."
        canonical="/proof"
      />

      <div className="bg-white text-slate-950">
        <div className="mx-auto max-w-[96rem] px-5 py-7 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href="/case-studies" className="inline-flex items-center gap-2 font-medium text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              Capture examples
            </a>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">Grocery aisle robot inspection</span>
          </div>

          <section className="mt-7">
            <h1 className="max-w-4xl text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-[3.1rem]">
              Grocery aisle proof packet
            </h1>
            <p className="mt-3 max-w-4xl text-base leading-7 text-slate-600">
              A real-route capture example for shelf navigation, aisle obstruction checks, and robot team inspection.
            </p>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.88fr_1fr]">
            <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-950 shadow-[0_26px_80px_-58px_rgba(15,23,42,0.72)]">
              <img
                src={captureImage}
                alt="Annotated grocery aisle capture for robot inspection"
                className="aspect-[16/9] h-full w-full object-cover"
              />
              <div className="absolute left-4 top-4 inline-flex items-center gap-3 rounded-md bg-black/72 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                <CalendarClock className="h-4 w-4" />
                <span>Captured</span>
                <span className="font-medium text-white/80">May 14, 2025</span>
                <span className="font-medium text-white/80">10:42 AM local</span>
              </div>
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md bg-black/76 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur">
                <ArrowUpRight className="h-4 w-4" />
                View capture details
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-black/78 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-black">
                  <Play className="h-4 w-4" />
                  Play path
                </button>
                <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-black/78 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-black">
                  <Map className="h-4 w-4" />
                  3D map
                </button>
              </div>
            </div>

            <aside className="rounded-md border border-slate-200 bg-white px-6 py-4 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.55)]">
              <div className="divide-y divide-slate-200">
                {proofSummary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="grid gap-4 py-4 sm:grid-cols-[1.1fr_1.5fr]">
                      <div className="flex items-start gap-4">
                        <Icon className="mt-0.5 h-5 w-5 text-slate-700" />
                        <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-5 text-slate-950">{item.value}</p>
                        {item.note ? <p className="mt-1 text-sm leading-5 text-slate-500">{item.note}</p> : null}
                        {item.action ? (
                          <a href="/world-models/siteworld-f5fd54898cfb/start" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                            {item.action}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <a href="/sample-deliverables" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                View full provenance
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </aside>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr_1fr]">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-semibold tracking-[-0.025em]">What the robot team inspects</h2>
              </div>
              <div className="mt-4 grid gap-px border-t border-slate-200 pt-4 sm:grid-cols-2">
                {inspectionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-3 py-3 pr-4">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <a href="/sample-evaluation" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                See inspection checklist
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-semibold tracking-[-0.025em]">Capture provenance</h2>
              </div>
              <dl className="mt-4 border-t border-slate-200 pt-4">
                {provenanceRows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[0.85fr_1.15fr] gap-4 py-1 text-sm leading-5">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="flex items-center gap-2 font-medium text-slate-800">
                      {value}
                      {label === "Hash" ? <Copy className="h-3.5 w-3.5 text-slate-400" /> : null}
                    </dd>
                  </div>
                ))}
              </dl>
              <a href="/sample-deliverables" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                View capture log
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-semibold tracking-[-0.025em]">Hosted review output (sample)</h2>
              </div>
              <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_0.82fr]">
                <div className="space-y-3">
                  {hostedOutputs.map(([title, detail]) => (
                    <div key={title} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                      <div>
                        <p className="text-sm font-semibold leading-5 text-slate-950">{title}</p>
                        <p className="text-xs leading-5 text-slate-500">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <MiniMap />
              </div>
              <a href="/sample-deliverables" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                See sample output
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </section>

          <section className="mt-7 flex flex-col gap-4 pb-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-600">
                i
              </span>
              <span className="font-semibold text-slate-700">Example packet</span>
              <span>Not a guarantee of performance</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[31rem]">
              <a
                href="/contact?persona=robot-team"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <MessageSquare className="h-5 w-5" />
                Discuss a similar site
              </a>
              <a
                href="/world-models/siteworld-f5fd54898cfb/start"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-md bg-slate-950 px-6 text-base font-semibold text-white transition hover:bg-slate-800"
              >
                Open hosted review
                <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
