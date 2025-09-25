import React, { useMemo, useState } from "react";
import {
  Calculator,
  Sparkles,
  Zap,
  Users,
  CheckCircle2,
  Percent,
  PlusCircle,
  Gift,
  Image as ImageIcon,
  Video,
  Music2,
  Box,
  Globe,
  Type,
  ArrowRight,
  Clock,
  Building2,
  Cpu,
  Scan,
  TabletSmartphone,
  Clock3,
  UserCheck,
  QrCode,
  Cloud,
  Globe2,
  Rocket,
  RefreshCcw,
  Wrench,
  ShieldAlert,
  PiggyBank,
} from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LindyChat from "@/components/LindyChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ----------------------------- Shared Pricing ----------------------------- */

const BASE_RATE = 0.75 as const;
const RATES = {
  image: 0.005,
  video: 0.05,
  audio: 0.01,
  model: 0.02,
  webpage: 0.003,
  text: 0.002,
} as const;

type Counts = {
  image: number;
  video: number;
  audio: number;
  model: number;
  webpage: number;
  text: number;
};

const defaultCounts: Counts = {
  image: 20,
  video: 2,
  audio: 4,
  model: 10,
  webpage: 6,
  text: 20,
};

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type ContrastRow = {
  label: string;
  subLabel?: string;
  diy: string;
  blueprint: string;
  icon: IconType;
};

const contrastRows: ContrastRow[] = [
  {
    label: "Upfront platform build",
    subLabel: "Authoring/CMS, localization integration, deployment, analytics",
    diy: "$300k–$1.5M once, 4–9 months to MVP (team of 3–6 engineers/designers). Benchmarked from typical app/SaaS builds + AR complexity.",
    blueprint:
      "$0 platform build. Subscribe + configure. (Insert your Blueprint plan price here.)",
    icon: Building2,
  },
  {
    label: "Engine/tool seats",
    diy: "Unity Pro: $2,200/seat/yr × (# devs).",
    blueprint:
      "Often not required if Blueprint is no-code/low-code. If advanced custom dev, budget 1–2 Unity seats.",
    icon: Cpu,
  },
  {
    label: "Scanning software",
    diy: "Polycam Pro ~$17/mo per mapper; or just RoomPlan API (no fee).",
    blueprint:
      "Same device apps; Blueprint can guide self-scan. (Assume 0–$17/mo per active mapper.)",
    icon: Scan,
  },
  {
    label: "Mapper hardware (LiDAR)",
    diy: "$999 iPad Pro per field kit (plus case/charger).",
    blueprint:
      "Same device; you can shift to self-scan by the location (zero mapper CAPEX if BYOD is allowed).",
    icon: TabletSmartphone,
  },
  {
    label: "Per-location mapping time",
    diy: "~30–90 min on site (one pass) + admin/upload. RoomPlan suggests ~5 min per room; Lightship activation requires ≥10 viable scans (often 1–2 visits for public locations).",
    blueprint:
      "15–45 min self-scan guided flow; Blueprint automates processing & anchor setup. (If Niantic VPS public activation is needed, still expect the ≥10-scan rule.)",
    icon: Clock3,
  },
  {
    label: "Per-location labor",
    diy: "Mapper 1.5–3.0 hrs × $23–$27/hr = $35–$80; designer 8–20 hrs × $25–$70/hr = $200–$1,400.",
    blueprint:
      "Mapper: 0–1 hr (self-serve); designer: 2–8 hrs if templated. Net $0–$600 depending on how much is automated/templated.",
    icon: UserCheck,
  },
  {
    label: "QR/marker printing (optional)",
    diy: "$25–$230 per location (e.g., 100 stickers ≈ $73; 1,000 ≈ $232).",
    blueprint:
      "Same physicals. Blueprint can standardize artwork & quantities to cut waste.",
    icon: QrCode,
  },
  {
    label: "Cloud egress + storage (per location)",
    diy: "Example: 50 MB initial asset load × 1,000 sessions/mo = 50 GB → ≈$4.25/mo egress; storage ≤$1/mo for small bundles. (Scale linearly).",
    blueprint:
      "Same underlying costs (Blueprint usually uses a CDN too). Some plans may bundle hosting; if not, expect comparable egress/storage.",
    icon: Cloud,
  },
  {
    label: "VPS/Geospatial usage",
    diy: "Lightship VPS: first 10k calls free, then $10 per 1k (to 100k), $8 per 1k (100–500k). ARCore Geospatial: no usage pricing published; quotas apply.",
    blueprint:
      "Same physics. Blueprint may help reduce calls/session (better caching/local relocalization). Still budget per the Lightship tiers.",
    icon: Globe2,
  },
  {
    label: "Time to first location live",
    diy: "6–12+ weeks (build + content + QA) if starting from zero. Agency ranges for AR MVPs are often $30k–$150k over 2–4 months.",
    blueprint:
      "<24 hours typical for first site (subscribe → scan → place content) once your templates are ready.",
    icon: Rocket,
  },
  {
    label: "Time to additional locations",
    diy: "3–7 days each (scheduling mapper, scans, content, QA).",
    blueprint: "Same day if self-scan + templated scenes.",
    icon: RefreshCcw,
  },
  {
    label: "Ongoing maintenance",
    diy: "8–20 hrs/mo per venue (content swaps, analytics checks, re-scans after layout changes).",
    blueprint:
      "2–6 hrs/mo per venue (templated campaigns + centralized analytics), plus occasional re-scan after big resets.",
    icon: Wrench,
  },
  {
    label: "Risk & dependencies",
    diy: "You own everything; higher engineering/ops burden; must track vendor changes (e.g., Unity pricing; Lightship quotas).",
    blueprint:
      "Vendor handles most plumbing; you trade CAPEX for OPEX; portability via open formats/anchors still recommended.",
    icon: ShieldAlert,
  },
];

const tldrHighlights: { label: string; diy: string; blueprint: string }[] = [
  {
    label: "One-time platform build",
    diy: "$300k–$1.5M; 4–9 mo",
    blueprint: "$0 (subscribe)",
  },
  {
    label: "Per-location labor",
    diy: "$235–$1,480 (mapper + designer)",
    blueprint: "$0–$600 (self-scan + template)",
  },
  {
    label: "VPS per 100k sessions/mo",
    diy: "≈$900/mo (Lightship after free 10k)",
    blueprint: "Same underlying VPS unless bundled",
  },
  {
    label: "CDN egress per 100k sessions @ 40 MB",
    diy: "≈$340/mo",
    blueprint: "Similar (unless bundled)",
  },
  {
    label: "Tool seats",
    diy: "Unity Pro $2,200/seat/yr",
    blueprint: "Often none (no-code); add if custom dev",
  },
  {
    label: "Scanner hardware",
    diy: "$999 per kit",
    blueprint: "Same (or BYOD if self-scan)",
  },
  {
    label: "Time to first site live",
    diy: "6–12+ weeks",
    blueprint: "<24 hours",
  },
  {
    label: "Time per additional site",
    diy: "3–7 days",
    blueprint: "Same day–2 days",
  },
];

const takeaways = [
  "VPS, CDN, and labor dominate the per-location TCO. VPS has a generous free tier; CDN egress is cheap at pilot scale; labor is the real swing factor.",
  "DIY shines if you already have a team (Unity + backend + 3D) and want control; otherwise you’re taking on $300k–$1.5M of platform build risk and months of time.",
  "Blueprint removes the platform CAPEX and cuts per-site hours (self-scan + templates), making multi-location rollouts more predictable. You still budget for VPS calls and egress (or whatever Blueprint includes/abstracts).",
];

const scenarioData: { name: string; subtitle: string; bullets: string[] }[] = [
  {
    name: "Scenario A — Small pilot",
    subtitle: "3 stores, 1,000 sessions/store/month, 50 MB initial asset load.",
    bullets: [
      "VPS: 3,000 calls/mo → $0 (under 10k free).",
      "CDN egress: 3,000 × 50 MB = 150 GB → ≈$12.75/mo.",
      "Storage: ~1.5 GB total → ≈$0.03/mo.",
      "QRs: 300 stickers total → ≈$219 one-time.",
      "Labor (DIY): mapper ~2 h/site; designer ~10 h/site → ~$1,650 total using the midpoints above.",
      "Blueprint: if self-scan + templates, the per-site labor often drops to ~$200–$600 (mostly design polish). (Substitute your Blueprint subscription here.)",
    ],
  },
  {
    name: "Scenario B — Heavier usage",
    subtitle: "10 stores, 10,000 sessions/store/month; 40 MB cached load.",
    bullets: [
      "VPS: 100k calls/mo → first 10k free; 90k × $10/1k ≈ $900/mo (if all sessions call VPS once).",
      "CDN egress: 100k × 40 MB = 4,000 GB → ≈$340/mo.",
      "Storage: ~10 GB total → ≈$0.23/mo.",
      "Labor: DIY scales with venues (coordinating mappers, QA); Blueprint’s self-serve + templates tend to cap per-site hours.",
    ],
  },
];

function pricePerHour(counts: Counts) {
  const addOns =
    counts.image * RATES.image +
    counts.video * RATES.video +
    counts.audio * RATES.audio +
    counts.model * RATES.model +
    counts.webpage * RATES.webpage +
    counts.text * RATES.text;
  return BASE_RATE + addOns;
}

/* ------------------------------ Hero + Plans ------------------------------ */

type PlanTier = {
  name: string;
  price: string;
  priceSuffix?: string;
  target: string;
  limit: string;
  overage: string;
  features: string[];
  margin: string;
  ctaLabel: string;
  highlight?: boolean;
};

const planTiers: PlanTier[] = [
  {
    name: "Starter",
    price: "$79",
    priceSuffix: "/month",
    target: "Small shops (up to 500 MAUs)",
    limit: "Cap: 500 MAUs/mo",
    overage: "Overage: $0.15 per MAU beyond 500 (covers ~$0.10 cost + buffer).",
    features: [
      "Basic device mapping and glasses streaming",
      "Baseline experiences covered by the Niantic free tier",
      "Standard RAG with URL context for store FAQs",
      "Email support plus foundational analytics",
    ],
    margin: "~75% avg. margin ($79 - ~$70 costs; Niantic usage stays free).",
    ctaLabel: "Launch Starter",
  },
  {
    name: "Pro",
    price: "$199",
    priceSuffix: "/month",
    target: "Mid-size retail (500–1,000 MAUs)",
    limit: "Cap: 1,000 MAUs/mo",
    overage:
      "Overage: $0.12 per MAU beyond 1,000 (tracks Niantic volume tiers).",
    features: [
      "Premium experiences like blueprint PDFs and inventory grounding",
      "Unlimited sessions with function calling integrations (POS, loyalty, etc.)",
      "Dedicated strategy workshops on layouts, Q&A insights, and rollout plans",
      "Priority chat support when new campaigns go live",
    ],
    margin: "~65% avg. margin ($199 - ~$70 platform + ~$50 Niantic usage).",
    ctaLabel: "Scale with Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "$399+",
    priceSuffix: "/month (custom)",
    target: "Chains and high-traffic venues (1,000+ MAUs)",
    limit: "Custom MAU tiers",
    overage:
      "Usage-based pricing aligns with Niantic’s high-volume discounts ($0.08/MAU).",
    features: [
      "Full AR + IoT master dashboard for every location",
      "Advanced features like live Google feeds and geo-fenced signage",
      "Dedicated mapper onboarding with blueprints and signage kits",
      "Managed updates, compliance reviews, and 99.9% uptime SLAs",
    ],
    margin:
      "~60% avg. margin ($399 - ~$160 platform + ~$120 Niantic @ $0.08/MAU).",
    ctaLabel: "Talk to sales",
  },
];

