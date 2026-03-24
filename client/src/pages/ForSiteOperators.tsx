import { SEO } from "@/components/SEO";
import { ScrollReveal, StaggerGroup, InteractiveCard, AnimatedCounter } from "@/components/motion";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  DollarSign,
  HandCoins,
  Shield,
  TrendingUp,
} from "lucide-react";

const benefits = [
  "Earn 15-25% of every world model sale from your facility",
  "Let Blueprint turn your site into a sellable digital asset",
  "Set the rules for privacy, access, and downstream usage",
  "No upfront cost -- opt in only when it fits your business",
];

const howItWorks = [
  {
    title: "1. Register your space",
    description:
      "Tell us about your facility, the type of environment it is, and any access restrictions. Takes 5 minutes.",
  },
  {
    title: "2. Approve capture windows",
    description:
      "Choose when capturers can visit. You control scheduling, restricted zones, and privacy rules.",
  },
  {
    title: "3. Earn from world model sales",
    description:
      "When robot teams buy world models built from your site, you earn a revenue share automatically.",
  },
  {
    title: "4. Attract robot deployments",
    description:
      "Robot teams can discover and evaluate your site remotely before committing travel, pilot time, or custom integration work.",
  },
];

const facilityTypes = [
  "Warehouse",
  "Retail store",
  "Grocery store",
  "Office building",
  "Restaurant",
  "Gym / fitness center",
  "Hotel / hospitality",
  "University / campus",
  "Medical clinic",
  "Coworking space",
  "Library",
  "Industrial facility",
];

const whatYouControl = [
  { label: "Scheduling", detail: "Choose exact capture windows that don't disrupt operations" },
  { label: "Privacy", detail: "Define restricted zones, camera rules, and data governance" },
  { label: "Permissions", detail: "Approve or decline every capture request" },
  { label: "Revenue share", detail: "Earn automatically on every world model sold from your space" },
];

export default function ForSiteOperators() {
  const shouldReduce = useReducedMotion();

  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Blueprint helps site operators control access, rights, and commercialization for site-specific world models used by robot teams."
        canonical="/for-site-operators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <ScrollReveal>
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <Building2 className="h-3 w-3" />
                For Site Operators
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Turn your facility into a site-specific world-model asset.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
                Register the site, set access and privacy rules, and choose whether Blueprint can
                commercialize capture from your facility. That gives robot teams a grounded place
                to train, evaluate, and plan against under rules you control.
              </p>
            </div>
          </ScrollReveal>

          {/* Benefits */}
          <ScrollReveal delay={0.1}>
            <section className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-emerald-700" />
                <h2 className="text-xl font-bold text-slate-900">What you get</h2>
              </div>
              <ul className="space-y-3">
                {benefits.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </ScrollReveal>

          {/* Revenue highlight — with animated counters */}
          <ScrollReveal>
            <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <DollarSign className="h-4 w-4" />
                    Revenue share
                  </p>
                  <p className="mt-2 text-3xl font-bold">
                    <AnimatedCounter value={15} duration={600} />-<AnimatedCounter value={25} duration={800} suffix="%" />
                  </p>
                  <p className="mt-1 text-sm text-slate-400">of every world model sale from your facility</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <TrendingUp className="h-4 w-4" />
                    Access control
                  </p>
                  <p className="mt-2 text-3xl font-bold">Case by case</p>
                  <p className="mt-1 text-sm text-slate-400">Approve capture windows, restricted zones, and downstream usage terms.</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <Shield className="h-4 w-4" />
                    Upfront cost
                  </p>
                  <p className="mt-2 text-3xl font-bold">No upfront fee</p>
                  <p className="mt-1 text-sm text-slate-400">Register the facility first. Earn only when approved usage turns into sales.</p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* How it works */}
          <section className="mt-10">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-slate-900">How it works</h2>
            </ScrollReveal>
            <StaggerGroup className="mt-5 grid gap-4 sm:grid-cols-2" stagger={0.1}>
              {howItWorks.map((step) => (
                <InteractiveCard key={step.title} accent="emerald" className="p-5">
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </InteractiveCard>
              ))}
            </StaggerGroup>
          </section>

          {/* What you control */}
          <ScrollReveal>
            <section className="mt-10 rounded-2xl border border-slate-200 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">You stay in control</h2>
              </div>
              <StaggerGroup className="grid gap-4 sm:grid-cols-2" stagger={0.08}>
                {whatYouControl.map((item) => (
                  <motion.div
                    key={item.label}
                    whileHover={shouldReduce ? {} : { y: -2 }}
                    className="rounded-lg bg-slate-50 p-4 transition-shadow hover:shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </motion.div>
                ))}
              </StaggerGroup>
            </section>
          </ScrollReveal>

          {/* Facility types */}
          <ScrollReveal>
            <section className="mt-10">
              <h2 className="text-xl font-bold text-slate-900">Any indoor facility qualifies</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {facilityTypes.map((type, i) => (
                  <motion.span
                    key={type}
                    initial={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-shadow hover:shadow-sm"
                  >
                    {type}
                  </motion.span>
                ))}
                <motion.span
                  initial={shouldReduce ? {} : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: facilityTypes.length * 0.04, duration: 0.3 }}
                  className="rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-500"
                >
                  + any indoor space
                </motion.span>
              </div>
            </section>
          </ScrollReveal>

          {/* CTAs */}
          <ScrollReveal>
            <section className="mt-10 flex flex-wrap gap-3">
              <a
                href="/contact?persona=site-operator"
                className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-md"
              >
                List your site
              </a>
              <a
                href="/governance"
                className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50"
              >
                Review rights and privacy
              </a>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </>
  );
}
