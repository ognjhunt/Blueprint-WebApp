import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, BarChart3, Camera, Clock3, Download, RotateCcw, Square } from "lucide-react";
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

export default function HostedSessionWorkspace({ params }: HostedSessionWorkspaceProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);
  const [sessionRecord, setSessionRecord] = useState<HostedSessionRecord | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"starting" | "live" | "stopped">("starting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
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
    if (sessionId) {
      authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}`)
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((payload) => {
          if (!payload) return;
          const record = payload as HostedSessionRecord;
          setSessionRecord(record);
          const status = String(record.status || "starting").trim().toLowerCase();
          setSessionStatus(status === "stopped" ? "stopped" : "live");
        })
        .catch(() => null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSessionStatus("live");
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [sessionId]);

  useEffect(() => {
    if (sessionStatus !== "live") return undefined;
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionStatus]);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Hosted session not found</h1>
      </div>
    );
  }

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
    setSessionRecord((current) => (current ? { ...current, status: "stopped" } : current));
  };

  const statusTone =
    sessionStatus === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : sessionStatus === "starting"
        ? "border-amber-200 bg-amber-50 text-amber-700"
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
                Session status: {sessionStatus === "live" ? "Live" : sessionStatus === "starting" ? "Starting" : "Stopped"}
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
                    <p className="text-sm font-medium text-slate-500">Policy adapter</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {String(sessionRecord?.policy?.adapter_name || robotProfile.defaultPolicyAdapter || "n/a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Model reference</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {String(sessionRecord?.policy?.model_name || previewPayload?.policyLabel || site.samplePolicy || "Not provided")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Checkpoint path</p>
                    <p className="mt-1 break-all text-sm text-slate-900">
                      {String(sessionRecord?.policy?.checkpoint_path || "Not provided")}
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
                  NeoVerse runs the site-conditioned rollout, the robot profile defines action and observation contracts, and exports are written as both raw session bundles and RLDS datasets.
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
