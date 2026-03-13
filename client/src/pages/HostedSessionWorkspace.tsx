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
import type {
  HostedSessionMode,
  HostedSessionRecord,
  RobotObservationCamera,
} from "@/types/hostedSession";

interface HostedSessionWorkspaceProps {
  params: {
    slug: string;
  };
}

type WorkspaceViewMode = "live_runtime" | "presentation_world";
type BootstrapState = "idle" | "running" | "done";

const DEFAULT_RUNTIME_ACTION = [0, 0, 0, 0, 0, 0, 1];

const RUNTIME_ACTION_PRESETS = [
  {
    id: "auto-step",
    label: "Advance one step",
    description: "Ask the runtime for the next action on the current policy binding.",
    action: null as number[] | null,
    autoPolicy: true,
  },
  {
    id: "glide-forward",
    label: "Move forward",
    description: "Nudge the robot deeper into the live site-world.",
    action: [0.45, 0, 0, 0, 0, 0, 1],
    autoPolicy: false,
  },
  {
    id: "turn-left",
    label: "Turn left",
    description: "Rotate toward a new observation cone without leaving the current state.",
    action: [0, 0, 0.35, 0, 0, 0, 1],
    autoPolicy: false,
  },
  {
    id: "reach-in",
    label: "Reach in",
    description: "Advance the manipulator pose to refresh the next rendered frame.",
    action: [0, 0, 0, 0.16, 0.12, 0.08, 0],
    autoPolicy: false,
  },
] as const;

