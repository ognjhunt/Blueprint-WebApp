import { useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import {
  accessFilterOptions,
  buildSubmitSiteHref,
  readinessFilterOptions,
  regionFilterOptions,
  siteLibrarySites,
  siteTypeFilterOptions,
  taskPackFilterOptions,
  type AccessStatus,
  type ReadinessStatus,
  type SiteLibrarySite,
  type SiteRegion,
  type SiteType,
  type TaskPack,
} from "@/data/siteLibrary";

type SiteTypeFilter = (typeof siteTypeFilterOptions)[number];
type TaskPackFilter = (typeof taskPackFilterOptions)[number];
type ReadinessFilter = (typeof readinessFilterOptions)[number];
type AccessFilter = (typeof accessFilterOptions)[number];
type RegionFilter = (typeof regionFilterOptions)[number];

const readinessTone: Record<ReadinessStatus, string> = {
  "Ready to evaluate": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Capture complete": "border-blue-200 bg-blue-50 text-blue-900",
  "Needs review": "border-amber-200 bg-amber-50 text-amber-950",
  "Coming soon": "border-slate-200 bg-slate-100 text-slate-700",
};

const accessTone: Record<AccessStatus, string> = {
  "Open sample": "border-emerald-200 bg-white text-emerald-900",
  "Request-gated": "border-amber-200 bg-amber-50 text-amber-950",
  "Private / NDA": "border-slate-300 bg-slate-100 text-slate-800",
  "Operator approval required": "border-amber-200 bg-amber-50 text-amber-950",
};

function matchesSearch(site: SiteLibrarySite, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    site.name,
    site.siteType,
    site.locationLabel,
    site.region,
    site.readiness,
    site.access,
    site.summary,
    ...site.taskPacks,
    ...site.taskPackNotes,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function SelectFilter<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label htmlFor={id} className="min-w-0">
      <span className="mb-2 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-600"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function SiteCard({ site }: { site: SiteLibrarySite }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <a href={`/sites/${site.slug}`} className="block overflow-hidden bg-slate-100">
        <img
          src={site.thumbnailSrc}
          alt={site.thumbnailAlt}
          className="aspect-[16/10] w-full object-cover transition duration-300 hover:scale-[1.02]"
          loading="lazy"
        />
      </a>
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          <Badge label={site.readiness} className={readinessTone[site.readiness]} />
          <Badge label={site.access} className={accessTone[site.access]} />
        </div>
        <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-normal">
          <a href={`/sites/${site.slug}`} className="hover:text-blue-700">
            {site.name}
          </a>
        </h2>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          {site.siteType} · {site.locationLabel}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {site.taskPacks.slice(0, 3).map((task) => (
            <span key={task} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              {task}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a
            href={`/sites/${site.slug}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            View site
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href={`/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=${encodeURIComponent(site.name)}&source=sites-card`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-950 hover:bg-slate-50"
          >
            Use task pack
          </a>
        </div>
      </div>
    </article>
  );
}

export default function Sites() {
  const [query, setQuery] = useState("");
  const [siteType, setSiteType] = useState<SiteTypeFilter>("All");
  const [taskPack, setTaskPack] = useState<TaskPackFilter>("All");
  const [readiness, setReadiness] = useState<ReadinessFilter>("All");
  const [access, setAccess] = useState<AccessFilter>("All");
  const [region, setRegion] = useState<RegionFilter>("All");

  const filteredSites = useMemo(
    () =>
      siteLibrarySites.filter((site) => {
        const matchesSiteType = siteType === "All" || site.siteType === (siteType as SiteType);
        const matchesTaskPack =
          taskPack === "All" || site.taskPacks.some((task) => task === (taskPack as TaskPack));
        const matchesReadiness =
          readiness === "All" || site.readiness === (readiness as ReadinessStatus);
        const matchesAccess = access === "All" || site.access === (access as AccessStatus);
        const matchesRegion = region === "All" || site.region === (region as SiteRegion);
        return (
          matchesSiteType &&
          matchesTaskPack &&
          matchesReadiness &&
          matchesAccess &&
          matchesRegion &&
          matchesSearch(site, query)
        );
      }),
    [access, query, readiness, region, siteType, taskPack],
  );

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (siteType === "All" ? 0 : 1) +
    (taskPack === "All" ? 0 : 1) +
    (readiness === "All" ? 0 : 1) +
    (access === "All" ? 0 : 1) +
    (region === "All" ? 0 : 1);

  const clearFilters = () => {
    setQuery("");
    setSiteType("All");
    setTaskPack("All");
    setReadiness("All");
    setAccess("All");
    setRegion("All");
  };

  return (
    <>
      <SEO
        title="Captured Sites | Blueprint"
        description="Browse captured task packs that robot teams can use for Policy Evaluation Runs."
        canonical="/sites"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.hero}`}
        jsonLd={[
          webPageJsonLd({
            path: "/sites",
            name: "Blueprint Site Library",
            description:
              "Captured places and task packs for robot policy evaluation requests.",
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
              <h1 className="max-w-[10ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                Pick a captured place.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Every policy runs the same task here.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=sites-hero"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Start
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={buildSubmitSiteHref("sites-hero")}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  Submit site
                </a>
              </div>
            </div>
            <img
              src={wamPolicyEvalAssets.hero}
              alt="Realistic humanoid robot working in a captured facility task"
              className="aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section id="library" className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-[88rem] px-5 py-6 md:px-8">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label htmlFor="site-library-search" className="min-w-0">
                <span className="mb-2 block text-xs font-semibold text-slate-500">
                  Search
                </span>
                <span className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" />
                  <input
                    id="site-library-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search sites or tasks"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500"
                  />
                </span>
              </label>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Clear
                  <X className="ml-2 h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SelectFilter id="site-type-filter" label="Place" value={siteType} options={siteTypeFilterOptions} onChange={setSiteType} />
              <SelectFilter id="task-pack-filter" label="Task" value={taskPack} options={taskPackFilterOptions} onChange={setTaskPack} />
              <SelectFilter id="readiness-filter" label="Ready" value={readiness} options={readinessFilterOptions} onChange={setReadiness} />
              <SelectFilter id="access-filter" label="Access" value={access} options={accessFilterOptions} onChange={setAccess} />
              <SelectFilter id="region-filter" label="Region" value={region} options={regionFilterOptions} onChange={setRegion} />
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-600">
              Showing {filteredSites.length} of {siteLibrarySites.length} sites.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-8 md:px-8 md:py-10">
          {filteredSites.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredSites.map((site) => (
                <SiteCard key={site.slug} site={site} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-12">
              <h2 className="text-3xl font-semibold tracking-normal">
                No matching sites yet.
              </h2>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                >
                  Remove filters
                </button>
                <a
                  href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=capture-access&path=new-capture&source=sites-empty"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Request new site
                </a>
              </div>
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto max-w-[88rem] px-5 py-8 md:px-8">
            <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-300">
              Site pages help choose a task pack. Run proof is request-specific
              and does not approve deployment or safety.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
