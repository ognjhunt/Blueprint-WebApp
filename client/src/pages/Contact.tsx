import { useMemo, useState, type FormEvent } from "react";
import { Helmet } from "@/lib/helmet";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, Bot, MapPin, Camera, Mail } from "lucide-react";

import {
  Button,
  Eyebrow,
  Field,
  SelectField,
  StatusChip,
} from "@/components/blueprint";
import { MonochromeMedia } from "@/components/site/editorial";
import { parseContactRequestPrefill } from "@/lib/contactRequestPrefill";

type ContactPersona = "robot_team" | "site_operator";

function personaFromContext(params: {
  location: string;
  prefill: ReturnType<typeof parseContactRequestPrefill>;
}): ContactPersona {
  if (params.location === "/contact/site-operator") return "site_operator";
  if (params.prefill.buyerType === "site_operator") return "site_operator";
  return "robot_team";
}

const routeCards = [
  {
    persona: "robot_team" as const,
    href: "/contact/robot-team#contact-intake",
    eyebrow: "Robot teams",
    title: "Compare policies on a real site.",
    body: "Bring one site and one task. We scope the run and return a priced plan.",
    Icon: Bot,
  },
  {
    persona: "site_operator" as const,
    href: "/contact/site-operator#contact-intake",
    eyebrow: "Site operators",
    title: "Supply or monitor a facility.",
    body: "Start a $5k/site supply review or scope yearly monitoring. You control access.",
    Icon: MapPin,
  },
  {
    persona: null,
    href: "/signup?flow=capturer",
    eyebrow: "Capturers",
    title: "Capture sites near you.",
    body: "Run lawful public-facing captures and get paid per validated bundle.",
    Icon: Camera,
  },
];

