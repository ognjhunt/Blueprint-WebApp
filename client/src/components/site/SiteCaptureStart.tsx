import { isLikelyPhone } from "@/lib/device";
/** Show the work; explanatory text is optional when capture is authorized. */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { CaptureLiveStatus } from "@/components/site/CaptureLiveStatus";
import { LocationAutocomplete, type ChosenPlace } from "@/components/site/LocationAutocomplete";
import { siteLocationParts, validSiteLocationParts, type SiteLocationParts } from "@/lib/placeParts";
import {
  captureRegionHeldNotice,
  captureRegionNotice,
  isApprovedCaptureRegion,
  type CaptureRegion,
} from "@/data/captureResidency";
import { checkEmail, EMAIL_HINT_SENTENCES, EMAIL_REFUSAL_SENTENCES, isEmailRefusal } from "@/lib/emailAddress";
import { withCsrfHeader } from "@/lib/csrf";
import { withAppCheckHeader } from "@/lib/appCheck";
import { PRIVACY_URL, PRIVACY_VERSION, TERMS_URL, TERMS_VERSION } from "@/lib/legalAcceptance";
import { FILMING_NOTICE, FOOTAGE_UPLOAD_NOTICE } from "@/lib/footageNotice";
import { DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION, DESCRIPTION_AUTHORITY_STATEMENT, DESCRIPTION_AUTHORITY_VERSION, DESCRIPTION_AUTHORITY_WITH_VIDEO_V6_VERSION } from "@/lib/siteSubmissionAuthority";
import { RECORDING_RIGHTS_STATEMENT, RECORDING_RIGHTS_STATEMENT_V6_VERSION, RECORDING_RIGHTS_STATEMENT_VERSION } from "@/lib/recordingRightsStatement";
import { TASK_CONFIRMATION_STATEMENT, TASK_CONFIRMATION_VERSION } from "@/lib/taskConfirmationStatement";
import { AGREEING_ALSO_LINE, SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_WITH_VIDEO_V6, START_FORM_SHORT_CONSENT } from "@/lib/siteStartConsent";
import { BareBack, BareButton, BareGroup, BareLabel, BareLinks, BareNotice, BareScreen, BareTicks } from "@/components/bare/Bare";
import { BareCheck, BareField, BareFile, BareInput, BareProgress, BareSelect, BareSubmit, BareTextarea, describedBy } from "@/components/bare/BareForm";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { JOB_DESCRIPTION_MAX_LENGTH, jobDescriptionTooLong } from "@/lib/jobDescriptionLimit";
import {
  CAPTURE_VIDEO_ACCEPT,
  captureTokenFromUrl,
  isCaptureVideoFile,
  isCaptureVideoTooLarge,
  VIDEO_TOO_LARGE,
  uploadSelfCaptureVideo,
  receivedVideoResult,
  retrySelfCaptureProcessing,
  type VideoUploadResult,
} from "@/lib/selfCaptureVideo";
import { useAuth } from "@/contexts/AuthContext";
import { newSiteCaptureRecovery, readSiteCaptureRecovery, hydrateSiteCaptureRecovery, writeSiteCaptureRecoveryDurably,
  replaceSiteCaptureRecoveryDurably, siteCaptureDraftKey, withSiteCaptureRecoveryLock, freezeSiteCaptureRecovery,
  type SiteCaptureRecovery } from "@/lib/siteCaptureDraft";

const CONTACT_IDENTITY_STORAGE_KEY = "bp-contact-identity";

/**
 * The two development 3D-authoring consent boxes (recorded statements 2026-09-24.v1) and the consent fields
 * they send exist only in a development build (owner rule: "development-only consent boxes must never render in
 * production"). Vite replaces `import.meta.env.DEV` with `false` in a production build, so every place that reads this
 * folds away there and a public `?authoring=` link shows the ordinary form. The prerender runs outside Vite, where
 * `import.meta.env` does not exist: that reads as not development too.
 */
const DEVELOPMENT_AUTHORING_ENTRY = typeof import.meta.env === "object" && import.meta.env.DEV === true;

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


