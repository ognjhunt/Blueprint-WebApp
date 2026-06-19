import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { parseContactRequestPrefill } from "@/lib/contactRequestPrefill";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";

type ContactPersona = "robot_team" | "site_operator";

const robotNextSteps = [
  "We review the site/task fit.",
  "We recommend scope and scenario count.",
  "You approve pricing and access terms.",
  "We run the evaluation or prepare the site/task package.",
];

const dataPackageNextSteps = [
  "We review the supplied policy, robot embodiment, task, and thresholds.",
  "We confirm the sim-only scope, policy access method, and evidence boundary.",
  "We recommend the baseline eval, curriculum, candidate count, and sealed-test plan.",
  "You approve pricing and access terms before improvement work starts.",
];

const operatorNextSteps = [
  "We review the site and access boundary.",
  "We confirm what can be captured or listed.",
  "You approve any marketplace or commercial-use terms.",
  "Robot-team access stays inside the agreed boundary.",
];

function personaFromPrefill(params: {
  location: string;
  prefill: ReturnType<typeof parseContactRequestPrefill>;
}): ContactPersona {
  if (params.location === "/contact/site-operator") return "site_operator";
  if (params.prefill.buyerType === "site_operator") return "site_operator";
  return "robot_team";
}

function PersonaSwitch({ activePersona }: { activePersona: ContactPersona }) {
  const links = [
    {
      persona: "robot_team" as const,
      href: "/contact/robot-team#contact-intake",
      title: "Robot teams",
      body: "Request an evaluation or policy improvement run.",
      Icon: Bot,
    },
    {
      persona: "site_operator" as const,
      href: "/contact/site-operator#contact-intake",
      title: "Site operators",
      body: "Submit a site for free.",
      Icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="Choose contact path">
      {links.map(({ persona, href, title, body, Icon }) => {
        const active = activePersona === persona;
        return (
          <a
            key={persona}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[5rem] items-center justify-between gap-4 border px-4 py-3 text-sm transition ${
              active
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-black/10 bg-white text-slate-950 hover:border-slate-300"
            }`}
          >
            <span>
              <span className="block font-semibold">{title}</span>
              <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>
                {body}
              </span>
            </span>
            <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[#c7a775]" : "text-slate-500"}`} />
          </a>
        );
      })}
    </div>
  );
}

