import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Clock3,
  Download,
  ExternalLink,
  RotateCcw,
  Square,
  TriangleAlert,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import {
  isRenderableObservationPath,
  parseJsonParam,
  requestedOutputLabel,
  REQUESTED_OUTPUT_DEFINITIONS,
  type HostedSessionPreviewPayload,
} from "@/lib/hostedSession";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { withCsrfHeader } from "@/lib/csrf";
import { auth } from "@/lib/firebase";
import type { HostedSessionRecord } from "@/types/hostedSession";

interface HostedSessionWorkspaceProps {
  params: {
    slug: string;
  };
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function resolveWorkspaceStatus(record: HostedSessionRecord | null): "starting" | "live" | "stopped" | "error" {
  if (!record) {
    return "starting";
  }
  if (record.status === "failed" || record.presentationRuntime?.status === "failed") {
    return "error";
  }
  if (record.status === "stopped" || record.presentationRuntime?.status === "stopped") {
    return "stopped";
  }
  if (record.sessionMode === "presentation_demo") {
    return record.presentationRuntime?.status === "live" ? "live" : "starting";
  }
  return record.status === "creating" ? "starting" : "live";
}

function MetadataLink({ href, label }: { href?: string | null; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {label}
      <ExternalLink className="ml-2 h-4 w-4" />
    </a>
  );
}

export default function HostedSessionWorkspace({ params }: HostedSessionWorkspaceProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);
  const [sessionRecord, setSessionRecord] = useState<HostedSessionRecord | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"starting" | "live" | "stopped" | "error">("starting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workspaceError, setWorkspaceError] = useState("");
  const [uiBootstrapUrl, setUiBootstrapUrl] = useState("");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showIframeFallback, setShowIframeFallback] = useState(false);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const sessionId = searchParams.get("sessionId")?.trim() || "";
  const previewPayload = useMemo<HostedSessionPreviewPayload | null>(() => {
    if (!searchParams.get("preview")) return null;
    const previewSite = site || fallbackSite;
    const previewRobotProfile =
      parseJsonParam(
        searchParams.get("robotProfile"),
        previewSite?.robotProfiles[0] || previewSite?.sampleRobotProfile || null,
      ) || null;
    if (!previewRobotProfile) return null;
    return {
      policyLabel: searchParams.get("policyLabel")?.trim() || previewSite?.samplePolicy || "",
      robotProfile: previewRobotProfile,
      taskSelection: parseJsonParam(searchParams.get("taskSelection"), {
        taskId: previewSite?.taskCatalog[0]?.id || "",
        taskText: previewSite?.taskCatalog[0]?.taskText || previewSite?.sampleTask || "",
      }),
      runtimeConfig: parseJsonParam(searchParams.get("runtimeConfig"), {
        scenarioId: previewSite?.scenarioCatalog[0]?.id || "",
        startStateId: previewSite?.startStateCatalog[0]?.id || "",
        seed: null,
        requestedBackend: previewSite?.defaultRuntimeBackend || "",
      }),
      requestedOutputs: parseJsonParam(
        searchParams.get("requestedOutputs"),
        REQUESTED_OUTPUT_DEFINITIONS.map((item) => item.id),
      ),
      siteModel: parseJsonParam(searchParams.get("siteModel"), {
        siteWorldId: previewSite?.id || params.slug,
        siteName: previewSite?.siteName || "",
        siteAddress: previewSite?.siteAddress || "",
        sceneId: previewSite?.sceneId || "",
        captureId: previewSite?.captureId || "",
        pipelinePrefix: previewSite?.pipelinePrefix || "",
        availableScenarioVariants: previewSite?.scenarioVariants || [],
        availableStartStates: previewSite?.startStates || [],
        defaultRuntimeBackend: previewSite?.defaultRuntimeBackend || "",
        availableRuntimeBackends: previewSite?.availableRuntimeBackends || [],
      }),
    };
  }, [fallbackSite, params.slug, searchParams, site]);