type RestorableDraft = { location?: string; region: CaptureRegion | ""; regionManuallySet: boolean; regionFromPlace?: string;
  placeParts?: SiteLocationParts };
/**
 * The place label a restored country came from, when the draft's address still reads exactly that label: the country
 * was taken from a chosen suggestion or "Use my location" and the text has not been edited since. Typed text never
 * carries one, and an older draft (no label) cannot tell a place's country from a guess, so it has none.
 */
const restoredPlace = (draft: RestorableDraft) =>
  !draft.regionManuallySet && draft.region && draft.regionFromPlace && draft.regionFromPlace === draft.location ? draft.regionFromPlace : null;
/** That place's structured parts, restored exactly when its label is (`restoredPlace`). */
const restoredPlaceParts = (draft: RestorableDraft) => (restoredPlace(draft) ? validSiteLocationParts(draft.placeParts) : null);
const restoredRegion = (draft: RestorableDraft) => (draft.regionManuallySet || restoredPlace(draft) ? draft.region : "");
const restoredCountryAsked = (draft: { location?: string; regionManuallySet: boolean }) =>
  Boolean(draft.regionManuallySet) || Boolean(draft.location?.trim());

const VIDEO_MISSING = "Choose the video of the job, or film it next.";
/** The draft store's refusal when another tab changed the draft (`freezeSiteCaptureRecovery`): plain, so shown as is. */
const DRAFT_CHANGED_IN_ANOTHER_TAB = /^This draft was changed in another tab\./;
const TASK_MISSING = "Say what the robot should do in one sentence.";

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
      : withVideo ? DESCRIPTION_AUTHORITY_WITH_VIDEO_V6_VERSION : DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION;
    const recording = withVideo ? (shortConsent ? RECORDING_RIGHTS_STATEMENT_V6_VERSION : RECORDING_RIGHTS_STATEMENT_VERSION) : null;
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
  // The scope whose saved copy has been checked. The check never stops the form (owner, 2026-11-12): a copy it cannot
  // use starts a fresh draft, and a browser that cannot check at all still gets the form, whose saving and button say
  // what this browser cannot keep.
  const [hydrated, setHydrated] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const checked = () => { if (active) setHydrated(storageKey); };
    if (storageKey) void hydrateSiteCaptureRecovery(storageKey, () => active).then(checked, checked);
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    if (loading || hydrated !== storageKey) onSavedChange?.(false);
  }, [loading, hydrated, storageKey, onSavedChange]);
  if (loading || !storageKey || hydrated !== storageKey) return <BareScreen><h1>Start a job</h1><p role="status">Loading…</p></BareScreen>;
  // Identity changes discard later UI updates and prevent starting another upload.
  return <SiteCaptureStartForm key={storageKey} storageKey={storageKey} onSavedChange={onSavedChange} />;
}

