import { anonymizedOpportunityDraft } from "@/types/taskBrowse";
import { isLikelyPhone } from "@/lib/device";
/** Show the work; explanatory text is optional when capture is authorized. */
import { useEffect, useRef, useState } from "react";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { CaptureLiveStatus } from "@/components/site/CaptureLiveStatus";
import { LocationAutocomplete } from "@/components/site/LocationAutocomplete";
import {
  captureRegionHeldNotice,
  captureRegionNotice,
  isApprovedCaptureRegion,
  type CaptureRegion,
} from "@/data/captureResidency";
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import { inferLocationCountryCode } from "@/lib/deploymentCoverage";
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
import { newSiteCaptureRecovery, readSiteCaptureRecovery, writeSiteCaptureRecovery,
  hydrateSiteCaptureRecovery, writeSiteCaptureRecoveryDurably, resetSiteCaptureRecoveryDurably,
  forgetSiteCaptureRecovery, hasSiteCaptureRecoveryBytes, siteCaptureDraftKey, withSiteCaptureRecoveryLock,
  freezeSiteCaptureRecovery, type SiteCaptureRecovery } from "@/lib/siteCaptureDraft";

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


type ClearStatus = "idle" | "working" | "done" | "failed";
function ClearDraftControl({status,onClear,disabled=false}:{status:ClearStatus;onClear:()=>void;disabled?:boolean}) {
  return <>
    <button type="button" className="ms-text-link" disabled={disabled || status === "working"} onClick={onClear}>
      {status === "working" ? "Clearing…" : "Clear this browser's draft"}
    </button>
    {status === "working" && <p role="status" className="ms-field-hint">Clearing this browser's draft. Wait for confirmation before leaving this page.</p>}
    {status === "done" && <p role="status" className="ms-field-hint">This browser's draft has been cleared.</p>}
    {status === "failed" && <p role="alert" className="ms-field-hint">We could not confirm that this browser's draft was cleared. Stay on this page and try again before leaving a shared device.</p>}
  </>;
}

export function SiteCaptureStart() {
  const { currentUser, loading } = useAuth();
  const authoring = typeof window === "undefined" ? "default"
    : new URLSearchParams(window.location.search).get("authoring") || "default";
  const storageKey = loading ? null : siteCaptureDraftKey(currentUser?.uid ?? null, authoring);
  const [hydrated, setHydrated] = useState<{key: string; ready: boolean} | null>(null);
  const [clearState, setClearState] = useState<{key: string; epoch: number; status: ClearStatus} | null>(null);
  const clearingScope = useRef<{key: string; epoch: number} | null>(null);
  const currentScope = useRef({key: storageKey, epoch: 0});
  // Returning to the same account cannot revive an intent canceled on departure.
  if (currentScope.current.key !== storageKey) currentScope.current = {key: storageKey, epoch: currentScope.current.epoch + 1};
  const clearStatus = clearState?.key === storageKey && clearState.epoch === currentScope.current.epoch ? clearState.status : "idle";
  useEffect(() => {
    let active = true;
    if (storageKey) void hydrateSiteCaptureRecovery(storageKey, () => active)
      .then(() => { if (active) setHydrated({key: storageKey, ready: true}); })
      .catch(() => { if (active) setHydrated({key: storageKey, ready: false}); });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    if (hydrated?.ready && clearState?.key === hydrated.key && clearState.status === "done") setClearState(null);
  }, [hydrated, clearState]);
  if (loading || !storageKey || hydrated?.key !== storageKey) return <p role="status">Loading your account and saved draft…</p>;
  if (!hydrated.ready) return <div className="ms-form">
    <p role="status">This browser could not safely check saved recovery details. Use your emailed private job link to return, or a supported browser with local storage enabled.</p>
    <ClearDraftControl status={clearStatus} onClear={async () => {
      const intent = {key: storageKey, epoch: currentScope.current.epoch};
      if (clearingScope.current?.key === intent.key && clearingScope.current.epoch === intent.epoch) return;
      const isCurrent = () => currentScope.current.key === intent.key && currentScope.current.epoch === intent.epoch;
      clearingScope.current = intent; setClearState({...intent, status: "working"});
      try {
        const saved = await withSiteCaptureRecoveryLock(intent.key, () => isCurrent() && resetSiteCaptureRecoveryDurably(intent.key, newSiteCaptureRecovery()));
        if (!isCurrent()) return;
        setClearState({...intent, status: saved ? "done" : "failed"});
        if (saved) setHydrated({key: intent.key, ready: true});
      } catch { if (isCurrent()) setClearState({...intent, status: "failed"}); }
      finally { if (clearingScope.current === intent) clearingScope.current = null; }
    }} />
    <p className="ms-field-hint">Clearing removes only this device's recovery. It does not cancel or delete a saved job.</p>
  </div>;
  // Identity changes discard later UI updates and prevent starting another upload.
  return <SiteCaptureStartForm key={storageKey} storageKey={storageKey} cleared={clearStatus === "done"} />;
}

function SiteCaptureStartForm({ storageKey, cleared = false }: { storageKey: string | null; cleared?: boolean }) {
  const { currentUser, loading } = useAuth();
  const [stored] = useState(() => readSiteCaptureRecovery(storageKey));
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(() => !stored && hasSiteCaptureRecoveryBytes(storageKey));
  const [initial] = useState(() => stored ?? newSiteCaptureRecovery());
  const recovery = useRef<SiteCaptureRecovery>(initial);
  const [pending, setPending] = useState(initial.pending);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [clearStatus, setClearStatus] = useState<ClearStatus>(cleared ? "done" : "idle");
  const [resetVersion, setResetVersion] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function retain(next: SiteCaptureRecovery, releasePendingBody?: string) {
    recovery.current = next;
    try {
      const result = await withSiteCaptureRecoveryLock(storageKey, async () => {
        if (!active.current) return {saved: false, latest: null};
        const saved = await writeSiteCaptureRecoveryDurably(storageKey, next, {releasePendingBody});
        return { saved, latest: readSiteCaptureRecovery(storageKey) };
      });
      if (!active.current) return;
      // A rejected stale autosave adopts the whole winner, not just its identity.
      if (result.latest && (result.latest.pending || result.latest.requestId !== next.requestId)) {
        if (!operationInFlight.current) adoptRecovery(result.latest);
        else recovery.current = result.latest;
      }
      setStorageAvailable(result.saved || Boolean(result.latest?.pending));
      return result.saved;
    } catch { if (active.current) setStorageAvailable(false); }
    return false;
  }
  useEffect(() => {
    if (storageKey && !recoveryUnavailable) void retain(recovery.current);
  }, [storageKey]);
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
  const requestId = useRef(initial.requestId);
  // Separate from the public record identifier: only this form can recover
  // the capture link if the server saved the job but its response was lost.
  const retryToken = useRef(initial.retryToken);
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
      if (!response.ok || !active.current) return;
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
  // One question decides how we will see the task: an upload now, the site's
  // own phone later, or a Blueprint visit.
  const [method, setMethod] = useState<"upload" | "phone" | "visit">(initial.draft.method);
  const selfRecording = method === "phone";
  const [region, setRegion] = useState<CaptureRegion | "">(initial.draft.region);
  // The address is the only place the country comes from. An address that does
  // not resolve to one is flagged at Start, next to the address itself.
  const [countryMissing, setCountryMissing] = useState(false);
  // Asked because it changes what we say next, not to route them into a
  // different funnel. Existing footage gets assessed for both purposes -- does
  // it explain the job, does it cover the scene -- and reused wherever it can be.
  // When it is ticked the video is attached right here, so the form is the
  // whole submission rather than a step before another upload page.
  const hasFootage = method === "upload";
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
  // The grant only counts when the box it came from is on screen. A consent
  // left over from the upload path must not ride along on a phone submission.
  const rightsShown = footageWanted;
  // The rights checkbox is tracked so the grant itself is transmitted — a
  // required-only checkbox was a legal act the server never heard about.
  const [taskForPreview, setTaskForPreview] = useState(initial.draft.task);
  const [privateHandling, setPrivateHandling] = useState(initial.draft.privateHandling ?? false);
  const publicDraft = anonymizedOpportunityDraft(taskForPreview);
  const [consent, setConsent] = useState(false);
  const [claudeConsent, setClaudeConsent] = useState(false);
  const [solAgentsConsent, setSolAgentsConsent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  function adoptRecovery(other: SiteCaptureRecovery, resetChanged = true) {
    const changed = recovery.current.requestId !== other.requestId
      || recovery.current.pending?.body !== other.pending?.body;
    recovery.current = other;
    requestId.current = other.requestId; retryToken.current = other.retryToken;
    setPrivateHandling(other.draft.privateHandling ?? false); setTaskForPreview(other.draft.task);
    setMethod(other.draft.method); setRegion(other.draft.region);
    setPending(other.pending);
    if (changed && resetChanged) {
      setConsent(false); setClaudeConsent(false); setSolAgentsConsent(false);
      setFootage(null); setResetVersion(value => value + 1);
    }
  }
  function retainDraft() {
    if (!interactive || clearStatus === "working" || recoveryUnavailable || recovery.current.pending || !formRef.current) return;
    const data = new FormData(formRef.current);
    const field = (name: string) => String(data.get(name) ?? "");
    retain({ ...recovery.current, savedAt: Date.now(), draft: {
      task: field("startTask"), location: field("startLocation"), email: field("startEmail"), company: field("startCompany"),
      method, region, regionManuallySet: false, ...(privateHandling ? { privateHandling: true } : {}),
    } });
  }
  useEffect(() => { retainDraft(); }, [interactive, method, region, privateHandling]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || operationInFlight.current) return;
      const other = readSiteCaptureRecovery(storageKey);
      if (other && (other.pending || other.requestId !== requestId.current)) adoptRecovery(other);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);
  async function forgetDraft() {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setClearStatus("working");
    const fresh = newSiteCaptureRecovery();
    try {
      const saved = await withSiteCaptureRecoveryLock(storageKey, () => active.current && resetSiteCaptureRecoveryDurably(storageKey, fresh));
      if (!active.current) return;
      if (!saved) { setStorageAvailable(false); setClearStatus("failed"); return; }
      setStorageAvailable(true);
      recovery.current = fresh;
      requestId.current = fresh.requestId; retryToken.current = fresh.retryToken;
      setRecoveryUnavailable(false); setPending(null); setState({ status: "idle" }); setConsent(false); setClaudeConsent(false); setSolAgentsConsent(false);
      setMethod("phone"); setRegion(""); setCountryMissing(false);
      setPrivateHandling(false); setTaskForPreview("");
      setFootage(null); setFootageError(null); setCaptureReceived(false);
      setResetVersion(value => value + 1);
      // A completion is visible only after both stores commit the fresh authority.
      setClearStatus("done");
    } catch {
      if (active.current) { setStorageAvailable(false); setClearStatus("failed"); }
    } finally { operationInFlight.current = false; }
  }
  // Whether the phone handoff below is worth anything here. This form is
  // filled in from whatever device is at hand, including the phone that is
  // about to do the filming -- and a code pointing a phone at itself is not a
  // handoff, it is noise in front of the button that already works.
  const onAPhone = isLikelyPhone();

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const retained = recovery.current.pending;
    if (recoveryUnavailable || operationInFlight.current || state.status === "working" || loading
      || (!retained && footageWanted && !consent)
      || (!retained && claudeAuthoringRequested && !claudeConsent)
      || (!retained && solAgentsRequested && !solAgentsConsent)) return;
    // The address has to say which country it is in. The country decides whether
    // we may collect footage at all, so we do not guess it.
    if (!retained && !region) {
      setCountryMissing(true);
      document.querySelector<HTMLInputElement>("#start-location")?.focus();
      return;
    }
    if (!retained && footageWanted && !footage) return;

    const data = new FormData(formRef.current!);
    const operationRecovery = recovery.current;
    let savedAnswers = retained ? JSON.parse(retained.body) as Record<string, unknown> : null;
    const savedFields: Record<string, string> = { startTask: "taskStatement", startLocation: "siteLocation", startEmail: "email", startCompany: "company" };
    const read = (key: string) => String(savedAnswers ? savedAnswers[savedFields[key]] ?? "" : data.get(key) ?? "").trim();
    let email = currentUser?.email || read("startEmail");
    const location = read("startLocation");
    if (!retained && !read("startTask") && !(consent && rightsShown)) {
      setState({ status: "failed", message: footageWanted ? "Add a video or a short explanation of the work." : "Add a short explanation of the work to start." });
      return;
    }

    operationInFlight.current = true;
    setState({ status: "working" });

    try {
      const headers = await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" }));
      let body = retained?.body ?? JSON.stringify({
          requestId: operationRecovery.requestId,
          retryToken: operationRecovery.retryToken,
          // No name field: emails open without one.
          firstName: "",
          lastName: "",
          email: email.toLowerCase(),
          company: read("startCompany"),
          roleTitle: "Site operator",
          buyerType: "site_operator",
          // No account: the capture link is the credential. Terms and Privacy
          // are accepted by starting, next to the button, and the server
          // records the versions it holds rather than trusting this flag alone.
          accountSignup: false,
          acceptedTerms: true,
          requestedLanes: [],
          siteName: location,
          siteLocation: location,
          taskStatement: read("startTask"),
          taskDescription: read("startTask"),
          ...(!privateHandling ? { publicTaskListing: { consent: true, statementVersion: "public-task-card-v1", details: anonymizedOpportunityDraft(read("startTask")) } } : {}),
          // Deliberately empty. The screen used to live here; it now happens
          // with the footage rather than in front of it.
          siteTaskGates: {},
          siteTaskSpec: {},
          // Someone who already has the video is not asking for a visit.
          captureMode: hasFootage || selfRecording ? "self_capture" : "site_visit",
          captureRegion: region,
          hasExistingFootage: footageWanted,
          // The grant, not just the ticked box: recorded server-side with the
          // sentence version, or the submission is refused.
          descriptionOnly: !(consent && rightsShown),
          // Granted by starting: the statement is quoted verbatim next to the
          // button, like the Terms, and recorded with its version.
          descriptionAuthority: {
            granted: true,
            statementVersion: DESCRIPTION_AUTHORITY_VERSION,
          },
          consentAttestation: consent && rightsShown ? {
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
      if (!active.current) return;
      // Unknown type (the lookup is still in flight or failed) still tries the
      // workspace first; a refusal falls back with the same answers intact.
      let savedToWorkspace = retained ? retained.endpoint === "/api/workspace/capture-start"
        : Boolean(currentUser) && workspaceType !== null && workspaceType !== "robot_team";
      let endpoint: "/api/workspace/capture-start" | "/api/inbound-request" = savedToWorkspace ? "/api/workspace/capture-start" : "/api/inbound-request";
      let frozen;
      try {
        frozen = await freezeSiteCaptureRecovery(storageKey, {...operationRecovery, pending:{body,endpoint,acknowledged:false}}, () => active.current);
      } catch (error) {
        setStorageAvailable(false);
        setState({status:"failed",message:error instanceof Error ? error.message : "This browser cannot safely retain your submission. No job was submitted."});
        return;
      }
      if (!active.current) return;
      const recoveredSubmission = Boolean(retained) || frozen.adopted;
      adoptRecovery(frozen.value, frozen.adopted);
      body = frozen.value.pending!.body; endpoint = frozen.value.pending!.endpoint;
      savedAnswers = JSON.parse(body); email = String(savedAnswers!.email ?? "");
      savedToWorkspace = endpoint === "/api/workspace/capture-start";
      const submissionRegion = frozen.value.draft.region;
      const submissionFootageWanted = frozen.value.draft.method === "upload" && submissionRegion !== "non_us";
      const post = (url: string) => fetch(url, { method: "POST", credentials: "include", headers, body });
      let response = await post(endpoint);
      if (!active.current) return;
      if (savedToWorkspace && response.status === 403) {
        savedToWorkspace = false;
        const fallbackSaved = await retain({ ...frozen.value, pending: { body, endpoint: "/api/inbound-request", acknowledged: false } });
        if (!fallbackSaved) {setState({status:"failed",message:"This draft changed in another tab. Reload and review the current draft before starting."});return;}
        setPending(recovery.current.pending);
        response = await post("/api/inbound-request");
        if (!active.current) return;
      }

      const result = (await response.json().catch(() => ({}))) as {
        captureUrl?: string | null;
        message?: string;
        error?: string;
      };

      if (!active.current) return;
      if (!response.ok) {
        // Definitive validation refusal can be corrected. Uncertain 5xx/429
        // responses retain the original identity and exact accepted authority.
        if ([400, 401, 403, 422].includes(response.status)) {
          await retain({ ...frozen.value, pending: null }, body); setPending(recovery.current.pending);
        }
        analyticsEvents.contactFormError("capture_start");
        setState({
          status: "failed",
          message:
            (typeof result.message === "string" && result.message.trim() ? result.message.slice(0, 1000) : null)
            || (typeof result.error === "string" && result.error.trim() ? result.error.slice(0, 1000) : null)
            || "We could not save that. Please try again, or email hello@tryblueprint.io.",
        });
        return;
      }

      const acknowledgementSaved = await retain({ ...frozen.value, pending: { ...recovery.current.pending!, acknowledged: true } });
      if (!active.current) return;
      if (!acknowledgementSaved) {
        setState({status: "failed", message: "Your job may already be saved, but this browser could not retain its confirmation. Recover the same job here or use your emailed private link before sending the video."});
        return;
      }
      setPending(recovery.current.pending);
      analyticsEvents.contactFormSubmit("capture_start");
      // The screening form lower on the page shares this storage: nobody
      // types their identity twice on one page.
      try {
        window.sessionStorage.setItem(
          CONTACT_IDENTITY_STORAGE_KEY,
          JSON.stringify({
            name: "",
            email,
            company: read("startCompany"),
          }),
        );
      } catch {
        // Storage can be full or blocked; the forms still work untied.
      }

      const captureUrl = typeof result.captureUrl === "string" ? result.captureUrl : null;
      const regionApproved = isApprovedCaptureRegion(submissionRegion);

      // The job is saved; now the video, through the same token route the
      // capture page uses. A failure here never loses the submission: the
      // success screen offers the link to send it again.
      let uploaded: "none" | VideoUploadResult["status"] = "none";
      let uploadMessage: string | null = null;
      let processingRetryAvailable = false;
      const captureToken = captureUrl ? captureTokenFromUrl(captureUrl) : null;
      if (!recoveredSubmission && submissionFootageWanted && footage && regionApproved && captureToken) {
        setUploadPercent(0);
        const outcome = await uploadSelfCaptureVideo(captureToken, footage, setUploadPercent);
        uploaded = outcome.status;
        uploadMessage = outcome.status === "done" ? null : outcome.message;
        processingRetryAvailable = outcome.status === "processing_pending" && outcome.processingRetryAvailable;
        if (outcome.status !== "failed") setCaptureReceived(true);
      }

      if (!active.current) return;
      if (recoveredSubmission && submissionFootageWanted) {
        uploaded = "failed";
        uploadMessage = "Check the saved video's status on your job page. If it was interrupted, select your original video there.";
      }
      setState({
        status: "done",
        workspaceUrl: savedToWorkspace ? `/app/tasks/${requestId.current}` : null,
        linkOnlyNote: currentUser && !savedToWorkspace
          ? `This account is not a site workspace, so this site is saved to the link we email ${email}. You can claim it from that link later.`
          : null,
        captureUrl,
        selfRecording: frozen.value.draft.method !== "visit",
        email,
        regionApproved,
        hasFootage: submissionFootageWanted,
        uploaded,
        uploadMessage,
        processingRetryAvailable,
      });
      if (recoveredSubmission && captureUrl) void refreshReceivedVideo(captureUrl);
    } catch {
      if (!active.current) return;
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
        <ClearDraftControl status={clearStatus} onClear={forgetDraft} />
        <p className="ms-field-hint">Clearing this browser does not delete your saved job. Keep your private link to return.</p>
        {state.workspaceUrl && <p><a className="ms-text-link" href={state.workspaceUrl}>Saved in your workspace</a></p>}
        {state.linkOnlyNote && <p className="ms-field-hint">{state.linkOnlyNote}</p>}
        {!state.hasFootage && state.captureUrl && !captureReceived ? (
          <>
            <h2 style={{ marginTop: 0 }}>Your job description is saved.</h2>
            <p className="ms-field-hint">Blueprint is preparing the useful next step from what you supplied. Your summary is available for optional corrections; add footage only when it resolves a missing fact and you have permission.</p>
            <p><a className="ms-button ms-button-large" href={state.captureUrl}>Open your job and assessment</a></p>
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
              Your job page shows what we found and the next step. Correct the prefilled summary only where it matters; there is no required confirmation before viewing value.
            </p>
            <p style={{ marginTop: "20px" }}>
              <a className="ms-button ms-button-large" href={state.captureUrl}>Open your job and assessment</a>
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
    <form key={resetVersion} ref={formRef} className="ms-form" method="post" onSubmit={submit} onChange={() => { if (clearStatus !== "working") setClearStatus("idle"); retainDraft(); }} aria-label="Start a site capture">
      {pending && state.status !== "working" && <div aria-live="polite">
        <p className="ms-field-hint">{pending.acknowledged ? "Your job is saved. Return to the same job to check its current status." : "This submission may already be saved. Recover the same job before starting another."}</p>
        <button type="button" className="ms-button" disabled={!interactive || loading} onClick={() => void submit()}>
          {pending.acknowledged ? "Return to saved job" : "Recover saved job"}
        </button>
        <p className="ms-field-hint">Job reference: {requestId.current}</p>
      </div>}
      {state.status === "failed" && pending && <p role="alert">{state.message}</p>}
      {recoveryUnavailable && <p role="status" className="ms-field-hint">Saved recovery details expired or could not be read. Use your emailed private job link to return, or clear this browser's draft to start again.</p>}
      {!storageAvailable && <p role="status" className="ms-field-hint">This browser cannot safely save or coordinate recovery details. Use a supported browser with local storage enabled, or email hello@tryblueprint.io for help starting your job. If your job is already saved, use its private link to return.</p>}
      <ClearDraftControl status={clearStatus} onClear={forgetDraft} disabled={state.status === "working"} />
      <fieldset disabled={!interactive || clearStatus === "working" || recoveryUnavailable || Boolean(pending)} className="contents">
      <label htmlFor="start-task">
        <span>Anything we should know? (optional)</span>
        <span className="ms-field-hint">
          Show us the work; we'll assess the observed task. Add context or what you want to achieve if helpful. We'll ask only when a missing answer changes the recommendation.
        </span>
        <textarea id="start-task" name="startTask" defaultValue={recovery.current.draft.task} onChange={event => setTaskForPreview(event.target.value)} maxLength={2000} rows={4} />
      </label>

      <div aria-label="Opportunity sharing">
        <p>{privateHandling ? "This job will be handled privately; starting does not authorize a public listing. Blueprint uses the supplied information for your job assessment." : "Blueprint will create an anonymized opportunity listing so robot teams approved for beta can discover this job. By starting, you authorize publication of the generated summary below. Footage, reconstruction, exact location, contacts and sensitive operating details remain restricted."}</p>
        <p aria-label="Generated public summary"><strong>{publicDraft.title}</strong> · {publicDraft.taskFamily}{publicDraft.objects ? ` · ${publicDraft.objects}` : ""}. Requirements not supplied or approved for sharing remain unknown.</p>
        <label className="ms-check-row"><input name="startPrivateHandling" type="checkbox" checked={privateHandling} onChange={event => setPrivateHandling(event.target.checked)} />Keep this job private instead</label>
      </div>

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

      <fieldset className="ms-choice">
        <legend>How will we see the task?</legend>
        {([
          ["upload", "Upload a video now"],
          ["phone", "Film it later on a phone"],
          ["visit", "Have Blueprint film it"],
        ] as const).map(([value, label]) => (
          <label key={value} htmlFor={`start-method-${value}`} className="ms-check-row">
            <input id={`start-method-${value}`} type="radio" name="startMethod" value={value}
              checked={method === value}
              onChange={() => {
                setMethod(value);
                if (value !== "upload") { setFootage(null); setFootageError(null); setConsent(false); }
              }} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

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
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        <label htmlFor="start-location">
          <span>Where would the robot do this task?</span>
          {!(selfRecording || hasFootage) && (
            <span className="ms-field-hint">We are sending someone to film it, so we need the street address.</span>
          )}
          <LocationAutocomplete
            id="start-location"
            name="startLocation"
            defaultValue={recovery.current.draft.location}
            required
            maxLength={300}
            placeholder={selfRecording || hasFootage ? "City or address" : "Street address"}
            onSelectionChange={(place) => {
              setCountryMissing(false);
              setRegion(place?.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "");
            }}
            onInputChange={(text) => {
              setCountryMissing(false);
              const country = inferLocationCountryCode(text);
              setRegion(country ? (country === "US" ? "us" : "non_us") : "");
            }}
          />
        </label>

        {countryMissing && !region && (
          <p className="ms-error" role="alert" style={{ margin: 0 }}>
            Add the country to the address, for example Sacramento, California, United States.
          </p>
        )}

        {region === "non_us" && (
          <p className="ms-field-hint" style={{ margin: 0 }}>{captureRegionNotice}</p>
        )}
      </div>

      {!currentUser && <>
      <label htmlFor="start-email">
        <span>Work email</span>
        <span className="ms-field-hint">
          Where we send your task link to add footage, follow progress and review the brief.
        </span>
        <input id="start-email" name="startEmail" type="email" defaultValue={recovery.current.draft.email} required maxLength={320} />
      </label>

      <label htmlFor="start-company">
        <span>Company</span>
        <input id="start-company" name="startCompany" type="text" defaultValue={recovery.current.draft.company} required autoComplete="organization" maxLength={200} />
      </label>

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

      {/* Rights are asked only where footage is uploaded now: the upload cannot
          go ahead without them. Otherwise the site confirms later, from the task link. */}
      {footageWanted && (
        <label htmlFor="start-rights" className="ms-check-row" style={{ alignItems: "flex-start" }}>
          <input
            id="start-rights"
            name="startRights"
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            style={{ marginTop: "4px" }}
          />
          <span style={{ fontWeight: 400 }}>
            I am authorized to record this site and to let Blueprint use the recording to build a
            scene robot teams can evaluate against. Robot teams never receive the original video.{" "}
            <a href={PRIVACY_URL}>How we handle footage</a>.
          </span>
        </label>
      )}

      {state.status === "failed" && !pending && <>
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>{state.message}</p>
        <p className="ms-field-hint">Job reference: {requestId.current}</p>
      </>}

      <p className="ms-form-note">
        Initial assessment is free for invited beta participants. <a href="/beta#scope">Later scope and cost are agreed separately</a>. By selecting Start free assessment,
        you agree to our <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> and{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> and confirm: “{DESCRIPTION_AUTHORITY_STATEMENT}”
      </p>

      <button className="ms-button ms-button-large" type="submit" disabled={!interactive || state.status === "working" || clearStatus === "working" || loading}>
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
