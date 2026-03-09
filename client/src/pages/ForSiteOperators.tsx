import { SEO } from "@/components/SEO";
import { CheckCircle2, ClipboardList, Clock3, Handshake, ShieldCheck } from "lucide-react";

const intakeChecklist = [
  "Basic site profile: facility type, size, hours, and known constraints",
  "Task list: which workflows you want checked first",
  "Access plan: escort policy, restricted zones, and capture windows",
  "Review rules: privacy, permissions, and who can see the site materials",
];

const processSteps = [
  {
    title: "1. Intake and scope alignment",
    description:
      "We define the site, the task, and what a good outcome looks like.",
  },
  {
    title: "2. Site review",
    description:
      "Blueprint reviews the site materials and builds the context needed for a real go or no-go call.",
  },
  {
    title: "3. Readiness decision",
    description:
      "You get a simple answer: ready, risky, or not ready yet.",
  },
  {
    title: "4. Qualified team access",
    description:
      "If the site is a fit, Blueprint can turn it into a brief the right robot teams can review.",
  },
];

const logisticsDetails = [
  "Scheduling: choose a time that does not disrupt operations",
  "Data governance: decide who can review the site materials",
  "Scope: agree on the task, work area, and success bar up front",
  "Next step: move forward, adjust the plan, or pause",
  "Follow-up: open a qualified brief only if the site is a fit",
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Guide for site operators using Blueprint to check whether a site and workflow are ready for robots before a pilot."
        canonical="/for-site-operators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
              For Site Operators
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Start with a simple site check
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              If you run a warehouse, store, factory, or lab, Blueprint helps you check whether
              the site and workflow are a good fit before you invite more pilot work.
            </p>
          </div>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">What we need from your team</h2>
            </div>
            <ul className="space-y-3">
              {intakeChecklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold text-slate-900">Typical process</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {processSteps.map((step) => (
                <article key={step.title} className="rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Exchange and logistics</h2>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {logisticsDetails.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock3 className="h-4 w-4" />
                  Typical capture kickoff
                </p>
                <p className="mt-1 text-sm text-slate-600">1-2 weeks after scope and approvals.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4" />
                  Evaluation scope
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  We qualify the site first, then decide whether it should be shared with teams.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/contact?interest=site-operator-guide"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Request site qualification
            </a>
            <a
              href="/deployment-marketplace"
              className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              View qualified opportunities
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
