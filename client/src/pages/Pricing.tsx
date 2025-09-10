import React, { useMemo, useState } from "react";
import {
  Calculator,
  Sparkles,
  Zap,
  InfoIcon,
  Users,
  Image as ImageIcon,
  Video,
  Music2,
  Box,
  Globe,
  Type,
  ArrowRight,
  Clock,
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

/* ------------------------------ Hero + Slider ----------------------------- */

const INCLUDED_HOURS = 40;
const MIN_HOURS = 40;
const MAX_HOURS = 2500;

function formatUSD(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function PriceHero({
  hours,
  setHours,
  hourly,
  baseMonthly = 49.99,
}: {
  hours: number;
  setHours: (n: number) => void;
  hourly: number;
  baseMonthly?: number;
}) {
  const monthly = useMemo(() => {
    const overage = Math.max(0, hours - INCLUDED_HOURS) * hourly;
    return baseMonthly + overage;
  }, [hours, hourly, baseMonthly]);

  const pct = (hours - MIN_HOURS) / (MAX_HOURS - MIN_HOURS);

  return (
    <section className="max-w-6xl mx-auto pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl sm:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500"
      >
        Pay only for the hours you use
      </motion.h1>

      <p className="mt-4 text-lg text-slate-300 flex items-center justify-center gap-2">
        Start with a flat monthly rate that includes{" "}
        <span className="font-semibold text-emerald-300">
          {INCLUDED_HOURS} hours
        </span>
        .
        <span
          className="inline-flex items-center gap-1 text-slate-400"
          title="After included hours, pay a simple hourly rate that reflects your content mix."
        >
          <InfoIcon className="w-4 h-4" />
        </span>
      </p>

      {/* Price pill */}
      <div className="mt-8 flex items-center justify-center">
        <div className="relative rounded-3xl border border-white/15 bg-white/[0.04] backdrop-blur-sm px-8 py-6 shadow-2xl">
          <div className="text-sm uppercase tracking-wider text-slate-400">
            Estimated monthly
          </div>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-4xl sm:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              ${formatUSD(monthly)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Base ${formatUSD(baseMonthly)} +{" "}
            {hours - INCLUDED_HOURS < 0 ? 0 : hours - INCLUDED_HOURS} hr × $
            {hourly.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="mt-10 relative max-w-3xl mx-auto">
        {/* bubble */}
        <div
          className="absolute -top-8 translate-x-[-50%] rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs text-slate-100 shadow"
          style={{ left: `calc(${pct * 100}% )` }}
        >
          {hours.toLocaleString()} hours
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400">
            {MIN_HOURS.toLocaleString()}
          </div>
          <input
            type="range"
            min={MIN_HOURS}
            max={MAX_HOURS}
            step={10}
            value={hours}
            onChange={(e) =>
              setHours(
                clamp(
                  parseInt(e.target.value || "0", 10),
                  MIN_HOURS,
                  MAX_HOURS,
                ),
              )
            }
            className="w-full h-2 appearance-none bg-white/10 rounded-full outline-none cursor-pointer"
          />
          <div className="text-xs text-slate-400">
            {MAX_HOURS.toLocaleString()}
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-400">
          This pricing scales as your deployments do. No surprises — just usage.
        </div>

        {/* Range thumb/track styles */}
        <style>{`
          input[type="range"] { background: linear-gradient(90deg, rgba(52,211,153,0.9), rgba(34,211,238,0.9)) 0/0% 100% no-repeat, rgba(255,255,255,0.08); }
          input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; height: 22px; width: 22px; border-radius: 9999px; background: white; border: 2px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
          input[type="range"]::-moz-range-thumb { height: 22px; width: 22px; border-radius: 9999px; background: white; border: 2px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
        `}</style>
      </div>

      {/* Hourly callout */}
      <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-4 py-2">
        <Clock className="w-4 h-4 text-emerald-400" />
        <span className="text-sm text-slate-200">
          Current <span className="font-semibold">price/hr</span> ={" "}
          <span className="font-semibold text-emerald-300">
            ${hourly.toFixed(2)}
          </span>{" "}
          (base ${BASE_RATE.toFixed(2)} + content add-ons)
        </span>
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
  const [hours, setHours] = useState<number>(MIN_HOURS);

  const exampleHourly =
    BASE_RATE +
    defaultCounts.image * RATES.image +
    defaultCounts.video * RATES.video +
    defaultCounts.audio * RATES.audio +
    defaultCounts.model * RATES.model +
    defaultCounts.webpage * RATES.webpage +
    defaultCounts.text * RATES.text;

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

      {/* Hero with slider (Cofounder-style, Blueprint colors) */}
      <PriceHero hours={hours} setHours={setHours} hourly={hourly} />

      {/* Three-column core + calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 items-start gap-8 md:gap-10">
        {/* Card 1: Simple Pricing */}
        <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs tracking-wide uppercase">Pricing</span>
            </div>
            <CardTitle className="text-white text-2xl">
              Simple Pricing
            </CardTitle>
            <CardDescription className="text-slate-300">
              Base price + content add-ons. Clear, cumulative, predictable.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div>
                <div className="text-xs text-slate-400">Base price</div>
                <div className="text-[11px] text-slate-400">
                  Applies to every active hour
                </div>
              </div>
              <div className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                ${BASE_RATE.toFixed(2)}/hr
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400">Add-ons (stacking)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-white">Images</span>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 shrink-0">
                    +${RATES.image.toFixed(3)}/hr
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-white">Videos</span>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 shrink-0">
                    +${RATES.video.toFixed(3)}/hr
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Music2 className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-white">Audio</span>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 shrink-0">
                    +${RATES.audio.toFixed(3)}/hr
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-white">3D Models</span>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 shrink-0">
                    +${RATES.model.toFixed(3)}/hr
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-white">Webpages</span>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 shrink-0">
                    +${RATES.webpage.toFixed(3)}/hr
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-white">Text</span>
                  </div>
                  <Badge className="bg-white/10 text-slate-100 shrink-0">
                    +${RATES.text.toFixed(3)}/hr
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <InfoIcon className="h-4 w-4 mt-0.5 text-emerald-300" />
                <p>
                  <span className="font-medium text-white">Cumulative:</span>{" "}
                  price/hr = base + Σ(content count × rate).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Concrete Example */}
        <Card className="lg:col-span-1 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Zap className="h-5 w-5" />
              <span className="text-xs tracking-wide uppercase">Example</span>
            </div>
            <CardTitle className="text-white text-2xl">
              Concrete Example
            </CardTitle>
            <CardDescription className="text-slate-300">
              A typical 5,000&nbsp;ft² Blueprint content mix.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-white">Images</span>
                </div>
                <Badge className="bg-white/10 text-slate-100 shrink-0">
                  {defaultCounts.image} × ${RATES.image.toFixed(3)}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-white">Videos</span>
                </div>
                <Badge className="bg-white/10 text-slate-100 shrink-0">
                  {defaultCounts.video} × ${RATES.video.toFixed(3)}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-white">Audio</span>
                </div>
                <Badge className="bg-white/10 text-slate-100 shrink-0">
                  {defaultCounts.audio} × ${RATES.audio.toFixed(3)}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-white">3D Models</span>
                </div>
                <Badge className="bg-white/10 text-slate-100 shrink-0">
                  {defaultCounts.model} × ${RATES.model.toFixed(3)}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-white">Webpages</span>
                </div>
                <Badge className="bg-white/10 text-slate-100 shrink-0">
                  {defaultCounts.webpage} × ${RATES.webpage.toFixed(3)}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-white">Text</span>
                </div>
                <Badge className="bg-white/10 text-slate-100 shrink-0">
                  {defaultCounts.text} × ${RATES.text.toFixed(3)}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div>
                <div className="text-xs text-slate-400">
                  Example price per hour
                </div>
                <div className="text-[11px] text-slate-400">
                  Base ${BASE_RATE.toFixed(2)} + add-ons above
                </div>
              </div>
              <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                ${exampleHourly.toFixed(2)}/hr
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Usage Calculator */}
        <div className="lg:col-span-1 xl:col-span-2">
          <PricingCalculator
            counts={counts}
            setCounts={setCounts}
            hourly={hourly}
          />
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 mb-20">
        <div className="grid md:grid-cols-3 items-stretch gap-6 md:gap-8">
          <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">
                What’s included in $0.75/hr?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Core runtime, hosting, and orchestration. You add content types
              (images, video, 3D, etc.) and your price/hr adjusts automatically.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">
                Do add-ons stack?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Yes. If your space has 10 images and 2 videos, you pay base + (10
              × image rate) + (2 × video rate) each active hour.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm shadow-2xl hover:bg-white/[0.06] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">
                Is there a team plan?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Teams are available as an optional add-on; talk to us if you need
              seats &amp; SSO. Your usage pricing stays the same.
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Get started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
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
