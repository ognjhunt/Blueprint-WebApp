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
  PackageCheck,
  Workflow,
} from "lucide-react";

const roles = [
  {
    title: "Founding GTM Systems Lead",
    type: "Full-time",
    location: "Remote, with city-launch travel when useful",
    summary:
      "Own the human-plus-agent GTM system for Blueprint: city launches, buyer research, outbound, follow-up, content, reporting, and the workflows behind it.",
    description:
      "This is for someone who wants to run a lean GTM org where agents do most of the execution. You do not need to be a software engineer. You do need to be unusually good at breaking work into clearly owned workstreams, writing clear briefs, setting review gates, checking outputs, and turning messy market signal into a system the next run can reuse.",
    href: "mailto:apply+gtm-systems@tryblueprint.io?subject=Blueprint%20Founding%20GTM%20Systems%20Lead",
    icon: Workflow,
  },
  {
    title: "Founding Delivery Systems Lead",
    type: "Full-time",
    location: "Remote, with site or city travel when useful",
    summary:
      "Own the delivery system for Blueprint: capture execution, site readiness, hosted-review delivery, buyer success, QA, provenance checks, and the workflows behind it.",
    description:
      "This is for someone who can turn messy field and customer requests into repeatable workflows. Agents, contractors, and tools will do much of the execution. Your job is to set the path, check the evidence, catch weak follow-through, and make sure real-site outputs ship without fake readiness or loose provenance.",
    href: "mailto:apply+delivery-systems@tryblueprint.io?subject=Blueprint%20Founding%20Delivery%20Systems%20Lead",
    icon: PackageCheck,
  },
];

const roleScope = [
  {
    title: "Agent workflow ownership",
    body: "Run the GTM agent workflows like a small team: buyer research, city demand, outbound drafts, reply triage, content, analytics, and partner discovery.",
    icon: Network,
  },
  {
    title: "City launches",
    body: "Start from zero in a city, use agents to map the market, find robot-team demand, identify capture supply, and leave behind a repeatable launch system.",
    icon: MapPinned,
  },
  {
    title: "Delivery loops",
    body: "Connect capture work, site access, QA, provenance, hosted-review delivery, and buyer success so real-site work does not live in scattered notes.",
    icon: CheckCircle2,
  },
];

const gtmResponsibilities = [
  "Own the GTM system: agent briefs, workstream assignments, QA checks, review gates, dashboards, and weekly operating rhythm.",
  "Build city-launch playbooks that start with a city and end with named targets, capture opportunities, buyer follow-up, and a clear next experiment.",
  "Use agents for the heavy work: account research, enrichment, first drafts, market maps, content variants, reply summaries, CRM hygiene, and status reporting.",
  "Inspect the outputs. Fix weak prompts, unclear owners, stale records, and agent loops that look busy without moving the business.",
  "Work with the founder on the wedge: exact-site hosted review for robot teams, backed by real capture provenance and buyer-visible proof.",
  "Use tools like Clay, CRMs, search providers, workflow automation, spreadsheets, LLMs, and Paperclip agents where they help. Keep the system simple enough to understand.",
];

const gtmWeekExamples = [
  "Choose one city, define the launch question, and spin up agents to build the first market map.",
  "Review 40 agent-sourced targets, cut the weak ones, and turn the strong ones into a clean outreach and follow-up queue.",
  "Rewrite a bad agent brief because the output was too vague, too generic, or not tied to real Blueprint proof.",
  "Turn buyer replies and objections into new scoring rules, content angles, product notes, and the next agent run.",
  "Write the weekly readout: what moved, what was noise, where a human needs to step in, and what the system should do next.",
];

const gtmGoodFitSignals = [
  "You have run GTM, RevOps, growth, marketplace ops, city launch, founder-led sales support, or scrappy business operations from messy inputs.",
  "You are fluent with agents. You know how to brief them, constrain them, check them, and make them better without micromanaging every task.",
  "You are technical enough to use APIs, automation tools, spreadsheets, CRMs, dashboards, and no-code or low-code workflows. You do not need to be a full-time engineer.",
  "You like field reality: local operators, supply constraints, buyer objections, half-complete data, and small tests that prove what works.",
  "You care about truth boundaries. You will not call a city live because a deck says so, and you will not let an agent invent a buyer, a site, or a send.",
];

const deliveryResponsibilities = [
  "Own the delivery system: capture briefs, site-readiness checks, hosted-review follow-through, QA gates, buyer updates, and proof records.",
  "Run the delivery agent workflows: capture work, rights and provenance, buyer success, hosted review, field work, site access, QA, and package delivery.",
  "Turn messy buyer and field requests into repeatable workflows with owners, due dates, acceptance criteria, and clear escalation points.",
  "Check the hard truth: capture provenance, rights and privacy state, site access, package manifests, hosted-session files, and buyer-visible deliverables.",
  "Work with GTM and the founder to decide which delivery requests are real opportunities, which are distractions, and what the next run should automate.",
  "Keep the system boring where it needs to be boring: status, evidence, checklists, and buyer promises should be easy to audit.",
];

