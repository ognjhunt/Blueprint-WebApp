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
 * Form length costs good sites, so the six questions that can end a
 * submission are asked before the ones that merely describe one. Someone about
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
import { ArrowRight, Loader2 } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import { PageHero } from "@/components/site/publicSections";
import { Band, Inner, SectionHead } from "@/components/site/runway/shell";
import { Choice, Field, VerdictPanel } from "@/components/site/intake";
import { PlaceAutocompleteInput } from "@/components/site/PlaceAutocompleteInput";
import {
  gateFields,
  proseFields,
  qualifyingIntakeNote,
  specFields,
  taskVideoField,
} from "@/data/siteTaskQualification";
import { serviceArea } from "@/data/serviceArea";
import type { PlaceLocationMetadata } from "@/types/inbound-request";
import { withCsrfHeader } from "@/lib/csrf";
import { describeDisposition, triageGateAnswers } from "@/lib/gateTriage";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

type Answers = Record<string, string>;

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export default function SiteTaskIntake() {
  const [gates, setGates] = useState<Answers>({});
  const [spec, setSpec] = useState<Answers>({});
  const [prose, setProse] = useState<Answers>({});
  const [contact, setContact] = useState<Answers>({});
  // Set when a prediction is chosen. Carries the structured address the
  // capture operator actually needs — a typed string can be ambiguous, a
  // resolved place cannot.
  const [addressMetadata, setAddressMetadata] = useState<PlaceLocationMetadata | null>(null);
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
    Boolean(contact.siteAddress?.trim()) &&
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
          // The address is the site's identity now. A separate "site name" was
          // asked and never used: an operator types the company name again, and
          // an operator visiting a site needs a street address, not a nickname.
          siteName: contact.siteAddress,
          siteLocation: contact.siteAddress,
          siteLocationMetadata: addressMetadata,
          // `taskStatement` is what every existing consumer reads, so the
          // description is written to both rather than stranded in a new field.
          taskStatement: prose.taskDescription,
          taskDescription: prose.taskDescription,
          whatGoesWrong: prose.whatGoesWrong || null,
          taskVideoUrl: prose.taskVideoUrl?.trim() || null,
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
        title="Submit a job | Blueprint"
        description="Five questions decide whether a robot can work at your site today. Answer them and see where you stand before anyone calls you — no account, no password."
        canonical="/site-task"
        jsonLd={[
          webPageJsonLd({
            path: "/site-task",
            name: "Submit a job to Blueprint",
            description:
              "The structured site-task intake: five screening questions, the task specification, and an immediate verdict.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Submit a job", path: "/site-task" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Submit a job"
        title="Six questions decide this."
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
                <h2 className="mt-4 max-w-[24ch] font-display uppercase text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.1] tracking-[0.005em] text-runway-text">
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

                <VerdictPanel
                  result={verdict}
                  totalGates={gateFields.length}
                  headline={copy.headline}
                  qualifiedNote={copy.nextStep}
                  footnote="You can still send this. We keep tasks on file and come back when the constraint changes on our side or yours — that is how we decide which metro opens next."
                />
              </div>

              {/* Spec and prose, disclosed only once the gates pass. */}
              {showSpec ? (
                <Reveal className="mt-16 border-t border-runway-line pt-16">
                  <div>
                    <h2 className="max-w-[26ch] font-display uppercase text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[0.005em] text-runway-text">
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

                      {/*
                        A link, never an upload. Taking footage of identifiable
                        workers on a public form — before any consent record
                        exists — would bypass the machinery /governance promises.
                        A link also leaves custody with the site: they revoke by
                        unsharing rather than by asking us to delete something.
                      */}
                      <div className="border-t border-runway-line pt-8">
                        <Field
                          id="prose-taskVideoUrl"
                          label={taskVideoField.question}
                          hint={taskVideoField.hint}
                          type="url"
                          value={prose.taskVideoUrl ?? ""}
                          onChange={(value) =>
                            setProse((prev) => ({ ...prev, taskVideoUrl: value }))
                          }
                        />
                        <p className="runway-meta mt-3 leading-5 text-runway-signal">
                          {taskVideoField.optional}
                        </p>
                        <p className="mt-3 max-w-[70ch] text-[12.5px] leading-6 text-runway-faint">
                          {taskVideoField.privacy}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ) : null}

              {/* Contact last, because it is the least interesting thing about a task. */}
              {gatesAnswered ? (
                <Reveal className="mt-16 border-t border-runway-line pt-16">
                  <div>
                    <h2 className="font-display uppercase text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[0.005em] text-runway-text">
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
                      {/*
                        One address field, resolved through Google Places as the
                        operator types. This replaces a "site name" plus a loose
                        "city is enough" location: an operator has to drive to
                        this, and "the north warehouse" is not a place.
                      */}
                      <div className="md:col-span-2">
                        <PlaceAutocompleteInput
                          id="contact-site-address"
                          label="Site address"
                          country="us"
                          placeholder={`Start typing — e.g. a street address in ${serviceArea.city}`}
                          labelClassName="block text-[14.5px] font-medium leading-6 text-runway-text"
                          inputWrapperClassName="relative mt-3"
                          inputClassName="w-full rounded-sm border border-runway-line bg-runway-black px-3 py-2.5 text-[14px] text-runway-text outline-none transition placeholder:text-runway-faint focus:border-runway-signal"
                          value={contact.siteAddress ?? ""}
                          onChange={(value) => {
                            setContact((prev) => ({ ...prev, siteAddress: value }));
                            // A hand-edit after selecting invalidates the
                            // resolved place; better to send nothing than a
                            // structured address that no longer matches the text.
                            setAddressMetadata(null);
                          }}
                          onPlaceSelect={setAddressMetadata}
                        />
                      </div>
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
