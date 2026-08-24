/**
 * The site-task intake.
 *
 * Rebuilt from the question "what has to be true before an operator gets in a
 * car", rather than from what a signup form usually collects.
 *
 * ## No account
 *
 * The flow this replaces asked a site operator to choose a password and accept
 * terms before they could describe their cell. That is backwards: the account
 * is only worth anything once there is a match to give them access to, and
 * demanding one up front spends the submission to buy nothing. This page takes
 * a task and gives back an answer. `BusinessSignUpFlow` is left alone for
 * people who actually want an account.
 *
 * ## Gates first, spec second
 *
 * Form length costs good sites, so the five questions that can end a
 * submission are asked before the eight that merely describe one. Someone about
 * to be told they are outside the metro should learn that in thirty seconds,
 * not after enumerating payload weights. The spec tier and the prose only
 * appear once the gates have been answered without a blocker.
 *
 * ## The verdict is shown, not hidden
 *
 * Triage runs client-side as the operator answers — the same
 * `triageGateAnswers` the server runs at submission, so the screen they see is
 * the screen they get. A blocked site is told which condition failed and what
 * would flip it, before submitting, and can decide whether to keep going. That
 * is more useful to them than a form that swallows the answer and emails a no
 * three days later, and it is cheaper for us than a call.
 *
 * The server recomputes the verdict on the payload regardless. Nothing here is
 * trusted: this component is a mirror of the decision, never its source.
 */
import { useMemo, useState } from "react";
import { ArrowRight, Check, CircleAlert, Info, Loader2 } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/publicSections";
import { Band, Inner, SectionHead } from "@/components/site/runway/shell";
import {
  gateFields,
  proseFields,
  qualifyingIntakeNote,
  specFields,
} from "@/data/siteTaskQualification";
import { serviceArea } from "@/data/captureVisit";
import { withCsrfHeader } from "@/lib/csrf";
import {
  describeDisposition,
  triageGateAnswers,
  type TriageDisposition,
} from "@/lib/siteTaskTriage";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

type Answers = Record<string, string>;

const dispositionTone: Record<TriageDisposition, string> = {
  qualified: "border-runway-green/40 text-runway-green",
  needs_conversation: "border-runway-amber/40 text-runway-amber",
  not_now: "border-runway-line text-runway-faint",
};

