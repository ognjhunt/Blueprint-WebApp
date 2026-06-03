import { ArrowRight, Building2, Database, Play } from "lucide-react";
import { policyEvaluationSetDefinition } from "@/data/marketingDefinitions";

type OfferComparisonProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
};

const offerCards = [
  {
    title: "Buy the site data package",
    price: "$3,500+",
    description:
      "Everything your robot team needs to use one facility as data: world model, scenarios, metadata, provenance, and export limits.",
    bullets: [
      "Walkthrough video, timestamps, and camera poses",
      "Scenario data, depth, and geometry when source capture supports them",
      "Rights, freshness, provenance, and export notes",
    ],
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model",
    cta: "Request site data",
    icon: Database,
    imageSrc: "/illustrations/offer-site-package-preview.svg",
    imageAlt:
      "Site package shown as a capture-backed data bundle with walkthrough frames, geometry files, and rights materials.",
    accent: "bg-slate-950 text-white",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
  {
    title: "Run a policy evaluation set",
    price: "$6,500 / site evaluation",
    description:
      "Run one robot policy/profile across one site's task suite by manual browser session or headless agent, no local setup needed.",
    bullets: [
      "Up to 8 task families and 50 episodes per task",
      "Success rate, cycle time, video frames, and failure review",
      "Raw bundles and dataset exports for tuning and adaptation",
    ],
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation",
    cta: "Request policy evaluation",
    icon: Play,
    imageSrc: "/illustrations/offer-hosted-evaluation-preview.svg",
    imageAlt:
      "Illustration of Blueprint policy evaluation on one exact site with reruns, comparison, and export outputs.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-slate-50",
    bulletTone: "bg-slate-500",
  },
  {
    title: "Submit a site as an operator",
    price: "Free",
    description:
      "Operators can submit a site, name access limits, and review buyer-use posture without paying Blueprint.",
    bullets: [
      "Submit or claim a real facility",
      "Define access, privacy, and restricted-area boundaries",
      "No paid plan required for operator participation",
    ],
    href: "/contact/site-operator",
    cta: "Submit site free",
    icon: Building2,
    imageSrc: "/illustrations/offer-custom-program-preview.svg",
    imageAlt:
      "Illustration of a site operator submitting access boundaries and commercial posture for Blueprint review.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
];

export function OfferComparison({
  eyebrow = "Simple commercial model",
  title = "Robot teams pay for evaluation sets and data. Operators are free.",
  description = "Request the site data package when your team needs world-model and scenario exports. Use a policy evaluation set when your team wants a fixed-scope read on one policy across the site first. Submit a site for free when you operate the facility.",
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
              {card.title === "Run a policy evaluation set" ? (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  {policyEvaluationSetDefinition}
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
            Compare the three paths.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The same site can support multiple motions. The right first step depends on whether the robot team needs site data, a fixed policy-evaluation set, or whether the facility operator is submitting boundaries.
          </p>
        </div>
        <div className="grid gap-px bg-slate-200 lg:grid-cols-[1.05fr_1fr_1fr_1fr]">
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-500">Decision point</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Site data package</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Policy evaluation</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Site operator</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Best when</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Your robot team wants world-model, scenario, and export data for its own stack.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Your robot team wants one fixed-scope read on policy performance across site tasks before using the data more deeply.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">You operate the facility and want to submit boundaries before robot-team use is reviewed.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Buyer gets first</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Walkthrough media, poses, geometry coverage, scenarios, manifest, and rights metadata.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A site-policy evaluation set with task results, episode evidence, failure review, and export outputs.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A free intake path for facility, access, privacy, and commercial-use boundaries.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Typical first purchase</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$3,500+ per site package, scoped by data depth and scenario volume.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$6,500 per site-policy evaluation set.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Free for site operators.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Next step</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Name the site, robot task, and data outputs your team needs.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Confirm the robot policy/profile, task suite, and scenario set for evaluation scoping.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Tell Blueprint the facility, access rules, privacy limits, and commercial posture.</div>
        </div>
      </div>
    </section>
  );
}