function SiteCaptureStartForm({ storageKey, onSavedChange }: { storageKey: string | null; onSavedChange?: (saved: boolean) => void }) {
  const { currentUser, loading } = useAuth();
  const [stored] = useState(() => readSiteCaptureRecovery(storageKey));
  const [initial] = useState(() => stored ?? newSiteCaptureRecovery());
  const recovery = useRef<SiteCaptureRecovery>(initial);
  const [pending, setPending] = useState(initial.pending);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [startingNew, setStartingNew] = useState(false);
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
    if (storageKey) void retain(recovery.current);
  }, [storageKey]);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  // A scoped development entry link exposes the optional Claude disclosure, in a development build only: the
  // development consent boxes never render in production (owner rule; `DEVELOPMENT_AUTHORING_ENTRY`), whatever the URL.
  // Ordinary site captures keep the existing simple form and OpenAI route.
  const claudeAuthoringRequested = DEVELOPMENT_AUTHORING_ENTRY && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("authoring") === "claude-opus-5-5";
  // Retained development links select the upgraded Sol route too; the
  // disclosure and newly issued sponsorship always name GPT-6.1 Sol.
  const solAgentsRequested = DEVELOPMENT_AUTHORING_ENTRY && typeof window !== "undefined"
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
  const [method, setMethod] = useState<"upload" | "phone">(initial.draft.method === "upload" ? "upload" : "phone");
  const selfRecording = method === "phone";
  // A restored draft keeps a country the person chose in the select, or one a place gave while its address is unedited
  // (`restoredPlace`). Anything else is asked for again: an older draft may hold a guess from typed text.
  const [region, setRegion] = useState<CaptureRegion | "">(restoredRegion(initial.draft));
  const [regionManuallySet, setRegionManuallySet] = useState(initial.draft.regionManuallySet);
  // The label of the place whose country `region` holds, saved with the draft so a reload can keep it.
  const [regionPlace, setRegionPlace] = useState<string | null>(restoredPlace(initial.draft));
  // That place's structured city, state and country, sent as `siteLocationMetadata`. Typed text never sets it.
  const [placeParts, setPlaceParts] = useState<SiteLocationParts | null>(restoredPlaceParts(initial.draft));
  // Recording permission needs a country, not a street address. An explicit
  // country can stand alone; changing the address rechecks that declaration.
  const [countryMissing, setCountryMissing] = useState(false);
  // The form asks where the job is and takes the country from the place chosen (owner, 2026-11-11). The country select
  // is asked for only when it is needed: typed text with no chosen place, or a press of the button with no country.
  // Once asked it stays, so a person can change it. A recovered draft that chose one shows it.
  const [countryAsked, setCountryAsked] = useState(restoredCountryAsked(initial.draft));
  // Why we cannot send to the typed email, said under the field (checked here first, then by the server).
  const [emailError, setEmailError] = useState<string | null>(null);
  // The one sentence the job needs, said under its field when the button is pressed without it.
  const [taskError, setTaskError] = useState<string | null>(null);
  // An address we accept but that is likely mistyped (a Gmail name of an unusual length): said in the helper's place,
  // never blocking. Shown when the person leaves the field or presses the button.
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const hintFor = (value: string) => { const checked = checkEmail(value); return checked.ok && checked.hint ? EMAIL_HINT_SENTENCES[checked.hint] : null; };
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
  // Owner direction 2026-11-20: an email, one sentence and a video start a job. The sentence is asked here because
  // a job cannot reach deployment companies without it, and asking later is a second step on a clock. Typing it is
  // the confirmation. Sharing an anonymised card is the site's explicit choice. Never retained: each submission
  // chooses afresh.
  const formRef = useRef<HTMLFormElement>(null);
  function adoptRecovery(other: SiteCaptureRecovery, resetChanged = true) {
    const changed = recovery.current.requestId !== other.requestId
      || recovery.current.pending?.body !== other.pending?.body;
    recovery.current = other;
    requestId.current = other.requestId; retryToken.current = other.retryToken;
    setMethod(other.draft.method === "upload" ? "upload" : "phone"); setRegion(restoredRegion(other.draft));
    setRegionManuallySet(other.draft.regionManuallySet); setRegionPlace(restoredPlace(other.draft));
    setPlaceParts(restoredPlaceParts(other.draft));
    setCountryAsked(restoredCountryAsked(other.draft));
    setPending(other.pending);
    if (changed && resetChanged) {
      setClaudeConsent(false); setSolAgentsConsent(false);
      setFootage(null); setResetVersion(value => value + 1);
    }
  }
  function retainDraft(place?: ChosenPlace) {
    if (!interactive || recovery.current.pending || !formRef.current) return;
    const data = new FormData(formRef.current);
    const field = (name: string) => String(data.get(name) ?? "");
    retain({ ...recovery.current, savedAt: Date.now(), draft: {
      task: field("startTask"), location: place ? place.label : field("startLocation"), email: field("startEmail"),
      ...(field("startSuccess") ? { successDefinition: field("startSuccess") } : {}),
      ...(recovery.current.draft.company !== undefined ? { company: recovery.current.draft.company } : {}),
      method, region: place ? (place.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "") : region,
      regionManuallySet: place ? false : regionManuallySet,
      ...((place ? (place.countryCode ? place.label : null) : regionManuallySet ? null : regionPlace) ? {
        regionFromPlace: place ? place.label : regionPlace! } : {}),
      ...((place ? siteLocationParts(place) : placeParts) ? { placeParts: place ? siteLocationParts(place)! : placeParts! } : {}),
    } });
  }
  useEffect(() => { retainDraft(); }, [interactive, method, region, regionManuallySet, regionPlace, placeParts]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || operationInFlight.current) return;
      const other = readSiteCaptureRecovery(storageKey);
      if (other && (other.pending || other.requestId !== requestId.current)) adoptRecovery(other);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);
  // A job this browser already saved stays one button away. Starting a different one replaces only this device's copy
  // of it: the saved job is not touched, and its private link still opens it. Nothing is shown until both stores hold
  // the fresh draft, and a failure part way puts the saved job's copy back, so "Return to saved job" still works.
  async function startNewJob() {
    if (operationInFlight.current || !recovery.current.pending?.acknowledged) return;
    operationInFlight.current = true;
    setStartingNew(true);
    const fresh = newSiteCaptureRecovery();
    try {
      const saved = await withSiteCaptureRecoveryLock(storageKey,
        () => active.current && replaceSiteCaptureRecoveryDurably(storageKey, recovery.current, fresh));
      if (!active.current) return;
      if (!saved) { setStorageAvailable(false); return; }
      setStorageAvailable(true);
      recovery.current = fresh;
      requestId.current = fresh.requestId; retryToken.current = fresh.retryToken;
      setPending(null); setState({ status: "idle" }); setEmailError(null); setEmailHint(null); setTaskError(null); setClaudeConsent(false); setSolAgentsConsent(false);
      setMethod("phone"); setRegion(""); setRegionManuallySet(false); setRegionPlace(null); setPlaceParts(null); setCountryMissing(false); setCountryAsked(false);
      setFootage(null); setFootageError(null); setCaptureReceived(false);
      setResetVersion(value => value + 1);
    } catch {
      if (active.current) setStorageAvailable(false);
    } finally {
      operationInFlight.current = false;
      if (active.current) setStartingNew(false);
    }
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
    if (operationInFlight.current || state.status === "working" || loading
      || (!retained && claudeAuthoringRequested && !claudeConsent)
      || (!retained && solAgentsRequested && !solAgentsConsent)) return;
    // Keep the existing capture-region permission without requiring an address
    // from someone who is supplying their own recording. Never guess a country.
    // The email is checked here with the server's own rule, so an address we cannot send to never creates a request.
    const typedEmail = !retained && !currentUser ? checkEmail(String(new FormData(formRef.current!).get("startEmail") ?? "")) : null;
    const emailRefusal = typedEmail && !typedEmail.ok ? typedEmail.reason : null;
    if (typedEmail) setEmailHint(typedEmail.ok && typedEmail.hint ? EMAIL_HINT_SENTENCES[typedEmail.hint] : null);
    // The form does every check itself (`noValidate`: no browser bubble), each said under its own field, and focus
    // goes to the first field to fix, in page order: the video, the sentence, the country, the email.
    const videoMissing = !retained && footageWanted && !footage;
    const typedTask = String(new FormData(formRef.current!).get("startTask") ?? "").trim();
    const taskMissing = !retained && !typedTask;
    // Over the one limit (`JOB_DESCRIPTION_MAX_LENGTH`): said under the box, never cut off.
    const taskTooLong = !retained && typedTask.length > JOB_DESCRIPTION_MAX_LENGTH;
    if (!retained && (!region || emailRefusal || videoMissing || taskMissing || taskTooLong)) {
      if (!region) { setCountryMissing(true); setCountryAsked(true); }
      setEmailError(emailRefusal ? EMAIL_REFUSAL_SENTENCES[emailRefusal] : null);
      setTaskError(taskMissing ? TASK_MISSING : taskTooLong ? jobDescriptionTooLong(typedTask.length) : null);
      if (videoMissing) setFootageError(VIDEO_MISSING);
      if (state.status === "failed") setState({ status: "idle" });
      window.setTimeout(() => document.querySelector<HTMLElement>(videoMissing ? "#start-footage" : taskMissing || taskTooLong ? "#start-task"
        : !region ? "#start-region" : "#start-email")?.focus(), 0);
      return;
    }
    setEmailError(null);
    setTaskError(null);
    // A job saved before the sentence was asked here (a retained submission) is sent as it was: the server still
    // accepts a job with no sentence and its page asks for one.
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
          // are accepted by starting, next to the button; the server records the
          // versions sent below when they still count as current, and refuses others.
          accountSignup: false,
          acceptedTerms: true,
          // The versions this form shows beside its line; the server records exactly these.
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          requestedLanes: [],
          siteName: location,
          siteLocation: location,
          // The picked place's city, state and country from the provider's own parts; never from typed text.
          ...(placeParts && regionPlace?.trim() === location ? { siteLocationMetadata: placeParts } : {}),
          taskStatement: read("startTask"),
          taskDescription: read("startTask"),
          // Typing the task in the site's own words is the brief's confirmation
          // (what the removed box sent). No sentence, no confirmation: the
          // brief is drafted from the video and the site confirms it later.
          ...(read("startTask") ? { taskConfirmation: { granted: true, statementVersion: TASK_CONFIRMATION_VERSION } } : {}),
          ...(read("startSuccess") ? { successCriteria: { successDefinition: read("startSuccess") } } : {}),
          // Sharing is the service (2026-11-12): no share box. The job is shared with approved deployment companies
          // because recording statement v4, the line under the button, says so; the server writes the listing record.
          // Screening happens after the first submission.
          siteTaskGates: {},
          siteTaskSpec: {},
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
              : footageWanted ? DESCRIPTION_AUTHORITY_WITH_VIDEO_V6_VERSION : DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION,
          },
          consentAttestation: footageWanted ? {
            granted: true,
            statementVersion: START_FORM_SHORT_CONSENT ? RECORDING_RIGHTS_STATEMENT_V6_VERSION : RECORDING_RIGHTS_STATEMENT_VERSION,
          } : null,
          ...(DEVELOPMENT_AUTHORING_ENTRY && claudeAuthoringRequested ? { claudeAuthoringConsent: {
            granted: claudeConsent,
            statementVersion: "2026-09-24.v1",
          } } : {}),
          ...(DEVELOPMENT_AUTHORING_ENTRY && solAgentsRequested ? { solAgentsApiConsent: {
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
        // A storage or durability error's own text is never shown: the site gets one plain sentence it can act on.
        // Only a draft changed in another tab keeps its own words, which say what to do.
        setState({status:"failed",message: error instanceof Error && DRAFT_CHANGED_IN_ANOTHER_TAB.test(error.message) ? error.message
          : "This browser can't save your job before sending it, so nothing was sent. Try another browser, or email hello@tryblueprint.io."});
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
        // 409: the server already holds this job (started from another page or signed in elsewhere) and emailed its
        // private link. The saved submission is treated as the saved job, so "Start a new job" is offered and the
        // server's sentence points to the link, instead of asking to recover it again.
        if (response.status === 409 && recovery.current.pending && !recovery.current.pending.acknowledged) {
          await retain({ ...frozen.value, pending: { ...recovery.current.pending, acknowledged: true } }); setPending(recovery.current.pending);
        }
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
        setState({status: "failed", message: "Your job may already be saved. Open the private link we emailed you to check before you send the video."});
        return;
      }
      setPending(recovery.current.pending);
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
          ? `This account isn't set up for sites, so we saved this job to the private link we emailed to ${email}. You can save it to a site account from that link.`
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
      if (!recoveredSubmission && onAPhone && regionApproved && !submissionFootageWanted && captureUrl) {
        try {
          const nextPage = new URL(captureUrl, window.location.origin);
          if (nextPage.origin === window.location.origin && /^\/capture-upload\/[A-Za-z0-9_.-]+$/.test(nextPage.pathname)) {
            window.location.assign(nextPage.href);
          }
        } catch { /* The saved-job screen remains available if navigation fails. */ }
      }
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
    {done.workspaceUrl && <p className="bare-helper"><a href={done.workspaceUrl}>Saved to your account</a></p>}
    {done.linkOnlyNote && <p className="bare-helper">{done.linkOnlyNote}</p>}
    <BareLinks links={!done.workspaceUrl && done.claimUrl ? [{ key: "account", label: "Save to my account", href: done.claimUrl }] : []} />
  </>;
  const keepLink = (to: string) => `We also emailed this private link to ${to}. Please don't forward it.`;

  if (state.status === "done") {
    const done = state;
    if (!done.regionApproved) return (
      <BareScreen>
        <div aria-live="polite">
          <BareGroup><BareLabel>Saved</BareLabel><h1>Your job is saved.</h1></BareGroup>
          <BareGroup>
            <BareNotice>{captureRegionHeldNotice}</BareNotice>
            <p>Please don't send a video yet: we would have to delete it unwatched.</p>
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
              ? <p>We'll continue from your saved video and update your job. You can leave this page.</p>
              : <p>Next, we watch your video. Your job page shows what we find.</p>}
            {done.uploaded !== "done" && done.uploaded !== "processing_pending" && done.uploadMessage && <p className="bare-helper">{done.uploadMessage}</p>}
            {done.uploaded === "processing_pending" && (done.uploadMessage || done.processingRetryAvailable) && (
              <details aria-label="Processing status">
                <summary className="bare-inline-link">Processing status</summary>
                {done.uploadMessage && <p className="bare-helper">{done.uploadMessage}</p>}
                {done.processingRetryAvailable && <button type="button" className="bare-inline-link" disabled={retryingProcessing} onClick={() => void retryProcessing()}>
                  {retryingProcessing ? "Starting…" : "Start processing again"}
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
                  : <BareButton href={uploaderUrl} helper={keepLink(done.email)}>Upload the video</BareButton>}
              </BareGroup>
              {footage && <BareLinks links={[{ key: "uploader", label: "Upload the video", href: uploaderUrl }]} />}
            </> : done.hasFootage ? <>
              <BareGroup><BareLabel>Saved</BareLabel><h1>Send us your video.</h1></BareGroup>
              <BareGroup>
                <p>Upload your video on your job page.</p>
              </BareGroup>
              <BareGroup>
                <BareButton href={uploaderUrl} helper={keepLink(done.email)}>Upload the video</BareButton>
              </BareGroup>
              {!onAPhone && <details className="bare-group">
                <summary className="bare-inline-link">Video on another device?</summary>
                <p className="bare-helper">Scan this code with that device to open this job there.</p>
                <CaptureHandoffQr url={uploaderUrl} label="Open this job on another device" />
              </details>}
            </> : <>
              <BareGroup><BareLabel>Draft saved</BareLabel><h1>Now film the job.</h1></BareGroup>
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
          <BareGroup><BareLabel>Saved</BareLabel><h1>Your job is saved.</h1></BareGroup>
          <BareGroup><p>We'll email the link to film or upload your video to {done.email}.</p></BareGroup>
          {savedLinks(done)}
        </div>
      </BareScreen>
    );
  }

  const sendsVideo = method === "upload" && region !== "non_us";
  const consentLine = sendsVideo ? SITE_START_CONSENT_WITH_VIDEO_V6 : SITE_START_CONSENT_NO_VIDEO;
  const submitLabel = sendsVideo ? "Send video" : region === "non_us" ? "Save my job" : "Next: film the job";
  // The country select shows once asked (above), while the address has given no country or the person chose one.
  const showCountry = countryAsked && (!region || regionManuallySet);
  const busyLabel = uploadPercent !== null ? `Uploading video… ${uploadPercent}%` : "Working…";
  const consentWithLinks = (line: string) => {
    const [before, afterTerms] = line.split("Terms");
    const [middle, after] = afterTerms.split("Privacy Policy");
    return <>{before}<a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a>{middle}<a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>{after}</>;
  };

  return (
    <form key={resetVersion} ref={formRef} className="bare-start-form" method="post" noValidate onSubmit={submit} onChange={() => retainDraft()} aria-label="Start a job">
      <BareScreen>
        <BareBack href="/" />
        <h1>Start a job</h1>
        {pending && state.status !== "working" && <div className="bare-group" aria-live="polite">
          <BareNotice>{pending.acknowledged ? "Your job is saved. Return to it to see where it stands." : "Your job may already be saved. Recover it before you start another."}</BareNotice>
          <BareButton onClick={() => void submit()} disabled={!interactive || loading || startingNew}>
            {pending.acknowledged ? "Return to saved job" : "Recover saved job"}
          </BareButton>
          {pending.acknowledged && <button type="button" className="bare-inline-link" disabled={!interactive || startingNew}
            onClick={() => void startNewJob()}>{startingNew ? "Starting a new job…" : "Start a new job ›"}</button>}
        </div>}
        {state.status === "failed" && pending && <p role="alert" className="bare-field-error">{state.message}</p>}
        {!storageAvailable && <p role="status" className="bare-helper">This browser can't save your progress. Try another browser, or email hello@tryblueprint.io. If your job is already saved, open the private link we emailed you.</p>}
        <fieldset disabled={!interactive || Boolean(pending)} className={pending?.acknowledged && state.status !== "working" ? "contents ms-intake-return-fields" : "contents"} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {DEVELOPMENT_AUTHORING_ENTRY && claudeAuthoringRequested && (
          <BareCheck id="start-claude-authoring" name="startClaudeAuthoring" checked={claudeConsent} onChange={setClaudeConsent}>
            For this development test, I authorize Blueprint to send selected frames and task evidence
            from this recording to Anthropic for Claude Opus 5.5 3D authoring. Blueprint pays the
            bounded provider cost; this does not train a model on my recording. See Anthropic’s
            {" "}<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
              commercial API terms
            </a>.
          </BareCheck>
        )}
        {DEVELOPMENT_AUTHORING_ENTRY && solAgentsRequested && (
          <BareCheck id="start-sol-agents-authoring" name="startSolAgentsAuthoring" checked={solAgentsConsent} onChange={setSolAgentsConsent}>
            For this development test, I authorize Blueprint to send selected frames and task evidence
            to OpenAI for GPT-6.1 Sol managed-agent 3D authoring. The agent session can retain that evidence
            until it is deleted under the configured provider policy. Blueprint pays the bounded provider cost.
          </BareCheck>
        )}

        {method === "upload" ? (
          <div className="bare-field">
            <span className="bare-label" id="start-footage-label">Video of the job</span>
            {/* Outside the US the notice under the country says it once (`captureRegionNotice`): no video field here. */}
            {region === "non_us" ? null : <>
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
                  if (file && isCaptureVideoTooLarge(file)) {
                    event.target.value = "";
                    setFootage(null);
                    setFootageError(VIDEO_TOO_LARGE);
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
            <p>Film or upload a video to post your job.</p>
            <button type="button" id="start-method-upload" className="bare-inline-link" onClick={() => {
              // Mount the file input during this tap so the browser can open its picker immediately.
              flushSync(() => setMethod("upload"));
              formRef.current?.querySelector<HTMLInputElement>("#start-footage")?.click();
            }}>I have a video ›</button>
          </div>
        )}

        {/* Asked on this screen (owner, 2026-11-20): a job reaches deployment companies only with its sentence. */}
        <BareField label="The job in one sentence" htmlFor="start-task" error={taskError}
          helper={<>What should the robot do? Typing it confirms: “{TASK_CONFIRMATION_STATEMENT}”</>}>
          <BareTextarea id="start-task" name="startTask" defaultValue={recovery.current.draft.task} rows={2} required
            aria-describedby={describedBy("start-task", { helper: true, error: taskError })} aria-invalid={taskError ? true : undefined}
            onChange={event => {
              const length = event.currentTarget.value.trim().length;
              if (length > JOB_DESCRIPTION_MAX_LENGTH) setTaskError(jobDescriptionTooLong(length));
              else if (taskError) setTaskError(null);
            }}
            placeholder="For example, put each packed carton at the end of the table" />
        </BareField>

        <BareField label="Where is the job?" htmlFor="start-location">
          <LocationAutocomplete
            id="start-location"
            name="startLocation"
            placeholder="City or region"
            defaultValue={recovery.current.draft.location}
            maxLength={300}
            onSelectionChange={(place) => {
              setCountryMissing(false);
              setRegionManuallySet(false);
              setRegion(place?.countryCode ? (place.countryCode === "US" ? "us" : "non_us") : "");
              setRegionPlace(place?.countryCode ? place.label : null);
              setPlaceParts(place?.countryCode ? siteLocationParts(place) : null);
              if (place) retainDraft(place);
            }}
            onInputChange={(text) => {
              // Privacy gate: typed text is never read for a country ("Perth, WA" is not in the US). Only a place
              // chosen from the suggestions, or "Use my location", resolves it; typed text asks for the country.
              setCountryMissing(false);
              setRegionManuallySet(false);
              setRegion("");
              setRegionPlace(null);
              setPlaceParts(null);
              if (text.trim()) setCountryAsked(true);
            }}
          />
        </BareField>

        {showCountry && (
          <BareField label="Country of the site" htmlFor="start-region" helper="Only needed if your location doesn't show the country."
            error={countryMissing && !region ? "Choose the country of the site." : null}>
            <BareSelect id="start-region" name="startRegion" required value={region}
              aria-describedby={describedBy("start-region", { helper: true, error: countryMissing && !region })}
              onChange={(event) => {
                setRegion(event.target.value as CaptureRegion | "");
                setRegionManuallySet(true);
                setRegionPlace(null);
                setPlaceParts(null);
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
          ? "This job will be saved to your account."
          : "This account isn't set up for sites. We'll email you a private link to your job instead."}</p>}

        {/* The optional details open in place, under the fields they add to (owner, 2026-11-12: a drop-down, not a
            screen of their own). A closed disclosure still sends its fields, so a restored answer is never lost. */}
        <details className="bare-disclosure" style={{ marginTop: 16 }}>
          <summary>Add details</summary>
          <BareField label="What counts as success?" htmlFor="start-success">
            <BareInput id="start-success" name="startSuccess" type="text" maxLength={1000}
              defaultValue={recovery.current.draft.successDefinition ?? ""}
              placeholder="For example, the carton reaches the end of the table upright" />
          </BareField>
        </details>

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
          {state.reference !== false && <p className="bare-helper">If this keeps happening, email hello@tryblueprint.io and include this reference: {requestId.current}</p>}
        </div>}

        <div className="bare-group">
          <BareSubmit busy={state.status === "working"} busyLabel={busyLabel}
            disabled={!interactive || loading}
            helper={START_FORM_SHORT_CONSENT ? <>
              <p data-consent-line>{consentWithLinks(consentLine)}</p>
              {/* The rest of what pressing agrees to opens in place, under the line it adds to (owner, 2026-11-12).
                  The line itself is the recorded statement, so it is not repeated inside. */}
              <details className="bare-disclosure" data-agreeing>
                <summary style={{ fontSize: 15 }}>What you're agreeing to</summary>
                <div className="bare-disclosure-body">
                  {sendsVideo && <>
                    <BareLabel>Your video</BareLabel>
                    <p>{FOOTAGE_UPLOAD_NOTICE}</p>
                  </>}
                  <BareLabel>The job in one sentence</BareLabel>
                  <blockquote className="bare-quote">“{TASK_CONFIRMATION_STATEMENT}”</blockquote>
                  <BareLabel>Your details</BareLabel>
                  <p>{AGREEING_ALSO_LINE}</p>
                </div>
              </details>
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
        <noscript><p>Enable JavaScript to start a job, or contact <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a> about your job.</p></noscript>
      </BareScreen>
    </form>
  );
}
