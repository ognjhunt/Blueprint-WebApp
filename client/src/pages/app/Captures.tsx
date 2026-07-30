import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, UploadCloud } from "lucide-react";

import { Button, Card, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { CaptureQaInspection } from "@/components/blueprint/app/CaptureQaInspection";
import { TaskCandidateReview } from "@/components/blueprint/app/TaskCandidateReview";
import { SiteTaskTestbedInspection } from "@/components/blueprint/app/SiteTaskTestbedInspection";
import { TaskEvaluationRunInspection } from "@/components/blueprint/app/TaskEvaluationRunInspection";
import { TaskEvaluationRunControl } from "@/components/blueprint/app/TaskEvaluationRunControl";
import { TestbedCompilationControl } from "@/components/blueprint/app/TestbedCompilationControl";
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

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-body-s text-ink-900 shadow-sm outline-none focus:border-action focus:ring-2 focus:ring-action/20";
const labelClass = "text-body-s font-semibold text-ink-800";
const MIN_RESUMABLE_BYTES = 5 * 1024 * 1024 + 1;
const MAX_CAPTURE_BYTES = 50 * 1024 * 1024 * 1024;

const profileCopy: Record<WebCaptureAuthorityProfile, { label: string; detail: string; accept: string }> = {
  camera_360_equirectangular: {
    label: "360 equirectangular video",
    detail: "Stitched MP4/MOV with camera metadata. Observation and task discovery only until scale or calibration is separately verified.",
    accept: ".mp4,.mov,video/mp4,video/quicktime",
  },
  camera_360_native: {
    label: "Insta360 native capture",
    detail: "Original INSV container is retained. Any normalized derivative stays hash-bound and derived.",
    accept: ".insv,application/octet-stream",
  },
  monocular_video: {
    label: "Ordinary video",
    detail: "Reduced-authority lane for observation review and task discovery; no inherent scale, poses, depth, collision truth, or physical outcome.",
    accept: ".mp4,.mov,video/mp4,video/quicktime",
  },
};

function newUploadIdentity() {
  const value = crypto.randomUUID();
  return {
    intakeId: `intake-${value}`,
    idempotencyKey: `web-capture-${value}`,
  };
}

function statusTone(status: string): "proof" | "warn" | "block" | "neutral" {
  if (status === "revoked") return "block";
  if (status === "revocation_in_progress") return "warn";
  if (["uploaded_verification_pending", "validating", "capture_accepted", "rejected_or_recapture_required"].includes(status)) return "warn";
  if (["failed", "cancelled"].includes(status)) return "block";
  if (["upload_pending", "uploading"].includes(status)) return "neutral";
  return "neutral";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    provider_start_pending: "Preparing storage",
    upload_pending: "Ready to upload",
    uploading: "Upload in progress",
    uploaded_verification_pending: "Uploaded · verification pending",
    validating: "Capture validation in progress",
    capture_accepted: "Intake admitted · capture QA pending",
    rejected_or_recapture_required: "Recapture review required",
    cancelled: "Cancelled",
    failed: "Failed",
    revocation_in_progress: "Deletion in progress",
    revoked: "Deleted and revoked",
    authorization_required: "Reconstruction authorization required",
    authorized: "Reconstruction authorized",
    completed: "Reconstruction complete",
    partial: "Partial reconstruction",
    abstained: "Reconstruction abstained",
  };
  return labels[status] || status.replace(/_/g, " ");
}

