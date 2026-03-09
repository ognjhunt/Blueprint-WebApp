import { ArrowUpRight, BarChart3, Factory, Bot } from "lucide-react";

const scaledRoboticsStats = [
  {
    value: "542k",
    label: "industrial robots installed in 2024",
    sourceLabel: "IFR industrial robots",
    sourceHref:
      "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years%20%20%20",
  },
  {
    value: "4.664M",
    label: "industrial robots operating worldwide in 2024",
    sourceLabel: "IFR industrial robots",
    sourceHref:
      "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years%20%20%20",
  },
  {
    value: "~200k",
    label: "professional service robots sold in 2024",
    sourceLabel: "IFR service robots",
    sourceHref: "https://ifr.org/news/service-robots-see-global-growth-boom/1st-",
  },
  {
    value: "1M",
    label: "Amazon robots deployed across 300+ facilities",
    sourceLabel: "Amazon",
    sourceHref: "https://www.aboutamazon.com/news/operations/amazon-million-robots-ai-foundation-model/",
  },
];

const humanoidFundingBars = [
  { year: "2024", value: 1.9, label: "$1.9B", width: "39%" },
  { year: "2025 run rate", value: 4.9, label: "$4.9B", width: "100%" },
];

const mismatchStats = [
  {
    value: "$20.9B",
    label: "projected 2025 robotics funding across US, European, and Israeli companies",
  },
  {
    value: "<100",
    label: "companies Gartner expects to move humanoid proofs beyond experimentation by 2028",
  },
  {
    value: "<20",
    label: "companies Gartner expects to reach production deployments by 2028",
  },
];

const sourceLinks = [
  {
    label: "IFR industrial robots",
    href: "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years%20%20%20",
  },
  {
    label: "IFR service robots",
    href: "https://ifr.org/news/service-robots-see-global-growth-boom/1st-",
  },
  {
    label: "Amazon robotics",
    href: "https://www.aboutamazon.com/news/operations/amazon-million-robots-ai-foundation-model/",
  },
  {
    label: "F-Prime State of Robotics H1 2025",
    href: "https://fprimecapital.com/wp-content/uploads/2025/10/State-of-Robotics-H1-2025.pdf",
  },
  {
    label: "Gartner Jan 21, 2026",
    href: "https://www.gartner.com/en/newsroom/press-releases/2026-01-21-gartner-predicts-fewer-than-20-companies-will-scale-humanoid-robots-for-manufacturing-and-supply-chain-to-production-stage-by-2028",
  },
];

type MarketSignalsSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function MarketSignalsSection({
  eyebrow = "Market Signal",
  title = "Robotics is scaled. Humanoid production still is not.",
  description = "The data points are different, but the story is consistent: broad robotics already runs at industrial scale while humanoid capital is outrunning repeatable production deployments.",
}: MarketSignalsSectionProps) {
  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-600">
            <BarChart3 className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-lg">
            {description}
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <Factory className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Broad robotics is already real</p>
                <p className="text-sm text-zinc-500">Scaled deployments across factories, logistics, and service operations.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {scaledRoboticsStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-3xl font-bold tracking-tight text-zinc-950">{stat.value}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{stat.label}</p>
                  <a
                    href={stat.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                  >
                    {stat.sourceLabel}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-2 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Humanoid capital is moving faster than deployments</p>
                <p className="text-sm text-zinc-400">Funding growth is visible. Production rollout is still narrow.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                General-purpose robotics funding
              </p>
              <div className="mt-4 space-y-4">
                {humanoidFundingBars.map((bar) => (
                  <div key={bar.year}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{bar.year}</span>
                      <span className="font-semibold text-white">{bar.label}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10">
                      <div
                        className="h-3 rounded-full bg-emerald-400"
                        style={{ width: bar.width }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                F-Prime shows general-purpose robotics funding rising from $1.9B in 2024 to a
                $4.9B 2025 run rate.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {mismatchStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{stat.label}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-600">Sources:</span>
          {sourceLinks.map((source) => (
            <a
              key={source.label}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-zinc-800"
            >
              {source.label}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
