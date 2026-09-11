/**
 * The contact screens, now screening.
 *
 * ## Why the gates live here rather than on their own page
 *
 * `SiteTaskIntake` and `RobotTeamIntake` already implement this flow, but they
 * are built in the runway design system — dark bands, `PageHero`, uppercase
 * display type — and `/contact/*` renders inside `MinimalSiteLayout`, the light
 * public site. Routing those pages here puts a near-black hero under a cream
 * header with grey-on-grey headings. So the questions moved into the minimal
 * design language instead of the page moving into the wrong one.
 *
 * The data is shared, not copied: `gateFields`, `specFields` and
 * `triageGateAnswers` are the same modules the server scores submissions with,
 * so the screen a visitor sees is the screen they get.
 *
 * ## Gates first, spec second
 *
 * Form length costs good sites. The six questions that can end a submission are
 * asked before the ones that merely describe one — somebody about to be told
 * they are outside the metro should learn that in thirty seconds, not after
 * enumerating payload weights. The spec tier and the prose appear once the
 * gates are answered without a blocker.
 *
 * ## The verdict is shown before submitting
 *
 * Triage runs here as the visitor answers, with the same function the server
 * runs on the payload. A blocked site is told which condition failed and what
 * would flip it, and can decide whether to send it anyway. That is more useful
 * to them than a form that swallows the answer and emails a no three days
 * later, and cheaper for us than a call. Nothing here is trusted: the server
 * recomputes the verdict regardless — this is a mirror of the decision, never
 * its source.
 *
 * ## Video by link, not upload
 *
 * `taskVideoField` in `@/data/siteTaskQualification` sets out why at length:
 * `/governance` promises consent fails closed, and an upload widget on a public
 * marketing form takes footage of identifiable workers before any consent
 * record exists. A link leaves custody with the site — they revoke by
 * unsharing rather than by asking us to delete something.
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import { withCsrfHeader } from "@/lib/csrf";
import { parseTaskVideoLinks } from "@/lib/taskVideos";
import { describeDisposition, triageGateAnswers } from "@/lib/gateTriage";
import {
  gateFields,
  proseFields,
  specFields,
  taskVideoField,
} from "@/data/siteTaskQualification";
import {
  robotGateFields,
  robotProseFields,
  robotSpecFields,
} from "@/data/robotTeamQualification";

type Answers = Record<string, string>;

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function ScreeningForm({ isSite }: { isSite: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const [gates, setGates] = useState<Answers>({});
  const [spec, setSpec] = useState<Answers>({});

  const activeGates = isSite ? gateFields : robotGateFields;
  const activeSpec = isSite ? specFields : robotSpecFields;
  const activeProse = isSite ? proseFields : robotProseFields;

  // The same function the server runs, recomputed on every answer.
  const verdict = useMemo(
    () => triageGateAnswers(gates, activeGates),
    [gates, activeGates],
  );
  const copy = describeDisposition(verdict);

  const gatesAnswered = activeGates.every((field) => gates[field.id]);
  const blocked = verdict.disposition === "not_now";
  // The expensive questions are only worth someone's patience once the cheap
  // ones have passed.
  const showRest = gatesAnswered && !blocked;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();

    const required = isSite
      ? ["name", "email", "company", "siteAddress", "taskDescription"]
      : ["name", "email", "company", "capabilityDescription"];
    if (!required.every((key) => value(key))) {
      setError("Please complete all required fields.");
      return;
    }

    let videoLinks: string[];
    try {
      videoLinks = isSite ? parseTaskVideoLinks(value("taskVideoUrl")) : [];
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Check your video links.",
      );
      return;
    }

    pending.current = true;
    setStatus("sending");
    setError(null);

    const { firstName, lastName } = splitName(value("name"));
    const description = isSite
      ? value("taskDescription")
      : value("capabilityDescription");

    try {
      const response = await fetch("/api/inbound-request", {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          requestId: `contact-${crypto.randomUUID()}`,
          firstName,
          lastName,
          email: value("email").toLowerCase(),
          company: value("company"),
          roleTitle: value("role") || (isSite ? "Site operator" : "Robot team"),
          buyerType: isSite ? "site_operator" : "robot_team",
          // No account is created here, so no terms gate applies.
          accountSignup: false,
          budgetBucket: "Undecided/Unsure",
          requestedLanes: [],
          // The address is the site's identity: an operator visiting a site
          // needs a street address, not a nickname.
          siteName: isSite ? value("siteAddress") : value("company"),
          siteLocation: isSite ? value("siteAddress") : value("deploymentGeography"),
          targetSiteType: isSite ? null : value("targetSiteType") || null,
          // `taskStatement` is what every existing consumer reads, so the
          // description is written to both rather than stranded in a new field.
          taskStatement: description,
          taskDescription: description,
          whatGoesWrong: value("whatGoesWrong") || value("evidenceBar") || null,
          taskVideoUrl: videoLinks[0] ?? null,
          siteTaskGates: gates,
          siteTaskSpec: spec,
          context: {
            sourcePageUrl:
              typeof window === "undefined" ? null : window.location.href,
          },
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(
          typeof failure.message === "string"
            ? failure.message
            : "We couldn’t send your request. Please try again, or email hello@tryblueprint.io.",
        );
      }
      setStatus("sent");
    } catch (submitError) {
      setError(
        submitError instanceof Error && !(submitError instanceof TypeError)
          ? submitError.message
          : "We couldn’t send your request. Please try again, or email hello@tryblueprint.io.",
      );
      setStatus("idle");
    } finally {
      pending.current = false;
    }
  }

  if (status === "sent")
    return (
      <div className="ms-success" role="status" aria-live="polite">
        <Check size={30} aria-hidden="true" />
        <h2>{copy.headline}</h2>
        <p>{copy.body}</p>
        <p>{copy.nextStep}</p>
        <a className="ms-text-link" href="/">
          Back to Blueprint <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    );

  return (
    <form
      className="ms-form"
      onSubmit={submit}
      aria-label={isSite ? "Site screening questions" : "Robot team screening questions"}
      aria-busy={status === "sending"}
    >
      {activeGates.map((field) => (
        <label key={field.id} htmlFor={`gate-${field.id}`}>
          <span>{field.question}</span>
          {field.hint ? <span className="ms-field-hint">{field.hint}</span> : null}
          <select
            id={`gate-${field.id}`}
            name={`gate-${field.id}`}
            value={gates[field.id] ?? ""}
            onChange={(event) =>
              setGates((prev) => ({ ...prev, [field.id]: event.target.value }))
            }
          >
            <option value="">Select…</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {/* The verdict, as soon as there is one to give. */}
      {(gatesAnswered || blocked) && (
        <div className="ms-verdict" role="status" aria-live="polite">
          <h2>{copy.headline}</h2>
          <p>{copy.body}</p>
          {verdict.blockers.length > 0 && (
            <ul>
              {verdict.blockers.map((blocker) => (
                <li key={blocker.fieldId}>
                  <strong>{blocker.answer}</strong> — {blocker.detail}
                </li>
              ))}
            </ul>
          )}
          {verdict.openQuestions.length > 0 && (
            <ul>
              {verdict.openQuestions.map((question) => (
                <li key={question.fieldId}>
                  <strong>{question.answer}</strong> — {question.detail}
                </li>
              ))}
            </ul>
          )}
          <p className="ms-field-hint">{copy.nextStep}</p>
        </div>
      )}

      {showRest &&
        activeSpec.map((field) => (
          <label key={field.id} htmlFor={`spec-${field.id}`}>
            <span>{field.question}</span>
            {field.hint ? <span className="ms-field-hint">{field.hint}</span> : null}
            <select
              id={`spec-${field.id}`}
              name={`spec-${field.id}`}
              value={spec[field.id] ?? ""}
              onChange={(event) =>
                setSpec((prev) => ({ ...prev, [field.id]: event.target.value }))
              }
            >
              <option value="">Select…</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

      {activeProse.map((field) => (
        <label key={field.id} htmlFor={`prose-${field.id}`}>
          <span>{field.question}</span>
          <span className="ms-field-hint">{field.hint}</span>
          <textarea
            id={`prose-${field.id}`}
            name={field.id}
            rows={4}
            maxLength={4000}
            required={field.id === "taskDescription" || field.id === "capabilityDescription"}
          />
        </label>
      ))}

      {isSite && (
        <label htmlFor="taskVideoUrl">
          <span>
            {taskVideoField.question}{" "}
            <span className="ms-optional">{taskVideoField.optional}</span>
          </span>
          <span className="ms-field-hint">{taskVideoField.hint}</span>
          <textarea id="taskVideoUrl" name="taskVideoUrl" rows={2} maxLength={10240} />
          <span className="ms-field-hint">{taskVideoField.privacy}</span>
        </label>
      )}

      <div className="ms-form-row">
        <label htmlFor="contact-name">
          Your name
          <input id="contact-name" name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label htmlFor="contact-email">
          Work email
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      </div>
      <div className="ms-form-row">
        <label htmlFor="contact-company">
          Company
          <input
            id="contact-company"
            name="company"
            autoComplete="organization"
            required
            maxLength={200}
          />
        </label>
        <label htmlFor="contact-role">
          <span>
            Your role <span className="ms-optional">(optional)</span>
          </span>
          <input id="contact-role" name="role" autoComplete="organization-title" maxLength={120} />
        </label>
      </div>
      {isSite ? (
        <label htmlFor="contact-site-address">
          <span>Site address</span>
          <span className="ms-field-hint">
            Where the work happens. A capture operator needs a street address, not a site nickname.
          </span>
          <input id="contact-site-address" name="siteAddress" required maxLength={240} />
        </label>
      ) : (
        <label htmlFor="contact-target-site">
          <span>
            What kind of site are you looking for?{" "}
            <span className="ms-optional">(optional)</span>
          </span>
          <input id="contact-target-site" name="targetSiteType" maxLength={240} />
        </label>
      )}

      {error && (
        <p className="ms-error" role="alert">
          {error}
        </p>
      )}
      <button className="ms-button ms-button-large" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : isSite ? "Send inquiry" : "Send application"}
        <ArrowRight size={20} aria-hidden="true" />
      </button>
      <p className="ms-form-note">
        Read our <a href="/privacy">privacy policy</a> for how we handle your information. Only
        share video you’re authorized to provide.
      </p>
    </form>
  );
}

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== "/contact/robot-team";
  const title = isSite ? "Let’s start with your site." : "Bring your robot. Find the fit.";
  const description = isSite
    ? "Six questions decide whether a robot can work at your site today. Answer them and see where you stand before anyone calls you."
    : "Tell us what your system can do. All robotics teams can apply for site-funded manipulation evaluations—arms, humanoids, mobile manipulators, and their policies.";
  return (
    <>
      <SEO
        title={`${isSite ? "Discuss your site" : "Robot teams"} | Blueprint`}
        description={description}
        canonical={isSite ? "/contact/site-operator" : "/contact/robot-team"}
        image="https://tryblueprint.io/images/site-led/workcell.webp"
      />
      <section className="ms-inquiry ms-container">
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          <p className="ms-eyebrow">{isSite ? "For site owners" : "For robot teams"}</p>
          <h1>{title}</h1>
          <p className="ms-inquiry-description">{description}</p>
          <p className="ms-inquiry-aside">
            {isSite
              ? "These questions are the screen, not a survey. Six of them can end a submission, and we would rather end it here than on a call — with the reason, and what would change it."
              : "Bring one system or several policy checkpoints. We match applications to qualified site tasks and agree the evaluation scope. Evaluation access and physical pilots require site approval; applying does not guarantee either."}
          </p>
          <a
            className="ms-text-link"
            href={isSite ? "/contact/robot-team" : "/contact/site-operator"}
          >
            {isSite ? "Building robots? Apply here" : "Operate a site? Start here"}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        <ScreeningForm key={isSite ? "site" : "robot"} isSite={isSite} />
      </section>
    </>
  );
}
