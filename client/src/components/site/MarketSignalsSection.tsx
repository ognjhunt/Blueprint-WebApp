import { ArrowUpRight, BarChart3 } from "lucide-react";

type HumanoidEvidenceCard = {
  tag: string;
  title: string;
  summary: string;
  insight: string;
  imageSrc: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
};

const humanoidEvidenceCards: HumanoidEvidenceCard[] = [
  {
    tag: "Home demo",
    title: "Helix 02 can tidy a room without a person in the loop.",
    summary:
      "Figure's living-room demo shows real progress: navigation through clutter, mixed-object pickup, and handoffs inside one continuous task.",
    insight:
      "That matters. It still happens in a known room with a known goal. Most pilots break when the layout, safety rules, and pass bar stop being that clean.",
    imageSrc: "/images/humanoids/figure-helix-02-living-room.jpg",
    imageAlt: "Figure Helix 02 living room tidy demo thumbnail.",
    ctaLabel: "Watch demo",
    ctaHref: "https://www.figure.ai/news/helix-02-living-room-tidy",
  },
  {
    tag: "Live workflow",
    title: "Laundry is where capability starts to look operational.",
    summary:
      "Physical Intelligence and Weave chose a narrow job in a repeatable setting: moving, sorting, and handling laundry inside a business built around that flow.",
    insight:
      "That is the point. Constrained commercial spaces are where teams can learn what actually passes before they promise something more general.",
    imageSrc: "/images/humanoids/pi-weave-laundry.png",
    imageAlt: "Physical Intelligence and Weave laundromat workflow image.",
    ctaLabel: "Read source",
    ctaHref: "https://www.pi.website/blog/partner",
  },
  {
    tag: "Volume signal",
    title: "Humanoid volume is rising. Site readiness is not.",
    summary:
      "Agility built RoboFab in Oregon. Figure is already working line-side at BMW in Spartanburg. Tesla says Optimus Gen 3 is its first design meant for mass production, with first production planned before the end of 2026.",
    insight:
      "That shifts the bottleneck. More robots still means more live sites that need a task brief, a safety case, and a pass bar before anything scales cleanly.",
    imageSrc: "/images/humanoids/agility-digit-profile.jpg",
    imageAlt: "Industrial humanoid robot profile image from Agility Robotics.",
    ctaLabel: "Read Tesla update",
    ctaHref: "https://ir.tesla.com/_flysystem/s3/sec/000162828026003837/tsla-20260128-gen.pdf",
  },
];

const whyBlueprintExists = [
  {
    title: "The site is still the hard part",
    description:
      "A live facility adds layout drift, traffic, edge cases, and access rules that do not show up in a polished demo.",
  },
  {
    title: "The task needs a real pass bar",
    description:
      "A pilot only means something if the workflow, handoffs, fallback path, and success threshold are defined up front.",
  },
  {
    title: "More robots multiply deployment work",
    description:
      "As volume rises from pilots to thousands, the shortage is not just robots. It is qualified places to put them to work.",
  },
];

type TrajectorySignal = {
  year: string;
  metric: string;
  label: string;
  detail: string;
  heightClassName: string;
  tone: "early" | "actual" | "forecast";
};

const trajectorySignals: TrajectorySignal[] = [
  {
    year: "2023",
    metric: "RoboFab opens",
    label: "US factory buildout starts",
    detail:
      "Agility opened RoboFab in Oregon, the first humanoid robot factory, with planned annual capacity up to 10,000 units.",
    heightClassName: "h-10",
    tone: "early",
  },
  {
    year: "2024",
    metric: "GXO + Digit",
    label: "First multiyear rollout",
    detail:
      "GXO signed a multiyear agreement with Agility to deploy Digit across logistics operations in the United States.",
    heightClassName: "h-16",
    tone: "early",
  },
  {
    year: "2025",
    metric: "BMW Spartanburg",
    label: "Line-side work in South Carolina",
    detail:
      "Figure said one robot supported production associated with about 30,000 vehicles over 12 months at BMW's Spartanburg plant.",
    heightClassName: "h-28",
    tone: "actual",
  },
  {
    year: "2026E",
    metric: "Tesla line start",
    label: "First Optimus production planned",
    detail:
      "Tesla says its first Optimus production line is planned before the end of 2026.",
    heightClassName: "h-40",
    tone: "forecast",
  },
  {
    year: "2028",
    metric: "Short production list",
    label: "Scale is still narrow",
    detail:
      "Gartner expects fewer than 20 companies to reach production stage for humanoids in manufacturing and supply chain by 2028.",
    heightClassName: "h-56",
    tone: "forecast",
  },
];

