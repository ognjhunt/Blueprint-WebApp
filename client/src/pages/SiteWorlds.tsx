import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { categoryFilters, siteWorldCards, type SiteCategory } from "@/data/siteWorlds";
import { PUBLIC_SAMPLE_SITE_WORLD_ID, COMMERCIAL_EXEMPLAR_SITE_WORLD_ID, getSiteWorldCatalogPriority, getSiteWorldCommercialStatus, getSiteWorldPlainEnglishStatus, getSiteWorldPublicProofSummary } from "@/lib/siteWorldCommercialStatus";
import { fetchSiteWorldCatalog } from "@/lib/siteWorldsApi";
import { Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";

type SiteWorld = (typeof siteWorldCards)[number];

function formatEmbodimentLabel(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    mobile_manipulator: "Mobile manipulator",
    fixed_arm: "Fixed arm",
    humanoid: "Humanoid",
    cart: "Cart",
    other: "Other robot",
  };
  return labels[normalized] || "Unspecified robot";
}

function hasPublicDemo(site: SiteWorld) {
  return site.id === PUBLIC_SAMPLE_SITE_WORLD_ID || Boolean(site.worldLabsPreview?.launchUrl);
}

function isHostedReady(site: SiteWorld) {
  return Boolean(site.deploymentReadiness?.native_world_model_primary) || Boolean(site.worldLabsPreview?.launchUrl);
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

const buyingStrip = [
  {
    title: "Site Package",
    body: "License the site for your own stack.",
  },
  {
    title: "Hosted Session",
    body: "Run the site with Blueprint first.",
  },
  {
    title: "Public proof first",
    body: "Inspect the listing before the sales motion.",
  },
];

export default function SiteWorlds() {
  const [activeCategory, setActiveCategory] = useState<SiteCategory>("All");
  const [activeEmbodiment, setActiveEmbodiment] = useState("All");
  const [publicDemoOnly, setPublicDemoOnly] = useState(false);
  const [hostedReadyOnly, setHostedReadyOnly] = useState(false);
  const [exportReadyOnly, setExportReadyOnly] = useState(false);
  const [catalog, setCatalog] = useState(siteWorldCards);
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const checkoutState = searchParams.get("checkout");

  const embodimentFilters = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          catalog.map((site) => formatEmbodimentLabel(site.sampleRobotProfile?.embodimentType)),
        ),
      ),
    ],
    [catalog],
  );

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
    const visibleSites = catalog.filter((site) => {
      const matchesCategory = activeCategory === "All" || site.category === activeCategory;
      const matchesEmbodiment =
        activeEmbodiment === "All"
        || formatEmbodimentLabel(site.sampleRobotProfile?.embodimentType) === activeEmbodiment;
      const matchesPublicDemo = !publicDemoOnly || hasPublicDemo(site);
      const matchesHostedReady = !hostedReadyOnly || isHostedReady(site);
      const matchesExportReady =
        !exportReadyOnly || site.deploymentReadiness?.export_readiness_status === "ready";

      return (
        matchesCategory
        && matchesEmbodiment
        && matchesPublicDemo
        && matchesHostedReady
        && matchesExportReady
      );
    });

    return [...visibleSites].sort((left, right) => {
      const priorityDelta = getSiteWorldCatalogPriority(left) - getSiteWorldCatalogPriority(right);
      if (priorityDelta !== 0) return priorityDelta;
      return left.siteName.localeCompare(right.siteName);
    });
  }, [activeCategory, activeEmbodiment, catalog, exportReadyOnly, hostedReadyOnly, publicDemoOnly]);

  const featuredSites = useMemo(
    () =>
      [PUBLIC_SAMPLE_SITE_WORLD_ID, COMMERCIAL_EXEMPLAR_SITE_WORLD_ID]
        .map((id) => filteredSites.find((site) => site.id === id) || null)
        .filter(Boolean) as SiteWorld[],
    [filteredSites],
  );

  return (
    <>
      <SEO
        title="World Models | Blueprint"
        description="Browse exact-site world models built from real capture, with clear paths into site packages or hosted sessions."
        canonical="/world-models"
      />

      <div className="min-h-screen bg-[#f6f1e8]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
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
                  : "Your checkout did not complete. You can keep browsing or reopen access when ready."}
              </p>
            </div>
          ) : null}

          <header className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div className="max-w-3xl">
              <SectionLabel>World Models</SectionLabel>
              <h1 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.8rem]">
                Browse exact-site world models.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
                Real facilities, real capture, and clear paths into site packages or hosted
                sessions.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/world-models/siteworld-f5fd54898cfb"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View Sample Site
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Request Access
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {buyingStrip.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.6rem] border border-black/10 bg-white/80 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.3)]"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </header>

          <section className="mt-10">
            <div>
              <SectionLabel>Featured</SectionLabel>
              <h2 className="font-editorial mt-3 text-4xl tracking-[-0.05em] text-slate-950">
                Featured sites.
              </h2>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {featuredSites.map((site) => (
                <a
                  key={site.id}
                  href={`/world-models/${site.id}`}
                  aria-label={site.siteName}
                  className="group overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_24px_70px_-56px_rgba(15,23,42,0.45)]"
                >
                  <div className="relative">
                    <SiteWorldGraphic site={site} />
                  </div>
                  <div className="p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {site.industry}
                    </p>
                    <h3 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-900">
                      {site.siteName}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{site.summary}</p>
                    <p className="mt-4 text-sm font-semibold text-slate-900">
                      {getSiteWorldPlainEnglishStatus(site)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section id="catalog" className="mt-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <SectionLabel>Catalog</SectionLabel>
                <h2 className="font-editorial mt-3 text-4xl tracking-[-0.05em] text-slate-950">
                  Browse the catalog.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Open a site to inspect proof, buying path, and next-step access.
                </p>
              </div>
              <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-600">
                {filteredSites.length} listed sites
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                ["Public demo available", publicDemoOnly, setPublicDemoOnly],
                ["Hosted path documented", hostedReadyOnly, setHostedReadyOnly],
                ["Export ready", exportReadyOnly, setExportReadyOnly],
              ].map(([label, active, setter]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() =>
                    (setter as React.Dispatch<React.SetStateAction<boolean>>)((value) => !value)
                  }
                  className={
                    active
                      ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                      : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  }
                >
                  {label as string}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Industry
              </div>
              {categoryFilters.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={
                      isActive
                        ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    }
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Embodiment
              </div>
              {embodimentFilters.map((embodiment) => {
                const isActive = activeEmbodiment === embodiment;
                return (
                  <button
                    key={embodiment}
                    type="button"
                    onClick={() => setActiveEmbodiment(embodiment)}
                    className={
                      isActive
                        ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    }
                  >
                    {embodiment}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSites.map((site) => {
                const commercialStatus = getSiteWorldCommercialStatus(site);
                return (
                  <article
                    key={site.id}
                    className="overflow-hidden rounded-[1.85rem] border border-black/10 bg-white shadow-[0_18px_50px_-42px_rgba(15,23,42,0.3)] transition hover:border-slate-300"
                  >
                    <a href={`/world-models/${site.id}`} className="relative block">
                      <SiteWorldGraphic site={site} />
                    </a>

                    <div className="space-y-4 p-5 sm:p-6">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {site.industry}
                        </p>
                        <h3 className="mt-2 text-[1.7rem] font-semibold leading-[1.04] tracking-tight text-slate-900">
                          <a href={`/world-models/${site.id}`} className="hover:text-slate-700">
                            {site.siteName}
                          </a>
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">{site.siteAddress}</p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{site.bestFor}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          {formatEmbodimentLabel(site.sampleRobotProfile?.embodimentType)}
                        </span>
                        {hasPublicDemo(site) ? (
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                            Public demo
                          </span>
                        ) : null}
                        {isHostedReady(site) ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                            Hosted path documented
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Commercial status
                          </p>
                          <p className="mt-1 text-sm text-slate-800">{commercialStatus.label}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Proof
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {getSiteWorldPublicProofSummary(site)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {site.packages.map((pkg) => (
                          <a
                            key={pkg.name}
                            href={pkg.actionHref}
                            className={
                              pkg.name === "Hosted Evaluation"
                                ? "inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                                : "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                            }
                          >
                            {pkg.actionLabel}
                          </a>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-12 rounded-[2rem] border border-black/10 bg-slate-950 px-6 py-10 text-white">
            <SectionLabel>Access</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-white">
              Need a specific site?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
              Open a scoped access request.
            </p>
            <div className="mt-7">
              <a
                href="/contact?persona=robot-team&interest=evaluation-package"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Request Access
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
