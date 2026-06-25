import { SEO } from "@/components/SEO";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const plans = [
  {
    title: "Robot team subscription",
    product: "Core plan",
    price: "$15,000 / month",
    line:
      "Unlimited eval cycles for active development, up to the agreed policy cap.",
    choices: [
      "Unlimited evals up to policy cap",
      "Overage pricing above the cap",
      "Failure taxonomy and regression tracking",
    ],
    tone: "border-blue-200 bg-blue-50 text-blue-700",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Robot%20Team%20Subscription&source=pricing",
  },
  {
    title: "Lite quick-look eval",
    product: "Conversion ramp",
    price: "$5,000-$8,000 / eval",
    line:
      "A low-friction first run for one policy before a subscription decision.",
    choices: [
      "~50 episodes",
      "1 policy",
      "Ranking-only report; no failure taxonomy or calibration",
    ],
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Lite%20Quick-Look%20Eval&episodeCount=50&source=pricing",
  },
  {
    title: "Site supply review",
    product: "Site operator",
    price: "$5,000 / site",
    line:
      "A cheap supply-side path for operators who can make useful sites available to robot teams.",
    choices: [
      "Facility, access, and privacy review",
      "Capture and commercialization posture",
      "No deployment or rights guarantee until reviewed",
    ],
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    href: "/contact/site-operator?source=pricing&requestedOutputs=Site%20Supply%20Review",
  },
  {
    title: "Site monitoring subscription",
    product: "Operator recurring",
    price: "$30,000-$40,000 / site / year",
    line:
      "Annual monitoring for an active deployed site, not a repeat of the $5k supply review.",
    choices: [
      "Multiple policy-update checks up to agreed annual cap",
      "Per-site report card for change management",
      "Cheaper per check than repeated one-off monitoring evals",
      "Still bounded to reviewed site, task, and access scope",
    ],
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700",
    href: "/contact/site-operator?source=pricing&requestedOutputs=Site%20Monitoring%20Subscription",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint pricing for robot-team evaluation subscriptions, lite quick-look evals, low-cost site supply reviews, and yearly per-site monitoring."
        canonical="/pricing"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.rolloutStrip}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Pricing",
          description:
            "Subscription-first pricing for robot-team evaluation infrastructure, lite quick-look evals, site supply reviews, and yearly per-site monitoring.",
          url: "https://tryblueprint.io/pricing",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.75fr_1.25fr] md:items-center md:px-8 md:py-16">
            <div>
              <h1 className="text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
                Evaluation infrastructure, not one-off tax.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Robot teams subscribe when evals become part of the development
                loop. Lite evals and single-site reviews stay available as the
                ramp into that subscription. Site operators start with a cheap
                supply review, then add yearly monitoring only when a deployed
                site needs repeated policy-update checks.
              </p>
            </div>
            <img
              src={wamPolicyEvalAssets.rolloutStrip}
              alt="Three generated support clips of a realistic humanoid robot running task variations"
              className="aspect-[16/6] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 md:grid-cols-2 md:px-8 lg:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <div className={`inline-flex rounded-lg border px-3 py-2 text-sm font-semibold ${plan.tone}`}>
                {plan.product}
              </div>
              <p className="mt-6 text-3xl font-semibold tracking-normal">
                {plan.price}
              </p>
              <h2 className="mt-6 text-3xl font-semibold tracking-normal">
                {plan.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{plan.line}</p>
              <div className="mt-6 grid gap-2">
                {plan.choices.map((choice) => (
                  <div key={choice} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    {choice}
                  </div>
                ))}
              </div>
              <a
                href={plan.href}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Start
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 md:grid-cols-[1fr_auto] md:items-center md:px-8">
            <div>
              <h2 className="text-3xl font-semibold">Site review is one-time; monitoring is recurring.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                The operator path is priced for supply creation: $5,000 per
                site review, with access, privacy, and commercial-use boundaries
                confirmed before any robot-team use. If a site becomes deployed,
                yearly monitoring covers multiple policy-update checks up to an
                agreed cap, so the subscription is a lower per-check price than
                repeated one-off monitoring evals.
              </p>
            </div>
            <a
              href="/contact/site-operator?source=pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Start site review
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 md:px-8">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-700">
            Subscription evals, quick-look evals, site reviews, and yearly site
            monitoring apply only inside the chosen site, task, robot,
            policy-access mode, and proof boundary. Virtual results do not
            approve deployment or safety.
          </p>
        </section>
      </main>
    </>
  );
}
