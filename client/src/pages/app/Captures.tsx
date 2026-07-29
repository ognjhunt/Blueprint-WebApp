import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, UploadCloud } from "lucide-react";

import { Button, Card, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { TaskCandidateReview } from "@/components/blueprint/app/TaskCandidateReview";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCaptureUpload,
  getCaptureTaskReview,
  getCaptureUpload,
  listCaptureUploads,
  submitTaskDecisionCommand,
  uploadCaptureFile,
  type CaptureTaskReview,
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
  if (status === "uploaded_verification_pending") return "warn";
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
    cancelled: "Cancelled",
    failed: "Failed",
  };
  return labels[status] || status.replace(/_/g, " ");
}

function SessionHistory({
  sessions,
  onResume,
  onReview,
}: {
  sessions: CaptureUploadSession[];
  onResume: (session: CaptureUploadSession) => void;
  onReview: (session: CaptureUploadSession) => void;
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
                <td className="px-4 py-3"><StatusChip tone={statusTone(session.status)} square>{statusLabel(session.status)}</StatusChip></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {["task_approval_required", "decision_pending_pipeline_validation"].includes(session.task_review.status) ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => onReview(session)}>Review tasks</Button>
                    ) : null}
                    {["upload_pending", "uploading"].includes(session.status) ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => onResume(session)}>Resume</Button>
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
  const [reviewLoading, setReviewLoading] = useState(false);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
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
    setError(null);
    try {
      const review = await getCaptureTaskReview(currentUser, session.session_id);
      setTaskReview(review);
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
      const [review] = await Promise.all([
        getCaptureTaskReview(currentUser, reviewSession.session_id),
        refresh(),
      ]);
      setTaskReview(review);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDecisionSubmitting(false);
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
            {activeSession?.status === "uploaded_verification_pending" ? <ProofBoundary level="proof" title="Upload retained" icon={CheckCircle2}>The provider-listed bytes are complete. Content hashing, malware/content validation, capture QA, and any recapture decision remain pending.</ProofBoundary> : null}
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

        {loading ? <BuyerAppLoadingState /> : (
          <SessionHistory sessions={sessions} onResume={resume} onReview={reviewTasks} />
        )}
      </div>
    </AppShell>
  );
}
