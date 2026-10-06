import { isLikelyPhone } from "@/lib/device";
/** Start with a description; recording authority is separate. */
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
import { DESCRIPTION_AUTHORITY_STATEMENT, DESCRIPTION_AUTHORITY_VERSION } from "@/lib/siteSubmissionAuthority";
import { formatPrice, pilotFeeUsd } from "@/lib/evaluationPricing";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  CAPTURE_VIDEO_ACCEPT,
  captureTokenFromUrl,
  isCaptureVideoFile,
  uploadSelfCaptureVideo,
  receivedVideoResult,
  retrySelfCaptureProcessing,
  type VideoUploadResult,
} from "@/lib/selfCaptureVideo";
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
      // What became of the video attached to the form. "none" is no video, not
      // a failure; "failed" means the job is saved but receipt is unconfirmed.
      uploaded: "none" | VideoUploadResult["status"];
      uploadMessage: string | null;
      processingRetryAvailable: boolean;
    }
  | { status: "failed"; message: string };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function SiteCaptureStart() {
  const { currentUser, loading } = useAuth();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  // A scoped development entry link exposes the optional Claude disclosure.
  // Ordinary site captures keep the existing simple form and OpenAI route.
  const claudeAuthoringRequested = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("authoring") === "claude-opus-5-5";
  // Retained development links select the upgraded Sol route too; the
  // disclosure and newly issued sponsorship always name GPT-6.1 Sol.
  const solAgentsRequested = typeof window !== "undefined"
    && ["gpt-6.1-sol-agents-api", "gpt-6-sol-agents-api"].includes(
      new URLSearchParams(window.location.search).get("authoring") || "",
    );
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
  // Separate from the public record identifier: only this form can recover
  // the capture link if the server saved the job but its response was lost.
  const retryToken = useRef(crypto.randomUUID());
  const [state, setState] = useState<State>({ status: "idle" });
  const operationInFlight = useRef(false);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [retryingVideo, setRetryingVideo] = useState(false);

  async function retryProcessing() {
    if (operationInFlight.current || state.status !== "done" || !state.captureUrl
      || !state.processingRetryAvailable) return;
    const token = captureTokenFromUrl(state.captureUrl);
    if (!token) return;
    operationInFlight.current = true;
    setRetryingProcessing(true);
    try {
      const outcome = await retrySelfCaptureProcessing(token);
      setState((current) => current.status === "done" ? {
        ...current,
        uploaded: outcome.status === "failed" ? "processing_pending" : outcome.status,
        uploadMessage: outcome.status === "done" ? null : outcome.message,
        processingRetryAvailable: outcome.status === "processing_pending" && outcome.processingRetryAvailable,
      } : current);
    } finally {
      operationInFlight.current = false;
      setRetryingProcessing(false);
    }
  }
  async function refreshReceivedVideo(captureUrl: string) {
    const token = captureTokenFromUrl(captureUrl);
    if (!token) return;
    try {
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/status`);
      const outcome = receivedVideoResult(await response.json().catch(() => null));
      if (!outcome) return;
      setCaptureReceived(true);
      setState((current) => current.status === "done" ? {
        ...current, uploaded: outcome.status,
        uploadMessage: outcome.status === "done" ? null : outcome.message,
        processingRetryAvailable: outcome.status === "processing_pending" && outcome.processingRetryAvailable,
      } : current);
    } catch { /* A status hint cannot substitute for verified receipt. */ }
  }
  const [selfRecording, setSelfRecording] = useState(true);
  const [region, setRegion] = useState<CaptureRegion | "">("");
  const [regionManuallySet, setRegionManuallySet] = useState(false);
  // The address answers the country, so the country is not a question on the
  // page. It opens when the operator asks to correct it, or when a typed
  // address never resolved to a country and we cannot go on without one.
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryPrompted, setCountryPrompted] = useState(false);
  const regionSelect = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (countryPrompted) regionSelect.current?.focus();
  }, [countryPrompted]);
  // Asked because it changes what we say next, not to route them into a
  // different funnel. Existing footage gets assessed for both purposes -- does
  // it explain the job, does it cover the scene -- and reused wherever it can be.
  // When it is ticked the video is attached right here, so the form is the
  // whole submission rather than a step before another upload page.
  const [hasFootage, setHasFootage] = useState(false);
  const [footage, setFootage] = useState<File | null>(null);
  const [footageError, setFootageError] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  async function retrySelectedVideo() {
    if (operationInFlight.current || state.status !== "done" || state.uploaded !== "failed"
      || !state.captureUrl || !footage) return;
    const token = captureTokenFromUrl(state.captureUrl);
    if (!token) return;
    operationInFlight.current = true;
    setRetryingVideo(true);
    try {
      const outcome = await uploadSelfCaptureVideo(token, footage, setUploadPercent);
      if (outcome.status !== "failed") setCaptureReceived(true);
      setState((current) => current.status === "done" ? {
        ...current, uploaded: outcome.status,
        uploadMessage: outcome.status === "done" ? null : outcome.message,
        processingRetryAvailable: outcome.status === "processing_pending" && outcome.processingRetryAvailable,
      } : current);
    } finally {
      operationInFlight.current = false;
      setRetryingVideo(false);
      setUploadPercent(null);
    }
  }
  // The video is only taken from a site we are cleared to receive it from.
  const footageWanted = hasFootage && region !== "non_us";
  // When the submitter is not the one who will film — common when outreach
  // reaches an ops lead at a desk — we send the record-only link straight to
  // whoever is on the floor, only when the submitter chooses to delegate.
  const [delegatedFilming, setDelegatedFilming] = useState(false);
  const [filmerContact, setFilmerContact] = useState("");
  // The rights checkbox is tracked so the grant itself is transmitted — a
  // required-only checkbox was a legal act the server never heard about.
  const [consent, setConsent] = useState(false);
  const [descriptionAuthority, setDescriptionAuthority] = useState(false);
  const [claudeConsent, setClaudeConsent] = useState(false);
  const [solAgentsConsent, setSolAgentsConsent] = useState(false);
  // Whether the phone handoff below is worth anything here. This form is
  // filled in from whatever device is at hand, including the phone that is
  // about to do the filming -- and a code pointing a phone at itself is not a
  // handoff, it is noise in front of the button that already works.
  const onAPhone = isLikelyPhone();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operationInFlight.current || state.status === "working" || loading || !descriptionAuthority
      || (footageWanted && !consent)
      || (claudeAuthoringRequested && !claudeConsent)
      || (solAgentsRequested && !solAgentsConsent)) return;
    // A typed address that never resolved to a country: ask now, once, rather
    // than guess. The country decides whether we may collect footage at all.
    if (!region) {
      setCountryOpen(true);
      setCountryPrompted(true);
      return;
    }
    if (footageWanted && !footage) return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const email = currentUser?.email || read("startEmail");
    const location = read("startLocation");

    operationInFlight.current = true;
    setState({ status: "working" });

    try {
      const { firstName, lastName } = splitName(read("startName"));
      const headers = await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" }));
      const body = JSON.stringify({
          requestId: requestId.current,
          retryToken: retryToken.current,
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
          // Someone who already has the video is not asking for a visit.
          captureMode: hasFootage || selfRecording ? "self_capture" : "site_visit",
          captureRegion: region,
          hasExistingFootage: footageWanted,
          filmerContact: !hasFootage && selfRecording && delegatedFilming ? filmerContact.trim() || undefined : undefined,
          // The grant, not just the ticked box: recorded server-side with the
          // sentence version, or the submission is refused.
          descriptionOnly: !consent,
          descriptionAuthority: {
            granted: descriptionAuthority,
            statementVersion: DESCRIPTION_AUTHORITY_VERSION,
          },
          consentAttestation: consent ? {
            granted: true,
            statementVersion: RIGHTS_STATEMENT_VERSION,
          } : null,
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

      const captureUrl = typeof result.captureUrl === "string" ? result.captureUrl : null;
      const regionApproved = isApprovedCaptureRegion(region);

      // The job is saved; now the video, through the same token route the
      // capture page uses. A failure here never loses the submission: the
      // success screen offers the link to send it again.
      let uploaded: "none" | VideoUploadResult["status"] = "none";
      let uploadMessage: string | null = null;
      let processingRetryAvailable = false;
      const captureToken = captureUrl ? captureTokenFromUrl(captureUrl) : null;
      if (footageWanted && footage && regionApproved && captureToken) {
        setUploadPercent(0);
        const outcome = await uploadSelfCaptureVideo(captureToken, footage, setUploadPercent);
        uploaded = outcome.status;
        uploadMessage = outcome.status === "done" ? null : outcome.message;
        processingRetryAvailable = outcome.status === "processing_pending" && outcome.processingRetryAvailable;
        if (outcome.status !== "failed") setCaptureReceived(true);
      }

      setState({
        status: "done",
        workspaceUrl: savedToWorkspace ? `/app/tasks/${requestId.current}` : null,
        linkOnlyNote: currentUser && !savedToWorkspace
          ? `This account is not a site workspace, so this site is saved to the link we email ${email}. You can claim it from that link later.`
          : null,
        captureUrl,
        selfRecording: selfRecording || hasFootage,
        email,
        regionApproved,
        hasFootage: footageWanted,
        uploaded,
        uploadMessage,
        processingRetryAvailable,
      });
    } catch {
      setState({
        status: "failed",
        message: "We could not reach Blueprint. Please try again shortly.",
      });
    } finally {
      operationInFlight.current = false;
      setUploadPercent(null);
    }
  }

  if (state.status === "done") {
    return (
      <div className="ms-form" aria-live="polite">
        {state.workspaceUrl && <p><a className="ms-text-link" href={state.workspaceUrl}>Saved in your workspace</a></p>}
        {state.linkOnlyNote && <p className="ms-field-hint">{state.linkOnlyNote}</p>}
        {!state.hasFootage && state.captureUrl && !captureReceived ? (
          <>
            <h2 style={{ marginTop: 0 }}>Your job description is saved.</h2>
            <p className="ms-field-hint">Review and correct your job brief. You can add footage later, once you have recording permission.</p>
            <p><a className="ms-button ms-button-large" href={state.captureUrl}>Review your job brief</a></p>
            {!state.regionApproved && <p className="ms-field-hint">{captureRegionHeldNotice}</p>}
            <p className="ms-field-hint">Keep this private link to return to your job. We will also email it to {state.email}.</p>
            <CaptureLiveStatus captureUrl={state.captureUrl} onCaptureReceived={() => void refreshReceivedVideo(state.captureUrl!)} />
          </>
        ) : !state.regionApproved ? (
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
            <h2 style={{ marginTop: 0 }}>{state.uploaded === "processing_pending" ? "Video received. Processing is not confirmed." : "Your recording is in."}</h2>
            {state.uploaded !== "done" && state.uploadMessage && (
              <p className="ms-field-hint">{state.uploadMessage}</p>
            )}
            {state.uploaded === "processing_pending" && state.processingRetryAvailable && (
              <p><button type="button" className="ms-button" disabled={retryingProcessing} onClick={() => void retryProcessing()}>
                {retryingProcessing ? "Retrying processing…" : "Retry processing"}
              </button></p>
            )}
            <p className="ms-field-hint">
              Next, check your job brief. You can do that here or on the phone; it is the same page.
            </p>
            <p style={{ marginTop: "20px" }}>
              <a className="ms-button ms-button-large" href={state.captureUrl}>Review your job brief</a>
            </p>
            <CaptureLiveStatus captureUrl={state.captureUrl} />
          </>
        ) : state.selfRecording && state.captureUrl ? (
          <>
            <h2 style={{ marginTop: 0 }}>
              {state.uploaded === "failed"
                ? "Your job is saved. Check your video upload."
                : state.hasFootage ? "Send us what you have." : "Film the work area."}
            </h2>
            {/* Two purposes, one recording. Footage they already hold may
                explain the job and cover the scene; if it does we reuse it, and
                if it only does the first we ask for the specific views that are
                missing rather than for "a better video". What we never do is
                make them film something they have already filmed. */}
            <p className="ms-field-hint">
              {state.uploaded === "failed"
                ? `${state.uploadMessage ?? "We could not confirm the video upload."} Keep your original video and open your job page to check its status.`
                : state.hasFootage
                ? "Upload the video you already have through this link. We will tell you "
                  + "whether it covers the work area well enough to build the scene, or which extra "
                  + "views would finish the job — you will not be asked to film it all again."
                : "One video of one work area, on any phone. Thirty seconds of the actual cycle is "
                  + "enough. On an iPhone the link opens a small Blueprint camera when that is "
                  + "available; everywhere else the recorder opens in the browser. No account needed."}
            </p>
            {!onAPhone && !state.hasFootage && <CaptureHandoffQr url={state.captureUrl} label="Point your phone at this to film" />}
            {state.uploaded === "failed" && footage && <p>
              <button type="button" className="ms-button" disabled={retryingVideo} onClick={() => void retrySelectedVideo()}>
                {retryingVideo ? uploadPercent === null ? "Checking selected video…" : `Uploading video… ${uploadPercent}%` : "Try the selected video again"}
              </button>
            </p>}
            <p style={{ marginTop: "20px" }}>
              <a className={onAPhone || state.hasFootage ? "ms-button ms-button-large" : "ms-text-link"} href={state.hasFootage ? `${state.captureUrl}${state.captureUrl.includes("?") ? "&" : "?"}video=existing` : state.captureUrl}>
                {state.hasFootage ? "Open the uploader" : onAPhone ? "Open the camera" : "Open your job page"}
              </a>
            </p>
            <p className="ms-field-hint" style={{ marginTop: "20px" }}>
              Keep this link — it is how you come back to this submission, and it is where the job
              brief we draft from your job description will appear for you to correct.
              {!state.hasFootage && " Film the work, not the worker: hands and objects are what a robot team needs to see."}
            </p>
            {!onAPhone && state.hasFootage && <details>
              <summary>Open this job on another device (optional)</summary>
              <p className="ms-field-hint">Use this only if your existing video is on another device. You do not need to record it again.</p>
              <CaptureHandoffQr url={`${state.captureUrl}${state.captureUrl.includes("?") ? "&" : "?"}video=existing`} label="Open this job on another device" />
            </details>}
            {/* The laptop, watching the phone through the server's own status
                rather than guessing. Renders nothing until there is something
                real to say, and never blocks the capture happening elsewhere. */}
            <CaptureLiveStatus captureUrl={state.captureUrl} onCaptureReceived={() => void refreshReceivedVideo(state.captureUrl!)} />
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
    <form className="ms-form" method="post" onSubmit={submit} aria-label="Start a site capture">
      <fieldset disabled={!interactive} className="contents">
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
            to OpenAI for GPT-6.1 Sol managed-agent 3D authoring. The agent session can retain that evidence
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
          onChange={(event) => {
            setHasFootage(event.target.checked);
            if (!event.target.checked) { setFootage(null); setFootageError(null); }
          }}
          style={{ width: "auto", minHeight: 0, marginTop: "4px" }}
        />
        {/* Reuse before re-record. A recording that already shows the job may
            also have the coverage a scene needs -- and if it does, asking them
            to film again would be us making them pay for our workflow having
            stages. Video only: what we build a scene from is a walkthrough of
            the work, not stills. */}
        <span style={{ fontWeight: 400 }}>
          I already have a video of this job
        </span>
      </label>

      {hasFootage ? (
        // Someone with the video has nothing to schedule and nobody to hand a
        // camera to, so the filming options step aside for the upload itself.
        region === "non_us" ? (
          <p className="ms-field-hint">
            Hold on to the video for now. Outside the US we set up the data-transfer terms before
            anything is uploaded, and we will tell you when to send it.
          </p>
        ) : (
          <label htmlFor="start-footage">
            <span>Upload the video</span>
            <span className="ms-field-hint">
              A .mov or .mp4 file, straight from the phone or camera that recorded it. One complete
              cycle of the job is enough. We check whether it covers the work area and ask only for
              the views that are missing.
            </span>
            <input
              id="start-footage"
              name="startFootage"
              type="file"
              accept={CAPTURE_VIDEO_ACCEPT}
              required
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && !isCaptureVideoFile(file)) {
                  event.target.value = "";
                  setFootage(null);
                  setFootageError("That file is not a .mov or .mp4 video. Pick the video straight from your phone's library.");
                  return;
                }
                setFootage(file);
                setFootageError(null);
              }}
            />
            {footageError && <span role="alert" className="ms-field-hint" style={{ color: "var(--ms-alert, #b00)" }}>{footageError}</span>}
            {footage && <span className="ms-field-hint">{formatBytes(footage.size)}. It uploads when you select Start free assessment.</span>}
          </label>
        )
      ) : (
        <>
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
            <label htmlFor="start-delegated-filming" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
              <input
                id="start-delegated-filming"
                type="checkbox"
                checked={delegatedFilming}
                onChange={(event) => setDelegatedFilming(event.target.checked)}
                aria-controls="start-filmer-details"
                style={{ width: "auto", minHeight: 0 }}
              />
              <span>Someone else will record it</span>
            </label>
          )}

          {selfRecording && delegatedFilming && (
            <label id="start-filmer-details" htmlFor="start-filmer">
              <span>
                Their email <span className="ms-optional">(optional)</span>
              </span>
              <span className="ms-field-hint">
                Once recording permission is confirmed, add their email and we will send them a record-only link — they can film and upload,
                and only you can confirm the job brief.
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
        </>
      )}

      {/* The address and the country it implies, grouped: the country is a
          consequence of the address, so it sits under it as a line to confirm
          rather than a second question. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        <label htmlFor="start-location">
          <span>{selfRecording || hasFootage ? "Where is it?" : "Site address"}</span>
          <span className="ms-field-hint">
            {selfRecording || hasFootage
              ? "A city is plenty. We only need a street address if we are sending someone."
              : "A capture operator needs a street address, not a site nickname."}
          </span>
          <LocationAutocomplete
            id="start-location"
            name="startLocation"
            required
            maxLength={300}
            placeholder={selfRecording || hasFootage ? "City, or a full address" : "Street address"}
            onSelectionChange={(place) => {
              if (!regionManuallySet) setRegion(place?.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "");
            }}
          />
        </label>

        {countryOpen ? (
          <label htmlFor="start-region">
            <span>Which country is the site in?</span>
            <select
              id="start-region"
              name="startRegion"
              ref={regionSelect}
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
        ) : region ? (
          <p className="ms-field-hint" style={{ margin: 0 }}>
            Country: {captureRegionOptions.find((option) => option.value === region)?.label}.{" "}
            <button type="button" className="ms-text-link" style={{ font: "inherit" }} onClick={() => setCountryOpen(true)}>
              Change
            </button>
          </p>
        ) : null}

        {(countryOpen || region === "non_us") && (
          <p className="ms-field-hint" style={{ margin: 0 }}>{captureRegionNotice}</p>
        )}
      </div>

      {!currentUser && <>
      <label htmlFor="start-email">
        <span>Work email</span>
        <span className="ms-field-hint">
          Where we send your job link to add footage, follow progress and review the job brief.
        </span>
        <input id="start-email" name="startEmail" type="email" required maxLength={320} />
      </label>

      <div className="ms-form-row">
        <label htmlFor="start-name">
          <span>Your name</span>
          <input id="start-name" name="startName" type="text" required autoComplete="name" maxLength={120} />
        </label>
        <label htmlFor="start-company">
          <span>Site or company</span>
          <input id="start-company" name="startCompany" type="text" required autoComplete="organization" maxLength={200} />
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

      <label htmlFor="start-description-authority" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
        <input id="start-description-authority" type="checkbox" required checked={descriptionAuthority}
          onChange={(event) => setDescriptionAuthority(event.target.checked)}
          style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
        <span style={{ fontWeight: 400 }}>{DESCRIPTION_AUTHORITY_STATEMENT}</span>
      </label>
      <label htmlFor="start-rights" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
        <input
          id="start-rights"
          name="startRights"
          type="checkbox"
          required={footageWanted}
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          style={{ width: "auto", minHeight: 0, marginTop: "4px" }}
        />
        <span style={{ fontWeight: 400 }}>
          <span className="ms-field-hint">Required before adding footage; optional for a description.</span>{" "}
          I am authorized to record this site and to let Blueprint use the recording to build a
          scene robot teams can evaluate against.
        </span>
      </label>

      <p className="ms-form-note">
        Share only footage you are authorized to use. Robot teams never receive your original recording.
        {" "}<a href={PRIVACY_URL}>How we process your footage</a>.
      </p>
      <p className="ms-form-note">
        Still arranging recording permission?{" "}
        You can start with the description and review your brief now.
      </p>

      {state.status === "failed" && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>
          {state.message}
        </p>
      )}

      <p className="ms-field-hint">
        Next, review and correct your job brief before approving it. Starting is free.
        We pick the robot team and send you one recommended pilot. You pay {formatPrice(pilotFeeUsd)} only
        if you book it. No pilot, no fee.
        {" "}<a href="/pricing#pilot-fee">Fee and replacement policy</a>.
      </p>

      <p className="ms-form-note">
        By selecting Start free assessment, you agree to our{" "}
        <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms of Service</a> and{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>

      <button className="ms-button ms-button-large" type="submit" disabled={!interactive || state.status === "working" || loading}>
        {state.status !== "working" ? "Start free assessment"
          : uploadPercent !== null ? `Uploading video… ${uploadPercent}%` : "Working…"}
      </button>

      {uploadPercent !== null && (
        <div>
          <div
            role="progressbar"
            aria-valuenow={uploadPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Video upload progress"
            style={{ height: "4px", background: "var(--ms-rule)" }}
          >
            <div style={{ width: `${uploadPercent}%`, height: "100%", background: "var(--ms-green)", transition: "width 200ms ease" }} />
          </div>
          <p className="ms-field-hint" style={{ marginTop: "10px" }}>
            Keep this page open until the video has finished uploading.
          </p>
        </div>
      )}
      </fieldset>
      <noscript><p>Enable JavaScript to start a capture, or contact <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a> about your job.</p></noscript>
    </form>
  );
}
