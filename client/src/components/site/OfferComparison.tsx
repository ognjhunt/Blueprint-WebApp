import { ArrowRight, BriefcaseBusiness, Play, ScanLine } from "lucide-react";

type OfferComparisonProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
};

const offerCards = [
  {
    title: "Site package",
    price: "$2,100 - $3,400",
    description:
      "Buy the grounded site files, package notes, and rights context for one real facility.",
    bullets: [
      "Walkthrough media and camera poses",
      "Geometry and depth when available",
      "Rights, freshness, and package notes",
    ],
    href: "/world-models",
    cta: "Browse site packages",
    icon: ScanLine,
    accent: "bg-slate-950 text-white",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
  {
    title: "Hosted evaluation",
    price: "$16 - $29 / session-hour",
    description:
      "Request Blueprint-managed runtime access when you want to run the exact site now and pull back usable outputs.",
    bullets: [
      "Repeatable runs on one exact site",
      "Rollout video, metrics, and failure review",
      "Raw bundle and RLDS-style exports for tuning and adaptation",
    ],
    href: "/contact?persona=robot-team&interest=evaluation-package",
    cta: "Request hosted evaluation",
    icon: Play,
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-slate-50",
    bulletTone: "bg-slate-500",
  },
  {
    title: "Enterprise",
    price: "$50,000+",
    description:
      "Use this for custom capture, exclusive access, or managed support around one facility.",
    bullets: [
      "Custom capture scope",
      "Private or exclusive access",
      "Managed support for high-stakes work",
    ],
    href: "/contact?persona=robot-team&interest=enterprise",
    cta: "Talk to Blueprint",
    icon: BriefcaseBusiness,
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
];

export function OfferComparison({
  eyebrow = "What you can buy first",
  title = "Choose the first step that matches the work.",
  description = "Most teams start with one site package or one hosted evaluation request. Use the package when you need the grounded site assets. Use hosted evaluation when you need reruns, exports, and failure review on the same site.",
  className = "",
}: OfferComparisonProps) {
  return (
    <section className={className}>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {offerCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className={`rounded-[1.75rem] border p-6 ${card.cardTone}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-2xl bg-white p-3 text-slate-800 shadow-sm ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-500">{card.price}</p>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
              <ul className="mt-5 space-y-2.5">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className={`mt-2 h-1.5 w-1.5 rounded-full ${card.bulletTone}`} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <a
                href={card.href}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-90 ${card.accent}`}
              >
                {card.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
