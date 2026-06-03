import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Cpu,
  Database,
  FileDown,
  Gauge,
  Layers3,
  LockKeyhole,
  Play,
  Route,
  ScanSearch,
  ShieldCheck,
  Settings2,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { MonochromeMedia, RouteTraceOverlay } from "@/components/site/editorial";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { REQUESTED_OUTPUT_DEFINITIONS } from "@/lib/hostedSession";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { withCsrfHeader } from "@/lib/csrf";
import type { CreateHostedSessionRequest, HostedSessionMode } from "@/types/hostedSession";

interface LaunchBlockerDetail {
  code: string;
  message: string;
  source: "access" | "qualification" | "runtime" | "presentation_demo";
}

interface LaunchModeReadiness {
  status?: "presentation_assets_missing" | "presentation_ui_unconfigured" | "presentation_ui_live" | "runtime_live_ready" | "runtime_live_unavailable";
  launchable: boolean;
  blockers: string[];
  blocker_details?: LaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
}

interface LaunchReadinessPayload {
  launchable: boolean;
  entitled: boolean;
  blockers: string[];
  blocker_details?: LaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
  presentation_demo?: LaunchModeReadiness;
  runtime_only?: LaunchModeReadiness;
}

interface HostedSessionSetupProps {
  params: {
    slug: string;
  };
}

const primaryOutputIds = [
  "observation_frames",
  "action_trace",
  "rollout_video",
  "export_bundle",
] as const;

const runFidelityOptions = ["low", "medium", "high"] as const;
const sensorNoiseOptions = ["low", "medium", "high"] as const;
type RunFidelity = (typeof runFidelityOptions)[number];
type SensorNoise = (typeof sensorNoiseOptions)[number];

function publicDemoSiteWorldIds() {
  const ids = new Set<string>();
  if (import.meta.env.MODE !== "production" || import.meta.env.VITE_ENABLE_DEMO_SITE_WORLDS === "1") {
    ids.add("siteworld-f5fd54898cfb");
  }
  const envSiteWorldId = String(
    import.meta.env.VITE_HOSTED_DEMO_SITE_WORLD_ID
    || import.meta.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID
    || "",
  ).trim();
  if (envSiteWorldId) {
    ids.add(envSiteWorldId);
  }
  return ids;
}

function isPublicDemoSiteWorldId(siteWorldId: string) {
  return publicDemoSiteWorldIds().has(String(siteWorldId || "").trim());
}

async function getFirebaseIdToken(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const firebase = await import("@/lib/firebase");
    return firebase.auth?.currentUser ? await firebase.auth.currentUser.getIdToken() : "";
  } catch {
    return "";
  }
}

function humanizeToken(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ProofBadge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "green" | "amber" | "slate" | "ink";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-800"
        : tone === "ink"
          ? "border-white/15 bg-white/10 text-white/80"
          : "border-stone-300 bg-stone-100 text-stone-700";
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {label}
    </span>
  );
}

function SectionHeader({
  icon,
  label,
  title,
  body,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-stone-100 text-stone-700">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-stone-950">{title}</h2>
        {body ? <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p> : null}
      </div>
    </div>
  );
}

function SettingOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-md border px-3 text-sm font-semibold capitalize transition ${
        active
          ? "border-stone-950 bg-stone-950 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:border-stone-950"
      }`}
    >
      {label}
    </button>
  );
}

export default function HostedSessionSetup({ params }: HostedSessionSetupProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);
  const [, setLocation] = useLocation();
  const [robotProfileId, setRobotProfileId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [startStateId, setStartStateId] = useState("");
  const [requestedBackend, setRequestedBackend] = useState("");
  const [runMode, setRunMode] = useState<"simulation" | "robot_readiness_review">("simulation");
  const [runSeed, setRunSeed] = useState(42);
  const [episodeCount, setEpisodeCount] = useState(10);
  const [maxSteps, setMaxSteps] = useState(600);
  const [physicsFidelity, setPhysicsFidelity] = useState<RunFidelity>("high");
  const [sensorNoise, setSensorNoise] = useState<SensorNoise>("medium");
  const [domainRandomization, setDomainRandomization] = useState(40);
  const [requestedOutputs, setRequestedOutputs] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [launchErrorDetails, setLaunchErrorDetails] = useState<LaunchBlockerDetail[]>([]);
  const [launchReadiness, setLaunchReadiness] = useState<LaunchReadinessPayload | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);

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
    if (!site) return;
    const urlParams = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
    const selectedRobot = site.robotProfiles[0] || site.sampleRobotProfile;
    setRobotProfileId(urlParams?.get("robotProfileId") || selectedRobot?.id || "");
    setTaskId(urlParams?.get("taskId") || site.taskCatalog[0]?.id || "");
    setScenarioId(urlParams?.get("scenarioId") || site.scenarioCatalog[0]?.id || "");
    setStartStateId(urlParams?.get("startStateId") || site.startStateCatalog[0]?.id || "");
    setRequestedBackend(urlParams?.get("requestedBackend") || site.defaultRuntimeBackend || site.availableRuntimeBackends[0] || "");
    setRequestedOutputs(
      REQUESTED_OUTPUT_DEFINITIONS.filter((item) =>
        primaryOutputIds.includes(item.id as (typeof primaryOutputIds)[number]),
      ).map((item) => item.id),
    );
  }, [site]);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    setCheckingReadiness(true);

    (async () => {
      try {
        const token = await getFirebaseIdToken();
        const usePublicDemoRoutes = isPublicDemoSiteWorldId(site.id);
        if (!token && !usePublicDemoRoutes) {
          throw new Error("Missing authenticated user");
        }
        const response = await fetch(
          `/api/site-worlds/sessions/launch-readiness?siteWorldId=${encodeURIComponent(site.id)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const payload = (await response.json()) as LaunchReadinessPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to verify launch readiness");
        }
        if (!cancelled) {
          setLaunchReadiness(payload);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to verify launch readiness";
          const blocker = {
            code: "launch_readiness_failed",
            message,
            source: "access" as const,
          };
          setLaunchReadiness({
            launchable: false,
            entitled: false,
            blockers: [message],
            blocker_details: [blocker],
            presentationWorldManifestUri: null,
            presentation_demo: {
              launchable: false,
              blockers: [message],
              blocker_details: [blocker],
              presentationWorldManifestUri: null,
            },
            runtime_only: {
              launchable: false,
              blockers: [message],
              blocker_details: [blocker],
            },
          });
        }
      } finally {
        if (!cancelled) {
          setCheckingReadiness(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [site]);

  const selectedRobotProfile = useMemo(
    () =>
      site?.robotProfiles.find((item) => item.id === robotProfileId)
      || site?.sampleRobotProfile
      || null,
    [robotProfileId, site],
  );

  if (!site || !selectedRobotProfile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Site world not found</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The Policy Evaluation Set setup page is not available because the site could not be loaded.
        </p>
      </div>
    );
  }

  const handleOutputToggle = (outputId: string) => {
    setRequestedOutputs((current) =>
      current.includes(outputId)
        ? current.filter((value) => value !== outputId)
        : [...current, outputId],
    );
  };

  const launchSession = async (sessionMode: HostedSessionMode) => {
    setSubmitting(true);
    setErrorMessage("");
    setLaunchErrorDetails([]);

    const requestPayload: CreateHostedSessionRequest = {
      siteWorldId: site.id,
      sessionMode,
      runtimeUi: sessionMode === "presentation_demo" ? "neoverse_gradio" : null,
      autoStartDemo: sessionMode === "presentation_demo",
      robotProfileId,
      policy: {
        runMode,
        simulationSettings: {
          physicsFidelity,
          sensorNoise,
          domainRandomization,
          episodeCount,
          maxSteps,
        },
        proofBoundary: "No provider execution, live simulation, or robot-readiness claim until owner-system artifacts exist.",
      },
      taskId,
      scenarioId,
      startStateId,
      seed: runSeed,
      requestedBackend: requestedBackend || site.defaultRuntimeBackend || null,
      requestedOutputs,
      exportModes: ["raw_bundle", "rlds_dataset"],
      runtimeSessionConfig: {
        canonical_package_uri: site.siteWorldSpecUri || null,
        canonical_package_version: null,
        prompt: null,
        trajectory: null,
        presentation_model: null,
        debug_mode: false,
        unsafe_allow_blocked_site_world: isPublicDemoSiteWorldId(site.id),
      },
      notes,
    };

    try {
      const token = await getFirebaseIdToken();
      const usePublicDemoRoutes = isPublicDemoSiteWorldId(site.id);
      if (!token && !usePublicDemoRoutes) throw new Error("Missing authenticated user");
      const response = await fetch("/api/site-worlds/sessions", {
        method: "POST",
        headers: usePublicDemoRoutes
          ? { "Content-Type": "application/json" }
          : {
              ...(await withCsrfHeader({ "Content-Type": "application/json" })),
              Authorization: `Bearer ${token}`,
            },
        body: JSON.stringify(requestPayload),
      });
      const payload = (await response.json()) as {
        workspaceUrl?: string;
        error?: string;
        blockers?: string[];
        blocker_details?: LaunchBlockerDetail[];
      };
      if (!response.ok || !payload.workspaceUrl) {
        setLaunchErrorDetails(Array.isArray(payload.blocker_details) ? payload.blocker_details : []);
        throw new Error(
          Array.isArray(payload.blockers) && payload.blockers.length > 0
            ? payload.blockers.join(", ")
            : payload.error || "Unable to start Policy Evaluation Set",
        );
      }
      setLocation(payload.workspaceUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start Policy Evaluation Set.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await launchSession("runtime_only");
  };

  const selectedTask = site.taskCatalog.find((item) => item.id === taskId) || site.taskCatalog[0];
  const selectedScenario =
    site.scenarioCatalog.find((item) => item.id === scenarioId) || site.scenarioCatalog[0];
  const selectedStartState =
    site.startStateCatalog.find((item) => item.id === startStateId) || site.startStateCatalog[0];
  const availableRuntimeBackends =
    site.availableRuntimeBackends.length > 0
      ? site.availableRuntimeBackends
      : [site.defaultRuntimeBackend].filter(Boolean);
  const selectedOutputLabels = REQUESTED_OUTPUT_DEFINITIONS.filter((item) =>
    requestedOutputs.includes(item.id),
  ).map((item) => item.label);
  const cameraSummary = selectedRobotProfile.observationCameras.map((item) => item.role).join(", ");
  const hostedRequestHref = (() => {
    const request = new URLSearchParams({
      persona: "robot-team",
      buyerType: "robot_team",
      interest: "hosted-evaluation",
      path: "hosted-evaluation",
      source: "site-world-run-setup",
      siteWorldId: site.id,
      siteName: site.siteName,
      siteLocation: site.siteAddress,
      targetRobotTeam: selectedRobotProfile.displayName,
      taskStatement: selectedTask?.taskText || site.sampleTask,
      scenario: humanizeToken(selectedScenario?.name),
      startState: humanizeToken(selectedStartState?.name),
      requestedBackend: requestedBackend || site.defaultRuntimeBackend,
      runSeed: String(runSeed),
      runMode,
      maxSteps: String(maxSteps),
      episodeCount: String(episodeCount),
      requestedOutputs: selectedOutputLabels.join(", "),
      notes,
    });
    return `/contact?${request.toString()}`;
  })();
  const presentationReadiness = launchReadiness?.presentation_demo || null;
  const runtimeReadiness = launchReadiness?.runtime_only || null;
  const launchBlocked = checkingReadiness || !presentationReadiness?.launchable;
  const runtimeLaunchBlocked = checkingReadiness || !runtimeReadiness?.launchable;
  const suggestRuntimeFallback =
    !checkingReadiness
    && !presentationReadiness?.launchable
    && Boolean(runtimeReadiness?.launchable);
  const runStateLabel =
    checkingReadiness
      ? "Checking"
      : runtimeReadiness?.launchable || presentationReadiness?.launchable
        ? "Ready to start"
        : "Request review";
  const runStateTone = checkingReadiness ? "amber" : runtimeReadiness?.launchable || presentationReadiness?.launchable ? "green" : "amber";
  const previewFrames = [
    { label: "Site map", objectPosition: "object-left" },
    { label: "Start state", objectPosition: "object-center" },
    { label: "Task area", objectPosition: "object-right" },
  ];

  return (
    <>
      <SEO
        title={`Policy Evaluation Set | ${site.siteName} | Blueprint`}
        description={`Configure a proof-gated policy evaluation set for ${site.siteName}.`}
        canonical={`/world-models/${site.id}/start`}
        noIndex
      />

      <div className="min-h-screen bg-[#e9e4d8] text-stone-950">
        <section className="border-b border-stone-950/10 bg-[linear-gradient(135deg,#e9e4d8_0%,#f6f2e9_48%,#d9ded1_100%)]">
          <div className="mx-auto grid max-w-[118rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8">
            <aside className="hidden rounded-lg border border-stone-950/15 bg-[#111713] p-4 text-white shadow-[0_28px_80px_rgba(17,24,19,0.22)] lg:block">
              <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15">
                  <Layers3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Blueprint</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">World Studio</p>
                </div>
              </div>
              <nav className="mt-5 space-y-1 text-sm text-white/68">
                {[
                  { label: "Site world", icon: <ScanSearch className="h-4 w-4" /> },
                  { label: "Robot", icon: <Bot className="h-4 w-4" /> },
                  { label: "Task", icon: <Target className="h-4 w-4" /> },
                  { label: "Scenario", icon: <Route className="h-4 w-4" /> },
                  { label: "Settings", icon: <SlidersHorizontal className="h-4 w-4" /> },
                  { label: "Outputs", icon: <FileDown className="h-4 w-4" /> },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${index === 0 ? "bg-white/10 text-white" : ""}`}
                  >
                    {item.icon}
                    {item.label}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <a
                  href={`/world-models/${site.id}`}
                  className="inline-flex items-center gap-2 rounded-md border border-stone-950/15 bg-white/70 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to world model
                </a>
                <div className="flex flex-wrap items-center gap-2">
                  <ProofBadge label="proof-gated" tone="green" />
                  <ProofBadge label={runStateLabel} tone={runStateTone} />
                </div>
              </div>

              <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    /world-models/{site.id}/start
                  </p>
                  <h1 className="mt-3 max-w-4xl text-[clamp(3rem,6vw,7rem)] font-semibold leading-[0.88] tracking-[-0.07em] text-stone-950">
                    Policy Evaluation Set
                  </h1>
                  <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-700">
                    Configure a fixed-scope evaluation using a capture-backed site world, robot profile, task,
                    scenario, start state, execution settings, and requested outputs. Launch checks decide
                    whether this opens World Studio now or routes a request review.
                  </p>
                </div>
                <div className="rounded-lg border border-stone-950/15 bg-white/76 p-4 shadow-[0_24px_70px_rgba(35,31,24,0.12)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Run summary</p>
                  <div className="mt-4 space-y-3 text-sm">
                    {[
                      ["Site world", site.siteName, "proof-gated"],
                      ["Robot profile", selectedRobotProfile.displayName, runMode === "simulation" ? "selected" : "review"],
                      ["Task", selectedTask?.taskText || site.sampleTask, "selected"],
                      ["Scenario", humanizeToken(selectedScenario?.name), "selected"],
                      ["Start state", humanizeToken(selectedStartState?.name), "queued"],
                      ["Backend", requestedBackend || site.defaultRuntimeBackend, "requested"],
                      ["Outputs", `${requestedOutputs.length} selected`, "proof-gated"],
                    ].map(([label, value, status], index) => (
                      <div key={label} className="grid grid-cols-[1.3rem_minmax(0,1fr)_auto] items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-white text-[10px] font-semibold text-stone-500">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">{label}</p>
                          <p className="mt-1 break-words font-semibold text-stone-950">{value}</p>
                        </div>
                        <ProofBadge label={status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleLaunch} className="mx-auto grid max-w-[118rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-8">
          <main className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-lg border border-stone-950/12 bg-white shadow-[0_24px_70px_rgba(35,31,24,0.08)]">
              <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.48fr)_minmax(0,0.52fr)]">
                <div className="relative min-h-[28rem] overflow-hidden bg-[#111713] text-white">
                  <MonochromeMedia
                    src={editorialRefreshAssets.setupOverviewMap}
                    alt={`${site.siteName} Policy Evaluation Set map`}
                    className="absolute inset-0 min-h-full rounded-none"
                    imageClassName="min-h-full object-cover"
                    overlayClassName="bg-[linear-gradient(90deg,rgba(13,18,15,0.86),rgba(13,18,15,0.38)_54%,rgba(13,18,15,0.18))]"
                  >
                    <RouteTraceOverlay className="opacity-70" />
                    <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-4">
                      <ProofBadge label="capture-backed" tone="ink" />
                      <ProofBadge label="request review" tone="ink" />
                    </div>
                    <div className="absolute bottom-5 left-5 right-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{site.siteCode}</p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{site.siteName}</h2>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">{site.siteAddress}</p>
                    </div>
                    <button
                      type="button"
                      className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-md border border-white/15 bg-black/35 text-white backdrop-blur"
                      aria-label="Preview route"
                    >
                      <Play className="ml-0.5 h-5 w-5" />
                    </button>
                  </MonochromeMedia>
                </div>

                <div className="min-w-0 p-5 sm:p-6">
                  <SectionHeader
                    icon={<ScanSearch className="h-4 w-4" />}
                    label="1. Site world"
                    title="Select the capture-backed world"
                    body="The run stays attached to the exact site, capture id, pipeline prefix, and proof links already known to Blueprint."
                  />
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Scene id</p>
                      <p className="mt-2 break-all text-sm font-semibold text-stone-950">{site.sceneId}</p>
                    </div>
                    <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Capture id</p>
                      <p className="mt-2 break-all text-sm font-semibold text-stone-950">{site.captureId}</p>
                    </div>
                    <div className="rounded-md border border-stone-200 bg-stone-50 p-4 sm:col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Runtime source</p>
                      <p className="mt-2 text-sm font-semibold text-stone-950">
                        {site.runtimeManifest?.launchable ? "Launch checks available" : "Request review before launch"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        Cameras: {cameraSummary || "camera list pending"}. Rights, entitlement, provider, and robot-readiness claims remain proof-gated per request.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)] sm:p-6">
              <SectionHeader
                icon={<Bot className="h-4 w-4" />}
                label="2. Robot loadout"
                title="Choose the robot profile"
                body="A selected profile scopes observations, action space, and adapter expectations. It does not certify field readiness."
              />
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {site.robotProfiles.map((profile) => {
                  const selected = profile.id === robotProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setRobotProfileId(profile.id || "")}
                      className={`min-h-40 rounded-md border p-4 text-left transition ${
                        selected
                          ? "border-emerald-600 bg-emerald-50 shadow-[0_14px_35px_rgba(16,185,129,0.16)]"
                          : "border-stone-200 bg-white hover:border-stone-950"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Bot className={`h-5 w-5 ${selected ? "text-emerald-700" : "text-stone-500"}`} />
                        {selected ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : <Circle className="h-5 w-5 text-stone-300" />}
                      </div>
                      <p className="mt-4 text-base font-semibold text-stone-950">{profile.displayName}</p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{profile.actionSpaceSummary}</p>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        {profile.embodimentType.replaceAll("_", " ")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)] sm:p-6">
              <SectionHeader
                icon={<Target className="h-4 w-4" />}
                label="3. Mission"
                title="Task, scenario, and start state"
                body="The mission timeline is queued from catalog values attached to this site world."
              />
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Task</span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                    value={taskId}
                    onChange={(event) => setTaskId(event.target.value)}
                  >
                    {site.taskCatalog.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.taskText}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Scenario</span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                    value={scenarioId}
                    onChange={(event) => setScenarioId(event.target.value)}
                  >
                    {site.scenarioCatalog.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {humanizeToken(scenario.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Start state</span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                    value={startStateId}
                    onChange={(event) => setStartStateId(event.target.value)}
                  >
                    {site.startStateCatalog.map((startState) => (
                      <option key={startState.id} value={startState.id}>
                        {humanizeToken(startState.name)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)] sm:p-6">
              <SectionHeader
                icon={<SlidersHorizontal className="h-4 w-4" />}
                label="4. Run settings"
                title="Configure simulation and execution"
                body="These settings shape the requested run. They do not imply provider execution until the owner-system artifacts exist."
              />
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)]">
                <div className="space-y-4">
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-stone-950">Run mode</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setRunMode("simulation")}
                        className={`rounded-md border px-4 py-3 text-left text-sm transition ${
                          runMode === "simulation"
                            ? "border-stone-950 bg-stone-950 text-white"
                            : "border-stone-300 bg-white text-stone-700 hover:border-stone-950"
                        }`}
                      >
                        <span className="block font-semibold">Simulation run</span>
                        <span className={`mt-1 block text-xs leading-5 ${runMode === "simulation" ? "text-white/70" : "text-stone-500"}`}>
                          Configure a world-model run request.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRunMode("robot_readiness_review")}
                        className={`rounded-md border px-4 py-3 text-left text-sm transition ${
                          runMode === "robot_readiness_review"
                            ? "border-amber-600 bg-amber-50 text-amber-950"
                            : "border-stone-300 bg-white text-stone-700 hover:border-stone-950"
                        }`}
                      >
                        <span className="block font-semibold">Robot readiness review</span>
                        <span className="mt-1 block text-xs leading-5 text-stone-500">
                          Routes a review. No readiness claim is created here.
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-stone-700">Backend</span>
                      <select
                        className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                        value={requestedBackend}
                        onChange={(event) => setRequestedBackend(event.target.value)}
                      >
                        {availableRuntimeBackends.map((backend) => (
                          <option key={backend} value={backend}>
                            {backend}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-stone-700">Seed</span>
                      <input
                        type="number"
                        className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                        value={runSeed}
                        onChange={(event) => setRunSeed(Number(event.target.value) || 0)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-stone-700">Episodes</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                        value={episodeCount}
                        onChange={(event) => setEpisodeCount(Math.max(1, Number(event.target.value) || 1))}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-stone-700">Max steps</span>
                      <input
                        type="number"
                        min={1}
                        className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                        value={maxSteps}
                        onChange={(event) => setMaxSteps(Math.max(1, Number(event.target.value) || 1))}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-md border border-stone-200 bg-[#f6f2e9] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                    <Gauge className="h-4 w-4" />
                    Simulation settings
                  </div>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-stone-700">Physics fidelity</p>
                      <div className="grid grid-cols-3 gap-2">
                        {runFidelityOptions.map((option) => (
                          <SettingOption
                            key={option}
                            label={option}
                            active={physicsFidelity === option}
                            onClick={() => setPhysicsFidelity(option)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-stone-700">Sensor noise</p>
                      <div className="grid grid-cols-3 gap-2">
                        {sensorNoiseOptions.map((option) => (
                          <SettingOption
                            key={option}
                            label={option}
                            active={sensorNoise === option}
                            onClick={() => setSensorNoise(option)}
                          />
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-stone-700">
                        <span>Domain randomization</span>
                        <span>{domainRandomization}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={domainRandomization}
                        onChange={(event) => setDomainRandomization(Number(event.target.value))}
                        className="mt-3 w-full accent-emerald-700"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)] sm:p-6">
              <SectionHeader
                icon={<FileDown className="h-4 w-4" />}
                label="5. Outputs"
                title="Choose generated artifacts"
                body="Available artifacts are reviewed in World Studio. Missing artifacts stay pending rather than being described as delivered."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {REQUESTED_OUTPUT_DEFINITIONS.map((output) => {
                  const checked = requestedOutputs.includes(output.id);
                  return (
                    <label
                      key={output.id}
                      className={`flex min-h-32 cursor-pointer flex-col justify-between rounded-md border p-4 text-sm transition ${
                        checked
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                          : "border-stone-200 bg-white text-stone-700 hover:border-stone-950"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <Database className={`h-4 w-4 ${checked ? "text-emerald-700" : "text-stone-400"}`} />
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => handleOutputToggle(output.id)}
                          />
                        </div>
                        <span className="mt-3 block font-semibold">{output.label}</span>
                        <span className="mt-2 block text-xs leading-5 text-stone-500">{output.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)] sm:p-6">
              <SectionHeader
                icon={<ClipboardCheck className="h-4 w-4" />}
                label="6. Operator notes"
                title="Review context"
                body="Use notes for the buyer question, evaluation concern, or export expectation. Do not use notes to override proof gates."
              />
              <textarea
                className="mt-5 min-h-28 w-full rounded-md border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Example: Evaluate navigation to receiving dock and export observation frames plus action trace for post-training prep."
              />
            </section>
          </main>

          <aside className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-lg border border-stone-950/15 bg-[#111713] p-5 text-white shadow-[0_28px_80px_rgba(17,24,19,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Launch check</p>
                  <h2 className="mt-2 text-xl font-semibold">Proof gates</h2>
                </div>
                <Settings2 className="h-5 w-5 text-white/45" />
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">World Studio</p>
                    <ProofBadge
                      label={checkingReadiness ? "checking" : presentationReadiness?.launchable ? "ready" : "request"}
                      tone={checkingReadiness ? "amber" : presentationReadiness?.launchable ? "green" : "amber"}
                    />
                  </div>
                  <p className="mt-2 text-white/64">
                    {checkingReadiness
                      ? "Checking presentation and access state."
                      : presentationReadiness?.launchable
                        ? "World Studio can open from this setup."
                        : "World Studio opens after account, package, and runtime proof clear."}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Runtime run</p>
                    <ProofBadge
                      label={checkingReadiness ? "checking" : runtimeReadiness?.launchable ? "ready" : "request"}
                      tone={checkingReadiness ? "amber" : runtimeReadiness?.launchable ? "green" : "amber"}
                    />
                  </div>
                  <p className="mt-2 text-white/64">
                    {checkingReadiness
                      ? "Checking session launchability."
                      : runtimeReadiness?.launchable
                        ? "The configured run can start."
                        : "Runtime execution remains request-reviewed for this site."}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    Proof boundary
                  </div>
                  <p className="mt-2 text-white/64">
                    This setup does not create provider execution, payment, rights clearance, or robot-readiness proof by itself.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                <Cpu className="h-4 w-4" />
                Mission timeline
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Site selected", site.siteName, true],
                  ["Robot loaded", selectedRobotProfile.displayName, Boolean(robotProfileId)],
                  ["Task queued", selectedTask?.taskText || "Pending", Boolean(taskId)],
                  ["Scenario set", humanizeToken(selectedScenario?.name), Boolean(scenarioId)],
                  ["Start state set", humanizeToken(selectedStartState?.name), Boolean(startStateId)],
                  ["Outputs selected", `${requestedOutputs.length} artifacts`, requestedOutputs.length > 0],
                ].map(([label, value, complete]) => (
                  <div key={String(label)} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${complete ? "bg-emerald-600" : "bg-stone-300"}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-950">{label}</p>
                      <p className="mt-1 break-words text-stone-500">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                <LockKeyhole className="h-4 w-4" />
                Evidence preview
              </div>
              <div className="mt-4 grid gap-3">
                {previewFrames.map((frame, index) => (
                  <div key={frame.label} className="overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                    <MonochromeMedia
                      src={editorialRefreshAssets.setupHeroTestBay}
                      alt={frame.label}
                      className="aspect-[4/2.2] rounded-none"
                      imageClassName={`aspect-[4/2.2] object-cover ${frame.objectPosition}`}
                      overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.26))]"
                    />
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {frame.label}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {errorMessage ? (
              <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p>{errorMessage}</p>
                {launchErrorDetails.length ? (
                  <ul className="mt-3 space-y-2 text-xs text-rose-700">
                    {launchErrorDetails.map((detail) => (
                      <li key={`${detail.code}-${detail.message}`}>
                        <span className="font-semibold">{detail.source.replaceAll("_", " ")}:</span>{" "}
                        {detail.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {suggestRuntimeFallback ? (
              <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <p className="font-semibold">
                  World Studio access is request-reviewed, but the runtime run is available.
                </p>
                <p className="mt-1">
                  Start the run directly while the presentation access path is verified.
                </p>
              </section>
            ) : null}

            <section className="rounded-lg border border-stone-950/12 bg-white p-5 shadow-[0_24px_70px_rgba(35,31,24,0.08)]">
              <div className="space-y-3">
                {runtimeLaunchBlocked ? (
                  <a
                    href={hostedRequestHref}
                    className="inline-flex w-full items-center justify-center rounded-md bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Request Policy Evaluation Set
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center rounded-md bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Starting..." : "Start Policy Evaluation Set"}
                    {!submitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                  </button>
                )}
                <button
                  type="button"
                  disabled={submitting || launchBlocked}
                  onClick={() => void launchSession("presentation_demo")}
                  className="inline-flex w-full items-center justify-center rounded-md border border-stone-300 bg-white px-5 py-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Opening..."
                    : launchBlocked
                      ? "World Studio proof-gated"
                      : "Open World Studio"}
                  {!submitting && !launchBlocked ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </button>
              </div>
              <p className="mt-4 text-xs leading-5 text-stone-500">
                Gated setups become scoped requests. Launching here does not assert provider execution,
                live simulation success, rights clearance, payment, or robot deployment readiness.
              </p>
            </section>
          </aside>
        </form>
      </div>
    </>
  );
}
