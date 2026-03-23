import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { ScrollReveal } from "@/components/motion";
import { motion, useReducedMotion } from "framer-motion";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { Mail, MessageSquare, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />
    </svg>
  );
}

export default function Contact() {
  const shouldReduce = useReducedMotion();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const interest = searchParams.get("interest")?.trim() ?? "";
  const buyerType = searchParams.get("buyerType")?.trim() ?? "";
  const personaParam = searchParams.get("persona")?.trim() ?? "";
  const hostedMode =
    normalizeInterestToLane(interest) === "deeper_evaluation" && buyerType === "robot_team";
  const persona =
    hostedMode || personaParam === "robot-team" || buyerType === "robot_team"
      ? "robot_team"
      : personaParam === "site-operator" || buyerType === "site_operator"
        ? "site_operator"
        : "robot_team";

  const seoTitle = hostedMode
    ? "Request Hosted Evaluation | Blueprint"
    : persona === "site_operator"
      ? "For Site Operators | Blueprint"
      : "For Robot Teams | Blueprint";
  const seoDescription = hostedMode
    ? "Request a hosted robot-team evaluation for a site-specific world model."
    : persona === "site_operator"
      ? "Talk to Blueprint about facility participation, access rules, and governance."
      : "Talk to Blueprint about site-specific world models, deliverables, and hosted access.";

  const badgeLabel = hostedMode
    ? "Hosted Evaluation"
    : persona === "site_operator"
      ? "For Site Operators"
      : "For Robot Teams";
  const heroTitle = hostedMode
    ? "Request a hosted evaluation for this site."
    : persona === "site_operator"
      ? "Tell us about the facility and the rules around it."
      : "Tell us the site, the workflow, and what your team needs.";
  const heroBody = hostedMode
    ? "Confirm the site, the task, and the robot setup. Blueprint will use that to line up the right hosted evaluation path for your team."
    : persona === "site_operator"
      ? "Use this form if you run the facility and need to talk through capture access, privacy rules, or whether the site should be listed at all."
      : "Use this form if your team needs to inspect a real site, understand the deliverables, or decide whether hosted evaluation is the right next step.";
  const responseTitle = hostedMode ? "Hosted evaluation request" : "What happens after you send this";
  const responseBody = hostedMode
    ? "Fill out the short form and our team will follow up to confirm the site, robot setup, and the next step toward a hosted evaluation."
    : persona === "site_operator"
      ? "Blueprint reviews the facility details, access rules, and privacy notes first. The reply should narrow the next step instead of reopening the whole conversation."
      : "Blueprint reviews the site, workflow, and embodiment details first. The reply should move your team toward a concrete next step, not another vague intake round.";
  const learnMoreLinks = hostedMode
    ? [
        { href: "/world-models", label: "Back to World Models" },
        { href: "/sample-deliverables", label: "Sample deliverables" },
        { href: "/faq", label: "FAQ" },
      ]
    : persona === "site_operator"
      ? [
          { href: "/governance", label: "Governance" },
          { href: "/about", label: "About Blueprint" },
          { href: "/capture", label: "Capture basics" },
        ]
      : [
        { href: "/world-models", label: "Browse world models" },
        { href: "/sample-deliverables", label: "Sample deliverables" },
        { href: "/faq", label: "FAQ" },
      ];

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} canonical="/contact" />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm"
            >
              <MessageSquare className="h-3 w-3" />
              {badgeLabel}
            </motion.div>
            <motion.h1
              initial={shouldReduce ? {} : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl"
            >
              {heroTitle}
            </motion.h1>
            <motion.p
              initial={shouldReduce ? {} : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg leading-relaxed text-zinc-600"
            >
              {heroBody}
            </motion.p>
          </div>

          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
            <ScrollReveal delay={0.1}>
              <div className="space-y-8">
                <motion.div
                  whileHover={shouldReduce ? {} : { y: -2 }}
                  className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
                >
                  <ContactForm />
                </motion.div>
              </div>
            </ScrollReveal>

            <div className="flex flex-col justify-start space-y-6 lg:pl-8">
              <ScrollReveal delay={0.15}>
                <motion.div
                  whileHover={shouldReduce ? {} : { y: -2 }}
                  className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <motion.div
                      animate={shouldReduce ? {} : { rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"
                    >
                      <Sparkles className="h-5 w-5" />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-zinc-900">{responseTitle}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{responseBody}</p>
                    </div>
                  </div>
                </motion.div>
              </ScrollReveal>

              <ScrollReveal delay={0.2}>
                <motion.div
                  whileHover={shouldReduce ? {} : { y: -2 }}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900">Prefer email?</h3>
                      <a
                        href="mailto:hello@tryblueprint.io"
                        className="mt-1 inline-block text-indigo-600 transition hover:text-indigo-700 hover:underline"
                      >
                        hello@tryblueprint.io
                      </a>
                    </div>
                  </div>
                </motion.div>
              </ScrollReveal>

              <ScrollReveal delay={0.25}>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-zinc-400">
                    Learn More
                  </h3>
                  <ul className="space-y-3">
                    {learnMoreLinks.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="group flex items-center gap-2 text-zinc-700 transition hover:text-indigo-600"
                        >
                          <span>{link.label}</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
