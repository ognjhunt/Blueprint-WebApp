import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  LogIn,
  PlayCircle,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { premiumCapabilities } from "@/data/content";
import type { SiteLibrarySite } from "@/data/siteLibrary";
import {
  buildRobotEvalJobRequestFromSite,
  defaultSimulatorEvalTasksForSite,
  type RobotEvalSimulatorTaskSelection,
} from "@/lib/robotEvalJobRequest";

const ROBOT_EVAL_RUN_PRICE_USD =
  premiumCapabilities.find((capability) => capability.slug === "policy-benchmarking")
    ?.price ?? null;

const PROVISION_POLL_INTERVAL_MS = 3000;
const PROVISION_POLL_MAX_ATTEMPTS = 20;

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

  const { currentUser, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  // null = still checking access for the signed-in buyer.
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisioningTimedOut, setProvisioningTimedOut] = useState(false);
  const [payState, setPayState] = useState<
    { kind: "idle" } | { kind: "starting" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const autoStartedRef = useRef(false);
  const cameFromCheckoutRef = useRef(false);

  const selectedTasks = taskOptions.filter((task) => selectedTaskIds.includes(task.taskId));
  const hasTasks = selectedTasks.length > 0;
  const disabled =
    status.kind === "submitting" ||
    !hasTasks ||
    !site.robotEvalPublication?.readyToEvaluatePublishable ||
    !site.defaultRobotEvalSelection;

  const fetchEntitled = useCallback(async () => {
    if (!currentUser) {
      return false;
    }
    try {
      const { withFirebaseAuthHeaders } = await import("@/lib/firebaseAuthHeaders");
      const headers = await withFirebaseAuthHeaders(currentUser);
      const response = await fetch(
        `/api/marketplace/entitlements/current?sku=${encodeURIComponent(site.slug)}`,
        { headers },
      );
      if (!response.ok) {
        return false;
      }
      const data = (await response.json().catch(() => ({}))) as {
        entitlements?: Array<Record<string, unknown>>;
      };
      const entitlements = Array.isArray(data.entitlements) ? data.entitlements : [];
      return entitlements.some(
        (entitlement) => entitlement && entitlement.access_state === "provisioned",
      );
    } catch {
      return false;
    }
  }, [currentUser, site.slug]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!currentUser) {
      setEntitled(null);
      return;
    }
    let cancelled = false;
    setEntitled(null);
    void fetchEntitled().then((value) => {
      if (!cancelled) {
        setEntitled(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser, fetchEntitled]);

  // Returning from Stripe Checkout: strip the marker param, then poll until the
  // payment webhook provisions the entitlement.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    const marker = url.searchParams.get("robotEvalCheckout");
    if (!marker) {
      return;
    }
    url.searchParams.delete("robotEvalCheckout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (marker === "success") {
      cameFromCheckoutRef.current = true;
      setProvisioning(true);
    }
  }, []);

  useEffect(() => {
    if (!provisioning || authLoading || !currentUser || entitled === true) {
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const value = await fetchEntitled();
      if (cancelled) {
        return;
      }
      if (value) {
        setEntitled(true);
        setProvisioning(false);
        return;
      }
      if (attempts >= PROVISION_POLL_MAX_ATTEMPTS) {
        setProvisioning(false);
        setProvisioningTimedOut(true);
        return;
      }
      timer = window.setTimeout(poll, PROVISION_POLL_INTERVAL_MS);
    };
    let timer = window.setTimeout(poll, PROVISION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [provisioning, authLoading, currentUser, entitled, fetchEntitled]);

  function goToSignIn() {
    try {
      sessionStorage.setItem("redirectAfterAuth", `/sites/${site.slug}#policy-run-request`);
    } catch {
      // Ignore storage failures; sign-in still works, just without the return hop.
    }
    setLocation("/sign-in");
  }

  async function startCheckout() {
    if (!currentUser) {
      goToSignIn();
      return;
    }
    setPayState({ kind: "starting" });
    try {
      const { withCsrfHeader } = await import("@/lib/csrf");
      const { withFirebaseAuthHeaders } = await import("@/lib/firebaseAuthHeaders");
      const headers = await withFirebaseAuthHeaders(
        currentUser,
        await withCsrfHeader({ "Content-Type": "application/json" }),
      );
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionType: "robot-eval-run",
          robotEvalRun: { siteSlug: site.slug },
          successPath: `/sites/${site.slug}?robotEvalCheckout=success`,
          cancelPath: `/sites/${site.slug}?robotEvalCheckout=cancelled`,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        sessionUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.sessionUrl) {
        throw new Error(data.error || "Could not start checkout. Please try again.");
      }
      window.location.href = data.sessionUrl;
    } catch (error) {
      setPayState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not start checkout. Please try again.",
      });
    }
  }

  // The buyer already clicked "Pay & start evaluation" before checkout, so once
  // payment provisions access, submit the run they asked for exactly once.
  useEffect(() => {
    if (
      entitled === true &&
      cameFromCheckoutRef.current &&
      !autoStartedRef.current &&
      hasTasks &&
      status.kind === "idle"
    ) {
      autoStartedRef.current = true;
      void submitJobRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitled, hasTasks, status.kind]);

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

            {authLoading || (currentUser && entitled === null && !provisioning) ? (
              <button
                type="button"
                disabled
                className="inline-flex min-h-12 cursor-wait items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white opacity-55"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {authLoading ? "Checking your account" : "Checking evaluation access"}
              </button>
            ) : !currentUser ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={goToSignIn}
                  className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in to start an evaluation
                </button>
                <p className="text-xs leading-5 text-slate-600">
                  Evaluation runs require a signed-in Blueprint account. You&apos;ll come
                  back to this page after signing in.
                </p>
              </div>
            ) : provisioning ? (
              <div className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-900">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                Payment received. Provisioning your evaluation access — your run will
                start automatically in a moment.
              </div>
            ) : provisioningTimedOut && entitled !== true ? (
              <div className="grid gap-2">
                <p className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Payment received, but access is still being provisioned. Refresh this
                  page in a minute, or contact team@tryblueprint.io if it doesn&apos;t
                  clear.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setProvisioningTimedOut(false);
                    setProvisioning(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center border border-slate-950 px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Check again
                </button>
              </div>
            ) : entitled ? (
              <button
                type="button"
                disabled={disabled}
                onClick={submitJobRequest}
                className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                {status.kind === "submitting" ? "Submitting request" : "Start evaluation run"}
              </button>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={payState.kind === "starting" || !hasTasks}
                  onClick={startCheckout}
                  className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {payState.kind === "starting" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  {payState.kind === "starting"
                    ? "Opening secure checkout"
                    : ROBOT_EVAL_RUN_PRICE_USD
                      ? `Pay & start evaluation — $${ROBOT_EVAL_RUN_PRICE_USD}`
                      : "Pay & start evaluation"}
                </button>
                <p className="text-xs leading-5 text-slate-600">
                  Secure Stripe Checkout. After payment your evaluation request is queued
                  and forwarded to Pipeline automatically.
                </p>
                {payState.kind === "error" ? (
                  <p className="flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {payState.message}
                  </p>
                ) : null}
              </div>
            )}

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
