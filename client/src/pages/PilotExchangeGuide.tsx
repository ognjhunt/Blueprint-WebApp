import { useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { analyticsEvents } from "@/components/Analytics";
import {
  activationArtifacts,
  activationSignals,
  confidenceBands,
  exchangeBusinessModelCards,
  failureAttribution,
  monetizationMix,
  ownershipOptions,
  pilotExchangeFaq,
  readinessFunnel,
  readinessGates,
  workflowValidationChecks,
} from "@/data/pilotExchange";
import type { ReadinessGate } from "@/types/pilot-exchange";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Coins,
  ShieldCheck,
} from "lucide-react";

const readinessChartConfig = {
  teams: {
    label: "Teams",
    color: "hsl(160 84% 39%)",
  },
} satisfies ChartConfig;

const confidenceChartConfig = {
  low: {
    label: "Low",
    color: "hsl(355 78% 56%)",
  },
  median: {
    label: "Median",
    color: "hsl(210 92% 47%)",
  },
  high: {
    label: "High",
    color: "hsl(160 84% 39%)",
  },
} satisfies ChartConfig;

const failureChartConfig = {
  percent: {
    label: "Risk Share",
    color: "hsl(214 32% 40%)",
  },
} satisfies ChartConfig;

const monetizationChartConfig = {
  percent: {
    label: "Revenue Share",
    color: "hsl(262 83% 58%)",
  },
} satisfies ChartConfig;

const failureColors = ["#7dd3fc", "#34d399", "#fbbf24", "#f97316", "#f87171"];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(80%_80%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-pilot-exchange-guide"
          width={44}
          height={44}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 44V.5H44" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern-pilot-exchange-guide)"
      />
    </svg>
  );
}

