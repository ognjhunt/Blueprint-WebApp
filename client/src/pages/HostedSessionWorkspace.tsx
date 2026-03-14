import { useEffect, useMemo, useRef, useState } from "react";
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
  ExplorerPose,
  ExplorerState,
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
type ExplorerRefineMode = "idle" | "request";

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
    id: "glide-back",
    label: "Move backward",
    description: "Ease backward to reframe the current corridor or workcell.",
    action: [-0.35, 0, 0, 0, 0, 0, 1],
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
    id: "turn-right",
    label: "Turn right",
    description: "Rotate toward the opposite side of the site-world without leaving the current state.",
    action: [0, 0, -0.35, 0, 0, 0, 1],
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

const RUNTIME_KEYBOARD_ACTIONS: Record<
  string,
  { label: string; action: number[]; autoPolicy: boolean }
> = {
  arrowup: {
    label: "Moving forward",
    action: [0.45, 0, 0, 0, 0, 0, 1],
    autoPolicy: false,
  },
  w: {
    label: "Moving forward",
    action: [0.45, 0, 0, 0, 0, 0, 1],
    autoPolicy: false,
  },
  arrowdown: {
    label: "Moving backward",
    action: [-0.35, 0, 0, 0, 0, 0, 1],
    autoPolicy: false,
  },
  s: {
    label: "Moving backward",
    action: [-0.35, 0, 0, 0, 0, 0, 1],
    autoPolicy: false,
  },
  arrowleft: {
    label: "Turning left",
    action: [0, 0, 0.35, 0, 0, 0, 1],
    autoPolicy: false,
  },
  a: {
    label: "Turning left",
    action: [0, 0, 0.35, 0, 0, 0, 1],
    autoPolicy: false,
  },
  arrowright: {
    label: "Turning right",
    action: [0, 0, -0.35, 0, 0, 0, 1],
    autoPolicy: false,
  },
  d: {
    label: "Turning right",
    action: [0, 0, -0.35, 0, 0, 0, 1],
    autoPolicy: false,
  },
};

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
    if (record.presentationRuntime) {
      return record.presentationRuntime.status === "live" ? "live" : "starting";
    }
    if (record.presentationLaunchState?.status === "artifact_backed") {
      return "live";
    }
    return record.status === "creating" ? "starting" : "live";
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

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ["input", "textarea", "select"].includes(tagName);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const [activeMode, setActiveMode] = useState<WorkspaceViewMode>("presentation_world");
  const [userSelectedMode, setUserSelectedMode] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [runtimeBusyLabel, setRuntimeBusyLabel] = useState("");
  const [autoBootstrapState, setAutoBootstrapState] = useState<BootstrapState>("idle");
  const [observationRefreshKey, setObservationRefreshKey] = useState(0);
  const [observationLoadError, setObservationLoadError] = useState(false);
  const [liveObservationSrc, setLiveObservationSrc] = useState("");
  const [liveViewportAspect, setLiveViewportAspect] = useState<number | null>(null);
  const [lastLiveRenderContext, setLastLiveRenderContext] = useState<{
    cameraId: string;
    stepIndex: number;
  } | null>(null);
  const [explorerState, setExplorerState] = useState<ExplorerState | null>(null);
  const [explorerObservationSrc, setExplorerObservationSrc] = useState("");
  const [explorerLoadError, setExplorerLoadError] = useState(false);
  const [explorerViewport, setExplorerViewport] = useState<{ width: number; height: number } | null>(null);
  const [explorerBusyLabel, setExplorerBusyLabel] = useState("");
  const [explorerMoveSpeed, setExplorerMoveSpeed] = useState(0.18);
  const [explorerPose, setExplorerPose] = useState<ExplorerPose>({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const explorerViewportRef = useRef<HTMLDivElement | null>(null);
  const explorerDragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const explorerRenderSeqRef = useRef(0);
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

  const authorizedFetch = async (url: string, options: RequestInit = {}) => {
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
    setLiveViewportAspect(null);
    setLastLiveRenderContext(null);
    setControlError("");
    setUiBootstrapUrl("");
    setUserSelectedMode(false);
    setExplorerState(null);
    setExplorerPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    setExplorerBusyLabel("");
    setExplorerLoadError(false);
    setExplorerObservationSrc((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return "";
    });
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (liveObservationSrc.startsWith("blob:")) {
        URL.revokeObjectURL(liveObservationSrc);
      }
    };
  }, [liveObservationSrc]);

  useEffect(() => {
    return () => {
      if (explorerObservationSrc.startsWith("blob:")) {
        URL.revokeObjectURL(explorerObservationSrc);
      }
    };
  }, [explorerObservationSrc]);

  useEffect(() => {
    if (sessionRecord?.explorerState) {
      setExplorerState(sessionRecord.explorerState);
      setExplorerPose(sessionRecord.explorerState.pose);
    }
  }, [sessionRecord?.explorerState]);

  useEffect(() => {
    const node = explorerViewportRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setExplorerViewport((current) =>
        current && current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeMode]);

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
  const requestedBackend =
    sessionRecord?.runtime_backend_requested
    || runtimeConfig.requestedBackend
    || site?.defaultRuntimeBackend
    || "";
  const activeBackend = sessionRecord?.runtime_backend_selected || requestedBackend;
  const backendVariants =
    sessionRecord?.siteModel?.backendVariants
    || site?.runtimeManifest?.backendVariants
    || {};
  const activeBackendDetails = (activeBackend && backendVariants[activeBackend]) || null;
  const activeExecutionMode =
    sessionRecord?.runtime_execution_mode
    || activeBackendDetails?.runtimeMode
    || null;
  const peerBackend = (site?.availableRuntimeBackends || []).find((backendId) => backendId !== activeBackend) || null;
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
  const peerBackendHref =
    site && peerBackend
      ? `/site-worlds/${site.id}/start?taskId=${encodeURIComponent(selectedTaskId || "")}&scenarioId=${encodeURIComponent(runtimeConfig.scenarioId || "")}&startStateId=${encodeURIComponent(runtimeConfig.startStateId || "")}&robotProfileId=${encodeURIComponent(String(robotProfile.id || ""))}&requestedBackend=${encodeURIComponent(peerBackend)}`
      : null;
  const runtimeReferenceImageUrl = site?.runtimeReferenceImageUrl || null;
  const artifactExplorer = sessionRecord?.siteModel?.artifactExplorer || site?.artifactExplorer || null;
  const openDemoUrl = uiBootstrapUrl || "";
  const runtimeInteractive =
    Boolean(sessionId) &&
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
  const canRequestLiveRender = Boolean(
    runtimeInteractive && sessionId && latestEpisode?.episodeId && (selectedCameraId || primaryCameraId),
  );
  const renderRouteHref =
    canRequestLiveRender
      ? `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/render?cameraId=${encodeURIComponent(
          selectedCameraId || primaryCameraId,
        )}&refresh=${observationRefreshKey}`
      : selectedCameraRenderableFallback;
  const selectedObservationSrc = liveObservationSrc || renderRouteHref || selectedCameraRenderableFallback;
  const hasVisibleObservation = Boolean(
    selectedObservationSrc && isRenderableObservationPath(selectedObservationSrc) && !observationLoadError,
  );
  const liveViewportFrameMode =
    liveViewportAspect != null && liveViewportAspect < 1.05 ? "portrait" : "landscape";
  const liveViewportMinHeight =
    liveViewportFrameMode === "portrait" ? "min(82vh, 1100px)" : "min(74vh, 980px)";
  const hasGenuineLiveObservation = Boolean(
    runtimeInteractive &&
      liveObservationSrc &&
      isRenderableObservationPath(liveObservationSrc) &&
      !observationLoadError,
  );
  const runtimeDiagnostic = sessionRecord?.latestRuntimeFailure || null;
  const runtimeDegraded = Boolean(runtimeDiagnostic && liveObservationSrc);
  const showRuntimeReferencePreview = !hasVisibleObservation && Boolean(runtimeReferenceImageUrl);
  const artifactExplorerReady = artifactExplorer?.status === "ready" || artifactExplorer?.status === "partial";
  const presentationAvailabilityLabel = presentationInteractive
    ? "Private operator view live"
    : artifactExplorerReady
      ? "Artifact-backed exploration ready"
      : "Exploration assets unavailable";
  const runtimeModeState = runtimeDegraded
    ? { label: "Live Runtime: Degraded", tone: "amber" as const }
    : hasGenuineLiveObservation
      ? { label: "Live Runtime: Live", tone: "emerald" as const }
      : runtimeDiagnostic
        ? { label: "Live Runtime: Failed", tone: "rose" as const }
        : { label: "Live Runtime: Ready", tone: "slate" as const };
  const handleViewportImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setLiveViewportAspect(naturalWidth / naturalHeight);
    }
    setObservationLoadError(false);
  };
  const presentationModeState = presentationInteractive
    ? { label: "Explore Site-World: Operator view live", tone: "emerald" as const }
    : artifactExplorerReady
      ? { label: "Explore Site-World: Artifact-backed", tone: "amber" as const }
      : { label: "Explore Site-World: Missing", tone: "rose" as const };
  const explorerFrameHref = explorerState?.explorerFrame?.framePath || "";
  const explorerSnapshotId = String(explorerState?.explorerFrame?.snapshotId || "").trim();
  const explorerFrameFetchHref = explorerFrameHref
    ? `${explorerFrameHref}${explorerFrameHref.includes("?") ? "&" : "?"}snapshotId=${encodeURIComponent(
        explorerSnapshotId || String(explorerRenderSeqRef.current),
      )}`
    : "";
  const explorerQualityFlags = explorerState?.explorerQualityFlags || null;
  const explorerRefineStatus = explorerState?.refineStatus || "idle";
  const explorerGroundedSource = explorerState?.groundedSource || null;
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
    setActiveMode("presentation_world");
  }, [userSelectedMode]);

  const applyExplorerState = (nextExplorerState: ExplorerState) => {
    setExplorerState(nextExplorerState);
    setSessionRecord((current) =>
      current
        ? {
            ...current,
            explorerState: nextExplorerState,
            latestRuntimeFailure: null,
          }
        : current,
    );
  };

  const requestExplorerRender = async (refineMode: ExplorerRefineMode) => {
    if (!sessionId || !runtimeInteractive || !explorerViewport) {
      return;
    }
    const sequence = ++explorerRenderSeqRef.current;
    setExplorerBusyLabel(refineMode === "request" ? "Refining view" : "Rendering explorer");
    const response = await authorizedFetch(`/api/site-worlds/sessions/${sessionId}/explorer-render`, {
      method: "POST",
      body: JSON.stringify({
        cameraId: selectedCameraId || primaryCameraId || "head_rgb",
        pose: explorerPose,
        viewportWidth: explorerViewport.width,
        viewportHeight: explorerViewport.height,
        refineMode: refineMode === "request" ? "request" : null,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      explorerState?: ExplorerState;
      error?: string;
    } | null;
    if (!response.ok || !payload?.explorerState) {
      throw new Error(payload?.error || "Explorer render failed");
    }
    if (sequence !== explorerRenderSeqRef.current) {
      return;
    }
    applyExplorerState(payload.explorerState);
    setExplorerBusyLabel("");
  };

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
    if (
      activeMode !== "presentation_world" ||
      !runtimeInteractive ||
      !sessionId ||
      !explorerViewport ||
      !(selectedCameraId || primaryCameraId)
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void requestExplorerRender("idle").catch((error) => {
        setExplorerBusyLabel("");
        applyRuntimeDiagnostic(undefined, error instanceof Error ? error.message : "Explorer render failed");
      });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [
    activeMode,
    explorerPose,
    explorerViewport,
    primaryCameraId,
    runtimeInteractive,
    selectedCameraId,
    sessionId,
  ]);

  useEffect(() => {
    if (
      activeMode !== "presentation_world" ||
      !runtimeInteractive ||
      !sessionId ||
      !explorerViewport ||
      !(selectedCameraId || primaryCameraId)
    ) {
      return;
    }
    setExplorerState((current) =>
      current ? { ...current, refineStatus: "queued" } : current,
    );
    const timeoutId = window.setTimeout(() => {
      void requestExplorerRender("request").catch((error) => {
        setExplorerBusyLabel("");
        setExplorerState((current) =>
          current ? { ...current, refineStatus: "failed" } : current,
        );
        applyRuntimeDiagnostic(undefined, error instanceof Error ? error.message : "Explorer refinement failed");
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [
    activeMode,
    explorerPose,
    explorerViewport,
    primaryCameraId,
    runtimeInteractive,
    selectedCameraId,
    sessionId,
  ]);

  useEffect(() => {
    if (!explorerFrameFetchHref) {
      setExplorerObservationSrc((current) => {
        if (current.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }
        return "";
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await authorizedFetch(explorerFrameFetchHref, { cache: "no-store" });
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!response.ok || contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Explorer frame fetch failed");
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setExplorerObservationSrc((current) => {
          if (current.startsWith("blob:")) {
            URL.revokeObjectURL(current);
          }
          return objectUrl;
        });
        setExplorerLoadError(false);
        setExplorerBusyLabel("");
      } catch (error) {
        if (!cancelled) {
          setExplorerLoadError(true);
          setExplorerBusyLabel("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [explorerFrameFetchHref]);

  useEffect(() => {
    if (activeMode !== "presentation_world") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (!["w", "a", "s", "d", "q", "e"].includes(key)) {
        return;
      }
      event.preventDefault();
      setExplorerPose((current) => {
        const next = { ...current };
        if (key === "w") next.z += explorerMoveSpeed;
        if (key === "s") next.z -= explorerMoveSpeed;
        if (key === "a") next.x -= explorerMoveSpeed;
        if (key === "d") next.x += explorerMoveSpeed;
        if (key === "q") next.y += explorerMoveSpeed * 0.8;
        if (key === "e") next.y -= explorerMoveSpeed * 0.8;
        return next;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMode, explorerMoveSpeed]);

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

  useEffect(() => {
    if (!runtimeInteractive || activeMode !== "live_runtime") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target) ||
        Boolean(runtimeBusyLabel)
      ) {
        return;
      }
      const binding = RUNTIME_KEYBOARD_ACTIONS[event.key.toLowerCase()];
      if (!binding) {
        return;
      }
      event.preventDefault();
      void stepRuntime(binding);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMode, runtimeBusyLabel, runtimeInteractive, stepRuntime]);

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
        <div
          className={`mx-auto px-4 py-10 sm:px-6 lg:px-8 ${
            activeMode === "live_runtime" ? "max-w-[1900px]" : "max-w-7xl"
          }`}
        >
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
                Requested: {requestedBackend || site.defaultRuntimeBackend}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Active: {activeBackend || site.defaultRuntimeBackend}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Runtime mode: {activeExecutionMode || "unknown"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Mode: {activeMode === "live_runtime" ? "Live Runtime" : "Explorer"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Elapsed: {formatElapsed(elapsedSeconds)}
              </div>
              {peerBackendHref ? (
                <a
                  href={peerBackendHref}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Open {peerBackend} peer
                </a>
              ) : null}
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

          {activeMode !== "live_runtime" ? (
            <>
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
                      <DetailPill label="Requested Backend" value={requestedBackend || "Unspecified"} />
                      <DetailPill label="Active Backend" value={activeBackend || "Unspecified"} />
                      <DetailPill label="Runtime Mode" value={activeExecutionMode || "Unknown"} />
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
                        active={false}
                        onClick={() => {
                          setUserSelectedMode(true);
                          setActiveMode("live_runtime");
                        }}
                      />
                      <ModeToggleButton
                        title="Explore Site-World"
                        description="Artifact-backed exploration first, with a private operator bridge only when a live internal UI exists."
                        active
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
                    <DetailPill label="Active backend" value={activeBackend || site.defaultRuntimeBackend} />
                    <DetailPill label="Scenario variants" value={String(sessionRecord?.siteModel?.availableScenarioVariants?.length || site.scenarioVariants.length)} />
                    <DetailPill label="Start states" value={String(sessionRecord?.siteModel?.availableStartStates?.length || site.startStates.length)} />
                    <DetailPill label="Pipeline prefix" value={site.pipelinePrefix.split("/").slice(-2).join("/")} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <MetadataLink href={sceneMemoryManifestUri} label="View scene-memory manifest" />
                    <MetadataLink href={conditioningBundleUri} label="View conditioning bundle" />
                    <MetadataLink href={presentationWorldManifestUri} label="View presentation manifest" />
                    <MetadataLink href={activeBackendDetails?.bundleManifestUri || null} label="View backend bundle" />
                    <MetadataLink href={activeBackendDetails?.adapterManifestUri || null} label="View backend adapter" />
                    <MetadataLink href={String((activeBackendDetails?.conversion as Record<string, unknown> | null)?.conversion_report_uri || "") || null} label="View conversion report" />
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
            </>
          ) : null}

          <div className={`mt-8 ${activeMode === "live_runtime" ? "space-y-6" : "grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"}`}>
            {activeMode === "live_runtime" ? (
              <>
                <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live Runtime</p>
                      <h2 className="mt-2 text-[clamp(2rem,3vw,3.6rem)] font-bold tracking-[-0.04em] text-slate-950">
                        World-first live exploration
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        The viewport is now the primary surface. Movement, orientation, and grasp actions stay attached to
                        the live world instead of living inside a small preview box.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <ModeStateBadge label={runtimeModeState.label} tone={runtimeModeState.tone} />
                      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                        {runtimeBusyLabel || (autoBootstrapState === "running" ? "Resetting runtime and fetching the first frame" : "Ready")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div
                      className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.78),rgba(238,242,255,0.48)_34%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)]"
                      style={{ minHeight: liveViewportMinHeight }}
                    >
                      {hasVisibleObservation ? (
                        <img
                          key={selectedObservationSrc}
                          src={selectedObservationSrc}
                          alt="Latest robot observation frame"
                          className={`absolute inset-0 h-full w-full ${
                            liveViewportFrameMode === "portrait" ? "object-contain" : "object-cover"
                          }`}
                          onError={() => setObservationLoadError(true)}
                          onLoad={handleViewportImageLoad}
                        />
                      ) : showRuntimeReferencePreview ? (
                        <div className="absolute inset-0 flex flex-col bg-white/92">
                          <img
                            src={runtimeReferenceImageUrl || ""}
                            alt="Validated runtime reference frame"
                            className={`h-full w-full flex-1 ${
                              liveViewportFrameMode === "portrait" ? "object-contain" : "object-cover"
                            }`}
                            onLoad={handleViewportImageLoad}
                          />
                          <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-950">
                            Live stepping did not return a browser-visible frame. Showing the validated March 13 reference render while the current runtime path is unavailable.
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                          <div className="max-w-lg rounded-[28px] border border-slate-200 bg-white/88 px-8 py-10 text-slate-900 backdrop-blur-sm">
                            <Camera className="mx-auto h-10 w-10 text-slate-400" />
                            <p className="mt-4 text-lg font-semibold">
                              {runtimeInteractive ? "No browser-visible frame yet" : "Live runtime controls are unavailable in this session mode"}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {runtimeInteractive
                                ? "Reset the session, move one step, or use the guided walkthrough to fetch the first visible frame."
                                : "This session was launched as a presentation-only demo. Switch to Explore Site-World to inspect the saved derived representation instead."}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                        <div className="pointer-events-auto rounded-full border border-white/70 bg-white/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 backdrop-blur-sm">
                          Camera {selectedCameraId || primaryCameraId || "head_rgb"}
                        </div>
                        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                          <MetadataLink href={renderRouteHref || null} label="Open latest frame" />
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
                        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="pointer-events-auto rounded-[24px] border border-white/70 bg-white/88 px-5 py-4 text-slate-900 backdrop-blur-md">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Movement</p>
                            <p className="mt-2 text-base font-semibold">Use WASD or the arrow keys to move through the world.</p>
                            <p className="mt-2 text-sm text-slate-600">
                              Forward and backward translate the camera. Left and right rotate the current observation cone.
                            </p>
                          </div>
                          <div className="pointer-events-auto grid grid-cols-3 gap-2">
                            <div className="rounded-[22px] border border-white/70 bg-white/88 px-4 py-4 text-slate-900 backdrop-blur-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Step</p>
                              <p className="mt-2 text-2xl font-bold">{latestEpisode?.stepIndex ?? 0}</p>
                            </div>
                            <div className="rounded-[22px] border border-white/70 bg-white/88 px-4 py-4 text-slate-900 backdrop-blur-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reward</p>
                              <p className="mt-2 text-2xl font-bold">{latestEpisode?.reward != null ? latestEpisode.reward : "0"}</p>
                            </div>
                            <div className="rounded-[22px] border border-white/70 bg-white/88 px-4 py-4 text-slate-900 backdrop-blur-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Quality</p>
                              <p className="mt-2 text-base font-bold">{humanizeValue(String(qualityFlags?.presentation_quality || ""), "unknown")}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <aside className="flex flex-col gap-4">
                      <article className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fffaf0,#ffffff)] p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Navigator</p>
                        <div className="mt-4 grid gap-3">
                          <button
                            type="button"
                            onClick={() => void handleReset()}
                            disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset camera
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleScriptedWalkthrough()}
                            disabled={!runtimeInteractive || Boolean(runtimeBusyLabel)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            Guided sweep
                          </button>
                        </div>
                        <div className="mt-5 grid gap-2">
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
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-600">{preset.description}</p>
                            </button>
                          ))}
                        </div>
                      </article>

                      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Observation cameras</p>
                            <p className="mt-1 text-xs text-slate-500">Swap camera feeds without leaving the runtime.</p>
                          </div>
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {selectedCameraId || "Auto"}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
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
                      </article>

                      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Runtime quality</p>
                        <div className="mt-4 space-y-3 text-sm text-slate-700">
                          <p>Presentation quality: {humanizeValue(String(qualityFlags?.presentation_quality || ""), "unknown")}</p>
                          <p>Fallback mode: {humanizeValue(String(qualityFlags?.fallback_mode || ""), "none")}</p>
                          <p>Protected-region violations: {protectedRegionViolations.length}</p>
                          {runtimeDegraded && lastLiveRenderContext ? (
                            <p className="text-xs text-amber-700">
                              Showing the last good live frame from {lastLiveRenderContext.cameraId} at step {lastLiveRenderContext.stepIndex} while the current render path is degraded.
                            </p>
                          ) : showRuntimeReferencePreview ? (
                            <p className="text-xs text-slate-500">
                              In-page preview is currently a validated reference frame, not a live stepped render.
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <MetadataLink href={rolloutVideoPath || null} label="Open rollout video" />
                          <MetadataLink href={exportManifestPath || null} label="Open export manifest" />
                          <MetadataLink href={rawBundlePath || null} label="Open raw bundle" />
                        </div>
                      </article>

                      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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
                            <p className="text-sm font-medium text-slate-500">Runtime endpoint</p>
                            <p className="mt-1 break-all text-sm text-slate-900">
                              {String(sessionRecord?.runtimeHandle?.runtime_base_url || site.runtimeManifest?.runtimeBaseUrl || "Not connected")}
                            </p>
                          </div>
                        </div>
                      </article>
                    </aside>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Explorer</p>
                      <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Video-grounded interactive explorer
                      </p>
                      <h2 className="mt-2 text-[clamp(2rem,3vw,3.6rem)] font-bold tracking-[-0.04em] text-slate-950">
                        World-first artifact exploration
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        The explorer uses the same large-viewport treatment as Live Runtime, but every frame is a grounded
                        preview rendered from the current pose rather than a continuous live stream.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <ModeStateBadge label={presentationModeState.label} tone={presentationModeState.tone} />
                      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                        {explorerBusyLabel || humanizeValue(explorerRefineStatus, "idle")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div
                      ref={explorerViewportRef}
                      className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.78),rgba(238,242,255,0.48)_34%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)]"
                      style={{ minHeight: "min(74vh, 980px)" }}
                      onMouseDown={(event) => {
                        explorerDragRef.current = {
                          active: true,
                          lastX: event.clientX,
                          lastY: event.clientY,
                        };
                      }}
                      onMouseMove={(event) => {
                        if (!explorerDragRef.current.active) {
                          return;
                        }
                        const dx = event.clientX - explorerDragRef.current.lastX;
                        const dy = event.clientY - explorerDragRef.current.lastY;
                        explorerDragRef.current.lastX = event.clientX;
                        explorerDragRef.current.lastY = event.clientY;
                        setExplorerPose((current) => ({
                          ...current,
                          yaw: current.yaw - dx * 0.005,
                          pitch: clamp(current.pitch - dy * 0.005, -1.2, 1.2),
                        }));
                      }}
                      onMouseUp={() => {
                        explorerDragRef.current.active = false;
                      }}
                      onMouseLeave={() => {
                        explorerDragRef.current.active = false;
                      }}
                      onWheel={(event) => {
                        event.preventDefault();
                        setExplorerMoveSpeed((current) => clamp(current + (event.deltaY > 0 ? -0.03 : 0.03), 0.06, 0.45));
                      }}
                    >
                      {explorerObservationSrc && !explorerLoadError ? (
                        <img
                          src={explorerObservationSrc}
                          alt="Explorer frame"
                          className="absolute inset-0 h-full w-full object-contain bg-slate-100"
                          onError={() => setExplorerLoadError(true)}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                          <div className="max-w-lg rounded-[28px] border border-slate-200 bg-white/92 px-8 py-10 text-slate-900 backdrop-blur-sm">
                            <Compass className="mx-auto h-10 w-10 text-slate-400" />
                            <p className="mt-4 text-lg font-semibold">Explorer frame unavailable</p>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              The grounded explorer has not returned a browser-visible frame yet. If the site package lacks
                              ARKit/depth inputs, the runtime will fall back to canonical imagery.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                        <div className="pointer-events-auto rounded-full border border-white/70 bg-white/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 backdrop-blur-sm">
                          Camera {selectedCameraId || primaryCameraId || "head_rgb"}
                        </div>
                        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                          <MetadataLink href={explorerFrameFetchHref || null} label="Open explorer frame" />
                        </div>
                      </div>
                    </div>

                    <aside className="flex flex-col gap-4">
                      <article className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fffaf0,#ffffff)] p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Explorer Controls</p>
                        <div className="mt-4 grid gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExplorerPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
                              setExplorerMoveSpeed(0.18);
                            }}
                            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset explorer view
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExplorerState((current) =>
                                current ? { ...current, refineStatus: "running" } : current,
                              );
                              void requestExplorerRender("request").catch((error) => {
                                setExplorerBusyLabel("");
                                setExplorerState((current) =>
                                  current ? { ...current, refineStatus: "failed" } : current,
                                );
                                applyRuntimeDiagnostic(undefined, error instanceof Error ? error.message : "Explorer refinement failed");
                              });
                            }}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            Refine view
                          </button>
                        </div>
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Pose</p>
                          <p className="mt-2 leading-6">
                            x {explorerPose.x.toFixed(2)} · y {explorerPose.y.toFixed(2)} · z {explorerPose.z.toFixed(2)}
                          </p>
                          <p className="leading-6">
                            yaw {explorerPose.yaw.toFixed(2)} · pitch {explorerPose.pitch.toFixed(2)}
                          </p>
                        </div>
                      </article>

                      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cameras</p>
                            <p className="mt-1 text-xs text-slate-500">Swap source cameras without leaving the explorer.</p>
                          </div>
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {selectedCameraId || "Auto"}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {cameraOptions.map((camera) => (
                            <button
                              key={camera.id}
                              type="button"
                              onClick={() => setSelectedCameraId(camera.id)}
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
                        <div className="mt-5 flex flex-wrap gap-3">
                          {openDemoUrl ? <MetadataLink href={openDemoUrl} label="Open private operator view" /> : null}
                          <MetadataLink href={presentationWorldManifestUri} label="Open presentation manifest" />
                          <MetadataLink href={runtimeDemoManifestUri} label="Open runtime demo manifest" />
                        </div>
                      </article>
                    </aside>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[24px] border border-amber-100 bg-amber-50/70 px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Navigation</p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        WASD moves, mouse drag rotates, Q/E moves vertically.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        This is a pose-driven preview, not a continuous stream. The frame should update shortly after you stop moving.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <DetailPill label="Source" value={humanizeValue(explorerGroundedSource, "fallback")} />
                      <DetailPill label="Quality" value={humanizeValue(String(explorerQualityFlags?.presentation_quality || ""), "preview")} />
                      <DetailPill label="Speed" value={explorerMoveSpeed.toFixed(2)} />
                      <DetailPill label="Refine status" value={humanizeValue(explorerRefineStatus, "idle")} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">Grounded preview first, refinement second</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        The explorer frame is sourced from ARKit/video reprojection when available and only uses masked NeoVerse refinement for uncertain or unseen regions.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailPill label="Output size" value={(() => {
                        const viewport = explorerState?.explorerFrame?.viewport as Record<string, unknown> | undefined;
                        const width = Number(viewport?.output_width || 0);
                        const height = Number(viewport?.output_height || 0);
                        return width > 0 && height > 0 ? `${width} × ${height}` : "Pending";
                      })()} />
                      <DetailPill label="Snapshot" value={explorerSnapshotId || "Pending"} />
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
                          A free camera explorer grounded on bundled video/ARKit data when available.
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">What this mode is not</p>
                        <p className="mt-1 text-sm text-slate-900">
                          It does not replace the whole viewport with low-resolution generative output.
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Derived presentation caveat</p>
                        <p className="mt-1 text-sm text-slate-900">
                          NeoVerse refinement is advisory and mask-limited. Protected regions stay grounded to canonical/site evidence.
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
