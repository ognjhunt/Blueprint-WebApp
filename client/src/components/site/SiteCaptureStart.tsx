import { isLikelyPhone } from "@/lib/device";
/** Start with a task and capture permission; assess the work from its evidence. */
import { useEffect, useRef, useState } from "react";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { CaptureLiveStatus } from "@/components/site/CaptureLiveStatus";
import { LocationAutocomplete } from "@/components/site/LocationAutocomplete";
import {
  captureRegionHeldNotice,
  captureRegionNotice,
  captureRegionOptions,
  isApprovedCaptureRegion,
  type CaptureRegion,
} from "@/data/captureResidency";
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Same sentence version the screening form records: the attestation names the
 * exact rights sentence the operator agreed to. Keep the two in lockstep —
 * bump both together whenever either wording changes.
 */
const RIGHTS_STATEMENT_VERSION = "2026-09-18.v1";
const CONTACT_IDENTITY_STORAGE_KEY = "bp-contact-identity";

type State =
  | { status: "idle" }
  | { status: "working" }
  | {
      status: "done";
      captureUrl: string | null;
      workspaceUrl: string | null;
      // Set when a signed-in account could not own the site (it is not a site
      // workspace) and the save fell back to the emailed link instead.
      linkOnlyNote: string | null;
      selfRecording: boolean;
      email: string;
      regionApproved: boolean;
      hasFootage: boolean;
    }
  | { status: "failed"; message: string };

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function SiteCaptureStart() {
  const { currentUser, loading } = useAuth();
  // A scoped development entry link exposes the optional Claude disclosure.
  // Ordinary site captures keep the existing simple form and OpenAI route.
  const claudeAuthoringRequested = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("authoring") === "claude-opus-5-5";
  const solAgentsRequested = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("authoring") === "gpt-6-sol-agents-api";
  // Which workspace the signed-in account holds. A robot-team account can
  // still start a site: it is saved to the emailed link rather than blocked.
  const [workspaceType, setWorkspaceType] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/workspace/setup", {
          credentials: "include",
          headers: await withFirebaseAuthHeaders(currentUser),
        });
        const data = (await response.json().catch(() => ({}))) as { workspaceType?: string | null };
        if (!cancelled) setWorkspaceType(response.ok ? data.workspaceType ?? null : null);
      } catch {
        if (!cancelled) setWorkspaceType(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);
  const siteWorkspace = Boolean(currentUser) && workspaceType === "site_operator";
  // The phone's recording has landed on the server. The laptop then stops
  // being a handoff and becomes the place to do the next step.
  const [captureReceived, setCaptureReceived] = useState(false);
  const requestId = useRef(`capture-${crypto.randomUUID()}`);
  const [state, setState] = useState<State>({ status: "idle" });
  const [selfRecording, setSelfRecording] = useState(true);
  const [region, setRegion] = useState<CaptureRegion | "">("");
  const [regionManuallySet, setRegionManuallySet] = useState(false);
  // Asked because it changes what we say next, not to route them into a
  // different funnel. Existing footage gets assessed for both purposes -- does
  // it explain the job, does it cover the scene -- and reused wherever it can be.
  const [hasFootage, setHasFootage] = useState(false);
  // When the submitter is not the one who will film — common when outreach
  // reaches an ops lead at a desk — we send the record-only link straight to
  // whoever is on the floor. Blank means the submitter is filming.
  const [filmerContact, setFilmerContact] = useState("");
  // The rights checkbox is tracked so the grant itself is transmitted — a
  // required-only checkbox was a legal act the server never heard about.
  const [consent, setConsent] = useState(false);
  const [claudeConsent, setClaudeConsent] = useState(false);
  const [solAgentsConsent, setSolAgentsConsent] = useState(false);
  // Whether the phone handoff below is worth anything here. This form is
  // filled in from whatever device is at hand, including the phone that is
  // about to do the filming -- and a code pointing a phone at itself is not a
  // handoff, it is noise in front of the button that already works.
  const onAPhone = isLikelyPhone();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "working" || loading || !region || !consent
      || (claudeAuthoringRequested && !claudeConsent)
      || (solAgentsRequested && !solAgentsConsent)) return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const email = currentUser?.email || read("startEmail");
    const location = read("startLocation");

    setState({ status: "working" });

    try {
      const { firstName, lastName } = splitName(read("startName"));
      const headers = await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" }));
      const body = JSON.stringify({
          requestId: requestId.current,
          firstName,
          lastName,
          email: email.toLowerCase(),
          company: read("startCompany"),
          roleTitle: "Site operator",
          buyerType: "site_operator",
          // No account: the capture link is the credential. Terms and Privacy
          // are accepted by starting, next to the button, and the server
          // records the versions it holds rather than trusting this flag alone.
          accountSignup: false,
          acceptedTerms: true,
          budgetBucket: "Undecided/Unsure",
          requestedLanes: [],
          siteName: location,
          siteLocation: location,
          taskStatement: read("startTask"),
          taskDescription: read("startTask"),
          // Deliberately empty. The screen used to live here; it now happens
          // with the footage rather than in front of it.
          siteTaskGates: {},
          siteTaskSpec: {},
          captureMode: selfRecording ? "self_capture" : "site_visit",
          captureRegion: region,
          hasExistingFootage: hasFootage,
          filmerContact: filmerContact.trim() || undefined,
          // The grant, not just the ticked box: recorded server-side with the
          // sentence version, or the submission is refused.
          consentAttestation: {
            granted: consent,
            statementVersion: RIGHTS_STATEMENT_VERSION,
          },
          ...(claudeAuthoringRequested ? { claudeAuthoringConsent: {
            granted: claudeConsent,
            statementVersion: "2026-09-24.v1",
          } } : {}),
          ...(solAgentsRequested ? { solAgentsApiConsent: {
            granted: solAgentsConsent,
            statementVersion: "2026-09-24.v1",
          } } : {}),
          // Bot bait: hidden from people; a filled value is a bot and the
          // server answers it with a fake success.
          honeypot: read("honeypot") || undefined,
          context: {
            sourcePageUrl: typeof window === "undefined" ? null : window.location.href,
          },
      });
      const post = (url: string) => fetch(url, { method: "POST", credentials: "include", headers, body });
      // Unknown type (the lookup is still in flight or failed) still tries the
      // workspace first; a refusal falls back with the same answers intact.
      let savedToWorkspace = Boolean(currentUser) && workspaceType !== null && workspaceType !== "robot_team";
      let response = await post(savedToWorkspace ? "/api/workspace/capture-start" : "/api/inbound-request");
      if (savedToWorkspace && response.status === 403) {
        savedToWorkspace = false;
        response = await post("/api/inbound-request");
      }

      const result = (await response.json().catch(() => ({}))) as {
        captureUrl?: string | null;
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        analyticsEvents.contactFormError("capture_start");
        setState({
          status: "failed",
          message:
            result.message || result.error
            || "We could not save that. Please try again, or email hello@tryblueprint.io.",
        });
        return;
      }

      analyticsEvents.contactFormSubmit("capture_start");
      // The screening form lower on the page shares this storage: nobody
      // types their identity twice on one page.
      try {
        window.sessionStorage.setItem(
          CONTACT_IDENTITY_STORAGE_KEY,
          JSON.stringify({
            name: read("startName"),
            email,
            company: read("startCompany"),
          }),
        );
      } catch {
        // Storage can be full or blocked; the forms still work untied.
      }

      setState({
        status: "done",
        workspaceUrl: savedToWorkspace ? `/app/tasks/${requestId.current}` : null,
        linkOnlyNote: currentUser && !savedToWorkspace
          ? `This account is not a site workspace, so this site is saved to the link we email ${email}. You can claim it from that link later.`
          : null,
        captureUrl: typeof result.captureUrl === "string" ? result.captureUrl : null,
        selfRecording,
        email,
        regionApproved: isApprovedCaptureRegion(region),
        hasFootage,
      });
    } catch {
      setState({
        status: "failed",
        message: "We could not reach Blueprint. Please try again shortly.",
      });
    }
  }

  if (state.status === "done") {
    return (
      <div className="ms-form" aria-live="polite">
        {state.workspaceUrl && <p><a className="ms-text-link" href={state.workspaceUrl}>Saved in your workspace</a></p>}
        {state.linkOnlyNote && <p className="ms-field-hint">{state.linkOnlyNote}</p>}
        {!state.regionApproved ? (
          <>
            <h2 style={{ marginTop: 0 }}>We have your site.</h2>
            <p className="ms-field-hint">{captureRegionHeldNotice}</p>
            <p className="ms-field-hint" style={{ marginTop: "20px" }}>
              We will reply to {state.email}. If you already have footage, do not send it yet —
              we would have to delete it unread.
            </p>
          </>
        ) : state.selfRecording && state.captureUrl && captureReceived ? (
          <>
            <h2 style={{ marginTop: 0 }}>Your recording is in.</h2>
            <p className="ms-field-hint">
              Next, check the task brief we drafted from it. You can do that here or on the phone;
              it is the same page.
            </p>
            <p style={{ marginTop: "20px" }}>
              <a className="ms-button ms-button-large" href={state.captureUrl}>Review your task brief</a>
            </p>
            <CaptureLiveStatus captureUrl={state.captureUrl} />
          </>
        ) : state.selfRecording && state.captureUrl ? (
          <>
            <h2 style={{ marginTop: 0 }}>
              {state.hasFootage ? "Send us what you have." : "Film the work area."}
            </h2>
            {/* Two purposes, one recording. Footage they already hold may
                explain the job and cover the scene; if it does we reuse it, and
                if it only does the first we ask for the specific views that are
                missing rather than for "a better video". What we never do is
                make them film something they have already filmed. */}
            <p className="ms-field-hint">
              {state.hasFootage
                ? "Upload the video or photos you already have through this link. We will tell you "
                  + "whether they cover the work area well enough to build the scene, or which extra "
                  + "views would finish the job — you will not be asked to film it all again."
                : "One video of one work area, on any phone. Thirty seconds of the actual cycle is "
                  + "enough. On an iPhone the link opens a small Blueprint camera when that is "
                  + "available; everywhere else the recorder opens in the browser. No account needed."}
            </p>
            {!onAPhone && <CaptureHandoffQr url={state.captureUrl} label="Point your phone at this to film" />}
            <p style={{ marginTop: "20px" }}>
              <a className={onAPhone || state.hasFootage ? "ms-button ms-button-large" : "ms-text-link"} href={state.captureUrl}>
                {state.hasFootage ? "Open the uploader" : onAPhone ? "Open the camera" : "Open your task page"}
              </a>
            </p>
            <p className="ms-field-hint" style={{ marginTop: "20px" }}>
              Keep this link — it is how you come back to this submission, and it is where the task
              brief we draft from your job description will appear for you to correct. Film the
              work, not the worker: hands and objects are what a robot team needs to see.
            </p>
            {/* The laptop, watching the phone through the server's own status
                rather than guessing. Renders nothing until there is something
                real to say, and never blocks the capture happening elsewhere. */}
            <CaptureLiveStatus captureUrl={state.captureUrl} onCaptureReceived={() => setCaptureReceived(true)} />
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>We have it.</h2>
            <p className="ms-field-hint">
              You asked us to record it, so someone will be in touch at {state.email} to arrange a
              time. A visit needs a date and a named person to meet, confirmed in writing before
              anyone travels.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="ms-form" onSubmit={submit} aria-label="Start a site capture">
      <label htmlFor="start-task">
        <span>What is the job?</span>
        <span className="ms-field-hint">
          For example, “move sealed cartons from the conveyor onto a pallet.”
        </span>
        <textarea id="start-task" name="startTask" required maxLength={2000} rows={4} />
      </label>

      {claudeAuthoringRequested && (
        <label htmlFor="start-claude-authoring" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
          <input id="start-claude-authoring" name="startClaudeAuthoring" type="checkbox"
            checked={claudeConsent} onChange={(event) => setClaudeConsent(event.target.checked)}
            style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
          <span style={{ fontWeight: 400 }}>
            For this development test, I authorize Blueprint to send selected frames and task evidence
            from this recording to Anthropic for Claude Opus 5.5 3D authoring. Blueprint pays the
            bounded provider cost; this does not train a model on my recording. See Anthropic’s
            {" "}<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
              commercial API terms
            </a>.
          </span>
        </label>
      )}

      {solAgentsRequested && (
        <label htmlFor="start-sol-agents-authoring" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
          <input id="start-sol-agents-authoring" name="startSolAgentsAuthoring" type="checkbox"
            checked={solAgentsConsent} onChange={(event) => setSolAgentsConsent(event.target.checked)}
            style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
          <span style={{ fontWeight: 400 }}>
            For this development test, I authorize Blueprint to send selected frames and task evidence
            to OpenAI for GPT-6 Sol managed-agent 3D authoring. The agent session can retain that evidence
            until it is deleted under the configured provider policy. Blueprint pays the bounded provider cost.
          </span>
        </label>
      )}

      <label htmlFor="start-existing-footage" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
        <input
          id="start-existing-footage"
          name="startExistingFootage"
          type="checkbox"
          checked={hasFootage}
          onChange={(event) => setHasFootage(event.target.checked)}
          style={{ width: "auto", minHeight: 0, marginTop: "4px" }}
        />
        {/* Reuse before re-record. A recording that already shows the job may
            also have the coverage a scene needs -- and if it does, asking them
            to film again would be us making them pay for our workflow having
            stages. */}
        <span style={{ fontWeight: 400 }}>
          I already have a video or photos of this job
        </span>
      </label>

      <label htmlFor="start-self-recording" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
        <input
          id="start-self-recording"
          name="startSelfRecording"
          type="checkbox"
          checked={selfRecording}
          onChange={(event) => setSelfRecording(event.target.checked)}
          style={{ width: "auto", minHeight: 0 }}
        />
        <span>We will film it ourselves</span>
      </label>

      {selfRecording && (
        <label htmlFor="start-filmer">
          <span>
            Who is doing the filming? <span className="ms-optional">(optional)</span>
          </span>
          <span className="ms-field-hint">
            Filming it yourself? Leave this blank. If someone else on-site will do it, put their
            email here and we will send them a record-only link — they can film and upload,
            and only you can confirm the task brief.
          </span>
          <input
            id="start-filmer"
            name="startFilmer"
            type="email"
            inputMode="email"
            maxLength={320}
            placeholder="Their email — optional"
            value={filmerContact}
            onChange={(event) => setFilmerContact(event.target.value)}
          />
        </label>
      )}

      <label htmlFor="start-location">
        <span>{selfRecording ? "Where is it?" : "Site address"}</span>
        <span className="ms-field-hint">
          {selfRecording
            ? "A city is plenty. We only need a street address if we are sending someone."
            : "A capture operator needs a street address, not a site nickname."}
        </span>
        <LocationAutocomplete
          id="start-location"
          name="startLocation"
          required
          maxLength={300}
          placeholder={selfRecording ? "City, or a full address" : "Street address"}
          onSelectionChange={(place) => {
            if (!regionManuallySet) setRegion(place?.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "");
          }}
        />
      </label>

      <label htmlFor="start-region">
        <span>Which country is the site in?</span>
        <span className="ms-field-hint">
          Set from the address you pick; change it if that is wrong. {captureRegionNotice}
        </span>
        <select
          id="start-region"
          name="startRegion"
          value={region}
          required
          onChange={(event) => { setRegion(event.target.value as CaptureRegion); setRegionManuallySet(!!event.target.value); }}
        >
          <option value="">Choose country</option>
          {captureRegionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {!currentUser && <>
      <label htmlFor="start-email">
        <span>Work email</span>
        <span className="ms-field-hint">
          Where we send the capture link and everything that follows — the scene, the plan, the
          verdict on your footage.
        </span>
        <input id="start-email" name="startEmail" type="email" required maxLength={320} />
      </label>

      <div className="ms-form-row">
        <label htmlFor="start-name">
          <span>
            Your name <span className="ms-optional">(optional)</span>
          </span>
          <input id="start-name" name="startName" type="text" maxLength={120} />
        </label>
        <label htmlFor="start-company">
          <span>
            Site or company <span className="ms-optional">(optional)</span>
          </span>
          <input id="start-company" name="startCompany" type="text" maxLength={200} />
        </label>
      </div>

      </>}
      {currentUser && workspaceType !== undefined && (siteWorkspace
        ? <p className="ms-field-hint">Saving to your workspace as {currentUser.email}.</p>
        : <p className="ms-field-hint">Signed in as {currentUser.email}, which is not a site workspace. This site will be saved to the link we email you, and you can claim it later.</p>)}

      {/* Bot bait: hidden from people, honoured by the server. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="start-website-hp">Leave this field empty</label>
        <input
          id="start-website-hp"
          name="honeypot"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label htmlFor="start-rights" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
        <input
          id="start-rights"
          name="startRights"
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          style={{ width: "auto", minHeight: 0, marginTop: "4px" }}
        />
        {/* The only thing on this form that blocks, because it is a legal act
            rather than a judgement about whether the site is any good. The
            grant is transmitted and stored with the sentence version — a tick
            the server never heard about protects nobody. */}
        <span style={{ fontWeight: 400 }}>
          I am authorized to record this site and to let Blueprint use the recording to build a
          scene robot teams can evaluate against.
        </span>
      </label>

      {state.status === "failed" && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>
          {state.message}
        </p>
      )}

      <p className="ms-form-note">
        By selecting Start, you agree to our{" "}
        <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms of Service</a> and{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>

      <button className="ms-button ms-button-large" type="submit" disabled={state.status === "working" || loading}>
        {state.status === "working" ? "Working…" : "Start"}
      </button>
    </form>
  );
}
