import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Compass,
  Download,
  ExternalLink,
  Layers3,
  MonitorPlay,
  RotateCcw,
  Square,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { SiteWorldCanonicalViewer } from "@/components/site/SiteWorldCanonicalViewer";
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
  ArtifactExplorerObject,
  ArtifactExplorerView,
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

const DEFAULT_RUNTIME_ACTION = [0, 0, 0, 0, 0, 0, 0];

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
  if (record.status === "failed") {
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

function ModeStateBadge(props: { label: string; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const toneClass =
    props.tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : props.tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : props.tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${toneClass}`}>
      {props.label}
    </div>
  );
}

function ExplorerViewButton(props: {
  view: ArtifactExplorerView;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-[22px] border px-4 py-4 text-left transition ${
        props.active
          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{props.view.title}</p>
          <p className={`mt-2 text-sm leading-6 ${props.active ? "text-slate-200" : "text-slate-500"}`}>
            {props.view.description}
          </p>
        </div>
        {props.view.badge ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              props.active ? "bg-white/15 text-slate-100" : "bg-slate-100 text-slate-500"
            }`}
          >
            {props.view.badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function DiagnosticPanel(props: {
  title: string;
  diagnostic?: HostedSessionRecord["latestRuntimeFailure"] | null;
}) {
  if (!props.diagnostic) {
    return null;
  }

  return (
    <details className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
      <summary className="cursor-pointer list-none font-semibold">
        {props.title}: {props.diagnostic.summary}
      </summary>
      <div className="mt-3 space-y-2">
        <p>
          Operation: {props.diagnostic.operation.replaceAll("_", " ")} · Code: {props.diagnostic.code}
          {props.diagnostic.exitCode != null ? ` · Exit code: ${props.diagnostic.exitCode}` : ""}
        </p>
        {props.diagnostic.traceback ? (
          <pre className="overflow-x-auto rounded-xl border border-rose-200 bg-white/70 p-3 text-xs leading-5 text-rose-950">
            {props.diagnostic.traceback}
          </pre>
        ) : props.diagnostic.detail ? (
          <pre className="overflow-x-auto rounded-xl border border-rose-200 bg-white/70 p-3 text-xs leading-5 text-rose-950">
            {props.diagnostic.detail}
          </pre>
        ) : null}
      </div>
    </details>
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
  const [activeMode, setActiveMode] = useState<WorkspaceViewMode>("live_runtime");
  const [userSelectedMode, setUserSelectedMode] = useState(false);
  const [selectedExplorerViewId, setSelectedExplorerViewId] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [runtimeBusyLabel, setRuntimeBusyLabel] = useState("");
  const [autoBootstrapState, setAutoBootstrapState] = useState<BootstrapState>("idle");
  const [observationRefreshKey, setObservationRefreshKey] = useState(0);
  const [observationLoadError, setObservationLoadError] = useState(false);
  const [liveObservationSrc, setLiveObservationSrc] = useState("");
  const [lastLiveRenderContext, setLastLiveRenderContext] = useState<{
    cameraId: string;
    stepIndex: number;
  } | null>(null);
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
    if (
      !sessionId ||
      activeMode !== "presentation_world" ||
      sessionRecord?.presentationRuntime?.status !== "live" ||
      sessionStatus !== "live"
    ) {
      return;
    }
    let cancelled = false;
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
          setWorkspaceError(error instanceof Error ? error.message : "Unable to create embedded demo access");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeMode, sessionId, sessionRecord?.presentationRuntime?.status, sessionStatus]);

  useEffect(() => {
    setAutoBootstrapState("idle");
    setObservationRefreshKey(0);
    setObservationLoadError(false);
    setLiveObservationSrc((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return "";
    });
    setLastLiveRenderContext(null);
    setControlError("");
    setUiBootstrapUrl("");
    setUserSelectedMode(false);
    setSelectedExplorerViewId("");
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (liveObservationSrc.startsWith("blob:")) {
        URL.revokeObjectURL(liveObservationSrc);
      }
    };
  }, [liveObservationSrc]);

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
  const runtimeDemoManifestUri =
    sessionRecord?.siteModel?.runtimeDemoManifestUri ||
    site?.presentationDemoReadiness?.runtimeDemoManifestUri ||
    null;
  const presentationLaunchState = sessionRecord?.presentationLaunchState || null;
  const runtimeReferenceImageUrl = site?.runtimeReferenceImageUrl || null;
  const artifactExplorer = sessionRecord?.siteModel?.artifactExplorer || site?.artifactExplorer || null;
  const canonicalObjects = (artifactExplorer?.objects || []) as ArtifactExplorerObject[];
  const artifactExplorerViews = (artifactExplorer?.views || []).filter((item) => item.available);
  const openDemoUrl = uiBootstrapUrl || "";
  const runtimeInteractive =
    Boolean(sessionId) &&
    sessionMode !== "presentation_demo" &&
    sessionStatus !== "starting" &&
    sessionStatus !== "stopped" &&
    sessionStatus !== "error";
  const presentationInteractive =
    sessionStatus === "live" && sessionRecord?.presentationRuntime?.status === "live" && Boolean(openDemoUrl);
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
    if (artifactExplorerViews.length === 0) {
      setSelectedExplorerViewId("");
    } else {
      setSelectedExplorerViewId((current) =>
        current && artifactExplorerViews.some((item) => item.id === current) ? current : artifactExplorerViews[0].id,
      );
    }
  }, [artifactExplorerViews]);

  useEffect(() => {
    if (canonicalObjects.length === 0) {
      setSelectedObjectId("");
      return;
    }
    const preferred =
      canonicalObjects.find((item) => item.taskCritical) ||
      canonicalObjects.find((item) => item.taskRole === "context_object") ||
      canonicalObjects[0];
    setSelectedObjectId((current) =>
      current && canonicalObjects.some((item) => item.id === current) ? current : preferred.id,
    );
  }, [canonicalObjects]);

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
  const selectedCameraRenderableFallback = !runtimeInteractive && isRenderableObservationPath(selectedCameraRemoteFramePath)
    ? selectedCameraRemoteFramePath
    : !runtimeInteractive && isRenderableObservationPath(observationFramePath)
      ? observationFramePath
      : !runtimeInteractive && isRenderableObservationPath(remoteObservationFramePath)
        ? remoteObservationFramePath
        : "";
  const renderRouteHref =
    runtimeInteractive && sessionId && (selectedCameraId || primaryCameraId)
      ? `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/render?cameraId=${encodeURIComponent(
          selectedCameraId || primaryCameraId,
        )}&refresh=${observationRefreshKey}`
      : selectedCameraRenderableFallback;
  const selectedObservationSrc = liveObservationSrc || renderRouteHref || selectedCameraRenderableFallback;
  const hasVisibleObservation = Boolean(
    selectedObservationSrc && isRenderableObservationPath(selectedObservationSrc) && !observationLoadError,
  );
  const runtimeDiagnostic = sessionRecord?.latestRuntimeFailure || null;
  const runtimeDegraded = Boolean(runtimeDiagnostic && liveObservationSrc);
  const showRuntimeReferencePreview = !hasVisibleObservation && Boolean(runtimeReferenceImageUrl);
  const artifactExplorerReady = artifactExplorer?.status === "ready" || artifactExplorer?.status === "partial";
  const selectedExplorerView =
    artifactExplorerViews.find((item) => item.id === selectedExplorerViewId) || artifactExplorerViews[0] || null;
  const selectedObject =
    canonicalObjects.find((item) => item.id === selectedObjectId) ||
    canonicalObjects.find((item) => item.taskCritical) ||
    canonicalObjects[0] ||
    null;
  const presentationAvailabilityLabel = presentationInteractive
    ? "Private operator view live"
    : artifactExplorerReady
      ? "Artifact-backed exploration ready"
      : "Exploration assets unavailable";
  const runtimeModeState = runtimeDegraded
    ? { label: "Live Runtime: Degraded", tone: "amber" as const }
    : hasVisibleObservation
      ? { label: "Live Runtime: Live", tone: "emerald" as const }
      : runtimeDiagnostic
        ? { label: "Live Runtime: Failed", tone: "rose" as const }
        : { label: "Live Runtime: Ready", tone: "slate" as const };
  const presentationModeState = presentationInteractive
    ? { label: "Explore Site-World: Operator view live", tone: "emerald" as const }
    : artifactExplorerReady
      ? { label: "Explore Site-World: Artifact-backed", tone: "amber" as const }
      : { label: "Explore Site-World: Missing", tone: "rose" as const };
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

  useEffect(() => {
    if (userSelectedMode) {
      return;
    }
    if (sessionMode === "presentation_demo" || (!hasVisibleObservation && artifactExplorerReady)) {
      setActiveMode("presentation_world");
      return;
    }
    setActiveMode("live_runtime");
  }, [artifactExplorerReady, hasVisibleObservation, sessionMode, userSelectedMode]);

  const applyRuntimeDiagnostic = (diagnostic?: HostedSessionRecord["latestRuntimeFailure"] | null, fallback?: string) => {
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            latestRuntimeFailure: diagnostic || current.latestRuntimeFailure || null,
          }
        : current,
    );
    setControlError(diagnostic?.summary || fallback || "Runtime request failed");
  };

  const applyEpisodeUpdate = (episode: HostedSessionRecord["latestEpisode"]) => {
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            latestEpisode: episode,
            status: "running",
            latestRuntimeFailure: null,
          }
        : current,
    );
    setSessionStatus("live");
    setObservationRefreshKey((current) => current + 1);
    setObservationLoadError(false);
  };

  useEffect(() => {
    if (!runtimeInteractive || !sessionId || !latestEpisode?.episodeId || !(selectedCameraId || primaryCameraId)) {
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;
    const cameraId = selectedCameraId || primaryCameraId;

    void (async () => {
      try {
        const response = await authorizedJsonFetch(
          `/api/site-worlds/sessions/${sessionId}/render?cameraId=${encodeURIComponent(cameraId)}&refresh=${observationRefreshKey}`,
          { signal: controller.signal },
        );
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!response.ok || contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            diagnostic?: HostedSessionRecord["latestRuntimeFailure"];
          } | null;
          throw payload || { error: "Render failed" };
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setLiveObservationSrc((current) => {
          if (current.startsWith("blob:")) {
            URL.revokeObjectURL(current);
          }
          return objectUrl;
        });
        setObservationLoadError(false);
        setLastLiveRenderContext({
          cameraId,
          stepIndex: latestEpisode.stepIndex ?? 0,
        });
        setSessionRecord((current) =>
          current
            ? {
                ...current,
                latestRuntimeFailure:
                  current.latestRuntimeFailure?.operation === "render" ? null : current.latestRuntimeFailure,
              }
            : current,
        );
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        const payload = error as {
          error?: string;
          diagnostic?: HostedSessionRecord["latestRuntimeFailure"];
        };
        setSessionRecord((current) =>
          current
            ? {
                ...current,
                latestRuntimeFailure: payload?.diagnostic || current.latestRuntimeFailure || null,
              }
            : current,
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    latestEpisode?.episodeId,
    latestEpisode?.stepIndex,
    observationRefreshKey,
    primaryCameraId,
    runtimeInteractive,
    selectedCameraId,
    sessionId,
  ]);

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
      const payload = (await response.json().catch(() => null)) as {
        episode?: HostedSessionRecord["latestEpisode"];
        error?: string;
        diagnostic?: HostedSessionRecord["latestRuntimeFailure"];
      } | null;
      if (!response.ok || !payload?.episode) {
        applyRuntimeDiagnostic(payload?.diagnostic, payload?.error || "Reset failed");
        return false;
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
      const payload = (await response.json().catch(() => null)) as {
        episode?: HostedSessionRecord["latestEpisode"];
        error?: string;
        diagnostic?: HostedSessionRecord["latestRuntimeFailure"];
      } | null;
      if (!response.ok || !payload?.episode) {
        applyRuntimeDiagnostic(payload?.diagnostic, payload?.error || "Step failed");
        return false;
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
        const payload = (await response.json().catch(() => null)) as {
          episode?: HostedSessionRecord["latestEpisode"];
          error?: string;
          diagnostic?: HostedSessionRecord["latestRuntimeFailure"];
        } | null;
        if (!response.ok || !payload?.episode) {
          applyRuntimeDiagnostic(payload?.diagnostic, payload?.error || `Scripted movement failed at ${step.label}`);
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
                Mode: {activeMode === "live_runtime" ? "Live Runtime" : "Explore Site-World"}
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

          <DiagnosticPanel
            title={runtimeDiagnostic?.source === "presentation_demo" ? "Presentation diagnostics" : "Runtime diagnostics"}
            diagnostic={runtimeDiagnostic}
          />

          <section className="mt-6 rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.92))] p-6 shadow-sm">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Built World Model Demo</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950">
                  The site-world is already built. This page now optimizes for dependable exploration first, live runtime second.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  `Explore Site-World` is the default customer-facing path when live runtime frames are unavailable.
                  `Live Runtime` stays grounded in the real session outputs, and the private operator bridge only appears when
                  a real internal NeoVerse UI is actually live.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailPill label="Canonical Version" value={canonicalPackageVersion || "Unspecified"} />
                  <DetailPill label="Runtime Step" value={String(latestEpisode?.stepIndex ?? 0)} />
                  <DetailPill label="Reward" value={latestEpisode?.reward != null ? String(latestEpisode.reward) : "0"} />
                  <DetailPill label="Exploration Mode" value={presentationAvailabilityLabel} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ModeToggleButton
                    title="Live Runtime"
                    description="Robot-session controls, camera switching, first-frame bootstrapping, and runtime outputs."
                    active={activeMode === "live_runtime"}
                    onClick={() => {
                      setUserSelectedMode(true);
                      setActiveMode("live_runtime");
                    }}
                  />
                  <ModeToggleButton
                    title="Explore Site-World"
                    description="Artifact-backed exploration first, with a private operator bridge only when a live internal UI exists."
                    active={activeMode === "presentation_world"}
                    onClick={() => {
                      setUserSelectedMode(true);
                      setActiveMode("presentation_world");
                    }}
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
                <MetadataLink href={renderRouteHref || null} label="Open latest frame" />
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
                    <div className="flex flex-wrap items-center gap-3">
                      <ModeStateBadge label={runtimeModeState.label} tone={runtimeModeState.tone} />
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                        {runtimeBusyLabel || (autoBootstrapState === "running" ? "Resetting runtime and fetching the first frame" : "Ready")}
                      </div>
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
                    ) : showRuntimeReferencePreview ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <img
                          src={runtimeReferenceImageUrl || ""}
                          alt="Validated runtime reference frame"
                          className="h-[360px] w-full rounded-2xl object-cover"
                        />
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                          Live stepping did not return a browser-visible frame. Showing the validated March 13 reference
                          render in-page while the current runtime path is unavailable.
                        </div>
                      </div>
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
                              : "This session was launched as a presentation-only demo. Switch to Explore Site-World to inspect the saved derived representation instead."}
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
                              onClick={() => {
                                setUserSelectedMode(true);
                                setActiveMode("presentation_world");
                              }}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Open Explore Site-World
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <MetadataLink href={renderRouteHref || null} label="Open latest frame" />
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
                                setObservationRefreshKey((current) => current + 1);
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
                        {runtimeDegraded && lastLiveRenderContext ? (
                          <p className="mt-3 text-xs text-amber-700">
                            Showing the last good live frame from {lastLiveRenderContext.cameraId} at step {lastLiveRenderContext.stepIndex} while the current render path is degraded.
                          </p>
                        ) : showRuntimeReferencePreview ? (
                          <p className="mt-3 text-xs text-slate-500">
                            In-page preview is currently a validated reference frame, not a live stepped render.
                          </p>
                        ) : null}
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Explore Site-World</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">Canonical site-world explorer</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <ModeStateBadge label={presentationModeState.label} tone={presentationModeState.tone} />
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                        {presentationAvailabilityLabel}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
                    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,248,237,0.84),rgba(255,255,255,0.98))] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Primary Explorer</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Orbit, pan, and zoom the canonical site-specific world model. This is the real scene geometry bundle, not a captured website UI.
                          </p>
                        </div>
                        {artifactExplorer?.sceneKind ? (
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                            {artifactExplorer.sceneKind === "canonical_object_geometry" ? "Canonical object geometry" : "Derived presentation"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-3">
                        {canonicalObjects.length > 0 ? (
                          <SiteWorldCanonicalViewer
                            objects={canonicalObjects}
                            selectedObjectId={selectedObjectId}
                            className="border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.48),rgba(230,225,214,0.66))]"
                          />
                        ) : (
                          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4">
                            <SiteWorldGraphic site={site} />
                          </div>
                        )}
                        <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                          <div>
                            <p className="text-lg font-semibold text-slate-950">
                              {selectedObject ? `${selectedObject.label} in canonical scene` : artifactExplorer?.headline || "Artifact explorer unavailable"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {selectedObject
                                ? `Focused object: ${selectedObject.label}${selectedObject.taskRole ? ` · ${selectedObject.taskRole.replaceAll("_", " ")}` : ""}.`
                                : artifactExplorer?.summary || "This site does not expose enough bundled exploration artifacts yet."}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <DetailPill
                              label="Derivation mode"
                              value={humanizeValue(artifactExplorer?.derivationMode, "canonical geometry")}
                            />
                            <DetailPill
                              label="Scene objects"
                              value={String(canonicalObjects.length || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <Compass className="h-4 w-4" />
                          Scene Focus
                        </p>
                        <div className="mt-4 grid gap-3">
                          {canonicalObjects.length > 0 ? (
                            canonicalObjects
                              .slice(0, 12)
                              .map((object) => (
                              <ExplorerViewButton
                                key={object.id}
                                view={{
                                  id: object.id,
                                  title: object.label,
                                  description:
                                    `${object.taskRole ? object.taskRole.replaceAll("_", " ") : "context object"} · ${object.taskCritical ? "task critical" : "scene context"}`,
                                  badge: object.groundingLevel ? humanizeValue(object.groundingLevel) : null,
                                  available: true,
                                }}
                                active={selectedObject?.id === object.id}
                                onClick={() => setSelectedObjectId(object.id)}
                              />
                              ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                              No canonical scene objects are available for this site yet.
                            </div>
                          )}
                        </div>
                      </article>

                      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <Layers3 className="h-4 w-4" />
                          Secondary Derived Views
                        </p>
                        <div className="mt-4 grid gap-3">
                          {selectedObject?.selectedViewUrls?.length ? (
                            <div className="grid grid-cols-2 gap-3">
                              {selectedObject.selectedViewUrls.slice(0, 4).map((imageUrl, index) => (
                                <img
                                  key={imageUrl}
                                  src={imageUrl}
                                  alt={`${selectedObject.label} synthetic view ${index + 1}`}
                                  className="h-28 w-full rounded-2xl border border-slate-200 object-cover"
                                />
                              ))}
                            </div>
                          ) : selectedExplorerView?.imageUrl ? (
                            <img
                              src={selectedExplorerView.imageUrl}
                              alt={selectedExplorerView.title}
                              className="h-52 w-full rounded-2xl border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                              No secondary derived views are bundled for the current focus object.
                            </div>
                          )}
                        </div>
                      </article>

                      <article className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          <MonitorPlay className="h-4 w-4" />
                          Private Operator View
                        </p>
                        <p className="mt-4 text-lg font-semibold">
                          {presentationInteractive ? "Internal NeoVerse bridge is live" : artifactExplorer?.operatorView.label || "Internal bridge unavailable"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {presentationInteractive
                            ? "Use this only for internal movement and debugging. It is a real proxied operator UI, not the public product surface."
                            : artifactExplorer?.operatorView.description || "The operator bridge only appears when a stable internal UI URL is configured."}
                        </p>
                        {presentationInteractive ? null : presentationLaunchState?.mode === "presentation_ui_unconfigured" ? (
                          <p className="mt-3 text-sm leading-6 text-amber-300">
                            Operator-view status: internal UI is not configured for this site yet.
                          </p>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-3">
                          {openDemoUrl ? <MetadataLink href={openDemoUrl} label="Open private operator view" /> : null}
                          <MetadataLink href={presentationWorldManifestUri} label="Open presentation manifest" />
                          <MetadataLink href={runtimeDemoManifestUri} label="Open runtime demo manifest" />
                        </div>
                      </article>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Explorer source</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Saved world-model artifacts</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canonical truth</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Grounding first, provenance required</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Browser behavior</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Non-generative at runtime</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Operator bridge</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {presentationInteractive ? "Live internal UI" : "Only when configured"}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Explorer Sources</p>
                    <div className="mt-4 space-y-4">
                      {(artifactExplorer?.sources || []).length > 0 ? (
                        <>
                          {(artifactExplorer?.sources || []).map((source) => (
                            <div key={source.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <p className="text-sm font-medium text-slate-500">{source.label}</p>
                              <p className="mt-1 break-all text-sm text-slate-900">{source.uri || "Unavailable"}</p>
                              {source.detail ? <p className="mt-2 text-sm text-slate-600">{source.detail}</p> : null}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                          No normalized explorer sources are available yet.
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exploration Notes</p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">What this mode is</p>
                        <p className="mt-1 text-sm text-slate-900">
                          A dependable explorer over saved world-model outputs and bundled validation frames.
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">What this mode is not</p>
                        <p className="mt-1 text-sm text-slate-900">
                          It does not create fresh geometry or hallucinate missing scene regions in the browser.
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Derived presentation caveat</p>
                        <p className="mt-1 text-sm text-slate-900">
                          If a saved presentation artifact already contains inferred or completed regions, you will see those
                          upstream-derived outputs here, but nothing new is generated client-side.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <MetadataLink href={canonicalPackageUri} label="View canonical package" />
                        <MetadataLink href={sceneMemoryManifestUri} label="View scene-memory manifest" />
                        <MetadataLink href={conditioningBundleUri} label="View conditioning bundle" />
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Layers3 className="h-4 w-4" />
                      Site-World Topology
                    </p>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      The topology graphic stays anchored to the same site record while the artifact viewer swaps the saved
                      viewpoints. Use it as the stable map while moving through the saved outputs.
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
