import { ArrowRight, Building2, ClipboardCheck, Database, RefreshCcw } from "lucide-react";
import { policyEvaluationSetDefinition } from "@/data/marketingDefinitions";

type OfferComparisonProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
};

const offerCards = [
  {
    title: "Subscribe for robot-team evals",
    price: "$15,000 / month",
    description:
      "Make Blueprint evals infrastructure for active development instead of a per-eval toll.",
    bullets: [
      "Unlimited eval cycles up to the agreed active-policy cap",
      "Overage pricing above the policy cap",
      "Failure taxonomy, OOD flags, regression tracking, and validation targets",
    ],
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&requestedOutputs=Robot%20Team%20Subscription",
    cta: "Request subscription",
    icon: ClipboardCheck,
    imageSrc: "/illustrations/offer-hosted-evaluation-preview.svg",
    imageAlt:
      "Illustration of Blueprint task evaluation on one exact site with reruns, comparison, and export outputs.",
    accent: "bg-slate-950 text-white",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
  {
    title: "Run a lite quick-look eval",
    price: "$5,000-$8,000 / eval",
    description:
      "Let a team kick the tires before committing recurring infrastructure budget.",
    bullets: [
      "~50 episodes on one capture-backed task pack",
      "1 policy with a ranking-only report",
      "No failure taxonomy, calibration, or broad deployment claims",
      "Designed as the ramp into the $15k/month robot-team plan",
    ],
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Lite%20Quick-Look%20Eval&episodeCount=50",
    cta: "Request quick-look",
    icon: Database,
    imageSrc: "/illustrations/offer-site-package-preview.svg",
    imageAlt:
      "Policy improvement run shown as a baseline result, failure cluster, curriculum, sealed test, and evidence report.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-slate-50",
    bulletTone: "bg-slate-500",
  },
  {
    title: "Submit a site as supply",
    price: "$5,000 / site",
    description:
      "Operators can make a facility reviewable without turning the lane into a high-friction consulting sale.",
    bullets: [
      "Submit or claim a real facility for robot-team supply",
      "Define access, privacy, and restricted-area boundaries",
      "Rights, capture, and downstream use are still confirmed per scope",
    ],
    href: "/contact/site-operator?requestedOutputs=Site%20Supply%20Review",
    cta: "Start site review",
    icon: Building2,
    imageSrc: "/illustrations/offer-custom-program-preview.svg",
    imageAlt:
      "Illustration of a site operator submitting access boundaries and commercial posture for Blueprint review.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-white",
    bulletTone: "bg-slate-400",
  },
  {
    title: "Subscribe for site monitoring",
    price: "$30,000-$40,000 / site / year",
    description:
      "Operators add a yearly monitoring retainer once a deployed site needs repeated policy-update checks.",
    bullets: [
      "Separate from the $5k one-time supply review",
      "Multiple policy-update checks up to the agreed annual cap",
      "Customer pushes a new policy version and Blueprint evaluates against the reviewed site scope",
      "Report cards cover regressions without turning eval output into deployment approval",
    ],
    href: "/contact/site-operator?requestedOutputs=Site%20Monitoring%20Subscription",
    cta: "Scope monitoring",
    icon: RefreshCcw,
    imageSrc: "/illustrations/offer-custom-program-preview.svg",
    imageAlt:
      "Illustration of a site operator monitoring policy regressions against one approved facility scope.",
    accent: "border border-slate-300 bg-white text-slate-900",
    cardTone: "border-slate-200 bg-slate-50",
    bulletTone: "bg-slate-500",
  },
];

export function OfferComparison({
  eyebrow = "Simple commercial model",
  title = "Robot teams subscribe when evals become infrastructure. Site operators start with a one-time review, then add monitoring only when the site is deployed.",
  description = "Use the $15k/month robot-team plan for repeated eval cycles, the lite quick-look when a team wants one first pass, the $5k/site operator path for supply, and yearly monitoring when a deployed site needs multiple policy-update checks.",
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

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              {card.title === "Subscribe for robot-team evals" ? (
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
            Compare the paths.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The same site can support multiple motions. The right first step depends on whether the robot team is ready for recurring eval infrastructure, wants a cheap first quick-look, whether the facility operator is adding supply, or whether a deployed site needs multiple policy-update checks under a yearly monitoring cap.
          </p>
        </div>
        <div className="grid gap-px bg-slate-200 lg:grid-cols-[1.05fr_1fr_1fr_1fr_1fr]">
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-500">Decision point</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Robot-team subscription</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Lite quick-look</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Site supply</div>
          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Site monitoring</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Best when</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Your team runs dozens of eval cycles per quarter and wants recurring infrastructure instead of per-eval friction.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A robot team wants one fast, low-risk first pass before subscription budget.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">An operator can make a useful facility available as supply for robot-team evaluation demand.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A deployed site needs repeated policy regression checks as robot teams push new policy versions.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Buyer gets first</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Unlimited eval cycles up to the policy cap, failure tracking, regression comparisons, and validation targets.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">~50 episodes, one policy, and a ranking-only report without calibration or failure taxonomy.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">A site review for facility, access, privacy, capture, and commercial-use boundaries.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Multiple per-site report cards up to the agreed annual policy-update cap.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Typical first purchase</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$15,000 per month, with overage pricing above the policy cap.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$5,000-$8,000 per quick-look eval.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$5,000 per site.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">$30,000-$40,000 per deployed site per year for multiple checks, not for one supply review.</div>

          <div className="bg-white px-5 py-4 text-sm font-semibold text-slate-900">Next step</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Confirm active-policy cap, policy access mode, task packs, and overage terms.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Name the one policy, robot embodiment, site/task, and ranking question.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Tell Blueprint the facility, access rules, privacy limits, and commercial posture.</div>
          <div className="bg-white px-5 py-4 text-sm leading-6 text-slate-600">Confirm deployed-site scope, policy-update cadence, report recipients, and change-control owner.</div>
        </div>
      </div>
    </section>
  );
}
