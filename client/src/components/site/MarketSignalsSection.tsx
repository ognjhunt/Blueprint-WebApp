import { ArrowUpRight, BarChart3 } from "lucide-react";

const marketProofPoints = [
  {
    value: "542k",
    label: "industrial robots installed in 2024",
    sourceLabel: "IFR industrial robots",
    sourceHref:
      "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years%20%20%20",
  },
  {
    value: "1M",
    label: "Amazon robots deployed across 300+ facilities",
    sourceLabel: "Amazon",
    sourceHref: "https://www.aboutamazon.com/news/operations/amazon-million-robots-ai-foundation-model/",
  },
  {
    value: "<20",
    label: "companies Gartner expects to reach humanoid production by 2028",
    sourceLabel: "Gartner",
    sourceHref:
      "https://www.gartner.com/en/newsroom/press-releases/2026-01-21-gartner-predicts-fewer-than-20-companies-will-scale-humanoid-robots-for-manufacturing-and-supply-chain-to-production-stage-by-2028",
  },
];

const sourceLinks = [
  {
    label: "IFR industrial robots",
    href: "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years%20%20%20",
  },
  {
    label: "Amazon robotics",
    href: "https://www.aboutamazon.com/news/operations/amazon-million-robots-ai-foundation-model/",
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
  title = "Robotics is real. Deployment readiness is still the bottleneck.",
  description = "Robotics already runs at scale. Humanoid interest is rising fast, but repeatable deployments still depend on task fit, site readiness, safety, and clear pass criteria.",
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

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {marketProofPoints.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-3xl font-bold tracking-tight text-zinc-950">{stat.value}</p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{stat.label}</p>
              <a
                href={stat.sourceHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                {stat.sourceLabel}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">The takeaway</p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-200">
            Demand is not the hard part. The hard part is turning a real site into a clear task,
            a real bar, and a pilot the right team can actually pass.
          </p>
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
