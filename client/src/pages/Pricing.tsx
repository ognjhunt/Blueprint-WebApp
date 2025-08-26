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

/**
 * ---------------------------------------------------------------------------
 * Pricing model (kept in one place so the Calculator and the “Rates” card share it)
 * ---------------------------------------------------------------------------
 * Base + content add-ons match your CostPanel:
 */
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
  audio: 2,
  model: 10,
  webpage: 6,
  text: 20,
};

/** Utility: price per hour for the current mix */
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

/** Small helper components -------------------------------------------------- */
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

/** Calculator block (content-mix + traffic quick-estimator) ----------------- */
function PricingCalculator() {
  const [counts, setCounts] = useState<Counts>(defaultCounts);

  // quick traffic estimator (optional)
  const [visitors, setVisitors] = useState<number>(400);
  const [basis, setBasis] = useState<"day" | "week" | "month">("day");
  const [avgMinutes, setAvgMinutes] = useState<number>(35);
  const [adoptionPct, setAdoptionPct] = useState<number>(1);

  const hourly = useMemo(() => pricePerHour(counts), [counts]);

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
          Build your{" "}
          <span className="text-white/90 font-medium">price per hour</span> from
          content types, then estimate a monthly bill from your traffic.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Responsive two-column layout with generous gaps and proper shrink/wrap behavior */}
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

                  {/* Input grows and can shrink; badge never overlaps and can wrap on small screens */}
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
              {/* Visitors */}
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

              {/* Avg visit / Adoption */}
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

            {/* Results */}
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
/** Main page ---------------------------------------------------------------- */
export default function PricingPage() {
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
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-cyan-300 to-emerald-300 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-gradient-to-r from-blue-300 to-teal-300 rounded-full blur-3xl" />
      </div>

      {/* Hero */}
      <section className="max-w-7xl mx-auto pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl sm:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500"
        >
          One simple price. Add what you need.
        </motion.h1>
        <p className="mt-4 text-lg text-slate-300">
          No tiers. No surprises. Pay a base price of{" "}
          <span className="font-semibold text-emerald-300">$0.75/hr</span> for
          usage and add content-based options as you go.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-4 py-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-slate-200">
            <strong>Cumulative example:</strong> 12 visitors × 10 minutes each =
            2 hours
            <span className="opacity-60 mx-1.5">→</span>
            <span className="font-semibold">Total = 2 × your price/hr</span>
            <span className="ml-2 text-slate-400">
              (your price/hr = Base $0.75 + content add-ons)
            </span>
          </span>
        </div>
      </section>

      {/* Pricing core */}
      {/* Pricing core */}
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
            {/* Base price */}
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

            {/* Add-on pills */}
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

            {/* Explainer */}
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
            {/* Example grid */}
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

            {/* Example total */}
            {/* Example total */}
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
            {/* {(() => {
              const exampleHourly =
                BASE_RATE +
                defaultCounts.image * RATES.image +
                defaultCounts.video * RATES.video +
                defaultCounts.audio * RATES.audio +
                defaultCounts.model * RATES.model +
                defaultCounts.webpage * RATES.webpage +
                defaultCounts.text * RATES.text;

              return (
                <div className="flex items-end justify-between rounded-xl border border-white/10 bg-white/[0.06] p-4">
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
              );
            })()} */}
          </CardContent>
        </Card>

        {/* Card 3: Usage Calculator (keeps your existing logic/component) */}
        <div className="lg:col-span-1 xl:col-span-2">
          <PricingCalculator />
        </div>
      </section>

      {/* Extra: FAQs small block */}
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
              seats & SSO. Your usage pricing stays the same.
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

// import React, { useState } from "react";
// import {
//   Check,
//   X,
//   Calculator,
//   Zap,
//   Users,
//   Clock,
//   Sparkles,
//   Building2,
//   TrendingUp,
//   Calendar,
//   Gauge,
//   InfoIcon,
//   ChevronRight,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Slider } from "@/components/ui/slider";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";
// import LindyChat from "@/components/LindyChat";
// import Stripe from "stripe";
// // Import the new modal components
// import { TeamSeatSelectorModal } from "@/components/TeamSeatSelectorModal";
// import { WorkspaceNameModal } from "@/components/WorkspaceNameModal";
// import { InviteMembersModal } from "@/components/InviteMembersModal";
// import { Progress } from "@/components/ui/progress";
// import { Badge } from "@/components/ui/badge";
// import { useAuth } from "@/contexts/AuthContext"; // Needed to get current user data
// import { doc, getDoc } from "firebase/firestore"; // Needed to get user data
// import { db } from "@/lib/firebase"; // Needed for db access
// import { motion } from "framer-motion"; // Needed for motion divs
// import { useLocation } from "wouter"; // <--- ADD THIS IMPORT for wouter
// import { useRouter } from "next/router"; // ADD THIS LINE for Next.js Pages Router

// // Stripe Checkout Route - Keep original functionality
// export const dynamic = "force-static";
// export async function POST(request: Request) {
//   try {
//     const body = await request.json();
//     // Expect 'hours' and 'seats' from the frontend
//     const { hours, seats } = body;

//     // Basic validation
//     if (
//       typeof hours !== "number" ||
//       hours <= 0 ||
//       typeof seats !== "number" ||
//       seats < 0
//     ) {
//       return new Response(
//         JSON.stringify({ error: "Invalid hours or seats provided." }),
//         { status: 400 },
//       );
//     }
//     if (seats > 0 && seats < 2) {
//       return new Response(
//         JSON.stringify({ error: "Minimum 2 seats required for Team add-on." }),
//         { status: 400 },
//       );
//     }

//     const stripeSecretKey = process.env.STRIPE_SECRET_KEY; // Ensure this matches your env variable name

//     if (!stripeSecretKey) {
//       console.error("Missing Stripe Secret Key environment variable.");
//       return new Response(
//         JSON.stringify({ error: "Server configuration error." }),
//         { status: 500 },
//       );
//     }

//     // @ts-ignore - Updating apiVersion to match library requirements
//     const stripe = new Stripe(stripeSecretKey, {
//       apiVersion: "2024-12-18.acacia",
//     });

//     const successBaseUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
//     const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/pricing?canceled=true`;

//     // --- Logic to get cost per hour (MUST match frontend logic) ---
//     // IMPORTANT: Duplicate or share this logic reliably between frontend and backend
//     // Using an arrow function to avoid strict mode function declaration issues
//     const getCostPerHourForPlusBackend = (h: number): number => {
//       const pricePerHourTiers = {
//         100: 1.0,
//         250: 0.97,
//         500: 0.93,
//         1000: 0.88,
//         2500: 0.8,
//         5000: 0.7,
//         7500: 0.63,
//         10000: 0.57,
//         15000: 0.5,
//         20000: 0.44,
//         30000: 0.38,
//         50000: 0.32,
//       };
//       if (pricePerHourTiers[h] !== undefined) return pricePerHourTiers[h];
//       if (h < 100) return pricePerHourTiers[100];
//       if (h > 50000) return pricePerHourTiers[50000];
//       const tiers = Object.keys(pricePerHourTiers)
//         .map(Number)
//         .sort((a, b) => a - b);
//       let lowerTier = 100;
//       for (let i = 0; i < tiers.length; i++) {
//         if (tiers[i] <= h) lowerTier = tiers[i];
//         else break;
//       }
//       return pricePerHourTiers[lowerTier];
//     };
//     // --- End cost per hour logic ---

//     const costPerHour = getCostPerHourForPlusBackend(hours);
//     const hoursTotalCost = hours * costPerHour; // Recalculate backend side
//     const TEAM_PLAN_PRICE_PER_SEAT_CENTS = 1000; // $10.00

//     const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

//     // 1. Add the one-time payment item for hours
//     lineItems.push({
//       price_data: {
//         currency: "usd",
//         product_data: {
//           name: `Blueprint Plus - ${hours} Customer Hours`,
//           description: "One-time purchase of customer usage hours.",
//         },
//         unit_amount: Math.round(hoursTotalCost * 100), // Price in cents
//       },
//       quantity: 1,
//     });

//     // 2. Add the recurring subscription item for team seats (if any)
//     if (seats > 0) {
//       lineItems.push({
//         price_data: {
//           currency: "usd",
//           product_data: {
//             name: `Blueprint Team Seats`,
//             description: `Monthly subscription per team member seat.`,
//           },
//           unit_amount: TEAM_PLAN_PRICE_PER_SEAT_CENTS,
//           recurring: {
//             interval: "month",
//           },
//         },
//         quantity: seats,
//       });
//     }

//     // Create the Checkout Session
//     // Mode MUST be 'subscription' if mixing one-time and recurring items
//     const sessionMode: Stripe.Checkout.SessionCreateParams.Mode =
//       seats > 0 ? "subscription" : "payment";

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: sessionMode,
//       line_items: lineItems,
//       // Add metadata if needed (e.g., userId)
//       // metadata: { userId: 'user_123' },
//       success_url: `${successBaseUrl}&hours=${hours}&seats=${seats}`, // Pass details for post-checkout handling
//       cancel_url: cancelUrl,
//       // If using subscription mode, you might need billing address collection
//       billing_address_collection:
//         sessionMode === "subscription" ? "required" : undefined,
//     });

//     return new Response(JSON.stringify({ sessionId: session.id }), {
//       status: 200,
//     });
//   } catch (error: any) {
//     console.error("Error creating Stripe session:", error);
//     return new Response(
//       JSON.stringify({ error: error.message || "Internal Server Error" }),
//       { status: 500 },
//     );
//   }
// }

// // Add this component right after your FeatureItem component definition
// const HoursSelector = ({ value, onChange, tiers }) => (
//   <div className="relative w-full">
//     <select
//       value={value}
//       onChange={(e) => onChange(Number(e.target.value))}
//       className="w-full p-2 border rounded-md border-emerald-300 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50 bg-white/5"
//     >
//       {tiers.map((tier) => (
//         <option key={tier} value={tier}>
//           {tier} hours
//         </option>
//       ))}
//     </select>
//     <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
//       <svg
//         className="w-5 h-5 text-slate-500"
//         fill="none"
//         stroke="currentColor"
//         viewBox="0 0 24 24"
//         xmlns="http://www.w3.org/2000/svg"
//       >
//         <path
//           strokeLinecap="round"
//           strokeLinejoin="round"
//           strokeWidth={2}
//           d="M19 9l-7 7-7-7"
//         />
//       </svg>
//     </div>
//   </div>
// );

// // Modern component for the feature list items
// const FeatureItem = ({
//   included = true,
//   children,
//   highlight = false,
// }: {
//   included?: boolean;
//   children: React.ReactNode;
//   highlight?: boolean;
// }) => (
//   <li className={`flex items-start ${highlight ? "font-medium" : ""}`}>
//     {included ? (
//       <Check className="flex-shrink-0 w-5 h-5 text-emerald-500" />
//     ) : (
//       <X className="flex-shrink-0 w-5 h-5 text-rose-500" />
//     )}
//     <span
//       className={`ml-3 text-base ${included ? "text-slate-300" : "text-slate-400"}`}
//     >
//       {children}
//     </span>
//   </li>
// );

// export default function PricingPage() {
//   const router = useLocation();
//   // State for plan selection
//   // Define a type for the plans to ensure consistency
//   type PlanType = "free" | "starter" | "plus";
//   const [selectedPlan, setSelectedPlan] = useState<PlanType>("free");

//   const itemVariants = {
//     hidden: { opacity: 0, y: 20 },
//     visible: {
//       opacity: 1,
//       y: 0,
//       transition: {
//         type: "spring",
//         stiffness: 100,
//         damping: 15,
//       },
//     },
//   };
//   const [chosenHours, setChosenHours] = useState(100);
//   const [estimatedUsage, setEstimatedUsage] = useState(100);
//   const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
//   const [isWorkspaceNameOpen, setIsWorkspaceNameOpen] = useState(false);
//   // Blueprint Usage Calculator state
//   const [customerCount, setCustomerCount] = useState<number>(500);
//   const [customerBasis, setCustomerBasis] = useState<"day" | "week" | "month">(
//     "day",
//   );
//   const [avgVisitDuration, setAvgVisitDuration] = useState<number>(30);
//   const [adoptionPercentage, setAdoptionPercentage] = useState<number>(10);
//   const [estimatedBlueprintUsage, setEstimatedBlueprintUsage] =
//     useState<number>(0);
//   const [showCalculatorIndicator, setShowCalculatorIndicator] = useState(true);
//   const [isIndicatorBouncing, setIsIndicatorBouncing] = useState(true);
//   const [isCheckingOut, setIsCheckingOut] = useState(false);
//   const hourTiers = [
//     100, 250, 500, 1000, 2500, 5000, 7500, 10000, 15000, 20000, 30000, 50000,
//   ];

//   // --- New State for Team Plan Flow ---
//   const [teamSeats, setTeamSeats] = useState<number>(0); // Default to 0 seats (no team add-on)
//   const [workspaceName, setWorkspaceName] = useState<string>(""); // Still needed for post-checkout invite
//   const [isInviteMembersOpen, setIsInviteMembersOpen] =
//     useState<boolean>(false); // For post-checkout
//   const [finalWorkspaceName, setFinalWorkspaceName] = useState<string>(""); // To show in Invite modal

//   React.useEffect(() => {
//     if (isIndicatorBouncing) {
//       const timer = setTimeout(() => {
//         setIsIndicatorBouncing(false);
//       }, 3000); // Approximately 3 bounces
//       return () => clearTimeout(timer);
//     }
//   }, [isIndicatorBouncing]);

//   // --- Modified useEffect to handle different success scenarios ---
//   React.useEffect(() => {
//     const urlParams = new URLSearchParams(window.location.search);
//     const success = urlParams.get("success");
//     const canceled = urlParams.get("canceled");
//     const sessionId = urlParams.get("session_id");
//     const purchasedSeatsStr = urlParams.get("seats"); // Get seats from URL

//     if (success === "true" && sessionId) {
//       const purchasedSeats = parseInt(purchasedSeatsStr || "0", 10);

//       if (purchasedSeats > 0) {
//         // Combined plan with seats successful: Show Invite Members modal
//         console.log("Plus + Team plan payment successful!");
//         // You might want to fetch workspace details or prompt for name here if needed
//         // For now, just use a placeholder or previously stored name
//         setFinalWorkspaceName(
//           localStorage.getItem("pendingWorkspaceName") || "Your Workspace",
//         ); // Example: Use stored name or default
//         setIsInviteMembersOpen(true);
//         localStorage.removeItem("pendingWorkspaceName"); // Clean up if you used localStorage
//         alert("Payment successful! Your hours and team seats are active."); // Optional alert
//       } else {
//         // Plus plan (hours only) success: Show generic success message
//         console.log("Plus plan (hours only) payment successful!");
//         alert("Payment successful! Your Plus plan hours have been added.");
//       }
//       // Clear sensitive parts of the URL after processing
//       window.history.replaceState({}, document.title, "/pricing");
//     } else if (canceled === "true") {
//       // Show canceled message
//       alert("Payment was canceled. You can try again when you're ready.");
//       window.history.replaceState({}, document.title, "/pricing");
//     }
//   }, []); // Empty dependency array ensures this runs only once on mount

//   function calculateBlueprintUsage() {
//     let monthlyCustomers = customerCount;
//     if (customerBasis === "day") {
//       monthlyCustomers = customerCount * 30;
//     } else if (customerBasis === "week") {
//       monthlyCustomers = customerCount * 4;
//     }
//     const totalMinutes = monthlyCustomers * avgVisitDuration;
//     const totalHours = totalMinutes / 60;
//     const blueprintUsage = totalHours * (adoptionPercentage / 100);
//     const usageCapped = Math.max(100, blueprintUsage);

//     // Set immediately without animation delay
//     setEstimatedBlueprintUsage(usageCapped);
//   }

//   function handleUseThisEstimate() {
//     setSelectedPlan("plus");
//     setEstimatedUsage(estimatedBlueprintUsage);
//     const usageAsHours = Math.round(estimatedBlueprintUsage);

//     // Find the next tier up that covers the estimated usage
//     const nextTierUp =
//       hourTiers.find((tier) => tier >= usageAsHours) ||
//       hourTiers[hourTiers.length - 1];

//     setChosenHours(nextTierUp);

//     // Scroll back up to see pricing changes - add a slight delay to allow state to update
//     setTimeout(() => {
//       const pricingTiers = document.getElementById("pricing-tiers");
//       if (pricingTiers) {
//         pricingTiers.scrollIntoView({
//           behavior: "smooth",
//           block: "start",
//         });
//       }
//     }, 100);
//   }

//   // Price Calculation Functions - Keep original algorithms
//   function getCostPerHourForPlus(hours: number) {
//     const pricePerHourTiers = {
//       100: 1.0, // $100 total
//       250: 0.97, // $243 total
//       500: 0.93, // $465 total
//       1000: 0.88, // $880 total
//       2500: 0.8, // $2,000 total
//       5000: 0.7, // $3,500 total
//       7500: 0.63, // $4,725 total
//       10000: 0.57, // $5,700 total
//       15000: 0.5, // $7,500 total
//       20000: 0.44, // $8,800 total
//       30000: 0.38, // $11,400 total
//       50000: 0.32, // $16,000 total
//     };

//     // Find the exact tier if it exists
//     if (pricePerHourTiers[hours] !== undefined) {
//       return pricePerHourTiers[hours];
//     }

//     // If hours is smaller than the smallest tier, return the smallest tier price
//     if (hours < 100) {
//       return pricePerHourTiers[100];
//     }

//     // If hours is larger than the largest tier, return the largest tier price
//     if (hours > 50000) {
//       return pricePerHourTiers[50000];
//     }

//     // Find the closest lower tier
//     const tiers = Object.keys(pricePerHourTiers)
//       .map(Number)
//       .sort((a, b) => a - b);
//     let lowerTier = 100;

//     for (let i = 0; i < tiers.length; i++) {
//       if (tiers[i] <= hours) {
//         lowerTier = tiers[i];
//       } else {
//         break;
//       }
//     }

//     // Return the price of the lower tier
//     return pricePerHourTiers[lowerTier];
//   }

//   function getOverageRateForPlus(hours: number) {
//     const costPerHour = getCostPerHourForPlus(hours);
//     return costPerHour + 0.2;
//   }

//   // function calculateMonthlyCost() {
//   //   if (selectedPlan === "free") {
//   //     return 0;
//   //   } else {
//   //     const costPerHour = getCostPerHourForPlus(chosenHours);
//   //     const baseCost = chosenHours * costPerHour;
//   //     if (estimatedUsage <= chosenHours) {
//   //       return baseCost;
//   //     } else {
//   //       const overage = estimatedUsage - chosenHours;
//   //       const overageCost = overage * getOverageRateForPlus(chosenHours);
//   //       return baseCost + overageCost;
//   //     }
//   //   }
//   // }
//   function calculateTotalMonthlyCost() {
//     const costPerHour = getCostPerHourForPlus(chosenHours);
//     const baseCost = chosenHours * costPerHour;
//     let usageCost = baseCost;
//     if (estimatedUsage > chosenHours) {
//       const overage = estimatedUsage - chosenHours;
//       const overageCost = overage * getOverageRateForPlus(chosenHours);
//       usageCost = baseCost + overageCost;
//     }
//     const seatsCost = teamSeats * 10; // $10 per seat
//     return usageCost + seatsCost;
//   }

//   // You might want a separate function just for the hours cost for checkout
//   function calculateHoursCost() {
//     const costPerHour = getCostPerHourForPlus(chosenHours);
//     return chosenHours * costPerHour;
//   }

//   // const hoursMonthlyCost = calculateTotalMonthlyCost() - teamSeats * 10; // Usage cost (base + overage)
//   // const seatsMonthlyCost = teamSeats * 10; // Cost for seats only
//   // const totalMonthlyCost = hoursMonthlyCost + seatsMonthlyCost; // Combined cost

//   // --- Combined Checkout Handler for Plus (with optional Team) ---
//   async function handleCheckout() {
//     if (isCheckingOut || (teamSeats > 0 && teamSeats < 2)) return; // Prevent checkout if invalid seats
//     setIsCheckingOut(true);

//     // Prompt for workspace name if team seats are selected and name isn't set
//     // For simplicity, let's assume workspace name is handled post-checkout or isn't strictly needed for checkout itself
//     // If needed pre-checkout, you'd open a modal here first.

//     try {
//       const hoursCost = calculateHoursCost(); // Use the dedicated function

//       const response = await fetch("/pricing", {
//         // Your API endpoint
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           // Send both hours and seats
//           hours: chosenHours,
//           seats: teamSeats,
//           // Optionally send cost breakdown if needed backend-side, but backend should recalculate
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(
//           errorData.error || "Failed to create checkout session.",
//         );
//       }

//       const { sessionId } = await response.json();
//       const { loadStripe } = await import("@stripe/stripe-js");
//       const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

//       if (!stripePublicKey) {
//         console.error("Stripe public key is not set.");
//         alert("Configuration error. Please contact support.");
//         setIsCheckingOut(false);
//         return;
//       }

//       const stripe = await loadStripe(stripePublicKey);
//       if (!stripe) throw new Error("Stripe could not be loaded.");

//       // Redirect to Stripe Checkout
//       const { error } = await stripe.redirectToCheckout({ sessionId });
//       if (error) {
//         console.error("Checkout redirection error:", error);
//         alert(`Checkout error: ${error.message}`);
//       }
//       // On success, Stripe redirects to success_url handled by useEffect
//     } catch (error: any) {
//       console.error("Checkout process error:", error);
//       alert(`Something went wrong: ${error.message || "Please try again."}`);
//     } finally {
//       // Only set checking out to false if redirect fails immediately
//       if (!window.location.href.includes("stripe.com")) {
//         setIsCheckingOut(false);
//       }
//     }
//   }

//   function handleWorkspaceContinue() {
//     // For example, store the workspace name in localStorage
//     localStorage.setItem("pendingWorkspaceName", workspaceName);

//     // Close the modal
//     setIsWorkspaceNameOpen(false);

//     // Proceed with the existing checkout
//     handleCheckout();
//   }

//   const costPerHourPlus = getCostPerHourForPlus(chosenHours);
//   const overageRatePlus = getOverageRateForPlus(chosenHours);
//   const hoursMonthlyCost = calculateHoursCost(); // Cost for hours only
//   const seatsMonthlyCost = teamSeats * 10; // Cost for seats only
//   const totalMonthlyCost = hoursMonthlyCost + seatsMonthlyCost; // Combined cost

//   return (
//     <div className="min-h-screen bg-[#0B1220] text-slate-100">
//       <Nav />
//       <div className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8">
//         {/* Background elements */}
//         <div className="absolute inset-0 opacity-30" style={{ zIndex: -1 }}>
//           <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-cyan-300 to-emerald-300 rounded-full filter blur-3xl"></div>
//           <div className="absolute bottom-10 right-10 w-72 h-72 bg-gradient-to-r from-blue-300 to-teal-300 rounded-full filter blur-3xl"></div>
//         </div>
//         {/* Header */}
//         <div className="max-w-7xl relative z-10 mx-auto text-center">
//           <h1 className="text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600">
//             Choose Your Plan
//           </h1>
//           <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-400">
//             Simple pricing for individuals and teams.
//           </p>
//           <div className="mt-4 bg-white/5 border border-white/10 rounded-lg shadow-sm p-4 inline-flex items-center justify-center">
//             <Users className="w-5 h-5 mr-2 text-emerald-600" />
//             <p className="text-sm text-slate-300">
//               <span className="font-semibold text-emerald-300">
//                 Team Plan Benefit:{" "}
//               </span>
//               Usage by invited team members doesn’t count towards your monthly
//               hours—just pay a flat
//               <strong> $10/month per seat.</strong>
//             </p>
//           </div>
//         </div>
//         <div
//           id="pricing-tiers"
//           className="mt-16 md:grid md:grid-cols-3 md:gap-10 lg:max-w-[1800px] lg:mx-auto items-stretch px-8"
//         >
//           {/* Free Tier */}
//           <div className="cursor-pointer hover:-translate-y-1 transition-transform duration-200 h-full">
//             <Card
//               className={`flex flex-col h-full overflow-hidden ${
//                 selectedPlan === "free"
//                   ? "border-emerald-500 border-2 shadow-lg shadow-emerald-500/20"
//                   : "border border-white/10 hover:border-emerald-300 transition-all"
//               }`}
//               onClick={() => setSelectedPlan("free")}
//             >
//               <CardHeader className="bg-white/5 pb-8">
//                 <CardTitle className="text-2xl font-bold flex items-center">
//                   <div className="w-8 h-8 mr-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
//                     <Zap className="w-5 h-5 text-emerald-600" />
//                   </div>
//                   Free
//                 </CardTitle>
//                 <CardDescription className="text-slate-400">
//                   For individuals starting out
//                 </CardDescription>
//                 <div className="mt-4 text-center">
//                   <div className="text-center mb-4">
//                     <span className="text-5xl font-extrabold text-white">
//                       $0
//                     </span>
//                     <span className="text-lg font-medium text-slate-400">
//                       /month
//                     </span>
//                   </div>
//                   <div className="bg-white/5 p-3 rounded-lg">
//                     <p className="text-sm text-slate-400">
//                       Includes 100 hours/month
//                     </p>
//                   </div>
//                 </div>
//               </CardHeader>

//               <CardContent className="pt-6 flex-grow">
//                 <ul className="space-y-4">
//                   <FeatureItem>Up to 3 Blueprints</FeatureItem>
//                   <FeatureItem>Basic customer interactions</FeatureItem>
//                   <FeatureItem>Standard support</FeatureItem>
//                   <FeatureItem>Community access</FeatureItem>
//                   <FeatureItem>100 hours/month included</FeatureItem>
//                   <FeatureItem included={false}>Limited analytics</FeatureItem>
//                   <FeatureItem included={false}>
//                     No smart recommendations
//                   </FeatureItem>
//                 </ul>
//               </CardContent>

//               <CardFooter className="pt-4 pb-8 mt-auto">
//                 <Button
//                   variant={selectedPlan === "free" ? "default" : "outline"}
//                   className={`w-full h-12 text-base ${
//                     selectedPlan === "free"
//                       ? "bg-emerald-600 hover:bg-emerald-700 cursor-default"
//                       : "border-emerald-600 text-emerald-600 hover:bg-emerald-500/10"
//                   }`}
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     setSelectedPlan("free");
//                   }} // Prevent card click propagation if needed
//                   aria-pressed={selectedPlan === "free" ? "true" : "false"}
//                 >
//                   {selectedPlan === "free" ? "Current Plan" : "Choose Free"}
//                 </Button>
//               </CardFooter>
//             </Card>
//           </div>

//           {/* Starter Tier */}
//           <div className="cursor-pointer hover:-translate-y-1 transition-transform duration-200 h-full">
//             <Card
//               className={`flex flex-col h-full overflow-hidden ${
//                 selectedPlan === "starter"
//                   ? "border-emerald-500 border-2 shadow-lg shadow-emerald-500/20"
//                   : "border border-white/10 hover:border-emerald-300 transition-all"
//               }`}
//               onClick={() => setSelectedPlan("starter")}
//             >
//               <CardHeader className="bg-white/5 pb-8">
//                 <CardTitle className="text-2xl font-bold flex items-center">
//                   <div className="w-8 h-8 mr-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
//                     <Zap className="w-5 h-5 text-emerald-600" />
//                   </div>
//                   Starter
//                 </CardTitle>
//                 <CardDescription className="text-slate-400">
//                   For prosumers &amp; power users
//                 </CardDescription>
//                 <div className="mt-4 text-center">
//                   <div className="text-center mb-4">
//                     <span className="text-5xl font-extrabold text-white">
//                       $10
//                     </span>
//                     <span className="text-lg font-medium text-slate-400">
//                       /month
//                     </span>
//                   </div>
//                   <div className="bg-white/5 p-3 rounded-lg">
//                     <p className="text-sm text-slate-400">
//                       Includes 500 hours/month
//                     </p>
//                     <p className="text-xs text-slate-400">Overage: $1/hr</p>
//                   </div>
//                 </div>
//               </CardHeader>
//               <CardContent className="pt-6 flex-grow">
//                 <ul className="space-y-4">
//                   <FeatureItem>Unlimited Blueprints</FeatureItem>
//                   <FeatureItem>Early access to new features</FeatureItem>
//                   <FeatureItem included={false}>
//                     No commercial/team usage
//                   </FeatureItem>
//                   <FeatureItem included={false}>
//                     Max 10 concurrent users
//                   </FeatureItem>
//                   <FeatureItem included={false}>
//                     No Plus features (recommendations)
//                   </FeatureItem>
//                 </ul>
//               </CardContent>
//               <CardFooter className="pt-4 pb-8 mt-auto">
//                 <Button
//                   variant={selectedPlan === "starter" ? "default" : "outline"}
//                   className={`w-full h-12 text-base ${
//                     selectedPlan === "starter"
//                       ? "bg-emerald-600 hover:bg-emerald-700 cursor-default"
//                       : "border-emerald-600 text-emerald-600 hover:bg-emerald-500/10"
//                   }`}
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     setSelectedPlan("starter");
//                   }}
//                   aria-pressed={selectedPlan === "starter" ? "true" : "false"}
//                 >
//                   {selectedPlan === "starter"
//                     ? "Current Plan"
//                     : "Choose Starter"}
//                 </Button>
//               </CardFooter>
//             </Card>
//           </div>

//           {/* Combined Plus + Team Tier */}
//           <div
//             className="cursor-pointer hover:-translate-y-1 transition-transform duration-200 h-full"
//             onClick={(e) => {
//               // Select this plan if clicking outside interactive elements
//               const target = e.target as HTMLElement;
//               if (
//                 target.tagName !== "INPUT" &&
//                 target.tagName !== "SELECT" &&
//                 target.tagName !== "BUTTON" &&
//                 !target.closest("button") &&
//                 !target.closest("input[type='number']") && // Ignore number input clicks
//                 selectedPlan !== "plus"
//               ) {
//                 setSelectedPlan("plus");
//               }
//             }}
//           >
//             <Card
//               className={`flex flex-col h-full overflow-hidden ${
//                 selectedPlan === "plus"
//                   ? "border-emerald-500 border-2 shadow-lg shadow-emerald-500/20"
//                   : "border border-white/10 hover:border-emerald-300 transition-all"
//               }`}
//             >
//               <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 pb-8">
//                 <CardTitle className="text-2xl font-bold flex items-center">
//                   <div className="w-8 h-8 mr-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
//                     <Sparkles className="w-5 h-5 text-emerald-600" />
//                   </div>
//                   Plus
//                 </CardTitle>
//                 <CardDescription className="text-slate-400">
//                   Pay for customer hours, add team seats optionally.
//                 </CardDescription>

//                 {/* Combined Price Display */}
//                 <div className="mt-4 text-center">
//                   <div className="text-center mb-4">
//                     <span className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600">
//                       ${Math.round(totalMonthlyCost)}
//                     </span>
//                     <span className="text-lg font-medium text-slate-400">
//                       /month
//                     </span>
//                     {teamSeats > 0 && (
//                       <p className="text-sm text-slate-400 mt-1">
//                         (${Math.round(hoursMonthlyCost)} for hours + $
//                         {seatsMonthlyCost} for {teamSeats} seats)
//                       </p>
//                     )}
//                   </div>

//                   {/* Hours Selector */}
//                   <div className="bg-emerald-500/10 p-3 rounded-lg mb-3">
//                     <div className="mb-2 flex justify-between items-center">
//                       <span className="text-sm font-medium text-emerald-700">
//                         Customer Hours:
//                       </span>
//                       <span className="text-sm bg-emerald-200 text-emerald-300 px-2 py-1 rounded-md font-medium">
//                         ${costPerHourPlus.toFixed(2)}/hour
//                       </span>
//                     </div>
//                     <select
//                       value={chosenHours}
//                       onChange={(e) => {
//                         setChosenHours(Number(e.target.value));
//                         setSelectedPlan("plus"); // Ensure plan is selected when changing
//                       }}
//                       className="w-full p-2 border rounded-md border-emerald-300 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50 bg-white/5"
//                       onClick={(e) => e.stopPropagation()} // Prevent card selection
//                     >
//                       {hourTiers.map((hours) => (
//                         <option key={hours} value={hours}>
//                           {hours} hours
//                         </option>
//                       ))}
//                     </select>
//                     <p className="text-xs text-emerald-600 mt-1">
//                       Overage: ${overageRatePlus.toFixed(2)}/hour
//                     </p>
//                   </div>

//                   {/* Team Seat Selector */}
//                   <div className="bg-cyan-500/10 p-3 rounded-lg">
//                     <div className="mb-2 flex justify-between items-center">
//                       <span className="text-sm font-medium text-cyan-300">
//                         Team Seats (Optional):
//                       </span>
//                       <span className="text-sm bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-md font-medium">
//                         $10/seat/month
//                       </span>
//                     </div>
//                     <div className="flex items-center justify-center space-x-2">
//                       <Button
//                         variant="outline"
//                         size="icon"
//                         className="border-cyan-300 text-cyan-600 hover:bg-cyan-500/10"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           setTeamSeats((prev) => Math.max(0, prev - 1));
//                           setSelectedPlan("plus");
//                         }}
//                         disabled={teamSeats <= 0}
//                       >
//                         {" "}
//                         -{" "}
//                       </Button>
//                       <Input
//                         type="number"
//                         min="0"
//                         value={teamSeats}
//                         onChange={(e) => {
//                           const val = parseInt(e.target.value, 10);
//                           setTeamSeats(isNaN(val) || val < 0 ? 0 : val);
//                           setSelectedPlan("plus");
//                         }}
//                         onClick={(e) => e.stopPropagation()}
//                         className="w-16 text-center border-cyan-300 focus:border-cyan-500 focus:ring-cyan-500/20"
//                       />
//                       <Button
//                         variant="outline"
//                         size="icon"
//                         className="border-cyan-300 text-cyan-600 hover:bg-cyan-500/10"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           setTeamSeats((prev) => prev + 1);
//                           setSelectedPlan("plus");
//                         }}
//                       >
//                         {" "}
//                         +{" "}
//                       </Button>
//                     </div>
//                     {teamSeats > 0 && teamSeats < 2 && (
//                       <p className="text-xs text-red-600 mt-1">
//                         Minimum 2 seats if adding team.
//                       </p>
//                     )}
//                     {/* Auto-adjust to minimum 2 if 1 is entered */}
//                     {teamSeats === 1
//                       ? (() => {
//                           setTeamSeats(2);
//                           return null;
//                         })()
//                       : null}{" "}
//                   </div>
//                 </div>
//               </CardHeader>

//               <CardContent className="pt-6 flex-grow">
//                 {/* 2-column grid to reduce height */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
//                   <ul className="space-y-4">
//                     <FeatureItem>Everything in Free</FeatureItem>
//                     <FeatureItem>Unlimited Blueprints</FeatureItem>
//                     <FeatureItem>Advanced customer interactions</FeatureItem>
//                     <FeatureItem>Priority support</FeatureItem>
//                     <FeatureItem>Insights & Analytics</FeatureItem>
//                     <FeatureItem>Smart recommendations</FeatureItem>
//                     <FeatureItem highlight={true}>
//                       Sliding discount on customer hours
//                     </FeatureItem>
//                     <FeatureItem highlight={true}>
//                       Blueprint continuously refines your space with data &
//                       feedback for a streamlined experience.
//                     </FeatureItem>
//                   </ul>

//                   <ul className="space-y-4">
//                     <FeatureItem included={teamSeats > 0}>
//                       Create and share custom Blueprints (with Team)
//                     </FeatureItem>
//                     <FeatureItem included={teamSeats > 0}>
//                       Secure collaborative workspace (with Team)
//                     </FeatureItem>
//                     <FeatureItem highlight={true} included={teamSeats > 0}>
//                       Usage by invited team members is included per seat
//                     </FeatureItem>
//                   </ul>
//                 </div>
//               </CardContent>

//               <CardFooter className="pt-4 pb-8 mt-auto">
//                 {selectedPlan === "plus" ? (
//                   <div className="space-y-3 w-full">
//                     <div className="text-sm text-center text-slate-400 mb-2">
//                       Selected: {chosenHours} hours + {teamSeats} seats
//                     </div>
//                     {teamSeats > 0 ? (
//                       <Button
//                         className="w-full h-12 text-base bg-green-600 hover:bg-green-700 transition-all ..."
//                         onClick={() => {
//                           // If user has seats, open workspace modal first
//                           setIsWorkspaceNameOpen(true);
//                         }}
//                         disabled={isCheckingOut || teamSeats < 2}
//                       >
//                         {isCheckingOut ? (
//                           <>
//                             <svg
//                               className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
//                               xmlns="http://www.w3.org/2000/svg"
//                               fill="none"
//                               viewBox="0 0 24 24"
//                             >
//                               <circle
//                                 className="opacity-25"
//                                 cx="12"
//                                 cy="12"
//                                 r="10"
//                                 stroke="currentColor"
//                                 strokeWidth="4"
//                               ></circle>
//                               <path
//                                 className="opacity-75"
//                                 fill="currentColor"
//                                 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                               ></path>
//                             </svg>
//                             Processing...
//                           </>
//                         ) : (
//                           <>
//                             <span>Next: Workspace</span>
//                             <span className="font-bold">
//                               ${Math.round(totalMonthlyCost)}/month
//                             </span>
//                           </>
//                         )}
//                       </Button>
//                     ) : (
//                       <Button
//                         className="w-full h-12 text-base bg-green-600 hover:bg-green-700 transition-all ..."
//                         onClick={handleCheckout}
//                         disabled={isCheckingOut}
//                       >
//                         {isCheckingOut ? (
//                           <>
//                             <svg
//                               className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
//                               xmlns="http://www.w3.org/2000/svg"
//                               fill="none"
//                               viewBox="0 0 24 24"
//                             >
//                               <circle
//                                 className="opacity-25"
//                                 cx="12"
//                                 cy="12"
//                                 r="10"
//                                 stroke="currentColor"
//                                 strokeWidth="4"
//                               ></circle>
//                               <path
//                                 className="opacity-75"
//                                 fill="currentColor"
//                                 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                               ></path>
//                             </svg>
//                             Processing...
//                           </>
//                         ) : (
//                           <>
//                             <span>Next: Workspace</span>
//                             <span className="font-bold">
//                               ${Math.round(totalMonthlyCost)}/month
//                             </span>
//                           </>
//                         )}
//                       </Button>
//                     )}

//                     <Button
//                       variant="outline"
//                       className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-500/10"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setSelectedPlan("free");
//                         setTeamSeats(0); // Reset seats if canceling
//                       }}
//                       disabled={isCheckingOut}
//                     >
//                       Cancel
//                     </Button>
//                   </div>
//                 ) : (
//                   <Button
//                     variant="outline"
//                     className="w-full h-12 text-base border-emerald-600 text-emerald-600 hover:bg-emerald-500/10"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       setSelectedPlan("plus");
//                     }}
//                     aria-pressed={
//                       (selectedPlan as PlanType) === "plus" ? "true" : "false"
//                     }
//                   >
//                     Configure Plan
//                   </Button>
//                 )}
//               </CardFooter>
//             </Card>
//           </div>
//         </div>{" "}
//         {/* End Pricing Tiers Grid */}
//         {/* Floating Calculator Indicator (Keep as is) */}
//         {showCalculatorIndicator && (
//           <div
//             className={`hidden md:flex cursor-pointer fixed right-8 bottom-28 z-20 flex-col items-center ${
//               isIndicatorBouncing ? "animate-bounce" : ""
//             }`}
//             onClick={() => {
//               document
//                 .getElementById("calculator")
//                 ?.scrollIntoView({ behavior: "smooth", block: "center" });
//               setShowCalculatorIndicator(false);
//             }}
//           >
//             <div className="bg-emerald-600 text-white p-3 rounded-full shadow-lg hover:bg-emerald-700 transition-colors duration-300 flex flex-col items-center">
//               <Calculator className="w-6 h-6 mb-1" />
//               <div className="text-xs font-semibold">Calculator</div>
//             </div>
//             <div className="text-emerald-600 mt-2 text-sm font-medium">
//               Try Our Calculator
//             </div>
//             <svg
//               className="w-6 h-6 mt-1 text-emerald-600"
//               fill="none"
//               viewBox="0 0 24 24"
//               stroke="currentColor"
//             >
//               {" "}
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M19 14l-7 7m0 0l-7-7m7 7V3"
//               />{" "}
//             </svg>
//           </div>
//         )}
//         {/* Team Usage Benefits Card (Keep as is, maybe update text slightly) */}
//         <div className="mt-16 max-w-3xl mx-auto">
//           <Card className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-0 shadow-md overflow-hidden relative">
//             <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5"></div>
//             <CardHeader>
//               <CardTitle className="text-xl text-emerald-300 flex items-center">
//                 <Users className="w-5 h-5 mr-2 text-emerald-600" />
//                 Team Plan Benefit
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="flex items-start space-x-3">
//                 <div className="mt-1 bg-emerald-500/10 rounded-full p-1">
//                   <Check className="flex-shrink-0 w-4 h-4 text-emerald-600" />
//                 </div>
//                 <p className="text-emerald-900">
//                   <span className="font-medium">Usage Included:</span>{" "}
//                   Interactions from invited team members using Blueprints within
//                   your workspace do not count towards individual usage limits or
//                   incur overage charges. Pay a flat fee per seat.
//                 </p>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//         {/* Blueprint Usage Calculator (Keep as is) */}
//         <div
//           id="calculator"
//           className="mt-16 max-w-3xl mx-auto"
//           style={{ scrollMarginTop: "100px" }}
//         >
//           <Card className="overflow-hidden border border-white/10 shadow-lg">
//             <CardHeader className="border-b bg-white/5">
//               <CardTitle className="flex items-center text-xl">
//                 <Calculator className="w-5 h-5 mr-2 text-emerald-600" />
//                 Plus Plan Usage Calculator
//               </CardTitle>
//               <CardDescription>
//                 Estimate monthly hours needed for the <strong>Plus</strong> plan
//                 based on customer traffic. (Not applicable to Team plan).
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-8 pt-8">
//               {/* ... (calculator inputs remain the same) ... */}
//               {/* Customer Count & Basis */}
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-slate-300 flex items-center">
//                   <Users className="w-4 h-4 mr-2 text-emerald-500" />
//                   Number of Customers
//                 </Label>
//                 <div className="flex items-center space-x-4">
//                   <select
//                     value={customerCount}
//                     onChange={(e) => setCustomerCount(Number(e.target.value))}
//                     className="p-2 border rounded-md border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50 bg-white/5"
//                   >
//                     {" "}
//                     <option value={100}>100</option>{" "}
//                     <option value={250}>250</option>{" "}
//                     <option value={500}>500</option>{" "}
//                     <option value={1000}>1000</option>{" "}
//                     <option value={5000}>5000</option>{" "}
//                     <option value={10000}>10000</option>{" "}
//                   </select>
//                   <Input
//                     type="number"
//                     value={customerCount}
//                     onChange={(e) => setCustomerCount(Number(e.target.value))}
//                     className="w-24 border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50"
//                   />
//                   <select
//                     value={customerBasis}
//                     onChange={(e) =>
//                       setCustomerBasis(
//                         e.target.value as "day" | "week" | "month",
//                       )
//                     }
//                     className="p-2 border rounded-md border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50 bg-white/5"
//                   >
//                     {" "}
//                     <option value="day">Per Day</option>{" "}
//                     <option value="week">Per Week</option>{" "}
//                     <option value="month">Per Month</option>{" "}
//                   </select>
//                 </div>
//               </div>
//               {/* Average Visit Duration */}
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-slate-300 flex items-center">
//                   {" "}
//                   <Clock className="w-4 h-4 mr-2 text-emerald-500" /> Average
//                   Visit Duration (minutes){" "}
//                 </Label>
//                 <div className="flex items-center space-x-4">
//                   <select
//                     value={avgVisitDuration}
//                     onChange={(e) =>
//                       setAvgVisitDuration(Number(e.target.value))
//                     }
//                     className="p-2 border rounded-md border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50 bg-white/5"
//                   >
//                     {" "}
//                     <option value={15}>15</option>{" "}
//                     <option value={30}>30</option>{" "}
//                     <option value={45}>45</option>{" "}
//                     <option value={60}>60</option>{" "}
//                     <option value={90}>90</option>{" "}
//                     <option value={120}>120</option>{" "}
//                     <option value={180}>180</option>{" "}
//                   </select>
//                   <Input
//                     type="number"
//                     value={avgVisitDuration}
//                     onChange={(e) =>
//                       setAvgVisitDuration(Number(e.target.value))
//                     }
//                     className="w-24 border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50"
//                   />
//                 </div>
//               </div>
//               {/* Blueprint Adoption Percentage */}
//               <div className="space-y-3">
//                 <Label className="text-sm font-medium text-slate-300 flex items-center">
//                   {" "}
//                   <Sparkles className="w-4 h-4 mr-2 text-emerald-500" />{" "}
//                   Percentage of Visitors Using Blueprint (%){" "}
//                 </Label>
//                 <div className="flex items-center space-x-4">
//                   <select
//                     value={adoptionPercentage}
//                     onChange={(e) =>
//                       setAdoptionPercentage(Number(e.target.value))
//                     }
//                     className="p-2 border rounded-md border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50 bg-white/5"
//                   >
//                     {" "}
//                     <option value={10}>10%</option>{" "}
//                     <option value={20}>20%</option>{" "}
//                     <option value={30}>30%</option>{" "}
//                     <option value={40}>40%</option>{" "}
//                     <option value={50}>50%</option>{" "}
//                   </select>
//                   <Input
//                     type="number"
//                     value={adoptionPercentage}
//                     onChange={(e) =>
//                       setAdoptionPercentage(Number(e.target.value))
//                     }
//                     className="w-24 border-white/20 text-slate-100 focus:border-emerald-500 focus:ring focus:ring-emerald-500/20 focus:ring-opacity-50"
//                   />
//                 </div>
//                 <p className="text-sm text-slate-400">
//                   {" "}
//                   Default is 10% (average so far).{" "}
//                 </p>
//               </div>
//               {/* Calculation Result */}
//               <div className="border-t border-white/10 pt-6 mt-6">
//                 <div className="flex justify-between items-center">
//                   <span className="text-lg font-medium text-slate-300">
//                     {" "}
//                     Estimated Monthly Blueprint Usage:{" "}
//                   </span>
//                   <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600">
//                     {" "}
//                     {estimatedBlueprintUsage.toFixed(2)} hrs{" "}
//                   </span>
//                 </div>
//               </div>
//             </CardContent>
//             <CardFooter className="flex space-x-2 py-6 bg-white/5 border-t border-white/10">
//               <Button
//                 className="w-full bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
//                 onClick={calculateBlueprintUsage}
//               >
//                 {" "}
//                 Calculate Usage{" "}
//               </Button>
//               <Button
//                 variant="outline"
//                 className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
//                 onClick={handleUseThisEstimate}
//               >
//                 {" "}
//                 Use Estimate for Plus Plan{" "}
//               </Button>
//             </CardFooter>
//           </Card>
//         </div>
//       </div>{" "}
//       {/* FAQs */}
//       <motion.div variants={itemVariants} className="mb-10">
//         <div className="text-center mb-8">
//           <h2 className="text-2xl font-bold text-white">
//             Frequently Asked Questions
//           </h2>
//           <p className="text-slate-400 mt-2">
//             Have questions about plans? We've got answers.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {[
//             {
//               question: "How does the usage-based pricing work?",
//               answer:
//                 "Our pricing is based on the total hours your customers spend interacting with your Blueprints. You only pay for what you use, with volume discounts as your usage increases.",
//             },
//             {
//               question: "What happens if I exceed my chosen hours?",
//               answer:
//                 "If you exceed your chosen hours on the Plus plan, you'll be charged the overage rate for each additional hour used. This is slightly higher than your base rate.",
//             },
//             {
//               question: "Can I upgrade or downgrade at any time?",
//               answer:
//                 "Yes, you can upgrade to Plus at any time. Downgrades take effect at the end of your current billing cycle.",
//             },
//             {
//               question: "Are there any additional fees?",
//               answer:
//                 "No, there are no hidden fees. The price you see is the price you pay based on your usage and chosen plan.",
//             },
//           ].map((faq, index) => (
//             <Card key={index} className="border border-white/10">
//               <CardHeader className="pb-2">
//                 <CardTitle className="text-base font-medium text-white">
//                   {faq.question}
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <p className="text-sm text-slate-400">{faq.answer}</p>
//               </CardContent>
//             </Card>
//           ))}
//         </div>
//       </motion.div>
//       {/* Need Help Section */}
//       <motion.div variants={itemVariants} className="mb-16">
//         <Card className="border-0 shadow-md bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
//           <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between">
//             <div className="mb-6 md:mb-0">
//               <h3 className="text-xl font-bold text-white mb-2">
//                 Need Help Choosing?
//               </h3>
//               <p className="text-slate-400">
//                 Our team is ready to help you find the perfect plan for your
//                 needs.
//               </p>
//             </div>
//             <Button className="bg-white/5 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/10 shadow-sm">
//               Contact Support
//             </Button>
//           </CardContent>
//         </Card>
//       </motion.div>
//       {/* End Main Content Container */}
//       <Footer />
//       <LindyChat />
//       <WorkspaceNameModal
//         isOpen={isWorkspaceNameOpen}
//         onClose={() => setIsWorkspaceNameOpen(false)}
//         workspaceName={workspaceName}
//         setWorkspaceName={setWorkspaceName}
//         onContinue={handleWorkspaceContinue}
//         isProcessing={isCheckingOut}
//       />
//     </div> // End Root Div
//   );
// }