function ContextSummary({
  prefill,
}: {
  prefill: ReturnType<typeof parseContactRequestPrefill>;
}) {
  const rows = [
    ["Source", prefill.source],
    ["Site", prefill.siteName],
    ["Location", prefill.siteLocation],
    ["Site type", prefill.targetSiteType],
    ["Task", prefill.taskStatement || prefill.workflow],
    ["Robot", prefill.targetRobotTeam],
  ].filter(([, value]) => Boolean(value));

  if (rows.length === 0) return null;

  return (
    <details className="border border-black/10 bg-[#f8f6f1]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-950">
        Prefilled context attached
      </summary>
      <div className="grid gap-px border-t border-black/10 bg-black/10 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3 text-sm">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ExplainerCard({
  persona,
  isDataPackage,
}: {
  persona: ContactPersona;
  isDataPackage: boolean;
}) {
  if (persona === "site_operator") {
    return (
      <aside className="border border-black/10 bg-white p-5">
        <LockKeyhole className="h-5 w-5 text-slate-950" />
        <p className="mt-4 text-sm font-semibold text-slate-950">
          Submitting a site is free.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You set the privacy, access, and commercialization boundary before
          Blueprint changes listing or robot-team access.
        </p>
      </aside>
    );
  }

  if (isDataPackage) {
    return (
      <aside className="border border-black/10 bg-white p-5">
        <ClipboardCheck className="h-5 w-5 text-slate-950" />
        <p className="mt-4 text-sm font-semibold text-slate-950">
          A Policy Improvement Run means:
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Baseline evaluation, failure diagnosis, twin and cousin scenarios,
          curriculum generation, sim-only post-training, sealed testing, and an
          evidence report.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Source access is optional. Full-stack teams can use an API endpoint,
          container, private runner, sim plugin, or action traces; improved
          artifacts require a trainable interface or approved wrapper path.
        </p>
      </aside>
    );
  }

  return (
    <aside className="border border-black/10 bg-white p-5">
      <ClipboardCheck className="h-5 w-5 text-slate-950" />
      <p className="mt-4 text-sm font-semibold text-slate-950">
        A Task Evaluation Run means:
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        1 site x 1 robot policy/profile x 1 task pack x scenario count.
      </p>
    </aside>
  );
}

function NextSteps({
  persona,
  isDataPackage,
}: {
  persona: ContactPersona;
  isDataPackage: boolean;
}) {
  const steps =
    persona === "site_operator"
      ? operatorNextSteps
      : isDataPackage
        ? dataPackageNextSteps
        : robotNextSteps;

  return (
    <div className="border border-black/10 bg-white p-5">
      <p className="text-sm font-semibold text-slate-950">What happens next</p>
      <div className="mt-4 grid gap-3">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-3 text-sm leading-6 text-slate-600">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-black/10 bg-[#f8f6f1] text-xs font-semibold text-slate-950">
              {index + 1}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-black/10 pt-4 text-xs leading-5 text-slate-500">
        Requests create an intake record. Access, rights, pricing, provider
        execution, and hosted availability are confirmed per request.
      </p>
    </div>
  );
}

export default function Contact() {
  const search = useSearch();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const prefill = useMemo(
    () => parseContactRequestPrefill(searchParams, location),
    [location, searchParams],
  );
  const persona = personaFromPrefill({ location, prefill });
  const isSiteOperator = persona === "site_operator";
  const isDataPackage =
    persona === "robot_team" && prefill.requestPath === "data-package";
  const headline = isSiteOperator
    ? "Submit a Site for Robot Evaluation."
    : isDataPackage
      ? "Request a Policy Improvement Run."
    : "Request a Task Evaluation Run.";
  const subhead = isSiteOperator
    ? "Share a facility that robot teams can evaluate against. Participation is free, and you control access boundaries."
    : isDataPackage
      ? "Scope a sim-only run around a customer-supplied policy. Source access is optional; improved artifacts require a trainable interface or approved wrapper path."
    : "Test one robot policy or profile against a real-site task pack before field time.";
  const intro = isSiteOperator
    ? "Tell us what the site is, where it is, and what access/privacy limits apply. We will review whether it fits the Blueprint site library."
    : isDataPackage
      ? "Tell us the site type, robot embodiment, action interface, target task, policy access method, and success or cycle-time threshold. We will reply with the recommended sim-only scope and evidence boundary."
    : "Tell us the site type, task, and threshold that matters. We will reply with the recommended scope, scenario count, and next proof step.";

  return (
    <>
      <SEO
        title={
          isSiteOperator
            ? "Submit a Site for Robot Evaluation | Blueprint"
            : isDataPackage
              ? "Request a Policy Improvement Run | Blueprint"
            : "Request a Task Evaluation Run | Blueprint"
        }
        description={
          isSiteOperator
            ? "Submit a facility to Blueprint for free robot-evaluation review with access, privacy, and commercialization boundaries."
            : isDataPackage
              ? "Request a Blueprint Policy Improvement Run for sim-only baseline evaluation, failure diagnosis, policy improvement, sealed testing, and an evidence report."
            : "Request a Blueprint Task Evaluation Run for one robot policy, real-site task pack, and scenario scope."
        }
        canonical={isSiteOperator ? "/contact/site-operator" : "/contact/robot-team"}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-[#fbfaf7]">
          <div className="mx-auto grid max-w-[84rem] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-20">
            <div className="max-w-[50rem]">
              <h1 className="font-editorial text-[3.1rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[5rem] sm:tracking-[-0.06em]">
                {headline}
              </h1>
              <p className="mt-5 max-w-[39rem] text-base leading-8 text-slate-600">
                {subhead}
              </p>
              <p className="mt-4 max-w-[36rem] text-sm leading-7 text-slate-600">
                {intro}
              </p>
              <div className="mt-8 max-w-[42rem]">
                <PersonaSwitch activePersona={persona} />
              </div>
            </div>

            <div className="space-y-3 lg:pt-3">
              <ExplainerCard persona={persona} isDataPackage={isDataPackage} />
              <a
                href="#contact-intake"
                className="inline-flex w-full items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {isSiteOperator
                  ? "Submit site free"
                  : isDataPackage
                    ? "Request policy improvement"
                    : "Request evaluation"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section
          id="contact-intake"
          className="mx-auto grid max-w-[84rem] scroll-mt-8 gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,0.68fr)_minmax(20rem,0.32fr)] lg:px-10 lg:py-12"
        >
          <div className="border border-black/10 bg-white p-5 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.28)] sm:p-6 lg:p-8">
            <div className="mb-6 border-b border-black/10 pb-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <CheckCircle2 className="h-4 w-4 text-[#98733f]" />
                {isSiteOperator
                  ? "Free site submission"
                  : isDataPackage
                    ? "Policy Improvement Run"
                    : "Task Evaluation Run"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {isSiteOperator
                  ? "Set the site boundary."
                  : isDataPackage
                    ? "Send the policy improvement request."
                    : "Send the evaluation request."}
              </h2>
            </div>

            <div className="mb-5">
              <ContextSummary prefill={prefill} />
            </div>

            <ContactForm />
          </div>

          <div className="space-y-4">
            <NextSteps persona={persona} isDataPackage={isDataPackage} />
          </div>
        </section>
      </div>
    </>
  );
}
