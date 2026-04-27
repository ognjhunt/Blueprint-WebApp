import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  MapPinned,
  Network,
  Workflow,
} from "lucide-react";

const roles = [
  {
    title: "GTM Engineer",
    type: "Full-time",
    location: "Remote, with city-launch travel when useful",
    summary:
      "Build the GTM scaffolding that lets Blueprint launch new cities, source real capture supply, and turn buyer demand into repeatable autonomous workflows.",
    description:
      "This is a systems builder role for someone who can wire research, ledgers, agent runs, outbound drafts, city playbooks, and buyer follow-up into one operating loop. You will use GTM tools when they help, but the job is to make Blueprint's autonomous organization do more of the work every week without inventing traction or weakening provenance.",
    href: "mailto:apply+gtm-engineer@tryblueprint.io?subject=Blueprint%20GTM%20Engineer",
    icon: Workflow,
  },
];

const roleScope = [
  {
    title: "Autonomous GTM systems",
    body: "Design the agent workflows, scoring rules, review gates, dashboards, and first-party ledgers that move targets from research to outreach to buyer follow-up.",
    icon: Network,
  },
  {
    title: "City launches",
    body: "Start from zero in a city: map target sites, build lawful capture supply, find robot-team demand, run small experiments, and leave behind a playbook the org can repeat.",
    icon: MapPinned,
  },
  {
    title: "Proof-led growth",
    body: "Keep every campaign tied to real capture provenance, site-specific packages, hosted-review artifacts, and buyer outcomes. No fake contact data, fake proof, or empty scale theatre.",
    icon: CheckCircle2,
  },
];

const responsibilities = [
  "Build signal-based target discovery, enrichment, scoring, and routing around Blueprint's exact-site hosted-review wedge.",
  "Turn city-launch experiments into repeatable agent programs, QA checks, owner handoffs, and operating metrics.",
  "Create outbound and follow-up workflows that stay recipient-backed, approval-aware, and tied to real capture or demand evidence.",
  "Partner with product and ops to close the loop between buyer asks, capture supply, hosted-session artifacts, and the next city playbook.",
  "Use tools like Clay, CRMs, scraping/search providers, workflow automation, LLMs, and internal Paperclip agents where they fit. Build the missing glue when they do not.",
];

const goodFitSignals = [
  "You have built revenue, growth, RevOps, sales engineering, marketplace ops, or city-launch systems from messy inputs.",
  "You can ship lightweight software, automations, SQL or API integrations, spreadsheets, and dashboards without waiting for a full engineering pod.",
  "You like field reality: local operators, supply constraints, buyer objections, messy source data, and small tests that prove what works.",
  "You care about truth boundaries. You will not call a city live because a deck says so, and you will not let an agent invent a buyer, a site, or a send.",
];

export default function Careers() {
  return (
    <>
      <SEO
        title="Careers | Blueprint"
        description="Blueprint is hiring a GTM Engineer to build autonomous go-to-market systems and launch city-by-city growth loops for site-specific world-model products."
        canonical="/careers"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.careersStudio}
            alt="Careers hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[36rem] flex-col justify-end">
                  <EditorialSectionLabel light>Careers</EditorialSectionLabel>
                  <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] text-white sm:text-[5rem]">
                    Build the growth system that launches Blueprint city by city.
                  </h1>
                  <p className="mt-6 text-base leading-8 text-white/70">
                    We need one GTM Engineer who can turn agents, research, capture supply, buyer demand, and city operations into a working machine.
                  </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.title}
                  className="bg-slate-950 p-6 text-white"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      <div className="border border-white/15 bg-white/5 p-3 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-editorial text-[2.3rem] leading-[0.95]">
                          {role.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/55">
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-4 w-4" />
                            {role.type}
                          </span>
                          <span>{role.location}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={role.href}
                      className="inline-flex items-center bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                    >
                      Apply by email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                  <p className="mt-6 max-w-4xl text-base leading-7 text-white/75">{role.summary}</p>
                  <p className="mt-4 max-w-4xl text-sm leading-7 text-white/65">{role.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {roleScope.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="border border-black/10 bg-white p-5">
                  <Icon className="h-5 w-5 text-slate-950" />
                  <h2 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-8 px-5 pb-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:pb-14">
          <div>
            <EditorialSectionLabel>What You Will Own</EditorialSectionLabel>
            <h2 className="font-editorial mt-4 text-4xl leading-[0.95] text-slate-950 sm:text-[3.35rem]">
              A city-launch loop that gets sharper every time it runs.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              The work should feel closer to an early city launcher than a conventional growth hire. You will be expected to build the system, run it in the real world, measure what happened, and make the next run easier for agents and humans.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Responsibilities
              </h3>
              <ul className="mt-5 grid gap-4">
                {responsibilities.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Good Fit Signals
              </h3>
              <ul className="mt-5 grid gap-4">
                {goodFitSignals.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Apply"
            title="Send the systems you have built."
            description="A short note is enough. Include one workflow, launch, automation, or market buildout you owned end to end, plus what changed because of it."
            imageSrc={editorialGeneratedAssets.careersStudio}
            imageAlt="Blueprint careers studio"
            primaryHref="mailto:apply+gtm-engineer@tryblueprint.io?subject=Blueprint%20GTM%20Engineer"
            primaryLabel="apply+gtm-engineer@tryblueprint.io"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
