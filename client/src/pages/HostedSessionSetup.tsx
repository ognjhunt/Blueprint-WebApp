import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Play, SlidersHorizontal } from "lucide-react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { getSiteWorldById } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { withCsrfHeader } from "@/lib/csrf";
import { auth } from "@/lib/firebase";

interface HostedSessionSetupProps {
  params: {
    slug: string;
  };
}

export default function HostedSessionSetup({ params }: HostedSessionSetupProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);
  const [, setLocation] = useLocation();

  const [robot, setRobot] = useState("");
  const [policy, setPolicy] = useState("");
  const [task, setTask] = useState("");
  const [scenario, setScenario] = useState("");
  const [outputs, setOutputs] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    if (!site) return;
    setRobot(site.sampleRobot);
    setPolicy(site.samplePolicy);
    setTask(site.sampleTask);
    setScenario(site.scenarioVariants[0] ?? "Default scenario set");
    setOutputs(site.exportArtifacts.slice(0, 3).join(", "));
  }, [site]);

  const siteChecklist = useMemo(() => {
    if (!site) return [];
    return [
      "Blueprint hosts the eval environment for this exact site.",
      "You choose the robot, policy, task, and scenario set.",
      "The workspace returns observations, metrics, and exports.",
    ];
  }, [site]);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Site world not found</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The hosted session setup page is not available because the site could not be found.
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

  const handleLaunch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage("");

    const query = new URLSearchParams({
      robot,
      policy,
      task,
      scenario,
      outputs,
      notes,
    });

    try {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
      if (!token) {
        throw new Error("Missing authenticated user");
      }

      const response = await fetch("/api/site-worlds/sessions", {
        method: "POST",
        headers: {
          ...(await withCsrfHeader({ "Content-Type": "application/json" })),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          siteWorldId: site.id,
          robot,
          policy: {
            adapter_name: "mock",
            model_name: policy,
            device: "cpu",
            requested_outputs: outputs,
          },
          task,
          scenario,
          notes,
        }),
      });

      const payload = (await response.json()) as { workspaceUrl?: string; error?: string };
      if (!response.ok || !payload.workspaceUrl) {
        throw new Error(payload.error || "Unable to launch hosted session");
      }
      setLocation(payload.workspaceUrl);
      return;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `${error.message}. Falling back to local workspace preview.`
          : "Falling back to local workspace preview.",
      );
      setLocation(`/site-worlds/${site.id}/workspace?${query.toString()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title={`Start Hosted Session | ${site.siteName} | Blueprint`}
        description={`Set up a hosted evaluation session for ${site.siteName}.`}
        canonical={`/site-worlds/${site.id}/start`}
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <a
            href={`/site-worlds/${site.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </a>

          <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Play className="h-4 w-4" />
                Session Setup
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                Start Hosted Session
              </h1>
              <p className="mt-3 text-lg font-semibold text-slate-900">{site.siteName}</p>
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{site.siteAddress}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{site.taskLane}</p>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <SiteWorldGraphic site={site} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Starting rate
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {site.packages[1].priceLabel}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    This session is for
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    Robot-team testing on one exact site
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
                <p className="text-sm font-semibold">You are setting up a hosted evaluation run.</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {siteChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <SlidersHorizontal className="h-4 w-4" />
                Launch Details
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Confirm the core run settings below, then launch the hosted session workspace.
              </p>

              <form className="mt-6 space-y-5" onSubmit={handleLaunch}>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Robot / embodiment
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    value={robot}
                    onChange={(event) => setRobot(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Policy / checkpoint
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    value={policy}
                    onChange={(event) => setPolicy(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Task</label>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Scenario set
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value)}
                  >
                    {site.scenarioVariants.map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Outputs needed
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    value={outputs}
                    onChange={(event) => setOutputs(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    placeholder="Checkpoint notes, scenario intent, or any run constraints."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                {errorMessage ? (
                  <p className="text-sm text-amber-700">{errorMessage}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {submitting ? "Launching..." : "Launch session"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                  <a
                    href={`/site-worlds/${site.id}`}
                    className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to site
                  </a>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
