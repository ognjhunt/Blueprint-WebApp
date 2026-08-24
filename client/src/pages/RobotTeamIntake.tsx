/**
 * The robot-team intake.
 *
 * The mirror of `/site-task`, built on the same machinery and screening for
 * something different.
 *
 * ## We are not screening the robot
 *
 * A site can genuinely fail to suit a robot — a cell that gets rearranged
 * between shifts defeats the capture regardless of who shows up. A robot team
 * cannot fail in that sense; it either has an envelope that matches a task or
 * it does not, and that is matching, not screening.
 *
 * What a robot team can fail is the question that costs us something: **would
 * you deploy?** A task matched to a team with no hardware, no allocated
 * engineers, no timeline, or no willingness to work in the metro is a match on
 * paper that burns a real capture visit and a real site's access window. So the
 * four gates are deployment readiness, and capability lives in the envelope
 * below where it gets matched rather than judged.
 *
 * ## The envelope mirrors the site's task spec, field for field
 *
 * Payload, cycle time, human proximity, duty cycle, success rate and lighting
 * use the same enums as the site side, so matching is a comparison of values
 * rather than of prose. A test fails if a pair drifts apart.
 *
 * As on the site side: the verdict shown here is a mirror of the decision, and
 * the server recomputes it on the submitted payload regardless.
 */
import { useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Choice, Field, VerdictPanel } from "@/components/site/intake";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/publicSections";
import { Band, Inner, SectionHead } from "@/components/site/runway/shell";
import {
  robotGateFields,
  robotIntakeNote,
  robotProseFields,
  robotSpecFields,
} from "@/data/robotTeamQualification";
import { serviceArea } from "@/data/serviceArea";
import { withCsrfHeader } from "@/lib/csrf";
import { triageGateAnswers } from "@/lib/gateTriage";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

type Answers = Record<string, string>;

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * What a robot team is told at each outcome.
 *
 * Deliberately not the site copy. A blocked robot team is not being rejected on
 * merit, and saying "not yet" without that distinction would read as a judgement
 * of their system, which is neither true nor our place.
 */
function describeRobotDisposition(disposition: string, openCount: number) {
  if (disposition === "not_now") {
    return {
      headline: "Not a fit for a deployment right now.",
      body: "That is about timing and capacity, not about your system.",
      next: "We keep you on file and come back when the constraint changes on either side.",
    };
  }
  if (disposition === "needs_conversation") {
    return {
      headline: "Worth a conversation.",
      body:
        openCount > 0
          ? `${openCount === 1 ? "One answer" : `${openCount} answers`} cannot be settled from a form.`
          : "A short call fills in what the form cannot.",
      next: "About thirty minutes, with the open items already written down.",
    };
  }
  return {
    headline: "You are a deployable counterparty.",
    body: "Hardware that exists, engineers who are free, and a timeline.",
    next: "We match your envelope against captured site tasks and come to you with specifics, not a newsletter.",
  };
}

