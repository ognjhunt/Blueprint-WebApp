import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Cpu, MapPin, Play, ScanSearch, Settings2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import {
  DEFAULT_RUNTIME_BACKEND,
  REQUESTED_OUTPUT_DEFINITIONS,
} from "@/lib/hostedSession";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { withCsrfHeader } from "@/lib/csrf";
import { auth } from "@/lib/firebase";
import type { CreateHostedSessionRequest } from "@/types/hostedSession";

interface HostedSessionSetupProps {
  params: {
    slug: string;
  };
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
  const [launchReadiness, setLaunchReadiness] = useState<{
    launchable: boolean;
    entitled: boolean;
    blockers: string[];
    presentationWorldManifestUri?: string | null;
  } | null>(null);
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
    setRequestedOutputs(REQUESTED_OUTPUT_DEFINITIONS.map((item) => item.id));
  }, [site]);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    setCheckingReadiness(true);

    (async () => {
      try {
        const token = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
        if (!token) {
          throw new Error("Missing authenticated user");
        }
        const response = await fetch(
          `/api/site-worlds/sessions/launch-readiness?siteWorldId=${encodeURIComponent(site.id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = (await response.json()) as {
          launchable?: boolean;
          entitled?: boolean;
          blockers?: string[];
          error?: string;
          presentationWorldManifestUri?: string | null;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to verify launch readiness");
        }
        if (!cancelled) {
          setLaunchReadiness({
            launchable: Boolean(payload.launchable),
            entitled: Boolean(payload.entitled),
            blockers: Array.isArray(payload.blockers) ? payload.blockers : [],
            presentationWorldManifestUri: payload.presentationWorldManifestUri || null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLaunchReadiness({
            launchable: false,
            entitled: false,
            blockers: [error instanceof Error ? error.message : "Unable to verify launch readiness"],
            presentationWorldManifestUri: null,
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
    () => site?.robotProfiles.find((item) => item.id === robotProfileId) || site?.sampleRobotProfile || null,
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

  const selectedTask = site.taskCatalog.find((item) => item.id === taskId) || site.taskCatalog[0];
  const selectedScenario = site.scenarioCatalog.find((item) => item.id === scenarioId) || site.scenarioCatalog[0];
  const selectedStartState = site.startStateCatalog.find((item) => item.id === startStateId) || site.startStateCatalog[0];

  const handleOutputToggle = (outputId: string) => {
    setRequestedOutputs((current) =>
      current.includes(outputId)
        ? current.filter((value) => value !== outputId)
        : [...current, outputId],
    );
  };

  const handleLaunch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const requestPayload: CreateHostedSessionRequest = {
      siteWorldId: site.id,
      sessionMode: "presentation_demo",
      runtimeUi: "neoverse_gradio",
      autoStartDemo: true,
      robotProfileId,
      taskId,
      scenarioId,
      startStateId,
      requestedOutputs,
      exportModes: ["raw_bundle", "rlds_dataset"],
      notes,
    };

    try {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
      if (!token) throw new Error("Missing authenticated user");
      const response = await fetch("/api/site-worlds/sessions", {
        method: "POST",
        headers: {
          ...(await withCsrfHeader({ "Content-Type": "application/json" })),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });
      const payload = (await response.json()) as { workspaceUrl?: string; error?: string };
      if (!response.ok || !payload.workspaceUrl) {
        throw new Error(payload.error || "Unable to launch hosted session");
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

  const cameraSummary = selectedRobotProfile.observationCameras.map((item) => item.role).join(", ");
  const launchBlocked = checkingReadiness || !launchReadiness?.launchable;

  return (
    <>
      <SEO
        title={`Start Hosted Session | ${site.siteName} | Blueprint`}
        description={`Set up a NeoVerse-first hosted session for ${site.siteName}.`}
        canonical={`/site-worlds/${site.id}/start`}
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <a
            href={`/site-worlds/${site.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </a>

          <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Play className="h-4 w-4" />
                Hosted Session Setup
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Start Hosted Session</h1>
              <p className="mt-3 text-lg font-semibold text-slate-900">{site.siteName}</p>
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{site.siteAddress}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{site.taskLane}</p>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <SiteWorldGraphic site={site} />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
                <p className="text-sm font-semibold">NeoVerse is the default hosted runtime.</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {[
                    "The site model comes from the captured scene-memory bundle, not the robot profile.",
                    "Robot, task, scenario, and start state are selected independently.",
                    "The runtime handle comes from the registered site world on the GPU VM.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                <p className="font-semibold">Presentation demo readiness</p>
                <p className="mt-2">
                  {checkingReadiness
                    ? "Checking whether this site can launch an embedded NeoVerse demo."
                    : launchReadiness?.launchable
                      ? "This site is ready for an embedded NeoVerse demo session."
                      : "This site cannot launch the embedded NeoVerse demo yet."}
                </p>
                {launchReadiness?.presentationWorldManifestUri ? (
                  <p className="mt-2 break-all text-xs text-amber-900">
                    Presentation package: {launchReadiness.presentationWorldManifestUri}
                  </p>
                ) : null}
                {launchReadiness?.blockers?.length ? (
                  <ul className="mt-3 space-y-2 text-xs text-amber-900">
                    {launchReadiness.blockers.map((blocker) => (
                      <li key={blocker}>• {blocker}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <form className="space-y-6" onSubmit={handleLaunch}>
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <ScanSearch className="h-4 w-4" />
                    Site Model
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Scene ID</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{site.sceneId}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Capture ID</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{site.captureId}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Runtime capabilities</p>
                      <p className="mt-1 text-sm text-slate-900">
                        Backend: {site.runtimeManifest?.defaultBackend || site.defaultRuntimeBackend} ·
                        Cameras: {site.runtimeManifest?.supportsCameraViews ? " yes" : " no"} ·
                        Batch: {site.runtimeManifest?.supportsBatchRollout ? " yes" : " no"} ·
                        Demo UI: {launchReadiness?.launchable ? " ready" : " blocked"}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Cpu className="h-4 w-4" />
                    Robot Profile
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Robot profile</label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
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
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Robot contract</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {selectedRobotProfile.embodimentType.replaceAll("_", " ")} · {cameraSummary}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{selectedRobotProfile.actionSpaceSummary}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Settings2 className="h-4 w-4" />
                    Session Runtime
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Task</label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
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
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Scenario</label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                        value={scenarioId}
                        onChange={(event) => setScenarioId(event.target.value)}
                      >
                        {site.scenarioCatalog.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Start state</label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                        value={startStateId}
                        onChange={(event) => setStartStateId(event.target.value)}
                      >
                        {site.startStateCatalog.map((startState) => (
                          <option key={startState.id} value={startState.id}>
                            {startState.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Default exports</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">Raw session bundle + RLDS dataset</p>
                      <p className="mt-1 text-sm text-slate-500">{site.exportModes.join(", ")}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="mb-2 text-sm font-medium text-slate-700">Generated outputs</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {REQUESTED_OUTPUT_DEFINITIONS.map((output) => {
                          const checked = requestedOutputs.includes(output.id);
                          return (
                            <label
                              key={output.id}
                              className={`rounded-2xl border px-4 py-3 text-sm transition ${
                                checked
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700"
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
                                  <span className={`mt-1 block text-xs ${checked ? "text-slate-300" : "text-slate-500"}`}>
                                    {output.description}
                                  </span>
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || launchBlocked}
                  className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Launching session..." : launchBlocked ? "Hosted demo not ready" : "Launch session"}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
