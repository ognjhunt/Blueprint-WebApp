import { useEffect } from "react";
import { SEO } from "@/components/SEO";
import { analyticsEvents } from "@/components/Analytics";
import {
  activationArtifacts,
  activationSignals,
  coreGapConcepts,
  correlationSignals,
  confidenceBands,
  exchangeBusinessModelCards,
  failureAttribution,
  ownershipOptions,
  pilotExchangeFaq,
  readinessFunnel,
  readinessGates,
  researchSourceLinks,
  researchDeltaPoints,
  sim2RealBridgeSteps,
  trainingEvidencePoints,
  trainingPricingLanes,
  trainingWorkflowSteps,
  workflowValidationChecks,
} from "@/data/pilotExchange";
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
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  HelpCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

// Updated to elegant grayscale color palette
const readinessChartConfig = {
  teams: {
    label: "Teams",
    color: "#18181b", // zinc-900
  },
} satisfies ChartConfig;

const confidenceChartConfig = {
  low: {
    label: "Low",
    color: "#d4d4d8", // zinc-300
  },
  median: {
    label: "Median",
    color: "#71717a", // zinc-500
  },
  high: {
    label: "High",
    color: "#18181b", // zinc-900
  },
} satisfies ChartConfig;

const failureChartConfig = {
  percent: {
    label: "Risk Share",
    color: "#3f3f46", // zinc-700
  },
} satisfies ChartConfig;

const researchDeltaChartConfig = {
  deltaPercent: {
    label: "Reported Improvement (%)",
    color: "#18181b", // zinc-900
  },
} satisfies ChartConfig;

// Grayscale palette for the pie/bar slices
const failureColors = ["#18181b", "#3f3f46", "#71717a", "#a1a1aa", "#e4e4e7"];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200/60 [mask-image:radial-gradient(80%_80%_at_top_right,black,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-pilot-exchange-guide"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-pilot-exchange-guide)" />
    </svg>
  );
}

