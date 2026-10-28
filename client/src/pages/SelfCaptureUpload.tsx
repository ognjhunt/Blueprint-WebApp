import type { SiteAdvisory } from "@/types/siteAdvisory";
import { SiteAdvisoryReport } from "@/components/site/SiteAdvisoryReport";
import { TaskOutcomeNotice } from "@/components/site/TaskOutcomeNotice";
import type { TaskOutcome } from "@/types/taskOutcome";
import { isLikelyPhone } from "@/lib/device";
import { PublicTaskListing } from "@/components/site/PublicTaskListing";
import { JobWorkspace } from "@/components/site/JobWorkspace";
import { NextTaskUpdate } from "@/components/site/NextTaskUpdate";
/**
 * The page an operator or filmer opens from a private job link.
 *
 * Video comes first; Blueprint drafts the job description from it. A film-only
 * colleague link opens the recorder without carrying brief-confirmation rights.
 *
 * It says nothing about the site, the buyer, or the request. The API behind it
 * is careful not to leak who a customer is to anyone holding a forwarded link,
 * and a page that undid that by rendering the company name would make the
 * restraint pointless.
 *
 * The upload itself (`uploadSelfCaptureVideo`) reports progress, because a
 * walkthrough is hundreds of megabytes over a phone connection and a silent
 * two-minute wait is how someone decides the page is broken and closes it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { CaptureRecorder, type ChecklistItem } from "@/components/site/CaptureRecorder";
import { TaskBriefReview, type DraftedBrief, type SiteAccount } from "@/components/site/TaskBriefReview";
import { SiteReadinessPanel } from "@/components/site/SiteReadinessPanel";
import { FilmLinkHandoff } from "@/components/site/FilmLinkHandoff";
import { OwnerRecordingWithdrawal } from "@/components/site/OwnerRecordingWithdrawal";
import { FILMING_NOTICE, FOOTAGE_UPLOAD_NOTICE } from "@/lib/footageNotice";
import { withCsrfHeader } from "@/lib/csrf";
import { receivedVideoResult, retrySelfCaptureProcessing, uploadSelfCaptureVideo, type VideoUploadResult } from "@/lib/selfCaptureVideo";

/** Mirrors the server's `projectTaskStatus`; the shared truth about where a task stands. */
type TaskStatus = {
  siteAdvisory?: SiteAdvisory | null;
  assessment_retry_available?: boolean;
  assessment_job_id?: string | null;
  assessment_run_id?: string | null;
  decision: string;
  headline: string;
  operatorAction: string | null;
  outcome?: TaskOutcome | null;
  missingViews: string[];
  nextUpdateIso: string | null;
  /** Optional account saving; the signed owner link already opens this job. */
  claimUrl?: string | null;
  /** Owner-only URL projected from a persisted ready reconstruction. */
  sceneViewUrl?: string | null;
  /** The server holds a recording, whichever device sent it. */
  captureReceived?: boolean;
  /** Coverage is checked automatically; false means a person reviews it. */
  footageReviewAutomated?: boolean;
};

const retryUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function retainedAssessmentRetryIdentity(jobId: string, runId: string): string {
  // Only opaque server IDs and a bounded UUID; never store the private link.
  const key = `blueprint.site-assessment.retry.v1:${jobId}:${runId}`;
  try {
    const raw = sessionStorage.getItem(key);
    const value = raw && raw.length < 256 ? JSON.parse(raw) : null;
    if (retryUuid.test(value?.identity ?? "") && typeof value?.created === "number"
      && value.created <= Date.now() && value.created > Date.now() - 7 * 24 * 60 * 60 * 1000) return value.identity;
  } catch { /* The current page keeps its intent if browser storage is denied. */ }
  const identity = crypto.randomUUID();
  try { sessionStorage.setItem(key, JSON.stringify({ identity, created: Date.now() })); } catch { /* Memory fallback below. */ }
  return identity;
}
import { useRoute, useLocation } from "wouter";

import { Helmet } from "@/lib/helmet";

type LinkState =
  | { status: "checking" }
  | { status: "valid"; accepts: string[]; expiresAt: string }
  /**
   * A real link for a submission that cannot be recorded against yet.
   *
   * Distinct from `invalid` on purpose. An invalid link is a dead end and says
   * so; a held one is the site's own submission with something specific in the
   * way, and the difference matters because the second one becomes an upload
   * page on its own the moment that thing resolves.
   */
  | {
      status: "held";
      detail: string;
      blockers: string[];
      openQuestions: string[];
      /** Why it is held, from the dispatch rule. */
      holdReason?: string | null;
      /** The site asked for a visit and may film it itself instead. */
      selfCaptureSwitch?: boolean;
      recordingConsentAvailable?: boolean;
    }
  | { status: "invalid"; message: string };

type UploadState =
  | VideoUploadResult
  | { status: "idle" }
  | { status: "uploading"; percent: number };

export default function SelfCaptureUpload() {
  const [, params] = useRoute("/capture-upload/:token");
  const token = params?.token ?? "";
  // Back/Forward can change the private link without unmounting this route.
  // Every brief, permission, status and in-flight operation belongs to one link.
  return <SelfCaptureUploadForToken key={token} token={token} />;
}

