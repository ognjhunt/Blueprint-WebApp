import { useMemo, useState } from "react";
import { sceneRecipes, environmentPolicies } from "@/data/content";
import {
  Search,
  Filter,
  Layers,
  Package,
  Wand2,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";

const packOptions = Array.from(
  new Set(sceneRecipes.flatMap((recipe) => recipe.requiredPacks)),
).sort();

const policyOptions = environmentPolicies.map((policy) => ({
  value: policy.slug,
  label: policy.title,
  focus: policy.focus,
}));

export default function Recipes() {
  const [policyFilter, setPolicyFilter] = useState<string | null>(null);
  const [packFilter, setPackFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sceneRecipes.filter((recipe) => {
      const matchesPolicy = policyFilter
        ? recipe.policySlugs.includes(policyFilter)
        : true;
      const matchesPack = packFilter
        ? recipe.requiredPacks.includes(packFilter)
        : true;
      const matchesQuery = query
        ? [
            recipe.title,
            recipe.description,
            recipe.locationType,
            recipe.requiredPacks.join(" "),
            recipe.tags.join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;

      return matchesPolicy && matchesPack && matchesQuery;
    });
  }, [packFilter, policyFilter, searchQuery]);

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden border-b border-zinc-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:py-20">
          <div className="space-y-6 lg:w-2/3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.3em] text-indigo-600 shadow-sm ring-1 ring-indigo-100">
              <Layers className="h-3 w-3" /> Scene Recipes
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
              Lightweight USD "recipes" that assemble SimReady packs.
            </h1>
            <p className="text-lg leading-relaxed text-zinc-600">
              Browse base layouts that ship as <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-semibold text-zinc-800">.usda</code> layers, dependency manifests, and Omniverse Replicator randomizers. Labs install NVIDIA SimReady packs locally—we only deliver the recipe, semantics, and QA harness.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-zinc-700">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-200">
                <Package className="h-4 w-4 text-emerald-600" /> BYO SimReady asset packs
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-200">
                <Wand2 className="h-4 w-4 text-indigo-600" /> Variant generator included
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-200">
                <BadgeCheck className="h-4 w-4 text-amber-600" /> Semantics + USDPhysics defaults
              </span>
            </div>
          </div>
          <div className="lg:w-1/3">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Starter pricing
              </h3>
              <p className="mt-3 text-2xl font-bold text-zinc-900">$110–$400</p>
              <p className="text-sm text-zinc-600">Per base layout depending on complexity, articulation, and QA depth.</p>
              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                <p>Includes:</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>.usda interface layer (references your packs)</li>
                  <li>Dependency manifest (JSON/YAML)</li>
                  <li>Replicator randomizer (USD optional writes)</li>
                </ul>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <a
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  href="/contact?request=recipe"
                >
                  Request a recipe
                </a>
                <a
                  className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-indigo-700"
                  href="https://docs.omniverse.nvidia.com/usd/latest/usd_content_samples/downloadable_packs.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  NVIDIA SimReady packs <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-12 sm:px-6">
        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="search"
              placeholder="Search by layout, policy, or pack"
              className="w-full bg-transparent text-sm outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <Filter className="h-4 w-4 text-zinc-500" />
              <select
                className="bg-transparent text-sm outline-none"
                value={policyFilter ?? ""}
                onChange={(e) =>
                  setPolicyFilter(e.target.value ? e.target.value : null)
                }
              >
                <option value="">All policies</option>
                {policyOptions.map((policy) => (
                  <option key={policy.value} value={policy.value}>
                    {policy.label} ({policy.focus})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <Filter className="h-4 w-4 text-zinc-500" />
              <select
                className="bg-transparent text-sm outline-none"
                value={packFilter ?? ""}
                onChange={(e) => setPackFilter(e.target.value || null)}
              >
                <option value="">All SimReady packs</option>
                {packOptions.map((pack) => (
                  <option key={pack} value={pack}>
                    {pack}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            {filteredRecipes.length} recipes
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {filteredRecipes.map((recipe) => {
            const alignedPolicies = environmentPolicies.filter((policy) =>
              recipe.policySlugs.includes(policy.slug),
            );

            return (
              <article
                key={recipe.slug}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={recipe.heroImage}
                    alt={recipe.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
                    {recipe.locationType}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
                    Scene Recipe
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
                      {recipe.priceRange}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-zinc-900">{recipe.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-600">
                      {recipe.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recipe.requiredPacks.map((pack) => (
                      <span
                        key={pack}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"
                      >
                        <Package className="h-3.5 w-3.5" /> {pack}
                      </span>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
                        Deliverables
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                        {recipe.deliverables.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
                        Variant knobs
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                        {recipe.variantCoverage.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
                      Aligned policies
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {alignedPolicies.map((policy) => (
                        <span
                          key={policy.slug}
                          className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100"
                        >
                          <Layers className="h-3.5 w-3.5" /> {policy.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
                    <a
                      href={`/contact?request=recipe&recipe=${recipe.slug}`}
                      className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      Request this recipe
                    </a>
                    <a
                      href="/contact?request=recipe"
                      className="text-sm font-semibold text-zinc-900 underline-offset-4 hover:text-indigo-700 hover:underline"
                    >
                      Ask about custom variants →
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
