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

const capitalScopeBars = [
  {
    id: "fprime-slice",
    label: "F-Prime general-purpose slice",
    detail: "US, Europe, and Israel; humanoids plus robot-brain companies",
    valueLabel: "$4.9B",
    width: "35%",
  },
  {
    id: "all-robotics-vc",
    label: "Crunchbase robotics VC, 2025",
    detail: "Broader robotics venture funding across humanoid and non-humanoid startups",
    valueLabel: "~$14B",
    width: "100%",
  },
];

const flagshipRaises = [
  {
    company: "Figure",
    value: ">$1B",
    label: "Series C in September 2025",
    sourceLabel: "Figure",
    sourceHref: "https://www.figure.ai/news/series-c",
  },
  {
    company: "Skild AI",
    value: "$1.4B",
    label: "Series C in January 2026",
    sourceLabel: "Skild AI",
    sourceHref: "https://www.skild.ai/blogs/series-c",
  },
  {
    company: "Physical Intelligence",
    value: "$1.1B",
    label: "reported across November 2024 and November 2025 rounds",
    sourceLabel: "CNBC + Bloomberg",
    sourceHref:
      "https://www.bloomberg.com/news/articles/2025-11-20/robotics-startup-physical-intelligence-valued-at-5-6-billion-in-new-funding",
  },
  {
    company: "Apptronik",
    value: "$935M",
    label: "Series A total by February 2026",
    sourceLabel: "Apptronik",
    sourceHref: "https://apptronik.com/news-collection/apptronik-closes-over-935-million-series-a",
  },
];

const deploymentStats = [
  {
    value: "~16k",
    label: "global humanoid installations in 2025",
  },
  {
    value: ">80%",
    label: "of those installations were in China",
  },
  {
    value: "<20",
    label: "companies Gartner expects in production by 2028",
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
    label: "Crunchbase robotics funding",
    href: "https://news.crunchbase.com/venture/beyond-ai-growing-startup-sectors-legal-robotics-defense/",
  },
  {
    label: "Counterpoint via Robotics & Automation News",
    href: "https://roboticsandautomationnews.com/2026/01/30/global-humanoid-robot-installations-reach-16000-units-as-commercial-deployments-accelerate/98422/",
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
  description = "The data points are different, but the story is consistent: broad robotics already runs at industrial scale while humanoid and embodied-AI capital is outrunning repeatable production deployments.",
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
                <p className="text-sm font-semibold text-white">Humanoids and robot-brain companies are pulling in real capital</p>
                <p className="text-sm text-zinc-400">The narrow category was understating the wave. The deployment bottleneck is still real.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Funding scope matters
              </p>
              <div className="mt-4 space-y-4">
                {capitalScopeBars.map((bar) => (
                  <div key={bar.id}>
                    <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                      <span className="text-zinc-300">{bar.label}</span>
                      <span className="font-semibold text-white">{bar.valueLabel}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10">
                      <div
                        className="h-3 rounded-full bg-emerald-400"
                        style={{ width: bar.width }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{bar.detail}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                F-Prime&apos;s $4.9B run rate is real, but it is a narrower category. Its own
                definition includes humanoid form factors and foundational robot models. We do not
                count broad platform capex from Tesla or NVIDIA here because the allocation is too
                broad to label as direct humanoid spend.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Flagship disclosed raises
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {flagshipRaises.map((raise) => (
                  <div key={raise.company} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-sm font-semibold text-white">{raise.company}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-white">{raise.value}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">{raise.label}</p>
                    <a
                      href={raise.sourceHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white"
                    >
                      {raise.sourceLabel}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Yet deployments are still narrow
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {deploymentStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{stat.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                The 2025 installation estimate includes research, data collection, entertainment,
                and early industrial use cases. It should not be read as 16,000 mature Western
                factory rollouts.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-semibold text-white">
                The actual positioning point
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                Capital is not the limiting factor. The limiting factor is turning facility-specific
                uncertainty into site-ready deployment evidence before the pilot burns time and
                money.
              </p>
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
