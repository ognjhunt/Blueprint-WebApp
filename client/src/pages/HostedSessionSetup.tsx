import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  MapPin,
  Play,
  ScanSearch,
  Settings2,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { REQUESTED_OUTPUT_DEFINITIONS } from "@/lib/hostedSession";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { withCsrfHeader } from "@/lib/csrf";
import type { CreateHostedSessionRequest } from "@/types/hostedSession";
import type { HostedSessionMode } from "@/types/hostedSession";

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

export default function HostedSessionSetup({ params }: HostedSessionSetupProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);
  const [, setLocation] = useLocation();
  const [robotProfileId, setRobotProfileId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [startStateId, setStartStateId] = useState("");
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
    const selectedRobot = site.robotProfiles[0] || site.sampleRobotProfile;
    setRobotProfileId(selectedRobot?.id || "");
    setTaskId(site.taskCatalog[0]?.id || "");
    setScenarioId(site.scenarioCatalog[0]?.id || "");
    setStartStateId(site.startStateCatalog[0]?.id || "");
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
          `${usePublicDemoRoutes ? "/api/site-worlds/sessions/launch-readiness" : "/api/site-worlds/sessions/launch-readiness"}?siteWorldId=${encodeURIComponent(site.id)}`,
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
          setLaunchReadiness({
            launchable: false,
            entitled: false,
            blockers: [error instanceof Error ? error.message : "Unable to verify launch readiness"],
            blocker_details: [
              {
                code: "launch_readiness_failed",
                message: error instanceof Error ? error.message : "Unable to verify launch readiness",
                source: "access",
              },
            ],
            presentationWorldManifestUri: null,
            presentation_demo: {
              launchable: false,
              blockers: [error instanceof Error ? error.message : "Unable to verify launch readiness"],
              blocker_details: [
                {
                  code: "launch_readiness_failed",
                  message: error instanceof Error ? error.message : "Unable to verify launch readiness",
                  source: "access",
                },
              ],
              presentationWorldManifestUri: null,
            },
            runtime_only: {
              launchable: false,
              blockers: [error instanceof Error ? error.message : "Unable to verify launch readiness"],
              blocker_details: [
                {
                  code: "launch_readiness_failed",
                  message: error instanceof Error ? error.message : "Unable to verify launch readiness",
                  source: "access",
                },
              ],
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
          The hosted session setup page is not available because the site could not be loaded.
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
      taskId,
      scenarioId,
      startStateId,
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
            : payload.error || "Unable to launch hosted session",
        );
      }
      setLocation(payload.workspaceUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to launch hosted session.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await launchSession("runtime_only");
  };

  const selectedTask = site.taskCatalog.find((item) => item.id === taskId) || site.taskCatalog[0];
  const selectedScenario =
    site.scenarioCatalog.find((item) => item.id === scenarioId) || site.scenarioCatalog[0];
  const selectedOutputLabels = REQUESTED_OUTPUT_DEFINITIONS.filter((item) =>
    requestedOutputs.includes(item.id),
  ).map((item) => item.label);
  const primaryOutputDefinitions = REQUESTED_OUTPUT_DEFINITIONS.filter((item) =>
    primaryOutputIds.includes(item.id as (typeof primaryOutputIds)[number]),
  );
  const cameraSummary = selectedRobotProfile.observationCameras.map((item) => item.role).join(", ");
  const presentationReadiness = launchReadiness?.presentation_demo || null;
  const runtimeReadiness = launchReadiness?.runtime_only || null;
  const launchBlocked = checkingReadiness || !presentationReadiness?.launchable;
  const runtimeLaunchBlocked = checkingReadiness || !runtimeReadiness?.launchable;
  const suggestRuntimeFallback =
    !checkingReadiness
    && !presentationReadiness?.launchable
    && Boolean(runtimeReadiness?.launchable);
  const previewFrames = [
    { label: "01 Staging area", objectPosition: "object-left" },
    { label: "02 Mechanical room entry", objectPosition: "object-center" },
    { label: "03 Pipe gallery", objectPosition: "object-right" },
    { label: "04 Control room", objectPosition: "object-bottom" },
  ];

  return (
    <>
      <SEO
        title={`Hosted Evaluation Setup | ${site.siteName} | Blueprint`}
        description={`Configure a hosted evaluation workspace for ${site.siteName}.`}
        canonical={`/world-models/${site.id}/start`}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialRefreshAssets.setupHeroTestBay}
            alt={`${site.siteName} hosted evaluation setup`}
            className="min-h-[34rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[34rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.56)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[96rem] items-start gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.6fr_0.4fr] lg:px-10 lg:py-10">
                <div className="text-white">
                  <a
                    href={`/world-models/${site.id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white/72 transition hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to site
                  </a>
                  <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-white/48">
                    Hosted evaluation
                  </p>
                  <h1 className="font-editorial mt-5 max-w-[24rem] text-[4.2rem] leading-[0.88] tracking-[-0.08em] sm:text-[5.4rem]">
                    Hosted Evaluation
                  </h1>
                  <p className="mt-5 max-w-[22rem] text-[1.9rem] leading-tight tracking-[-0.03em] text-white/92">
                    Configure one exact-site run.
                  </p>
                  <p className="mt-4 max-w-[28rem] text-base leading-8 text-white/72">
                    Blueprint prepares the hosted review path. You get run evidence, outputs, and limits tied back to the same captured site.
                  </p>
                </div>

                <div className="flex justify-start lg:justify-end">
                  <div className="w-full max-w-[18rem] border border-white/16 bg-black/38 p-5 text-white backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                      Setup summary
                    </p>
                    <div className="mt-5 space-y-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/54">Site</span>
                        <span>{site.siteName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/54">Robot</span>
                        <span>{selectedRobotProfile.displayName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/54">Task</span>
                        <span>{selectedTask?.taskText || site.sampleTask}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/54">Scenario</span>
                        <span>{humanizeToken(selectedScenario?.name)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-white/54">Outputs</span>
                        <span className="max-w-[10rem] text-right">
                          {selectedOutputLabels.slice(0, 4).join(", ")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/68">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center">
                          <Clock3 className="mr-2 h-4 w-4" />
                          Estimated run time
                        </span>
                        <span>45–60 min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
          <form onSubmit={handleLaunch} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[0.36fr_0.64fr]">
              <div className="border border-black/10 bg-white p-6 lg:p-8">
                <h2 className="font-editorial text-[2.9rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                  Configure Hosted Evaluation
                </h2>
                <p className="mt-4 text-[1.8rem] leading-tight tracking-[-0.03em] text-slate-950">
                  {site.siteName}
                </p>
                <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{site.siteAddress}</span>
                </div>

                <div className="mt-8 space-y-3">
                  <div className="grid items-center gap-4 border border-black/10 bg-[#f8f6f1] px-5 py-4 lg:grid-cols-[0.34fr_0.66fr]">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Robot profile</p>
                    </div>
                    <select
                      className="border border-black/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                      value={robotProfileId}
                      onChange={(event) => setRobotProfileId(event.target.value)}
                    >
                      {site.robotProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid items-center gap-4 border border-black/10 bg-[#f8f6f1] px-5 py-4 lg:grid-cols-[0.34fr_0.66fr]">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Task</p>
                    </div>
                    <select
                      className="border border-black/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                      value={taskId}
                      onChange={(event) => setTaskId(event.target.value)}
                    >
                      {site.taskCatalog.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.taskText}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid items-center gap-4 border border-black/10 bg-[#f8f6f1] px-5 py-4 lg:grid-cols-[0.34fr_0.66fr]">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Scenario</p>
                    </div>
                    <select
                      className="border border-black/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                      value={scenarioId}
                      onChange={(event) => setScenarioId(event.target.value)}
                    >
                      {site.scenarioCatalog.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {humanizeToken(scenario.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid items-start gap-4 border border-black/10 bg-[#f8f6f1] px-5 py-4 lg:grid-cols-[0.34fr_0.66fr]">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Requested outputs</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {primaryOutputDefinitions.map((output) => {
                        const checked = requestedOutputs.includes(output.id);
                        return (
                          <label
                            key={output.id}
                            className={`border px-3 py-3 text-sm transition ${
                              checked
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-black/10 bg-white text-slate-700"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={checked}
                                onChange={() => handleOutputToggle(output.id)}
                              />
                              <span>
                                <span className="block font-semibold">{output.label}</span>
                                <span className={`mt-1 block text-[11px] leading-5 ${checked ? "text-white/70" : "text-slate-500"}`}>
                                  {output.description}
                                </span>
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 border border-black/10 bg-white px-5 py-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.38)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Exact-site run
                  </p>
                  <p className="mt-4 max-w-[20rem] text-sm leading-7 text-slate-700">
                    We will run your robot on-site at {site.siteName}. One configuration. One
                    execution. Real data.
                  </p>
                  <p className="mt-6 text-sm text-slate-950">Blueprint Team</p>
                </div>
              </div>

              <div className="border border-black/10 bg-slate-950 text-white">
                <div className="grid gap-0 lg:grid-cols-[0.66fr_0.34fr]">
                  <div>
                    <div className="flex items-center gap-8 border-b border-white/10 px-5 py-4 text-sm text-white/68">
                      <span className="border-b border-white pb-1 text-white">Site overview</span>
                      <span>Observation preview</span>
                      <span>Route &amp; waypoints</span>
                    </div>
                    <div className="relative overflow-hidden">
                      <MonochromeMedia
                        src={editorialRefreshAssets.setupOverviewMap}
                        alt="Hosted evaluation setup overview"
                        className="min-h-[33rem] rounded-none"
                        imageClassName="min-h-[33rem] object-cover"
                        overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.28))]"
                      >
                        <RouteTraceOverlay className="opacity-75" />
                        <div className="absolute bottom-6 left-6 border border-white/12 bg-black/36 px-4 py-4 text-sm text-white/78 backdrop-blur-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                            {site.siteCode}
                          </p>
                          <p className="mt-2">{site.siteAddress}</p>
                        </div>
                        <button
                          type="button"
                          className="absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full border border-white/16 bg-black/36 text-white backdrop-blur-sm"
                          aria-label="Preview route"
                        >
                          <Play className="ml-1 h-6 w-6" />
                        </button>
                      </MonochromeMedia>
                    </div>
                  </div>

                  <div className="divide-y divide-white/10 border-t border-white/10 lg:border-l lg:border-t-0">
                    {previewFrames.map((frame, index) => (
                      <div key={frame.label} className="p-3">
                        <MonochromeMedia
                          src={editorialRefreshAssets.setupHeroTestBay}
                          alt={frame.label}
                          className="aspect-[4/2.4] rounded-none"
                          imageClassName={`aspect-[4/2.4] object-cover ${frame.objectPosition}`}
                          overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.26))]"
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/58">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/16 text-[10px]">
                            {index + 1}
                          </span>
                          {frame.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
              <div className="border border-black/10 bg-white p-6">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <ScanSearch className="h-4 w-4" />
                  World model
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="border border-black/10 bg-[#f8f6f1] px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Scene id</p>
                    <p className="mt-2 break-all text-sm text-slate-950">{site.sceneId}</p>
                  </div>
                  <div className="border border-black/10 bg-[#f8f6f1] px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Capture id</p>
                    <p className="mt-2 break-all text-sm text-slate-950">{site.captureId}</p>
                  </div>
                  <div className="border border-black/10 bg-[#f8f6f1] px-4 py-4 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Runtime capabilities
                    </p>
                    <p className="mt-2 text-sm text-slate-950">
                      Backend: {site.runtimeManifest?.defaultBackend || site.defaultRuntimeBackend}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Cameras: {cameraSummary} · Demo UI: {presentationReadiness?.launchable ? "ready" : "blocked"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    className="min-h-28 w-full border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <div className="border border-black/10 bg-slate-950 p-6 text-white">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/44">
                  <Settings2 className="h-4 w-4" />
                  Readiness
                </div>
                <div className="mt-4 space-y-4 text-sm">
                  <div className="border border-white/10 bg-white/6 px-4 py-4">
                    <p className="font-semibold text-white">Presentation demo</p>
                    <p className="mt-2 text-white/72">
                      {checkingReadiness
                        ? "Checking presentation readiness."
                        : presentationReadiness?.launchable
                          ? presentationReadiness?.status === "presentation_ui_unconfigured"
                            ? "Artifacts are ready. Private operator UI is still blocked."
                            : "Embedded demo can launch."
                          : "Embedded demo is blocked right now."}
                    </p>
                  </div>
                  <div className="border border-white/10 bg-white/6 px-4 py-4">
                    <p className="font-semibold text-white">World-model runtime</p>
                    <p className="mt-2 text-white/72">
                      {checkingReadiness
                        ? "Checking runtime readiness."
                        : runtimeReadiness?.launchable
                          ? "Runtime session can launch from this setup."
                          : "Runtime session is blocked right now."}
                    </p>
                  </div>
                  <div className="border border-white/10 bg-white/6 px-4 py-4">
                    <p className="font-semibold text-white">Scenario</p>
                    <p className="mt-2 text-white/72">{humanizeToken(selectedScenario?.name)}</p>
                  </div>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
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
              </div>
            ) : null}

            {suggestRuntimeFallback ? (
              <div className="border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
                <p className="font-semibold">
                  Embedded demo is blocked, but the world-model runtime is available.
                </p>
                <p className="mt-1">
                  Launch the runtime workspace directly while the embedded demo UI remains
                  unavailable.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-slate-700">
                Native site world is the default path for this hosted session.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={submitting || runtimeLaunchBlocked}
                  className="inline-flex items-center justify-center bg-slate-950 px-8 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Launching..."
                    : runtimeLaunchBlocked
                      ? "Runtime session not ready"
                      : "Launch runtime session"}
                </button>
                <button
                  type="button"
                  disabled={submitting || launchBlocked}
                  onClick={() => void launchSession("presentation_demo")}
                  className="inline-flex items-center justify-center border border-black/10 bg-white px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Launching..."
                    : launchBlocked
                      ? "Embedded demo not ready"
                      : "Start hosted evaluation"}
                  {!submitting && !launchBlocked ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
