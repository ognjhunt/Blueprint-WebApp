import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { CaptureQaInspection } from "@/components/blueprint/app/CaptureQaInspection";
import { SceneIntakeForm } from "@/components/blueprint/app/SceneIntakeForm";
import { SiteTaskTestbedInspection } from "@/components/blueprint/app/SiteTaskTestbedInspection";
import { TaskCandidateReview } from "@/components/blueprint/app/TaskCandidateReview";
import { TaskEvaluationRunControl } from "@/components/blueprint/app/TaskEvaluationRunControl";
import { TaskEvaluationRunInspection } from "@/components/blueprint/app/TaskEvaluationRunInspection";
import { TestbedCompilationControl } from "@/components/blueprint/app/TestbedCompilationControl";
import { Field, Tag } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyCompletedCaptureLifecycle,
  authorizeCaptureReconstruction,
  compileCaptureTestbed,
  createCaptureUpload,
  executeCaptureReconstruction,
  authorizeCaptureTaskEvaluationRun,
  executeCaptureTaskEvaluationRun,
  getCaptureSiteTaskTestbed,
  getCaptureQa,
  getCaptureTaskReview,
  getCaptureTaskEvaluationRun,
  getCaptureUpload,
  listCaptureUploads,
  planCaptureTaskEvaluationRun,
  planCaptureReconstruction,
  retryCaptureUploadProcessing,
  submitTaskDecisionCommand,
  uploadCaptureFile,
  type CaptureTaskReview,
  type CaptureQaInspection as CaptureQaInspectionValue,
  type CaptureSiteTaskTestbedInspection,
  type CaptureTaskEvaluationRunInspection,
  type CaptureTestbedCompilationCommand,
  type CaptureUploadSession,
  type CreateCaptureUploadSession,
  type TaskDecisionCommandRequest,
  type WebCaptureAuthorityProfile,
} from "@/lib/captureUploads";
import { Helmet } from "@/lib/helmet";

const MIN_RESUMABLE_BYTES = 5 * 1024 * 1024 + 1;
const MAX_CAPTURE_BYTES = 50 * 1024 * 1024 * 1024;

/** Each type's one-line hint states what that kind of file can and can't show. */
const profileCopy: Record<WebCaptureAuthorityProfile, { label: string; hint: string; accept: string }> = {
  camera_360_equirectangular: {
    label: "360° video",
    hint: "A stitched MP4 or MOV from a 360° camera. Used to review the space and find tasks until its scale is checked.",
    accept: ".mp4,.mov,video/mp4,video/quicktime",
  },
  camera_360_native: {
    label: "Insta360 original (.insv)",
    hint: "The original file from the camera. We keep it unchanged.",
    accept: ".insv,application/octet-stream",
  },
  monocular_video: {
    label: "Phone or ordinary video",
    hint: "Good for reviewing the space and finding tasks. It has no built-in scale or depth.",
    accept: ".mp4,.mov,video/mp4,video/quicktime",
  },
  provided_scene_splat: {
    label: "3D Gaussian splat (.ply)",
    hint: "A binary PLY from your reconstruction provider, kept unchanged. It shows appearance only; contact geometry and physics need separate evidence.",
    accept: ".ply",
  },
  provided_scene_mesh: {
    label: "3D model (USD, GLB, or PLY)",
    hint: "Geometry you supply. It's treated as provided, not as a measurement of the site.",
    accept: ".usd,.usda,.usdc,.glb,.ply",
  },
};

function profileLabel(profile: string) {
  return profileCopy[profile as WebCaptureAuthorityProfile]?.label || profile.replace(/_/g, " ");
}

