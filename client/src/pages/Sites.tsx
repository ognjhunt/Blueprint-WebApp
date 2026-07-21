import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database, Loader2, Search } from "lucide-react";

import { SEO } from "@/components/SEO";
import type { SiteWorldCard } from "@/data/siteWorlds";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

type SiteWorldsResponse = { items: SiteWorldCard[]; count: number };

function requestHref(site?: SiteWorldCard) {
  const query = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "policy-evaluation-run",
    path: "policy-evaluation-run",
    requestedOutputs: "Policy Evaluation Run",
    source: site ? "sites-live-card" : "sites-hero",
  });
  if (site) query.set("location", site.siteName);
  return `/contact/robot-team?${query.toString()}`;
}

function SiteCard({ site }: { site: SiteWorldCard }) {
  const tasks = site.taskCatalog?.slice(0, 3) || [];
  const readiness = site.evaluationReadiness?.qualification_state?.replace(/_/g, " ");
  return (
    <article className="flex flex-col rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider">
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900">
          Pipeline record
        </span>
        {readiness ? (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
            {readiness}
          </span>
        ) : null}
      </div>
      <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-normal">
        {site.siteName}
      </h2>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        {site.category} · {site.industry}
      </p>
      <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{site.summary}</p>
      {tasks.length ? (
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Recorded tasks">
          {tasks.map((task) => (
            <span
              key={task.id}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {task.taskText || task.taskId || task.id}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <a
          href={`/sites/${encodeURIComponent(site.id)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Inspect record <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
        <a
          href={requestHref(site)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-950 hover:bg-slate-50"
        >
          Request evaluation
        </a>
      </div>
    </article>
  );
}

export default function Sites() {
  const [sites, setSites] = useState<SiteWorldCard[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/site-worlds?limit=100", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Site records unavailable (${response.status})`);
        return response.json() as Promise<SiteWorldsResponse>;
      })
      .then((payload) => {
        setSites(payload.items.filter((site) => site.dataSource === "pipeline"));
        setError(null);
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string })?.name !== "AbortError") {
          setError(reason instanceof Error ? reason.message : "Site records unavailable");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filteredSites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sites;
    return sites.filter((site) =>
      [
        site.siteName,
        site.category,
        site.industry,
        site.taskLane,
        site.summary,
        ...site.taskCatalog.map((task) => task.taskText || task.taskId || task.id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, sites]);

  return (
    <>
      <SEO
        title="Captured Sites | Blueprint"
        description="Browse owner-system-backed capture records available for robot Policy Evaluation Runs."
        canonical="/sites"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.hero}`}
        jsonLd={[
          webPageJsonLd({
            path: "/sites",
            name: "Blueprint captured sites",
            description: "Real capture records opened for robot policy evaluation requests.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Sites", path: "/sites" },
          ]),
        ]}
      />

      <div className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.75fr_1.25fr] md:items-center md:px-8 md:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Real capture inventory
              </p>
              <h1 className="mt-4 max-w-[11ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                Evaluate where the work happens.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
                Public cards come from current Pipeline-backed capture records. If the exact
                place is not open, Blueprint can scope a new capture with its operator.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={requestHref()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Scope an evaluation <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="/signup/capturer"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  Capture a site
                </a>
              </div>
            </div>
            <img
              src={wamPolicyEvalAssets.hero}
              alt="Humanoid robot working in a captured facility task"
              className="aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-[88rem] px-5 py-6 md:px-8">
            <label htmlFor="site-search" className="block max-w-2xl">
              <span className="mb-2 block text-xs font-semibold text-slate-500">Search live records</span>
              <span className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4">
                <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <input
                  id="site-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Site type, task, or industry"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
              </span>
            </label>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 md:px-8">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-label="Loading site records" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-7">
              <h2 className="text-2xl font-semibold">Inventory status is temporarily unavailable.</h2>
              <p className="mt-3 text-sm text-amber-950">{error}</p>
              <a href={requestHref()} className="mt-5 inline-flex font-semibold text-blue-700">Request a site directly</a>
            </div>
          ) : filteredSites.length ? (
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredSites.map((site) => <SiteCard key={site.id} site={site} />)}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-12">
              <Database className="h-7 w-7 text-blue-600" aria-hidden="true" />
              <h2 className="mt-5 text-3xl font-semibold tracking-normal">
                {sites.length ? "No live record matches that search." : "Site access starts with a real capture record."}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Blueprint only publishes inventory backed by the current capture and Pipeline record.
                Request the exact workflow and site type you need, or join the capturer network to add supply.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {sites.length ? (
                  <button type="button" onClick={() => setQuery("")} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold">
                    Clear search
                  </button>
                ) : null}
                <a href={requestHref()} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
                  Request exact-site access
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