function SelfCaptureUploadForToken({ token }: { token: string }) {
  const [, navigate] = useLocation();
  const [startingVideoUpdate, setStartingVideoUpdate] = useState(false);
  const [isVideoUpdate, setIsVideoUpdate] = useState(false);
  const [videoUpdateError, setVideoUpdateError] = useState<string | null>(null);
  const videoUpdateIntent = useRef<string | null>(null);
  async function updateVideo() {
    if (startingVideoUpdate || scope !== "owner") return;
    setStartingVideoUpdate(true); setVideoUpdateError(null);
    videoUpdateIntent.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/supplement`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        // The current processing path takes a complete walkthrough. A coverage
        // report may still describe an earlier recording, so it must not gate
        // this owner-requested update or choose a different upload contract.
        body: JSON.stringify({ mode: "replacement", requestId: videoUpdateIntent.current }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || typeof result.url !== "string" || !result.url.startsWith("/capture-upload/"))
        throw new Error(result?.error || "We could not start the update. Your original video is saved.");
      navigate(result.url);
    } catch (error) { setVideoUpdateError(error instanceof Error ? error.message : "We could not start the update. Try again."); }
    finally { setStartingVideoUpdate(false); }
  }

  const [link, setLink] = useState<LinkState>({ status: "checking" });
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const [existingVideoOnly, setExistingVideoOnly] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("video") === "existing");
  const selectedFile = useRef<File | null>(null);
  const operationInFlight = useRef(false);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [retryingAssessment, setRetryingAssessment] = useState(false);
  const [assessmentRetryMessage, setAssessmentRetryMessage] = useState<string | null>(null);
  const assessmentRetryIntent = useRef<{ key: string; identity: string } | null>(null);
  const [statusRefresh, setStatusRefresh] = useState(0);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const linkGeneration = useRef(0);
  /**
   * What to film, from the brief we drafted and they confirmed.
   *
   * Empty is a valid answer and the recorder handles it: a submission whose
   * brief we have not read yet still gets a camera, just without a list. What
   * it must never be is invented here -- a shot list that named views the task
   * does not have would be us telling somebody to film a room we imagined.
   */
  const [shotList, setShotList] = useState<ChecklistItem[]>([]);
  /**
   * The drafted brief, when there is one to confirm.
   *
   * Blueprint drafts this from the recording. After the video is received,
   * the owner reviews it before the job proceeds to evaluation.
   */
  const [brief, setBrief] = useState<DraftedBrief | null>(null);
  const [briefConfirmed, setBriefConfirmed] = useState(false);
  // Links expire after a week; the expired page asks for a new one itself.
  const [freshLink, setFreshLink] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  async function requestFreshLink() {
    setFreshLink("sending");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token ?? "")}/fresh-link`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: "{}",
      });
      setFreshLink(response.ok ? "sent" : "failed");
    } catch {
      setFreshLink("failed");
    }
  }
  // A site set up for a visit can film it itself instead. Visits are booked by
  // hand, so this is the path that does not wait on anyone.
  const [switching, setSwitching] = useState<"idle" | "sending" | "failed">("idle");
  async function filmItMyself() {
    setSwitching("sending");
    try {
      // The link is the credential here, exactly as for the upload itself.
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token ?? "")}/self-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error("switch_failed");
      setSwitching("idle");
      setLink(data.state === "held"
        ? {
            status: "held",
            detail: String(data.detail || "This capture cannot start yet."),
            blockers: Array.isArray(data.blockers) ? data.blockers.map(String) : [],
            openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions.map(String) : [],
            holdReason: typeof data.holdReason === "string" ? data.holdReason : null,
            selfCaptureSwitch: data.selfCaptureSwitchAvailable === true,
            recordingConsentAvailable: data.recordingConsentAvailable === true,
          }
        : {
            status: "valid",
            accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
            expiresAt: String(data.expiresAt || ""),
          });
    } catch {
      setSwitching("failed");
    }
  }
  // A confirmed brief can be reopened: emails tell a site that was not cleared
  // to update its answers when something changes, so the answers stay editable.
  const [editingBrief, setEditingBrief] = useState(false);
  const [siteAccount, setSiteAccount] = useState<SiteAccount | null>(null);
  /**
   * What this link may do. A film-only colleague link never shows the brief
   * confirm UI -- confirming is an attestation only the operator's own link
   * carries -- so the recorder is what they see. Defaults to owner, matching
   * the server, which reads an absent scope as owner.
   */
  const [scope, setScope] = useState<"owner" | "film">("owner");

  async function confirmRecordingConsent() {
    if (operationInFlight.current || !recordingConsent || scope !== "owner"
      || link.status !== "held" || !link.recordingConsentAvailable) return;
    const generation = linkGeneration.current;
    operationInFlight.current = true;
    setSavingConsent(true);
    setConsentError(null);
    try {
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/recording-consent`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ granted: true, statementVersion: "2026-09-18.v1" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "We could not save recording permission. Try again shortly.");
      const statusResponse = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/status`);
      const data = await statusResponse.json().catch(() => null);
      if (!statusResponse.ok || !data?.ok) throw new Error("Permission was saved. Reopen this link to check whether footage can be added.");
      if (linkGeneration.current !== generation) return;
      setLink(data.state === "held" ? {
        status: "held", detail: String(data.detail || "This capture cannot start yet."),
        blockers: Array.isArray(data.blockers) ? data.blockers.map(String) : [],
        openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions.map(String) : [],
        holdReason: data.holdReason, selfCaptureSwitch: data.selfCaptureSwitchAvailable === true,
        recordingConsentAvailable: data.recordingConsentAvailable === true,
      } : { status: "valid", accepts: data.accepts ?? ["mov", "mp4"], expiresAt: String(data.expiresAt || "") });
    } catch (error) {
      if (linkGeneration.current === generation) setConsentError(error instanceof Error ? error.message : "We could not save recording permission.");
    } finally {
      if (linkGeneration.current === generation) {
        operationInFlight.current = false;
        setSavingConsent(false);
      }
    }
  }

  /** Where the task stands, for the operator who has no account to check. */
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [currentStatusKnown, setCurrentStatusKnown] = useState(false);
  // An unreadable poll must not turn a known Blueprint stop into a site action.
  const [blueprintActionPending, setBlueprintActionPending] = useState(false);
  const currentStatus = useRef(status);
  currentStatus.current = status;

  // Whether the camera button below is worth anything on this device. A coarse
  // check on purpose: the cost of being wrong is one extra QR code on a phone,
  // or one missing QR code on a laptop that can still copy the URL out of its
  // own address bar.
  const onAPhone =
    isLikelyPhone();
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const inputRef = useRef<HTMLInputElement>(null);
  /** One-tap copy on the desktop handoff, where the QR alone asks too much. */
  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 4_000);
    } catch {
      // Clipboard unavailable (permissions, non-secure context). The URL is
      // rendered beside the button, so selecting it by hand still works.
    }
  }, [pageUrl]);

  useEffect(() => {
    const generation = ++linkGeneration.current;
    setUpload({ status: "idle" });
    setFileName(null);
    selectedFile.current = null;
    operationInFlight.current = false;
    setRetryingProcessing(false);
    setRetryingAssessment(false);
    setAssessmentRetryMessage(null);
    assessmentRetryIntent.current = null;
    setRecordingConsent(false);
    setSavingConsent(false);
    setConsentError(null);
    setBrief(null);
    setScope("owner");
    setExistingVideoOnly(new URLSearchParams(window.location.search).get("video") === "existing");
    if (!token) {
      setLink({ status: "invalid", message: "This link is missing its code." });
      return;
    }

    let cancelled = false;

    // A missing brief must not prevent the capture page from opening.
    (async () => {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}`);
        const data = (await response.json().catch(() => null)) as {
          ready?: boolean;
          scope?: "owner" | "film";
          brief?: (DraftedBrief & { shotList?: ChecklistItem[]; confirmedAtIso?: string | null });
          account?: SiteAccount | null;
        } | null;
        if (cancelled || !response.ok) return;
        if (data?.scope === "film" || data?.scope === "owner") setScope(data.scope);
        if (!data?.ready || !data.brief) return;
        if (Array.isArray(data.brief.shotList)) setShotList(data.brief.shotList);
        setBrief({
          summary: data.brief.summary,
          captureMode: data.brief.captureMode,
          proposed: data.brief.proposed ?? [],
          unresolved: data.brief.unresolved ?? [],
          successCriteria: data.brief.successCriteria ?? null,
          operatorAnswers: data.brief.operatorAnswers ?? null,
          operatorUnknown: data.brief.operatorUnknown ?? null,
          pilotIntent: data.brief.pilotIntent ?? null,
          confirmedBy: data.brief.confirmedBy ?? null,
        });
        setBriefConfirmed(Boolean(data.brief.confirmedAtIso));
        setSiteAccount(data.account ?? null);
      } catch {
        // No list. The camera still works.
      }
    })();

    (async () => {
      try {
        const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/status`);
        const data = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !data?.ok) {
          setLink({
            status: "invalid",
            message: data?.error || "This upload link is not valid or has expired.",
          });
          return;
        }

        setIsVideoUpdate(data.isVideoUpdate === true);
        const received = receivedVideoResult(data);
        if (received) {
          setLink({
            status: "valid",
            accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
            expiresAt: String(data.expiresAt || ""),
          });
          setUpload(received);
          return;
        }

        if (data.state === "held") {
          setLink({
            status: "held",
            detail: String(data.detail || "This capture cannot start yet."),
            blockers: Array.isArray(data.blockers) ? data.blockers.map(String) : [],
            openQuestions: Array.isArray(data.openQuestions)
              ? data.openQuestions.map(String)
              : [],
            holdReason: typeof data.holdReason === "string" ? data.holdReason : null,
            selfCaptureSwitch: data.selfCaptureSwitchAvailable === true,
            recordingConsentAvailable: data.recordingConsentAvailable === true,
          });
          return;
        }

        setLink({
          status: "valid",
          accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
          expiresAt: String(data.expiresAt || ""),
        });
        if (data.uploadState === "status_unavailable") {
          setExistingVideoOnly(true);
          setUpload({ status: "failed", message: "We could not confirm your video's saved status. Keep the original file and check this page again before sending it." });
        }
      } catch {
        if (!cancelled) {
          setLink({ status: "invalid", message: "We could not check this link. Try again shortly." });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (linkGeneration.current === generation) linkGeneration.current++;
    };
  }, [token]);

  const send = useCallback(
    async (file: File) => {
      if (operationInFlight.current) return;
      operationInFlight.current = true;
      const generation = linkGeneration.current;
      selectedFile.current = file;
      setExistingVideoOnly(true);
      const existingUrl = new URL(window.location.href);
      existingUrl.searchParams.set("video", "existing");
      window.history.replaceState(window.history.state, "", existingUrl);
      setFileName(file.name);
      setUpload({ status: "uploading", percent: 0 });
      // Measuring and posting live in `selfCaptureVideo`, shared with the start
      // form, so both go through the same checks.
      try {
        const outcome = await uploadSelfCaptureVideo(token, file, (percent) => {
          if (linkGeneration.current === generation) setUpload({ status: "uploading", percent });
        });
        if (linkGeneration.current === generation) setUpload(outcome);
      } finally { if (linkGeneration.current === generation) operationInFlight.current = false; }
    },
    [token],
  );

  async function retryProcessing() {
    if (operationInFlight.current || upload.status !== "processing_pending" || !upload.processingRetryAvailable) return;
    operationInFlight.current = true;
    const generation = linkGeneration.current;
    setRetryingProcessing(true);
    try {
      const outcome = await retrySelfCaptureProcessing(token);
      if (linkGeneration.current !== generation) return;
      setUpload(outcome.status === "failed"
        ? { status: "processing_pending", message: outcome.message, processingRetryAvailable: false }
        : outcome);
    } finally {
      if (linkGeneration.current === generation) {
        operationInFlight.current = false;
        setRetryingProcessing(false);
      }
    }
  }

  async function retryAssessment() {
    const selected = currentStatus.current;
    const jobId = selected?.assessment_job_id, runId = selected?.assessment_run_id;
    if (operationInFlight.current || scope !== "owner" || link.status !== "valid"
      || selected?.siteAdvisory?.state !== "needs_review" || selected.assessment_retry_available !== true
      || !jobId || !runId || jobId.length > 160 || runId.length > 160) return;
    operationInFlight.current = true;
    const generation = linkGeneration.current;
    const stillCurrent = () => linkGeneration.current === generation
      && currentStatus.current?.assessment_job_id === jobId
      && currentStatus.current?.assessment_run_id === runId
      && currentStatus.current.assessment_retry_available === true
      && currentStatus.current.siteAdvisory?.state === "needs_review";
    setRetryingAssessment(true);
    setAssessmentRetryMessage(null);
    try {
      const key = `${jobId}:${runId}`;
      if (assessmentRetryIntent.current?.key !== key) assessmentRetryIntent.current = {
        key, identity: retainedAssessmentRetryIdentity(jobId, runId),
      };
      const headers = await withCsrfHeader({ "Content-Type": "application/json" });
      if (!stillCurrent()) return;
      const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}/advisory-retry`, {
        method: "POST", headers,
        body: JSON.stringify({ expected_job_id: jobId, expected_run_id: runId, retry_identity: assessmentRetryIntent.current.identity }),
      });
      const result = await response.json().catch(() => null);
      if (!stillCurrent()) return;
      if (!response.ok || result?.ok !== true || result.job_id !== jobId || typeof result.run_id !== "string" || result.run_id.length > 160
        || !["queued", "running", "completed", "needs_review"].includes(result.state)) {
        setAssessmentRetryMessage(response.status === 409 || response.status === 403 || response.status === 404
          ? "The current assessment could not be retried. Your recording is saved. Check this page for the next step."
          : "We could not confirm the retry. Your recording is saved. Check this page or try again.");
        return;
      }
      const state = result.state === "completed" ? "needs_review" : result.state;
      setStatus(previous => previous?.siteAdvisory ? { ...previous,
        assessment_retry_available: false, assessment_run_id: result.run_id,
        siteAdvisory: { ...previous.siteAdvisory, state },
      } : previous);
      setAssessmentRetryMessage(result.state === "queued" || result.state === "running"
        ? "Your assessment retry is recorded. Your recording is saved; keep this page to follow progress."
        : "Your assessment retry is recorded. Check the current assessment below; your recording is saved.");
    } catch {
      if (stillCurrent()) setAssessmentRetryMessage("We could not confirm the retry. Your recording is saved. Check this page or try again.");
    } finally {
      if (linkGeneration.current === generation) {
        operationInFlight.current = false;
        setRetryingAssessment(false);
        setStatusRefresh(current => current + 1);
      }
    }
  }

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/status`);
        const data = await response.json();
        if (alive && response.ok && data?.status) {
          setCurrentStatusKnown(true);
          setBlueprintActionPending(data.status.outcome?.actionOwner === "blueprint");
          setStatus({
            ...data.status,
            siteAdvisory: data.siteAdvisory ?? null,
            assessment_retry_available: data.scope === "owner" && data.assessment_retry_available === true,
            assessment_job_id: typeof data.assessment_job_id === "string" ? data.assessment_job_id : null,
            assessment_run_id: typeof data.assessment_run_id === "string" ? data.assessment_run_id : null,
            claimUrl: data.claimUrl ?? null,
            sceneViewUrl: data.sceneViewUrl ?? null,
            captureReceived: data.captureReceived === true,
            footageReviewAutomated: data.footageReviewAutomated !== false,
          });
        } else if (alive) {
          setCurrentStatusKnown(false);
          setStatus(previous => previous ? { ...previous, siteAdvisory: null, outcome: null } : null);
        }
      } catch { if (alive) {
        setCurrentStatusKnown(false);
        setStatus(previous => previous ? { ...previous, siteAdvisory: null, outcome: null } : null);
      } }
      if (alive) timer = setTimeout(poll, 6000);
    }
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [token, upload.status, briefConfirmed, statusRefresh]);

  const accepts =
    link.status === "valid" ? link.accepts.map((item) => `.${item}`).join(",") : ".mov,.mp4";

  // Saved on this device, or on another one: the laptop that showed the QR
  // code reaches the same layout once the phone's recording lands.
  // Updates get their own immutable capture under this same job.
  const saved = upload.status === "processing_pending" || upload.status === "held"
    || upload.status === "done" || status?.captureReceived === true;

  // The link waits on the account: before a video, or after one that arrived before it.
  const accountHold = link.status === "held"
    && (link.holdReason === "site_account_required" || link.holdReason === "footage_before_account");

  // Older status writers can still project optional corrections as a next
  // step. A received, authorized source stays with Blueprint; real holds and
  // bounded outcomes keep their own visible explanation.
  const optionalCorrectionHint = saved && link.status === "valid" && !status?.outcome
    && (status?.decision === "confirm_brief" || status?.decision === "add_views");
  const preparationUpdate = "Blueprint is preparing your reconstruction.";

  // One current update. Saved jobs show it before results; a fresh capture
  // keeps the recorder first. Optional corrections do not become next steps.
  const statusCard = status && currentStatusKnown ? (
    <div
      style={{
        border: "1px solid var(--ms-rule)",
        padding: "16px",
        marginBottom: "24px",
        background: "var(--ms-paper)",
      }}
    >
      <strong>{status.outcome ? status.headline : upload.status === "processing_pending" || upload.status === "held"
        ? "Your video is saved."
        : optionalCorrectionHint ? preparationUpdate
        : existingVideoOnly && !saved && status.decision !== "add_views"
          ? "Your job is saved."
          : status.headline}</strong>
      {status.operatorAction && !optionalCorrectionHint && (
        <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
          {status.operatorAction}
        </p>
      )}
      <TaskOutcomeNotice showTitle={false} outcome={status.outcome} />
      <NextTaskUpdate nextUpdateIso={status.nextUpdateIso} />
      <SiteAdvisoryReport advisory={status.siteAdvisory}>
      {scope === "owner" && link.status === "valid" && status.siteAdvisory?.state === "needs_review"
        && status.assessment_retry_available === true && status.assessment_job_id && status.assessment_run_id && (
        <p><button type="button" className="ms-text-link" disabled={retryingAssessment || operationInFlight.current} onClick={() => void retryAssessment()}>
          {retryingAssessment ? "Requesting assessment retry…" : "Try assessment again"}
        </button></p>
      )}
      {assessmentRetryMessage && <p role="status">{assessmentRetryMessage}</p>}
      </SiteAdvisoryReport>
      {status.sceneViewUrl && (
        <p style={{ margin: "10px 0 0" }}>
          <a className="ms-text-link" href={status.sceneViewUrl} target="_blank" rel="noreferrer">
            View your scene
          </a>
        </p>
      )}
      {status.claimUrl && !accountHold && (
        <details style={{ marginTop: "10px" }}>
          <summary>Save this job to an account (optional)</summary>
          <p className="ms-field-hint">Your private job link already opens this job, its results and proposals. Save it to an account if you want it in your workspace.</p>
          <a className="ms-text-link" href={status.claimUrl}>
            Save this job to your account
          </a>
        </details>
      )}
    </div>
  ) : null;

  return (
    // This page renders in the "bare" shell, outside SiteLayout/MinimalSiteLayout,
    // so it has to establish the minimal-site theme itself. Without this wrapper the
    // `--ms-*` tokens and `color-scheme: light` are undefined here, and a phone in
    // dark mode paints every un-coloured element with the browser's own dark-mode
    // defaults: that is the washed-out body text and the invisible `--ms-green`
    // buttons (the "Open the camera" control rendered cream-on-cream). The wrapper
    // carries the theme only -- no header or footer -- so the bare shell is intact.
    <div className="minimal-site">
      <header className="ms-container ms-capture-header" style={{ maxWidth: "680px" }}>
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <a className="ms-back" href="/contact/site-operator">Back to Blueprint</a>
      </header>
      <div className="ms-container ms-capture-body" style={{ paddingBlock: "24px 48px", maxWidth: "680px" }}>
        <Helmet>
        <title>Your job | Blueprint</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <h1 style={{ fontSize: "34px", letterSpacing: "-1.2px", marginBottom: "12px" }}>
        {link.status === "held" || saved ? "Your job" : existingVideoOnly ? "Upload your existing video" : onAPhone ? "Film the work area" : "Upload or record your job"}
      </h1>

      {(saved || link.status !== "valid") && statusCard}
      {saved && (link.status === "valid" || link.status === "held") && scope === "owner"
        && <JobWorkspace token={token} preparationOutcome={status?.outcome} currentStatusKnown={currentStatusKnown} currentNextAction={currentStatusKnown && status ? optionalCorrectionHint
          ? {text: preparationUpdate, owner: "blueprint"}
          : {text: status.operatorAction || status.headline, owner: status.operatorAction || status.decision === "confirm_brief" ? "site" : "blueprint"} : undefined} />}

      {isVideoUpdate && !saved && <p className="ms-field-hint" role="status">Film or upload a complete updated walkthrough. This updates the same job and keeps your original video.</p>}
      {/* A filming link opens the recorder; a held link explains its hold. */}
      {link.status === "checking" && (
        <p style={{ color: "var(--ms-muted)" }}>Checking your link…</p>
      )}

      {link.status === "held" && (
        <>
          {scope === "owner" && link.recordingConsentAvailable && (
            <section aria-label="Confirm recording permission" style={{ marginBottom: "24px" }}>
              <h2>Record your job</h2>
              <p className="ms-field-hint">Your video is needed to build the site simulation and compare robot options. Confirm recording permission to continue; Blueprint drafts the job description from your video.</p>
              <p className="ms-field-hint">{FILMING_NOTICE}</p>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <input type="checkbox" checked={recordingConsent} onChange={event => setRecordingConsent(event.target.checked)}
                  style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
                <span>I am authorized to record this site and to let Blueprint use the recording to build a scene robot teams can evaluate against.</span>
              </label>
              <button type="button" className="ms-button" disabled={!recordingConsent || savingConsent} onClick={() => void confirmRecordingConsent()}>
                {savingConsent ? "Saving permission…" : "Confirm recording permission"}
              </button>
              {consentError && <p role="alert">{consentError}</p>}
            </section>
          )}
          {link.selfCaptureSwitch && (
            <section aria-label="Film it yourself" style={{ marginBottom: "24px" }}>
              <p style={{ marginBottom: "12px" }}>
                You asked for someone to come and record the work area. Visits are booked by hand,
                so they take longer. The quickest way to start is to film it yourself: about a
                minute on any phone, with no account or booking.
              </p>
              <button type="button" className="ms-button" disabled={switching === "sending"} onClick={filmItMyself}>
                {switching === "sending" ? "Switching…" : "I'll film it myself instead"}
              </button>
              {switching === "failed" && (
                <p role="alert" style={{ marginTop: "8px" }}>That did not go through. Try again in a moment.</p>
              )}
              <p style={{ color: "var(--ms-muted)", marginTop: "12px" }}>
                Would rather someone came? Visits cover the Austin metro for now and are booked by
                email. Keep this link either way.
              </p>
            </section>
          )}
          {link.holdReason === "site_account_required" && scope !== "owner" ? (
            <p style={{ color: "var(--ms-muted)", marginBottom: "24px" }}>
              The job's owner needs to save it to their Blueprint account before the video can be sent.
              Ask them to open their job link; this link takes the video once they have.
            </p>
          ) : accountHold ? (
            /* Footage waits for a saved job (owner decision 2026-10-18): the
               account is the step before a video, and a video that already
               arrived before the account is said so, never asked for again. */
            <div style={{ marginBottom: "24px" }}>
              <p style={{ marginBottom: "12px" }}>{link.detail}</p>
              {scope === "owner" && status?.claimUrl && <section aria-label="Save this job to your account" className="ms-intake-account-links">
                <a className="ms-button" href={status.claimUrl}>Create an account for this job</a>
                <a className="ms-text-link" href={`${status.claimUrl}?mode=signin`}>Sign in to save this job</a>
              </section>}
            </div>
          ) : link.holdReason !== "capturer_visit_scheduled" && (
            <p style={{ color: "var(--ms-muted)", marginBottom: "24px" }}>{link.detail}</p>
          )}

          {link.blockers.length > 0 && (
            <ul style={{ paddingLeft: "20px", marginBottom: "24px", lineHeight: 1.7 }}>
              {link.blockers.map((blocker) => (
                <li key={blocker} style={{ marginBottom: "8px" }}>
                  {blocker}
                </li>
              ))}
            </ul>
          )}

          {link.openQuestions.length > 0 && (
            <>
              <p style={{ marginBottom: "8px" }}>What a short call would settle:</p>
              <ul style={{ paddingLeft: "20px", marginBottom: "24px", lineHeight: 1.7 }}>
                {link.openQuestions.map((question) => (
                  <li key={question} style={{ marginBottom: "8px" }}>
                    {question}
                  </li>
                ))}
              </ul>
            </>
          )}

          <p style={{ color: "var(--ms-muted)" }}>
            Keep this link. It is the same page you will record on — when the above changes,
            open it again and it will let you upload. Nothing needs to be re-submitted and
            nobody needs to email you.
          </p>
        </>
      )}

      {link.status === "invalid" && (
        <div>
          <p style={{ color: "var(--ms-muted)" }}>{link.message}</p>
          {token && freshLink !== "sent" && (
            <button
              type="button"
              className="ms-button"
              disabled={freshLink === "sending"}
              onClick={() => void requestFreshLink()}
            >
              {freshLink === "sending" ? "Sending…" : "Email me a fresh link"}
            </button>
          )}
          {freshLink === "sent" && (
            <p role="status">
              If this link was one of ours, a fresh one is on its way to the email address your
              job was sent from.
            </p>
          )}
          {freshLink === "failed" && (
            <p role="alert">We could not send that just now. Try again shortly.</p>
          )}
        </div>
      )}

      {link.status === "valid" && (
        <>
          <div>
          {!saved && (
            <input
              ref={inputRef}
              type="file"
              accept={accepts}
              capture={existingVideoOnly ? undefined : "environment"}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void send(file);
              }}
            />
          )}
          {saved ? (
            <>
              <div
                style={{ marginBottom: "8px" }}
              >
                <strong>Video received.</strong>
                {(!status || !currentStatusKnown || upload.status === "processing_pending" || upload.status === "held") && <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                  {blueprintActionPending
                    ? currentStatusKnown ? "Your recording is saved. The next step is with Blueprint."
                      : "Blueprint is checking the current status. Keep your original recording."
                    : upload.status === "processing_pending"
                    ? "Blueprint will continue from this saved recording and update this job. You can leave this page."
                    : upload.status === "held" || (upload.status === "done" && upload.message)
                    ? upload.message
                    : "Blueprint handles reconstruction and evaluation. The next update will appear in this job."}{" "}
                </p>}
              </div>
              {scope === "owner" && link.status === "valid" && <details aria-label="Update job video" style={{ margin: "16px 0" }}>
                <summary>Update walkthrough (optional)</summary>
                <p className="ms-field-hint">If your job or recording has changed, you can send a complete updated walkthrough. Your job and original video stay saved.</p>
                <button type="button" className="ms-text-link" disabled={startingVideoUpdate} onClick={() => void updateVideo()}>
                  {startingVideoUpdate ? "Opening video update…" : "Update walkthrough"}
                </button>
                {videoUpdateError && <p role="alert">{videoUpdateError}</p>}
              </details>}
              {!blueprintActionPending && upload.status === "processing_pending" && (
                <details aria-label="Processing details" style={{ margin: "16px 0" }}>
                  <summary>Processing details (optional)</summary>
                  <p className="ms-field-hint">{upload.message}</p>
                  {upload.processingRetryAvailable && <button type="button" className="ms-text-link" disabled={retryingProcessing} onClick={() => void retryProcessing()}>
                  {retryingProcessing ? "Retrying processing…" : "Retry processing"}
                  </button>}
                </details>
              )}
              {scope === "owner" && brief && blueprintActionPending && !editingBrief && <details style={{margin: "16px 0"}}>
                <summary>Saved job brief</summary>
                <p>{brief.summary}</p>
                <p className="ms-field-hint">This brief is retained for a future authorized attempt. Blueprint's next step is shown above.</p>
              </details>}
              {scope === "owner" && brief && briefConfirmed && !editingBrief && !blueprintActionPending && (
                <p className="ms-field-hint" style={{ marginBottom: "8px" }}>
                  Your job brief is confirmed.{" "}
                  <button type="button" className="ms-text-link" onClick={() => setEditingBrief(true)}>
                    Edit your answers
                  </button>
                </p>
              )}
              {/* Blueprint continues from the recording. The owner may correct
                  the inferred brief without making review another required step. */}
              {scope === "owner" && brief && !briefConfirmed && !editingBrief && !blueprintActionPending && (
                <details aria-label="Review your job brief" style={{ margin: "16px 0" }}>
                  <summary>Review or correct job details (optional)</summary>
                  <p className="ms-field-hint">Blueprint prepares and evaluates your job from the recording. You can correct the inferred summary and answers here.</p>
                  <TaskBriefReview
                    key={token}
                    token={token}
                    brief={brief}
                    account={siteAccount} optionalAccount
                    onConfirmed={confirmed => { setBrief(confirmed); setBriefConfirmed(true); setEditingBrief(false); }}
                  />
                </details>
              )}
              {scope === "owner" && brief && editingBrief && (
                <details open style={{ marginBottom: "8px" }}>
                  <summary>Edit your job brief</summary>
                  <TaskBriefReview
                    key={token}
                    token={token}
                    brief={brief}
                    account={siteAccount} optionalAccount
                    onConfirmed={confirmed => { setBrief(confirmed); setBriefConfirmed(true); setEditingBrief(false); }}
                  />
                </details>
              )}
            </>
          ) : existingVideoOnly ? (
            <p className="ms-field-hint">Choose the video you already have. You do not need to record it again.</p>
          ) : !onAPhone ? (
            /*
             * A desktop cannot film a workcell, and a webcam that can see the
             * operator's face is worse than useless here. So the desktop page
             * is not the recorder with a handoff bolted on — it IS the
             * handoff: the code, a copyable link, and a status line that
             * reflects the phone. The camera button exists only where a rear
             * camera exists.
             */
            <div className="ms-form" aria-live="polite">
              <h2 style={{ marginTop: 0 }}>Point your phone at this.</h2>
              <p className="ms-field-hint">
                Scan to film the work area. Keep this page open to follow progress.
              </p>
              <CaptureHandoffQr url={pageUrl} label="Scan to open the recorder on your phone" />
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  marginTop: "16px",
                  flexWrap: "wrap",
                }}
              >
                <button type="button" className="ms-button" onClick={copyLink}>
                  {linkCopied ? "Link copied" : "Copy the link"}
                </button>
                <span
                  className="ms-field-hint"
                  style={{ wordBreak: "break-all", maxWidth: "100%" }}
                >
                  {pageUrl}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* The phone: the camera is the page. One hero action — the guided
                  recorder, which offers itself only where the browser records a
                  format our reconstruction accepts and steps aside to the file
                  picker below otherwise — then one line of how, and everything
                  else optional and beneath it. */}
              <CaptureRecorder
                token={token}
                checklist={shotList}
                onSaved={() => setUpload({ status: "done" })}
              />

              <p className="ms-field-hint" style={{ marginTop: "12px" }}>
                Move slowly and overlap your passes. Cover every surface near where the work
                happens, from a few heights. Ideally the scene is still, with nobody in frame; if work is going on, film anyway. {FILMING_NOTICE}
              </p>
            </>
          )}

          {!saved && (
            <>
              <p className="ms-field-hint" style={{ marginTop: "20px" }}>
                {existingVideoOnly ? "Upload your original .mov or .mp4 file from this device." : onAPhone
                  ? "Already have a video of the work area? Upload it instead."
                  : "Already have the recording on this computer? Upload a .mov or .mp4 file."}
              </p>
              <p className="ms-field-hint">{FOOTAGE_UPLOAD_NOTICE}</p>

              <button
                type="button"
                className="ms-button"
                disabled={upload.status === "uploading"}
                onClick={() => inputRef.current?.click()}
                style={{
                  background: "var(--ms-green)",
                  color: "var(--ms-paper)",
                  border: "none",
                  padding: "14px 24px",
                  fontSize: "15px",
                  cursor: upload.status === "uploading" ? "default" : "pointer",
                }}
              >
                {upload.status === "uploading"
                  ? "Uploading…"
                  : onAPhone && !existingVideoOnly
                    ? "Choose or record a video"
                    : "Upload a video file"}
              </button>

              {upload.status === "uploading" && (
                <div style={{ marginTop: "20px" }}>
                  <div
                    role="progressbar"
                    aria-valuenow={upload.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                    style={{ height: "4px", background: "var(--ms-rule)" }}
                  >
                    <div
                      style={{
                        width: `${upload.percent}%`,
                        height: "100%",
                        background: "var(--ms-green)",
                        transition: "width 200ms ease",
                      }}
                    />
                  </div>
                  <p style={{ color: "var(--ms-muted)", marginTop: "10px", fontSize: "14px" }}>
                    {upload.percent}% — keep this page open{fileName ? ` (${fileName})` : ""}.
                  </p>
                </div>
              )}

              {upload.status === "failed" && (
                <p style={{ color: "var(--ms-muted)", marginTop: "20px" }}>
                  {upload.message}
                </p>
              )}
              {upload.status === "failed" && selectedFile.current && (
                <button type="button" className="ms-text-link" onClick={() => void send(selectedFile.current!)}>
                  Try the selected video again
                </button>
              )}
              {existingVideoOnly && <details style={{ marginTop: "20px" }}>
                <summary>Open this job on another device (optional)</summary>
                <p className="ms-field-hint">Use this if your existing video is on another device. This opens the same job; no new recording is required.</p>
                <CaptureHandoffQr url={pageUrl} label="Open this job on another device" />
              </details>}

              {/* A re-film request or "where this stands" lands right under the
                  camera, so someone who came back to add an angle sees what we
                  need before the optional sections. */}
              {statusCard}

              {/* Least privilege for the person who actually films. An owner who
                  is handing this to a colleague sends a link that can record and
                  upload but cannot attest -- so a forwarded QR never carries the
                  authority to confirm operating facts on the site's behalf. */}
              {scope === "owner" && (!existingVideoOnly || status?.decision === "add_views") && <details className="ms-task-interest"><summary>Ask someone else to film</summary><FilmLinkHandoff token={token} /></details>}


            </>
          )}
          {/* The site sends its video and nothing else (founder direction,
              2026-10-20): no measurements, item photos or follow-up questions.
              Blueprint infers the rest from the video. The owner sees the robot
              readiness report here once Blueprint shares it, folded. */}
          {saved && scope === "owner" && <SiteReadinessPanel token={token} />}
          </div>
        </>
      )}
      {link.status === "valid" && scope === "owner" && <PublicTaskListing token={token} jobRevision={JSON.stringify(brief)} />}
      {(link.status === "valid" || link.status === "held") && scope === "owner" && (
        <OwnerRecordingWithdrawal token={token} onWithdrawn={() => setLink({ status: "held",
          detail: "Recording permission was withdrawn. This link no longer accepts footage.",
          blockers: [], openQuestions: [], holdReason: "recording_consent_withdrawn" })} />
      )}
      {!saved && (
        <p className="ms-field-hint" style={{ marginTop: "28px" }}>Upload or record the job to continue. Blueprint analyzes the video, drafts the job description and reconstructs your work area for simulation.</p>
      )}
      </div>
    </div>
  );
}