export default function PilotExchangeGuide() {
  const [selectedGateId, setSelectedGateId] = useState<string>(() => readinessGates[0]?.id || "");

  const selectedGate = useMemo<ReadinessGate | null>(() => {
    if (!selectedGateId) {
      return readinessGates[0] ?? null;
    }
    return readinessGates.find((gate) => gate.id === selectedGateId) ?? readinessGates[0] ?? null;
  }, [selectedGateId]);

  useEffect(() => {
    analyticsEvents.pilotExchangeView();
    analyticsEvents.pilotExchangeChartView("readiness_funnel");
    analyticsEvents.pilotExchangeChartView("confidence_band");
    analyticsEvents.pilotExchangeChartView("failure_attribution");
    analyticsEvents.pilotExchangeChartView("monetization_mix");
  }, []);

  return (
    <>
      <SEO
        title="Pilot Exchange Guide"
        description="Beginner guide to how Pilot Exchange pre-qualifies humanoid and robotics policies before controlled on-site pilot ramp."
        canonical="/pilot-exchange-guide"
      />
      <div className="relative min-h-screen overflow-hidden bg-white text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
        <DotPattern />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-gradient-to-br from-cyan-100/70 via-emerald-50/70 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Beginner Guide
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              What Pilot Exchange Is and How It Works
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-600">
              Pilot Exchange is a pre-deployment qualification workflow. It helps teams test robot
              policies on calibrated digital twins before spending on full live pilots.
            </p>
            <p className="mt-3 max-w-3xl text-sm text-zinc-500">
              This reduces pilot risk. It does not guarantee production success.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="/pilot-exchange">
                <Button className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">
                  Open Exchange Marketplace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="/contact">
                <Button variant="outline" className="rounded-full px-6 py-2.5">
                  Talk to the Team
                </Button>
              </a>
            </div>
          </section>

          <section className="mb-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="text-xl font-semibold text-emerald-900">What this is</h2>
              <ul className="mt-3 space-y-2 text-sm text-emerald-900/90">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  A staged qualification process before on-site rollout.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Standardized evaluation harness so teams are scored the same way.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Humanoid-first testing with integration and fallback checks.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-xl font-semibold text-amber-900">What this is not</h2>
              <ul className="mt-3 space-y-2 text-sm text-amber-900/90">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Not a production guarantee.
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Not a replacement for safety validation and SAT.
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Not a one-click shortcut for every site edge case.
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-zinc-900">7-Stage Readiness Flow</h2>
              <p className="text-xs font-medium text-zinc-500">Ordered gates, no shortcuts</p>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              Teams move through these gates before a controlled pilot ramp.
            </p>
            <div className="mt-5 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                {readinessGates.map((gate, index) => (
                  <button
                    key={gate.id}
                    type="button"
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedGate?.id === gate.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                    }`}
                    onClick={() => {
                      setSelectedGateId(gate.id);
                      analyticsEvents.pilotExchangeSelectReadinessGate(gate.title);
                    }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Stage {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">{gate.title}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                {selectedGate ? (
                  <>
                    <h3 className="text-lg font-semibold text-zinc-900">{selectedGate.title}</h3>
                    <p className="mt-2 text-sm text-zinc-700">{selectedGate.description}</p>
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Why this matters
                      </p>
                      <p className="mt-1 text-sm text-emerald-900">{selectedGate.whyItMatters}</p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mb-10 grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-900">Real-to-Sim Activation</h2>
              <p className="mt-2 text-sm text-zinc-600">
                SimReady assets improve fidelity, but calibration and on-site ramp are still needed.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Input Signals
                  </p>
                  <ul className="mt-2 space-y-2">
                    {activationSignals.map((signal) => (
                      <li key={signal.id} className="text-xs text-zinc-700">
                        <span className="font-semibold text-zinc-900">{signal.label}:</span>{" "}
                        {signal.description}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Output Artifacts
                  </p>
                  <ul className="mt-2 space-y-2">
                    {activationArtifacts.map((artifact) => (
                      <li key={artifact.id} className="text-xs text-zinc-700">
                        <span className="font-semibold text-zinc-900">{artifact.label}:</span>{" "}
                        {artifact.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-900">
                Workflow + Integration Validation
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                The hardest pilot failures usually come from integration and operations logic.
              </p>
              <div className="mt-4 space-y-3">
                {workflowValidationChecks.map((group) => (
                  <div key={group.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-900">{group.label}</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                      {group.checks.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-zinc-400 text-zinc-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900">Qualification Graphs</h2>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Illustrative demo data
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              These charts are for pre-qualification guidance, not production guarantees.
            </p>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Readiness Funnel</h3>
                <ChartContainer config={readinessChartConfig} className="mt-3 h-64 w-full">
                  <BarChart data={readinessFunnel} margin={{ top: 12, right: 8, left: -20, bottom: 78 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="stage"
                      tickLine={false}
                      axisLine={false}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      height={84}
                    />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="teams" fill="var(--color-teams)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Confidence Bands</h3>
                <ChartContainer config={confidenceChartConfig} className="mt-3 h-64 w-full">
                  <LineChart data={confidenceBands} margin={{ top: 12, right: 8, left: -20, bottom: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="task" tickLine={false} axisLine={false} interval={0} height={64} />
                    <YAxis domain={[40, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeWidth={2} dot={false} />
                    <Line
                      type="monotone"
                      dataKey="median"
                      stroke="var(--color-median)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Failure Attribution</h3>
                <ChartContainer config={failureChartConfig} className="mt-3 h-64 w-full">
                  <BarChart data={failureAttribution} margin={{ top: 12, right: 8, left: -20, bottom: 28 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
                    <YAxis />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-zinc-900">
                                {value}% risk share
                              </p>
                              <p className="max-w-[220px] text-xs text-zinc-600">
                                {String(item.payload.note)}
                              </p>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="percent" radius={[6, 6, 0, 0]}>
                      {failureAttribution.map((slice, index) => (
                        <Cell key={slice.id} fill={failureColors[index % failureColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </article>
            </div>
          </section>

          <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-zinc-700" />
              <h2 className="text-2xl font-bold text-zinc-900">Who Pays for What</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              Default model keeps site onboarding simple while monetizing robotics usage.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {exchangeBusinessModelCards.map((card) => (
                <article key={card.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {card.payer}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{card.title}</p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">{card.pricing}</p>
                  <p className="mt-1 text-xs text-zinc-600">{card.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Ownership Options</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {ownershipOptions.map((option) => (
                  <article key={option.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-sm font-semibold text-zinc-900">{option.name}</p>
                    <p className="mt-1 text-xs text-zinc-600">Owner: {option.owner}</p>
                    <p className="mt-1 text-xs text-zinc-600">Site cost: {option.siteCost}</p>
                    <p className="mt-1 text-xs text-zinc-600">{option.exchangeUsage}</p>
                    <p className="mt-2 text-xs text-zinc-500">{option.note}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">Monetization Mix</h3>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  Illustrative demo data
                </span>
              </div>
              <ChartContainer config={monetizationChartConfig} className="mt-3 h-56 w-full">
                <BarChart data={monetizationMix} margin={{ top: 8, right: 8, left: -20, bottom: 30 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="stream" tickLine={false} axisLine={false} interval={0} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="percent" fill="var(--color-percent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </section>

          <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-900">FAQ</h2>
            <Accordion
              type="single"
              collapsible
              className="mt-4"
              onValueChange={(value) => {
                if (value) {
                  analyticsEvents.pilotExchangeOpenFaq(value);
                }
              }}
            >
              {pilotExchangeFaq.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Ready to test your policy?</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                  Use the exchange marketplace to purchase access, submit your robot policy package,
                  and get standardized evaluation scorecards.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="/pilot-exchange">
                  <Button className="rounded-full bg-white text-zinc-900 hover:bg-zinc-200">
                    Open Marketplace
                  </Button>
                </a>
                <a href="/contact">
                  <Button
                    variant="outline"
                    className="rounded-full border-zinc-500 text-white hover:bg-zinc-800"
                  >
                    Talk to Sales
                  </Button>
                </a>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-zinc-800/70 px-3 py-1 text-xs text-zinc-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Final deployment decisions still require SAT and controlled pilot ramp.
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
