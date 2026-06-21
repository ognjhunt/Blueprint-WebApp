import { SEO } from "@/components/SEO";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const plans = [
  {
    title: "Test policies",
    product: "Policy Evaluation Run",
    line: "Rank 1-3 policies on captured tasks.",
    choices: ["100 episodes", "500 episodes"],
    tone: "border-blue-200 bg-blue-50 text-blue-700",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&episodeCount=100&source=pricing",
  },
  {
    title: "Validate with robot",
    product: "Validated Evaluation Pack",
    line: "Compare predictions with real rollouts.",
    choices: ["Real rollouts", "Confidence bounds"],
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&validationMode=real_rollout_validated&source=pricing",
  },
  {
    title: "Improve policy",
    product: "Policy Improvement Run",
    line: "Use failures to plan the next update.",
    choices: ["Failure review", "Next candidate"],
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-improvement-run&path=policy-improvement-run&source=pricing",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Pick a Blueprint run: test policies, validate with robot rollouts, or improve after failure review."
        canonical="/pricing"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.rolloutStrip}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Pricing",
          description:
            "Simple choices for Policy Evaluation Runs, Validated Evaluation Packs, and Policy Improvement Runs.",
          url: "https://tryblueprint.io/pricing",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.75fr_1.25fr] md:items-center md:px-8 md:py-16">
            <div>
              <h1 className="text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
                Pick a run.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Start with virtual policy testing. Add real robot validation
                when needed.
              </p>
            </div>
            <img
              src={wamPolicyEvalAssets.rolloutStrip}
              alt="Three generated support clips of a realistic humanoid robot running task variations"
              className="aspect-[16/6] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 md:grid-cols-3 md:px-8">
          {plans.map((plan) => (
            <article key={plan.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <div className={`inline-flex rounded-lg border px-3 py-2 text-sm font-semibold ${plan.tone}`}>
                {plan.product}
              </div>
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
              <h2 className="text-3xl font-semibold">Sites are free to submit.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Robot teams pay for runs. Site operators control access.
              </p>
            </div>
            <a
              href="/contact/site-operator?source=pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Submit site
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 md:px-8">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-700">
            Metrics apply inside the chosen site, task, and robot. Virtual
            results do not approve deployment or safety.
          </p>
        </section>
      </main>
    </>
  );
}
