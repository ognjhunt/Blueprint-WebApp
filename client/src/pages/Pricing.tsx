import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Policy Evaluation Run",
    price: "From $6,500 / run",
    body:
      "100 or 500 virtual episodes for 1 site package, 1 task pack, 1 robot embodiment, and 1-3 policies.",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&episodeCount=100&source=pricing",
  },
  {
    name: "Validated Evaluation Pack",
    price: "Scoped per task",
    body:
      "Adds paired real robot rollouts with Pearson/Spearman or rank-fidelity reporting inside the validated envelope.",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&validationMode=real_rollout_validated&source=pricing",
  },
  {
    name: "Policy Improvement Run",
    price: "From $35,000 / run",
    body:
      "Follow-on work after evaluation identifies the failure modes worth fixing.",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-improvement-run&path=policy-improvement-run&source=pricing",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Policy Evaluation Pricing | Blueprint"
        description="Blueprint packages for robot teams: Policy Evaluation Runs, Validated Evaluation Packs, and follow-on Policy Improvement Runs."
        canonical="/pricing"
        image={`https://tryblueprint.io${humanoidReadinessAssets.hostedDashboard}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Policy Evaluation Pricing",
          description:
            "Pricing for Policy Evaluation Runs, Validated Evaluation Packs, and Policy Improvement Runs.",
          url: "https://tryblueprint.io/pricing",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1fr] md:items-center md:px-8">
            <div>
              <p className="text-sm font-semibold text-amber-700">Pricing</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-normal md:text-6xl">
                Simple packages for robot policy evaluation.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Start with a Policy Evaluation Run. Add validation or
                improvement only when the evidence supports it.
              </p>
            </div>
            <img
              src={humanoidReadinessAssets.hostedDashboard}
              alt="Blueprint evaluation dashboard for humanoid robot tasks"
              className="aspect-[4/3] w-full border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-5 py-12 md:grid-cols-3 md:px-8">
          {plans.map((plan) => (
            <article key={plan.name} className="border border-slate-200 p-6">
              <h2 className="text-2xl font-semibold">{plan.name}</h2>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                {plan.price}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {plan.body}
              </p>
              <a
                href={plan.href}
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Request package
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1fr_auto] md:items-center md:px-8">
            <div>
              <h2 className="text-3xl font-semibold">
                Site operators submit free.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Blueprint reviews capture rights, privacy, and task fit before
                any robot-team access.
              </p>
            </div>
            <a
              href="/contact/site-operator?source=pricing"
              className="inline-flex min-h-12 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Submit site free
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
          <h2 className="text-3xl font-semibold">Proof boundary</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Virtual results do not guarantee real-world success. Deployment,
            safety, and validity claims require paired evidence from the exact
            robot, task, site, and validation envelope.
          </p>
        </section>
      </main>
    </>
  );
}
