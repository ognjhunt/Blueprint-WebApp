import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { categoryFilters, siteWorldCards, type SiteCategory } from "@/data/siteWorlds";
import { getSiteWorldBadge } from "@/lib/siteWorldBadges";
import { fetchSiteWorldCatalog } from "@/lib/siteWorldsApi";
import { ExternalLink, Filter, Play, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";

const layerCards = [
  {
    title: "Buy the site package",
    kicker: "Option 1",
    description:
      "Use this when your team needs the grounded site files, package notes, and rights context in your own stack.",
    bullets: [
      "Walkthrough video and camera poses",
      "Geometry, depth, and site notes when available",
      "License for internal review or integration",
    ],
    icon: <ScanLine className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Request a hosted evaluation",
    kicker: "Option 2",
    description:
      "Use this when you want Blueprint to run the exact site with you so your team can test, rerun, and export results without moving files first.",
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
    title: "Run site-grounded evals",
    description:
      "See if your robot can localize, fit, see the task, and finish the job before anyone goes on site.",
  },
  {
    title: "Generate site-specific data",
    description:
      "Render views, vary scenarios, and export outputs for training, debugging, or policy adaptation.",
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
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const checkoutState = searchParams.get("checkout");

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
        description="Browse site-specific world models of real indoor spaces for robot evaluation, site-grounded data generation, and hosted access."
        canonical="/world-models"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          {checkoutState ? (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                checkoutState === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-semibold">
                {checkoutState === "success" ? "Purchase successful" : "Checkout canceled"}
              </p>
              <p className="mt-1">
                {checkoutState === "success"
                  ? "Your team can keep browsing world models or open the purchased site package from the follow-up email."
                  : "Your checkout did not complete. You can keep browsing or reopen a hosted world-model purchase when ready."}
              </p>
            </div>
          ) : null}
          <header className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                World Models
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Browse exact sites your team can use before deployment.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-[1.08rem]">
                Each world model is built from real indoor capture and tied to one site and one
                workflow. Open a listing to see the package price, the hosted evaluation path, and
                whether that site is a good anchor for evals, exports, and deployment prep.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#layers"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  How buying works
                </a>
                <a
                  href="#catalog"
                  className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Browse sites
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-slate-900">What every listing should tell you</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>What real site and workflow the model is anchored to</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>What can be bought, evaluated, and exported from it</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Enough detail to decide whether the site is worth deeper work</span>
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
                Some teams need the grounded site assets first. Others already know they need
                reruns, exports, and runtime evidence. Both paths stay tied to the same real place.
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
                Common reasons robot teams use world models.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                These are the practical jobs teams use them for before they commit travel, pilot
                time, or customer time.
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
                  Sites your team could review right now.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Open any listing to see the workflow, compare the package with the hosted
                  evaluation path, and decide what to do next.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {filteredSites.length} listed sites · each listing shows its own site-package price and hosted rate
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
                  {(() => {
                    const nativePrimary = site.deploymentReadiness?.native_world_model_primary === true;
                    const fallbackAvailable =
                      site.deploymentReadiness?.provider_fallback_preview_status === "fallback_available"
                      || Boolean(site.worldLabsPreview?.launchUrl);
                    const badge = getSiteWorldBadge(site);
                    return (
                  <a href={`/world-models/${site.id}`} className="relative block">
                    <SiteWorldGraphic site={site} />
                    <div className="absolute left-4 top-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur ${badge.tone}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
                        {badge.label}
                      </span>
                    </div>
                    {nativePrimary ? (
                      <div className="absolute bottom-4 left-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-sm backdrop-blur">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                          Native package ready
                        </span>
                      </div>
                    ) : fallbackAvailable ? (
                      <div className="absolute bottom-4 left-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-sm backdrop-blur">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Fallback preview only
                        </span>
                      </div>
                    ) : null}
                  </a>
                    );
                  })()}
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

                    {site.deploymentReadiness?.native_world_model_primary ? (
                      <div className="space-y-2">
                        <a
                          href={`/world-models/${site.id}/start`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          <Play className="h-4 w-4" />
                          Open hosted eval setup
                        </a>
                        {site.worldLabsPreview?.launchUrl ? (
                          <a
                            href={site.worldLabsPreview.launchUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open fallback preview
                          </a>
                        ) : null}
                      </div>
                    ) : site.worldLabsPreview?.launchUrl ? (
                      <a
                        href={site.worldLabsPreview.launchUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Launch fallback preview
                      </a>
                    ) : null}

                    <div className="space-y-2.5">
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
                          <a
                            href={pkg.actionHref}
                            className={`mt-3 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                              pkg.name === "Hosted Evaluation"
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