const addOnItems = [
  "$29/month per additional active location",
  "$99 one-time setup for RAG build-out and initial scans",
  "$0.15/session overage safety net for rare traffic spikes",
];

const billingPerks = [
  "15% discount when you pay annually",
  "Free 30-day trial with every Pro feature unlocked",
  "Up to 500 MAUs are covered by Niantic’s free tier during trial",
];

function PriceHero() {
  return (
    <section className="max-w-6xl mx-auto pt-20 pb-12 px-4 sm:px-6 lg:px-8 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl sm:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500"
      >
        Simple pricing that scales with every location
      </motion.h1>

      <p className="mt-4 max-w-3xl mx-auto text-lg text-slate-300">
        Try Blueprint Pro free for 30 days. Launch with guided scans, then pick
        the MAU tier that matches your foot traffic—no surprise platform fees.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          <Clock className="h-4 w-4" />
          Free 30-day trial, full Pro features
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
          <Percent className="h-4 w-4" />
          15% off when billed annually
        </div>
      </div>
    </section>
  );
}

function PlanCards() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {planTiers.map((plan) => (
          <Card
            key={plan.name}
            className={`rounded-2xl border ${
              plan.highlight
                ? "border-emerald-400/60 bg-emerald-500/10"
                : "border-white/15 bg-white/[0.04]"
            } backdrop-blur-sm shadow-2xl`}
          >
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                  {plan.name}
                </div>
                <Badge
                  variant="secondary"
                  className="bg-white/10 text-slate-100"
                >
                  {plan.limit}
                </Badge>
              </div>
              <CardTitle className="text-white text-3xl flex items-baseline gap-1">
                {plan.price}
                {plan.priceSuffix ? (
                  <span className="text-base font-normal text-slate-300">
                    {plan.priceSuffix}
                  </span>
                ) : null}
              </CardTitle>
              <CardDescription className="text-slate-300 text-sm">
                {plan.target}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-200">
                {plan.overage}
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-slate-100"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-400">
                {plan.margin}
              </div>
              <Button
                className={`w-full ${plan.highlight ? "bg-emerald-500 hover:bg-emerald-600" : "bg-white/10 hover:bg-white/15"}`}
              >
                {plan.ctaLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-[0.2em]">
              <PlusCircle className="h-4 w-4" /> Add-ons
            </div>
            <CardTitle className="text-white text-2xl">
              Scale as you add locations
            </CardTitle>
            <CardDescription className="text-slate-300 text-sm">
              Keep your base tier and bolt on extra capacity when you need it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-slate-100">
              {addOnItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-200 text-xs uppercase tracking-[0.2em]">
              <Gift className="h-4 w-4" /> Billing perks
            </div>
            <CardTitle className="text-white text-2xl">
              Built-in savings
            </CardTitle>
            <CardDescription className="text-slate-300 text-sm">
              Rewards for launching fast and committing to scale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-slate-100">
              {billingPerks.map((perk) => (
                <li key={perk} className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-cyan-200" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ----------------------------- Calculator Card ---------------------------- */

const RateRow = ({
  icon,
  label,
  count,
  rate,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  rate: number;
}) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-emerald-300">
        {icon}
      </div>
      <span className="text-sm text-slate-200">{label}</span>
    </div>
    <Badge variant="secondary" className="bg-white/10 text-slate-100">
      +${rate.toFixed(3)}/hr{typeof count === "number" ? ` × ${count}` : ""}
    </Badge>
  </div>
);

function PricingCalculator({
  counts,
  setCounts,
  hourly,
}: {
  counts: Counts;
  setCounts: React.Dispatch<React.SetStateAction<Counts>>;
  hourly: number;
}) {
  const [visitors, setVisitors] = useState<number>(400);
  const [basis, setBasis] = useState<"day" | "week" | "month">("day");
  const [avgMinutes, setAvgMinutes] = useState<number>(35);
  const [adoptionPct, setAdoptionPct] = useState<number>(1);

  const estimatedMonthlyHours = useMemo(() => {
    let monthlyVisitors = visitors;
    if (basis === "day") monthlyVisitors *= 30;
    if (basis === "week") monthlyVisitors *= 4;
    const totalMinutes = monthlyVisitors * avgMinutes;
    const totalHours = totalMinutes / 60;
    return Math.max(0, totalHours * (adoptionPct / 100));
  }, [visitors, basis, avgMinutes, adoptionPct]);

  const estimatedMonthlyCost = useMemo(
    () => estimatedMonthlyHours * hourly,
    [estimatedMonthlyHours, hourly],
  );

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  return (
    <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl overflow-visible">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-emerald-300">
          <Calculator className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wide">Calculator</span>
        </div>
        <CardTitle className="text-white text-2xl">Usage Calculator</CardTitle>
        <CardDescription className="text-slate-300">
          Tune your{" "}
          <span className="text-white/90 font-medium">price per hour</span> by
          content type, then estimate a monthly bill from your traffic.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-start gap-6 lg:gap-8">
          {/* LEFT: Content mix */}
          <div className="min-w-0">
            <h4 className="text-slate-200 font-semibold mb-3">
              Content in your Blueprint
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {(
                [
                  [
                    "image",
                    "Images",
                    <ImageIcon key="i" className="w-4 h-4" />,
                  ],
                  ["video", "Videos", <Video key="v" className="w-4 h-4" />],
                  ["audio", "Audio", <Music2 key="a" className="w-4 h-4" />],
                  ["model", "3D Models", <Box key="m" className="w-4 h-4" />],
                  [
                    "webpage",
                    "Webpages",
                    <Globe key="w" className="w-4 h-4" />,
                  ],
                  ["text", "Text", <Type key="t" className="w-4 h-4" />],
                ] as const
              ).map(([key, label, icon]) => (
                <div
                  key={key}
                  className="rounded-xl bg-white/[0.06] border border-white/10 p-3 isolate"
                >
                  <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-2">
                    <span className="text-emerald-300">{icon}</span>
                    {label}
                  </Label>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <Input
                      type="number"
                      min={0}
                      value={counts[key as keyof Counts]}
                      onChange={(e) =>
                        setCounts(
                          (c) =>
                            ({ ...c, [key]: num(e.target.value) }) as Counts,
                        )
                      }
                      className="h-9 w-full min-w-0 flex-1 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                      placeholder="0"
                    />
                    <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0 whitespace-nowrap mt-2 sm:mt-0">
                      +${RATES[key as keyof typeof RATES].toFixed(3)}/hr
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div className="text-xs text-slate-400">Your price per hour</div>
              <div className="text-[11px] text-slate-500">
                Base ${BASE_RATE.toFixed(2)} + Σ(add-ons)
              </div>
              <div className="mt-1 text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                ${hourly.toFixed(2)}/hr
              </div>
            </div>
          </div>

          {/* RIGHT: Traffic estimator */}
          <div className="min-w-0">
            <h4 className="text-slate-200 font-semibold mb-3">
              Traffic (optional)
            </h4>

            <div className="space-y-4">
              <div>
                <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Visitors
                </Label>

                <div className="flex gap-2 flex-wrap items-stretch">
                  <Input
                    type="number"
                    min={0}
                    value={visitors}
                    onChange={(e) => setVisitors(num(e.target.value))}
                    className="h-9 grow min-w-0 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    placeholder="500"
                  />
                  <div className="w-full sm:w-auto">
                    <select
                      value={basis}
                      onChange={(e) =>
                        setBasis(e.target.value as "day" | "week" | "month")
                      }
                      className="h-9 w-full sm:w-[140px] rounded-md bg-white/5 border border-white/15 text-slate-100 px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="day">per day</option>
                      <option value="week">per week</option>
                      <option value="month">per month</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-300 mb-1 block">
                    Avg visit (minutes)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={avgMinutes}
                    onChange={(e) => setAvgMinutes(num(e.target.value))}
                    className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    placeholder="30"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-300 mb-1 block">
                    % using Blueprint
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={adoptionPct}
                    onChange={(e) => setAdoptionPct(num(e.target.value))}
                    className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    placeholder="10"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6 bg-white/10" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Estimated monthly hours</span>
                <span className="text-xl font-bold text-emerald-300">
                  {estimatedMonthlyHours.toFixed(0)} hrs
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Estimated monthly cost</span>
                <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                  ${estimatedMonthlyCost.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Page ---------------------------------- */

export default function PricingPage() {
  const [counts, setCounts] = useState<Counts>(defaultCounts);
  const hourly = useMemo(() => pricePerHour(counts), [counts]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100">
      <Nav />

      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
      </div>

      {/* Pricing hero */}
      <PriceHero />

      {/* Tier cards */}
      <PlanCards />

      {/* Usage calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        <PricingCalculator
          counts={counts}
          setCounts={setCounts}
          hourly={hourly}
        />
      </section>

      {/* FAQs */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 mb-20">
        <div className="grid md:grid-cols-3 items-stretch gap-6 md:gap-8">
          <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">
                What’s included in the free trial?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Every Pro feature is unlocked for 30 days, including guided scans,
              premium experiences, and analytics. The first 500 MAUs ride on the
              Niantic free tier, so you can validate in-market without a bill.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">
                How do MAU caps and overages work?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Starter includes up to 500 MAUs/month with $0.15 per MAU if you go
              over. Pro includes 1,000 MAUs/month with a $0.12 per MAU overage
              that mirrors Niantic’s volume discounts. Enterprise tiers are
              custom.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">
                Can I add more locations later?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Yes. Add locations for $29/month each, with a $99 setup to build
              RAG context and run initial scans. Rare traffic spikes are covered
              by a $0.15/session overage so guests never see throttling.
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Start your free trial
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* DIY vs Blueprint contrast */}
      <section className="relative mt-16 lg:mt-20 px-4 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-x-6 top-0 h-3/4 rounded-3xl bg-gradient-to-b from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              DIY vs Blueprint
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white">
              Compare total cost of ownership at a glance
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300">
              Swap in your numbers to see how a managed rollout stacks up
              against building and operating everything in-house.
            </p>
          </div>

          <div className="mt-10">
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
                <div className="grid grid-cols-[1.2fr,1fr,1fr] gap-6 border-b border-white/10 bg-white/[0.03] px-8 py-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  <div className="text-left">Line item</div>
                  <div className="text-center text-emerald-200">
                    Do it internally (DIY)
                  </div>
                  <div className="text-center text-cyan-200">
                    Use Blueprint (managed)
                  </div>
                </div>
                <div className="divide-y divide-white/10">
                  {contrastRows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <div
                        key={row.label}
                        className="grid grid-cols-[1.2fr,1fr,1fr] items-start gap-6 px-8 py-6 transition-colors hover:bg-white/[0.05]"
                      >
                        <div className="flex gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                            <Icon className="h-5 w-5 text-emerald-300" />
                          </div>
                          <div>
                            <div className="text-base font-semibold text-white">
                              {row.label}
                            </div>
                            {row.subLabel ? (
                              <div className="mt-1 text-xs text-slate-400">
                                {row.subLabel}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-200">
                          {row.diy}
                        </p>
                        <p className="text-sm leading-relaxed text-slate-200">
                          {row.blueprint}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="md:hidden space-y-4">
              {contrastRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-emerald-500/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                        <Icon className="h-5 w-5 text-emerald-300" />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-white">
                          {row.label}
                        </div>
                        {row.subLabel ? (
                          <div className="mt-1 text-xs text-slate-400">
                            {row.subLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-emerald-300">
                          Do it internally (DIY)
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-200">
                          {row.diy}
                        </p>
                      </div>
                      <div className="border-t border-white/10 pt-3">
                        <div className="text-[11px] uppercase tracking-wide text-cyan-300">
                          Use Blueprint (managed)
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-200">
                          {row.blueprint}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
                <Zap className="h-3.5 w-3.5" />
                Takeaways
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
                {takeaways.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                TL;DR metrics
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {tldrHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-emerald-200">
                      DIY: {item.diy}
                    </div>
                    <div className="mt-1 text-sm text-cyan-200">
                      Blueprint: {item.blueprint}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {scenarioData.map((scenario) => (
              <div
                key={scenario.name}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 p-6 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                    <PiggyBank className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {scenario.name}
                    </div>
                    <div className="text-xs text-slate-300">
                      {scenario.subtitle}
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
                  {scenario.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <LindyChat />
    </div>
  );
}

// import React, { useMemo, useState } from "react";
// import {
//   Calculator,
//   Sparkles,
//   Zap,
//   InfoIcon,
//   Users,
//   Image as ImageIcon,
//   Video,
//   Music2,
//   Box,
//   Globe,
//   Type,
//   ArrowRight,
// } from "lucide-react";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";
// import LindyChat from "@/components/LindyChat";
// import { motion } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";

// /**
//  * ---------------------------------------------------------------------------
//  * Pricing model (kept in one place so the Calculator and the “Rates” card share it)
//  * ---------------------------------------------------------------------------
//  * Base + content add-ons match your CostPanel:
//  */
// const BASE_RATE = 0.75 as const;
// const RATES = {
//   image: 0.005,
//   video: 0.05,
//   audio: 0.01,
//   model: 0.02,
//   webpage: 0.003,
//   text: 0.002,
// } as const;

// type Counts = {
//   image: number;
//   video: number;
//   audio: number;
//   model: number;
//   webpage: number;
//   text: number;
// };

// const defaultCounts: Counts = {
//   image: 20,
//   video: 2,
//   audio: 2,
//   model: 10,
//   webpage: 6,
//   text: 20,
// };

// /** Utility: price per hour for the current mix */
// function pricePerHour(counts: Counts) {
//   const addOns =
//     counts.image * RATES.image +
//     counts.video * RATES.video +
//     counts.audio * RATES.audio +
//     counts.model * RATES.model +
//     counts.webpage * RATES.webpage +
//     counts.text * RATES.text;
//   return BASE_RATE + addOns;
// }

// /** Small helper components -------------------------------------------------- */
// const RateRow = ({
//   icon,
//   label,
//   count,
//   rate,
// }: {
//   icon: React.ReactNode;
//   label: string;
//   count?: number;
//   rate: number;
// }) => (
//   <div className="flex items-center justify-between py-1">
//     <div className="flex items-center gap-2">
//       <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-emerald-300">
//         {icon}
//       </div>
//       <span className="text-sm text-slate-200">{label}</span>
//     </div>
//     <Badge variant="secondary" className="bg-white/10 text-slate-100">
//       +${rate.toFixed(3)}/hr{typeof count === "number" ? ` × ${count}` : ""}
//     </Badge>
//   </div>
// );

// /** Calculator block (content-mix + traffic quick-estimator) ----------------- */
// function PricingCalculator() {
//   const [counts, setCounts] = useState<Counts>(defaultCounts);

//   // quick traffic estimator (optional)
//   const [visitors, setVisitors] = useState<number>(400);
//   const [basis, setBasis] = useState<"day" | "week" | "month">("day");
//   const [avgMinutes, setAvgMinutes] = useState<number>(35);
//   const [adoptionPct, setAdoptionPct] = useState<number>(1);

//   const hourly = useMemo(() => pricePerHour(counts), [counts]);

//   const estimatedMonthlyHours = useMemo(() => {
//     let monthlyVisitors = visitors;
//     if (basis === "day") monthlyVisitors *= 30;
//     if (basis === "week") monthlyVisitors *= 4;
//     const totalMinutes = monthlyVisitors * avgMinutes;
//     const totalHours = totalMinutes / 60;
//     return Math.max(0, totalHours * (adoptionPct / 100));
//   }, [visitors, basis, avgMinutes, adoptionPct]);

//   const estimatedMonthlyCost = useMemo(
//     () => estimatedMonthlyHours * hourly,
//     [estimatedMonthlyHours, hourly],
//   );

//   const num = (v: unknown) => {
//     const n = Number(v);
//     return Number.isFinite(n) && n >= 0 ? n : 0;
//   };

//   return (
//     <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl overflow-visible">
//       <CardHeader className="pb-2">
//         <div className="flex items-center gap-2 text-emerald-300">
//           <Calculator className="h-5 w-5" />
//           <span className="text-xs uppercase tracking-wide">Calculator</span>
//         </div>
//         <CardTitle className="text-white text-2xl">Usage Calculator</CardTitle>
//         <CardDescription className="text-slate-300">
//           Build your{" "}
//           <span className="text-white/90 font-medium">price per hour</span> from
//           content types, then estimate a monthly bill from your traffic.
//         </CardDescription>
//       </CardHeader>

//       <CardContent className="pt-6">
//         {/* Responsive two-column layout with generous gaps and proper shrink/wrap behavior */}
//         <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-start gap-6 lg:gap-8">
//           {/* LEFT: Content mix */}
//           <div className="min-w-0">
//             <h4 className="text-slate-200 font-semibold mb-3">
//               Content in your Blueprint
//             </h4>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//               {(
//                 [
//                   [
//                     "image",
//                     "Images",
//                     <ImageIcon key="i" className="w-4 h-4" />,
//                   ],
//                   ["video", "Videos", <Video key="v" className="w-4 h-4" />],
//                   ["audio", "Audio", <Music2 key="a" className="w-4 h-4" />],
//                   ["model", "3D Models", <Box key="m" className="w-4 h-4" />],
//                   [
//                     "webpage",
//                     "Webpages",
//                     <Globe key="w" className="w-4 h-4" />,
//                   ],
//                   ["text", "Text", <Type key="t" className="w-4 h-4" />],
//                 ] as const
//               ).map(([key, label, icon]) => (
//                 <div
//                   key={key}
//                   className="rounded-xl bg-white/[0.06] border border-white/10 p-3 isolate"
//                 >
//                   <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-2">
//                     <span className="text-emerald-300">{icon}</span>
//                     {label}
//                   </Label>

//                   {/* Input grows and can shrink; badge never overlaps and can wrap on small screens */}
//                   <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
//                     <Input
//                       type="number"
//                       min={0}
//                       value={counts[key as keyof Counts]}
//                       onChange={(e) =>
//                         setCounts(
//                           (c) =>
//                             ({ ...c, [key]: num(e.target.value) }) as Counts,
//                         )
//                       }
//                       className="h-9 w-full min-w-0 flex-1 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                       placeholder="0"
//                     />
//                     <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0 whitespace-nowrap mt-2 sm:mt-0">
//                       +${RATES[key as keyof typeof RATES].toFixed(3)}/hr
//                     </Badge>
//                   </div>
//                 </div>
//               ))}
//             </div>

//             <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div className="text-xs text-slate-400">Your price per hour</div>
//               <div className="text-[11px] text-slate-500">
//                 Base ${BASE_RATE.toFixed(2)} + Σ(add-ons)
//               </div>
//               <div className="mt-1 text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${hourly.toFixed(2)}/hr
//               </div>
//             </div>
//           </div>

//           {/* RIGHT: Traffic estimator */}
//           <div className="min-w-0">
//             <h4 className="text-slate-200 font-semibold mb-3">
//               Traffic (optional)
//             </h4>

//             <div className="space-y-4">
//               {/* Visitors */}
//               <div>
//                 <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-1">
//                   <Users className="w-4 h-4 text-emerald-400" />
//                   Visitors
//                 </Label>

//                 <div className="flex gap-2 flex-wrap items-stretch">
//                   <Input
//                     type="number"
//                     min={0}
//                     value={visitors}
//                     onChange={(e) => setVisitors(num(e.target.value))}
//                     className="h-9 grow min-w-0 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="500"
//                   />
//                   <div className="w-full sm:w-auto">
//                     <select
//                       value={basis}
//                       onChange={(e) =>
//                         setBasis(e.target.value as "day" | "week" | "month")
//                       }
//                       className="h-9 w-full sm:w-[140px] rounded-md bg-white/5 border border-white/15 text-slate-100 px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
//                     >
//                       <option value="day">per day</option>
//                       <option value="week">per week</option>
//                       <option value="month">per month</option>
//                     </select>
//                   </div>
//                 </div>
//               </div>

//               {/* Avg visit / Adoption */}
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <div>
//                   <Label className="text-[11px] text-slate-300 mb-1 block">
//                     Avg visit (minutes)
//                   </Label>
//                   <Input
//                     type="number"
//                     min={1}
//                     value={avgMinutes}
//                     onChange={(e) => setAvgMinutes(num(e.target.value))}
//                     className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="30"
//                   />
//                 </div>

//                 <div>
//                   <Label className="text-[11px] text-slate-300 mb-1 block">
//                     % using Blueprint
//                   </Label>
//                   <Input
//                     type="number"
//                     min={0}
//                     max={100}
//                     value={adoptionPct}
//                     onChange={(e) => setAdoptionPct(num(e.target.value))}
//                     className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="10"
//                   />
//                 </div>
//               </div>
//             </div>

//             <Separator className="my-6 bg-white/10" />

//             {/* Results */}
//             <div className="space-y-3">
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-300">Estimated monthly hours</span>
//                 <span className="text-xl font-bold text-emerald-300">
//                   {estimatedMonthlyHours.toFixed(0)} hrs
//                 </span>
//               </div>
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-300">Estimated monthly cost</span>
//                 <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                   ${estimatedMonthlyCost.toFixed(0)}
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
// /** Main page ---------------------------------------------------------------- */
// export default function PricingPage() {
//   const exampleHourly =
//     BASE_RATE +
//     defaultCounts.image * RATES.image +
//     defaultCounts.video * RATES.video +
//     defaultCounts.audio * RATES.audio +
//     defaultCounts.model * RATES.model +
//     defaultCounts.webpage * RATES.webpage +
//     defaultCounts.text * RATES.text;

//   return (
//     <div className="min-h-screen bg-[#0B1220] text-slate-100">
//       <Nav />

//       {/* Decorative background */}
//       <div className="absolute inset-0 -z-10 opacity-30">
//         <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-cyan-300 to-emerald-300 rounded-full blur-3xl" />
//         <div className="absolute bottom-10 right-10 w-72 h-72 bg-gradient-to-r from-blue-300 to-teal-300 rounded-full blur-3xl" />
//       </div>

//       {/* Hero */}
//       <section className="max-w-7xl mx-auto pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-center">
//         <motion.h1
//           initial={{ opacity: 0, y: 12 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="text-5xl sm:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500"
//         >
//           One simple price. Add what you need.
//         </motion.h1>
//         <p className="mt-4 text-lg text-slate-300">
//           No tiers. No surprises. Pay a base price of{" "}
//           <span className="font-semibold text-emerald-300">$0.75/hr</span> for
//           usage and add content-based options as you go.
//         </p>

//         <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-4 py-2">
//           <Zap className="w-4 h-4 text-emerald-400" />
//           <span className="text-sm text-slate-200">
//             <strong>Cumulative example:</strong> 12 visitors × 10 minutes each =
//             2 hours
//             <span className="opacity-60 mx-1.5">→</span>
//             <span className="font-semibold">Total = 2 × your price/hr</span>
//             <span className="ml-2 text-slate-400">
//               (your price/hr = Base $0.75 + content add-ons)
//             </span>
//           </span>
//         </div>
//       </section>

//       {/* Pricing core */}
//       {/* Pricing core */}
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 items-start gap-8 md:gap-10">
//         {/* Card 1: Simple Pricing */}
//         <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//           <CardHeader className="pb-4">
//             <div className="flex items-center gap-2 text-emerald-300">
//               <Sparkles className="h-5 w-5" />
//               <span className="text-xs tracking-wide uppercase">Pricing</span>
//             </div>
//             <CardTitle className="text-white text-2xl">
//               Simple Pricing
//             </CardTitle>
//             <CardDescription className="text-slate-300">
//               Base price + content add-ons. Clear, cumulative, predictable.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             {/* Base price */}
//             <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div>
//                 <div className="text-xs text-slate-400">Base price</div>
//                 <div className="text-[11px] text-slate-400">
//                   Applies to every active hour
//                 </div>
//               </div>
//               <div className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${BASE_RATE.toFixed(2)}/hr
//               </div>
//             </div>

//             {/* Add-on pills */}
//             <div className="space-y-2">
//               <div className="text-xs text-slate-400">Add-ons (stacking)</div>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <ImageIcon className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Images</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.image.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Video className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Videos</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.video.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Music2 className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Audio</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.audio.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Box className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">3D Models</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.model.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Globe className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Webpages</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.webpage.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Type className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Text</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.text.toFixed(3)}/hr
//                   </Badge>
//                 </div>
//               </div>
//             </div>

//             {/* Explainer */}
//             <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-xs text-slate-300">
//               <div className="flex items-start gap-2">
//                 <InfoIcon className="h-4 w-4 mt-0.5 text-emerald-300" />
//                 <p>
//                   <span className="font-medium text-white">Cumulative:</span>{" "}
//                   price/hr = base + Σ(content count × rate).
//                 </p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Card 2: Concrete Example */}
//         <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//           <CardHeader className="pb-4">
//             <div className="flex items-center gap-2 text-emerald-300">
//               <Zap className="h-5 w-5" />
//               <span className="text-xs tracking-wide uppercase">Example</span>
//             </div>
//             <CardTitle className="text-white text-2xl">
//               Concrete Example
//             </CardTitle>
//             <CardDescription className="text-slate-300">
//               A typical 5,000&nbsp;ft² Blueprint content mix.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             {/* Example grid */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <ImageIcon className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Images</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.image} × ${RATES.image.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Video className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Videos</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.video} × ${RATES.video.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Music2 className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Audio</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.audio} × ${RATES.audio.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Box className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">3D Models</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.model} × ${RATES.model.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Globe className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Webpages</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.webpage} × ${RATES.webpage.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Type className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Text</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.text} × ${RATES.text.toFixed(3)}
//                 </Badge>
//               </div>
//             </div>

//             {/* Example total */}
//             {/* Example total */}
//             <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div>
//                 <div className="text-xs text-slate-400">
//                   Example price per hour
//                 </div>
//                 <div className="text-[11px] text-slate-400">
//                   Base ${BASE_RATE.toFixed(2)} + add-ons above
//                 </div>
//               </div>
//               <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${exampleHourly.toFixed(2)}/hr
//               </div>
//             </div>
//             {/* {(() => {
//               const exampleHourly =
//                 BASE_RATE +
//                 defaultCounts.image * RATES.image +
//                 defaultCounts.video * RATES.video +
//                 defaultCounts.audio * RATES.audio +
//                 defaultCounts.model * RATES.model +
//                 defaultCounts.webpage * RATES.webpage +
//                 defaultCounts.text * RATES.text;

//               return (
//                 <div className="flex items-end justify-between rounded-xl border border-white/10 bg-white/[0.06] p-4">
//                   <div>
//                     <div className="text-xs text-slate-400">
//                       Example price per hour
//                     </div>
//                     <div className="text-[11px] text-slate-400">
//                       Base ${BASE_RATE.toFixed(2)} + add-ons above
//                     </div>
//                   </div>
//                   <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                     ${exampleHourly.toFixed(2)}/hr
//                   </div>
//                 </div>
//               );
//             })()} */}
//           </CardContent>
//         </Card>

//         {/* Card 3: Usage Calculator (keeps your existing logic/component) */}
//         <div className="lg:col-span-1 xl:col-span-2">
//           <PricingCalculator />
//         </div>
//       </section>

//       {/* Extra: FAQs small block */}
//       <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 mb-20">
//         <div className="grid md:grid-cols-3 items-stretch gap-6 md:gap-8">
//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 What’s included in $0.75/hr?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Core runtime, hosting, and orchestration. You add content types
//               (images, video, 3D, etc.) and your price/hr adjusts automatically.
//             </CardContent>
//           </Card>

//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 Do add-ons stack?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Yes. If your space has 10 images and 2 videos, you pay base + (10
//               × image rate) + (2 × video rate) each active hour.
//             </CardContent>
//           </Card>

//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 Is there a team plan?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Teams are available as an optional add-on; talk to us if you need
//               seats & SSO. Your usage pricing stays the same.
//             </CardContent>
//           </Card>
//         </div>

//         <div className="mt-8 flex items-center justify-center">
//           <Button className="bg-emerald-600 hover:bg-emerald-700">
//             Get started
//             <ArrowRight className="w-4 h-4 ml-2" />
//           </Button>
//         </div>
//       </section>

//       <Footer />
//       <LindyChat />
//     </div>
//   );
// }

// import React, { useMemo, useState } from "react";
// import {
//   Calculator,
//   Sparkles,
//   Zap,
//   InfoIcon,
//   Users,
//   Image as ImageIcon,
//   Video,
//   Music2,
//   Box,
//   Globe,
//   Type,
//   ArrowRight,
// } from "lucide-react";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";
// import LindyChat from "@/components/LindyChat";
// import { motion } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";

// /**
//  * ---------------------------------------------------------------------------
//  * Pricing model (kept in one place so the Calculator and the “Rates” card share it)
//  * ---------------------------------------------------------------------------
//  * Base + content add-ons match your CostPanel:
//  */
// const BASE_RATE = 0.75 as const;
// const RATES = {
//   image: 0.005,
//   video: 0.05,
//   audio: 0.01,
//   model: 0.02,
//   webpage: 0.003,
//   text: 0.002,
// } as const;

// type Counts = {
//   image: number;
//   video: number;
//   audio: number;
//   model: number;
//   webpage: number;
//   text: number;
// };

// const defaultCounts: Counts = {
//   image: 20,
//   video: 2,
//   audio: 2,
//   model: 10,
//   webpage: 6,
//   text: 20,
// };

// /** Utility: price per hour for the current mix */
// function pricePerHour(counts: Counts) {
//   const addOns =
//     counts.image * RATES.image +
//     counts.video * RATES.video +
//     counts.audio * RATES.audio +
//     counts.model * RATES.model +
//     counts.webpage * RATES.webpage +
//     counts.text * RATES.text;
//   return BASE_RATE + addOns;
// }

// /** Small helper components -------------------------------------------------- */
// const RateRow = ({
//   icon,
//   label,
//   count,
//   rate,
// }: {
//   icon: React.ReactNode;
//   label: string;
//   count?: number;
//   rate: number;
// }) => (
//   <div className="flex items-center justify-between py-1">
//     <div className="flex items-center gap-2">
//       <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-emerald-300">
//         {icon}
//       </div>
//       <span className="text-sm text-slate-200">{label}</span>
//     </div>
//     <Badge variant="secondary" className="bg-white/10 text-slate-100">
//       +${rate.toFixed(3)}/hr{typeof count === "number" ? ` × ${count}` : ""}
//     </Badge>
//   </div>
// );

// /** Calculator block (content-mix + traffic quick-estimator) ----------------- */
// function PricingCalculator() {
//   const [counts, setCounts] = useState<Counts>(defaultCounts);

//   // quick traffic estimator (optional)
//   const [visitors, setVisitors] = useState<number>(400);
//   const [basis, setBasis] = useState<"day" | "week" | "month">("day");
//   const [avgMinutes, setAvgMinutes] = useState<number>(35);
//   const [adoptionPct, setAdoptionPct] = useState<number>(1);

//   const hourly = useMemo(() => pricePerHour(counts), [counts]);

//   const estimatedMonthlyHours = useMemo(() => {
//     let monthlyVisitors = visitors;
//     if (basis === "day") monthlyVisitors *= 30;
//     if (basis === "week") monthlyVisitors *= 4;
//     const totalMinutes = monthlyVisitors * avgMinutes;
//     const totalHours = totalMinutes / 60;
//     return Math.max(0, totalHours * (adoptionPct / 100));
//   }, [visitors, basis, avgMinutes, adoptionPct]);

//   const estimatedMonthlyCost = useMemo(
//     () => estimatedMonthlyHours * hourly,
//     [estimatedMonthlyHours, hourly],
//   );

//   const num = (v: unknown) => {
//     const n = Number(v);
//     return Number.isFinite(n) && n >= 0 ? n : 0;
//   };

//   return (
//     <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl overflow-visible">
//       <CardHeader className="pb-2">
//         <div className="flex items-center gap-2 text-emerald-300">
//           <Calculator className="h-5 w-5" />
//           <span className="text-xs uppercase tracking-wide">Calculator</span>
//         </div>
//         <CardTitle className="text-white text-2xl">Usage Calculator</CardTitle>
//         <CardDescription className="text-slate-300">
//           Build your{" "}
//           <span className="text-white/90 font-medium">price per hour</span> from
//           content types, then estimate a monthly bill from your traffic.
//         </CardDescription>
//       </CardHeader>

//       <CardContent className="pt-6">
//         {/* Responsive two-column layout with generous gaps and proper shrink/wrap behavior */}
//         <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-start gap-6 lg:gap-8">
//           {/* LEFT: Content mix */}
//           <div className="min-w-0">
//             <h4 className="text-slate-200 font-semibold mb-3">
//               Content in your Blueprint
//             </h4>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//               {(
//                 [
//                   [
//                     "image",
//                     "Images",
//                     <ImageIcon key="i" className="w-4 h-4" />,
//                   ],
//                   ["video", "Videos", <Video key="v" className="w-4 h-4" />],
//                   ["audio", "Audio", <Music2 key="a" className="w-4 h-4" />],
//                   ["model", "3D Models", <Box key="m" className="w-4 h-4" />],
//                   [
//                     "webpage",
//                     "Webpages",
//                     <Globe key="w" className="w-4 h-4" />,
//                   ],
//                   ["text", "Text", <Type key="t" className="w-4 h-4" />],
//                 ] as const
//               ).map(([key, label, icon]) => (
//                 <div
//                   key={key}
//                   className="rounded-xl bg-white/[0.06] border border-white/10 p-3 isolate"
//                 >
//                   <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-2">
//                     <span className="text-emerald-300">{icon}</span>
//                     {label}
//                   </Label>

//                   {/* Input grows and can shrink; badge never overlaps and can wrap on small screens */}
//                   <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
//                     <Input
//                       type="number"
//                       min={0}
//                       value={counts[key as keyof Counts]}
//                       onChange={(e) =>
//                         setCounts(
//                           (c) =>
//                             ({ ...c, [key]: num(e.target.value) }) as Counts,
//                         )
//                       }
//                       className="h-9 w-full min-w-0 flex-1 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                       placeholder="0"
//                     />
//                     <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0 whitespace-nowrap mt-2 sm:mt-0">
//                       +${RATES[key as keyof typeof RATES].toFixed(3)}/hr
//                     </Badge>
//                   </div>
//                 </div>
//               ))}
//             </div>

//             <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div className="text-xs text-slate-400">Your price per hour</div>
//               <div className="text-[11px] text-slate-500">
//                 Base ${BASE_RATE.toFixed(2)} + Σ(add-ons)
//               </div>
//               <div className="mt-1 text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${hourly.toFixed(2)}/hr
//               </div>
//             </div>
//           </div>

//           {/* RIGHT: Traffic estimator */}
//           <div className="min-w-0">
//             <h4 className="text-slate-200 font-semibold mb-3">
//               Traffic (optional)
//             </h4>

//             <div className="space-y-4">
//               {/* Visitors */}
//               <div>
//                 <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-1">
//                   <Users className="w-4 h-4 text-emerald-400" />
//                   Visitors
//                 </Label>

//                 <div className="flex gap-2 flex-wrap items-stretch">
//                   <Input
//                     type="number"
//                     min={0}
//                     value={visitors}
//                     onChange={(e) => setVisitors(num(e.target.value))}
//                     className="h-9 grow min-w-0 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="500"
//                   />
//                   <div className="w-full sm:w-auto">
//                     <select
//                       value={basis}
//                       onChange={(e) =>
//                         setBasis(e.target.value as "day" | "week" | "month")
//                       }
//                       className="h-9 w-full sm:w-[140px] rounded-md bg-white/5 border border-white/15 text-slate-100 px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
//                     >
//                       <option value="day">per day</option>
//                       <option value="week">per week</option>
//                       <option value="month">per month</option>
//                     </select>
//                   </div>
//                 </div>
//               </div>

//               {/* Avg visit / Adoption */}
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <div>
//                   <Label className="text-[11px] text-slate-300 mb-1 block">
//                     Avg visit (minutes)
//                   </Label>
//                   <Input
//                     type="number"
//                     min={1}
//                     value={avgMinutes}
//                     onChange={(e) => setAvgMinutes(num(e.target.value))}
//                     className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="30"
//                   />
//                 </div>

//                 <div>
//                   <Label className="text-[11px] text-slate-300 mb-1 block">
//                     % using Blueprint
//                   </Label>
//                   <Input
//                     type="number"
//                     min={0}
//                     max={100}
//                     value={adoptionPct}
//                     onChange={(e) => setAdoptionPct(num(e.target.value))}
//                     className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="10"
//                   />
//                 </div>
//               </div>
//             </div>

//             <Separator className="my-6 bg-white/10" />

//             {/* Results */}
//             <div className="space-y-3">
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-300">Estimated monthly hours</span>
//                 <span className="text-xl font-bold text-emerald-300">
//                   {estimatedMonthlyHours.toFixed(0)} hrs
//                 </span>
//               </div>
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-300">Estimated monthly cost</span>
//                 <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                   ${estimatedMonthlyCost.toFixed(0)}
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
// /** Main page ---------------------------------------------------------------- */
// export default function PricingPage() {
//   const exampleHourly =
//     BASE_RATE +
//     defaultCounts.image * RATES.image +
//     defaultCounts.video * RATES.video +
//     defaultCounts.audio * RATES.audio +
//     defaultCounts.model * RATES.model +
//     defaultCounts.webpage * RATES.webpage +
//     defaultCounts.text * RATES.text;

//   return (
//     <div className="min-h-screen bg-[#0B1220] text-slate-100">
//       <Nav />

//       {/* Decorative background */}
//       <div className="absolute inset-0 -z-10 opacity-30">
//         <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-cyan-300 to-emerald-300 rounded-full blur-3xl" />
//         <div className="absolute bottom-10 right-10 w-72 h-72 bg-gradient-to-r from-blue-300 to-teal-300 rounded-full blur-3xl" />
//       </div>

//       {/* Hero */}
//       <section className="max-w-7xl mx-auto pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-center">
//         <motion.h1
//           initial={{ opacity: 0, y: 12 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="text-5xl sm:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500"
//         >
//           One simple price. Add what you need.
//         </motion.h1>
//         <p className="mt-4 text-lg text-slate-300">
//           No tiers. No surprises. Pay a base price of{" "}
//           <span className="font-semibold text-emerald-300">$0.75/hr</span> for
//           usage and add content-based options as you go.
//         </p>

//         <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-4 py-2">
//           <Zap className="w-4 h-4 text-emerald-400" />
//           <span className="text-sm text-slate-200">
//             <strong>Cumulative example:</strong> 12 visitors × 10 minutes each =
//             2 hours
//             <span className="opacity-60 mx-1.5">→</span>
//             <span className="font-semibold">Total = 2 × your price/hr</span>
//             <span className="ml-2 text-slate-400">
//               (your price/hr = Base $0.75 + content add-ons)
//             </span>
//           </span>
//         </div>
//       </section>

//       {/* Pricing core */}
//       {/* Pricing core */}
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 items-start gap-8 md:gap-10">
//         {/* Card 1: Simple Pricing */}
//         <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//           <CardHeader className="pb-4">
//             <div className="flex items-center gap-2 text-emerald-300">
//               <Sparkles className="h-5 w-5" />
//               <span className="text-xs tracking-wide uppercase">Pricing</span>
//             </div>
//             <CardTitle className="text-white text-2xl">
//               Simple Pricing
//             </CardTitle>
//             <CardDescription className="text-slate-300">
//               Base price + content add-ons. Clear, cumulative, predictable.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             {/* Base price */}
//             <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div>
//                 <div className="text-xs text-slate-400">Base price</div>
//                 <div className="text-[11px] text-slate-400">
//                   Applies to every active hour
//                 </div>
//               </div>
//               <div className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${BASE_RATE.toFixed(2)}/hr
//               </div>
//             </div>

//             {/* Add-on pills */}
//             <div className="space-y-2">
//               <div className="text-xs text-slate-400">Add-ons (stacking)</div>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <ImageIcon className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Images</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.image.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Video className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Videos</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.video.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Music2 className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Audio</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.audio.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Box className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">3D Models</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.model.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Globe className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Webpages</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.webpage.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Type className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Text</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.text.toFixed(3)}/hr
//                   </Badge>
//                 </div>
//               </div>
//             </div>

//             {/* Explainer */}
//             <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-xs text-slate-300">
//               <div className="flex items-start gap-2">
//                 <InfoIcon className="h-4 w-4 mt-0.5 text-emerald-300" />
//                 <p>
//                   <span className="font-medium text-white">Cumulative:</span>{" "}
//                   price/hr = base + Σ(content count × rate).
//                 </p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Card 2: Concrete Example */}
//         <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//           <CardHeader className="pb-4">
//             <div className="flex items-center gap-2 text-emerald-300">
//               <Zap className="h-5 w-5" />
//               <span className="text-xs tracking-wide uppercase">Example</span>
//             </div>
//             <CardTitle className="text-white text-2xl">
//               Concrete Example
//             </CardTitle>
//             <CardDescription className="text-slate-300">
//               A typical 5,000&nbsp;ft² Blueprint content mix.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             {/* Example grid */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <ImageIcon className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Images</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.image} × ${RATES.image.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Video className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Videos</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.video} × ${RATES.video.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Music2 className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Audio</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.audio} × ${RATES.audio.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Box className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">3D Models</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.model} × ${RATES.model.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Globe className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Webpages</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.webpage} × ${RATES.webpage.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Type className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Text</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.text} × ${RATES.text.toFixed(3)}
//                 </Badge>
//               </div>
//             </div>

//             {/* Example total */}
//             {/* Example total */}
//             <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div>
//                 <div className="text-xs text-slate-400">
//                   Example price per hour
//                 </div>
//                 <div className="text-[11px] text-slate-400">
//                   Base ${BASE_RATE.toFixed(2)} + add-ons above
//                 </div>
//               </div>
//               <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${exampleHourly.toFixed(2)}/hr
//               </div>
//             </div>
//             {/* {(() => {
//               const exampleHourly =
//                 BASE_RATE +
//                 defaultCounts.image * RATES.image +
//                 defaultCounts.video * RATES.video +
//                 defaultCounts.audio * RATES.audio +
//                 defaultCounts.model * RATES.model +
//                 defaultCounts.webpage * RATES.webpage +
//                 defaultCounts.text * RATES.text;

//               return (
//                 <div className="flex items-end justify-between rounded-xl border border-white/10 bg-white/[0.06] p-4">
//                   <div>
//                     <div className="text-xs text-slate-400">
//                       Example price per hour
//                     </div>
//                     <div className="text-[11px] text-slate-400">
//                       Base ${BASE_RATE.toFixed(2)} + add-ons above
//                     </div>
//                   </div>
//                   <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                     ${exampleHourly.toFixed(2)}/hr
//                   </div>
//                 </div>
//               );
//             })()} */}
//           </CardContent>
//         </Card>

//         {/* Card 3: Usage Calculator (keeps your existing logic/component) */}
//         <div className="lg:col-span-1 xl:col-span-2">
//           <PricingCalculator />
//         </div>
//       </section>

//       {/* Extra: FAQs small block */}
//       <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 mb-20">
//         <div className="grid md:grid-cols-3 items-stretch gap-6 md:gap-8">
//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 What’s included in $0.75/hr?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Core runtime, hosting, and orchestration. You add content types
//               (images, video, 3D, etc.) and your price/hr adjusts automatically.
//             </CardContent>
//           </Card>

//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 Do add-ons stack?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Yes. If your space has 10 images and 2 videos, you pay base + (10
//               × image rate) + (2 × video rate) each active hour.
//             </CardContent>
//           </Card>

//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 Is there a team plan?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Teams are available as an optional add-on; talk to us if you need
//               seats & SSO. Your usage pricing stays the same.
//             </CardContent>
//           </Card>
//         </div>

//         <div className="mt-8 flex items-center justify-center">
//           <Button className="bg-emerald-600 hover:bg-emerald-700">
//             Get started
//             <ArrowRight className="w-4 h-4 ml-2" />
//           </Button>
//         </div>
//       </section>

//       <Footer />
//       <LindyChat />
//     </div>
//   );
// }

// import React, { useMemo, useState } from "react";
// import {
//   Calculator,
//   Sparkles,
//   Zap,
//   InfoIcon,
//   Users,
//   Image as ImageIcon,
//   Video,
//   Music2,
//   Box,
//   Globe,
//   Type,
//   ArrowRight,
//   Clock,
//   Building2,
//   Cpu,
//   Scan,
//   TabletSmartphone,
//   Clock3,
//   UserCheck,
//   QrCode,
//   Cloud,
//   Globe2,
//   Rocket,
//   RefreshCcw,
//   Wrench,
//   ShieldAlert,
//   PiggyBank,
// } from "lucide-react";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";
// import LindyChat from "@/components/LindyChat";
// import { motion } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";

// /* ----------------------------- Shared Pricing ----------------------------- */

// const BASE_RATE = 0.75 as const;
// const RATES = {
//   image: 0.005,
//   video: 0.05,
//   audio: 0.01,
//   model: 0.02,
//   webpage: 0.003,
//   text: 0.002,
// } as const;

// type Counts = {
//   image: number;
//   video: number;
//   audio: number;
//   model: number;
//   webpage: number;
//   text: number;
// };

// const defaultCounts: Counts = {
//   image: 20,
//   video: 2,
//   audio: 4,
//   model: 10,
//   webpage: 6,
//   text: 20,
// };

// type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

// type ContrastRow = {
//   label: string;
//   subLabel?: string;
//   diy: string;
//   blueprint: string;
//   icon: IconType;
// };

// const contrastRows: ContrastRow[] = [
//   {
//     label: "Upfront platform build",
//     subLabel: "Authoring/CMS, localization integration, deployment, analytics",
//     diy: "$300k–$1.5M once, 4–9 months to MVP (team of 3–6 engineers/designers). Benchmarked from typical app/SaaS builds + AR complexity.",
//     blueprint:
//       "$0 platform build. Subscribe + configure. (Insert your Blueprint plan price here.)",
//     icon: Building2,
//   },
//   {
//     label: "Engine/tool seats",
//     diy: "Unity Pro: $2,200/seat/yr × (# devs).",
//     blueprint:
//       "Often not required if Blueprint is no-code/low-code. If advanced custom dev, budget 1–2 Unity seats.",
//     icon: Cpu,
//   },
//   {
//     label: "Scanning software",
//     diy: "Polycam Pro ~$17/mo per mapper; or just RoomPlan API (no fee).",
//     blueprint:
//       "Same device apps; Blueprint can guide self-scan. (Assume 0–$17/mo per active mapper.)",
//     icon: Scan,
//   },
//   {
//     label: "Mapper hardware (LiDAR)",
//     diy: "$999 iPad Pro per field kit (plus case/charger).",
//     blueprint:
//       "Same device; you can shift to self-scan by the location (zero mapper CAPEX if BYOD is allowed).",
//     icon: TabletSmartphone,
//   },
//   {
//     label: "Per-location mapping time",
//     diy: "~30–90 min on site (one pass) + admin/upload. RoomPlan suggests ~5 min per room; Lightship activation requires ≥10 viable scans (often 1–2 visits for public locations).",
//     blueprint:
//       "15–45 min self-scan guided flow; Blueprint automates processing & anchor setup. (If Niantic VPS public activation is needed, still expect the ≥10-scan rule.)",
//     icon: Clock3,
//   },
//   {
//     label: "Per-location labor",
//     diy: "Mapper 1.5–3.0 hrs × $23–$27/hr = $35–$80; designer 8–20 hrs × $25–$70/hr = $200–$1,400.",
//     blueprint:
//       "Mapper: 0–1 hr (self-serve); designer: 2–8 hrs if templated. Net $0–$600 depending on how much is automated/templated.",
//     icon: UserCheck,
//   },
//   {
//     label: "QR/marker printing (optional)",
//     diy: "$25–$230 per location (e.g., 100 stickers ≈ $73; 1,000 ≈ $232).",
//     blueprint:
//       "Same physicals. Blueprint can standardize artwork & quantities to cut waste.",
//     icon: QrCode,
//   },
//   {
//     label: "Cloud egress + storage (per location)",
//     diy: "Example: 50 MB initial asset load × 1,000 sessions/mo = 50 GB → ≈$4.25/mo egress; storage ≤$1/mo for small bundles. (Scale linearly).",
//     blueprint:
//       "Same underlying costs (Blueprint usually uses a CDN too). Some plans may bundle hosting; if not, expect comparable egress/storage.",
//     icon: Cloud,
//   },
//   {
//     label: "VPS/Geospatial usage",
//     diy: "Lightship VPS: first 10k calls free, then $10 per 1k (to 100k), $8 per 1k (100–500k). ARCore Geospatial: no usage pricing published; quotas apply.",
//     blueprint:
//       "Same physics. Blueprint may help reduce calls/session (better caching/local relocalization). Still budget per the Lightship tiers.",
//     icon: Globe2,
//   },
//   {
//     label: "Time to first location live",
//     diy: "6–12+ weeks (build + content + QA) if starting from zero. Agency ranges for AR MVPs are often $30k–$150k over 2–4 months.",
//     blueprint:
//       "<24 hours typical for first site (subscribe → scan → place content) once your templates are ready.",
//     icon: Rocket,
//   },
//   {
//     label: "Time to additional locations",
//     diy: "3–7 days each (scheduling mapper, scans, content, QA).",
//     blueprint: "Same day if self-scan + templated scenes.",
//     icon: RefreshCcw,
//   },
//   {
//     label: "Ongoing maintenance",
//     diy: "8–20 hrs/mo per venue (content swaps, analytics checks, re-scans after layout changes).",
//     blueprint:
//       "2–6 hrs/mo per venue (templated campaigns + centralized analytics), plus occasional re-scan after big resets.",
//     icon: Wrench,
//   },
//   {
//     label: "Risk & dependencies",
//     diy: "You own everything; higher engineering/ops burden; must track vendor changes (e.g., Unity pricing; Lightship quotas).",
//     blueprint:
//       "Vendor handles most plumbing; you trade CAPEX for OPEX; portability via open formats/anchors still recommended.",
//     icon: ShieldAlert,
//   },
// ];

// const tldrHighlights: { label: string; diy: string; blueprint: string }[] = [
//   {
//     label: "One-time platform build",
//     diy: "$300k–$1.5M; 4–9 mo",
//     blueprint: "$0 (subscribe)",
//   },
//   {
//     label: "Per-location labor",
//     diy: "$235–$1,480 (mapper + designer)",
//     blueprint: "$0–$600 (self-scan + template)",
//   },
//   {
//     label: "VPS per 100k sessions/mo",
//     diy: "≈$900/mo (Lightship after free 10k)",
//     blueprint: "Same underlying VPS unless bundled",
//   },
//   {
//     label: "CDN egress per 100k sessions @ 40 MB",
//     diy: "≈$340/mo",
//     blueprint: "Similar (unless bundled)",
//   },
//   {
//     label: "Tool seats",
//     diy: "Unity Pro $2,200/seat/yr",
//     blueprint: "Often none (no-code); add if custom dev",
//   },
//   {
//     label: "Scanner hardware",
//     diy: "$999 per kit",
//     blueprint: "Same (or BYOD if self-scan)",
//   },
//   {
//     label: "Time to first site live",
//     diy: "6–12+ weeks",
//     blueprint: "<24 hours",
//   },
//   {
//     label: "Time per additional site",
//     diy: "3–7 days",
//     blueprint: "Same day–2 days",
//   },
// ];

// const takeaways = [
//   "VPS, CDN, and labor dominate the per-location TCO. VPS has a generous free tier; CDN egress is cheap at pilot scale; labor is the real swing factor.",
//   "DIY shines if you already have a team (Unity + backend + 3D) and want control; otherwise you’re taking on $300k–$1.5M of platform build risk and months of time.",
//   "Blueprint removes the platform CAPEX and cuts per-site hours (self-scan + templates), making multi-location rollouts more predictable. You still budget for VPS calls and egress (or whatever Blueprint includes/abstracts).",
// ];

// const scenarioData: { name: string; subtitle: string; bullets: string[] }[] = [
//   {
//     name: "Scenario A — Small pilot",
//     subtitle: "3 stores, 1,000 sessions/store/month, 50 MB initial asset load.",
//     bullets: [
//       "VPS: 3,000 calls/mo → $0 (under 10k free).",
//       "CDN egress: 3,000 × 50 MB = 150 GB → ≈$12.75/mo.",
//       "Storage: ~1.5 GB total → ≈$0.03/mo.",
//       "QRs: 300 stickers total → ≈$219 one-time.",
//       "Labor (DIY): mapper ~2 h/site; designer ~10 h/site → ~$1,650 total using the midpoints above.",
//       "Blueprint: if self-scan + templates, the per-site labor often drops to ~$200–$600 (mostly design polish). (Substitute your Blueprint subscription here.)",
//     ],
//   },
//   {
//     name: "Scenario B — Heavier usage",
//     subtitle: "10 stores, 10,000 sessions/store/month; 40 MB cached load.",
//     bullets: [
//       "VPS: 100k calls/mo → first 10k free; 90k × $10/1k ≈ $900/mo (if all sessions call VPS once).",
//       "CDN egress: 100k × 40 MB = 4,000 GB → ≈$340/mo.",
//       "Storage: ~10 GB total → ≈$0.23/mo.",
//       "Labor: DIY scales with venues (coordinating mappers, QA); Blueprint’s self-serve + templates tend to cap per-site hours.",
//     ],
//   },
// ];

// function pricePerHour(counts: Counts) {
//   const addOns =
//     counts.image * RATES.image +
//     counts.video * RATES.video +
//     counts.audio * RATES.audio +
//     counts.model * RATES.model +
//     counts.webpage * RATES.webpage +
//     counts.text * RATES.text;
//   return BASE_RATE + addOns;
// }

// /* ------------------------------ Hero + Slider ----------------------------- */

// const INCLUDED_HOURS = 40;
// const MIN_HOURS = 40;
// const MAX_HOURS = 2500;

// function formatUSD(n: number) {
//   return n.toLocaleString(undefined, {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   });
// }

// function clamp(n: number, lo: number, hi: number) {
//   return Math.min(hi, Math.max(lo, n));
// }

// function PriceHero({
//   hours,
//   setHours,
//   hourly,
//   baseMonthly = 49.99,
// }: {
//   hours: number;
//   setHours: (n: number) => void;
//   hourly: number;
//   baseMonthly?: number;
// }) {
//   const monthly = useMemo(() => {
//     const overage = Math.max(0, hours - INCLUDED_HOURS) * hourly;
//     return baseMonthly + overage;
//   }, [hours, hourly, baseMonthly]);

//   const pct = (hours - MIN_HOURS) / (MAX_HOURS - MIN_HOURS);

//   return (
//     <section className="max-w-6xl mx-auto pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-center">
//       <motion.h1
//         initial={{ opacity: 0, y: 12 }}
//         animate={{ opacity: 1, y: 0 }}
//         className="text-5xl sm:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500"
//       >
//         Pay only for the hours you use
//       </motion.h1>

//       <p className="mt-4 text-lg text-slate-300 flex items-center justify-center gap-2">
//         Start with a flat monthly rate that includes{" "}
//         <span className="font-semibold text-emerald-300">
//           {INCLUDED_HOURS} hours
//         </span>
//         .
//         <span
//           className="inline-flex items-center gap-1 text-slate-400"
//           title="After included hours, pay a simple hourly rate that reflects your content mix."
//         >
//           <InfoIcon className="w-4 h-4" />
//         </span>
//       </p>

//       {/* Price pill */}
//       <div className="mt-8 flex items-center justify-center">
//         <div className="relative rounded-3xl border border-white/15 bg-white/[0.04] backdrop-blur-sm px-8 py-6 shadow-2xl">
//           <div className="text-sm uppercase tracking-wider text-slate-400">
//             Estimated monthly
//           </div>
//           <div className="mt-1 flex items-baseline justify-center gap-1">
//             <span className="text-4xl sm:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//               ${formatUSD(monthly)}
//             </span>
//           </div>
//           <div className="mt-2 text-xs text-slate-400">
//             Base ${formatUSD(baseMonthly)} +{" "}
//             {hours - INCLUDED_HOURS < 0 ? 0 : hours - INCLUDED_HOURS} hr × $
//             {hourly.toFixed(2)}
//           </div>
//         </div>
//       </div>

//       {/* Slider */}
//       <div className="mt-10 relative max-w-3xl mx-auto">
//         {/* bubble */}
//         <div
//           className="absolute -top-8 translate-x-[-50%] rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs text-slate-100 shadow"
//           style={{ left: `calc(${pct * 100}% )` }}
//         >
//           {hours.toLocaleString()} hours
//         </div>

//         <div className="flex items-center gap-4">
//           <div className="text-xs text-slate-400">
//             {MIN_HOURS.toLocaleString()}
//           </div>
//           <input
//             type="range"
//             min={MIN_HOURS}
//             max={MAX_HOURS}
//             step={10}
//             value={hours}
//             onChange={(e) =>
//               setHours(
//                 clamp(
//                   parseInt(e.target.value || "0", 10),
//                   MIN_HOURS,
//                   MAX_HOURS,
//                 ),
//               )
//             }
//             className="w-full h-2 appearance-none bg-white/10 rounded-full outline-none cursor-pointer"
//           />
//           <div className="text-xs text-slate-400">
//             {MAX_HOURS.toLocaleString()}
//           </div>
//         </div>

//         <div className="mt-3 text-sm text-slate-400">
//           This pricing scales as your deployments do. No surprises — just usage.
//         </div>

//         {/* Range thumb/track styles */}
//         <style>{`
//           input[type="range"] { background: linear-gradient(90deg, rgba(52,211,153,0.9), rgba(34,211,238,0.9)) 0/0% 100% no-repeat, rgba(255,255,255,0.08); }
//           input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; height: 22px; width: 22px; border-radius: 9999px; background: white; border: 2px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
//           input[type="range"]::-moz-range-thumb { height: 22px; width: 22px; border-radius: 9999px; background: white; border: 2px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
//         `}</style>
//       </div>

//       {/* Hourly callout */}
//       <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-4 py-2">
//         <Clock className="w-4 h-4 text-emerald-400" />
//         <span className="text-sm text-slate-200">
//           Current <span className="font-semibold">price/hr</span> ={" "}
//           <span className="font-semibold text-emerald-300">
//             ${hourly.toFixed(2)}
//           </span>{" "}
//           (base ${BASE_RATE.toFixed(2)} + content add-ons)
//         </span>
//       </div>
//     </section>
//   );
// }

// /* ----------------------------- Calculator Card ---------------------------- */

// const RateRow = ({
//   icon,
//   label,
//   count,
//   rate,
// }: {
//   icon: React.ReactNode;
//   label: string;
//   count?: number;
//   rate: number;
// }) => (
//   <div className="flex items-center justify-between py-1">
//     <div className="flex items-center gap-2">
//       <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-emerald-300">
//         {icon}
//       </div>
//       <span className="text-sm text-slate-200">{label}</span>
//     </div>
//     <Badge variant="secondary" className="bg-white/10 text-slate-100">
//       +${rate.toFixed(3)}/hr{typeof count === "number" ? ` × ${count}` : ""}
//     </Badge>
//   </div>
// );

// function PricingCalculator({
//   counts,
//   setCounts,
//   hourly,
// }: {
//   counts: Counts;
//   setCounts: React.Dispatch<React.SetStateAction<Counts>>;
//   hourly: number;
// }) {
//   const [visitors, setVisitors] = useState<number>(400);
//   const [basis, setBasis] = useState<"day" | "week" | "month">("day");
//   const [avgMinutes, setAvgMinutes] = useState<number>(35);
//   const [adoptionPct, setAdoptionPct] = useState<number>(1);

//   const estimatedMonthlyHours = useMemo(() => {
//     let monthlyVisitors = visitors;
//     if (basis === "day") monthlyVisitors *= 30;
//     if (basis === "week") monthlyVisitors *= 4;
//     const totalMinutes = monthlyVisitors * avgMinutes;
//     const totalHours = totalMinutes / 60;
//     return Math.max(0, totalHours * (adoptionPct / 100));
//   }, [visitors, basis, avgMinutes, adoptionPct]);

//   const estimatedMonthlyCost = useMemo(
//     () => estimatedMonthlyHours * hourly,
//     [estimatedMonthlyHours, hourly],
//   );

//   const num = (v: unknown) => {
//     const n = Number(v);
//     return Number.isFinite(n) && n >= 0 ? n : 0;
//   };

//   return (
//     <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl overflow-visible">
//       <CardHeader className="pb-2">
//         <div className="flex items-center gap-2 text-emerald-300">
//           <Calculator className="h-5 w-5" />
//           <span className="text-xs uppercase tracking-wide">Calculator</span>
//         </div>
//         <CardTitle className="text-white text-2xl">Usage Calculator</CardTitle>
//         <CardDescription className="text-slate-300">
//           Tune your{" "}
//           <span className="text-white/90 font-medium">price per hour</span> by
//           content type, then estimate a monthly bill from your traffic.
//         </CardDescription>
//       </CardHeader>

//       <CardContent className="pt-6">
//         <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-start gap-6 lg:gap-8">
//           {/* LEFT: Content mix */}
//           <div className="min-w-0">
//             <h4 className="text-slate-200 font-semibold mb-3">
//               Content in your Blueprint
//             </h4>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//               {(
//                 [
//                   [
//                     "image",
//                     "Images",
//                     <ImageIcon key="i" className="w-4 h-4" />,
//                   ],
//                   ["video", "Videos", <Video key="v" className="w-4 h-4" />],
//                   ["audio", "Audio", <Music2 key="a" className="w-4 h-4" />],
//                   ["model", "3D Models", <Box key="m" className="w-4 h-4" />],
//                   [
//                     "webpage",
//                     "Webpages",
//                     <Globe key="w" className="w-4 h-4" />,
//                   ],
//                   ["text", "Text", <Type key="t" className="w-4 h-4" />],
//                 ] as const
//               ).map(([key, label, icon]) => (
//                 <div
//                   key={key}
//                   className="rounded-xl bg-white/[0.06] border border-white/10 p-3 isolate"
//                 >
//                   <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-2">
//                     <span className="text-emerald-300">{icon}</span>
//                     {label}
//                   </Label>

//                   <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
//                     <Input
//                       type="number"
//                       min={0}
//                       value={counts[key as keyof Counts]}
//                       onChange={(e) =>
//                         setCounts(
//                           (c) =>
//                             ({ ...c, [key]: num(e.target.value) }) as Counts,
//                         )
//                       }
//                       className="h-9 w-full min-w-0 flex-1 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                       placeholder="0"
//                     />
//                     <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0 whitespace-nowrap mt-2 sm:mt-0">
//                       +${RATES[key as keyof typeof RATES].toFixed(3)}/hr
//                     </Badge>
//                   </div>
//                 </div>
//               ))}
//             </div>

//             <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div className="text-xs text-slate-400">Your price per hour</div>
//               <div className="text-[11px] text-slate-500">
//                 Base ${BASE_RATE.toFixed(2)} + Σ(add-ons)
//               </div>
//               <div className="mt-1 text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${hourly.toFixed(2)}/hr
//               </div>
//             </div>
//           </div>

//           {/* RIGHT: Traffic estimator */}
//           <div className="min-w-0">
//             <h4 className="text-slate-200 font-semibold mb-3">
//               Traffic (optional)
//             </h4>

//             <div className="space-y-4">
//               <div>
//                 <Label className="text-[11px] text-slate-300 flex items-center gap-2 mb-1">
//                   <Users className="w-4 h-4 text-emerald-400" />
//                   Visitors
//                 </Label>

//                 <div className="flex gap-2 flex-wrap items-stretch">
//                   <Input
//                     type="number"
//                     min={0}
//                     value={visitors}
//                     onChange={(e) => setVisitors(num(e.target.value))}
//                     className="h-9 grow min-w-0 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="500"
//                   />
//                   <div className="w-full sm:w-auto">
//                     <select
//                       value={basis}
//                       onChange={(e) =>
//                         setBasis(e.target.value as "day" | "week" | "month")
//                       }
//                       className="h-9 w-full sm:w-[140px] rounded-md bg-white/5 border border-white/15 text-slate-100 px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
//                     >
//                       <option value="day">per day</option>
//                       <option value="week">per week</option>
//                       <option value="month">per month</option>
//                     </select>
//                   </div>
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <div>
//                   <Label className="text-[11px] text-slate-300 mb-1 block">
//                     Avg visit (minutes)
//                   </Label>
//                   <Input
//                     type="number"
//                     min={1}
//                     value={avgMinutes}
//                     onChange={(e) => setAvgMinutes(num(e.target.value))}
//                     className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="30"
//                   />
//                 </div>

//                 <div>
//                   <Label className="text-[11px] text-slate-300 mb-1 block">
//                     % using Blueprint
//                   </Label>
//                   <Input
//                     type="number"
//                     min={0}
//                     max={100}
//                     value={adoptionPct}
//                     onChange={(e) => setAdoptionPct(num(e.target.value))}
//                     className="h-9 w-full bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
//                     placeholder="10"
//                   />
//                 </div>
//               </div>
//             </div>

//             <Separator className="my-6 bg-white/10" />

//             <div className="space-y-3">
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-300">Estimated monthly hours</span>
//                 <span className="text-xl font-bold text-emerald-300">
//                   {estimatedMonthlyHours.toFixed(0)} hrs
//                 </span>
//               </div>
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-300">Estimated monthly cost</span>
//                 <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                   ${estimatedMonthlyCost.toFixed(0)}
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// /* --------------------------------- Page ---------------------------------- */

// export default function PricingPage() {
//   const [counts, setCounts] = useState<Counts>(defaultCounts);
//   const hourly = useMemo(() => pricePerHour(counts), [counts]);
//   const [hours, setHours] = useState<number>(MIN_HOURS);

//   const exampleHourly =
//     BASE_RATE +
//     defaultCounts.image * RATES.image +
//     defaultCounts.video * RATES.video +
//     defaultCounts.audio * RATES.audio +
//     defaultCounts.model * RATES.model +
//     defaultCounts.webpage * RATES.webpage +
//     defaultCounts.text * RATES.text;

//   return (
//     <div className="min-h-screen bg-[#0B1220] text-slate-100">
//       <Nav />

//       {/* Decorative background */}
//       <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
//         <div
//           className="absolute inset-0 opacity-[0.08]"
//           style={{
//             background:
//               "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
//             backgroundSize: "32px 32px",
//           }}
//         />
//         <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
//       </div>

//       {/* Hero with slider (Cofounder-style, Blueprint colors) */}
//       <PriceHero hours={hours} setHours={setHours} hourly={hourly} />

//       {/* Three-column core + calculator */}
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 items-start gap-8 md:gap-10">
//         {/* Card 1: Simple Pricing */}
//         <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//           <CardHeader className="pb-4">
//             <div className="flex items-center gap-2 text-emerald-300">
//               <Sparkles className="h-5 w-5" />
//               <span className="text-xs tracking-wide uppercase">Pricing</span>
//             </div>
//             <CardTitle className="text-white text-2xl">
//               Simple Pricing
//             </CardTitle>
//             <CardDescription className="text-slate-300">
//               Base price + content add-ons. Clear, cumulative, predictable.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div>
//                 <div className="text-xs text-slate-400">Base price</div>
//                 <div className="text-[11px] text-slate-400">
//                   Applies to every active hour
//                 </div>
//               </div>
//               <div className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${BASE_RATE.toFixed(2)}/hr
//               </div>
//             </div>

//             <div className="space-y-2">
//               <div className="text-xs text-slate-400">Add-ons (stacking)</div>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <ImageIcon className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Images</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.image.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Video className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Videos</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.video.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Music2 className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Audio</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.audio.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Box className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">3D Models</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.model.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Globe className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Webpages</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.webpage.toFixed(3)}/hr
//                   </Badge>
//                 </div>

//                 <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                   <div className="flex items-center gap-2">
//                     <Type className="h-4 w-4 text-emerald-300" />
//                     <span className="text-sm text-white">Text</span>
//                   </div>
//                   <Badge className="bg-white/10 text-slate-100 shrink-0">
//                     +${RATES.text.toFixed(3)}/hr
//                   </Badge>
//                 </div>
//               </div>
//             </div>

//             <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-xs text-slate-300">
//               <div className="flex items-start gap-2">
//                 <InfoIcon className="h-4 w-4 mt-0.5 text-emerald-300" />
//                 <p>
//                   <span className="font-medium text-white">Cumulative:</span>{" "}
//                   price/hr = base + Σ(content count × rate).
//                 </p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Card 2: Concrete Example */}
//         <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//           <CardHeader className="pb-4">
//             <div className="flex items-center gap-2 text-emerald-300">
//               <Zap className="h-5 w-5" />
//               <span className="text-xs tracking-wide uppercase">Example</span>
//             </div>
//             <CardTitle className="text-white text-2xl">
//               Concrete Example
//             </CardTitle>
//             <CardDescription className="text-slate-300">
//               A typical 5,000&nbsp;ft² Blueprint content mix.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <ImageIcon className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Images</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.image} × ${RATES.image.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Video className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Videos</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.video} × ${RATES.video.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Music2 className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Audio</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.audio} × ${RATES.audio.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Box className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">3D Models</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.model} × ${RATES.model.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Globe className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Webpages</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.webpage} × ${RATES.webpage.toFixed(3)}
//                 </Badge>
//               </div>

//               <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
//                 <div className="flex items-center gap-2">
//                   <Type className="h-4 w-4 text-emerald-300" />
//                   <span className="text-sm text-white">Text</span>
//                 </div>
//                 <Badge className="bg-white/10 text-slate-100 shrink-0">
//                   {defaultCounts.text} × ${RATES.text.toFixed(3)}
//                 </Badge>
//               </div>
//             </div>

//             <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
//               <div>
//                 <div className="text-xs text-slate-400">
//                   Example price per hour
//                 </div>
//                 <div className="text-[11px] text-slate-400">
//                   Base ${BASE_RATE.toFixed(2)} + add-ons above
//                 </div>
//               </div>
//               <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
//                 ${exampleHourly.toFixed(2)}/hr
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Card 3: Usage Calculator */}
//         <div className="lg:col-span-1 xl:col-span-2">
//           <PricingCalculator
//             counts={counts}
//             setCounts={setCounts}
//             hourly={hourly}
//           />
//         </div>
//       </section>

//       {/* FAQs */}
//       <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 mb-20">
//         <div className="grid md:grid-cols-3 items-stretch gap-6 md:gap-8">
//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 What’s included in $0.75/hr?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Core runtime, hosting, and orchestration. You add content types
//               (images, video, 3D, etc.) and your price/hr adjusts automatically.
//             </CardContent>
//           </Card>

//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 Do add-ons stack?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Yes. If your space has 10 images and 2 videos, you pay base + (10
//               × image rate) + (2 × video rate) each active hour.
//             </CardContent>
//           </Card>

//           <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-white text-lg">
//                 Is there a team plan?
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="text-sm text-slate-300">
//               Teams are available as an optional add-on; talk to us if you need
//               seats &amp; SSO. Your usage pricing stays the same.
//             </CardContent>
//           </Card>
//         </div>

//         <div className="mt-8 flex items-center justify-center">
//           <Button className="bg-emerald-600 hover:bg-emerald-700">
//             Get started
//             <ArrowRight className="w-4 h-4 ml-2" />
//           </Button>
//         </div>
//       </section>

//       {/* DIY vs Blueprint contrast */}
//       <section className="relative mt-16 lg:mt-20 px-4 sm:px-6 lg:px-8">
//         <div className="pointer-events-none absolute inset-0 -z-10">
//           <div className="absolute inset-x-6 top-0 h-3/4 rounded-3xl bg-gradient-to-b from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl" />
//         </div>

//         <div className="max-w-7xl mx-auto">
//           <div className="text-center">
//             <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
//               <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
//               DIY vs Blueprint
//             </div>
//             <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white">
//               Compare total cost of ownership at a glance
//             </h2>
//             <p className="mt-3 text-sm sm:text-base text-slate-300">
//               Swap in your numbers to see how a managed rollout stacks up
//               against building and operating everything in-house.
//             </p>
//           </div>

//           <div className="mt-10">
//             <div className="hidden md:block">
//               <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
//                 <div className="grid grid-cols-[1.2fr,1fr,1fr] gap-6 border-b border-white/10 bg-white/[0.03] px-8 py-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
//                   <div className="text-left">Line item</div>
//                   <div className="text-center text-emerald-200">
//                     Do it internally (DIY)
//                   </div>
//                   <div className="text-center text-cyan-200">
//                     Use Blueprint (managed)
//                   </div>
//                 </div>
//                 <div className="divide-y divide-white/10">
//                   {contrastRows.map((row) => {
//                     const Icon = row.icon;
//                     return (
//                       <div
//                         key={row.label}
//                         className="grid grid-cols-[1.2fr,1fr,1fr] items-start gap-6 px-8 py-6 transition-colors hover:bg-white/[0.05]"
//                       >
//                         <div className="flex gap-4">
//                           <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
//                             <Icon className="h-5 w-5 text-emerald-300" />
//                           </div>
//                           <div>
//                             <div className="text-base font-semibold text-white">
//                               {row.label}
//                             </div>
//                             {row.subLabel ? (
//                               <div className="mt-1 text-xs text-slate-400">
//                                 {row.subLabel}
//                               </div>
//                             ) : null}
//                           </div>
//                         </div>
//                         <p className="text-sm leading-relaxed text-slate-200">
//                           {row.diy}
//                         </p>
//                         <p className="text-sm leading-relaxed text-slate-200">
//                           {row.blueprint}
//                         </p>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             </div>

//             <div className="md:hidden space-y-4">
//               {contrastRows.map((row) => {
//                 const Icon = row.icon;
//                 return (
//                   <div
//                     key={row.label}
//                     className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-emerald-500/10"
//                   >
//                     <div className="flex items-center gap-3">
//                       <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
//                         <Icon className="h-5 w-5 text-emerald-300" />
//                       </div>
//                       <div>
//                         <div className="text-base font-semibold text-white">
//                           {row.label}
//                         </div>
//                         {row.subLabel ? (
//                           <div className="mt-1 text-xs text-slate-400">
//                             {row.subLabel}
//                           </div>
//                         ) : null}
//                       </div>
//                     </div>
//                     <div className="mt-4 space-y-3">
//                       <div>
//                         <div className="text-[11px] uppercase tracking-wide text-emerald-300">
//                           Do it internally (DIY)
//                         </div>
//                         <p className="mt-1 text-sm leading-relaxed text-slate-200">
//                           {row.diy}
//                         </p>
//                       </div>
//                       <div className="border-t border-white/10 pt-3">
//                         <div className="text-[11px] uppercase tracking-wide text-cyan-300">
//                           Use Blueprint (managed)
//                         </div>
//                         <p className="mt-1 text-sm leading-relaxed text-slate-200">
//                           {row.blueprint}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>

//           <div className="mt-12 grid gap-6 lg:grid-cols-2">
//             <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl">
//               <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
//                 <Zap className="h-3.5 w-3.5" />
//                 Takeaways
//               </div>
//               <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
//                 {takeaways.map((point) => (
//                   <li key={point} className="flex gap-3">
//                     <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
//                     <span>{point}</span>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//             <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl">
//               <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-200">
//                 <Sparkles className="h-3.5 w-3.5" />
//                 TL;DR metrics
//               </div>
//               <div className="mt-5 grid gap-4 sm:grid-cols-2">
//                 {tldrHighlights.map((item) => (
//                   <div
//                     key={item.label}
//                     className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
//                   >
//                     <div className="text-xs uppercase tracking-wide text-slate-400">
//                       {item.label}
//                     </div>
//                     <div className="mt-2 text-sm font-semibold text-emerald-200">
//                       DIY: {item.diy}
//                     </div>
//                     <div className="mt-1 text-sm text-cyan-200">
//                       Blueprint: {item.blueprint}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>

//           <div className="mt-10 grid gap-6 md:grid-cols-2">
//             {scenarioData.map((scenario) => (
//               <div
//                 key={scenario.name}
//                 className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 p-6 shadow-2xl"
//               >
//                 <div className="flex items-center gap-3">
//                   <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
//                     <PiggyBank className="h-5 w-5 text-emerald-300" />
//                   </div>
//                   <div>
//                     <div className="text-lg font-semibold text-white">
//                       {scenario.name}
//                     </div>
//                     <div className="text-xs text-slate-300">
//                       {scenario.subtitle}
//                     </div>
//                   </div>
//                 </div>
//                 <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
//                   {scenario.bullets.map((bullet) => (
//                     <li key={bullet} className="flex gap-3">
//                       <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
//                       <span>{bullet}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       <Footer />
//       <LindyChat />
//     </div>
//   );
// }
