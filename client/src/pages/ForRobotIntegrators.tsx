import { SEO } from "@/components/SEO";
import { ScrollReveal, StaggerGroup, InteractiveCard } from "@/components/motion";
import { motion, useReducedMotion } from "framer-motion";
import { FileCheck2, Gauge, GitBranchPlus, Play, Share2 } from "lucide-react";

const useCaseCards = [
  {
    title: "Tune before travel",
    description:
      "Fine-tune the policy against the actual deployment layout before anyone gets on a plane.",
    icon: <Gauge className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Make site-specific data",
    description:
      "Render runs from the exact site, vary scenarios, and export outputs for training, debugging, and internal review.",
    icon: <FileCheck2 className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Compare releases",
    description:
      "Run the same site and task after each autonomy update so regressions show up early.",
    icon: <GitBranchPlus className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Train operators",
    description:
      "Give operators, teleop teams, and support teams the exact site view before the first live shift.",
    icon: <Play className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Share one environment",
    description:
      "Let your team and the customer look at the same hosted site instead of passing files back and forth.",
    icon: <Share2 className="h-5 w-5 text-slate-700" />,
  },
];

const includedItems = [
  "A hosted world model of one real site and workflow",
  "Resettable runs on the same site so checkpoints are easier to compare",
  "Scenario changes and rollout exports for debugging, tuning, or data work",
  "A simple browser path for remote review and customer demos",
];

export default function ForRobotIntegrators() {
  const shouldReduce = useReducedMotion();

  return (
    <>
      <SEO
        title="For Robot Teams | Blueprint"
        description="Blueprint helps robot teams buy site-specific world models for tuning, evaluation, and hosted access built from real indoor capture."
        canonical="/for-robot-teams"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="grid gap-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start"
          >
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
                For Robot Teams
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Buy access to the exact site your robot needs.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
                Blueprint gives robot teams site-specific world models and hosted sessions built
                from real indoor capture. Use them to tune policies, run evals, compare releases,
                and generate site-specific data before the real visit starts.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/world-models"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-md"
                >
                  Browse world models
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50"
                >
                  Talk to us
                </a>
              </div>
            </div>

            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-3xl border border-slate-200 bg-white p-6"
            >
              <p className="text-sm font-semibold text-slate-900">What this is</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                A direct path to real-site world models, hosted sessions, and exportable outputs when the site matters.
              </p>
              <p className="mt-5 text-sm font-semibold text-slate-900">What it helps with</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Validation before the site visit</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Policy tuning on the actual facility</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Site-specific synthetic data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Release checks and customer demos</span>
                </li>
              </ul>
            </motion.div>
          </motion.div>

          <section className="mt-12">
            <ScrollReveal>
              <div className="max-w-3xl">
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  What robot teams use Blueprint for.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The point is simple: give your team the exact site in a format that is useful for
                  tuning, evals, and review before travel or customer time starts.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5" stagger={0.08}>
              {useCaseCards.map((item) => (
                <InteractiveCard key={item.title} accent="indigo" className="p-5 bg-slate-50">
                  <motion.div
                    whileHover={shouldReduce ? {} : { scale: 1.05 }}
                    className="inline-flex rounded-lg bg-white p-2"
                  >
                    {item.icon}
                  </motion.div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </InteractiveCard>
              ))}
            </StaggerGroup>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <ScrollReveal>
              <InteractiveCard className="h-full p-6">
                <h2 className="text-2xl font-bold text-slate-900">What you get</h2>
                <ul className="mt-5 space-y-3">
                  {includedItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </InteractiveCard>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <motion.article
                whileHover={shouldReduce ? {} : { y: -3 }}
                transition={{ duration: 0.25 }}
                className="h-full rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm"
              >
                <h2 className="text-2xl font-bold">What to expect</h2>
                <p className="mt-4 text-sm leading-7 text-white">
                  This is strong for site-specific tuning, synthetic data generation, release checks,
                  and customer demos. It is not final deployment signoff and it does not replace
                  stack-specific validation.
                </p>
              </motion.article>
            </ScrollReveal>
          </section>
        </div>
      </div>
    </>
  );
}