  const authorizedJsonFetch = async (url: string, options: RequestInit = {}) => {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
    const headers =
      options.method && options.method !== "GET"
        ? await withCsrfHeader({ "Content-Type": "application/json" })
        : {};
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params.slug]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteWorldDetail(params.slug)
      .then((item) => {
        if (!cancelled) setSite(item as typeof fallbackSite);
      })
      .catch(() => {
        if (!cancelled) setSite(getSiteWorldById(params.slug));
      });
    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  useEffect(() => {
    if (!sessionId) {
      if (previewPayload) {
        setSessionStatus("live");
      } else {
        setSessionStatus("error");
        setWorkspaceError("Hosted session ID is missing.");
      }
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      try {
        const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}`);
        const payload = (await response.json().catch(() => null)) as HostedSessionRecord | { error?: string } | null;
        if (!response.ok || !payload || !("sessionId" in payload)) {
          throw new Error((payload && "error" in payload && payload.error) || "Unable to load hosted session");
        }
        if (cancelled) return;
        setSessionRecord(payload);
        setSessionStatus(resolveWorkspaceStatus(payload));
        setWorkspaceError("");
        const nextDelay =
          resolveWorkspaceStatus(payload) === "starting"
            ? 3000
            : resolveWorkspaceStatus(payload) === "live"
              ? 10000
              : 0;
        if (nextDelay > 0) {
          timeoutId = window.setTimeout(poll, nextDelay);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Unable to load hosted session");
          setSessionStatus("error");
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [previewPayload, sessionId]);

  useEffect(() => {
    if (!sessionRecord?.startedAt || sessionStatus === "stopped" || sessionStatus === "error") {
      return undefined;
    }
    const startedAtMs = new Date(String(sessionRecord.startedAt)).getTime();
    const updateElapsed = () => {
      if (Number.isFinite(startedAtMs)) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
      }
    };
    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionRecord?.startedAt, sessionStatus]);

  useEffect(() => {
    if (!sessionId || sessionRecord?.sessionMode !== "presentation_demo" || sessionStatus !== "live") {
      return;
    }
    let cancelled = false;
    setIframeLoaded(false);
    setShowIframeFallback(false);
    setUiBootstrapUrl("");

    authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/ui-access`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { bootstrapUrl?: string; error?: string } | null;
        if (!response.ok || !payload?.bootstrapUrl) {
          throw new Error(payload?.error || "Unable to create embedded demo access");
        }
        if (!cancelled) {
          setUiBootstrapUrl(payload.bootstrapUrl);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setShowIframeFallback(true);
          setWorkspaceError(error instanceof Error ? error.message : "Unable to create embedded demo access");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionRecord?.sessionMode, sessionStatus]);

  useEffect(() => {
    if (!uiBootstrapUrl || iframeLoaded || showIframeFallback) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setShowIframeFallback(true);
    }, 8000);
    return () => window.clearTimeout(timeoutId);
  }, [iframeLoaded, showIframeFallback, uiBootstrapUrl]);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Hosted session not found</h1>
      </div>
    );
  }

  const sessionMode = sessionRecord?.sessionMode || "runtime_only";
  const taskSelection = sessionRecord?.taskSelection || previewPayload?.taskSelection || site.taskCatalog[0];
  const selectedTaskId = "id" in taskSelection ? taskSelection.id : taskSelection.taskId;
  const runtimeConfig = sessionRecord?.runtimeConfig || previewPayload?.runtimeConfig || {
    scenarioId: site.scenarioCatalog[0]?.id || "",
    startStateId: site.startStateCatalog[0]?.id || "",
    requestedBackend: site.defaultRuntimeBackend,
  };
  const scenario = site.scenarioCatalog.find((item) => item.id === runtimeConfig.scenarioId);
  const startState = site.startStateCatalog.find((item) => item.id === runtimeConfig.startStateId);
  const robotProfile =
    sessionRecord?.robotProfile || previewPayload?.robotProfile || site.robotProfiles[0] || site.sampleRobotProfile;
  const requestedOutputs =
    sessionRecord?.requestedOutputs ||
    previewPayload?.requestedOutputs ||
    REQUESTED_OUTPUT_DEFINITIONS.map((item) => item.id);
  const latestEpisode = sessionRecord?.latestEpisode || null;
  const batchSummary = sessionRecord?.batchSummary || null;
  const observation = latestEpisode?.observation as Record<string, unknown> | undefined;
  const observationFramePath = String(observation?.frame_path || "").trim();
  const renderableObservation = isRenderableObservationPath(observationFramePath);
  const datasetRlds = sessionRecord?.datasetArtifacts?.rlds as
    | { manifestUri?: string; trainJsonl?: string }
    | undefined;

  const handleReset = async () => {
    if (!sessionId) return;
    const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/reset`, {
      method: "POST",
      body: JSON.stringify({
        taskId: selectedTaskId,
        scenarioId: runtimeConfig.scenarioId,
        startStateId: runtimeConfig.startStateId,
      }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setSessionRecord((current) => (current ? { ...current, latestEpisode: payload.episode, status: "running" } : current));
    setSessionStatus("live");
  };

  const handleBatch = async () => {
    if (!sessionId) return;
    const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/run-batch`, {
      method: "POST",
      body: JSON.stringify({
        numEpisodes: 10,
        maxSteps: 6,
        taskId: selectedTaskId,
        scenarioId: runtimeConfig.scenarioId,
        startStateId: runtimeConfig.startStateId,
      }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            batchSummary: payload.summary,
            artifactUris: payload.artifact_uris || current.artifactUris,
            datasetArtifacts: payload.dataset_artifacts || current.datasetArtifacts,
          }
        : current,
    );
  };

  const handleExport = async () => {
    if (!sessionId) return;
    const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/export`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            artifactUris: payload.artifact_uris || current.artifactUris,
            datasetArtifacts: payload.dataset_artifacts || current.datasetArtifacts,
          }
        : current,
    );
  };

  const handleStop = async () => {
    if (sessionId) {
      await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/stop`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }
    setSessionStatus("stopped");
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            status: "stopped",
            presentationRuntime: current.presentationRuntime
              ? { ...current.presentationRuntime, status: "stopped" }
              : current.presentationRuntime,
          }
        : current,
    );
  };

  const statusTone =
    sessionStatus === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : sessionStatus === "starting"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : sessionStatus === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-600";

  const generatedRows = [
    { label: "Task", value: taskSelection?.taskText || "Pending" },
    { label: "Scenario", value: scenario?.name || "Pending" },
    { label: "Start state", value: startState?.name || "Pending" },
    { label: "Step count", value: String(latestEpisode?.stepIndex ?? 0) },
    { label: "Reward / score", value: latestEpisode?.reward != null ? String(latestEpisode.reward) : "Pending" },
    {
      label: "Success / failure",
      value:
        latestEpisode?.success == null
          ? "Pending"
          : latestEpisode.success
            ? "Success"
            : latestEpisode.failureReason || "Failed",
    },
    { label: "Raw bundle", value: sessionRecord?.artifactUris?.raw_bundle || "Pending" },
    { label: "RLDS dataset", value: datasetRlds?.manifestUri || "Pending" },
    { label: "Requested outputs", value: requestedOutputs.map((item) => requestedOutputLabel(item)).join(", ") },
  ];

  const presentationRuntime = sessionRecord?.presentationRuntime;
  const runtimeSessionConfig = sessionRecord?.runtimeSessionConfig || null;
  const canonicalPackageUri =
    runtimeSessionConfig?.canonical_package_uri ||
    sessionRecord?.siteModel?.sceneMemoryManifestUri ||
    site.sceneMemoryManifestUri ||
    sessionRecord?.siteModel?.conditioningBundleUri ||
    null;
  const canonicalPackageVersion = runtimeSessionConfig?.canonical_package_version || null;
  const siteWorldHealthUri = sessionRecord?.siteModel?.siteWorldHealthUri || site.siteWorldHealthUri || null;
  const groundedGeometryUri = sessionRecord?.siteModel?.siteWorldSpecUri || site.siteWorldSpecUri || null;
  const openDemoUrl = uiBootstrapUrl || (presentationRuntime?.status === "live" ? `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/ui/` : "");

  if (sessionMode === "presentation_demo") {
    return (
      <>
        <SEO
          title={`Hosted Session | ${site.siteName} | Blueprint`}
          description={`Hosted session workspace for ${site.siteName}.`}
          canonical={`/site-worlds/${site.id}/workspace`}
        />

        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <a
                  href={`/site-worlds/${site.id}/start`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to setup
                </a>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Hosted Session Workspace</h1>
                <p className="mt-2 text-lg font-semibold text-slate-900">{site.siteName}</p>
                <p className="mt-1 text-sm text-slate-500">{site.siteAddress}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusTone}`}>
                  Session status: {sessionStatus === "live" ? "Live" : sessionStatus === "starting" ? "Starting" : sessionStatus === "error" ? "Error" : "Stopped"}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Provider: {presentationRuntime?.provider || "vast"}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Backend: {sessionRecord?.runtime_backend_selected || site.defaultRuntimeBackend}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Elapsed: {formatElapsed(elapsedSeconds)}
                </div>
                <button
                  type="button"
                  onClick={handleStop}
                  className="inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop session
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-6">
                <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical grounded package</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Scene ID</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{site.sceneId}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Capture ID</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{site.captureId}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Classification</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{site.category}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Site-world status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {site.deploymentReadiness?.qualification_state?.replaceAll("_", " ") || "qualified"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Canonical package version</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{canonicalPackageVersion || "Unspecified"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <MetadataLink href={canonicalPackageUri} label="View canonical package" />
                    <MetadataLink href={siteWorldHealthUri} label="View site-world health" />
                    <MetadataLink href={groundedGeometryUri} label="View grounded object geometry" />
                  </div>
                </article>

                <article className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
                    <TriangleAlert className="h-4 w-4" />
                    Canonical vs Presentation
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-amber-950">
                    <p>This interactive demo is derived from the canonical grounded site package.</p>
                    <p>Generated views or completions may not exactly match the original capture.</p>
                    <p>Use canonical site-world artifacts for source-of-truth review.</p>
                  </div>
                </article>

                <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Presentation demo</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Runtime backend</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{sessionRecord?.runtime_backend_selected || "neoverse"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Session provider</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{presentationRuntime?.provider || "vast"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Session status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{presentationRuntime?.status || sessionRecord?.status || "creating"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Instance</p>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-900">{presentationRuntime?.instanceId || "Pending"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {openDemoUrl ? (
                      <a
                        href={openDemoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Open demo in new tab
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </article>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Embedded NeoVerse UI</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Interactive demo</h2>
                  </div>
                </div>

                {workspaceError ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {workspaceError}
                  </div>
                ) : null}

                {sessionStatus === "starting" ? (
                  <div className="mt-5 flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">NeoVerse is starting</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Blueprint is provisioning the session shell and waiting for the embedded UI to become reachable.
                      </p>
                    </div>
                  </div>
                ) : null}

                {sessionStatus === "error" ? (
                  <div className="mt-5 flex min-h-[520px] items-center justify-center rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
                    <div>
                      <p className="text-lg font-semibold text-rose-900">The presentation demo failed to start</p>
                      <p className="mt-2 text-sm text-rose-700">
                        {presentationRuntime?.errorMessage || "Blueprint could not bring the NeoVerse session online."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {sessionStatus === "stopped" ? (
                  <div className="mt-5 flex min-h-[520px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">The session has ended</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Start a new hosted session from the setup page if you need another interactive demo.
                      </p>
                    </div>
                  </div>
                ) : null}

                {sessionStatus === "live" ? (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    {!showIframeFallback && uiBootstrapUrl ? (
                      <iframe
                        title="Embedded NeoVerse demo"
                        src={uiBootstrapUrl}
                        className="h-[720px] w-full rounded-2xl border border-slate-200 bg-white"
                        onLoad={() => setIframeLoaded(true)}
                      />
                    ) : (
                      <div className="flex h-[720px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">Embedded demo fallback</p>
                          <p className="mt-2 text-sm text-slate-600">
                            The iframe did not finish loading in time. Open the demo directly in a new tab instead.
                          </p>
                          {openDemoUrl ? (
                            <a
                              href={openDemoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Open demo in new tab
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={`Hosted Session | ${site.siteName} | Blueprint`}
        description={`Hosted session workspace for ${site.siteName}.`}
        canonical={`/site-worlds/${site.id}/workspace`}
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <a
                href={`/site-worlds/${site.id}/start`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to setup
              </a>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Hosted Session Workspace</h1>
              <p className="mt-2 text-lg font-semibold text-slate-900">{site.siteName}</p>
              <p className="mt-1 text-sm text-slate-500">{site.siteAddress}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusTone}`}>
                Session status: {sessionStatus === "live" ? "Live" : sessionStatus === "starting" ? "Starting" : sessionStatus === "error" ? "Error" : "Stopped"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Backend: {sessionRecord?.runtime_backend_selected || site.defaultRuntimeBackend}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Runtime health: {sessionRecord?.runtimeHandle?.health_status || site.runtimeManifest?.healthStatus || "unknown"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Elapsed: {formatElapsed(elapsedSeconds)}
              </div>
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop session
              </button>
            </div>
          </div>

          {workspaceError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {workspaceError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Robot profile</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{robotProfile.displayName}</p>
              <p className="mt-1 text-sm text-slate-500">{robotProfile.embodimentType.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{taskSelection?.taskText}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Scenario</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{scenario?.name}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start state</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{startState?.name}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Observation viewport</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Robot observation</h2>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {renderableObservation ? (
                  <img
                    src={observationFramePath}
                    alt="Latest robot observation frame"
                    className="h-[320px] w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <div>
                      <Camera className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-3 text-sm font-semibold text-slate-900">Observation stored outside the browser runtime</p>
                      <p className="mt-2 break-all text-xs text-slate-500">
                        {observationFramePath || "The runtime has not returned a frame path yet."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Observation cameras</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-600">
                      {(latestEpisode?.observationCameras || robotProfile.observationCameras).map((camera) => (
                        <div key={camera.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          {camera.role} · {camera.available === false ? "unavailable" : "available"}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Action trace</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {latestEpisode?.actionTrace?.length
                        ? `${latestEpisode.actionTrace.length} actions recorded`
                        : "No actions recorded yet"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step count</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{latestEpisode?.stepIndex ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reward</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {latestEpisode?.reward != null ? latestEpisode.reward : "0"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Batch success rate</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {batchSummary?.successRate != null ? `${Math.round(batchSummary.successRate * 100)}%` : "Pending"}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Run context</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Action space</p>
                    <p className="mt-1 text-sm text-slate-900">{robotProfile.actionSpaceSummary}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Runtime endpoint</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {String(sessionRecord?.runtimeHandle?.runtime_base_url || site.runtimeManifest?.runtimeBaseUrl || "Not connected")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Build ID</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {String(sessionRecord?.runtimeHandle?.build_id || "Pending")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">VM instance</p>
                    <p className="mt-1 break-all text-sm text-slate-900">
                      {String(sessionRecord?.runtimeHandle?.vm_instance_id || "Unknown")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Canonical package</p>
                    <p className="mt-1 break-all text-sm text-slate-900">
                      {canonicalPackageUri || "Unspecified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Canonical package version</p>
                    <p className="mt-1 text-sm text-slate-900">{canonicalPackageVersion || "Unspecified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Presentation model</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {runtimeSessionConfig?.presentation_model || "Unspecified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Debug mode</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {runtimeSessionConfig?.debug_mode ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Controls</p>
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset episode
                  </button>
                  <button
                    type="button"
                    onClick={handleBatch}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Run 10 episodes
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export results
                  </button>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Generated outputs</p>
                <div className="mt-4 space-y-3">
                  {generatedRows.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 break-all text-sm text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  Session summary
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  NeoVerse runs the site-conditioned rollout on the GPU VM, the robot profile defines action and observation contracts, and the workspace proxies reset, step, render, and health directly to the runtime.
                </p>
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <SiteWorldGraphic site={site} />
                </div>
                <button
                  type="button"
                  onClick={() => setLocation(`/site-worlds/${site.id}`)}
                  className="mt-5 inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Return to site detail
                </button>
              </article>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