function SessionHistory({
  sessions,
  onResume,
  onReview,
  onRevoke,
  lifecycleSubmitting,
  onPlanReconstruction,
  onAuthorizeReconstruction,
  onExecuteReconstruction,
  reconstructionSubmitting,
}: {
  sessions: CaptureUploadSession[];
  onResume: (session: CaptureUploadSession) => void;
  onReview: (session: CaptureUploadSession) => void;
  onRevoke: (session: CaptureUploadSession) => void;
  lifecycleSubmitting: string | null;
  onPlanReconstruction: (session: CaptureUploadSession) => void;
  onAuthorizeReconstruction: (session: CaptureUploadSession) => void;
  onExecuteReconstruction: (session: CaptureUploadSession) => void;
  reconstructionSubmitting: string | null;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label="Capture upload history">
      <h2 className="text-title-m font-semibold tracking-tight text-ink-900">History</h2>
      {sessions.length ? (
        <div className="overflow-x-auto rounded-md border border-line bg-white">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead><tr className="border-b border-line">
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Capture</th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Profile</th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Status</th>
              <th className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"><span className="sr-only">Action</span></th>
            </tr></thead>
            <tbody>{sessions.map((session) => (
              <tr key={session.session_id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-3"><span className="block text-body-s font-semibold text-ink-900">{session.original_filename}</span><span className="font-mono text-[0.68rem] text-ink-400">{session.intake_id}</span></td>
                <td className="px-4 py-3 text-body-s text-ink-600">{profileCopy[session.capture_authority_profile].label}</td>
                <td className="px-4 py-3">
                  <StatusChip tone={statusTone(session.status)} square>{statusLabel(session.status)}</StatusChip>
                  {session.reconstruction?.state && session.reconstruction.state !== "not_planned" ? (
                    <span className="mt-1 block text-body-xs text-ink-500">
                      {statusLabel(session.reconstruction.state)}
                      {session.reconstruction.missing_representations?.length
                        ? ` · missing ${session.reconstruction.missing_representations.join(", ")}`
                        : ""}
                    </span>
                  ) : null}
                  {session.reconstruction?.authorization_candidates?.length ? (
                    <span className="mt-1 block max-w-sm text-body-xs text-ink-500">
                      Planned methods: {session.reconstruction.authorization_candidates
                        .map((candidate) => `${candidate.method_id} (${candidate.adapter_reference})`)
                        .join(", ")} · estimated ${Number(session.reconstruction.cost_usd || 0).toFixed(2)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {["task_approval_required", "decision_pending_pipeline_validation", "task_approved"].includes(session.task_review.status) || !["not_available", undefined].includes(session.capture_qa?.state) || session.site_task_testbed?.state === "testbed_ready" || ["decided", "partially_decided", "abstained"].includes(session.task_evaluation_run?.state || "") ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => onReview(session)}>{["decided", "partially_decided", "abstained"].includes(session.task_evaluation_run?.state || "") ? "View decision" : session.site_task_testbed?.state === "testbed_ready" ? "Inspect testbed" : session.capture_qa?.state === "rejected_or_recapture_required" ? "View recapture" : session.capture_qa?.state && session.capture_qa.state !== "not_available" ? "View capture QA" : "Review tasks"}</Button>
                    ) : null}
                    {["upload_pending", "uploading"].includes(session.status) ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => onResume(session)}>Resume</Button>
                    ) : null}
                    {session.pipeline_handoff?.status === "forwarded" && session.completed_capture_lifecycle?.state === "active" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={lifecycleSubmitting === session.session_id}
                        onClick={() => onRevoke(session)}
                      >
                        {lifecycleSubmitting === session.session_id ? "Deleting…" : "Delete capture"}
                      </Button>
                    ) : null}
                    {session.capture_qa?.state === "capture_accepted" && session.reconstruction?.state === "not_planned" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={reconstructionSubmitting === session.session_id}
                        onClick={() => onPlanReconstruction(session)}
                      >Plan reconstruction</Button>
                    ) : null}
                    {session.reconstruction?.state === "authorization_required" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={reconstructionSubmitting === session.session_id}
                        onClick={() => onAuthorizeReconstruction(session)}
                      >Authorize reconstruction</Button>
                    ) : null}
                    {session.reconstruction?.state === "authorized" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={reconstructionSubmitting === session.session_id}
                        onClick={() => onExecuteReconstruction(session)}
                      >Run reconstruction</Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Card pad="md"><p className="text-body-s text-ink-500">No capture upload sessions yet.</p></Card>}
    </section>
  );
}

export default function Captures() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<WebCaptureAuthorityProfile>("camera_360_equirectangular");
  const [sceneId, setSceneId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
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

  const profileDetails = profileCopy[profile];
  const progressPercent = useMemo(() => progress
    ? Math.round((progress.complete / Math.max(1, progress.total)) * 100)
    : 0, [progress]);

  async function refresh() {
    if (!currentUser) return;
    const result = await listCaptureUploads(currentUser);
    setSessions(result.sessions);
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
    setActiveSession(session);
    setProfile(session.capture_authority_profile);
    setSceneId(session.scene_id);
    setFile(null);
    setProgress({ complete: session.uploaded_parts.length, total: session.expected_part_count });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reviewTasks(session: CaptureUploadSession) {
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
      window.setTimeout(() => {
        document.getElementById("task-review")?.scrollIntoView({ behavior: "smooth" });
      }, 0);
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
    const mediaType = selectedFile.type || (profile === "camera_360_native" ? "application/octet-stream" : "video/mp4");
    const videoStream = profile === "camera_360_native" ? "retained_original" : "retained_video";
    return {
      schema_version: "capture_upload_session_request.v1",
      intake_id: identity.intakeId,
      idempotency_key: identity.idempotencyKey,
      capture_authority_profile: profile,
      source_type: profile,
      scene_id: sceneId.trim(),
      organization_id: organizationId.trim() || undefined,
      original_file: {
        original_filename: selectedFile.name,
        size_bytes: selectedFile.size,
        media_type: mediaType,
      },
      capture_device: {
        manufacturer: deviceManufacturer.trim() || "customer_declared_unknown",
        model: deviceModel.trim() || "customer_declared_unknown",
      },
      timing_declaration: profile === "camera_360_native"
        ? { status: "embedded_provider_metadata_unverified" }
        : { clock: "media_pts", monotonic_time_available: false },
      coordinate_frame_declaration: { status: "not_available_from_video" },
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
      permitted_evidence_uses: ["captured_observation", "task_discovery"],
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !file) return;
    if (file.size < MIN_RESUMABLE_BYTES || file.size > MAX_CAPTURE_BYTES) {
      setError("Capture video must be larger than 5 MiB and no larger than 50 GiB for this resumable lane.");
      return;
    }
    if (!activeSession && (!rightsAccepted || !consentAccepted)) {
      setError("Rights and consent confirmation are required before upload.");
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
      "Permanently delete this completed capture and revoke future processing? Historical non-sensitive digests remain so prior decisions can still be explained.",
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
      setError("Pipeline did not provide an executable reconstruction candidate.");
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

  return (
    <AppShell active="captures" breadcrumb="captures">
      <Helmet><title>Captures · Blueprint</title><meta name="description" content="Secure, resumable capture upload for Task Evaluation Runs." /></Helmet>
      <div className="mx-auto flex max-w-[72rem] flex-col gap-7 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-1.5">
          <Eyebrow tone="brass" rule>Capture intake</Eyebrow>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink-900">New Capture</h1>
          <p className="max-w-3xl text-body-s text-ink-500">Upload one rights-cleared capture. Blueprint keeps the original file, validates it, and returns either a precise recapture request or a testbed-ready result.</p>
        </header>

        <ProofBoundary level="info" title="What upload completion means" icon={AlertTriangle}>
          Upload completion is not capture acceptance. Server SHA-256, malware/content checks, media QA, metric authority, and task-critical coverage remain pending until Pipeline reports them.
        </ProofBoundary>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card pad="lg" className="flex flex-col gap-5">
            <div>
              <label className={labelClass} htmlFor="capture-profile">Capture type</label>
              <select id="capture-profile" className={fieldClass} value={profile} disabled={Boolean(activeSession)} onChange={(event) => { setProfile(event.target.value as WebCaptureAuthorityProfile); setFile(null); }}>
                {Object.entries(profileCopy).map(([value, copy]) => <option key={value} value={value}>{copy.label}</option>)}
              </select>
              <p className="mt-2 text-body-s text-ink-500">{profileDetails.detail}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label><span className={labelClass}>Scene ID</span><input className={fieldClass} required disabled={Boolean(activeSession)} value={sceneId} onChange={(event) => setSceneId(event.target.value)} placeholder="warehouse-cell-a" /></label>
              <label><span className={labelClass}>Organization ID</span><input className={fieldClass} disabled={Boolean(activeSession)} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="Uses account organization when available" /></label>
              <label><span className={labelClass}>Camera manufacturer</span><input className={fieldClass} disabled={Boolean(activeSession)} value={deviceManufacturer} onChange={(event) => setDeviceManufacturer(event.target.value)} placeholder="Insta360, Apple, other" /></label>
              <label><span className={labelClass}>Camera model</span><input className={fieldClass} disabled={Boolean(activeSession)} value={deviceModel} onChange={(event) => setDeviceModel(event.target.value)} placeholder="X5, iPhone 17 Pro, other" /></label>
            </div>

            <label><span className={labelClass}>Exact task, if already known</span><textarea className={fieldClass} disabled={Boolean(activeSession)} rows={3} value={knownTask} onChange={(event) => setKnownTask(event.target.value)} placeholder="Leave blank to request task candidates. Inferred intent will require approval." /></label>
            <label><span className={labelClass}>Operator notes</span><textarea className={fieldClass} disabled={Boolean(activeSession)} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Placement area, calibration board, occlusions, restrictions…" /></label>

            <div>
              <label className={labelClass} htmlFor="capture-file">Capture file</label>
              <input id="capture-file" className={fieldClass} type="file" required accept={profileDetails.accept} onChange={(event) => selectFile(event.target.files?.[0] || null)} />
              {activeSession ? <p className="mt-2 text-body-s text-ink-500">Reselect exactly <strong>{activeSession.original_filename}</strong> ({activeSession.size_bytes.toLocaleString()} bytes) to resume. Stored parts are checked against the reselected file.</p> : null}
            </div>

            {!activeSession ? <div className="space-y-3 rounded-md border border-line bg-inset p-4">
              <label className="flex items-start gap-3 text-body-s text-ink-700"><input className="mt-1" type="checkbox" checked={rightsAccepted} onChange={(event) => setRightsAccepted(event.target.checked)} /><span>I have the right to upload this capture for the declared evaluation use.</span></label>
              <label className="flex items-start gap-3 text-body-s text-ink-700"><input className="mt-1" type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} /><span>Required site and bystander consent has been obtained.</span></label>
              <label><span className={labelClass}>Privacy handling</span><select className={fieldClass} value={privacy} onChange={(event) => setPrivacy(event.target.value as typeof privacy)}><option value="cleared">Cleared for declared evaluation use</option><option value="restricted_local_only">Restricted to local-only processing</option></select></label>
            </div> : null}

            {error ? <BuyerAppErrorState message={error} /> : null}
            {progress ? <div aria-live="polite"><div className="mb-2 flex justify-between text-body-s text-ink-600"><span>Upload progress</span><span>{progress.complete}/{progress.total} parts · {progressPercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full bg-action transition-all" style={{ width: `${progressPercent}%` }} /></div></div> : null}
            <Button type="submit" variant="action" iconLeft={<UploadCloud />} disabled={submitting || !file}>{submitting ? "Uploading…" : activeSession ? "Resume upload" : "Start secure upload"}</Button>
          </Card>

          <aside className="flex flex-col gap-4">
            <Card pad="md"><h2 className="font-semibold text-ink-900">Capture guidance</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-body-s text-ink-600"><li>Move slowly and use overlapping passes.</li><li>Show the robot placement area and access path.</li><li>Capture close orbits around task objects, including rear and underside views.</li><li>Keep people, screens, documents, and moving objects out when possible.</li><li>Include a measured calibration board when metric scale matters.</li></ul><p className="mt-3 text-body-s font-semibold text-ink-700">These are advisory hints, not reconstruction or task-success claims.</p></Card>
            {activeSession?.upload_status === "uploaded_verification_pending" && activeSession.pipeline_handoff?.status !== "forwarded" ? <>
              <ProofBoundary level="warn" title="Upload retained · Pipeline intake pending" icon={CheckCircle2}>The provider-listed parts are complete, but server SHA-256, malware/content validation, and immutable intake have not all completed. Capture QA and any recapture decision remain pending.</ProofBoundary>
              <Button type="button" variant="secondary" onClick={retryProcessing} disabled={submitting}>Retry secure processing</Button>
              {activeSession.pipeline_handoff?.blocker ? <p className="text-body-xs text-ink-500">Current blocker: {activeSession.pipeline_handoff.blocker.replace(/_/g, " ")}</p> : null}
            </> : null}
            {activeSession?.pipeline_handoff?.status === "forwarded" ? <ProofBoundary level="proof" title="Immutable intake and Capture QA recorded" icon={CheckCircle2}>Pipeline verified server-side size and SHA-256, received a clean malware-scanner result, content-addressed the raw input, and returned a separate deterministic Capture QA result. Reconstruction and task success remain separate gates.</ProofBoundary> : null}
          </aside>
        </form>

        {reviewLoading ? <BuyerAppLoadingState /> : taskReview?.discovery ? (
          <div id="task-review">
            <TaskCandidateReview
              review={taskReview}
              submitting={decisionSubmitting}
              onSubmit={submitTaskDecision}
            />
          </div>
        ) : null}

        {captureQaInspection ? <CaptureQaInspection inspection={captureQaInspection} /> : null}

        {reviewSession?.task_review.status === "task_approved"
          && ["completed", "partial", "abstained"].includes(reviewSession.reconstruction.state)
          && !testbedInspection ? (
            <TestbedCompilationControl
              sceneId={reviewSession.scene_id}
              busy={testbedCompiling}
              onCompile={compileTestbed}
            />
          ) : null}

        {testbedInspection ? <SiteTaskTestbedInspection inspection={testbedInspection} /> : null}

        {testbedInspection?.decision_evidence_request && !runInspection ? (
          <TaskEvaluationRunControl
            control={reviewSession?.task_evaluation_run_control}
            busy={runControlSubmitting}
            onPlan={planTaskEvaluationRun}
            onAuthorize={authorizeTaskEvaluationRun}
            onExecute={executeTaskEvaluationRun}
          />
        ) : null}

        {runInspection ? <TaskEvaluationRunInspection inspection={runInspection} /> : null}

        {loading ? <BuyerAppLoadingState /> : (
          <SessionHistory
            sessions={sessions}
            onResume={resume}
            onReview={reviewTasks}
            onRevoke={revokeCompletedCapture}
            lifecycleSubmitting={lifecycleSubmitting}
            onPlanReconstruction={planReconstruction}
            onAuthorizeReconstruction={authorizeReconstruction}
            onExecuteReconstruction={executeReconstruction}
            reconstructionSubmitting={reconstructionSubmitting}
          />
        )}
      </div>
    </AppShell>
  );
}