const SCRIPTED_WALKTHROUGH = [
  {
    label: "Scan the room",
    action: [0.2, 0, 0.25, 0, 0, 0, 1],
  },
  {
    label: "Push deeper",
    action: [0.45, 0, 0, 0, 0, 0, 1],
  },
  {
    label: "Inspect surfaces",
    action: [0, 0, -0.2, 0.12, 0, 0.06, 0],
  },
] as const;

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function humanizeValue(value?: string | null, fallback = "Unavailable") {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replaceAll("_", " ") : fallback;
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

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ModeToggleButton(props: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-[24px] border px-4 py-4 text-left transition ${
        props.active
          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <p className="text-sm font-semibold">{props.title}</p>
      <p className={`mt-2 text-sm leading-6 ${props.active ? "text-slate-200" : "text-slate-500"}`}>
        {props.description}
      </p>
    </button>
  );
}

function dedupeCameras(cameras: RobotObservationCamera[]) {
  const next: RobotObservationCamera[] = [];
  const seen = new Set<string>();
  cameras.forEach((camera) => {
    const key = String(camera.id || "").trim();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    next.push(camera);
  });
  return next;
}

function readCameraFrames(remoteObservation: Record<string, unknown> | null) {
  return Array.isArray(remoteObservation?.cameraFrames)
    ? (remoteObservation?.cameraFrames as Record<string, unknown>[])
    : [];
}

function resolveRemoteCameraFramePath(
  remoteObservation: Record<string, unknown> | null,
  cameraId: string,
) {
  const frames = readCameraFrames(remoteObservation);
  const normalizedCameraId = String(cameraId || "").trim();
  const exactMatch = frames.find((frame) =>
    [frame.cameraId, frame.camera_id, frame.id, frame.role].some(
      (value) => String(value || "").trim() === normalizedCameraId,
    ),
  );
  if (exactMatch) {
    return String(exactMatch.framePath || exactMatch.frame_path || "").trim();
  }
  return String(
    frames[0]?.framePath ||
      frames[0]?.frame_path ||
      remoteObservation?.frame_path ||
      "",
  ).trim();
}

export default function HostedSessionWorkspace({ params }: HostedSessionWorkspaceProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [siteDetail, setSiteDetail] = useState(fallbackSite);
  const [sessionRecord, setSessionRecord] = useState<HostedSessionRecord | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"starting" | "live" | "stopped" | "error">("starting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workspaceError, setWorkspaceError] = useState("");
  const [controlError, setControlError] = useState("");
  const [uiBootstrapUrl, setUiBootstrapUrl] = useState("");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showIframeFallback, setShowIframeFallback] = useState(false);
  const [activeMode, setActiveMode] = useState<WorkspaceViewMode>("live_runtime");
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [runtimeBusyLabel, setRuntimeBusyLabel] = useState("");
  const [autoBootstrapState, setAutoBootstrapState] = useState<BootstrapState>("idle");
  const [observationRefreshKey, setObservationRefreshKey] = useState(0);
  const [observationLoadError, setObservationLoadError] = useState(false);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const sessionId = searchParams.get("sessionId")?.trim() || "";
  const site = siteDetail || fallbackSite;
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
        if (!cancelled) setSiteDetail(item as typeof fallbackSite);
      })
      .catch(() => {
        if (!cancelled) setSiteDetail(getSiteWorldById(params.slug));
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
        const nextStatus = resolveWorkspaceStatus(payload);
        setSessionRecord(payload);
        setSessionStatus(nextStatus);
        setWorkspaceError("");
        const nextDelay = nextStatus === "starting" ? 3000 : nextStatus === "live" ? 10000 : 0;
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

  useEffect(() => {
    setAutoBootstrapState("idle");
    setObservationRefreshKey(0);
    setObservationLoadError(false);
    setControlError("");
  }, [sessionId]);

  const sessionMode: HostedSessionMode = sessionRecord?.sessionMode || "runtime_only";
  const taskSelection = sessionRecord?.taskSelection || previewPayload?.taskSelection || site?.taskCatalog[0] || {
    id: "",
    taskId: "",
    taskText: "",
  };
  const selectedTaskId = "id" in taskSelection ? taskSelection.id : taskSelection.taskId;
  const runtimeConfig = sessionRecord?.runtimeConfig || previewPayload?.runtimeConfig || {
    scenarioId: site?.scenarioCatalog[0]?.id || "",
    startStateId: site?.startStateCatalog[0]?.id || "",
    requestedBackend: site?.defaultRuntimeBackend || "",
  };
  const scenario = site?.scenarioCatalog.find((item) => item.id === runtimeConfig.scenarioId);
  const startState = site?.startStateCatalog.find((item) => item.id === runtimeConfig.startStateId);
  const robotProfile =
    sessionRecord?.robotProfile ||
    previewPayload?.robotProfile ||
    site?.robotProfiles[0] ||
    site?.sampleRobotProfile || {
      displayName: "Unknown robot profile",
      embodimentType: "other" as const,
      observationCameras: [],
      actionSpace: {
        name: "unknown",
        dim: 0,
        labels: [],
      },
      actionSpaceSummary: "Runtime contract unavailable.",
    };
  const requestedOutputs =
    sessionRecord?.requestedOutputs ||
    previewPayload?.requestedOutputs ||
    REQUESTED_OUTPUT_DEFINITIONS.map((item) => item.id);
  const latestEpisode = sessionRecord?.latestEpisode || null;
  const batchSummary = sessionRecord?.batchSummary || null;
  const observation = latestEpisode?.observation as Record<string, unknown> | undefined;
  const remoteObservation = (observation?.remoteObservation || null) as Record<string, unknown> | null;
  const observationFramePath = String(observation?.frame_path || "").trim();
  const remoteObservationFramePath = String(
    remoteObservation?.frame_path || readCameraFrames(remoteObservation)[0]?.framePath || "",
  ).trim();
  const qualityFlags = ((observation?.runtimeMetadata || null) as Record<string, unknown> | null)?.quality_flags as
    | Record<string, unknown>
    | undefined;
  const protectedRegionViolations =
    (((observation?.runtimeMetadata || null) as Record<string, unknown> | null)?.protected_region_violations as
      | unknown[]
      | undefined) || [];
  const latestEpisodeArtifacts = latestEpisode?.artifactUris || {};
  const rolloutVideoPath = String(
    latestEpisodeArtifacts.rollout_video ||
      latestEpisodeArtifacts.rolloutVideo ||
      latestEpisodeArtifacts.video_path ||
      "",
  ).trim();
  const exportManifestPath = String(sessionRecord?.artifactUris?.export_manifest || "").trim();
  const rawBundlePath = String(sessionRecord?.artifactUris?.raw_bundle || "").trim();
  const datasetRlds = sessionRecord?.datasetArtifacts?.rlds as
    | { manifestUri?: string; trainJsonl?: string }
    | undefined;
  const canonicalPackageUri =
    sessionRecord?.runtimeSessionConfig?.canonical_package_uri ||
    sessionRecord?.siteModel?.siteWorldSpecUri ||
    site?.siteWorldSpecUri ||
    null;
  const canonicalPackageVersion = sessionRecord?.runtimeSessionConfig?.canonical_package_version || null;
  const siteWorldRegistrationUri =
    sessionRecord?.siteModel?.siteWorldRegistrationUri || site?.siteWorldRegistrationUri || null;
  const siteWorldHealthUri = sessionRecord?.siteModel?.siteWorldHealthUri || site?.siteWorldHealthUri || null;
  const sceneMemoryManifestUri =
    sessionRecord?.siteModel?.sceneMemoryManifestUri || site?.sceneMemoryManifestUri || null;
  const conditioningBundleUri =
    sessionRecord?.siteModel?.conditioningBundleUri || site?.conditioningBundleUri || null;
  const presentationWorldManifestUri =
    sessionRecord?.siteModel?.presentationWorldManifestUri ||
    site?.presentationDemoReadiness?.presentationWorldManifestUri ||
    null;
  const runtimeDemoManifestUri = sessionRecord?.siteModel?.runtimeDemoManifestUri || null;
  const openDemoUrl =
    uiBootstrapUrl ||
    (sessionRecord?.presentationRuntime?.status === "live"
      ? `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/ui/`
      : "");
  const runtimeInteractive =
    Boolean(sessionId) &&
    sessionMode !== "presentation_demo" &&
    sessionStatus !== "starting" &&
    sessionStatus !== "stopped" &&
    sessionStatus !== "error";
  const presentationInteractive =
    sessionMode === "presentation_demo" && sessionStatus === "live" && Boolean(openDemoUrl);
  const statusTone =
    sessionStatus === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : sessionStatus === "starting"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : sessionStatus === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-600";

  const cameraOptions = dedupeCameras(
    (latestEpisode?.observationCameras && latestEpisode.observationCameras.length > 0
      ? latestEpisode.observationCameras
      : robotProfile.observationCameras) || [],
  );
  const primaryCameraId =
    String(observation?.primaryCameraId || cameraOptions.find((item) => item.defaultEnabled)?.id || cameraOptions[0]?.id || "")
      .trim();

  useEffect(() => {
    setActiveMode(sessionMode === "presentation_demo" ? "presentation_world" : "live_runtime");
  }, [sessionMode]);

  useEffect(() => {
    if (cameraOptions.length === 0) {
      setSelectedCameraId("");
      return;
    }
    setSelectedCameraId((current) => {
      if (current && cameraOptions.some((camera) => camera.id === current)) {
        return current;
      }
      return primaryCameraId || cameraOptions[0]?.id || "";
    });
  }, [cameraOptions, primaryCameraId]);

  const selectedCameraRemoteFramePath = resolveRemoteCameraFramePath(remoteObservation, selectedCameraId || primaryCameraId);
  const selectedCameraRenderableFallback = isRenderableObservationPath(selectedCameraRemoteFramePath)
    ? selectedCameraRemoteFramePath
    : isRenderableObservationPath(observationFramePath)
      ? observationFramePath
      : isRenderableObservationPath(remoteObservationFramePath)
        ? remoteObservationFramePath
        : "";
  const selectedObservationSrc =
    runtimeInteractive && latestEpisode?.episodeId && selectedCameraId
      ? `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/render?cameraId=${encodeURIComponent(selectedCameraId)}&refresh=${observationRefreshKey}`
      : selectedCameraRenderableFallback;
  const hasVisibleObservation = Boolean(
    selectedObservationSrc &&
      isRenderableObservationPath(selectedObservationSrc) &&
      !observationLoadError,
  );
  const presentationAvailabilityLabel = presentationInteractive
    ? "Embedded presentation viewer live"
    : "Artifact-backed presentation fallback";
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
    { label: "Requested outputs", value: requestedOutputs.map((item) => requestedOutputLabel(item)).join(", ") },
  ];

  const applyEpisodeUpdate = (episode: HostedSessionRecord["latestEpisode"]) => {
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            latestEpisode: episode,
            status: "running",
          }
        : current,
    );
    setSessionStatus("live");
    setObservationRefreshKey((current) => current + 1);
    setObservationLoadError(false);
  };

  const handleReset = async (options?: { silent?: boolean }) => {
    if (!sessionId || !runtimeInteractive) return false;
    const busyLabel = options?.silent
      ? "Resetting runtime and fetching the first frame"
      : "Resetting runtime";
    setRuntimeBusyLabel(busyLabel);
    setControlError("");
    try {
      const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/reset`, {
        method: "POST",
        body: JSON.stringify({
          taskId: selectedTaskId,
          scenarioId: runtimeConfig.scenarioId,
          startStateId: runtimeConfig.startStateId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { episode?: HostedSessionRecord["latestEpisode"]; error?: string } | null;
      if (!response.ok || !payload?.episode) {
        throw new Error(payload?.error || "Reset failed");
      }
      applyEpisodeUpdate(payload.episode);
      return true;
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Reset failed");
      return false;
    } finally {
      setRuntimeBusyLabel("");
    }
  };

  const stepRuntime = async (params: {
    action?: ReadonlyArray<number> | null;
    autoPolicy?: boolean;
    label: string;
  }) => {
    if (!sessionId || !runtimeInteractive) {
      return false;
    }
    setRuntimeBusyLabel(params.label);
    setControlError("");
    try {
      const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/step`, {
        method: "POST",
        body: JSON.stringify({
          episodeId: latestEpisode?.episodeId || "",
          action: Array.isArray(params.action) ? [...params.action] : undefined,
          autoPolicy: params.autoPolicy !== false,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { episode?: HostedSessionRecord["latestEpisode"]; error?: string } | null;
      if (!response.ok || !payload?.episode) {
        throw new Error(payload?.error || "Step failed");
      }
      applyEpisodeUpdate(payload.episode);
      return true;
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Step failed");
      return false;
    } finally {
      setRuntimeBusyLabel("");
    }
  };

  const handleScriptedWalkthrough = async () => {
    if (!sessionId || !runtimeInteractive) {
      return;
    }
    setRuntimeBusyLabel("Running scripted walkthrough");
    setControlError("");
    try {
      for (const step of SCRIPTED_WALKTHROUGH) {
        const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/step`, {
          method: "POST",
          body: JSON.stringify({
            episodeId: latestEpisode?.episodeId || "",
            action: [...step.action],
            autoPolicy: false,
          }),
        });
        const payload = (await response.json().catch(() => null)) as { episode?: HostedSessionRecord["latestEpisode"]; error?: string } | null;
        if (!response.ok || !payload?.episode) {
          throw new Error(payload?.error || `Scripted movement failed at ${step.label}`);
        }
        applyEpisodeUpdate(payload.episode);
      }
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Scripted walkthrough failed");
    } finally {
      setRuntimeBusyLabel("");
    }
  };

  const handleBatch = async () => {
    if (!sessionId || !runtimeInteractive) return;
    setRuntimeBusyLabel("Running scripted demo batch");
    setControlError("");
    try {
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
      const payload = (await response.json().catch(() => null)) as {
        summary?: HostedSessionRecord["batchSummary"];
        artifact_uris?: Record<string, string>;
        dataset_artifacts?: Record<string, unknown>;
        error?: string;
      } | null;
      if (!response.ok || !payload?.summary) {
        throw new Error(payload?.error || "Batch run failed");
      }
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
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Batch run failed");
    } finally {
      setRuntimeBusyLabel("");
    }
  };

  const handleExport = async () => {
    if (!sessionId || !runtimeInteractive) return;
    setRuntimeBusyLabel("Exporting demo package");
    setControlError("");
    try {
      const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/export`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as {
        artifact_uris?: Record<string, string>;
        dataset_artifacts?: Record<string, unknown>;
        error?: string;
      } | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Export failed");
      }
      setSessionRecord((current) =>
        current
          ? {
              ...current,
              artifactUris: payload.artifact_uris || current.artifactUris,
              datasetArtifacts: payload.dataset_artifacts || current.datasetArtifacts,
            }
          : current,
      );
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setRuntimeBusyLabel("");
    }
  };

  const handleStop = async () => {
    if (sessionId) {
      try {
        await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/stop`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch {
        // Keep the local stop state even if the stop request fails.
      }
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

  useEffect(() => {
    if (!runtimeInteractive || sessionStatus !== "live" || autoBootstrapState !== "idle") {
      return;
    }
    if (latestEpisode?.episodeId && (selectedObservationSrc || observationFramePath || remoteObservationFramePath)) {
      setAutoBootstrapState("done");
      return;
    }
    setAutoBootstrapState("running");
    void handleReset({ silent: true }).finally(() => {
      setAutoBootstrapState("done");
    });
  }, [
    autoBootstrapState,
    latestEpisode?.episodeId,
    observationFramePath,
    remoteObservationFramePath,
    runtimeInteractive,
    selectedObservationSrc,
    sessionStatus,
  ]);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Hosted session not found</h1>
      </div>
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
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Hosted Session Workspace
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
                Interactive Site-World Viewer
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                One page for the grounded canonical site-world, the scene-memory conditioning package, the live robot
                runtime, and the derived presentation world.
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{site.siteName}</p>
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
                Mode: {activeMode === "live_runtime" ? "Live Runtime" : "Presentation World"}
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

          {controlError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {controlError}
            </div>
          ) : null}

          <section className="mt-6 rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.92))] p-6 shadow-sm">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Built World Model Demo</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950">
                  The runtime-backed site-world is already built. This page lets a human inspect it through two lenses.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  `Live Runtime` stays grounded in the real session outputs. `Presentation World` surfaces the customer-facing
                  representation truthfully, using embedded UI only when a stable public viewer is actually available.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailPill label="Canonical Version" value={canonicalPackageVersion || "Unspecified"} />
                  <DetailPill label="Runtime Step" value={String(latestEpisode?.stepIndex ?? 0)} />
                  <DetailPill label="Reward" value={latestEpisode?.reward != null ? String(latestEpisode.reward) : "0"} />
                  <DetailPill label="Presentation Mode" value={presentationAvailabilityLabel} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ModeToggleButton
                    title="Live Runtime"
                    description="Robot-session controls, camera switching, first-frame bootstrapping, and runtime outputs."
                    active={activeMode === "live_runtime"}
                    onClick={() => setActiveMode("live_runtime")}
                  />
                  <ModeToggleButton
                    title="Presentation World"
                    description="Human-facing site-world view with embedded viewer when live, otherwise manifest-backed fallback."
                    active={activeMode === "presentation_world"}
                    onClick={() => setActiveMode("presentation_world")}
                  />
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Demo Guarantees</p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-300">
                    {[
                      "Canonical site-world is the grounded source of truth.",
                      "Scene-memory conditioning is related support data, not the canonical runtime binding.",
                      "Runtime session outputs stay labeled as downstream observations and exports.",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical Site-World</p>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">Grounded runtime binding</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The grounded site-world package is the authoritative source the runtime is bound to for this session.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailPill label="Scene" value={site.sceneId} />
                <DetailPill label="Capture" value={site.captureId} />
                <DetailPill label="Qualification" value={humanizeValue(site.deploymentReadiness?.qualification_state, "qualified")} />
                <DetailPill label="Health" value={humanizeValue(sessionRecord?.runtimeHandle?.health_status || site.runtimeManifest?.healthStatus, "unknown")} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <MetadataLink href={canonicalPackageUri} label="View canonical package" />
                <MetadataLink href={siteWorldRegistrationUri} label="View runtime registration" />
                <MetadataLink href={siteWorldHealthUri} label="View site-world health" />
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Scene-Memory Conditioning Package</p>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">Support artifacts for conditioning</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These artifacts inform reconstruction and presentation, but they are not the same object as the canonical
                runtime package.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailPill label="Primary backend" value={sessionRecord?.siteModel?.defaultRuntimeBackend || site.defaultRuntimeBackend} />
                <DetailPill label="Scenario variants" value={String(sessionRecord?.siteModel?.availableScenarioVariants?.length || site.scenarioVariants.length)} />
                <DetailPill label="Start states" value={String(sessionRecord?.siteModel?.availableStartStates?.length || site.startStates.length)} />
                <DetailPill label="Pipeline prefix" value={site.pipelinePrefix.split("/").slice(-2).join("/")} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <MetadataLink href={sceneMemoryManifestUri} label="View scene-memory manifest" />
                <MetadataLink href={conditioningBundleUri} label="View conditioning bundle" />
                <MetadataLink href={presentationWorldManifestUri} label="View presentation manifest" />
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Runtime Session Outputs</p>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">Downstream session products</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Observation frames, rollout media, exports, and batch summaries all come from the current runtime session.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailPill label="Current step" value={String(latestEpisode?.stepIndex ?? 0)} />
                <DetailPill label="Protected regions" value={String(protectedRegionViolations.length)} />
                <DetailPill label="Rollout video" value={rolloutVideoPath ? "Available" : "Pending"} />
                <DetailPill label="Raw bundle" value={rawBundlePath ? "Available" : "Pending"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <MetadataLink href={selectedObservationSrc || null} label="Open latest frame" />
                <MetadataLink href={rolloutVideoPath || null} label="Open rollout video" />
                <MetadataLink href={exportManifestPath || null} label="Open export manifest" />
                <MetadataLink href={rawBundlePath || null} label="Open raw bundle" />
              </div>
            </article>
          </section>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            {activeMode === "live_runtime" ? (
              <>
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live Runtime</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">Human-explorable robot viewport</h2>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                      {runtimeBusyLabel || (autoBootstrapState === "running" ? "Resetting runtime and fetching the first frame" : "Ready")}
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    {hasVisibleObservation ? (
                      <img
                        key={selectedObservationSrc}
                        src={selectedObservationSrc}
                        alt="Latest robot observation frame"
                        className="h-[360px] w-full rounded-2xl object-cover"
                        onError={() => setObservationLoadError(true)}
                        onLoad={() => setObservationLoadError(false)}
                      />
                    ) : (
                      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                        <div className="max-w-md">
                          <Camera className="mx-auto h-8 w-8 text-slate-400" />
                          <p className="mt-3 text-sm font-semibold text-slate-900">
                            {runtimeInteractive
                              ? "No browser-visible frame yet"
                              : "Live runtime controls are unavailable in this session mode"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {runtimeInteractive
                              ? "This workspace never leaves you with a dead observation box. Reset the session, run one step, or use the scripted walkthrough to fetch the first visible frame."
                              : "This session was launched as a presentation-only demo. Switch to Presentation World to inspect the derived site representation instead."}
                          </p>
                          <div className="mt-4 flex flex-wrap justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => void handleReset()}
                              disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                              className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reset and fetch first frame
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void stepRuntime({
                                  label: "Advancing one runtime step",
                                  action: DEFAULT_RUNTIME_ACTION,
                                  autoPolicy: true,
                                })
                              }
                              disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              Advance one step
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveMode("presentation_world")}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Open Presentation World
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <MetadataLink href={selectedObservationSrc || null} label="Open latest frame" />
                      <MetadataLink href={rolloutVideoPath || null} label="Open rollout video" />
                      <MetadataLink href={exportManifestPath || null} label="Open export manifest" />
                      <MetadataLink href={rawBundlePath || null} label="Open raw bundle" />
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Observation cameras</p>
                            <p className="mt-1 text-xs text-slate-500">Switch the render camera without leaving the runtime.</p>
                          </div>
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {selectedCameraId || "No camera"}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {cameraOptions.map((camera) => (
                            <button
                              key={camera.id}
                              type="button"
                              onClick={() => {
                                setSelectedCameraId(camera.id);
                                setObservationLoadError(false);
                              }}
                              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                selectedCameraId === camera.id
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {camera.role}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">Runtime quality state</p>
                        <p className="mt-2 text-sm text-slate-600">
                          Presentation quality: {humanizeValue(String(qualityFlags?.presentation_quality || ""), "unknown")}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Fallback mode: {humanizeValue(String(qualityFlags?.fallback_mode || ""), "none")}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Protected-region violations: {protectedRegionViolations.length}
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
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Session Controls</p>
                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={() => void handleReset()}
                        disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset and fetch first frame
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleScriptedWalkthrough()}
                        disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Run scripted walkthrough
                      </button>
                      <button
                        type="button"
                        onClick={handleBatch}
                        disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Run scripted demo batch
                      </button>
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export demo package
                      </button>
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Step Controls</p>
                    <div className="mt-4 space-y-3">
                      {RUNTIME_ACTION_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            void stepRuntime({
                              label: preset.label,
                              action: preset.action,
                              autoPolicy: preset.autoPolicy,
                            })
                          }
                          disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                          <p className="mt-1 text-sm text-slate-600">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Run Context</p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Robot profile</p>
                        <p className="mt-1 text-sm text-slate-900">{robotProfile.displayName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Task / scenario / start state</p>
                        <p className="mt-1 text-sm text-slate-900">
                          {taskSelection?.taskText} · {scenario?.name || "Pending"} · {startState?.name || "Pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Action space</p>
                        <p className="mt-1 text-sm text-slate-900">{robotProfile.actionSpaceSummary}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Runtime endpoint</p>
                        <p className="mt-1 break-all text-sm text-slate-900">
                          {String(sessionRecord?.runtimeHandle?.runtime_base_url || site.runtimeManifest?.runtimeBaseUrl || "Not connected")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Build / VM</p>
                        <p className="mt-1 break-all text-sm text-slate-900">
                          {String(sessionRecord?.runtimeHandle?.build_id || "Pending")} · {String(sessionRecord?.runtimeHandle?.vm_instance_id || "Unknown")}
                        </p>
                      </div>
                    </div>
                  </article>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Presentation World</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">Customer-facing site representation</h2>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                      {presentationAvailabilityLabel}
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    {presentationInteractive && !showIframeFallback && uiBootstrapUrl ? (
                      <iframe
                        title="Embedded NeoVerse demo"
                        src={uiBootstrapUrl}
                        className="h-[720px] w-full rounded-2xl border border-slate-200 bg-white"
                        onLoad={() => setIframeLoaded(true)}
                      />
                    ) : (
                      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <div className="max-w-xl">
                          <TriangleAlert className="mx-auto h-8 w-8 text-amber-600" />
                          <p className="mt-4 text-lg font-semibold text-slate-900">
                            Embedded public presentation viewer is not configured for this walkthrough.
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            The underlying presentation world exists, but this workspace falls back to manifest-backed
                            presentation artifacts unless a stable public viewer URL is live. This keeps the page truthful
                            instead of shipping a dead iframe.
                          </p>
                          <div className="mt-5 flex flex-wrap justify-center gap-3">
                            {openDemoUrl ? <MetadataLink href={openDemoUrl} label="Open live presentation viewer" /> : null}
                            <MetadataLink href={presentationWorldManifestUri} label="Open presentation manifest" />
                            <MetadataLink href={runtimeDemoManifestUri} label="Open runtime demo manifest" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Presentation source</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {presentationInteractive ? "Embedded NeoVerse session" : "Presentation-world artifacts"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canonical truth</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Grounding first, provenance required</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Interactivity envelope</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Scene inspection, camera paths, prompt-driven variants</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Presentation Inputs</p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Canonical package</p>
                        <p className="mt-1 break-all text-sm text-slate-900">{canonicalPackageUri || "Unspecified"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Scene-memory manifest</p>
                        <p className="mt-1 break-all text-sm text-slate-900">{sceneMemoryManifestUri || "Unavailable"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Conditioning bundle</p>
                        <p className="mt-1 break-all text-sm text-slate-900">{conditioningBundleUri || "Unavailable"}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <MetadataLink href={canonicalPackageUri} label="View canonical package" />
                        <MetadataLink href={sceneMemoryManifestUri} label="View scene-memory manifest" />
                        <MetadataLink href={conditioningBundleUri} label="View conditioning bundle" />
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Presentation Outputs</p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Presentation manifest</p>
                        <p className="mt-1 break-all text-sm text-slate-900">{presentationWorldManifestUri || "Unavailable"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Runtime demo manifest</p>
                        <p className="mt-1 break-all text-sm text-slate-900">{runtimeDemoManifestUri || "Unavailable"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Presentation note</p>
                        <p className="mt-1 text-sm text-slate-900">
                          Derived presentation media is customer-facing and may differ from the canonical site-world. Use
                          the canonical package for source-of-truth review.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <MetadataLink href={presentationWorldManifestUri} label="Open presentation manifest" />
                        <MetadataLink href={runtimeDemoManifestUri} label="Open runtime demo manifest" />
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Clock3 className="h-4 w-4" />
                      Site-World Summary
                    </p>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      NeoVerse can support trajectory presets, custom trajectories, preview renders, and scene inspection,
                      but this demo only exposes those capabilities here when the public presentation viewer is actually live.
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
              </>
            )}
          </div>

          <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Session Snapshot</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {generatedRows.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 break-all text-sm text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
            {datasetRlds?.manifestUri ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <MetadataLink href={datasetRlds.manifestUri} label="Open RLDS dataset" />
                <MetadataLink href={datasetRlds.trainJsonl || null} label="Open RLDS train split" />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