export default function Contact() {
  const search = useSearch();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const prefill = useMemo(
    () => parseContactRequestPrefill(searchParams, location),
    [location, searchParams],
  );
  const persona = personaFromContext({ location, prefill });
  const isSiteOperator = persona === "site_operator";

  const [submitted, setSubmitted] = useState(false);

  const headline = isSiteOperator
    ? "Share a place for policy comparison."
    : "Tell us what policies to compare.";
  const subhead = isSiteOperator
    ? "Start a $5,000/site supply review or scope yearly monitoring. Access, rights, and pricing are confirmed per scope."
    : "We will recommend the right subscription, quick-look, or site-ops comparison path. Request only — nothing is committed.";

  const intentOptions = isSiteOperator
    ? [
        { value: "supply", label: "Supply a site for review" },
        { value: "monitoring", label: "Scope yearly monitoring" },
        { value: "rights", label: "Discuss rights and access" },
      ]
    : [
        { value: "subscription", label: "Robot-team subscription" },
        { value: "quick-look", label: "Quick-look evaluation" },
        { value: "site-ops", label: "Site-ops comparison" },
      ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Mock submit — no backend. Real intake is wired separately.
    setSubmitted(true);
  }

  return (
    <>
      <Helmet>
        <title>
          {isSiteOperator ? "Submit a Site | Blueprint" : "Start a Policy Evaluation | Blueprint"}
        </title>
        <meta
          name="description"
          content={
            isSiteOperator
              ? "Submit a site for Blueprint robot policy evaluation review. You control rights and access."
              : "Start a Blueprint policy evaluation request for captured real-site tasks."
          }
        />
        <link
          rel="canonical"
          href={`https://tryblueprint.io${isSiteOperator ? "/contact/site-operator" : "/contact/robot-team"}`}
        />
      </Helmet>

      <div className="bg-canvas text-ink">
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-[88rem] px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
            <div className="max-w-[44rem]">
              <Eyebrow tone="brass" rule>
                Contact Blueprint
              </Eyebrow>
              <h1 className="font-editorial mt-6 text-[clamp(2.4rem,4.6vw,3.8rem)] font-medium leading-[0.98] tracking-[-0.045em] text-ink">
                {headline}
              </h1>
              <p className="mt-6 text-lg leading-[1.7] text-ink-600">{subhead}</p>
            </div>
          </div>
        </section>

        {/* 2-col: inquiry form + route cards over MonochromeMedia */}
        <section
          id="contact-intake"
          className="mx-auto grid max-w-[88rem] scroll-mt-8 gap-4 px-5 py-12 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-16"
        >
          {/* Inquiry form */}
          <div className="rounded-md border border-line bg-white p-6 sm:p-8">
            <div className="border-b border-line-soft pb-5">
              <Eyebrow tone="muted">
                {isSiteOperator ? "Send the site" : "Send the request"}
              </Eyebrow>
              <h2 className="mt-3 text-title-m font-semibold tracking-tight text-ink">
                Keep it short. We will ask for missing details.
              </h2>
            </div>

            {submitted ? (
              <div className="mt-6 flex flex-col items-start gap-4 rounded-sm border border-proof-bd bg-proof-bg p-6">
                <StatusChip tone="proof" square>
                  Received
                </StatusChip>
                <div>
                  <h3 className="text-title-m font-semibold tracking-tight text-ink">
                    Message received.
                  </h3>
                  <p className="mt-2 text-[15px] leading-[1.7] text-ink-600">
                    {isSiteOperator
                      ? "We will review the place and follow up to confirm access, rights, and scope. No access is granted until you approve it."
                      : "We will check the task, scope the comparison, and return a priced run plan. Nothing is committed until you confirm scope."}
                  </p>
                </div>
                <Button variant="secondary" size="md" onClick={() => setSubmitted(false)}>
                  Send another
                </Button>
              </div>
            ) : (
              <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Name" name="name" placeholder="Jordan Lee" required />
                  <Field
                    label="Work email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label={isSiteOperator ? "Organization" : "Robot team / company"}
                    name="org"
                    placeholder="Company"
                  />
                  <SelectField
                    label={isSiteOperator ? "What you want to do" : "What you want to run"}
                    placeholder="Select one"
                    options={intentOptions}
                    name="intent"
                  />
                </div>
                <div className="flex w-full flex-col gap-1.5">
                  <label
                    htmlFor="contact-message"
                    className="text-caption font-semibold text-ink-800"
                  >
                    {isSiteOperator ? "About the place" : "About the task"}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    placeholder={
                      isSiteOperator
                        ? "Facility type, location, access windows, and any restricted zones."
                        : "The site, the task, the policies to compare, and the threshold you care about."
                    }
                    className="w-full rounded-xs border border-line-strong bg-white px-[0.65rem] py-2.5 text-body-s font-medium text-ink-900 outline-none transition-shadow duration-200 ease-standard placeholder:font-normal placeholder:text-ink-400 focus:border-brass-deep focus:ring-2 focus:ring-brass-deep/60"
                  />
                </div>
                <div className="flex flex-col gap-4 border-t border-line-soft pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-caption text-ink-500">
                    Request only. Access, pricing, rights, and execution are confirmed per scope.
                  </p>
                  <Button type="submit" variant="brass" size="md" iconRight={<ArrowRight />}>
                    Send message
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Route cards over MonochromeMedia */}
          <aside className="flex flex-col gap-4">
            <MonochromeMedia
              src="/redesign/pov/route-scan.jpg"
              alt="Captured route scan of a real facility (review support, not real-world proof)"
              className="min-h-[12rem]"
              imageClassName="min-h-[12rem]"
              overlay="bg"
            >
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <span className="inline-flex w-fit items-center gap-2 rounded-sm border border-white/15 bg-black/40 px-[0.6rem] py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-on-ink)]">
                  Review support · not real-world proof
                </span>
                <p className="font-editorial max-w-[20rem] text-[1.4rem] leading-[1.06] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                  Pick the path that matches your role.
                </p>
              </div>
            </MonochromeMedia>

            <div className="grid gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8]">
              {routeCards.map(({ href, eyebrow, title, body, Icon, persona: cardPersona }) => {
                const active = cardPersona !== null && cardPersona === persona;
                return (
                  <a
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className="group flex items-start gap-4 bg-white p-5 transition-colors duration-200 ease-standard hover:bg-inset"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-line bg-inset text-ink-700 group-hover:border-brass-deep">
                      <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">
                          {eyebrow}
                        </span>
                        {active ? (
                          <StatusChip tone="info" square dot={false}>
                            You
                          </StatusChip>
                        ) : null}
                      </span>
                      <span className="mt-1.5 block text-body-s font-semibold text-ink">
                        {title}
                      </span>
                      <span className="mt-1 block text-caption leading-[1.55] text-ink-500">
                        {body}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </a>
                );
              })}
            </div>

            <div className="flex items-center gap-2 rounded-md border border-line bg-white px-5 py-4">
              <Mail className="h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
              <span className="font-mono text-[13px] text-ink-700">team@tryblueprint.io</span>
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}
