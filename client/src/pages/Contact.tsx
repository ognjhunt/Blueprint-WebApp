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
import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { RobotTeamPlanPreview } from "@/components/site/RobotTeamPlanPreview";
import { SEO } from "@/components/SEO";
import { withCsrfHeader } from "@/lib/csrf";
import { parseTaskVideoLinks } from "@/lib/taskVideos";
import { describeDisposition, triageGateAnswers } from "@/lib/gateTriage";
import {
  captureModeField,
  preferredCaptureMode,
  gateFields,
  proseFields,
  specFields,
  taskVideoField,
  type CaptureMode,
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
  // The site's link to its own submission, handed back by the submit response
  // rather than waited for in an inbox.
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const pending = useRef(false);
  const [gates, setGates] = useState<Answers>({});
  const [spec, setSpec] = useState<Answers>({});

  const activeGates = isSite ? gateFields : robotGateFields;
  // Only a site chooses this; a robot team is never captured.
  const [captureMode, setCaptureMode] = useState<CaptureMode>(preferredCaptureMode);
  const activeSpec = isSite ? specFields : robotSpecFields;
  const activeProse = isSite ? proseFields : robotProseFields;

  // The same function the server runs, recomputed on every answer.
  const verdict = useMemo(
    () => triageGateAnswers(gates, activeGates, captureMode),
    [gates, activeGates, captureMode],
  );
  const copy = describeDisposition(verdict);

  const bindingGates = activeGates.filter(
    (field) => !field.bindsForCaptureModes || field.bindsForCaptureModes.includes(captureMode),
  );
  const gatesAnswered = bindingGates.every((field) => gates[field.id]);
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
          // Decides whether anyone has to travel, and therefore whether the
          // service-area gate applied at all. Sent for sites only.
          ...(isSite ? { captureMode } : {}),
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
      const result = (await response.json().catch(() => ({}))) as { captureUrl?: string | null };
      setCaptureUrl(typeof result.captureUrl === "string" ? result.captureUrl : null);
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
        {captureUrl && (
          /*
           * The link, on the screen that already knows the verdict.
           *
           * It used to be minted after this point and sent by email, so a site
           * that had just been told it cleared the screen still had to go and
           * find an inbox for a link that existed a second later. The same URL
           * opens an upload page or a status page depending on what the server
           * says when it is opened, which is why one link serves both verdicts.
           */
          <p className="ms-success-link">
            <a className="ms-text-link" href={captureUrl}>
              {blocked ? "Open your submission" : "Record the walkthrough"}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <span className="ms-field-hint">
              Keep this link — it is how you come back to this submission.
            </span>
            {!blocked && (
              /*
               * Only when they can actually record. A code that carries someone
               * to a status page is a worse version of the link beside it.
               */
              <CaptureHandoffQr url={captureUrl} />
            )}
          </p>
        )}
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
      {isSite && (
        <label htmlFor="capture-mode">
          <span>{captureModeField.question}</span>
          <span className="ms-field-hint">{captureModeField.hint}</span>
          <select
            id="capture-mode"
            name="capture-mode"
            value={captureMode}
            onChange={(event) => setCaptureMode(event.target.value as CaptureMode)}
          >
            {captureModeField.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="ms-field-hint">
            {captureModeField.options.find((option) => option.value === captureMode)?.detail}
          </span>
        </label>
      )}

      {bindingGates.map((field) => (
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
    ? "Six questions decide whether a robot can work at your site today. Answer them and see where you stand before anyone calls you — then we scope a paid evaluation together."
    // Was "Tell us what your system can do" — a promise to go and look, which
    // is what the old flow actually did: a form, then a wait for a matching
    // site. We already hold the scenes, so the honest offer is a ranked plan
    // today, and the questions below are no longer what unlocks it.
    : "Give us a checkpoint we can run and see which real sites it should be evaluated against — ranked, priced, and free to look at. Arms, humanoids, mobile manipulators, and the policies that run them.";
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
              ? "These questions are the screen, not a survey. Six of them can end a submission, and we would rather end it here than on a call — with the reason, and what would change it. What follows a clear screen is a Site-funded Task Evaluation Run. Scope and pricing are agreed before evaluation begins."
              : "Start by giving us a checkpoint: that is all we need to show you what to run it against, and it costs nothing. The application form is for talking to a person — its questions describe deploying a robot at a site, which is a later conversation than evaluating one, and seven of them a single run answers better than you can."}
          </p>
          {!isSite && (
            /*
             * The path with nobody in it.
             *
             * A robot team's engineers are the audience for this page, and an
             * increasing share of them will send an agent rather than read it.
             * The form stays the front door for anyone who wants to talk to a
             * person; this is the front door for everyone else, and hiding it
             * would leave the fastest route undiscoverable.
             */
            <p className="ms-inquiry-aside">
              Your own agent can do exactly what the checkpoint panel does, and then
              buy the runs: <code>POST /api/agent-team/register</code>,{" "}
              <code>POST /api/agent-team/plan</code>,{" "}
              <code>POST /api/agent-team/runs</code>. No credential to register,
              nothing charged until you confirm a run.{" "}
              <a className="ms-text-link" href="/agent-access.openapi.json">
                Machine-readable spec
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </p>
          )}
          <a
            className="ms-text-link"
            href={isSite ? "/contact/robot-team" : "/contact/site-operator"}
          >
            {isSite ? "Building robots? Apply here" : "Operate a site? Start here"}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        {isSite ? (
          <ScreeningForm key="site" isSite />
        ) : (
          /*
           * The plan first, the form second.
           *
           * Both are on the page because they do different jobs: the panel is
           * the product -- what we would run and why, free -- and the form is
           * how you reach a person. Putting the form first made a sales
           * qualifier look like step one of the product, which is what left a
           * visitor with strictly worse access than their own agent.
           */
          <div className="ms-inquiry-forms">
            <RobotTeamPlanPreview />
            <details style={{ marginTop: "32px" }}>
              <summary style={{ cursor: "pointer" }}>
                Rather talk to someone? Send an application instead
              </summary>
              <p className="ms-field-hint" style={{ margin: "12px 0 20px" }}>
                None of this is needed to see a plan or to start runs. It is what a
                person here would ask you on a call about an actual deployment.
              </p>
              <ScreeningForm key="robot" isSite={false} />
            </details>
          </div>
        )}
      </section>
    </>
  );
}
