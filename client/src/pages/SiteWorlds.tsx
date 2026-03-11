import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { categoryFilters, siteWorldCards, type SiteCategory } from "@/data/siteWorlds";
import { Filter, Play, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";

const layerCards = [
  {
    title: "Scene Package",
    kicker: "First",
    description:
      "License the site asset package when your team needs the captured evidence and site context for one real workflow area.",
    bullets: [
      "Walkthrough video and camera poses",
      "Geometry or depth when available",
      "Metadata, context, and license terms",
    ],
    icon: <ScanLine className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Hosted Sessions",
    kicker: "Second",
    description:
      "Use Blueprint-managed eval sessions when your team wants to test policies on that site without running the environment itself.",
    bullets: [
      "Managed site-specific eval runtime",
      "Scenario variations and repeat runs",
      "Exports for rollouts and metrics",
    ],
    icon: <Play className="h-5 w-5 text-slate-700" />,
  },
];

export default function SiteWorlds() {
  const [activeCategory, setActiveCategory] = useState<SiteCategory>("All");

  const filteredSites = useMemo(() => {
    if (activeCategory === "All") {
      return siteWorldCards;
    }
    return siteWorldCards.filter((site) => site.category === activeCategory);
  }, [activeCategory]);

  return (
    <>
      <SEO
        title="Site Worlds | Blueprint"
        description="Robot teams can review a site asset package first, then see how Blueprint-managed hosted eval sessions would work on that exact site."
        canonical="/site-worlds"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Site Worlds For Robot Teams
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Pick a site and start the hosted session setup.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-[1.08rem]">
                This page is for robot teams. Every card shows one potential deployment site, the
                site package behind it, and the direct path to start a hosted evaluation session
                setup for that exact place.
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
                  Browse sites
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-slate-900">How to read this page</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Qualification is for site operators. This page starts after a site exists. Robot
                teams can review the site package first, then see how hosted sessions would support
                testing, comparison, and export on that exact site.
              </p>
            </div>
          </header>

          <section
            id="layers"
            className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7"
          >
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Layer selector
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Two ways a robot team can use a site.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Keep it simple. The Scene Package is the site asset. Hosted Sessions are the
                managed eval layer built from that site. Start the hosted session setup when your
                team wants Blueprint to handle the environment and rollout outputs.
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

          <section id="catalog" className="mt-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sample catalog
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Twelve sites a robot team could review right now.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Each listing shows the site asset package first and the direct hosted-session
                  start path second. Open the detail page if you want the simple step-by-step
                  explanation.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {filteredSites.length} listed sites
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
                  <a href={`/site-worlds/${site.id}`} className="block">
                    <SiteWorldGraphic site={site} />
                  </a>
                  <div className="space-y-3 p-5 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {site.industry}
                      </p>
                      <h3 className="mt-2 text-[1.85rem] font-bold leading-[1.02] tracking-tight text-slate-900">
                        <a href={`/site-worlds/${site.id}`} className="hover:text-slate-700">
                          {site.siteName}
                        </a>
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">{site.siteAddress}</p>
                      <p className="mt-2 text-sm text-slate-600">{site.taskLane}</p>
                      <p className="mt-1.5 text-sm text-slate-500">{site.bestFor}</p>
                    </div>

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
