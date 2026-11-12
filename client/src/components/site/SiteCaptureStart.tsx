import { isLikelyPhone } from "@/lib/device";
/** Show the work; explanatory text is optional when capture is authorized. */
import { useEffect, useRef, useState } from "react";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { CaptureLiveStatus } from "@/components/site/CaptureLiveStatus";
import { LocationAutocomplete, type ChosenPlace } from "@/components/site/LocationAutocomplete";
import {
  captureRegionHeldNotice,
  captureRegionNotice,
  isApprovedCaptureRegion,
  type CaptureRegion,
} from "@/data/captureResidency";
import { analyticsEvents } from "@/lib/analytics";
import { checkEmail, EMAIL_HINT_SENTENCES, EMAIL_REFUSAL_SENTENCES, isEmailRefusal } from "@/lib/emailAddress";
import { withCsrfHeader } from "@/lib/csrf";
import { withAppCheckHeader } from "@/lib/appCheck";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import { FILMING_NOTICE, FOOTAGE_UPLOAD_NOTICE } from "@/lib/footageNotice";
import { DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION, DESCRIPTION_AUTHORITY_STATEMENT, DESCRIPTION_AUTHORITY_VERSION, DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION } from "@/lib/siteSubmissionAuthority";
import { RECORDING_RIGHTS_STATEMENT, RECORDING_RIGHTS_STATEMENT_V4_VERSION, RECORDING_RIGHTS_STATEMENT_VERSION } from "@/lib/recordingRightsStatement";
import { TASK_CONFIRMATION_STATEMENT, TASK_CONFIRMATION_VERSION } from "@/lib/taskConfirmationStatement";
import { AGREEING_ALSO_LINE, SITE_START_CONSENT_NO_VIDEO_V5, SITE_START_CONSENT_WITH_VIDEO_V4, START_FORM_SHORT_CONSENT } from "@/lib/siteStartConsent";
import { BareBack, BareButton, BareGroup, BareLabel, BareLinks, BareNotice, BareScreen, BareTicks } from "@/components/bare/Bare";
import { BareCheck, BareField, BareFile, BareInput, BareProgress, BareSelect, BareSubmit, BareTextarea, describedBy,
  useFocusHeading, useHashScreen } from "@/components/bare/BareForm";
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

const CONTACT_IDENTITY_STORAGE_KEY = "bp-contact-identity";

type State =
  | { status: "idle" }
  | { status: "working" }
  | {
      status: "done";
      captureUrl: string | null;
      claimUrl: string | null;
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
  // `reference: false` for a refusal the site fixes itself, which shows no job reference (a support handle).
  | { status: "failed"; message: string; reference?: false };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}


