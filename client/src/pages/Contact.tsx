import { isLikelyPhone } from "@/lib/device";
import { TaskBrowse } from "@/components/site/TaskBrowse";
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
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { SEO } from "@/components/SEO";
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import { parseContactRequestPrefill } from "@/lib/contactRequestPrefill";
import { parseTaskVideoLinks } from "@/lib/taskVideos";
import { describeDisposition, triageGateAnswers, type TriageResult } from "@/lib/gateTriage";
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
import { captureRegionOptions, type CaptureRegion } from "@/data/captureResidency";

type Answers = Record<string, string>;

/**
 * Version of the rights sentence recorded with every site attestation.
 *
 * The checkbox is a legal act, so the stored record has to name the exact
 * sentence the operator agreed to. Bump this when the wording changes; the
 * server stores the version beside the grant.
 */
const RIGHTS_STATEMENT_VERSION = "2026-09-18.v1";

/** Where the form hands identity to the other form on the same page. */
const CONTACT_IDENTITY_STORAGE_KEY = "bp-contact-identity";

/**
 * The screening budget answer, in the bucket the lead pipeline scores.
 *
 * `budgetBand` is what the spec tier asks; `budgetBucket` is what
 * `computePriority` reads. They were collected and scored in disjoint
 * vocabularies, which is why every web lead arrived priority "low" no matter
 * what the visitor picked. Same bands, translated once, here.
 */
export function budgetBucketFromBand(band: string | undefined | null): string {
  switch (band) {
    case "under_50k":
      return "<$50K";
    case "fifty_to_250k":
      return "$50K-$300K";
    case "250k_to_1m":
      return "$300K-$1M";
    case "over_1m":
      return ">$1M";
    default:
      return "Undecided/Unsure";
  }
}