const deliveryWeekExamples = [
  "Take a buyer or site request and turn it into a capture and delivery brief that agents can actually execute.",
  "Review agent-prepared site readiness, access, QA, and provenance packets before work moves forward.",
  "Spot the missing proof: a vague capture source, unclear rights state, weak hosted-review record, or buyer update that overclaims.",
  "Coordinate the human parts of delivery: local capture, site contact, contractor follow-up, buyer check-in, or founder escalation.",
  "Write the delivery readout: what shipped, what is blocked, what proof exists, and which workflow should become agent-owned next time.",
];

const deliveryGoodFitSignals = [
  "You have run operations, customer delivery, field programs, implementation, technical account work, marketplace supply, or production workflows.",
  "You are comfortable managing agents and humans in the same loop. Some work is digital, some work is field reality, and both need clean follow-through.",
  "You can read a messy request and turn it into a checklist, a runbook, a QA gate, and a buyer-facing update without making it bureaucratic.",
  "You care about evidence. If package proof, site clearance, or hosted-review evidence is missing, you name the exact gap plainly.",
  "You are calm around operational mess: late inputs, partial captures, unclear ownership, buyer pressure, and tools that almost work.",
];

export default function Careers() {
  return (
    <>
      <SEO
        title="Careers | Blueprint"
        description="Blueprint is hiring founding systems leads for GTM and delivery loops around site-specific world-model products."
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
                    Build the systems behind exact-site world models.
                  </h1>
                  <p className="mt-5 max-w-[34rem] text-base leading-7 text-white/75 sm:leading-8">
                    Founding systems leads turn agent runs, city research, capture supply, buyer requests, and delivery work into repeatable operating loops.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a
                      href="#open-roles"
                      className="inline-flex w-full items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                    >
                      View open roles
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="mailto:careers@tryblueprint.io?subject=Blueprint%20Founding%20Systems%20Lead"
                      className="inline-flex w-full items-center justify-center border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                    >
                      Apply by email
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section id="open-roles" className="mx-auto max-w-[88rem] scroll-mt-20 px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-2">
            {roles.map((role, index) => {
              const Icon = role.icon;
              const isDark = index === 0;
              return (
                <div
                  key={role.title}
                  className={isDark ? "bg-slate-950 p-6 text-white" : "border border-black/10 bg-white p-6 text-slate-950"}
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      <div className={isDark ? "border border-white/15 bg-white/5 p-3 text-white" : "border border-black/10 bg-[#f5f3ef] p-3 text-slate-950"}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-editorial text-[2.3rem] leading-[0.95]">
                          {role.title}
                        </h2>
                        <div className={isDark ? "mt-2 flex flex-wrap gap-3 text-sm text-white/55" : "mt-2 flex flex-wrap gap-3 text-sm text-slate-500"}>
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
                      className={isDark ? "inline-flex items-center bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100" : "inline-flex items-center bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"}
                    >
                      Apply by email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                  <p className={isDark ? "mt-6 max-w-4xl text-base leading-7 text-white/75" : "mt-6 max-w-4xl text-base leading-7 text-slate-700"}>{role.summary}</p>
                  <p className={isDark ? "mt-4 max-w-4xl text-sm leading-7 text-white/65" : "mt-4 max-w-4xl text-sm leading-7 text-slate-600"}>{role.description}</p>
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
              The first real GTM system for a lean company.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              The work should feel closer to an early Uber city launcher than a conventional growth hire. You will build the process, run it in the real world, measure what happened, and make the next run easier for both agents and humans.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Responsibilities
              </h3>
              <ul className="mt-5 grid gap-4">
                {gtmResponsibilities.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                A Normal Week
              </h3>
              <ul className="mt-5 grid gap-4">
                {gtmWeekExamples.map((item) => (
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
                {gtmGoodFitSignals.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-8 px-5 pb-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:pb-14">
          <div>
            <EditorialSectionLabel>Delivery Systems Lead</EditorialSectionLabel>
            <h2 className="font-editorial mt-4 text-4xl leading-[0.95] text-slate-950 sm:text-[3.35rem]">
              Make real-site delivery repeatable before it turns into chaos.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              This role sits between capture, site access, hosted review, buyer success, and the agents that keep the work moving. The goal is simple: every messy request should become a clearer workflow, stronger proof, and a cleaner next step.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Responsibilities
              </h3>
              <ul className="mt-5 grid gap-4">
                {deliveryResponsibilities.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                A Normal Week
              </h3>
              <ul className="mt-5 grid gap-4">
                {deliveryWeekExamples.map((item) => (
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
                {deliveryGoodFitSignals.map((item) => (
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
            title="Show us the system you would run."
            description="Send a short note with one workflow, launch, delivery loop, automation, or market buildout you owned end to end. Tell us what the agents or tools did, what you checked yourself, and what changed because of it."
            imageSrc={editorialGeneratedAssets.careersStudio}
            imageAlt="Blueprint careers studio"
            primaryHref="mailto:careers@tryblueprint.io?subject=Blueprint%20Founding%20Systems%20Lead"
            primaryLabel="careers@tryblueprint.io"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
