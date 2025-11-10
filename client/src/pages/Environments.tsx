import { useEffect, useMemo, useState } from "react";
import { SceneCard } from "@/components/site/SceneCard";
import { environmentCategories, scenes } from "@/data/content";

const badgeFilters = ["Indoor", "Industrial", "Retail", "Home"];

const sortOptions = [
  { label: "Most requested", value: "most-requested" },
  { label: "Industrial", value: "industrial" },
  { label: "Household", value: "household" },
  { label: "Newest", value: "newest" },
];

export default function Environments() {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<string>("most-requested");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const category = params.get("category");
      if (category) {
        setCategoryFilter(category);
      }
    }
  }, []);

  const filteredScenes = useMemo(() => {
    let result = scenes.slice();

    if (categoryFilter) {
      result = result.filter((scene) =>
        scene.categories.includes(categoryFilter),
      );
    }

    if (badgeFilter) {
      result = result.filter((scene) => scene.tags.includes(badgeFilter));
    }

    switch (sortOption) {
      case "industrial":
        result = result.filter((scene) => scene.tags.includes("Industrial"));
        break;
      case "household":
        result = result.filter((scene) => scene.tags.includes("Home"));
        break;
      case "newest":
        result = result
          .slice()
          .reverse();
        break;
      default:
        break;
    }

    return result;
  }, [badgeFilter, categoryFilter, sortOption]);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Environment catalog
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Browse ready-to-train scenes.
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Every environment below includes articulated joints, physics-clean colliders, and Isaac validation notes. Filter by environment type, interaction coverage, or deployment focus.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`rounded-full border px-4 py-2 text-sm transition ${
            badgeFilter === null && !categoryFilter
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
          onClick={() => {
            setBadgeFilter(null);
            setCategoryFilter(null);
          }}
        >
          All environments
        </button>
        {environmentCategories.map((category) => (
          <button
            key={category.slug}
            type="button"
            className={`rounded-full border px-4 py-2 text-sm transition ${
              categoryFilter === category.slug
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => setCategoryFilter(category.slug)}
          >
            {category.title}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {badgeFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
              badgeFilter === filter
                ? "border-emerald-500 bg-emerald-500 text-black"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
            onClick={() =>
              setBadgeFilter((prev) => (prev === filter ? null : filter))
            }
          >
            {filter}
          </button>
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
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {filteredScenes.map((scene) => (
          <SceneCard key={scene.slug} scene={scene} />
        ))}
      </div>

      {filteredScenes.length === 0 ? (
        <p className="text-sm text-slate-500">
          No scenes found. Adjust your filters to explore more environments.
        </p>
      ) : null}
    </div>
  );
}
