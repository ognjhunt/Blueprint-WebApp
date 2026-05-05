import { ArrowRight, BriefcaseBusiness, Play, ScanLine } from "lucide-react";
import { sessionHourDefinition } from "@/data/marketingDefinitions";

type OfferComparisonProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
};

const offerCards = [
  {
    title: "Buy the site package",
    price: "$2,100 - $3,400",
    description:
      "Everything your team needs to run its own world model on that facility — walkthrough media, geometry, metadata, and rights.",
    bullets: [
      "Walkthrough video, timestamps, and camera poses",
      "Depth and geometry files when available from source capture",
      "Rights, freshness, provenance, and package notes",
    ],
    href: "/world-models",
    cta: "Inspect site packages",
    icon: ScanLine,
    imageSrc: "/illustrations/offer-site-package-preview.svg",
    imageAlt:
      "Site package shown as a capture-backed data bundle with walkthrough frames, geometry files, and rights materials.",
    accent: "bg-slate-950 text-white",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
  {
    title: "Run a hosted evaluation",
    price: "$16 - $29 / session-hour",
    description:
      "Blueprint runs the site for you. Rerun tasks, review failures, compare checkpoints, and export results — no local setup needed.",
    bullets: [
      "Repeatable runs on one exact site",
      "Rollout video, metrics, and failure review",
      "Raw bundles and dataset exports for tuning and adaptation",
    ],
    href: "/contact?persona=robot-team&interest=evaluation-package",
    cta: "Scope hosted evaluation",
    icon: Play,
    imageSrc: "/illustrations/offer-hosted-evaluation-preview.svg",
    imageAlt:
      "Illustration of Blueprint-hosted evaluation on one exact site with reruns, comparison, and export outputs.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-slate-50",
    bulletTone: "bg-slate-500",
  },
  {
    title: "Plan a custom program",
    price: "$50,000+",
    description:
      "Use this for custom capture, exclusive training data, or managed evaluation programs around one facility.",
    bullets: [
      "Custom capture scope and private onboarding",
      "Private or exclusive access",
      "Managed support for high-stakes work",
    ],
    href: "/contact?persona=robot-team&interest=enterprise",
    cta: "Contact Blueprint",
    icon: BriefcaseBusiness,
    imageSrc: "/illustrations/offer-custom-program-preview.svg",
    imageAlt:
      "Illustration of a private custom program with buyer-specific capture scope, exclusive access, and managed model and data work.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
];

export function OfferComparison({
  eyebrow = "What you can buy first",
  title = "Choose the path that matches the work.",
  description = "Inspect the package path when your team wants the capture-backed data contract. Use hosted evaluation when your team wants Blueprint to run the exact site first. Use custom scope when the site, rights model, or support layer are private from day one.",
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
              className={`rounded-2xl border p-4 sm:p-5 ${card.cardTone}`}
            >
              <div className="overflow-hidden rounded-[1.1rem] border border-slate-200 bg-slate-50">
                <img
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
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
              {card.title === "Run a hosted evaluation" ? (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  {sessionHourDefinition}
                </p>
              ) : null}
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

      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-200 bg-stone-50 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Compare the three commercial paths.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The same site can support multiple buying motions. The right first step depends on whether your team needs raw site data, hosted-run evidence, or a private program.
          </p>
        </div>
        <div className="grid gap-px bg-slate-200 lg:grid-cols-[1.05fr_1fr_1fr_1fr]">
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-500">Decision point</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Site package</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Hosted evaluation</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Custom site scope</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Best when</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Your team wants the data contract and plans to run its own stack.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Your team wants hosted-run evidence, reruns, comparison, and exports before moving files around.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">The site is private, the rights model is custom, or the work needs hands-on support and commercial review.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Buyer gets first</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Walkthrough media, poses, geometry coverage, manifest, and rights metadata.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A hosted evaluation on one exact site with run review and export outputs.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A scoped program covering capture, packaging, hosted access, and any private operating constraints.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Typical first purchase</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$2,100 - $3,400 per listing depending on the package depth.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$16 - $29 per session-hour on the public hosted path.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$50,000+ when the site, support, or rights posture is custom from the start.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Next step</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Inspect a listing, review the manifest and trust card, then request package access for that site.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Review the hosted flow, confirm the robot and workflow question, then submit hosted-eval scoping.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Tell Blueprint the facility, rights needs, and operating constraints so we can scope the program.</div>
        </div>
      </div>
    </section>
  );
}