type ClearStatus = "idle" | "working" | "done" | "failed";
function ClearDraftControl({status,onClear,disabled=false}:{status:ClearStatus;onClear:()=>void;disabled?:boolean}) {
  return <>
    <button type="button" className="bare-inline-link" disabled={disabled || status === "working"} onClick={onClear}>
      {status === "working" ? "Clearing…" : "Clear this browser's draft"}
    </button>
    {status === "working" && <p role="status" className="bare-helper">Clearing this browser's draft. Wait for confirmation before leaving this page.</p>}
    {status === "done" && <p role="status" className="bare-helper">This browser's draft has been cleared.</p>}
    {status === "failed" && <p role="alert" className="bare-helper">We could not confirm that this browser's draft was cleared. Stay on this page and try again before leaving a shared device.</p>}
  </>;
}

type RestorableDraft = { location?: string; region: CaptureRegion | ""; regionManuallySet: boolean; regionFromPlace?: string };
/**
 * The place label a restored country came from, when the draft's address still reads exactly that label: the country
 * was taken from a chosen suggestion or "Use my location" and the text has not been edited since. Typed text never
 * carries one, and an older draft (no label) cannot tell a place's country from a guess, so it has none.
 */
const restoredPlace = (draft: RestorableDraft) =>
  !draft.regionManuallySet && draft.region && draft.regionFromPlace && draft.regionFromPlace === draft.location ? draft.regionFromPlace : null;
const restoredRegion = (draft: RestorableDraft) => (draft.regionManuallySet || restoredPlace(draft) ? draft.region : "");
const restoredCountryAsked = (draft: { location?: string; regionManuallySet: boolean }) =>
  Boolean(draft.regionManuallySet) || Boolean(draft.location?.trim());

const VIDEO_MISSING = "Choose the video of the job, or film it next.";

export const STATEMENTS_CHANGED = "The wording on this form has changed since you last pressed the button. Read it, then press the button again.";

/**
 * Whether a saved submission carries the statement versions this form sends now, for the kind of job it is (with a
 * video or without). `shortConsent` is the switch position (`START_FORM_SHORT_CONSENT`).
 */
export function pendingStatementsCurrent(body: string, shortConsent: boolean = START_FORM_SHORT_CONSENT): boolean {
  try {
    const sent = JSON.parse(body) as { descriptionOnly?: unknown; descriptionAuthority?: { statementVersion?: unknown };
      consentAttestation?: { statementVersion?: unknown } | null };
    const withVideo = sent.descriptionOnly === false;
    const description = !shortConsent ? DESCRIPTION_AUTHORITY_VERSION
      : withVideo ? DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION : DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION;
    const recording = withVideo ? (shortConsent ? RECORDING_RIGHTS_STATEMENT_V4_VERSION : RECORDING_RIGHTS_STATEMENT_VERSION) : null;
    return sent.descriptionAuthority?.statementVersion === description && (sent.consentAttestation?.statementVersion ?? null) === recording;
  } catch {
    return false;
  }
}

export function SiteCaptureStart({ onSavedChange }: { onSavedChange?: (saved: boolean) => void } = {}) {
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
  useEffect(() => {
    if (loading || !hydrated?.ready || hydrated.key !== storageKey) onSavedChange?.(false);
  }, [loading, hydrated, storageKey, onSavedChange]);
  if (loading || !storageKey || hydrated?.key !== storageKey) return <BareScreen><h1>Start a job</h1><p role="status">Loading your account and saved draft…</p></BareScreen>;
  if (!hydrated.ready) return <BareScreen><h1>Start a job</h1><div className="ms-form">
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
    <p className="bare-helper">Clearing removes only this device's recovery. It does not cancel or delete a saved job.</p>
    <BareLinks links={[{ key: "person", label: "Talk to a person", href: "mailto:hello@tryblueprint.io" }]} />
  </div></BareScreen>;
  // Identity changes discard later UI updates and prevent starting another upload.
  return <SiteCaptureStartForm key={storageKey} storageKey={storageKey} cleared={clearStatus === "done"} onSavedChange={onSavedChange} />;
}

function SiteCaptureStartForm({ storageKey, cleared = false, onSavedChange }: { storageKey: string | null; cleared?: boolean; onSavedChange?: (saved: boolean) => void }) {
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
  // An account with no workspace type yet becomes a site workspace by
  // submitting this form, unless it carries a legacy role.
  const [siteSetupAvailable, setSiteSetupAvailable] = useState(false);
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/workspace/setup", {
          credentials: "include",
          headers: await withFirebaseAuthHeaders(currentUser),
        });
        const data = (await response.json().catch(() => ({}))) as { workspaceType?: string | null; siteSetupAvailable?: boolean };
        if (!cancelled) {
          setWorkspaceType(response.ok ? data.workspaceType ?? null : null);
          setSiteSetupAvailable(response.ok && data.siteSetupAvailable === true);
        }
      } catch {
        if (!cancelled) setWorkspaceType(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);
  const siteWorkspace = Boolean(currentUser)
    && (workspaceType === "site_operator" || (workspaceType === null && siteSetupAvailable));
  // The phone's recording has landed on the server. The laptop then stops
  // being a handoff and becomes the place to do the next step.
  const [captureReceived, setCaptureReceived] = useState(false);
  const requestId = useRef(initial.requestId);
  // Separate from the public record identifier: only this form can recover
  // the capture link if the server saved the job but its response was lost.
  const retryToken = useRef(initial.retryToken);
  const [state, setState] = useState<State>({ status: "idle" });
  useEffect(() => {
    onSavedChange?.(state.status === "done" || Boolean(pending?.acknowledged));
    return () => onSavedChange?.(false);
  }, [state.status, pending?.acknowledged, onSavedChange]);
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
  // One question decides how the site sends its own video: an upload now, or
  // its own phone right after the form. Blueprint filming visits are retired
  // (owner, 2026-11-11), so a draft saved with "visit" reopens as "phone".
  const [method, setMethod] = useState<"upload" | "phone">(initial.draft.method === "visit" ? "phone" : initial.draft.method);
  const selfRecording = method === "phone";
  // A restored draft keeps a country the person chose in the select, or one a place gave while its address is unedited
  // (`restoredPlace`). Anything else is asked for again: an older draft may hold a guess from typed text.
  const [region, setRegion] = useState<CaptureRegion | "">(restoredRegion(initial.draft));
  const [regionManuallySet, setRegionManuallySet] = useState(initial.draft.regionManuallySet);
  // The label of the place whose country `region` holds, saved with the draft so a reload can keep it.
  const [regionPlace, setRegionPlace] = useState<string | null>(restoredPlace(initial.draft));
  // Recording permission needs a country, not a street address. An explicit
  // country can stand alone; changing the address rechecks that declaration.
  const [countryMissing, setCountryMissing] = useState(false);
  // The form asks where the job is and takes the country from the place chosen (owner, 2026-11-11). The country select
  // is asked for only when it is needed: typed text with no chosen place, or a press of the button with no country.
  // Once asked it stays, so a person can change it. A recovered draft that chose one shows it.
  const [countryAsked, setCountryAsked] = useState(restoredCountryAsked(initial.draft));
  // Why we cannot send to the typed email, said under the field (checked here first, then by the server).
  const [emailError, setEmailError] = useState<string | null>(null);
  // An address we accept but that is likely mistyped (a Gmail name of an unusual length): said in the helper's place,
  // never blocking. Shown when the person leaves the field or presses the button.
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const hintFor = (value: string) => { const checked = checkEmail(value); return checked.ok && checked.hint ? EMAIL_HINT_SENTENCES[checked.hint] : null; };
  // The optional details and the full statements are their own screens, in the URL's hash (the job page's pattern).
  // "What you're agreeing to" is a screen only while the short consent line is shown; otherwise its hash is unknown
  // and falls back to the form, never a blank screen.
  const subScreens = useRef(START_FORM_SHORT_CONSENT ? ["details", "agreeing"] as const : ["details"] as const).current;
  const { screen, open: openScreen, close: closeScreen } = useHashScreen(subScreens);
  const headingRef = useFocusHeading(screen);
  // Asked because it changes what we say next, not to route them into a
  // different funnel. Existing footage gets assessed for both purposes -- does
  // it explain the job, does it cover the scene -- and reused wherever it can be.
  // When it is ticked the video is attached right here, so the form is the
  // whole submission rather than a step before another upload page.
  const hasFootage = method === "upload";
  // The signed job link and server-bound source identity let a guest upload
  // immediately. Saving to an account remains available after the job exists.
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
  const [claudeConsent, setClaudeConsent] = useState(false);
  const [solAgentsConsent, setSolAgentsConsent] = useState(false);
  // Owner direction 2026-11-11: an email and a video start a job; the sentence
  // is optional and typing it is the confirmation. Sharing an anonymised card
  // is the site's explicit choice. Never retained: each submission chooses afresh.
  const formRef = useRef<HTMLFormElement>(null);
  function adoptRecovery(other: SiteCaptureRecovery, resetChanged = true) {
    const changed = recovery.current.requestId !== other.requestId
      || recovery.current.pending?.body !== other.pending?.body;
    recovery.current = other;
    requestId.current = other.requestId; retryToken.current = other.retryToken;
    setMethod(other.draft.method === "visit" ? "phone" : other.draft.method); setRegion(restoredRegion(other.draft));
    setRegionManuallySet(other.draft.regionManuallySet); setRegionPlace(restoredPlace(other.draft));
    setCountryAsked(restoredCountryAsked(other.draft));
    setPending(other.pending);
    if (changed && resetChanged) {
      setClaudeConsent(false); setSolAgentsConsent(false);
      setFootage(null); setResetVersion(value => value + 1);
    }
  }
  function retainDraft(place?: ChosenPlace) {
    if (!interactive || clearStatus === "working" || recoveryUnavailable || recovery.current.pending || !formRef.current) return;
    const data = new FormData(formRef.current);
    const field = (name: string) => String(data.get(name) ?? "");
    retain({ ...recovery.current, savedAt: Date.now(), draft: {
      task: field("startTask"), location: place ? place.label : field("startLocation"), email: field("startEmail"),
      ...(field("startSuccess") ? { successDefinition: field("startSuccess") } : {}),
      ...(recovery.current.draft.company !== undefined ? { company: recovery.current.draft.company } : {}),
      ...(field("startFrequency") ? { jobFrequency: field("startFrequency") } : {}),
      ...(field("startReadiness") ? { purchaseReadiness: field("startReadiness") as SiteCaptureRecovery["draft"]["purchaseReadiness"] } : {}),
      method, region: place ? (place.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "") : region,
      regionManuallySet: place ? false : regionManuallySet,
      ...((place ? (place.countryCode ? place.label : null) : regionManuallySet ? null : regionPlace) ? {
        regionFromPlace: place ? place.label : regionPlace! } : {}),
    } });
  }
  useEffect(() => { retainDraft(); }, [interactive, method, region, regionManuallySet, regionPlace]);
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
      setRecoveryUnavailable(false); setPending(null); setState({ status: "idle" }); setEmailError(null); setEmailHint(null); setClaudeConsent(false); setSolAgentsConsent(false);
      setMethod("phone"); setRegion(""); setRegionManuallySet(false); setRegionPlace(null); setCountryMissing(false); setCountryAsked(false);
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
    // A saved submission the server has not acknowledged is resent byte for byte only under the statements the form
    // shows now. One recorded under other statements is not sent: the person reads the current ones and presses again.
    // A submission the server already acknowledged was accepted under the statements shown then: it goes to its saved
    // job exactly as before, never cleared or resent under this rule.
    if (recovery.current.pending && !recovery.current.pending.acknowledged && !pendingStatementsCurrent(recovery.current.pending.body)) {
      const stale = recovery.current.pending.body;
      await retain({ ...recovery.current, pending: null }, stale);
      setPending(null);
      setState({ status: "failed", message: STATEMENTS_CHANGED, reference: false });
      return;
    }
    const retained = recovery.current.pending;
    if (recoveryUnavailable || operationInFlight.current || state.status === "working" || loading
      || (!retained && claudeAuthoringRequested && !claudeConsent)
      || (!retained && solAgentsRequested && !solAgentsConsent)) return;
    // Keep the existing capture-region permission without requiring an address
    // from someone who is supplying their own recording. Never guess a country.
    // The email is checked here with the server's own rule, so an address we cannot send to never creates a request.
    const typedEmail = !retained && !currentUser ? checkEmail(String(new FormData(formRef.current!).get("startEmail") ?? "")) : null;
    const emailRefusal = typedEmail && !typedEmail.ok ? typedEmail.reason : null;
    if (typedEmail) setEmailHint(typedEmail.ok && typedEmail.hint ? EMAIL_HINT_SENTENCES[typedEmail.hint] : null);
    // The form does every check itself (`noValidate`: no browser bubble), each said under its own field, and focus
    // goes to the first field to fix, in page order: the video, the country, the email.
    const videoMissing = !retained && footageWanted && !footage;
    if (!retained && (!region || emailRefusal || videoMissing)) {
      if (!region) { setCountryMissing(true); setCountryAsked(true); }
      setEmailError(emailRefusal ? EMAIL_REFUSAL_SENTENCES[emailRefusal] : null);
      if (videoMissing) setFootageError(VIDEO_MISSING);
      if (state.status === "failed") setState({ status: "idle" });
      window.setTimeout(() => document.querySelector<HTMLElement>(videoMissing ? "#start-footage" : !region ? "#start-region" : "#start-email")?.focus(), 0);
      return;
    }
    setEmailError(null);
    // No typed task is required on any path: the server accepts a job with no
    // description under the description authority (film later) or
    // the recording grant (a video attached now), and drafts it from the video.
    if (!retained && footageWanted && !footage) return;

    const data = new FormData(formRef.current!);
    const operationRecovery = recovery.current;
    let savedAnswers = retained ? JSON.parse(retained.body) as Record<string, unknown> : null;
    const savedFields: Record<string, string> = { startTask: "taskStatement", startLocation: "siteLocation", startEmail: "email" };
    const read = (key: string) => String(savedAnswers ? savedAnswers[savedFields[key]] ?? "" : data.get(key) ?? "").trim();
    let email = currentUser?.email || read("startEmail");
    const location = read("startLocation");
    operationInFlight.current = true;
    setState({ status: "working" });

    try {
      const owner = currentUser;
      const headers = await withAppCheckHeader(await withFirebaseAuthHeaders(owner, await withCsrfHeader({ "Content-Type": "application/json" })));
      let body = retained?.body ?? JSON.stringify({
          requestId: operationRecovery.requestId,
          retryToken: operationRecovery.retryToken,
          // No name field: emails open without one.
          firstName: "",
          lastName: "",
          email: email.toLowerCase(),
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
          // Typing the task in the site's own words is the brief's confirmation
          // (what the removed box sent). No sentence, no confirmation: the
          // brief is drafted from the video and the site confirms it later.
          ...(read("startTask") ? { taskConfirmation: { granted: true, statementVersion: TASK_CONFIRMATION_VERSION } } : {}),
          ...(read("startSuccess") ? { successCriteria: { successDefinition: read("startSuccess") } } : {}),
          // Sharing is the service (2026-11-12): no share box. The job is shared with approved deployment companies
          // because recording statement v4, the line under the button, says so; the server writes the listing record.
          // Screening happens after the first submission. Buying context is
          // optional and cannot turn into a gate or a spending authorization.
          siteTaskGates: {},
          siteTaskSpec: {
            ...(String(data.get("startFrequency") ?? "").trim() ? { jobFrequency: String(data.get("startFrequency")).trim() } : {}),
            ...(String(data.get("startReadiness") ?? "").trim() ? { purchaseReadiness: String(data.get("startReadiness")).trim() } : {}),
          },
          // The site films its own job: the only capture path (owner, 2026-11-11).
          captureMode: "self_capture",
          captureRegion: region,
          hasExistingFootage: footageWanted,
          // This flag records that filming permission has not been granted
          // yet. Preparing a capture link does not start an assessment.
          descriptionOnly: !footageWanted,
          // Granted by starting: each statement is quoted verbatim next to the
          // button, like the Terms, and recorded with its version.
          // Granted by starting, under the one line the site reads under the button
          // (SITE_START_CONSENT_*); the full statements are one tap away, word for word.
          descriptionAuthority: {
            granted: true,
            statementVersion: !START_FORM_SHORT_CONSENT ? DESCRIPTION_AUTHORITY_VERSION
              : footageWanted ? DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION : DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION,
          },
          consentAttestation: footageWanted ? {
            granted: true,
            statementVersion: START_FORM_SHORT_CONSENT ? RECORDING_RIGHTS_STATEMENT_V4_VERSION : RECORDING_RIGHTS_STATEMENT_VERSION,
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
        : siteWorkspace || (Boolean(currentUser) && workspaceType !== null && workspaceType !== "robot_team");
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
        claimUrl?: string | null;
        message?: string;
        error?: string;
        field?: unknown;
        code?: unknown;
      };

      if (!active.current) return;
      if (!response.ok) {
        // Definitive validation refusal can be corrected. Uncertain 5xx/429
        // responses retain the original identity and exact accepted authority.
        if ([400, 401, 403, 422].includes(response.status)) {
          await retain({ ...frozen.value, pending: null }, body); setPending(recovery.current.pending);
        }
        analyticsEvents.contactFormError("capture_start");
        // An email the server cannot send to: the sentence goes under the email field, which takes focus. The site
        // fixes it there, so no job reference is shown.
        if (result.field === "email" && isEmailRefusal(result.code) && !currentUser && [400, 422].includes(response.status)) {
          setEmailError(EMAIL_REFUSAL_SENTENCES[result.code]);
          setState({ status: "idle" });
          window.setTimeout(() => document.querySelector<HTMLElement>("#start-email")?.focus(), 0);
          return;
        }
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
      // Both guest and account jobs already have a stable server-bound owner.
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
        workspaceUrl: savedToWorkspace ? "/app" : null,
        linkOnlyNote: currentUser && !savedToWorkspace
          ? `This account is not a site workspace, so this site is saved to the link we email ${email}. You can claim it from that link later.`
          : null,
        captureUrl,
        claimUrl: typeof result.claimUrl === "string" && /^\/claim\/[A-Za-z0-9_.-]+$/.test(result.claimUrl) ? result.claimUrl : null,
        selfRecording: true,
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

  const savedLinks = (done: Extract<State, { status: "done" }>) => <>
    {done.workspaceUrl && <p className="bare-helper"><a href={done.workspaceUrl}>Saved in your workspace</a></p>}
    {done.linkOnlyNote && <p className="bare-helper">{done.linkOnlyNote}</p>}
    <BareLinks links={!done.workspaceUrl && done.claimUrl ? [{ key: "account", label: "Save to an account", href: done.claimUrl }] : []} />
    <div className="bare-group">
      <ClearDraftControl status={clearStatus} onClear={forgetDraft} />
    </div>
  </>;
  const keepLink = (to: string) => `We also emailed this private link to ${to}. Please don't forward it.`;

  if (state.status === "done") {
    const done = state;
    if (!done.regionApproved) return (
      <BareScreen>
        <div aria-live="polite">
          <BareGroup><BareLabel>Saved</BareLabel><h1>We have your site.</h1></BareGroup>
          <BareGroup>
            <BareNotice>{captureRegionHeldNotice}</BareNotice>
            <p>We will reply to {done.email}. If you already have video, please don't send it yet: we would have to delete it unread.</p>
          </BareGroup>
          {savedLinks(done)}
        </div>
      </BareScreen>
    );
    if (done.selfRecording && done.captureUrl && captureReceived) return (
      <BareScreen>
        <div aria-live="polite" className="ms-intake-confirmation">
          <BareGroup><BareLabel>Sent</BareLabel><h1>We have your video.</h1></BareGroup>
          <BareGroup>
            <BareTicks label="Done" items={[
              { key: "job", state: "yes", text: "Job saved" },
              { key: "video", state: "yes", text: done.uploaded === "processing_pending" ? "Video saved" : "Video received" },
            ]} />
            {done.uploaded === "processing_pending"
              ? <p>Blueprint will continue from this saved recording and update your job. You can leave this page.</p>
              : <p>Next, we watch your video and email you.</p>}
            {done.uploaded !== "done" && done.uploaded !== "processing_pending" && done.uploadMessage && <p className="bare-helper">{done.uploadMessage}</p>}
            {done.uploaded === "processing_pending" && (done.uploadMessage || done.processingRetryAvailable) && (
              <details aria-label="Processing details">
                <summary className="bare-inline-link">Processing details (optional)</summary>
                {done.uploadMessage && <p className="bare-helper">{done.uploadMessage}</p>}
                {done.processingRetryAvailable && <button type="button" className="bare-inline-link" disabled={retryingProcessing} onClick={() => void retryProcessing()}>
                  {retryingProcessing ? "Retrying processing…" : "Retry processing"}
                </button>}
              </details>
            )}
            {done.uploaded === "done" && <CaptureLiveStatus compact captureUrl={done.captureUrl} />}
          </BareGroup>
          <BareGroup>
            <BareButton href={done.captureUrl} helper={keepLink(done.email)}>Open my job</BareButton>
          </BareGroup>
          {savedLinks(done)}
        </div>
      </BareScreen>
    );
    if (done.selfRecording && done.captureUrl) {
      const uploaderUrl = `${done.captureUrl}${done.captureUrl.includes("?") ? "&" : "?"}video=existing`;
      return (
        <BareScreen>
          <div aria-live="polite" className="ms-intake-confirmation">
            {done.uploaded === "failed" ? <>
              <BareGroup><BareLabel>Saved</BareLabel><h1>Your job is saved. Check your video upload.</h1></BareGroup>
              <BareGroup>
                <BareNotice role="alert">{`${done.uploadMessage ?? "We could not confirm the video upload."} Keep your original video and open your job page to check its status.`}</BareNotice>
              </BareGroup>
              <BareGroup>
                {footage
                  ? <BareButton onClick={() => void retrySelectedVideo()} disabled={retryingVideo} helper={keepLink(done.email)}>
                    {retryingVideo ? uploadPercent === null ? "Checking selected video…" : `Uploading video… ${uploadPercent}%` : "Try the selected video again"}
                  </BareButton>
                  : <BareButton href={uploaderUrl} helper={keepLink(done.email)}>Open the uploader</BareButton>}
              </BareGroup>
              {footage && <BareLinks links={[{ key: "uploader", label: "Open the uploader", href: uploaderUrl }]} />}
            </> : done.hasFootage ? <>
              <BareGroup><BareLabel>Saved</BareLabel><h1>Send us what you have.</h1></BareGroup>
              <BareGroup>
                <p>Upload the video you already have through your job page. If more of the work area is needed, you can send a new video on the same job. Your original video stays saved.</p>
              </BareGroup>
              <BareGroup>
                <BareButton href={uploaderUrl} helper={keepLink(done.email)}>Open the uploader</BareButton>
              </BareGroup>
              {!onAPhone && <details className="bare-group">
                <summary className="bare-inline-link">Open this job on another device (optional)</summary>
                <p className="bare-helper">Use this only if your video is on another device.</p>
                <CaptureHandoffQr url={uploaderUrl} label="Open this job on another device" />
              </details>}
            </> : <>
              <BareGroup><BareLabel>Saved</BareLabel><h1>Now film the job.</h1></BareGroup>
              <BareGroup>
                <p>One full round of the job, about 30 seconds. The recorder opens in your browser.</p>
                <BareNotice>{FILMING_NOTICE}</BareNotice>
              </BareGroup>
              <BareGroup>
                {onAPhone
                  ? <BareButton href={done.captureUrl} helper={keepLink(done.email)}>Open the camera</BareButton>
                  : <>
                    <CaptureHandoffQr url={done.captureUrl} label="Point your phone's camera at this code to film" />
                    <p className="bare-helper">{keepLink(done.email)}</p>
                  </>}
              </BareGroup>
              {!onAPhone && <BareLinks links={[{ key: "job", label: "Open my job page", href: done.captureUrl }]} />}
            </>}
            {/* The laptop, watching the phone through the server's own status rather than guessing. Renders nothing
                until there is something real to say, and never blocks the capture happening elsewhere. */}
            <CaptureLiveStatus compact captureUrl={done.captureUrl} onCaptureReceived={() => void refreshReceivedVideo(done.captureUrl!)} />
            {savedLinks(done)}
          </div>
        </BareScreen>
      );
    }
    return (
      <BareScreen>
        <div aria-live="polite">
          <BareGroup><BareLabel>Saved</BareLabel><h1>We have your site.</h1></BareGroup>
          <BareGroup><p>We will reply to {done.email} with the link to film or upload the video.</p></BareGroup>
          {savedLinks(done)}
        </div>
      </BareScreen>
    );
  }

  const sendsVideo = method === "upload" && region !== "non_us";
  const consentLine = sendsVideo ? SITE_START_CONSENT_WITH_VIDEO_V4 : SITE_START_CONSENT_NO_VIDEO_V5;
  const submitLabel = region === "non_us" ? "Save my job" : sendsVideo ? "Send video" : "Next: film the job";
  // The country select shows once asked (above), while the address has given no country or the person chose one.
  const showCountry = countryAsked && (!region || regionManuallySet);
  const busyLabel = uploadPercent !== null ? `Uploading video… ${uploadPercent}%` : "Working…";
  const consentWithLinks = (line: string) => {
    const [before, afterTerms] = line.split("Terms");
    const [middle, after] = afterTerms.split("Privacy Policy");
    return <>{before}<a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a>{middle}<a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>{after}</>;
  };

  return (
    <form key={resetVersion} ref={formRef} className="bare-start-form" method="post" noValidate onSubmit={submit} onChange={() => { if (clearStatus !== "working") setClearStatus("idle"); retainDraft(); }} aria-label="Start a site capture">
      <div hidden={screen !== "main"}>
        <BareScreen>
          <BareBack href="/" />
          {screen === "main" && <h1 ref={headingRef} tabIndex={-1}>Start a job</h1>}
          {pending && state.status !== "working" && <div className="bare-group" aria-live="polite">
            <BareNotice>{pending.acknowledged ? "Your job is saved. Return to the same job to check its current status." : "This submission may already be saved. Recover the same job before starting another."}</BareNotice>
            <BareButton onClick={() => void submit()} disabled={!interactive || loading}>
              {pending.acknowledged ? "Return to saved job" : "Recover saved job"}
            </BareButton>
            <p className="bare-helper">Job reference: {requestId.current}</p>
          </div>}
          {state.status === "failed" && pending && <p role="alert" className="bare-field-error">{state.message}</p>}
          {recoveryUnavailable && <p role="status" className="bare-helper">Saved recovery details expired or could not be read. Use your emailed private job link to return, or clear this browser's draft to start again.</p>}
          {!storageAvailable && <p role="status" className="bare-helper">This browser cannot safely save or coordinate recovery details. Use a supported browser with local storage enabled, or email hello@tryblueprint.io for help starting your job. If your job is already saved, use its private link to return.</p>}
          <fieldset disabled={!interactive || clearStatus === "working" || recoveryUnavailable || Boolean(pending)} className={pending?.acknowledged && state.status !== "working" ? "contents ms-intake-return-fields" : "contents"} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
          {claudeAuthoringRequested && (
            <BareCheck id="start-claude-authoring" name="startClaudeAuthoring" checked={claudeConsent} onChange={setClaudeConsent}>
              For this development test, I authorize Blueprint to send selected frames and task evidence
              from this recording to Anthropic for Claude Opus 5.5 3D authoring. Blueprint pays the
              bounded provider cost; this does not train a model on my recording. See Anthropic’s
              {" "}<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
                commercial API terms
              </a>.
            </BareCheck>
          )}
          {solAgentsRequested && (
            <BareCheck id="start-sol-agents-authoring" name="startSolAgentsAuthoring" checked={solAgentsConsent} onChange={setSolAgentsConsent}>
              For this development test, I authorize Blueprint to send selected frames and task evidence
              to OpenAI for GPT-6.1 Sol managed-agent 3D authoring. The agent session can retain that evidence
              until it is deleted under the configured provider policy. Blueprint pays the bounded provider cost.
            </BareCheck>
          )}

          {method === "upload" ? (
            <div className="bare-field">
              <span className="bare-label" id="start-footage-label">Video of the job</span>
              {region === "non_us" ? (
                <BareNotice>Hold on to the video for now. Outside the US we set up the data-transfer terms before anything is uploaded, and we will tell you when to send it.</BareNotice>
              ) : <>
                <BareFile id="start-footage" name="startFootage" accept={CAPTURE_VIDEO_ACCEPT} required
                  label="Choose a video" hint=".mov or .mp4" describedBy={describedBy("start-footage", { helper: true, error: footageError })}
                  chosen={footage ? `${footage.name} · ${formatBytes(footage.size)}` : null}
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
                  }} />
                <p className="bare-helper" id="start-footage-help">One full round of the job.</p>
                {footageError && <p role="alert" className="bare-field-error" id="start-footage-error">{footageError}</p>}
              </>}
              <button type="button" id="start-method-phone" className="bare-inline-link" onClick={() => { setMethod("phone"); setFootage(null); setFootageError(null); }}>No video yet? Film it next ›</button>
            </div>
          ) : (
            <div className="bare-field">
              <span className="bare-label">Video of the job</span>
              <p>You film it on your phone, right after this.</p>
              <button type="button" id="start-method-upload" className="bare-inline-link" onClick={() => setMethod("upload")}>I have a video ›</button>
            </div>
          )}

          <BareField label="Where is the job?" htmlFor="start-location">
            <LocationAutocomplete
              id="start-location"
              name="startLocation"
              placeholder="Street address or city"
              defaultValue={recovery.current.draft.location}
              maxLength={300}
              onSelectionChange={(place) => {
                setCountryMissing(false);
                setRegionManuallySet(false);
                setRegion(place?.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "");
                setRegionPlace(place?.countryCode ? place.label : null);
                if (place) retainDraft(place);
              }}
              onInputChange={(text) => {
                // Privacy gate: typed text is never read for a country ("Perth, WA" is not in the US). Only a place
                // chosen from the suggestions, or "Use my location", resolves it; typed text asks for the country.
                setCountryMissing(false);
                setRegionManuallySet(false);
                setRegion("");
                setRegionPlace(null);
                if (text.trim()) setCountryAsked(true);
              }}
            />
          </BareField>

          {showCountry && (
            <BareField label="Country of the site" htmlFor="start-region" helper="Only if the address doesn't say. No address is needed."
              error={countryMissing && !region ? "Choose the site country so we can check recording permission." : null}>
              <BareSelect id="start-region" name="startRegion" required value={region}
                aria-describedby={describedBy("start-region", { helper: true, error: countryMissing && !region })}
                onChange={(event) => {
                  setRegion(event.target.value as CaptureRegion | "");
                  setRegionManuallySet(true);
                  setRegionPlace(null);
                  setCountryMissing(false);
                }}>
                <option value="">Choose the site country</option>
                <option value="us">United States</option>
                <option value="non_us">Outside the United States</option>
              </BareSelect>
            </BareField>
          )}
          {region === "non_us" && <div className="bare-group"><BareNotice>{captureRegionNotice}</BareNotice></div>}

          {!currentUser && (
            <BareField label="Your email" htmlFor="start-email" helper={emailHint ?? "We send your private job link here."} error={emailError}>
              <BareInput id="start-email" name="startEmail" type="email" defaultValue={recovery.current.draft.email} required autoComplete="email" maxLength={320}
                aria-describedby={describedBy("start-email", { helper: true, error: emailError })} aria-invalid={emailError ? true : undefined}
                onChange={() => { if (emailError) setEmailError(null); if (emailHint) setEmailHint(null); }}
                onBlur={(event) => setEmailHint(hintFor(event.currentTarget.value))} />
            </BareField>
          )}
          {currentUser && workspaceType !== undefined && <p className="bare-helper bare-group">{siteWorkspace
            ? `Saving to your workspace as ${currentUser.email}.`
            : `Signed in as ${currentUser.email}, which is not a site workspace. Use the private job link we email you; saving it to a site account is optional.`}</p>}

          <div className="bare-links" style={{ marginTop: 16 }}>
            <button type="button" className="bare-link" onClick={() => openScreen("details")}>Add details (optional) ›</button>
          </div>

          {/* Bot bait, honoured by the server. Rendered, so a script that fills every rendered input still fills it, but
              off-screen and clipped, out of the accessibility tree, off the Tab order, and with no text a person could
              copy (its name is an attribute, never a text node). Its name, id and label mean nothing to browser autofill, and password managers are told to skip it. */}
          <div data-bot-trap aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1,
            overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}>
            <input id="start-hp" name="honeypot" type="text" tabIndex={-1} autoComplete="off" defaultValue="" aria-label="Leave empty"
              data-1p-ignore="" data-lpignore="true" data-bwignore="" data-form-type="other" />
          </div>

          {state.status === "failed" && !pending && <div className="bare-group">
            <p role="alert" className="bare-field-error">{state.message}</p>
            {/* Only where the site can do nothing itself and support would need it. */}
            {state.reference !== false && <p className="bare-helper">Job reference: {requestId.current}</p>}
          </div>}

          <div className="bare-group">
            <BareSubmit busy={state.status === "working"} busyLabel={busyLabel}
              disabled={!interactive || clearStatus === "working" || loading}
              helper={START_FORM_SHORT_CONSENT ? <>
                <p data-consent-line>{consentWithLinks(consentLine)}</p>
                <button type="button" className="bare-inline-link" style={{ fontSize: 15 }} onClick={() => openScreen("agreeing")}>What you're agreeing to ›</button>
              </> : <div data-consent-statements>
                {/* The recorded statements, word for word, set compactly under the button (the versions recorded today). */}
                <p>By pressing {submitLabel}, you agree to our <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> and{" "}
                  <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> and confirm:</p>
                <ul className="bare-quote-list">
                  <li>“{DESCRIPTION_AUTHORITY_STATEMENT}”</li>
                  {sendsVideo && <li>“{RECORDING_RIGHTS_STATEMENT}”</li>}
                </ul>
                {sendsVideo && <p>{FOOTAGE_UPLOAD_NOTICE}</p>}
              </div>}>{submitLabel}</BareSubmit>
          </div>

          {uploadPercent !== null && <div className="bare-group">
            <BareProgress percent={uploadPercent} label="Video upload progress" note="Keep this page open until the video has finished uploading." />
          </div>}
          </fieldset>
          <div className="bare-group">
            <ClearDraftControl status={clearStatus} onClear={forgetDraft} disabled={state.status === "working"} />
          </div>
          <noscript><p>Enable JavaScript to start a job, or contact <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a> about your job.</p></noscript>
        </BareScreen>
      </div>

      <div hidden={screen !== "details"}>
        <BareScreen>
          <BareBack onClick={closeScreen} />
          {screen === "details" && <h1 ref={headingRef} tabIndex={-1}>Details (optional)</h1>}
          <fieldset disabled={!interactive || clearStatus === "working" || recoveryUnavailable || Boolean(pending)} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
            <BareField label="The job in one sentence" htmlFor="start-task"
              helper={<>We write this from your video if you leave it empty. Typing here confirms: “{TASK_CONFIRMATION_STATEMENT}”</>}>
              <BareTextarea id="start-task" name="startTask" defaultValue={recovery.current.draft.task} maxLength={2000} rows={2}
                aria-describedby="start-task-help" placeholder="For example, put each packed carton at the end of the table" />
            </BareField>
            <BareField label="What counts as success?" htmlFor="start-success">
              <BareInput id="start-success" name="startSuccess" type="text" maxLength={1000}
                defaultValue={recovery.current.draft.successDefinition ?? ""}
                placeholder="For example, the carton reaches the end of the table upright" />
            </BareField>
            <BareField label="How often does it happen?" htmlFor="start-frequency">
              <BareInput id="start-frequency" name="startFrequency" type="text" maxLength={120}
                defaultValue={recovery.current.draft.jobFrequency ?? ""}
                placeholder="For example, 200 items per shift" />
            </BareField>
            <BareField label="Where are you in the process?" htmlFor="start-readiness" helper="Submitting does not authorize spending.">
              <BareSelect id="start-readiness" name="startReadiness" defaultValue={recovery.current.draft.purchaseReadiness ?? ""} aria-describedby="start-readiness-help">
                <option value="">Not sure yet</option>
                <option value="exploring">Exploring whether automation makes sense</option>
                <option value="planning">Planning a pilot</option>
                <option value="ready_for_proposals">Ready to run a pilot</option>
              </BareSelect>
            </BareField>
          </fieldset>
          <BareGroup>
            <BareButton onClick={closeScreen}>Done</BareButton>
          </BareGroup>
        </BareScreen>
      </div>

      {START_FORM_SHORT_CONSENT && <div hidden={screen !== "agreeing"}>
        <BareScreen>
          <BareBack onClick={closeScreen} />
          {screen === "agreeing" && <h1 ref={headingRef} tabIndex={-1}>What you're agreeing to</h1>}
          <BareGroup label="Statements">
            <BareLabel as="h2">You agree</BareLabel>
            <blockquote className="bare-quote">“{consentLine}”</blockquote>
          </BareGroup>
          {sendsVideo && <BareGroup>
            <BareLabel as="h2">Your video</BareLabel>
            <p>{FOOTAGE_UPLOAD_NOTICE}</p>
          </BareGroup>}
          <BareGroup>
            <BareLabel as="h2">If you write the job in one sentence</BareLabel>
            <blockquote className="bare-quote">“{TASK_CONFIRMATION_STATEMENT}”</blockquote>
          </BareGroup>
          <BareGroup>
            <BareLabel as="h2">Also</BareLabel>
            <p>{consentWithLinks(AGREEING_ALSO_LINE)}</p>
          </BareGroup>
          <BareLinks links={[{ key: "back", label: "Back to the form", onClick: closeScreen }]} />
        </BareScreen>
      </div>}
    </form>
  );
}
