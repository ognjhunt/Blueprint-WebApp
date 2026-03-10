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
    tag: "Scale bottleneck",
    title: "Scaled humanoid production is still a short list.",
    summary:
      "Gartner expects fewer than 20 companies to reach humanoid production for manufacturing and supply chain by 2028.",
    insight:
      "The question now is not whether the demos are real. It is whether a team can turn one real site into a task, a safety case, and a pilot they can repeat.",
    imageSrc: "/images/humanoids/agility-digit-profile.jpg",
    imageAlt: "Industrial humanoid robot profile image from Agility Robotics.",
    ctaLabel: "Read source",
    ctaHref:
      "https://www.gartner.com/en/newsroom/press-releases/2026-01-21-gartner-predicts-fewer-than-20-companies-will-scale-humanoid-robots-for-manufacturing-and-supply-chain-to-production-stage-by-2028",
  },
];

const sourceLinks = [
  {
    label: "Figure Helix 02",
    href: "https://www.figure.ai/news/helix-02-living-room-tidy",
  },
  {
    label: "PI x Weave",
    href: "https://www.pi.website/blog/partner",
  },
  {
    label: "Gartner Jan 21, 2026",
    href: "https://www.gartner.com/en/newsroom/press-releases/2026-01-21-gartner-predicts-fewer-than-20-companies-will-scale-humanoid-robots-for-manufacturing-and-supply-chain-to-production-stage-by-2028",
  },
  {
    label: "BMW x Figure pilot",
    href: "https://www.bmwgroup.com/en/news/general/2024/Figure.html",
  },
  {
    label: "Agility industrial deployments",
    href: "https://agilityrobotics.com/",
  },
];

type MarketSignalsSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function MarketSignalsSection({
  eyebrow = "Capability Signal",
  title = "Humanoids look good in controlled spaces. Deployment still breaks at the site.",
  description = "The demos are real. Robots can now tidy rooms, handle laundry, and complete multi-step tasks in spaces built for them. The gap shows up when that same robot has to pass in a live site with different layouts, edge cases, safety rules, and a real success bar.",
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

        <div className="mt-10 grid gap-5 md:grid-cols-3">
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
              <div className="p-6">
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
            If AI only worked on benchmark prompts, nobody would call that deployment. Humanoids
            are ready for far more pilots than the market is running today, but only when the
            site, task, and pass bar are defined up front.
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
