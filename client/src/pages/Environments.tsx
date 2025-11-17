import { useMemo, useState } from "react";

import {
  environmentPolicies,
  syntheticDatasets,
} from "@/data/content";

const sortOptions = [
  { label: "Newest drops", value: "newest" },
  { label: "Price: Low → High", value: "price-asc" },
  { label: "Price: High → Low", value: "price-desc" },
  { label: "Scene count", value: "scene-desc" },
];

const locationOptions = Array.from(
  new Set(syntheticDatasets.map((dataset) => dataset.locationType)),
).sort();

const objectOptions = Array.from(
  new Set(syntheticDatasets.flatMap((dataset) => dataset.objectTags)),
).sort();

const policyFilters = environmentPolicies.map((policy) => ({
  label: policy.title,
  value: policy.slug,
}));

const newestRelease = syntheticDatasets.reduce<string | null>((latest, dataset) => {
  if (!latest) {
    return dataset.releaseDate;
  }
  return new Date(dataset.releaseDate) > new Date(latest)
    ? dataset.releaseDate
    : latest;
}, null);

const totalScenes = syntheticDatasets.reduce(
  (sum, dataset) => sum + dataset.sceneCount,
  0,
);

export default function Environments() {
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [policyFilter, setPolicyFilter] = useState<string | null>(null);
  const [objectFiltersSelection, setObjectFiltersSelection] = useState<string[]>([]);
  const [variantOnly, setVariantOnly] = useState(false);
  const [sortOption, setSortOption] = useState<string>("newest");

  const filteredDatasets = useMemo(() => {
    let result = syntheticDatasets.slice();

    if (locationFilter) {
      result = result.filter((dataset) => dataset.locationType === locationFilter);
    }

    if (policyFilter) {
      result = result.filter((dataset) =>
        dataset.policySlugs.includes(policyFilter),
      );
    }

    if (variantOnly) {
      result = result.filter((dataset) => dataset.variantCount > 0);
    }

    if (objectFiltersSelection.length > 0) {
      result = result.filter((dataset) =>
        objectFiltersSelection.every((objectTag) =>
          dataset.objectTags.includes(objectTag),
        ),
      );
    }

    switch (sortOption) {
      case "price-asc":
        result.sort((a, b) => a.pricePerScene - b.pricePerScene);
        break;
      case "price-desc":
        result.sort((a, b) => b.pricePerScene - a.pricePerScene);
        break;
      case "scene-desc":
        result.sort((a, b) => b.sceneCount - a.sceneCount);
        break;
      case "newest":
      default:
        result.sort(
          (a, b) =>
            new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime(),
        );
        break;
    }

    return result;
  }, [locationFilter, objectFiltersSelection, policyFilter, sortOption, variantOnly]);

  const handleObjectToggle = (objectTag: string) => {
    setObjectFiltersSelection((prev) =>
      prev.includes(objectTag)
        ? prev.filter((tag) => tag !== objectTag)
        : [...prev, objectTag],
    );
  };

  const getPolicyTitle = (slug: string) =>
    environmentPolicies.find((policy) => policy.slug === slug)?.title ?? slug;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-6">
        <div className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
          Synthetic marketplace
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            Plug-and-play SimReady datasets.
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Daily drops of synthetic scenes authored for Isaac-ready training. Filter by
            policy coverage, the objects you care about, and the facility type your robots
            deploy into. Each dataset includes randomizer scripts, USD packages, and
            validation notes so you can train without touching the pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span>{syntheticDatasets.length} dataset families live</span>
          <span>•</span>
          <span>{totalScenes.toLocaleString()} scenes across the catalog</span>
          {newestRelease ? (
            <>
              <span>•</span>
              <span>Latest drop {new Date(newestRelease).toLocaleDateString()}</span>
            </>
          ) : null}
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm transition ${
              locationFilter === null
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => setLocationFilter(null)}
          >
            All locations
          </button>
          {locationOptions.map((location) => (
            <button
              key={location}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm transition ${
                locationFilter === location
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              onClick={() => setLocationFilter(location)}
            >
              {location}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm transition ${
              policyFilter === null
                ? "border-emerald-500 bg-emerald-500 text-black"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => setPolicyFilter(null)}
          >
            All policies
          </button>
          {policyFilters.map((policy) => (
            <button
              key={policy.value}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm transition ${
                policyFilter === policy.value
                  ? "border-emerald-500 bg-emerald-500 text-black"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              onClick={() =>
                setPolicyFilter((prev) => (prev === policy.value ? null : policy.value))
              }
            >
              {policy.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {objectOptions.map((objectTag) => (
            <label
              key={objectTag}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                objectFiltersSelection.includes(objectTag)
                  ? "border-slate-900 bg-slate-50 text-slate-900"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={objectFiltersSelection.includes(objectTag)}
                onChange={() => handleObjectToggle(objectTag)}
              />
              {objectTag}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>Sort by</span>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`rounded-full border px-4 py-2 transition ${
                sortOption === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              onClick={() => setSortOption(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm transition ${
              variantOnly
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => setVariantOnly((prev) => !prev)}
          >
            Variants only
          </button>
        </div>
      </section>

      <section className="space-y-6">
        {filteredDatasets.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
            No datasets match those filters yet. Tell us what you need via the wishlist option on the contact form and we’ll prioritize it.
          </p>
        ) : (
          filteredDatasets.map((dataset) => (
            <article
              key={dataset.slug}
              className="grid gap-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-[minmax(0,1.1fr)_0.9fr]"
            >
              <div className="space-y-5 p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                  <span>{dataset.locationType}</span>
                  {dataset.isNew ? (
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[0.6rem] font-semibold text-white">
                      New
                    </span>
                  ) : null}
                  <span>
                    Drop {new Date(dataset.releaseDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-slate-900">{dataset.title}</h2>
                  <p className="text-sm text-slate-600">{dataset.description}</p>
                </div>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Price / scene
                    </dt>
                    <dd className="text-lg font-semibold text-slate-900">
                      ${dataset.pricePerScene.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Scenes
                    </dt>
                    <dd className="text-lg font-semibold text-slate-900">
                      {dataset.sceneCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Variants
                    </dt>
                    <dd className="text-lg font-semibold text-slate-900">
                      {dataset.variantCount}
                    </dd>
                  </div>
                </dl>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Randomizer scripts
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                    {dataset.randomizerScripts.map((script) => (
                      <span
                        key={script}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600"
                      >
                        {script}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Policy coverage
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                    {dataset.policySlugs.map((slug) => (
                      <span
                        key={slug}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
                      >
                        {getPolicyTitle(slug)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Deliverables
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                    {dataset.deliverables.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-200 px-3 py-1"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative min-h-[280px] overflow-hidden border-t border-slate-200 md:border-t-0">
                <img
                  src={dataset.heroImage}
                  alt={dataset.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end gap-4 p-6 text-white">
                  <div className="space-y-1 text-sm">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                      Plug & play
                    </p>
                    <p>
                      Variants + scripted randomizers ship with USD so your lab doesn’t have to
                      touch the pipeline.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {dataset.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/15 px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <a
                      href={`/contact?dataset=${dataset.slug}`}
                      className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      Request access
                    </a>
                    <span className="text-xs text-white/70">
                      Include this slug in your note for prioritized delivery.
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