export default function RobotTeamIntake() {
  const [gates, setGates] = useState<Answers>({});
  const [spec, setSpec] = useState<Answers>({});
  const [prose, setProse] = useState<Answers>({});
  const [contact, setContact] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verdict = useMemo(() => triageGateAnswers(gates, robotGateFields), [gates]);
  const copy = describeRobotDisposition(verdict.disposition, verdict.openQuestions.length);

  const gatesAnswered = robotGateFields.every((field) => gates[field.id]);
  const blocked = verdict.disposition === "not_now";
  const showSpec = gatesAnswered && !blocked;

  const canSubmit =
    gatesAnswered &&
    Boolean(contact.name?.trim()) &&
    Boolean(contact.email?.trim()) &&
    Boolean(contact.company?.trim()) &&
    Boolean(prose.capabilityDescription?.trim());

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    const { firstName, lastName } = splitName(contact.name ?? "");
    try {
      const response = await fetch("/api/inbound-request", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          requestId: `robot-team-${crypto.randomUUID()}`,
          firstName,
          lastName,
          email: (contact.email ?? "").toLowerCase().trim(),
          company: contact.company,
          roleTitle: contact.role || "Robot team contact",
          buyerType: "robot_team",
          accountSignup: false,
          budgetBucket: "Undecided/Unsure",
          requestedLanes: [],
          // The endpoint requires one of these for a robot team; the task family
          // is the coarsest true statement of what site class they want.
          targetSiteType: spec.taskFamily || "Not specified",
          proofPathPreference: "need_guidance",
          taskStatement: prose.capabilityDescription,
          taskDescription: prose.capabilityDescription,
          whatGoesWrong: prose.evidenceBar || null,
          siteTaskGates: gates,
          siteTaskSpec: spec,
          context: {
            sourcePageUrl: typeof window === "undefined" ? null : window.location.href,
          },
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || "Submission failed");
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Try again, or email hello@tryblueprint.io.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title="Tell us what you can deploy | Blueprint"
        description="Four questions about whether a deployment could actually happen, then your capability envelope. We match it against captured site tasks — we are not screening your robot."
        canonical="/robot-intake"
        jsonLd={[
          webPageJsonLd({
            path: "/robot-intake",
            name: "Blueprint robot-team intake",
            description:
              "The structured robot-team intake: deployment-readiness gates, a capability envelope that mirrors the site task spec, and the evidence bar for committing an engineer-week.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Robot-team intake", path: "/robot-intake" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Robot-team intake"
        title="Tell us what you can deploy."
        body="Not what you are building toward. Four questions decide whether a deployment could actually happen, and then we take your capability envelope and match it against site tasks that are already captured, scoped, and screened."
        chips={["~3 minutes", "No account", "Opportunities arrive scoped"]}
        ctaHref="#intake"
        ctaLabel="Start"
        secondaryHref="/for-robot-teams"
        secondaryLabel="Why this exists"
        imageSrc="/redesign/pov/loading-dock.jpg"
        imageAlt="A site of the kind Blueprint captures for robot evaluation"
        imageCaption="Captured, scoped, screened"
      />

      <Band tone="black" rule grid id="intake">
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="Deployment readiness"
            title={robotIntakeNote.claim}
            lede={robotIntakeNote.detail}
          />

          {submitted ? (
            <Reveal className="mt-14 border border-runway-line bg-runway-panel p-8 lg:p-10">
              <div>
                <span className="runway-meta text-runway-signal">Received</span>
                <h2 className="mt-4 max-w-[24ch] text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-runway-text">
                  {copy.headline}
                </h2>
                <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.75] text-runway-mute">
                  {copy.body}
                </p>
                <p className="mt-4 max-w-[62ch] text-[14px] leading-[1.75] text-runway-text">
                  {copy.next}
                </p>
              </div>
            </Reveal>
          ) : (
            <form onSubmit={handleSubmit} className="mt-14">
              <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-8">
                  {robotGateFields.map((field) => (
                    <Choice
                      key={field.id}
                      id={`gate-${field.id}`}
                      question={field.question}
                      hint={field.hint}
                      options={field.options}
                      value={gates[field.id]}
                      onChange={(value) => setGates((prev) => ({ ...prev, [field.id]: value }))}
                    />
                  ))}
                </div>

                <VerdictPanel
                  result={verdict}
                  totalGates={robotGateFields.length}
                  headline={copy.headline}
                  qualifiedNote={copy.next}
                  footnote={
                    <>
                      {/*
                        A blocked robot team is not being rejected on merit, and
                        the panel would otherwise show only "Not yet" plus a
                        blocker — which reads as a verdict on their system. Say
                        what it actually is before saying what to do about it.
                      */}
                      {copy.body} Send it anyway: which metro opens after{" "}
                      {serviceArea.city} is decided partly by where robot-side demand sits, and a
                      no today is data for that.
                    </>
                  }
                />
              </div>

              {showSpec ? (
                <Reveal className="mt-16 border-t border-runway-line pt-16">
                  <div>
                    <h2 className="max-w-[26ch] text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-runway-text">
                      Now the envelope we match against.
                    </h2>
                    <p className="mt-4 max-w-[62ch] text-[14px] leading-[1.75] text-runway-mute">
                      These use the same bands a site answers about its task, so a match is a
                      comparison rather than a reading. Nothing here screens you out.
                    </p>

                    <div className="mt-10 grid gap-8 md:grid-cols-2">
                      {robotSpecFields.map((field) => (
                        <Choice
                          key={field.id}
                          id={`spec-${field.id}`}
                          question={field.question}
                          hint={field.hint ?? field.whyAsked}
                          options={field.options}
                          value={spec[field.id]}
                          onChange={(value) => setSpec((prev) => ({ ...prev, [field.id]: value }))}
                        />
                      ))}
                    </div>

                    <div className="mt-10 space-y-8">
                      {robotProseFields.map((field) => (
                        <Field
                          key={field.id}
                          id={`prose-${field.id}`}
                          label={field.question}
                          hint={field.hint}
                          textarea
                          value={prose[field.id] ?? ""}
                          onChange={(value) => setProse((prev) => ({ ...prev, [field.id]: value }))}
                        />
                      ))}
                    </div>
                  </div>
                </Reveal>
              ) : null}

              {gatesAnswered ? (
                <Reveal className="mt-16 border-t border-runway-line pt-16">
                  <div>
                    <h2 className="text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-runway-text">
                      Where do we send matches?
                    </h2>
                    <div className="mt-10 grid gap-8 md:grid-cols-2">
                      <Field
                        id="contact-name"
                        label="Your name"
                        value={contact.name ?? ""}
                        onChange={(value) => setContact((prev) => ({ ...prev, name: value }))}
                      />
                      <Field
                        id="contact-email"
                        label="Work email"
                        type="email"
                        value={contact.email ?? ""}
                        onChange={(value) => setContact((prev) => ({ ...prev, email: value }))}
                      />
                      <Field
                        id="contact-company"
                        label="Company"
                        value={contact.company ?? ""}
                        onChange={(value) => setContact((prev) => ({ ...prev, company: value }))}
                      />
                      <Field
                        id="contact-role"
                        label="Your role"
                        hint="Optional."
                        value={contact.role ?? ""}
                        onChange={(value) => setContact((prev) => ({ ...prev, role: value }))}
                      />
                    </div>

                    {error ? (
                      <p
                        role="alert"
                        className="mt-8 border border-runway-amber/40 bg-runway-panel p-4 text-[13px] leading-6 text-runway-amber"
                      >
                        {error}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={!canSubmit || submitting}
                      className="runway-cta mt-10 inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Sending
                        </>
                      ) : (
                        <>
                          Send the envelope
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                    <p className="mt-4 text-[12.5px] leading-6 text-runway-faint">
                      Nothing is shared with a site, and no site data is shared with you, as a
                      result of this form.
                    </p>
                  </div>
                </Reveal>
              ) : null}
            </form>
          )}
        </Inner>
      </Band>
    </>
  );
}
