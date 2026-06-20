import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
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
  "Request-gated": "border-[#c7a775]/50 bg-[#fff7e3] text-[#624313]",
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
    site.evidenceLine,
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
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 w-full border border-black/10 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900"
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
    <span className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function SiteCard({ site }: { site: SiteLibrarySite }) {
  const publication = site.robotEvalPublication;
  return (
    <article className="grid overflow-hidden border border-black/10 bg-white shadow-[0_22px_70px_-56px_rgba(15,23,42,0.45)]">
      <a href={`/sites/${site.slug}`} className="block overflow-hidden bg-slate-100">
        <img
          src={site.thumbnailSrc}
          alt={site.thumbnailAlt}
          className="aspect-[16/10] w-full object-cover transition duration-300 hover:scale-[1.02]"
          loading="lazy"
        />
      </a>
      <div className="flex min-h-full flex-col p-5">
        <div className="flex flex-wrap gap-2">
          <Badge label={site.readiness} className={readinessTone[site.readiness]} />
          <Badge label={site.access} className={accessTone[site.access]} />
        </div>

        <p className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          {site.siteType} · {site.locationLabel}
        </p>
        <h3 className="mt-2 text-[1.55rem] font-semibold leading-[1.05] tracking-[-0.02em] text-slate-950">
          <a href={`/sites/${site.slug}`} className="transition hover:text-slate-700">
            {site.name}
          </a>
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {site.summary}
        </p>

        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Task packs
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {site.taskPacks.map((task) => (
              <span key={task} className="border border-black/10 bg-[#f8f6f1] px-2.5 py-1 text-xs font-semibold text-slate-700">
                {task}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-px bg-black/10 text-sm sm:grid-cols-2">
          <div className="bg-[#f8f6f1] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Scenarios
            </p>
            <p className="mt-1 font-semibold text-slate-950">
              {site.scenarioCount.toLocaleString()} ready
            </p>
          </div>
          <div className="bg-[#f8f6f1] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Evidence
            </p>
            <p className="mt-1 font-semibold text-slate-950">
              {site.evidenceLine}
            </p>
          </div>
        </div>

        {publication ? (
          <div className="mt-4">
            <div className="grid gap-px bg-black/10 text-sm sm:grid-cols-2">
              {(site.pipelineManifestStatuses || []).map((item) => (
                <div key={item.lane} className="bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {item.summary}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {item.status.replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Retry/failure summaries are advisory and stay scoped to the referenced
              simulator/package artifacts.
            </p>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
          <a
            href={`/sites/${site.slug}`}
            className="inline-flex min-h-11 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View site
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          <a
            href={`/sites/${site.slug}#simulator-evaluation`}
            className="inline-flex min-h-11 items-center justify-center border border-black/10 px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Run simulator evaluation
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
        title="Captured Site Library for Robot Evaluation | Blueprint"
        description="Browse captured sites and Task Packs available for robot-team evaluation requests."
        canonical="/sites"
        image="/generated/editorial/grocery-fulfillment.png"
        jsonLd={[
          webPageJsonLd({
            path: "/sites",
            name: "Blueprint Site Library",
            description:
              "Captured-site library for robot teams to browse site types, task packs, readiness, access status, and request Policy Evaluation Runs.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Sites", path: "/sites" },
          ]),
        ]}
      />

      <div className="bg-[#f5f1e8] text-slate-950">
        <section className="border-b border-black/10 bg-[#0d0d0b] text-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c7a775]">
                Site Library
              </p>
              <h1 className="mt-4 max-w-[13ch] text-[3.15rem] font-semibold leading-[0.94] tracking-[-0.04em] sm:text-[4.7rem]">
                Browse captured sites for robot evaluation.
              </h1>
              <p className="mt-5 max-w-[42rem] text-base leading-7 text-white/75 sm:text-lg">
                This captured-site library helps robot teams choose real-site Task Packs for a Policy Evaluation Run. Filter by site type, task, readiness, and access status.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&source=sites-hero"
                  className="inline-flex min-h-12 items-center justify-center bg-[#c7a775] px-5 text-sm font-semibold text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
                >
                  Request evaluation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={buildSubmitSiteHref("sites-hero")}
                  className="inline-flex min-h-12 items-center justify-center border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Submit site free
                </a>
              </div>
            </div>

            <div className="grid content-end gap-3">
              {[
                ["8", "mock captured-site profiles"],
                ["2,530", "sample scenarios across this library"],
                ["5", "access and readiness states"],
              ].map(([value, label]) => (
                <div key={label} className="border border-white/12 bg-white/[0.06] p-5">
                  <p className="text-3xl font-semibold tracking-[-0.03em] text-white">{value}</p>
                  <p className="mt-1 text-sm text-white/60">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="library" className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 lg:px-10">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label htmlFor="site-library-search" className="min-w-0">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Search
                </span>
                <span className="flex min-h-12 items-center gap-3 border border-black/10 bg-[#f8f6f1] px-4">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" />
                  <input
                    id="site-library-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search sites, tasks, locations, or use cases"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500"
                  />
                </span>
              </label>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-12 items-center justify-center border border-black/10 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                  <X className="ml-2 h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SelectFilter
                id="site-type-filter"
                label="Site type"
                value={siteType}
                options={siteTypeFilterOptions}
                onChange={setSiteType}
              />
              <SelectFilter
                id="task-pack-filter"
                label="Task pack"
                value={taskPack}
                options={taskPackFilterOptions}
                onChange={setTaskPack}
              />
              <SelectFilter
                id="readiness-filter"
                label="Readiness"
                value={readiness}
                options={readinessFilterOptions}
                onChange={setReadiness}
              />
              <SelectFilter
                id="access-filter"
                label="Access"
                value={access}
                options={accessFilterOptions}
                onChange={setAccess}
              />
              <SelectFilter
                id="region-filter"
                label="Region"
                value={region}
                options={regionFilterOptions}
                onChange={setRegion}
              />
            </div>

            <div className="mt-5 flex items-center gap-3 text-sm text-slate-600">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <span>
                Showing {filteredSites.length} of {siteLibrarySites.length} sites.
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {filteredSites.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredSites.map((site) => (
                <SiteCard key={site.slug} site={site} />
              ))}
            </div>
          ) : (
            <div className="border border-black/10 bg-white px-6 py-12">
              <Search className="h-7 w-7 text-slate-900" />
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                No matching sites yet.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Try removing a filter or request a new site capture.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-11 items-center justify-center border border-black/10 px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Remove filters
                </button>
                <a
                  href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=capture-access&path=new-capture&source=sites-empty"
                  className="inline-flex min-h-11 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Request new site
                </a>
              </div>
            </div>
          )}
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.36fr_0.64fr] lg:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                How site access works
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Cards show what a robot team can inspect publicly. Access, rights, files, and run scope are confirmed per site/request.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: Package,
                  title: "Browse the site",
                  body: "Compare site type, task packs, scenario count, and general region.",
                },
                {
                  icon: FileText,
                  title: "Request a run",
                  body: "Send the site, task, robot profile, and threshold context for review.",
                },
                {
                  icon: CheckCircle2,
                  title: "Confirm scope",
                  body: "Blueprint confirms access posture, evidence, and Policy Evaluation Run boundaries.",
                },
              ].map((item) => (
                <div key={item.title} className="border border-black/10 bg-[#f8f6f1] p-5">
                  <item.icon className="h-5 w-5 text-slate-950" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-10">
          <div className="grid gap-6 border border-black/10 bg-[#0d0d0b] p-6 text-white lg:grid-cols-[0.44fr_0.56fr] lg:p-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7a775]">
                Evidence boundary
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                Public cards are browseable. Run proof is request-specific.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-7 text-white/72">
              <p>
                Site cards can show mock library shape, capture summaries, scenario counts, and access posture. They do not claim a robot passed, safety was validated, rights are cleared, or hosted fulfillment is already open.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/proof"
                  className="inline-flex min-h-11 items-center justify-center border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  See proof details
                </a>
                <a
                  href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&source=sites-bottom"
                  className="inline-flex min-h-11 items-center justify-center bg-[#c7a775] px-4 text-sm font-semibold text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
                >
                  Request evaluation
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