function newUploadIdentity() {
  const value = crypto.randomUUID();
  return {
    intakeId: `intake-${value}`,
    idempotencyKey: `web-capture-${value}`,
  };
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

const uploadLabels: Record<string, string> = {
  provider_start_pending: "Preparing upload",
  upload_pending: "Upload not started",
  uploading: "Upload not finished",
  uploaded_verification_pending: "Checking the file",
  validating: "Checking the capture",
  capture_accepted: "Capture accepted",
  rejected_or_recapture_required: "Recapture needed",
  cancelled: "Cancelled",
  failed: "Failed",
  revocation_in_progress: "Deleting",
  revoked: "Deleted",
};

const reviewLabels: Record<string, string> = {
  task_approval_required: "Review the proposed tasks",
  decision_pending_pipeline_validation: "Task decision recorded",
  task_approved: "Task approved",
  task_rejected: "Task rejected",
  recapture_requested: "More capture requested",
};

const decidedRunStates = ["decided", "partially_decided", "abstained"];

/** One plain status per capture: what needs the owner first, otherwise the furthest stage reached. */
function captureStatus(session: CaptureUploadSession): { label: string; tone: "green" | "red" | "neutral" } {
  const lifecycle = session.completed_capture_lifecycle?.state;
  if (session.status === "revoked" || lifecycle === "revoked") return { label: "Deleted", tone: "neutral" };
  if (session.status === "revocation_in_progress" || lifecycle === "revocation_in_progress") return { label: "Deleting", tone: "neutral" };
  if (decidedRunStates.includes(session.task_evaluation_run?.state || "")) return { label: "Result ready", tone: "green" };
  if (session.site_task_testbed?.state === "testbed_ready") return { label: "Testbed ready", tone: "green" };
  if (session.task_review?.status === "task_approval_required") return { label: reviewLabels.task_approval_required, tone: "neutral" };
  if (session.capture_qa?.state === "rejected_or_recapture_required") return { label: "Recapture needed", tone: "red" };
  if (session.reconstruction?.state === "authorization_required") return { label: "Approve the 3D scene plan", tone: "neutral" };
  const review = reviewLabels[session.task_review?.status || ""];
  if (review) return { label: review, tone: session.task_review.status === "task_approved" ? "green" : "neutral" };
  if (session.capture_qa?.state === "failed") return { label: "Check failed", tone: "red" };
  if (session.capture_qa?.state === "capture_accepted") return { label: "Capture accepted", tone: "green" };
  if (session.capture_qa?.state === "validating") return { label: "Checking the capture", tone: "neutral" };
  return {
    label: uploadLabels[session.status] || humanize(session.status),
    tone: ["failed", "cancelled"].includes(session.status) ? "red" : "neutral",
  };
}

const unfinishedUpload = (session: CaptureUploadSession) => ["upload_pending", "uploading"].includes(session.status);
const deleted = (session: CaptureUploadSession) => ["revoked", "revocation_in_progress"].includes(session.status)
  || ["revoked", "revocation_in_progress"].includes(session.completed_capture_lifecycle?.state || "");

export default function Captures() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<WebCaptureAuthorityProfile>("camera_360_equirectangular");
  const [assetMetersPerUnit, setAssetMetersPerUnit] = useState("");
  const [assetUpAxis, setAssetUpAxis] = useState("");
  const providedAsset = profile.startsWith("provided_scene_");
  const [sceneId, setSceneId] = useState("");
  const [deviceManufacturer, setDeviceManufacturer] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [knownTask, setKnownTask] = useState("");
  const [notes, setNotes] = useState("");
  const [privacy, setPrivacy] = useState<"cleared" | "restricted_local_only">("cleared");
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [identity, setIdentity] = useState(newUploadIdentity);
  const [activeSession, setActiveSession] = useState<CaptureUploadSession | null>(null);
  const [sessions, setSessions] = useState<CaptureUploadSession[]>([]);
  const [reviewSession, setReviewSession] = useState<CaptureUploadSession | null>(null);
  const [taskReview, setTaskReview] = useState<CaptureTaskReview | null>(null);
  const [captureQaInspection, setCaptureQaInspection] = useState<CaptureQaInspectionValue | null>(null);
  const [testbedInspection, setTestbedInspection] = useState<CaptureSiteTaskTestbedInspection | null>(null);
  const [runInspection, setRunInspection] = useState<CaptureTaskEvaluationRunInspection | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [runControlSubmitting, setRunControlSubmitting] = useState(false);
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState<string | null>(null);
  const [reconstructionSubmitting, setReconstructionSubmitting] = useState<string | null>(null);
  const [testbedCompiling, setTestbedCompiling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ complete: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const profileDetails = profileCopy[profile];
  const progressPercent = useMemo(() => progress
    ? Math.round((progress.complete / Math.max(1, progress.total)) * 100)
    : 0, [progress]);

  async function refresh() {
    if (!currentUser) return;
    const result = await listCaptureUploads(currentUser);
    setSessions(result.sessions);
    // Keep an open capture in step with the list after any action on it.
    setReviewSession((current) => current
      ? result.sessions.find((session) => session.session_id === current.session_id) || current
      : current);
  }

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setLoading(true);
    listCaptureUploads(currentUser)
      .then((result) => { if (!cancelled) setSessions(result.sessions); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser]);

  function selectFile(selected: File | null) {
    setFile(selected);
    if (!activeSession) setIdentity(newUploadIdentity());
    setError(null);
  }

  function resume(session: CaptureUploadSession) {
    closeCapture();
    setShowUpload(true);
    setActiveSession(session);
    setProfile(session.capture_authority_profile);
    setSceneId(session.scene_id);
    setFile(null);
    setProgress({ complete: session.uploaded_parts.length, total: session.expected_part_count });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCapture() {
    setReviewSession(null);
    setTaskReview(null);
    setCaptureQaInspection(null);
    setTestbedInspection(null);
    setRunInspection(null);
    setError(null);
  }

  function startAnotherUpload() {
    setActiveSession(null);
    setFile(null);
    setProgress(null);
    setIdentity(newUploadIdentity());
    setRightsAccepted(false);
    setConsentAccepted(false);
    setError(null);
  }

  async function openCapture(session: CaptureUploadSession) {
    if (!currentUser) return;
    setReviewSession(session);
    setReviewLoading(true);
    setTaskReview(null);
    setCaptureQaInspection(null);
    setTestbedInspection(null);
    setRunInspection(null);
    setError(null);
    try {
      const [review, qa, inspection, run] = await Promise.all([
        getCaptureTaskReview(currentUser, session.session_id),
        session.capture_qa?.state && session.capture_qa.state !== "not_available"
          ? getCaptureQa(currentUser, session.session_id)
          : Promise.resolve(null),
        session.site_task_testbed?.state === "testbed_ready"
          ? getCaptureSiteTaskTestbed(currentUser, session.session_id)
          : Promise.resolve(null),
        ["decided", "partially_decided", "abstained"].includes(session.task_evaluation_run?.state || "")
          ? getCaptureTaskEvaluationRun(currentUser, session.session_id)
          : Promise.resolve(null),
      ]);
      setTaskReview(review);
      setCaptureQaInspection(qa);
      setTestbedInspection(inspection);
      setRunInspection(run);
      window.scrollTo({ top: 0 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setReviewLoading(false);
    }
  }

  async function submitTaskDecision(
    request: Omit<TaskDecisionCommandRequest, "idempotency_key">,
  ) {
    if (!currentUser || !reviewSession || !taskReview?.discovery) return;
    setDecisionSubmitting(true);
    setError(null);
    try {
      await submitTaskDecisionCommand(currentUser, reviewSession.session_id, {
        ...request,
        discovery_digest: taskReview.discovery.discovery_digest,
        idempotency_key: `web-task-decision-${crypto.randomUUID()}`,
      });
      const [review, latestSession] = await Promise.all([
        getCaptureTaskReview(currentUser, reviewSession.session_id),
        getCaptureUpload(currentUser, reviewSession.session_id),
        refresh(),
      ]);
      setTaskReview(review);
      setReviewSession(latestSession);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDecisionSubmitting(false);
    }
  }

  async function planTaskEvaluationRun() {
    if (!currentUser || !reviewSession) return;
    setRunControlSubmitting(true);
    setError(null);
    try {
      await planCaptureTaskEvaluationRun(
        currentUser,
        reviewSession.session_id,
        `web-plan-${reviewSession.session_id}`,
      );
      const latestSession = await getCaptureUpload(currentUser, reviewSession.session_id);
      setReviewSession(latestSession);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunControlSubmitting(false);
    }
  }

  async function authorizeTaskEvaluationRun(adapterReferences: string[]) {
    if (!currentUser || !reviewSession) return;
    const control = reviewSession.task_evaluation_run_control;
    if (!control || (
      control.state !== "authorization_required" && control.state !== "authorization_failed"
    )) return;
    setRunControlSubmitting(true);
    setError(null);
    try {
      await authorizeCaptureTaskEvaluationRun(
        currentUser,
        reviewSession.session_id,
        control.run_id,
        {
          plan_digest: control.plan_digest,
          authorized_adapter_references: adapterReferences,
          idempotency_key: `web-authorize-${control.run_id}`,
        },
      );
      const latestSession = await getCaptureUpload(currentUser, reviewSession.session_id);
      setReviewSession(latestSession);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunControlSubmitting(false);
    }
  }

  async function executeTaskEvaluationRun() {
    if (!currentUser || !reviewSession) return;
    const control = reviewSession.task_evaluation_run_control;
    if (!control || control.state !== "authorized") return;
    setRunControlSubmitting(true);
    setError(null);
    try {
      await executeCaptureTaskEvaluationRun(
        currentUser,
        reviewSession.session_id,
        control.run_id,
      );
      const [latestSession, inspection] = await Promise.all([
        getCaptureUpload(currentUser, reviewSession.session_id),
        getCaptureTaskEvaluationRun(currentUser, reviewSession.session_id),
      ]);
      setReviewSession(latestSession);
      setRunInspection(inspection);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      const latestSession = await getCaptureUpload(currentUser, reviewSession.session_id).catch(() => null);
      if (latestSession) setReviewSession(latestSession);
    } finally {
      setRunControlSubmitting(false);
    }
  }

  function buildRequest(selectedFile: File): CreateCaptureUploadSession {
    const mediaType = providedAsset ? "application/octet-stream" : selectedFile.type || (profile === "camera_360_native" ? "application/octet-stream" : "video/mp4");
    const videoStream = providedAsset ? "provided_geometry" : profile === "camera_360_native" ? "retained_original" : "retained_video";
    return {
      schema_version: "capture_upload_session_request.v1",
      intake_id: identity.intakeId,
      idempotency_key: identity.idempotencyKey,
      capture_authority_profile: profile,
      source_type: profile,
      scene_id: sceneId.trim(),
      original_file: {
        original_filename: selectedFile.name,
        size_bytes: selectedFile.size,
        media_type: mediaType,
      },
      capture_device: providedAsset ? { status: "not_applicable_provided_geometry" } : {
        manufacturer: deviceManufacturer.trim() || "customer_declared_unknown",
        model: deviceModel.trim() || "customer_declared_unknown",
      },
      timing_declaration: providedAsset ? { status: "not_applicable_provided_geometry" } : profile === "camera_360_native"
        ? { status: "embedded_provider_metadata_unverified" }
        : { clock: "media_pts", monotonic_time_available: false },
      coordinate_frame_declaration: providedAsset ? {
        status: "owner_declared_asset_frame", meters_per_unit: Number(assetMetersPerUnit), up_axis: assetUpAxis,
        physical_scale_measured: false,
      } : { status: "not_available_from_video" },
      available_sensor_streams: [
        { stream_type: videoStream, status: "available" },
        ...(profile.startsWith("camera_360")
          ? [{ stream_type: "camera_metadata", status: "available" as const }]
          : []),
      ],
      governance: {
        rights: "accepted",
        consent: "accepted",
        privacy,
        retention: { max_days: 30 },
        revocation: { supported: true, historical_tombstone_retained: true },
        provider_constraints: { external_processing_allowed: false },
        allowed_uses: ["evaluation"],
      },
      requested_task_evaluation_run_audience: "design_partner",
      known_task_specification: knownTask.trim()
        ? { description: knownTask.trim(), intent_source: "customer_supplied" }
        : null,
      calibration_board_dimensions: null,
      operator_notes: notes.trim() ? [notes.trim()] : [],
      permitted_reconstruction_providers: ["local_only"],
      permitted_evidence_uses: providedAsset ? ["provided_geometry", "development_only"] : ["captured_observation", "task_discovery"],
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !file) return;
    if (file.size < (providedAsset ? 1 : MIN_RESUMABLE_BYTES) || file.size > MAX_CAPTURE_BYTES) {
      setError(providedAsset ? "The file is empty or larger than 50 GB." : "Videos must be larger than 5 MB and no larger than 50 GB.");
      return;
    }
    if (!activeSession && (!rightsAccepted || !consentAccepted)) {
      setError("Confirm the rights and consent statements before uploading.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = activeSession || await createCaptureUpload(currentUser, buildRequest(file));
      setActiveSession(session);
      const refreshed = activeSession
        ? await getCaptureUpload(currentUser, session.session_id)
        : session;
      const completed = await uploadCaptureFile({
        currentUser,
        session: refreshed,
        file,
        onProgress: (complete, total) => setProgress({ complete, total }),
      });
      setActiveSession(completed);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function retryProcessing() {
    if (!currentUser || !activeSession) return;
    setSubmitting(true);
    setError(null);
    try {
      const processed = await retryCaptureUploadProcessing(
        currentUser,
        activeSession.session_id,
      );
      setActiveSession(processed);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeCompletedCapture(session: CaptureUploadSession) {
    if (!currentUser) return;
    const confirmed = window.confirm(
      "Permanently delete this capture and stop any further processing? A record without sensitive data is kept so earlier decisions can still be explained.",
    );
    if (!confirmed) return;
    setLifecycleSubmitting(session.session_id);
    setError(null);
    try {
      await applyCompletedCaptureLifecycle(
        currentUser,
        session.session_id,
        "operator_deletion_request",
        `web-delete-${session.session_id}`,
      );
      if (reviewSession?.session_id === session.session_id) closeCapture();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setLifecycleSubmitting(null);
    }
  }

  async function planReconstruction(session: CaptureUploadSession) {
    if (!currentUser) return;
    setReconstructionSubmitting(session.session_id);
    setError(null);
    try {
      await planCaptureReconstruction(
        currentUser,
        session.session_id,
        ["perception_visibility", "reachability"],
        `web-reconstruction-plan-${session.session_id}`,
      );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setReconstructionSubmitting(null);
    }
  }

  async function authorizeReconstruction(session: CaptureUploadSession) {
    if (!currentUser) return;
    const reconstruction = session.reconstruction;
    const references = reconstruction.authorization_candidates
      ?.map((candidate) => candidate.adapter_reference)
      .filter(Boolean) || [];
    if (!reconstruction.plan_id || !reconstruction.reconstruction_plan_digest || !references.length) {
      setError("Blueprint hasn't proposed a method to approve yet.");
      return;
    }
    setReconstructionSubmitting(session.session_id);
    setError(null);
    try {
      await authorizeCaptureReconstruction(
        currentUser,
        session.session_id,
        reconstruction.plan_id,
        {
          reconstruction_plan_digest: reconstruction.reconstruction_plan_digest,
          authorized_adapter_references: references,
          idempotency_key: `web-reconstruction-authorize-${session.session_id}`,
        },
      );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setReconstructionSubmitting(null);
    }
  }

  async function executeReconstruction(session: CaptureUploadSession) {
    if (!currentUser || !session.reconstruction.plan_id) return;
    setReconstructionSubmitting(session.session_id);
    setError(null);
    try {
      await executeCaptureReconstruction(
        currentUser,
        session.session_id,
        session.reconstruction.plan_id,
        `web-reconstruction-execute-${session.session_id}`,
      );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setReconstructionSubmitting(null);
    }
  }

  async function compileTestbed(command: CaptureTestbedCompilationCommand) {
    if (!currentUser || !reviewSession) return;
    setTestbedCompiling(true);
    setError(null);
    try {
      await compileCaptureTestbed(currentUser, reviewSession.session_id, command);
      const [latestSession, inspection] = await Promise.all([
        getCaptureUpload(currentUser, reviewSession.session_id),
        getCaptureSiteTaskTestbed(currentUser, reviewSession.session_id),
        refresh(),
      ]);
      setReviewSession(latestSession);
      setTestbedInspection(inspection);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setTestbedCompiling(false);
    }
  }

  const detail = reviewSession;
  const detailStatus = detail ? captureStatus(detail) : null;
  const reconstruction = detail?.reconstruction;
  const reconstructionBusy = Boolean(detail && reconstructionSubmitting === detail.session_id);
  const showCompile = Boolean(detail
    && detail.task_review.status === "task_approved"
    && ["completed", "partial", "abstained"].includes(detail.reconstruction.state)
    && !testbedInspection);
  const hasStageContent = Boolean(captureQaInspection || taskReview?.discovery || testbedInspection || runInspection || showCompile);
  const canDelete = Boolean(detail
    && detail.pipeline_handoff?.status === "forwarded"
    && detail.completed_capture_lifecycle?.state === "active");
  const uploadFinished = Boolean(activeSession && (
    activeSession.pipeline_handoff?.status === "forwarded"
    || activeSession.upload_status === "uploaded_verification_pending"
  ));
  const formVisible = !loading && (showUpload || Boolean(activeSession) || !sessions.length);
  const errorAlert = error ? <div className="ws-alert" role="alert"><p>{error}</p></div> : null;

  return (
    <AppShell active="captures" breadcrumb={detail ? "captures / capture" : "captures"}>
      <Helmet><title>Captures · Blueprint</title><meta name="description" content="Upload capture files and follow each one through review." /></Helmet>
      {detail && detailStatus ? (
        <>
          <button type="button" className="ws-back" onClick={closeCapture}>← All captures</button>
          <header className="ws-heading">
            <div>
              <h1 className="break-all">{detail.original_filename}</h1>
              <p className="mt-2">{detail.scene_id} · {profileLabel(detail.capture_authority_profile)}</p>
            </div>
            <Tag tone={detailStatus.tone}>{detailStatus.label}</Tag>
          </header>
          {errorAlert}
          {reviewLoading ? <BuyerAppLoadingState label="Loading this capture…" /> : (
            <div className="flex max-w-4xl flex-col gap-14">
              {hasStageContent ? (
                <p className="text-ink-600">
                  Everything here is a review of your capture or a simulation built from it. None of it shows a robot
                  can do the task in the real world, and none of it approves safety.
                </p>
              ) : (
                <p className="text-ink-600">Nothing to review yet. The capture check shows up here once it's done.</p>
              )}

              {captureQaInspection ? <CaptureQaInspection inspection={captureQaInspection} /> : null}

              {taskReview?.discovery ? (
                <div id="task-review">
                  <TaskCandidateReview review={taskReview} submitting={decisionSubmitting} onSubmit={submitTaskDecision} />
                </div>
              ) : null}

              {reconstruction && (detail.capture_qa?.state === "capture_accepted" || reconstruction.state !== "not_planned") ? (
                <section aria-labelledby="capture-reconstruction">
                  <h2 id="capture-reconstruction">3D scene</h2>
                  {reconstruction.state === "not_planned" ? (
                    <>
                      <p className="mt-2">Blueprint picks how to build a 3D scene from this capture. Nothing runs until you approve the plan.</p>
                      <button type="button" className="ws-secondary mt-5" disabled={reconstructionBusy} onClick={() => void planReconstruction(detail)}>Plan the 3D scene</button>
                    </>
                  ) : null}
                  {reconstruction.state === "authorization_required" ? (
                    <>
                      <p className="mt-2">
                        Planned methods: {(reconstruction.authorization_candidates || []).map((candidate) => candidate.method_id).join(", ") || "none"}
                        {" "}· estimated ${Number(reconstruction.cost_usd || 0).toFixed(2)}
                      </p>
                      <button type="button" className="ws-primary mt-5" disabled={reconstructionBusy} onClick={() => void authorizeReconstruction(detail)}>Approve the plan</button>
                    </>
                  ) : null}
                  {reconstruction.state === "authorized" ? (
                    <>
                      <p className="mt-2">Plan approved.</p>
                      <button type="button" className="ws-primary mt-5" disabled={reconstructionBusy} onClick={() => void executeReconstruction(detail)}>Build the 3D scene</button>
                    </>
                  ) : null}
                  {["completed", "partial", "abstained"].includes(reconstruction.state) ? (
                    <p className="mt-2">
                      {reconstruction.state === "completed" ? "Built." : reconstruction.state === "partial" ? "Partly built." : "Not built: the capture wasn't enough to build it."}
                      {reconstruction.missing_representations?.length ? ` Missing: ${reconstruction.missing_representations.map(humanize).join(", ")}.` : ""}
                    </p>
                  ) : null}
                  {reconstruction.next_cheapest_experiments?.length ? (
                    <p className="mt-2 text-sm text-ink-600">Next: {reconstruction.next_cheapest_experiments.map(humanize).join("; ")}</p>
                  ) : null}
                  {reconstruction.blocker ? <p className="mt-2 text-sm text-ink-500">Waiting on: {humanize(reconstruction.blocker)}</p> : null}
                </section>
              ) : null}

              {showCompile ? (
                <TestbedCompilationControl sceneId={detail.scene_id} busy={testbedCompiling} onCompile={compileTestbed} />
              ) : null}

              {testbedInspection ? <SiteTaskTestbedInspection inspection={testbedInspection} /> : null}

              {testbedInspection?.decision_evidence_request && !runInspection ? (
                <TaskEvaluationRunControl
                  control={detail.task_evaluation_run_control}
                  busy={runControlSubmitting}
                  onPlan={planTaskEvaluationRun}
                  onAuthorize={authorizeTaskEvaluationRun}
                  onExecute={executeTaskEvaluationRun}
                />
              ) : null}

              {runInspection ? <TaskEvaluationRunInspection inspection={runInspection} /> : null}

              {canDelete ? (
                <section aria-labelledby="capture-delete">
                  <h2 id="capture-delete" className="sr-only">Delete</h2>
                  <button type="button" className="ws-link" disabled={lifecycleSubmitting === detail.session_id} onClick={() => void revokeCompletedCapture(detail)}>
                    {lifecycleSubmitting === detail.session_id ? "Deleting…" : "Delete capture"}
                  </button>
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <>
          <header className="ws-heading">
            <div>
              <h1>Captures</h1>
              <p className="mt-2">Upload capture files for your tasks, then follow each one through review.</p>
            </div>
            {!formVisible && !loading ? (
              <button type="button" className="ws-primary" onClick={() => setShowUpload(true)}>Upload a capture</button>
            ) : null}
          </header>
          {formVisible ? null : errorAlert}
          {loading ? <BuyerAppLoadingState /> : null}

          {formVisible ? (
            activeSession && uploadFinished ? (
              <section className="ws-section max-w-3xl" aria-labelledby="upload-received" aria-live="polite">
                <h2 id="upload-received">Upload received</h2>
                <p className="mt-2">
                  {activeSession.pipeline_handoff?.status === "forwarded"
                    ? "We checked the file and recorded it. The capture check comes next."
                    : "We're still checking the file. This can take a few minutes."}
                </p>
                {activeSession.pipeline_handoff?.status !== "forwarded" && activeSession.pipeline_handoff?.blocker ? (
                  <p className="mt-2 text-sm text-ink-500">Waiting on: {humanize(activeSession.pipeline_handoff.blocker)}</p>
                ) : null}
                {errorAlert ? <div className="mt-4">{errorAlert}</div> : null}
                <div className="ws-form-actions">
                  {activeSession.pipeline_handoff?.status !== "forwarded" ? (
                    <button type="button" className="ws-secondary" onClick={() => void retryProcessing()} disabled={submitting}>Check again</button>
                  ) : null}
                  <button type="button" className="ws-link" onClick={() => void openCapture(activeSession)}>Open this capture</button>
                  <button type="button" className="ws-link" onClick={startAnotherUpload}>Upload another</button>
                </div>
              </section>
            ) : (
              <form onSubmit={submit} className="ws-form ws-section" aria-labelledby="upload-heading">
                <h2 id="upload-heading">{activeSession ? "Resume your upload" : "Upload a capture"}</h2>
                <div className="ws-fields">
                  <Field label="Capture type" hint={profileDetails.hint} wide>
                    <select id="capture-profile" value={profile} disabled={Boolean(activeSession)} onChange={(event) => { setProfile(event.target.value as WebCaptureAuthorityProfile); setFile(null); }}>
                      {Object.entries(profileCopy).map(([value, copy]) => <option key={value} value={value}>{copy.label}</option>)}
                    </select>
                  </Field>
                  {providedAsset && !activeSession ? (
                    <>
                      <Field label="Asset units" hint="Use your provider's export settings.">
                        <select required value={assetMetersPerUnit} onChange={(event) => setAssetMetersPerUnit(event.target.value)}>
                          <option value="">Choose units</option><option value="1">Meters</option><option value="0.01">Centimeters</option><option value="0.001">Millimeters</option>
                        </select>
                      </Field>
                      <Field label="Up axis">
                        <select required value={assetUpAxis} onChange={(event) => setAssetUpAxis(event.target.value)}>
                          <option value="">Choose the up axis</option><option value="Z">Z up</option><option value="Y">Y up</option>
                        </select>
                      </Field>
                    </>
                  ) : null}
                  <Field label="Scene ID" hint="A short ID for the space, like warehouse-cell-a." wide>
                    <input required disabled={Boolean(activeSession)} value={sceneId} onChange={(event) => setSceneId(event.target.value)} />
                  </Field>
                  <Field
                    label="Capture file"
                    hint={activeSession ? `Choose ${activeSession.original_filename} (${activeSession.size_bytes.toLocaleString()} bytes) again to resume. We check the parts already stored against it.` : undefined}
                    wide
                  >
                    <input id="capture-file" type="file" required accept={profileDetails.accept} onChange={(event) => selectFile(event.target.files?.[0] || null)} />
                  </Field>
                </div>

                {!activeSession ? (
                  <details className="mt-8">
                    <summary>Optional details</summary>
                    <div className="ws-fields">
                      {!providedAsset ? (
                        <>
                          <Field label="Camera manufacturer"><input value={deviceManufacturer} onChange={(event) => setDeviceManufacturer(event.target.value)} placeholder="Insta360, Apple, other" /></Field>
                          <Field label="Camera model"><input value={deviceModel} onChange={(event) => setDeviceModel(event.target.value)} placeholder="X5, iPhone 17 Pro, other" /></Field>
                        </>
                      ) : null}
                      <Field label="The task, if you know it" hint="Leave blank and we'll propose tasks for you to approve." wide>
                        <textarea rows={3} value={knownTask} onChange={(event) => setKnownTask(event.target.value)} />
                      </Field>
                      <Field label="Notes" wide>
                        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Where the robot would stand, calibration board, blocked views, restrictions…" />
                      </Field>
                    </div>
                  </details>
                ) : null}

                {!activeSession ? (
                  <>
                    <label className="ws-check"><input type="checkbox" checked={rightsAccepted} onChange={(event) => setRightsAccepted(event.target.checked)} /><span>I have the right to upload this capture for evaluation.</span></label>
                    <label className="ws-check"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} /><span>The site and anyone in the capture have given the consent they need to.</span></label>
                    <div className="ws-fields mt-6">
                      <Field label="Privacy">
                        <select value={privacy} onChange={(event) => setPrivacy(event.target.value as typeof privacy)}>
                          <option value="cleared">Cleared for evaluation use</option>
                          <option value="restricted_local_only">Local processing only</option>
                        </select>
                      </Field>
                    </div>
                  </>
                ) : null}

                {errorAlert ? <div className="mt-6">{errorAlert}</div> : null}
                {progress ? (
                  <div className="mt-6" aria-live="polite">
                    <div className="h-1.5 overflow-hidden bg-inset" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
                      <div className="h-full bg-[var(--ws-green)] transition-[width]" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="mt-2 text-sm tabular-nums">{progress.complete} / {progress.total} parts · {progressPercent}%</p>
                  </div>
                ) : null}
                <p className="ws-note">Uploading isn't acceptance. We check the file and tell you if anything needs recapturing.</p>
                <div className="ws-form-actions">
                  <button type="submit" className="ws-primary" disabled={submitting || !file}>{submitting ? "Uploading…" : activeSession ? "Resume upload" : "Upload"}</button>
                  {sessions.length ? <button type="button" className="ws-link" onClick={() => { startAnotherUpload(); setShowUpload(false); }}>Cancel</button> : null}
                </div>
                <details className="mt-10">
                  <summary>Capture tips</summary>
                  <ul className="list-disc space-y-2 pl-5 text-sm">
                    <li>Move slowly and overlap your passes.</li>
                    <li>Show where the robot would stand and how it gets there.</li>
                    <li>Circle the task objects closely, including the back and underside.</li>
                    <li>Keep people, screens, documents, and moving things out of view when you can.</li>
                    <li>Include a measured calibration board if exact size matters.</li>
                  </ul>
                </details>
              </form>
            )
          ) : null}

          {!loading && sessions.length ? (
            <section className="ws-section" aria-labelledby="capture-list">
              <h2 id="capture-list">Your captures</h2>
              <div className="mt-4">
                {sessions.map((session) => {
                  const status = captureStatus(session);
                  return (
                    <article className="ws-task-row" key={session.session_id}>
                      <div className="ws-task-copy">
                        <h3 className="break-all">{session.original_filename}</h3>
                        <p className="ws-muted">{session.scene_id} · {profileLabel(session.capture_authority_profile)}</p>
                        <p><Tag tone={status.tone}>{status.label}</Tag></p>
                      </div>
                      {unfinishedUpload(session) ? (
                        <button type="button" className="ws-link" onClick={() => resume(session)}>Resume upload</button>
                      ) : !deleted(session) ? (
                        <button type="button" className="ws-link" onClick={() => void openCapture(session)}>Open</button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {currentUser ? (
            <details className="ws-section">
              <summary>Request an evaluation on a completed scene</summary>
              <SceneIntakeForm key={JSON.stringify([currentUser.uid, currentUser.tenantId || null])} currentUser={currentUser} sessions={sessions} />
            </details>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
