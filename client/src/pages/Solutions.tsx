import { SEO } from "@/components/SEO";
import { ArrowRight, Building2, Bot, ClipboardCheck, Route, ShieldCheck } from "lucide-react";

const sharedWorkflow = [
  {
    title: "Capture and twin creation",
    description:
      "Local walkthrough capture is reconstructed into a site-specific digital twin with metadata both sides can reference during a humanoid deployment program.",
    icon: <Route className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Pre-deployment qualification",
    description:
      "Humanoid policies are evaluated against the twin before live rollout so decisions are based on measurable readiness.",
    icon: <ClipboardCheck className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Operational handoff",
    description:
      "Teams align on scorecards, constraints, and next steps before moving into real-world pilot execution.",
    icon: <ShieldCheck className="h-5 w-5 text-slate-700" />,
  },
];

const roleCards = [
  {
    title: "For Site Operators",
    description:
      "For operators of warehouses, stores, factories, and labs who need a clear pre-deployment process for humanoid adoption.",
    href: "/for-site-operators",
    cta: "Open site operator guide",
    icon: <Building2 className="h-6 w-6 text-slate-900" />,
  },
  {
    title: "For Humanoid Teams",
    description:
      "For humanoid integrators and deployment teams who need site-specific adaptation and standardized qualification artifacts.",
    href: "/for-robot-integrators",
    cta: "Open humanoid team guide",
    icon: <Bot className="h-6 w-6 text-slate-900" />,
  },
];

export default function Solutions() {
  return (
    <>
      <SEO
        title="Solutions | Blueprint"
        description="Role-based guides for deployment site operators and humanoid teams: process, requirements, exchange workflow, and pre-deployment qualification."
        canonical="/solutions"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Solutions by role
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Blueprint works as a pre-deployment qualification layer between deployment sites and
              humanoid teams. Choose the guide that matches your role to see exact inputs,
              workflow, logistics, and readiness outputs.
            </p>
          </div>

          <section className="mt-10 grid gap-5 sm:grid-cols-2">
            {roleCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200 p-6 transition hover:border-slate-300"
              >
                <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-2">{card.icon}</div>
                <h2 className="text-xl font-bold text-slate-900">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
                <a
                  href={card.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-700"
                >
                  {card.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </article>
            ))}
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-2xl font-bold text-slate-900">Shared workflow</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {sharedWorkflow.map((item) => (
                <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2">{item.icon}</div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/for-site-operators"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Site operator guide
            </a>
            <a
              href="/for-robot-integrators"
              className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Humanoid team guide
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
