import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, Bot, MapPin, Mail } from "lucide-react";

import {
  Eyebrow,
  Field,
  SelectField,
  StatusChip,
} from "@/components/blueprint";
import { MonochromeMedia } from "@/components/site/editorial";
import { SEO } from "@/components/SEO";
import { robotPolicyBeachheadShort } from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  buyerRunOnboardingTimeline,
  buyerRunReceiveLinks,
} from "@/lib/buyerRunOnboarding";
import { parseContactRequestPrefill } from "@/lib/contactRequestPrefill";
import { withCsrfHeader } from "@/lib/csrf";

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
    title: "Test a captured site task.",
    body: "Bring the robot specification or candidate. Blueprint supplies the captured workflow and common testbed.",
    Icon: Bot,
  },
];

export default function Contact() {
  const search = useSearch();
  const [location, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const prefill = useMemo(
    () => parseContactRequestPrefill(searchParams, location),
    [location, searchParams],
  );
  const persona = personaFromContext({ location, prefill });
  const isSiteOperator = persona === "site_operator";
  const initialIntent =
    isSiteOperator &&
    ["pilot-opportunity", "prepare-pilot-opportunity"].includes(
      String(searchParams.get("intent") || searchParams.get("interest") || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-"),
    )
      ? "pilot-opportunity"
      : "task-evaluation-run";

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState(initialIntent);

  const headline = isSiteOperator
    ? "Show us the job. We find the robot that can do it."
    : "Get evaluated against a job someone is ready to buy.";
  const subhead = isSiteOperator
    ? "A short workflow description, phone video, and the operating numbers are enough to begin automatic screening. No robot vendor is required."
    : "Tell us what your robot can do and which site job you want to be evaluated against. Every job on Blueprint comes from a site with a budget and a named owner. We will identify the missing months 0–2 inputs.";

  const intentOptions = isSiteOperator
    ? [
        { value: "task-evaluation-run", label: "Task Evaluation Run" },
        { value: "pilot-opportunity", label: "Prepare a pilot opportunity" },
        { value: "rights", label: "Discuss rights and access" },
      ]
    : [
        { value: "task-evaluation-run", label: "Task Evaluation Run" },
        { value: "repeat-runs", label: "Repeated evaluation runs" },
      ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const intentValue = selectedIntent || String(formData.get("intent") ?? "");
    const intentLabel =
      intentOptions.find((option) => option.value === intentValue)?.label ||
      intentValue;

    if (isSiteOperator && intentValue === "pilot-opportunity") {
      setLocation(
        "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=site-operator-contact",
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: String(formData.get("name") ?? "").trim(),
          email: String(formData.get("email") ?? "").trim(),
          company: String(formData.get("org") ?? "").trim(),
          message: String(formData.get("message") ?? "").trim(),
          projectType: intentLabel,
          engagementScope: isSiteOperator ? "site_operator" : "robot_team",
          requestSource: "website-contact-form",
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error || "Unable to send your request right now.",
        );
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to send your request right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title="Get a robot evaluated | Blueprint"
        description={
          isSiteOperator
            ? "Submit a real workflow for private robot-deployment screening and a permissioned Task Evaluation Run."
            : "Evaluate robot fit against a captured site-task before committing to onsite deployment work."
        }
        canonical={isSiteOperator ? "/contact/site-operator" : "/contact/robot-team"}
        jsonLd={[
          webPageJsonLd({
            path: isSiteOperator ? "/contact/site-operator" : "/contact/robot-team",
            name: "Request a Blueprint Task Evaluation Run",
            description: isSiteOperator
              ? "Structured Task Evaluation Run intake for a site operator."
              : "Structured Task Evaluation Run intake for a robot team.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            {
              name: "Task Evaluation Run",
              path: isSiteOperator ? "/contact/site-operator" : "/contact/robot-team",
            },
          ]),
        ]}
      />

      <div className="bg-runway-deep text-runway-text">
        {/* Hero */}
        <section className="border-b border-runway-line bg-runway-black">
          <div className="mx-auto max-w-[88rem] px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
            <div className="max-w-[44rem]">
              <Eyebrow tone="brass" rule>
                Months 0–2 intake
              </Eyebrow>
              <h1 className="font-editorial mt-6 font-display uppercase text-[clamp(2.4rem,4.6vw,3.8rem)] font-semibold leading-[0.98] tracking-[0.005em] text-runway-text">
                {headline}
              </h1>
              <p className="mt-6 max-w-[68ch] text-[17px] leading-[1.7] text-runway-body">{subhead}</p>
              {!isSiteOperator ? (
                <p className="runway-eyebrow mt-4">
                  Beachhead: {robotPolicyBeachheadShort}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* 2-col: inquiry form + route cards over MonochromeMedia */}
        <section
          id="contact-intake"
          className="mx-auto grid max-w-[88rem] scroll-mt-8 gap-4 px-5 py-12 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-16"
        >
          {/* Inquiry form */}
          <div className="runway-panel p-6 sm:p-8">
            <div className="border-b border-runway-line-soft pb-5">
              <Eyebrow tone="muted">
                {isSiteOperator ? "Send the site" : "Send the request"}
              </Eyebrow>
              <h2 className="mt-3 font-display text-[1.5rem] font-semibold uppercase leading-[1.05] tracking-[0.005em] text-runway-text">
                Start with what you know. Blueprint will name what is missing.
              </h2>
            </div>

            {submitted ? (
              <div className="runway-panel mt-6 flex flex-col items-start gap-4 bg-runway-black p-6">
                <StatusChip tone="proof" square>
                  Received
                </StatusChip>
                <div>
                  <h3 className="font-display text-[1.25rem] font-semibold uppercase leading-[1.1] tracking-[0.005em] text-runway-text">
                    Message received.
                  </h3>
                  <p className="mt-2 max-w-[68ch] text-[16px] leading-[1.7] text-runway-body">
                    {isSiteOperator
                      ? "We will review the workflow, decision, evidence gaps, access, rights, and scope, then return a scoped run plan and quote. No capture happens until you approve it."
                      : "We will check the task, decision, thresholds, evidence, and constraints, then return a scoped run plan and quote. If approved, the run record appears in the authenticated app after authorization."}
                  </p>
                </div>
                <button type="button" className="runway-cta-ghost" onClick={() => setSubmitted(false)}>
                  Send another
                </button>
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
                    required
                  />
                  <SelectField
                    label={isSiteOperator ? "What you want to do" : "What you want to run"}
                    placeholder="Select one"
                    options={intentOptions}
                    name="intent"
                    value={selectedIntent}
                    onValueChange={setSelectedIntent}
                  />
                </div>
                <div className="flex w-full flex-col">
                  <label htmlFor="contact-message" className="runway-label">
                      About the workflow
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    placeholder={
                      isSiteOperator
                        ? "What moves from where to where, object sizes and weights, cycle time, shifts, exceptions, systems, access windows, and restricted zones."
                        : "Robot geometry, payload, reach, sensors, required interfaces, deployment geography, candidate software, and the site-task you want to test."
                    }
                    className="runway-input bg-runway-black"
                  />
                </div>
                {submitError ? (
                  <p role="alert" className="text-[15px] font-medium leading-[1.7] text-runway-red">
                    {submitError} You can retry, or email{" "}
                    <a className="underline underline-offset-2" href="mailto:team@tryblueprint.io">
                      team@tryblueprint.io
                    </a>
                    .
                  </p>
                ) : null}
                <p className="max-w-[68ch] text-[15px] leading-[1.7] text-runway-mute">A valid result may be positive, negative, partial, or an explicit abstention. Blueprint does not guarantee a ranking, winner, deployment, or pilot outcome.</p>
                <div className="flex flex-col gap-4 border-t border-runway-line-soft pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-[52ch] text-[15px] leading-[1.7] text-runway-mute">
                    Request only. Capture, access, evaluation, pricing, and physical work are confirmed per scope.
                  </p>
                  <button
                    type="submit"
                    className="runway-cta shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={submitting}
                  >
                    {selectedIntent === "pilot-opportunity"
                      ? "Continue to secure dossier"
                      : submitting
                        ? "Sending…"
                        : "Request evaluation"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
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
                <span className="runway-chip runway-chip-quiet w-fit bg-runway-black/80">
                  Review support · not real-world proof
                </span>
                <p className="font-editorial max-w-[20rem] font-display uppercase text-[1.4rem] leading-[1.06] tracking-[0.005em] text-runway-text">
                  Bring the site or bring the robot.
                </p>
              </div>
            </MonochromeMedia>

            <div className="grid gap-px overflow-hidden border border-runway-line bg-runway-line">
              {routeCards.map(({ href, eyebrow, title, body, Icon, persona: cardPersona }) => {
                const active = cardPersona !== null && cardPersona === persona;
                return (
                  <a
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className="group flex items-start gap-4 bg-runway-panel p-5 transition-colors duration-200 ease-standard hover:bg-runway-raised"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-runway-line bg-runway-black text-runway-body group-hover:border-runway-signal">
                      <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="runway-eyebrow">{eyebrow}</span>
                        {active ? (
                          <StatusChip tone="info" square dot={false}>
                            You
                          </StatusChip>
                        ) : null}
                      </span>
                      <span className="mt-1.5 block text-[15px] font-semibold text-runway-text">
                        {title}
                      </span>
                      <span className="mt-1 block text-[15px] leading-[1.7] text-runway-mute">
                        {body}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-runway-faint transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </a>
                );
              })}
            </div>

            <a
              href="/contact/site-operator#contact-intake"
              aria-current={isSiteOperator ? "page" : undefined}
              className="runway-panel flex items-center justify-between gap-3 px-5 py-3 text-[15px] leading-[1.7] text-runway-body transition-colors duration-200 ease-standard hover:bg-runway-raised"
            >
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-runway-faint" strokeWidth={1.75} aria-hidden="true" />
                Operate a site? Submit one workflow for screening.
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-runway-faint" aria-hidden="true" />
            </a>

            {!isSiteOperator ? (
              <div className="runway-panel p-5">
                <Eyebrow tone="muted">Run / receive path</Eyebrow>
                <h2 className="mt-3 font-display text-[1.25rem] font-semibold uppercase leading-[1.1] tracking-[0.005em] text-runway-text">
                  What happens after this request
                </h2>
                <div className="mt-4 grid gap-3">
                  {buyerRunOnboardingTimeline.map((step) => (
                    <div key={step.phase} className="border border-runway-line-soft bg-runway-black p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="runway-eyebrow">
                          {step.phase}. {step.title}
                        </span>
                        <span className="runway-meta text-right">{step.owner}</span>
                      </div>
                      <p className="mt-2 text-[15px] leading-[1.7] text-runway-body">{step.target}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {buyerRunReceiveLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href === "/requests/:requestId" ? "/beta/buyer-guide" : link.href}
                      className="inline-flex min-h-10 items-center gap-2 border border-runway-line px-3 text-[13px] font-semibold text-runway-text hover:border-runway-signal hover:text-runway-signal"
                    >
                      {link.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="runway-panel flex items-center gap-2 px-5 py-4">
              <Mail className="h-4 w-4 shrink-0 text-runway-faint" strokeWidth={1.75} aria-hidden="true" />
              <span className="font-mono text-[13px] text-runway-body">team@tryblueprint.io</span>
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}
