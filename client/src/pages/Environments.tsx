import { useEffect, useMemo, useState } from "react";
import { PolicyCard } from "@/components/site/PolicyCard";
import { environmentCategories, policies } from "@/data/content";

const badgeFilters = ["Indoor", "Industrial", "Retail", "Home"];

export default function Environments() {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [policyFilter, setPolicyFilter] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const category = params.get("category");
      const policy = params.get("policy");
      if (category) {
        setCategoryFilter(category);
      }
      if (policy) {
        setPolicyFilter(policy);
      }
    }
  }, []);

  const filteredCategories = useMemo(() => {
    let result = environmentCategories.slice();

    if (categoryFilter) {
      result = result.filter((category) => category.slug === categoryFilter);
    }

    if (badgeFilter) {
      result = result.filter((category) => category.tags.includes(badgeFilter));
    }

    if (policyFilter) {
      result = result.filter((category) =>
        policies.some(
          (policy) => policy.slug === policyFilter && policy.environments.includes(category.slug),
        ),
      );
    }

    return result;
  }, [badgeFilter, categoryFilter, policyFilter]);

  const policyOptions = useMemo(
    () =>
      policies.map((policy) => ({
        label: policy.title,
        value: policy.slug,
      })),
    [],
  );

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
          Every environment below includes articulated joints, physics-clean colliders, and simulation validation notes. Each
          synthetic build is patterned after a documented real-world location so dataset diversity tracks what your fleets see
          in production. Filter by environment type, policy coverage, or deployment focus to assemble the right training
          package.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`rounded-full border px-4 py-2 text-sm transition ${
            badgeFilter === null && !categoryFilter && !policyFilter
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
          onClick={() => {
            setBadgeFilter(null);
            setCategoryFilter(null);
            setPolicyFilter(null);
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
            onClick={() =>
              setCategoryFilter((prev) => (prev === category.slug ? null : category.slug))
            }
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
        <span>Filter by policy</span>
        {policyOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-full border px-4 py-2 transition ${
              policyFilter === option.value
                ? "border-emerald-500 bg-emerald-500 text-black"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            onClick={() =>
              setPolicyFilter((prev) => (prev === option.value ? null : option.value))
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {filteredCategories.map((category) => {
          const categoryPolicies = policies.filter(
            (policy) =>
              policy.environments.includes(category.slug) &&
              (!policyFilter || policy.slug === policyFilter),
          );

          if (policyFilter && categoryPolicies.length === 0) {
            return null;
          }

          return (
            <section
              key={category.slug}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-6 p-6 sm:p-8">
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <img
                      src={category.heroImage}
                      alt={category.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                      {category.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold text-slate-900">
                        {category.title}
                      </h2>
                      <p className="text-sm text-slate-600">{category.summary}</p>
                    </div>
                    <a
                      href={`#policy-${category.slug}`}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:text-slate-700"
                    >
                      View policies ↓
                    </a>
                  </div>
                </div>
                <div
                  id={`policy-${category.slug}`}
                  className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-l lg:border-t-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Policies in this environment
                    </h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                      {categoryPolicies.length} active
                    </span>
                  </div>
                  {categoryPolicies.length ? (
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {categoryPolicies.map((policy) => (
                        <PolicyCard
                          key={policy.slug}
                          policy={policy}
                          isHighlighted={policyFilter === policy.slug}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-slate-500">
                      No policies currently mapped. Adjust your filters to explore related playbooks.
                    </p>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {filteredCategories.length === 0 ? (
        <p className="text-sm text-slate-500">
          No environments match the current filters. Adjust your selection to explore more options.
        </p>
      ) : null}
    </div>
  );
}