const toneClassNames: Record<TrajectorySignal["tone"], string> = {
  early: "border-zinc-300 bg-zinc-200",
  actual: "border-emerald-500 bg-emerald-400",
  forecast: "border-amber-500 border-dashed bg-amber-300",
};

const sourceLinks = [
  {
    label: "Agility RoboFab",
    href: "https://www.agilityrobotics.com/content/opening-robofab-worlds-first-factory-for-humanoid-robots",
  },
  {
    label: "Figure Helix 02",
    href: "https://www.figure.ai/news/helix-02-living-room-tidy",
  },
  {
    label: "PI x Weave",
    href: "https://www.pi.website/blog/partner",
  },
  {
    label: "BMW x Figure pilot",
    href: "https://www.bmwgroup.com/en/news/general/2024/Figure.html",
  },
  {
    label: "Figure at BMW Spartanburg",
    href: "https://www.figure.ai/news/production-at-bmw",
  },
  {
    label: "Amazon tests Digit",
    href: "https://www.aboutamazon.com/news/operations/amazon-introduces-new-robotics-solutions",
  },
  {
    label: "GXO x Agility Digit rollout",
    href: "https://investors.gxo.com/news-releases/news-release-details/gxo-signs-industry-first-multi-year-agreement-agility-robotics",
  },
  {
    label: "Tesla Q4 2025 update",
    href: "https://ir.tesla.com/_flysystem/s3/sec/000162828026003837/tsla-20260128-gen.pdf",
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
  eyebrow = "Why We Exist",
  title = "The robot may work. The site is still the hard part.",
  description = "Robots do not usually fail because the demo was fake. They fail because the live site is different: different layout, traffic, handoffs, safety rules, and pass bar. Blueprint helps teams inspect that gap earlier, before pilot budget gets burned.",
}: MarketSignalsSectionProps) {
  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60 py-12 sm:py-16">
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

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
          <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Why Blueprint exists
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950">
              The demo is not the problem.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              The problem is whether the same system still passes once the real site adds
              variability, workflow constraints, and a real operating threshold.
            </p>
            <div className="mt-6 space-y-3">
              {whyBlueprintExists.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Market trajectory
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950">
                  Volume is going up fast. Deployment work does not disappear with it.
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Reported
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full border border-amber-500 bg-amber-300" />
                  Forecast
                </span>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600">
              US signals point in the same direction: factory buildout, named rollouts, and
              production plans are all moving forward. Each deployment still needs a site, a task,
              and a safety case.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Bar height is directional. The labels combine public milestones and forward-looking
              production signals because clean audited deployment counts are still rare.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {trajectorySignals.map((signal) => (
                <div key={signal.year} className="flex flex-col">
                  <div className="flex h-44 items-end rounded-3xl border border-zinc-200 bg-zinc-50 px-2 pb-2">
                    <div
                      className={`w-full rounded-2xl border ${signal.heightClassName} ${toneClassNames[signal.tone]}`}
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    {signal.year}
                  </p>
                  <p className="mt-1 text-sm font-bold text-zinc-950">{signal.metric}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">{signal.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {trajectorySignals.map((signal) => (
                <div
                  key={`${signal.year}-${signal.metric}`}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    {signal.year}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{signal.metric}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{signal.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mobile-snap-row mt-8 md:grid md:grid-cols-3 md:gap-5">
          {humanoidEvidenceCards.map((card) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="aspect-[4/3] overflow-hidden bg-zinc-200">
                <img
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-5 sm:p-6">
                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {card.tag}
                </span>
                <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-950">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{card.summary}</p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-800">{card.insight}</p>
                <a
                  href={card.ctaHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-zinc-700 hover:text-zinc-950"
                >
                  {card.ctaLabel}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">The takeaway</p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-200">
            Humanoid supply is starting to move. Deployment infrastructure is not. Blueprint exists
            to qualify the site, define the task, and make the pass bar explicit before a robot
            team burns time on a weak pilot.
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
