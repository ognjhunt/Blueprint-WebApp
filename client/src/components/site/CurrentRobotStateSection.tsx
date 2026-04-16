import { ArrowUpRight } from "lucide-react";

type EvidenceCard = {
  tag: string;
  title: string;
  summary: string;
  note: string;
  imageSrc: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
};

const evidenceCards: EvidenceCard[] = [
  {
    tag: "Known room",
    title: "Robots look best when the room and the job stay familiar.",
    summary:
      "Figure's Helix 02 tidy demo is a real capability signal. The room is known. The task is bounded. That helps the robot keep a steady loop.",
    note:
      "That setup matters. When the layout, safety rules, or handoffs drift, performance usually drifts too.",
    imageSrc: "/images/humanoids/figure-helix-02-living-room.jpg",
    imageAlt: "Figure Helix 02 living room tidy demo thumbnail.",
    ctaLabel: "Watch demo",
    ctaHref: "https://www.figure.ai/news/helix-02-living-room-tidy",
  },
  {
    tag: "Repeatable work",
    title: "The strongest commercial demos stay narrow on purpose.",
    summary:
      "Physical Intelligence and Weave picked a workflow that repeats all day: moving, sorting, and handling laundry in one operating setting.",
    note:
      "That is usually how real deployments start. Pick a task. Keep the environment tight. Measure whether it passes.",
    imageSrc: "/images/humanoids/pi-weave-laundry.png",
    imageAlt: "Physical Intelligence and Weave laundromat workflow image.",
    ctaLabel: "Read source",
    ctaHref: "https://www.pi.website/blog/partner",
  },
  {
    tag: "Live lane",
    title: "Robots are reaching live sites, but usually in a well-scoped lane.",
    summary:
      "Figure's BMW work is a useful example. A robot can add value on a real floor when the lane is defined and the workflow is clear.",
    note:
      "The hard part is not one clean clip. It is whether the same task still works in the actual site next week.",
    imageSrc: "/images/humanoids/agility-digit-profile.jpg",
    imageAlt: "Industrial humanoid robot profile image from Agility Robotics.",
    ctaLabel: "Read source",
    ctaHref: "https://www.figure.ai/news/production-at-bmw",
  },
];

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

export function CurrentRobotStateSection() {
  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Current state
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Robots are getting good in known environments.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-lg">
            The best results still come from repeatable settings. The room is known. The workflow
            is narrow. The pass bar is clear. That is useful progress, but it does not tell you
            whether a new site will behave the same way.
          </p>
        </div>

        <div className="mobile-snap-row mt-8 md:grid md:grid-cols-3 md:gap-5">
          {evidenceCards.map((card) => (
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
                <p className="mt-3 text-sm leading-relaxed text-zinc-800">{card.note}</p>
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
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">What Blueprint does</p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-200">
            Robots do not usually fail because the demo was fake. They fail because the live site
            is different: different layout, different traffic, different handoffs, different
            safety rules, different pass bar. Blueprint reduces that deployment gap by giving
            teams a site-specific world model and hosted evaluation path built from real capture.
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