export default function PilotExchangeGuide() {
  useEffect(() => {
    analyticsEvents.pilotExchangeView();
    analyticsEvents.pilotExchangeChartView("readiness_funnel");
    analyticsEvents.pilotExchangeChartView("confidence_band");
    analyticsEvents.pilotExchangeChartView("failure_attribution");
    analyticsEvents.pilotExchangeChartView("research_delta");
  }, []);

  return (
    <>
      <SEO
        title="Pilot Exchange Guide"
        description="Beginner guide to how Pilot Exchange pre-qualifies humanoid and robotics policies before controlled on-site pilot ramp."
        canonical="/pilot-exchange-guide"
      />
      <div className="relative min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900">
        <DotPattern />

        <main className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* Header Section */}
          <section className="mb-20 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-zinc-600 mb-6">
              Beginner's Guide
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 mb-6">
              How Pilot Exchange Works
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed mb-8">
              Pilot Exchange is a pre-deployment qualification workflow. We help teams test robot policies on calibrated digital twins before spending money and time on physical, live pilots.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/pilot-exchange">
                <Button className="bg-zinc-900 text-white hover:bg-zinc-800 px-6 py-5 text-sm font-medium">
                  Open Marketplace <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
              <a href="/contact" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-300">
                Talk to our team
              </a>
            </div>
          </section>

          {/* Is / Isn't Section */}
          <section className="mb-20 grid sm:grid-cols-2 gap-8 border-y border-zinc-200 py-12">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-zinc-900" /> What this is
              </h2>
              <ul className="space-y-3 text-zinc-600">
                <li className="flex gap-3"><span className="text-zinc-300 mt-1">•</span> A staged qualification process before on-site rollout.</li>
                <li className="flex gap-3"><span className="text-zinc-300 mt-1">•</span> A standardized evaluation harness so all teams are scored fairly.</li>
                <li className="flex gap-3"><span className="text-zinc-300 mt-1">•</span> A safe environment for integration and fallback checks.</li>
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-zinc-400" /> What this is NOT
              </h2>
              <ul className="space-y-3 text-zinc-600">
                <li className="flex gap-3"><span className="text-zinc-300 mt-1">•</span> A 100% guarantee of production success.</li>
                <li className="flex gap-3"><span className="text-zinc-300 mt-1">•</span> A replacement for physical safety validation (SAT).</li>
                <li className="flex gap-3"><span className="text-zinc-300 mt-1">•</span> A magical shortcut that bypasses real-world edge cases.</li>
              </ul>
            </div>
          </section>

          <section className="mb-24">
            <div className="max-w-3xl mb-8">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">The Core Deployment Gap</h2>
              <p className="text-zinc-600">
                Pilot Exchange exists to reduce the lab-to-site drop. These are related problems, but they are not the same step in the pipeline.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {coreGapConcepts.map((item) => (
                <div key={item.id} className="border border-zinc-200 rounded-2xl p-6 bg-white">
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-600 mb-4">{item.summary}</p>
                  <p className="text-sm text-zinc-800 bg-zinc-50 border border-zinc-100 rounded-lg p-4">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-24">
            <div className="max-w-3xl mb-8">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">Capture vs Adaptation</h2>
              <p className="text-zinc-600">
                Site capture gives geometry. Site adaptation makes that geometry behave like the real facility for policy transfer.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {sim2RealBridgeSteps.map((step) => (
                <div key={step.id} className="border border-zinc-200 rounded-2xl p-6 bg-zinc-50/50">
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-zinc-600 mb-4">{step.summary}</p>
                  <ul className="space-y-2 mb-4">
                    {step.checklist.map((item) => (
                      <li key={item} className="text-sm text-zinc-600 flex gap-2">
                        <Circle className="w-1.5 h-1.5 fill-zinc-300 text-zinc-300 shrink-0 mt-2" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="border border-zinc-200 rounded-lg bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Example</p>
                    <p className="text-sm text-zinc-800">{step.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7-Stage Process - Redesigned as a vertical timeline for easier reading */}
          <section className="mb-24">
            <div className="max-w-2xl mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">The 7-Stage Readiness Flow</h2>
              <p className="text-zinc-600">Teams must move through these sequential gates before a controlled pilot ramp. There are no shortcuts.</p>
            </div>

            <div className="space-y-6">
              {readinessGates.map((gate, index) => (
                <div key={gate.id} className="group flex gap-6 sm:gap-8 bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 hover:border-zinc-300 transition-colors">
                  <div className="hidden sm:flex flex-col items-center">
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100 text-zinc-900 font-bold font-mono text-sm border border-zinc-200">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-zinc-900 mb-2 flex items-center gap-3">
                      <span className="sm:hidden text-zinc-400 font-mono text-base">0{index + 1}</span>
                      {gate.title}
                    </h3>
                    <p className="text-zinc-600 mb-4">{gate.description}</p>
                    <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Why it matters</p>
                      <p className="text-sm text-zinc-800">{gate.whyItMatters}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Core Capabilities */}
          <section className="mb-24">
            <h2 className="text-3xl font-bold text-zinc-900 mb-8">Under the Hood</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-zinc-200 rounded-2xl p-8 bg-zinc-50/50">
                <h3 className="text-xl font-bold text-zinc-900 mb-3">Real-to-Sim Activation</h3>
                <p className="text-sm text-zinc-600 mb-6">Simulation assets are useless without calibration. We align the twin to reality using log sets.</p>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Inputs We Use</h4>
                    <ul className="space-y-3">
                      {activationSignals.map((sig) => (
                        <li key={sig.id} className="text-sm text-zinc-600 flex gap-2">
                          <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                          <span><strong className="text-zinc-900 font-semibold">{sig.label}:</strong> {sig.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Outputs We Generate</h4>
                    <ul className="space-y-3">
                      {activationArtifacts.map((art) => (
                        <li key={art.id} className="text-sm text-zinc-600 flex gap-2">
                          <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                          <span><strong className="text-zinc-900 font-semibold">{art.label}:</strong> {art.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border border-zinc-200 rounded-2xl p-8 bg-zinc-50/50">
                <h3 className="text-xl font-bold text-zinc-900 mb-3">Workflow Validation</h3>
                <p className="text-sm text-zinc-600 mb-6">The hardest pilot failures usually stem from logic and operations, not just motion planning.</p>
                
                <div className="space-y-6">
                  {workflowValidationChecks.map((group) => (
                    <div key={group.id}>
                      <h4 className="text-sm font-bold text-zinc-900 mb-2">{group.label}</h4>
                      <ul className="space-y-2">
                        {group.checks.map((item) => (
                          <li key={item} className="text-sm text-zinc-600 flex gap-2">
                            <Circle className="w-1.5 h-1.5 fill-zinc-300 text-zinc-300 shrink-0 mt-2" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Training Workflows */}
          <section className="mb-24 border-t border-zinc-200 pt-16">
            <div className="max-w-2xl mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">Does Twin Training Actually Work?</h2>
              <p className="text-zinc-600">In published robotics studies, yes. The strongest gains appear when policies get deployment-context data, not only broad general pretraining.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-16">
              {trainingEvidencePoints.map((point) => (
                <div key={point.id} className="bg-white border border-zinc-200 rounded-xl p-6">
                  {point.sourceUrl ? (
                    <a
                      href={point.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 inline-block underline underline-offset-4 decoration-zinc-300 hover:text-zinc-600"
                    >
                      {point.source}
                    </a>
                  ) : (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{point.source}</p>
                  )}
                  <p className="text-lg font-bold text-zinc-900 mb-2">{point.result}</p>
                  <p className="text-sm text-zinc-600">{point.note}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[2fr_1fr] gap-6 mb-16">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h3 className="font-bold text-zinc-900 mb-6">Reported Success Lift vs Baselines</h3>
                <ChartContainer config={researchDeltaChartConfig} className="h-64 w-full">
                  <BarChart data={researchDeltaPoints} margin={{ top: 12, right: 8, left: -20, bottom: 10 }}>
                    <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
                    <XAxis dataKey="study" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <ChartTooltip
                      cursor={{ fill: "#f4f4f5" }}
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => (
                            <div className="space-y-1 text-zinc-900">
                              <p className="font-bold">+{value}%</p>
                              <p className="text-xs text-zinc-500 max-w-[200px]">{String(item.payload.note)}</p>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="deltaPercent" fill="var(--color-deltaPercent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <p className="text-xs text-zinc-500 mt-4">
                  Not apples-to-apples. Values come from different tasks and benchmarks, shown directionally to compare adaptation strategies.
                </p>
              </div>

              <div className="space-y-4">
                {correlationSignals.map((signal) => (
                  <div key={signal.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{signal.label}</p>
                    <p className="text-2xl font-bold text-zinc-900 mb-1">{signal.value}</p>
                    <p className="text-sm text-zinc-600">{signal.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-zinc-200 rounded-2xl p-6 bg-zinc-50/60 mb-16">
              <h3 className="font-bold text-zinc-900 mb-4">What This Means for Pilot Exchange</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Mode 1</p>
                  <h4 className="font-semibold text-zinc-900 mb-2">Generalization Pack</h4>
                  <p className="text-sm text-zinc-600">Training across many scenes improves broad robustness, but does not memorize one facility.</p>
                </div>
                <div className="border-2 border-zinc-900 rounded-lg p-4 bg-white">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Mode 2 (Highest Value)</p>
                  <h4 className="font-semibold text-zinc-900 mb-2">Site-Specific Adaptation</h4>
                  <p className="text-sm text-zinc-600">Fine-tuning against the exact target facility creates strong visual and behavior priors for that deployment site.</p>
                </div>
                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Mode 3</p>
                  <h4 className="font-semibold text-zinc-900 mb-2">Runtime Conditioning</h4>
                  <p className="text-sm text-zinc-600">Emerging approach where a model receives scene context at inference time instead of only in weights.</p>
                </div>
              </div>
            </div>

            <div className="border border-zinc-200 rounded-2xl p-6 bg-white mb-16">
              <h3 className="font-bold text-zinc-900 mb-4">How Evaluation Changes by Policy Type</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Video World Models</p>
                  <p className="text-sm text-zinc-600">
                    Evaluation can run in pixel-space rollout loops (predicted future frames), which may not require full SimReady USD authoring for first-pass ranking.
                  </p>
                </div>
                <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Physics-Critical Policies</p>
                  <p className="text-sm text-zinc-600">
                    Contact-rich, safety-critical workflows still benefit from SimReady USD scenes for repeatable dynamics, integration checks, and SAT prep.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-zinc-200 rounded-2xl p-6 bg-white">
              <h3 className="font-bold text-zinc-900 mb-4">Research Sources</h3>
              <ul className="space-y-3">
                {researchSourceLinks.map((source) => (
                  <li key={source.id} className="text-sm text-zinc-600">
                    <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:text-zinc-700">
                      {source.label}
                    </a>
                    <span className="ml-2">{source.note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <h3 className="text-2xl font-bold text-zinc-900 mb-6">How Training Runs in Practice</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {trainingWorkflowSteps.map((step) => (
                <div key={step.id} className="relative pl-6 sm:pl-0 border-l sm:border-l-0 sm:border-t border-zinc-200 pt-6">
                  <div className="absolute left-0 top-0 sm:-top-3 -translate-x-[1px] sm:translate-x-0 w-3 h-3 rounded-full bg-zinc-900"></div>
                  <h4 className="text-lg font-bold text-zinc-900 mb-2">Step {step.step}: {step.title}</h4>
                  <p className="text-sm text-zinc-600 mb-4">{step.description}</p>
                  <ul className="space-y-2">
                    {step.checklist.map((item) => (
                      <li key={item} className="text-xs text-zinc-500 flex gap-2">
                        <span className="text-zinc-300">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Charts & Data */}
          <section className="mb-24 bg-zinc-50 border border-zinc-200 rounded-3xl p-6 sm:p-10">
            <div className="max-w-2xl mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">Industry Insights</h2>
              <p className="text-zinc-600">Pre-qualification guidance based on aggregated network data. (Illustrative metrics).</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Funnel */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h3 className="font-bold text-zinc-900 mb-6">Readiness Funnel</h3>
                <ChartContainer config={readinessChartConfig} className="h-64 w-full">
                  <BarChart data={readinessFunnel} margin={{ top: 12, right: 8, left: -20, bottom: 60 }}>
                    <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
                    <XAxis dataKey="stage" tickLine={false} axisLine={false} angle={-35} textAnchor="end" tick={{ fill: '#71717a', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <ChartTooltip cursor={{ fill: '#f4f4f5' }} content={<ChartTooltipContent />} />
                    <Bar dataKey="teams" fill="var(--color-teams)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>

              {/* Confidence Bands */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h3 className="font-bold text-zinc-900 mb-6">Task Confidence Bands</h3>
                <ChartContainer config={confidenceChartConfig} className="h-64 w-full">
                  <LineChart data={confidenceBands} margin={{ top: 12, right: 8, left: -20, bottom: 10 }}>
                    <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
                    <XAxis dataKey="task" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                    <YAxis domain={[40, 100]} tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-low)" }} />
                    <Line type="monotone" dataKey="median" stroke="var(--color-median)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-median)" }} />
                    <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-high)" }} />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>

            {/* Failure Attribution */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6">
              <h3 className="font-bold text-zinc-900 mb-6">Why Pilots Fail (Attribution)</h3>
              <ChartContainer config={failureChartConfig} className="h-64 w-full">
                <BarChart data={failureAttribution} margin={{ top: 12, right: 8, left: -20, bottom: 20 }}>
                  <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <ChartTooltip
                    cursor={{ fill: '#f4f4f5' }}
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => (
                          <div className="space-y-1 text-zinc-900">
                            <p className="font-bold">{value}% risk share</p>
                            <p className="text-xs text-zinc-500 max-w-[200px]">{String(item.payload.note)}</p>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
                    {failureAttribution.map((slice, index) => (
                      <Cell key={slice.id} fill={failureColors[index % failureColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </section>

          {/* Pricing & Business Model */}
          <section className="mb-24">
            <h2 className="text-3xl font-bold text-zinc-900 mb-8">Who Pays for What?</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {exchangeBusinessModelCards.map((card) => (
                <div key={card.id} className="border border-zinc-200 rounded-xl p-5 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Payer: {card.payer}</p>
                  <h3 className="font-bold text-zinc-900">{card.title}</h3>
                  <p className="font-mono text-sm font-semibold text-zinc-900 my-2">{card.pricing}</p>
                  <p className="text-xs text-zinc-600">{card.description}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Ownership Options</h3>
                <div className="space-y-4">
                  {ownershipOptions.map((opt) => (
                    <div key={opt.id} className="border border-zinc-200 rounded-xl p-5 bg-zinc-50">
                      <h4 className="font-bold text-zinc-900">{opt.name}</h4>
                      <p className="text-sm text-zinc-600 mt-2"><strong className="text-zinc-900">Owner:</strong> {opt.owner}</p>
                      <p className="text-sm text-zinc-600"><strong className="text-zinc-900">Usage:</strong> {opt.exchangeUsage}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Training Pricing Lanes</h3>
                <div className="space-y-4">
                  {trainingPricingLanes.map((lane) => (
                    <div key={lane.id} className="border border-zinc-200 rounded-xl p-5 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-zinc-900">{lane.title}</h4>
                        <span className="font-mono text-xs font-semibold bg-zinc-100 px-2 py-1 rounded text-zinc-900">{lane.pricing}</span>
                      </div>
                      <p className="text-sm text-zinc-600">{lane.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-24 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-zinc-900 mb-8 text-center flex items-center justify-center gap-2">
              <HelpCircle className="w-6 h-6 text-zinc-400" /> Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {pilotExchangeFaq.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="border-zinc-200">
                  <AccordionTrigger className="text-left font-semibold text-zinc-900 hover:text-zinc-600 hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-600 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Footer CTA */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 sm:p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-white mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl font-bold text-white mb-4">Ready to test your policy?</h2>
            <p className="max-w-xl mx-auto text-zinc-400 mb-8">
              Use the exchange marketplace to purchase access, submit your robot policy package, and receive standardized evaluation scorecards.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/pilot-exchange">
                <Button className="w-full sm:w-auto rounded-md bg-white text-zinc-900 hover:bg-zinc-200 px-8 py-6 text-base font-bold">
                  Open Marketplace
                </Button>
              </a>
              <a href="/contact">
                <Button variant="outline" className="w-full sm:w-auto rounded-md border-zinc-700 text-white hover:bg-zinc-800 hover:text-white px-8 py-6 text-base font-medium">
                  Talk to Sales
                </Button>
              </a>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
