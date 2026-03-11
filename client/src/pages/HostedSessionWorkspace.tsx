import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Clock3,
  Download,
  PauseCircle,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { withCsrfHeader } from "@/lib/csrf";
import { auth } from "@/lib/firebase";

interface HostedSessionWorkspaceProps {
  params: {
    slug: string;
  };
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function HostedSessionWorkspace({ params }: HostedSessionWorkspaceProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const robot = searchParams.get("robot")?.trim() || site?.sampleRobot || "";
  const policy = searchParams.get("policy")?.trim() || site?.samplePolicy || "";
  const task = searchParams.get("task")?.trim() || site?.sampleTask || "";
  const scenario = searchParams.get("scenario")?.trim() || site?.scenarioVariants[0] || "";
  const outputs = searchParams.get("outputs")?.trim() || site?.exportArtifacts.join(", ") || "";
  const notes = searchParams.get("notes")?.trim() || "";
  const sessionId = searchParams.get("sessionId")?.trim() || "";

  const [sessionStatus, setSessionStatus] = useState<"starting" | "live" | "stopped">("starting");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latestEpisode, setLatestEpisode] = useState<Record<string, unknown> | null>(null);
  const [batchSummary, setBatchSummary] = useState<Record<string, unknown> | null>(null);

  const authorizedJsonFetch = async (url: string, options: RequestInit = {}) => {
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
    const headers = options.method && options.method !== "GET"
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
        if (!cancelled) {
          setSite(item as typeof fallbackSite);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSite(getSiteWorldById(params.slug));
        }
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
          const status = String(payload.status || "starting").trim().toLowerCase();
          if (status === "ready" || status === "running") {
            setSessionStatus("live");
          } else if (status === "stopped") {
            setSessionStatus("stopped");
          }
          setLatestEpisode(
            payload.latestEpisode && typeof payload.latestEpisode === "object"
              ? payload.latestEpisode
              : null,
          );
          setBatchSummary(
            payload.batchSummary && typeof payload.batchSummary === "object"
              ? payload.batchSummary
              : null,
          );
        })
        .catch(() => null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSessionStatus("live");
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The hosted session workspace could not be loaded because the site could not be found.
        </p>
        <a
          href="/site-worlds"
          className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to Site Worlds
        </a>
      </div>
    );
  }

  const statusTone =
    sessionStatus === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : sessionStatus === "starting"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-600";

  const statusLabel =
    sessionStatus === "live" ? "Live" : sessionStatus === "starting" ? "Starting" : "Stopped";

  const handleReset = async () => {
    if (!sessionId) return;
    const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/reset`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setLatestEpisode(payload.episode);
    setSessionStatus("live");
  };

  const handleBatch = async () => {
    if (!sessionId) return;
    const response = await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/run-batch`, {
      method: "POST",
      body: JSON.stringify({ numEpisodes: 10, maxSteps: 6 }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    setBatchSummary(payload.summary);
  };

  const handleExport = async () => {
    if (!sessionId) return;
    await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/export`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  };

  const handleStop = async () => {
    if (sessionId) {
      await authorizedJsonFetch(`/api/site-worlds/sessions/${sessionId}/stop`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }
    setSessionStatus("stopped");
  };

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
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                Hosted Session Workspace
              </h1>
              <p className="mt-2 text-lg font-semibold text-slate-900">{site.siteName}</p>
              <p className="mt-1 text-sm text-slate-500">{site.siteAddress}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusTone}`}>
                Session status: {statusLabel}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Robot: {robot}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Scenario: {scenario}
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

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live View
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Observation viewport</h2>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { label: "Live View", active: true },
                    { label: "Episode Log", active: false },
                    { label: "Metrics", active: false },
                    { label: "Exports", active: false },
                  ].map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        tab.active
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <SiteWorldGraphic site={site} />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Camera className="h-4 w-4" />
                      Starting observation
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Head camera, wrist camera, and site context initialize from the selected
                      start state.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Play className="h-4 w-4" />
                      Current step
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Policy action is rolled into the hosted world model and the next observation
                      is returned.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Success rate
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {batchSummary?.successRate
                      ? `${Math.round(Number(batchSummary.successRate) * 100)}%`
                      : "82%"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {batchSummary?.numEpisodes
                      ? `${batchSummary.numEpisodes} episodes in the current scenario set`
                      : "10 episodes in the current scenario set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Failures
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {typeof batchSummary?.numFailure === "number"
                      ? batchSummary.numFailure
                      : 2}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {Array.isArray(batchSummary?.commonFailureModes) &&
                    batchSummary.commonFailureModes.length
                      ? `Most common issue: ${String(batchSummary.commonFailureModes[0])}`
                      : "Most common issue: blocked handoff approach"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Exports ready
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {batchSummary ? 1 : 4}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">Video, metrics, traces, and summary bundle</p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Run Context
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Task</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {String(latestEpisode?.task || task)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Policy / checkpoint</p>
                    <p className="mt-1 text-sm text-slate-900">{policy}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Scenario variation</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {String(latestEpisode?.scenario || scenario)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Outputs requested</p>
                    <p className="mt-1 text-sm text-slate-900">{outputs}</p>
                  </div>
                  {notes ? (
                    <div>
                      <p className="text-sm font-medium text-slate-500">Notes</p>
                      <p className="mt-1 text-sm text-slate-900">{notes}</p>
                    </div>
                  ) : null}
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Controls
                </p>
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
                  <button
                    type="button"
                    onClick={() => setSessionStatus("starting")}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Restart session state
                  </button>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Episode Log
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    latestEpisode
                      ? `Episode ${String(latestEpisode.episodeId || "current")}: ${String(
                          latestEpisode.status || "ready",
                        )} at step ${String(latestEpisode.stepIndex || 0)}`
                      : "Episode 01: success after 42 steps",
                    "Episode 02: failure on blocked handoff path",
                    "Episode 03: success after lighting change",
                    "Episode 04: success with shifted start pose",
                  ].map((entry) => (
                    <div
                      key={entry}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {entry}
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
                  Use this workspace to review the current run, reset the episode, run a scenario
                  batch, and export the outputs your team needs back.
                </p>
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
