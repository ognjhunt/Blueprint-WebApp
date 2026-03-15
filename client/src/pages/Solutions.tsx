import { SEO } from "@/components/SEO";
import { ScrollReveal, StaggerGroup, InteractiveCard } from "@/components/motion";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2, Bot, ClipboardCheck, Route, ShieldCheck } from "lucide-react";

const sharedWorkflow = [
  {
    title: "Capture and qualification",
    description:
      "Local walkthrough capture becomes a hosted site record with metadata both sides can reference during a deployment program.",
    icon: <Route className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Pre-deployment qualification",
    description:
      "Robot teams are evaluated against the qualified record before live rollout so decisions are based on measurable readiness.",
    icon: <ClipboardCheck className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Operational handoff",
    description:
      "Teams align on scorecards, constraints, and next steps before moving into a site-specific engagement or an operator-led pilot search.",
    icon: <ShieldCheck className="h-5 w-5 text-slate-700" />,
  },
];

const roleCards = [
  {
    title: "For Site Operators",
    description:
      "For operators of warehouses, stores, factories, and labs who want qualified pilot demand and a clearer pre-deployment process.",
    href: "/for-site-operators",
    cta: "Open site operator guide",
    icon: <Building2 className="h-6 w-6 text-slate-900" />,
    accent: "emerald" as const,
  },
  {
    title: "For Robot Teams",
    description:
      "For humanoid integrators and deployment teams who either already know the site or need operator demand coming through the marketplace.",
    href: "/for-robot-teams",
    cta: "Open humanoid team guide",
    icon: <Bot className="h-6 w-6 text-slate-900" />,
    accent: "indigo" as const,
  },
];

export default function Solutions() {
  const shouldReduce = useReducedMotion();

  return (
    <>
      <SEO
        title="Solutions | Blueprint"
        description="Role-based guides for deployment site operators and humanoid teams: process, requirements, exchange workflow, and pre-deployment qualification."
        canonical="/solutions"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="space-y-6">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Solutions by role
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
                Blueprint sits between deployment sites and robot teams. Some engagements start with a
                robot team that already has a target site. Others start with a site operator that
                wants qualified pilot demand. Choose the guide that matches your role.
              </p>
            </div>
          </ScrollReveal>

          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2" stagger={0.15}>
            {roleCards.map((card) => (
              <InteractiveCard key={card.title} accent={card.accent} className="p-6">
                <motion.div
                  whileHover={shouldReduce ? {} : { scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4 inline-flex rounded-lg bg-slate-100 p-2"
                >
                  {card.icon}
                </motion.div>
                <h2 className="text-xl font-bold text-slate-900">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
                <a
                  href={card.href}
                  className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-700"
                >
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </InteractiveCard>
            ))}
          </StaggerGroup>

          <ScrollReveal>
            <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-2xl font-bold text-slate-900">Shared workflow</h2>
              <StaggerGroup className="mt-5 grid gap-4 sm:grid-cols-3" stagger={0.1}>
                {sharedWorkflow.map((item) => (
                  <InteractiveCard key={item.title} className="p-4">
                    <div className="mb-2">{item.icon}</div>
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </InteractiveCard>
                ))}
              </StaggerGroup>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="mt-10 flex flex-wrap gap-3">
              <a
                href="/for-site-operators"
                className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-md"
              >
                Site operator guide
              </a>
              <a
                href="/for-robot-teams"
                className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50"
              >
                Humanoid team guide
              </a>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </>
  );
}
