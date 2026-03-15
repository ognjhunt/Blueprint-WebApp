import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { categoryFilters, siteWorldCards, type SiteCategory } from "@/data/siteWorlds";
import { fetchSiteWorldCatalog } from "@/lib/siteWorldsApi";
import { Filter, Play, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const layerCards = [
  {
    title: "Get the package",
    kicker: "Option 1",
    description:
      "Use this when your team wants the site package for internal review, integration work, or your own stack.",
    bullets: [
      "Walkthrough video and camera poses",
      "Geometry, depth, and site notes when available",
      "License for internal review or integration",
    ],
    icon: <ScanLine className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Run it hosted",
    kicker: "Option 2",
    description:
      "Use this when you want Blueprint to host the world model so your team can test, rerun, and export results right away.",
    bullets: [
      "Reset and rerun the same site",
      "Scenario changes for edge-case checks",
      "Rollout exports, datasets, and policy comparison",
    ],
    icon: <Play className="h-5 w-5 text-slate-700" />,
  },
];

const useCaseCards = [
  {
    title: "Test before travel",
    description:
      "See if your robot can localize, fit, see the task, and finish the job before anyone goes on site.",
  },
  {
    title: "Make site-specific data",
    description:
      "Render views, vary scenarios, and export outputs for training, debugging, or internal review.",
  },
  {
    title: "Compare releases",
    description:
      "Run the same site and task after each autonomy update so your team can spot regressions early.",
  },
  {
    title: "Train and demo",
    description:
      "Show the exact customer site to operators, teleop teams, or buyers in a browser before the real visit.",
  },
];

export default function SiteWorlds() {
  const [activeCategory, setActiveCategory] = useState<SiteCategory>("All");
  const [catalog, setCatalog] = useState(siteWorldCards);

  useEffect(() => {
    let cancelled = false;
    fetchSiteWorldCatalog()
      .then((items) => {
        if (!cancelled && items.length > 0) {
          setCatalog(items as typeof siteWorldCards);
        }
      })
      .catch(() => {
        // Keep static fallback catalog if live inventory is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSites = useMemo(() => {
    if (activeCategory === "All") {
      return catalog;
    }
    return catalog.filter((site) => site.category === activeCategory);
  }, [activeCategory, catalog]);

  return (
    <>
      <SEO
        title="World Models | Blueprint"
        description="Blueprint world models are a downstream lane after qualification. Review curated examples of what can follow a strong site record."
        canonical="/world-models"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                World Models
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Review what can follow a qualified site.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-[1.08rem]">
                These are curated examples of the hosted and package-based outputs Blueprint can
                prepare after a site clears qualification. For alpha, intake and buyer review come
                first, while hosted world-model access stays downstream.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#layers"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  See the layers
                </a>
                <a
                  href="#catalog"
                  className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Review examples
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-slate-900">What you get</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>A model of the exact site and workflow</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>A package you can buy or a hosted session you can run</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Repeatable runs and exportable outputs</span>
                </li>
              </ul>
            </div>
          </header>

          <section
            id="layers"
            className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7"
          >
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Access options
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Choose how you want access.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Some teams want the site package. Others want the hosted version so they can test quickly. In alpha, both remain downstream of the qualification record.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {layerCards.map((layer) => (
                <article
                  key={layer.title}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-5"
                >
                  <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-2">{layer.icon}</div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {layer.kicker}
                  </p>
                  <h3 className="mt-2 font-semibold text-slate-900">{layer.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{layer.description}</p>
                  <ul className="mt-4 space-y-1.5">
                    {layer.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-6 sm:px-7 sm:py-7">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Why teams buy this
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Common reasons teams request this lane.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                These are practical reasons to use it before you commit travel, pilot time, or
                customer time.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {useCaseCards.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="catalog" className="mt-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sample catalog
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Sites your team could test against right now.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Open any sample site to see what Blueprint can attach after qualification, not what every inbound request receives on day one.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {filteredSites.length} listed sites · each site card shows its own self-serve hourly rate
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Filter
              </div>
              {categoryFilters.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSites.map((site) => (
                <article
                  key={site.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
                >
                  <a href={`/world-models/${site.id}`} className="block">
                    <SiteWorldGraphic site={site} />
                  </a>
                  <div className="space-y-3 p-5 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {site.industry}
                      </p>
                      <h3 className="mt-2 text-[1.85rem] font-bold leading-[1.02] tracking-tight text-slate-900">
                        <a href={`/world-models/${site.id}`} className="hover:text-slate-700">
                          {site.siteName}
                        </a>
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">{site.siteAddress}</p>
                      <p className="mt-2 text-sm text-slate-600">{site.taskLane}</p>
                      <p className="mt-1.5 text-sm text-slate-500">{site.bestFor}</p>
                    </div>

                    <div className="space-y-2.5">
                      {site.deploymentReadiness ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Deployment Readiness
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                Status
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {String(site.deploymentReadiness.qualification_state || "unknown").replaceAll("_", " ")}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                Benchmarks
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {site.deploymentReadiness.benchmark_coverage_status || "missing"}
                                {typeof site.deploymentReadiness.benchmark_task_count === "number"
                                  ? ` · ${site.deploymentReadiness.benchmark_task_count} tasks`
                                  : ""}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                Exports
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {site.deploymentReadiness.export_readiness_status || "missing"}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                Refresh
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {site.deploymentReadiness.recapture_required
                                  ? "Needs refresh"
                                  : site.deploymentReadiness.recapture_status || "Current"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {site.packages.map((pkg) => (
                        <div
                          key={pkg.name}
                          className={`rounded-2xl border p-4 ${
                            pkg.emphasis === "recommended"
                              ? "border-slate-300 bg-slate-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                {pkg.summary}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-slate-900">
                              {pkg.priceLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            {pkg.payerLabel}
                          </p>
                          <a
                            href={pkg.actionHref}
                            className={`mt-3 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                              pkg.name === "Hosted Sessions"
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            {pkg.actionLabel}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
