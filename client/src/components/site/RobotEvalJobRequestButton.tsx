import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  PlayCircle,
  Radio,
  ShieldCheck,
} from "lucide-react";
import type { SiteLibrarySite } from "@/data/siteLibrary";
import {
  buildRobotEvalJobRequestFromSite,
  defaultSimulatorEvalTasksForSite,
  type RobotEvalSimulatorTaskSelection,
} from "@/lib/robotEvalJobRequest";

type StatusState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "accepted";
      request: Record<string, unknown>;
      response: Record<string, unknown>;
    }
  | {
      kind: "forwarding_failed";
      request: Record<string, unknown>;
      response: Record<string, unknown>;
      message: string;
    }
  | { kind: "error"; message: string };

type PipelineForwardState = {
  status?: string;
  accepted?: boolean;
  performed?: boolean;
  pipeline_status?: string;
};

function idFromRequest(request: Record<string, unknown>, path: string[]) {
  let cursor: unknown = request;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") {
      return "";
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" ? cursor : "";
}

function statusTone(tone: "idle" | "ready" | "blocked") {
  if (tone === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (tone === "blocked") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function StatusChip({
  label,
  value,
  tone = "idle",
}: {
  label: string;
  value: string;
  tone?: "idle" | "ready" | "blocked";
}) {
  return (
    <div className={`self-start border px-3 py-2 ${statusTone(tone)}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}

function requestStatusChips(status: StatusState) {
  if (status.kind === "accepted") {
    const pipelineForward = (status.response.pipelineForward || {}) as PipelineForwardState;
    const forwarded = pipelineForward.status === "forwarded" && pipelineForward.accepted === true;
    return [
      { label: "WebApp queued", value: "Accepted", tone: "ready" as const },
      {
        label: "Pipeline staged",
        value: forwarded
          ? String(pipelineForward.pipeline_status || "Staged")
          : pipelineForward.status === "not_configured"
            ? "Awaiting forward config"
            : "Queued locally",
        tone: forwarded ? ("ready" as const) : ("idle" as const),
      },
      { label: "Provider running", value: "Awaiting Pipeline", tone: "idle" as const },
      { label: "Complete / failed", value: "No run artifact yet", tone: "idle" as const },
    ];
  }
  if (status.kind === "forwarding_failed") {
    return [
      { label: "WebApp queued", value: "Inbox stored", tone: "ready" as const },
      { label: "Pipeline staged", value: "Forward failed", tone: "blocked" as const },
      { label: "Provider running", value: "Not started", tone: "idle" as const },
      { label: "Complete / failed", value: "No run artifact yet", tone: "idle" as const },
    ];
  }
  return [
    { label: "WebApp queued", value: "Ready to submit", tone: "idle" as const },
    { label: "Pipeline staged", value: "After submit", tone: "idle" as const },
    { label: "Provider running", value: "After Pipeline", tone: "idle" as const },
    { label: "Complete / failed", value: "When artifacts sync", tone: "idle" as const },
  ];
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0 border border-black/10 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all text-xs font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function RobotEvalJobRequestPanel({
  site,
  source,
  className = "",
}: {
  site: SiteLibrarySite;
  source: "sites" | "site-detail";
  className?: string;
}) {
  const taskOptions = useMemo(() => defaultSimulatorEvalTasksForSite(site), [site]);
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(() => [
    taskOptions[0]?.taskId || "walk_to_target",
  ]);

  const selectedTasks = taskOptions.filter((task) => selectedTaskIds.includes(task.taskId));
  const hasTasks = selectedTasks.length > 0;
  const disabled =
    status.kind === "submitting" ||
    !hasTasks ||
    !site.robotEvalPublication?.readyToEvaluatePublishable ||
    !site.defaultRobotEvalSelection;

  function toggleTask(task: RobotEvalSimulatorTaskSelection) {
    setSelectedTaskIds((current) => {
      if (current.includes(task.taskId)) {
        return current.filter((id) => id !== task.taskId);
      }
      return [...current, task.taskId];
    });
    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  }

  async function submitJobRequest() {
    if (!hasTasks) {
      setStatus({ kind: "error", message: "Select at least one task for this simulator run." });
      return;
    }

    const jobRequest = buildRobotEvalJobRequestFromSite(
      site,
      {
        route: `/sites/${site.slug}`,
        surface: source,
      },
      { simulatorTasks: selectedTasks },
    ) as Record<string, unknown>;

    try {
      setStatus({ kind: "submitting" });
      // WEB-02: the endpoint now requires an authenticated buyer. Attach the
      // Firebase ID token; prompt sign-in if there is no current user.
      const firebase = await import("@/lib/firebase");
      const currentUser = firebase.auth?.currentUser ?? null;
      if (!currentUser) {
        setStatus({
          kind: "error",
          message: "Please sign in as a robot team to submit an evaluation job.",
        });
        return;
      }
      const { withFirebaseAuthHeaders } = await import("@/lib/firebaseAuthHeaders");
      const headers = await withFirebaseAuthHeaders(currentUser, {
        "Content-Type": "application/json",
      });
      const response = await fetch("/api/robot-eval/job-requests", {
        method: "POST",
        headers,
        body: JSON.stringify(jobRequest),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const responseRequest = (data.jobRequest as Record<string, unknown> | undefined) || jobRequest;

      if (!response.ok) {
        setStatus({
          kind: "forwarding_failed",
          request: responseRequest,
          response: data,
          message: String(data.error || `Forwarding failed with ${response.status}`),
        });
        return;
      }

      setStatus({ kind: "accepted", request: responseRequest, response: data });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Request failed",
      });
    }
  }

  const submittedRequest =
    status.kind === "accepted" || status.kind === "forwarding_failed" ? status.request : null;
  const requestIds = submittedRequest
    ? {
        jobId: idFromRequest(submittedRequest, ["job_id"]),
        buyerRequestId: idFromRequest(submittedRequest, ["buyer_request_id"]),
        siteSubmissionId: idFromRequest(submittedRequest, ["site_package", "site_submission_id"]),
        captureJobId: idFromRequest(submittedRequest, ["site_package", "capture_job_id"]),
        captureId: idFromRequest(submittedRequest, ["site_package", "capture_id"]),
      }
    : null;

  return (
    <section
      id="policy-run-request"
      className={`scroll-mt-28 border border-black/10 bg-[#f8f6f1] p-4 sm:p-5 ${className}`}
      aria-labelledby="policy-run-request-title"
    >
      <div className="grid gap-4 lg:grid-cols-[0.42fr_0.58fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Site/task policy run
          </p>
          <h2
            id="policy-run-request-title"
            className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950"
          >
            Request policy run
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Submit a policy-evaluation request for this captured site.
            Blueprint queues the request here and forwards it to Pipeline for scheduling.
          </p>

          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-start gap-3 border border-black/10 bg-white p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-950" />
              <div>
                <p className="font-semibold text-slate-950">Scope: virtual evaluation</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  This request builds and forwards the evaluation packet for Pipeline execution.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border border-black/10 bg-white p-3">
              <Radio className="mt-0.5 h-4 w-4 shrink-0 text-slate-950" />
              <div>
                <p className="font-semibold text-slate-950">Worker: Blueprint selected</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Blueprint chooses the evaluation worker for the request.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <StatusChip label="Robot" value="Unitree G1" tone="ready" />
              <StatusChip label="Simulator" value="MuJoCo" tone="ready" />
              <StatusChip label="Mode" value="Queue + forward" tone="ready" />
            </div>

            <fieldset className="border border-black/10 bg-white p-3">
              <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Choose task
              </legend>
              <div className="grid gap-2 pt-2">
                {taskOptions.map((task) => {
                  const checked = selectedTaskIds.includes(task.taskId);
                  return (
                    <label
                      key={task.taskId}
                      className={`grid cursor-pointer grid-cols-[auto_1fr] gap-3 border p-3 transition ${
                        checked
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-black/10 bg-[#f8f6f1] text-slate-950 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTask(task)}
                        className="mt-1 h-4 w-4 accent-slate-950"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{task.label}</span>
                        <span
                          className={`mt-1 block text-xs leading-5 ${
                            checked ? "text-white/75" : "text-slate-600"
                          }`}
                        >
                          {task.skillId} · virtual policy-evaluation pass
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              disabled={disabled}
              onClick={submitJobRequest}
              className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {status.kind === "submitting" ? "Submitting request" : "Request policy run"}
            </button>

            {status.kind === "error" ? (
              <p className="flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {status.message}
              </p>
            ) : null}

            {status.kind === "forwarding_failed" ? (
              <p className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {status.message}. The request remains queued in WebApp; execution is not claimed.
              </p>
            ) : null}

            {status.kind === "accepted" ? (
              <p className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Request accepted and queued for Pipeline handoff.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.58fr_0.42fr]">
        <div className="grid items-start gap-2 sm:grid-cols-4">
          {requestStatusChips(status).map((chip) => (
            <StatusChip key={chip.label} {...chip} />
          ))}
        </div>

        <div className="border border-black/10 bg-white p-3">
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
            className="flex min-h-9 w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700"
          >
            Advanced details
            <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          {advancedOpen ? (
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <p>
                Backend preference: MuJoCo first. Provider strategy: Blueprint chooses the fastest/cheapest available simulator worker.
              </p>
              <p>
                Budget cap: WebApp approves no GPU spend. Timeout: 120 second handoff/startup default.
              </p>
              <p>
                Expected outputs: scheduler decision, worker launch plan, runtime manifest, preflight logs, metrics, trace, simulator POV, and proof boundary.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {requestIds ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <DetailRow label="request / job id" value={requestIds.jobId} />
          <DetailRow label="buyer_request_id" value={requestIds.buyerRequestId} />
          <DetailRow label="site_submission_id" value={requestIds.siteSubmissionId} />
          <DetailRow label="capture_job_id" value={requestIds.captureJobId} />
          <DetailRow label="capture_id" value={requestIds.captureId} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="border border-black/10 bg-white p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <FileText className="h-4 w-4" />
            Artifacts
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pipeline scheduler, worker, runtime, trace, metric, and proof artifacts will appear here after sync. This panel does not create runtime proof by itself.
          </p>
        </div>
        <div className="border border-black/10 bg-white p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Clock3 className="h-4 w-4" />
            Proof boundary
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            WebApp proves request construction, queueing, and forwarding state only. Pipeline owns simulator scheduling, provider execution, runtime logs, and any later pass/fail artifact.
          </p>
        </div>
      </div>
    </section>
  );
}

export const RobotEvalJobRequestButton = RobotEvalJobRequestPanel;