/** What the robot form asks instead of the server's `proofPathPreference`. */
const proofPathOptions = [
  {
    value: "exact_site_required",
    label: "Only the exact site proves it",
    detail: "The deployment decision is about this specific facility — its layout, its parts, its flow.",
  },
  {
    value: "adjacent_site_acceptable",
    label: "An adjacent site would do",
    detail: "A comparable facility — similar task, similar objects — is enough to commit an engineer-week.",
  },
  {
    value: "need_guidance",
    label: "Not sure — tell us what to capture",
    detail: "We will propose the smallest capture that answers your question.",
  },
] as const;

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function readStoredIdentity(): { name?: string; email?: string; company?: string; role?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(CONTACT_IDENTITY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Robot-flavoured success copy.
 *
 * `describeDisposition` is written for a site: its qualified next step tells
 * the reader to go record a walkthrough, which is nonsense for a team that
 * just applied with a checkpoint. Same dispositions, different nouns — the
 * robot form never asks anyone to film anything.
 */
function describeRobotDisposition(result: TriageResult): {
  headline: string;
  body: string;
  nextStep: string;
} {
  if (result.disposition === "not_now") {
    const first = result.blockers[0];
    return {
      headline: "Not yet — and here is exactly what is in the way.",
      body: first
        ? `You told us: ${first.answer.toLowerCase()}. ${first.detail}`
        : "One of the deployment conditions does not hold on your side today.",
      nextStep:
        "Application received and kept. When this changes, reply to the confirmation email and it picks up from there — nothing needs a fresh form.",
    };
  }
  if (result.disposition === "needs_conversation") {
    return {
      headline: "Close. A short call settles it.",
      body: result.openQuestions.length
        ? `${result.openQuestions.length === 1 ? "One thing" : `${result.openQuestions.length} things`} cannot be decided from a form — we will bring exactly those to the call.`
        : "We need a little more of the picture before matching you to a site.",
      nextStep: "About thirty minutes, with the agenda already written.",
    };
  }
  return {
    headline: "You're on the board.",
    body: "Deployment intent is clear on your side. We will match your capability against the sites we hold and come back with what fits — the plan panel above already shows today's ranked matches.",
    nextStep: "Watch your inbox. Registering a checkpoint above gets you a ranked plan without waiting on us.",
  };
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
  // Where the site is, recorded against the submission. It decides whether a
  // camera link can be issued in the submit response: the beta's collection
  // scope is the US, and a visit additionally needs the metro we drive to.
  const [captureRegion, setCaptureRegion] = useState<CaptureRegion>("us");
  const [consent, setConsent] = useState(false);
  const identity = useMemo(readStoredIdentity, []);
  // Whether the phone handoff below is worth anything here -- see
  // SiteCaptureStart, which the same success pattern was copied from.
  const onAPhone = isLikelyPhone();

  // Deep links into this page (from site pages, campaigns, agents) carry the
  // task and the site with them. The visitor should arrive at a half-filled
  // form, not re-type what the link already said.
  const prefill = useMemo(() => {
    if (typeof window === "undefined") return null;
    return parseContactRequestPrefill(window.location.search, window.location.pathname);
  }, []);

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
      : ["name", "email", "company", "role", "capabilityDescription", "proofPath"];
    if (!required.every((key) => value(key))) {
      setError("Please complete all required fields.");
      analyticsEvents.contactFormError(isSite ? "screening_site" : "screening_robot");
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
      analyticsEvents.contactFormError(isSite ? "screening_site" : "screening_robot");
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
          // The role is real for a robot team — the server requires it and a
          // constant placeholder defeated that. A site keeps the stand-in
          // because its pipeline never reads the field.
          roleTitle: value("role") || (isSite ? "Site operator" : undefined),
          buyerType: isSite ? "site_operator" : "robot_team",
          // No account is created here, so no terms gate applies.
          accountSignup: false,
          // The spec tier's budget answer, translated into the bucket the
          // lead pipeline scores. Sent as "Undecided" only when the visitor
          // genuinely did not answer.
          budgetBucket: budgetBucketFromBand(spec.budgetBand),
          requestedLanes: [],
          // The address is the site's identity: an operator visiting a site
          // needs a street address, not a nickname.
          siteName: isSite ? value("siteAddress") : value("company"),
          siteLocation: isSite
            ? value("siteAddress")
            : gates.deploymentGeography || value("targetSiteType") || null,
          targetSiteType: isSite ? null : value("targetSiteType") || null,
          // `taskStatement` is what every existing consumer reads, so the
          // description is written to both rather than stranded in a new field.
          taskStatement: description,
          taskDescription: description,
          whatGoesWrong: value("whatGoesWrong") || value("evidenceBar") || null,
          // Every link the visitor pasted, not only the first — they were
          // told up to five and the other four used to be dropped on the
          // floor. `taskVideoUrl` stays for every existing consumer.
          taskVideoUrl: videoLinks[0] ?? null,
          ...(videoLinks.length > 0 ? { taskVideoUrls: videoLinks } : {}),
          siteTaskGates: gates,
          // Decides whether anyone has to travel, and therefore whether the
          // service-area gate applied at all. Sent for sites only.
          ...(isSite ? { captureMode, captureRegion } : {}),
          // How this team would prove capability to themselves — the exact
          // site, an adjacent one, or guided. The server requires it for a
          // robot team and the form never used to send it, so every
          // application from this page failed with a 400 naming a field that
          // existed on no screen.
          ...(isSite ? {} : { proofPathPreference: value("proofPath") }),
          siteTaskSpec: spec,
          // The rights checkbox is a legal act; the grant is recorded
          // server-side with the sentence version, or it did not happen.
          ...(isSite
            ? {
                consentAttestation: {
                  granted: consent,
                  statementVersion: RIGHTS_STATEMENT_VERSION,
                },
              }
            : {}),
          // Bot bait: a real visitor never sees this field, so a filled one
          // is a bot. The server already honours it; no client ever sent it.
          honeypot: value("honeypot") || undefined,
          context: {
            sourcePageUrl:
              typeof window === "undefined" ? null : window.location.href,
          },
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        analyticsEvents.contactFormError(isSite ? "screening_site" : "screening_robot");
        throw new Error(
          typeof failure.message === "string"
            ? failure.message
            : "We couldn’t send your request. Please try again, or email hello@tryblueprint.io.",
        );
      }
      const result = (await response.json().catch(() => ({}))) as { captureUrl?: string | null };
      setCaptureUrl(typeof result.captureUrl === "string" ? result.captureUrl : null);
      setStatus("sent");
      analyticsEvents.contactFormSubmit(isSite ? "screening_site" : "screening_robot");
      analyticsEvents.contactRequestSubmitted({
        persona: isSite ? "site_operator" : "robot_team",
        hostedMode: false,
        requestedLane: "qualification",
        commercialRequestPath: isSite ? "site_claim" : "hosted_evaluation",
        authenticated: false,
        hasJobTitle: Boolean(value("role")),
        hasSiteName: Boolean(value("siteAddress") || value("company")),
        hasSiteLocation: Boolean(value("siteAddress") || gates.deploymentGeography),
        hasTaskStatement: Boolean(description),
        hasOperatingConstraints: Object.keys(spec).length > 0,
        hasPrivacySecurityConstraints: false,
        hasNotes: Boolean(value("whatGoesWrong") || value("evidenceBar")),
      });
      // One page, two forms. Whoever filled the first should not re-type
      // their identity into the second.
      try {
        window.sessionStorage.setItem(
          CONTACT_IDENTITY_STORAGE_KEY,
          JSON.stringify({
            name: value("name"),
            email: value("email"),
            company: value("company"),
            role: value("role"),
          }),
        );
      } catch {
        // Storage can be full or blocked; the forms still work untied.
      }
    } catch (submitError) {
      analyticsEvents.contactFormError(isSite ? "screening_site" : "screening_robot");
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

  if (status === "sent") {
    /*
     * The success copy states what actually happened, not what the pre-submit
     * verdict hoped would happen.
     *
     * describeDisposition is the site's verdict wording, and its qualified
     * next step promises "the link below". Whether a link exists is a server
     * fact — the US-only collection scope decides — so a held site used to be
     * congratulated with a link that never rendered. When there is no link,
     * the next step says what does happen next instead. A robot team gets its
     * own nouns entirely: nothing on their path involves recording anything.
     */
    const successCopy = isSite ? copy : describeRobotDisposition(verdict);
    const nextStep =
      isSite && !captureUrl
        ? "We have your site. A camera link needs a US site today — the beta’s collection scope — so the next step is an email about what happens where you are. Nothing has been recorded and nothing has been shared."
        : successCopy.nextStep;
    return (
      <div className="ms-success" role="status" aria-live="polite">
        <Check size={30} aria-hidden="true" />
        <h2>{successCopy.headline}</h2>
        <p>{successCopy.body}</p>
        <p>{nextStep}</p>
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
            {!blocked && !isLikelyPhone() && (
              /*
               * Only when they can actually record, and only when the phone
               * being scanned for isn't the one this page is already open on.
               * A code that carries someone to a status page is a worse
               * version of the link beside it; a code pointing a phone at
               * itself is worse still.
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
  }

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

      {/* Bot bait: hidden from people, checked by the server. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="contact-website-hp">Leave this field empty</label>
        <input
          id="contact-website-hp"
          name="honeypot"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

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

      {!isSite && (
        /*
         * The proof-path question.
         *
         * The server has always required an answer — `proofPathPreference`
         * feeds proof-path triage and the `proof_path_assigned` milestone —
         * but no screen ever asked it, so every application from this page
         * was rejected before storage. Asking it directly: it is one click,
         * it is a real deployment question, and the enum is the product's.
         */
        <label htmlFor="proof-path">
          <span>What would prove the system works to your team?</span>
          <span className="ms-field-hint">
            This decides what we point at first: the exact site, one like it, or a capture plan we owe you.
          </span>
          <select id="proof-path" name="proofPath" required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {proofPathOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="ms-field-hint">
            {proofPathOptions.find(
              (option) => option.value === (prefill?.proofPathPreference ?? ""),
            )?.detail ?? null}
          </span>
        </label>
      )}

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
            defaultValue={
              prefill?.taskStatement && (field.id === "taskDescription" || field.id === "capabilityDescription")
                ? prefill.taskStatement
                : undefined
            }
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
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            defaultValue={identity.name || undefined}
          />
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
            defaultValue={identity.email || undefined}
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
            defaultValue={identity.company || undefined}
          />
        </label>
        <label htmlFor="contact-role">
          <span>
            Your role
            {isSite ? (
              <span className="ms-optional"> (optional)</span>
            ) : (
              <span className="ms-field-hint"> — required; it routes the application</span>
            )}
          </span>
          <input
            id="contact-role"
            name="role"
            autoComplete="organization-title"
            maxLength={120}
            required={!isSite}
            defaultValue={identity.role || undefined}
          />
        </label>
      </div>
      {isSite ? (
        <>
          <label htmlFor="contact-site-address">
            <span>Site address</span>
            <span className="ms-field-hint">
              Where the work happens. A capture operator needs a street address, not a site nickname.
            </span>
            <input
              id="contact-site-address"
              name="siteAddress"
              required
              maxLength={240}
              defaultValue={prefill?.siteName || prefill?.siteLocation || undefined}
            />
          </label>
          <label htmlFor="contact-region">
            <span>Where is the site?</span>
            <span className="ms-field-hint">
              One tap, and it matters for two things only: whether we can lawfully collect a
              walkthrough there today (the beta records US sites), and whether we could send a
              person (Austin metro). Recording it yourself is unchanged by which you pick inside
              the US.
            </span>
            <select
              id="contact-region"
              name="captureRegion"
              value={captureRegion}
              onChange={(event) => setCaptureRegion(event.target.value as CaptureRegion)}
            >
              {captureRegionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label
            htmlFor="contact-rights"
            style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}
          >
            <input
              id="contact-rights"
              name="rights"
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              style={{ marginTop: "4px" }}
            />
            <span>
              I am authorised to record this site and to let Blueprint use the recording to build a
              3D scene of the work area, and I have the right to share any video I link above.{" "}
              <span className="ms-field-hint">
                Required — this is a legal act, and the only one on this form. We store that you
                agreed, when, and to this sentence.
              </span>
            </span>
          </label>
        </>
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
  if (!isSite) return <>
    <SEO title="Find a task for your robot | Blueprint" description="Browse live and past site tasks. Connect your robot setup when you choose an evaluation." canonical="/contact/robot-team" />
    <section className="ms-container ms-task-page"><p className="ms-eyebrow">For robot teams</p>
      <h1>Find work your robot could do.</h1><p>Browse live and past tasks. Choose a task before connecting your robot.</p>
      <TaskBrowse />
    </section>
  </>;
  const title = isSite ? "Let’s start with your site." : "Bring your robot. Find the fit.";
  const description = isSite
    ? "A phone video of one work area is all we need to build the 3D scene robot teams evaluate against. It costs you nothing and nothing here can turn you away."
    // Was "Tell us what your system can do" — a promise to go and look, which
    // is what the old flow actually did: a form, then a wait for a matching
    // site. We already hold the scenes, so the honest offer is a ranked plan
    // today, and the questions below are no longer what unlocks it.
    : "Give us a checkpoint we can run and see which real sites it should be evaluated against — ranked, priced, and free to look at. Arms, humanoids, mobile manipulators, and the policies that run them.";
  return (
    <>
      <SEO
        title={`${isSite ? "Start a task assessment" : "Robot teams"} | Blueprint`}
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
              ? "What the footage shows is what decides, so there is nothing to pass first — four of the questions we used to ask up front are things a thirty-second video answers better than any dropdown. We read it before spending anything and tell you exactly what we saw. Geography, plainly: sending a person is an Austin-metro thing; anywhere in the US you can record the walkthrough yourself; outside the US we set up transfer terms before anything is recorded. The six-question screen is still here if you want the full read before filming, or a conversation instead."
              : "Five questions about your robot, and you will see which real sites we would run it against, what each costs, and why. None of them can turn you away. The sites we prepare today are all in the Austin metro — that is where supply starts, and it is the honest frame for the deployment questions below. The application form is for talking to a person — its questions describe deploying a robot at a site, which is a later conversation than evaluating one, and seven of them a single run answers better than you can."}
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
          /*
           * The camera first, the screen second.
           *
           * The six questions above the form used to decide whether we would
           * accept a video. Four of the five that bind a self-recorded capture
           * are things the footage shows better than a dropdown, and receiving
           * a video costs us nothing -- so the screen was protecting nothing
           * and turning away the supply we are short of.
           *
           * It still exists, below, for a site that wants the full read before
           * filming or wants to talk to someone. It no longer stands in front
           * of the one artifact that makes it answerable.
           */
          <div className="ms-inquiry-forms">
            <SiteCaptureStart />
            <details style={{ marginTop: "32px" }}>
              <summary style={{ cursor: "pointer" }}>
                Want the full read first, or a conversation?
              </summary>
              <p className="ms-field-hint" style={{ margin: "12px 0 20px" }}>
                Six questions that tell you where you stand before you film anything. None of
                them is needed to send us a video.
              </p>
              <ScreeningForm key="site" isSite />
            </details>
          </div>
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