const dispositionLabel: Record<TriageDisposition, string> = {
  qualified: "Clears the screen",
  needs_conversation: "Needs a short call",
  not_now: "Not yet",
};

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** A labelled select that carries its own hint and never renders a bare native control. */
function Choice({
  id,
  question,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  question: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14.5px] font-medium leading-6 text-runway-text">
        {question}
      </label>
      {hint ? <p className="mt-1.5 text-[12.5px] leading-5 text-runway-faint">{hint}</p> : null}
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-sm border border-runway-line bg-runway-black px-3 py-2.5 text-[14px] text-runway-text outline-none transition focus:border-runway-signal"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  textarea = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  const shared =
    "mt-3 w-full rounded-sm border border-runway-line bg-runway-black px-3 py-2.5 text-[14px] text-runway-text outline-none transition placeholder:text-runway-faint focus:border-runway-signal";
  return (
    <div>
      <label htmlFor={id} className="block text-[14.5px] font-medium leading-6 text-runway-text">
        {label}
      </label>
      {hint ? <p className="mt-1.5 text-[12.5px] leading-5 text-runway-faint">{hint}</p> : null}
      {textarea ? (
        <textarea
          id={id}
          rows={5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={shared}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={shared}
        />
      )}
    </div>
  );
}

export default function SiteTaskIntake() {
  const [gates, setGates] = useState<Answers>({});
  const [spec, setSpec] = useState<Answers>({});
  const [prose, setProse] = useState<Answers>({});
  const [contact, setContact] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The same function the server runs. Recomputed on every answer so the
  // operator watches the screen resolve rather than waiting for a verdict.
  const verdict = useMemo(() => triageGateAnswers(gates), [gates]);
  const copy = describeDisposition(verdict);

  const gatesAnswered = gateFields.every((field) => gates[field.id]);
  const blocked = verdict.disposition === "not_now";
  // The expensive questions are only worth someone's patience once the cheap
  // ones have passed.
  const showSpec = gatesAnswered && !blocked;

  const canSubmit =
    gatesAnswered &&
    Boolean(contact.name?.trim()) &&
    Boolean(contact.email?.trim()) &&
    Boolean(contact.company?.trim()) &&
    Boolean(contact.siteName?.trim()) &&
    Boolean(prose.taskDescription?.trim());

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
          requestId: `site-task-${crypto.randomUUID()}`,
          firstName,
          lastName,
          email: (contact.email ?? "").toLowerCase().trim(),
          company: contact.company,
          roleTitle: contact.role || "Site operator",
          buyerType: "site_operator",
          // No account is created here, so no terms gate applies.
          accountSignup: false,
          budgetBucket: "Undecided/Unsure",
          requestedLanes: [],
          siteName: contact.siteName,
          siteLocation: contact.siteLocation || serviceArea.city,
          // `taskStatement` is what every existing consumer reads, so the
          // description is written to both rather than stranded in a new field.
          taskStatement: prose.taskDescription,
          taskDescription: prose.taskDescription,
          whatGoesWrong: prose.whatGoesWrong || null,
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
        title="Submit a site task | Blueprint"
        description="Five questions decide whether a robot can work at your site today. Answer them and see where you stand before anyone calls you — no account, no password."
        canonical="/site-task"
        jsonLd={[
          webPageJsonLd({
            path: "/site-task",
            name: "Submit a site task to Blueprint",
            description:
              "The structured site-task intake: five screening questions, the task specification, and an immediate verdict.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Submit a site task", path: "/site-task" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Submit a site task"
        title="Five questions decide this."
        body="Answer them and you will know where you stand before anyone calls you. No account, no password — we ask for one only if there is something to give you access to."
        chips={["~2 minutes", "No account", "Answer before you submit"]}
        ctaHref="#intake"
        ctaLabel="Start"
        secondaryHref="/capture-visit"
        secondaryLabel="What a capture visit involves"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="A working cell of the kind Blueprint screens"
        imageCaption="One workcell · one repeated task"
      />

      <Band tone="black" rule grid id="intake">
        <Inner className="py-20 lg:py-28">
          <SectionHead
            index="01"
            eyebrow="The screen"
            title={qualifyingIntakeNote.claim}
            lede={qualifyingIntakeNote.detail}
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
                  {copy.nextStep}
                </p>
              </div>
            </Reveal>
          ) : (
            <form onSubmit={handleSubmit} className="mt-14">
              <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-8">
                  {gateFields.map((field) => (
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

                {/* The live verdict, mirroring what the server will decide. */}
                <aside className="lg:sticky lg:top-24 lg:self-start">
                  <div className="border border-runway-line bg-runway-panel p-6">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${dispositionTone[verdict.disposition]}`}
                    >
                      {dispositionLabel[verdict.disposition]}
                    </span>

                    {verdict.incomplete && !blocked ? (
                      <p className="mt-5 text-[13px] leading-6 text-runway-mute">
                        {gateFields.length - verdict.unanswered.length} of {gateFields.length}{" "}
                        answered.
                      </p>
                    ) : (
                      <p className="mt-5 text-[13.5px] leading-6 text-runway-text">{copy.headline}</p>
                    )}

                    {verdict.blockers.length > 0 ? (
                      <ul className="mt-5 space-y-4 border-t border-runway-line pt-5">
                        {verdict.blockers.map((blocker) => (
                          <li key={blocker.fieldId} className="flex items-start gap-3">
                            <CircleAlert
                              className="mt-0.5 h-4 w-4 shrink-0 text-runway-faint"
                              aria-hidden="true"
                            />
                            <span className="text-[12.5px] leading-6 text-runway-mute">
                              <strong className="font-medium text-runway-text">
                                {blocker.answer}.
                              </strong>{" "}
                              {blocker.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {verdict.openQuestions.length > 0 ? (
                      <ul className="mt-5 space-y-4 border-t border-runway-line pt-5">
                        {verdict.openQuestions.map((question) => (
                          <li key={question.fieldId} className="flex items-start gap-3">
                            <Info
                              className="mt-0.5 h-4 w-4 shrink-0 text-runway-amber"
                              aria-hidden="true"
                            />
                            <span className="text-[12.5px] leading-6 text-runway-mute">
                              {question.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {verdict.disposition === "qualified" ? (
                      <div className="mt-5 flex items-start gap-3 border-t border-runway-line pt-5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-runway-green"
                          aria-hidden="true"
                        />
                        <span className="text-[12.5px] leading-6 text-runway-mute">
                          {copy.nextStep}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {blocked ? (
                    <p className="mt-5 text-[12.5px] leading-6 text-runway-faint">
                      You can still send this. We keep tasks on file and come back when the
                      constraint changes on our side or yours — that is how we decide which metro
                      opens next.
                    </p>
                  ) : null}
                </aside>
              </div>

              {/* Spec and prose, disclosed only once the gates pass. */}
              {showSpec ? (
                <Reveal className="mt-16 border-t border-runway-line pt-16">
                  <div>
                    <h2 className="max-w-[26ch] text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-runway-text">
                      Now the part a robot team actually reads.
                    </h2>
                    <p className="mt-4 max-w-[62ch] text-[14px] leading-[1.75] text-runway-mute">
                      These do not screen anything. They make the task specific enough that a robot
                      team can answer without a discovery call of its own.
                    </p>

                    <div className="mt-10 grid gap-8 md:grid-cols-2">
                      {specFields.map((field) => (
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
                      {proseFields.map((field) => (
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

              {/* Contact last, because it is the least interesting thing about a task. */}
              {gatesAnswered ? (
                <Reveal className="mt-16 border-t border-runway-line pt-16">
                  <div>
                    <h2 className="text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-runway-text">
                      Where do we send the answer?
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
                      <Field
                        id="contact-site-name"
                        label="Site name"
                        value={contact.siteName ?? ""}
                        onChange={(value) => setContact((prev) => ({ ...prev, siteName: value }))}
                      />
                      <Field
                        id="contact-site-location"
                        label="Site location"
                        hint="City is enough at this stage."
                        value={contact.siteLocation ?? ""}
                        onChange={(value) =>
                          setContact((prev) => ({ ...prev, siteLocation: value }))
                        }
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
                          Send the task
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                    <p className="mt-4 text-[12.5px] leading-6 text-runway-faint">
                      Nothing is captured, scheduled, or shown to a robot team as a result of this
                      form.
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
