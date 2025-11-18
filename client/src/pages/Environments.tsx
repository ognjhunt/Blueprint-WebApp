// import { useMemo, useState } from "react";

// import {
//   environmentPolicies,
//   syntheticDatasets,
// } from "@/data/content";

// const sortOptions = [
//   { label: "Newest drops", value: "newest" },
//   { label: "Price: Low → High", value: "price-asc" },
//   { label: "Price: High → Low", value: "price-desc" },
//   { label: "Scene count", value: "scene-desc" },
// ];

// const locationOptions = Array.from(
//   new Set(syntheticDatasets.map((dataset) => dataset.locationType)),
// ).sort();

// const objectOptions = Array.from(
//   new Set(syntheticDatasets.flatMap((dataset) => dataset.objectTags)),
// ).sort();

// const policyFilters = environmentPolicies.map((policy) => ({
//   label: policy.title,
//   value: policy.slug,
// }));

// const newestRelease = syntheticDatasets.reduce<string | null>((latest, dataset) => {
//   if (!latest) {
//     return dataset.releaseDate;
//   }
//   return new Date(dataset.releaseDate) > new Date(latest)
//     ? dataset.releaseDate
//     : latest;
// }, null);

// const totalScenes = syntheticDatasets.reduce(
//   (sum, dataset) => sum + dataset.sceneCount,
//   0,
// );

// export default function Environments() {
//   const [locationFilter, setLocationFilter] = useState<string | null>(null);
//   const [policyFilter, setPolicyFilter] = useState<string | null>(null);
//   const [objectFiltersSelection, setObjectFiltersSelection] = useState<string[]>([]);
//   const [variantOnly, setVariantOnly] = useState(false);
//   const [sortOption, setSortOption] = useState<string>("newest");
//   const [searchQuery, setSearchQuery] = useState("");

//   const filteredDatasets = useMemo(() => {
//     let result = syntheticDatasets.slice();

//     if (locationFilter) {
//       result = result.filter((dataset) => dataset.locationType === locationFilter);
//     }

//     if (policyFilter) {
//       result = result.filter((dataset) =>
//         dataset.policySlugs.includes(policyFilter),
//       );
//     }

//     if (variantOnly) {
//       result = result.filter((dataset) => dataset.variantCount > 0);
//     }

//     if (objectFiltersSelection.length > 0) {
//       result = result.filter((dataset) =>
//         objectFiltersSelection.every((objectTag) =>
//           dataset.objectTags.includes(objectTag),
//         ),
//       );
//     }

//     const normalizedSearchQuery = searchQuery.trim().toLowerCase();

//     if (normalizedSearchQuery) {
//       result = result.filter((dataset) => {
//         const searchableString = [
//           dataset.title,
//           dataset.description,
//           dataset.locationType,
//           dataset.objectTags.join(" "),
//           dataset.policySlugs.join(" "),
//         ]
//           .join(" ")
//           .toLowerCase();

//         return searchableString.includes(normalizedSearchQuery);
//       });
//     }

//     switch (sortOption) {
//       case "price-asc":
//         result.sort((a, b) => a.pricePerScene - b.pricePerScene);
//         break;
//       case "price-desc":
//         result.sort((a, b) => b.pricePerScene - a.pricePerScene);
//         break;
//       case "scene-desc":
//         result.sort((a, b) => b.sceneCount - a.sceneCount);
//         break;
//       case "newest":
//       default:
//         result.sort(
//           (a, b) =>
//             new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime(),
//         );
//         break;
//     }

//     return result;
//   }, [
//     locationFilter,
//     objectFiltersSelection,
//     policyFilter,
//     sortOption,
//     variantOnly,
//     searchQuery,
//   ]);

//   const handleObjectToggle = (objectTag: string) => {
//     setObjectFiltersSelection((prev) =>
//       prev.includes(objectTag)
//         ? prev.filter((tag) => tag !== objectTag)
//         : [...prev, objectTag],
//     );
//   };

//   const getPolicyTitle = (slug: string) =>
//     environmentPolicies.find((policy) => policy.slug === slug)?.title ?? slug;

//   return (
//     <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
//       <header className="space-y-6">
//         <div className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
//           Synthetic marketplace
//         </div>
//         <div className="space-y-4">
//           <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
//             Plug-and-play SimReady datasets.
//           </h1>
//           <p className="max-w-3xl text-sm text-slate-600">
//             Daily drops of synthetic scenes authored for Isaac-ready training. Filter by
//             policy coverage, the objects you care about, and the facility type your robots
//             deploy into. Each dataset includes randomizer scripts, USD packages, and
//             validation notes so you can train without touching the pipeline.
//           </p>
//         </div>
//         <div className="flex flex-wrap gap-4 text-sm text-slate-600">
//           <span>{syntheticDatasets.length} dataset families live</span>
//           <span>•</span>
//           <span>{totalScenes.toLocaleString()} scenes across the catalog</span>
//           {newestRelease ? (
//             <>
//               <span>•</span>
//               <span>Latest drop {new Date(newestRelease).toLocaleDateString()}</span>
//             </>
//           ) : null}
//         </div>
//       </header>

//       <section className="space-y-6 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
//         <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
//           <div className="w-full md:max-w-md">
//             <label
//               htmlFor="dataset-search"
//               className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
//             >
//               Search catalog
//             </label>
//             <div className="relative mt-2">
//               <svg
//                 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 aria-hidden="true"
//               >
//                 <circle cx="11" cy="11" r="8" />
//                 <path d="m21 21-4.3-4.3" />
//               </svg>
//               <input
//                 id="dataset-search"
//                 type="search"
//                 value={searchQuery}
//                 onChange={(event) => setSearchQuery(event.target.value)}
//                 placeholder="Search by name, policy, or object"
//                 className="w-full rounded-2xl border border-slate-200 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
//               />
//             </div>
//           </div>
//           <p className="text-sm text-slate-500">
//             Showing {filteredDatasets.length} of {syntheticDatasets.length} datasets
//           </p>
//         </div>

//         <div className="grid gap-5 lg:grid-cols-3">
//           <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
//             <div className="space-y-1">
//               <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Facility</p>
//               <p className="text-sm text-slate-600">Pick the deployment environment</p>
//             </div>
//             <div className="flex flex-wrap gap-2">
//               <button
//                 type="button"
//                 className={`rounded-full border px-4 py-2 text-sm transition ${
//                   locationFilter === null
//                     ? "border-slate-900 bg-slate-900 text-white"
//                     : "border-transparent bg-white text-slate-600 hover:border-slate-200"
//                 }`}
//                 onClick={() => setLocationFilter(null)}
//               >
//                 All locations
//               </button>
//               {locationOptions.map((location) => (
//                 <button
//                   key={location}
//                   type="button"
//                   className={`rounded-full border px-4 py-2 text-sm transition ${
//                     locationFilter === location
//                       ? "border-slate-900 bg-slate-900 text-white"
//                       : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300"
//                   }`}
//                   onClick={() => setLocationFilter(location)}
//                 >
//                   {location}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
//             <div className="space-y-1">
//               <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Policy</p>
//               <p className="text-sm text-emerald-800">Highlight available coverage</p>
//             </div>
//             <div className="flex flex-wrap gap-2">
//               <button
//                 type="button"
//                 className={`rounded-full border px-4 py-2 text-sm transition ${
//                   policyFilter === null
//                     ? "border-emerald-600 bg-emerald-600 text-white"
//                     : "border-transparent bg-white/70 text-emerald-800 hover:border-emerald-200"
//                 }`}
//                 onClick={() => setPolicyFilter(null)}
//               >
//                 All policies
//               </button>
//               {policyFilters.map((policy) => (
//                 <button
//                   key={policy.value}
//                   type="button"
//                   className={`rounded-full border px-4 py-2 text-sm transition ${
//                     policyFilter === policy.value
//                       ? "border-emerald-600 bg-emerald-600 text-white"
//                       : "border-emerald-200 bg-white/80 text-emerald-800 hover:border-emerald-300"
//                   }`}
//                   onClick={() =>
//                     setPolicyFilter((prev) => (prev === policy.value ? null : policy.value))
//                   }
//                 >
//                   {policy.label}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="space-y-3 rounded-2xl border border-slate-900/10 bg-slate-900/5 p-4">
//             <div className="space-y-1">
//               <p className="text-xs uppercase tracking-[0.3em] text-slate-700">Objects</p>
//               <p className="text-sm text-slate-600">Stack object tags you care about</p>
//             </div>
//             <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
//               {objectOptions.map((objectTag) => (
//                 <label
//                   key={objectTag}
//                   className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.25em] transition ${
//                     objectFiltersSelection.includes(objectTag)
//                       ? "border-slate-900 bg-white text-slate-900 shadow-sm"
//                       : "border-transparent bg-white/70 text-slate-500 hover:border-slate-300"
//                   }`}
//                 >
//                   <input
//                     type="checkbox"
//                     className="sr-only"
//                     checked={objectFiltersSelection.includes(objectTag)}
//                     onChange={() => handleObjectToggle(objectTag)}
//                   />
//                   {objectTag}
//                 </label>
//               ))}
//             </div>
//           </div>

//           <div className="space-y-3 rounded-2xl border border-slate-100 bg-white/80 p-4 lg:col-span-3">
//             <div className="flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
//               <div>
//                 <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sort & focus</p>
//                 <p>Control presentation of the drop list.</p>
//               </div>
//               <button
//                 type="button"
//                 className={`inline-flex items-center rounded-full border px-4 py-2 text-sm transition ${
//                   variantOnly
//                     ? "border-slate-900 bg-slate-900 text-white"
//                     : "border-slate-200 text-slate-600 hover:border-slate-300"
//                 }`}
//                 onClick={() => setVariantOnly((prev) => !prev)}
//               >
//                 {variantOnly ? "Filtering variants" : "Variants only"}
//               </button>
//             </div>
//             <div className="flex flex-wrap gap-2">
//               {sortOptions.map((option) => (
//                 <button
//                   key={option.value}
//                   type="button"
//                   className={`rounded-full border px-4 py-2 text-sm transition ${
//                     sortOption === option.value
//                       ? "border-slate-900 bg-slate-900 text-white"
//                       : "border-slate-200 text-slate-600 hover:border-slate-300"
//                   }`}
//                   onClick={() => setSortOption(option.value)}
//                 >
//                   {option.label}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="space-y-6">
//         {filteredDatasets.length === 0 ? (
//           <p className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
//             No datasets match those filters yet. Tell us what you need via the wishlist option on the contact form and we’ll prioritize it.
//           </p>
//         ) : (
//           filteredDatasets.map((dataset) => (
//             <article
//               key={dataset.slug}
//               className="grid gap-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-[minmax(0,1.1fr)_0.9fr]"
//             >
//               <div className="space-y-5 p-6 md:p-8">
//                 <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
//                   <span>{dataset.locationType}</span>
//                   {dataset.isNew ? (
//                     <span className="rounded-full bg-slate-900 px-3 py-1 text-[0.6rem] font-semibold text-white">
//                       New
//                     </span>
//                   ) : null}
//                   <span>
//                     Drop {new Date(dataset.releaseDate).toLocaleDateString(undefined, {
//                       month: "short",
//                       day: "numeric",
//                     })}
//                   </span>
//                 </div>
//                 <div className="space-y-3">
//                   <h2 className="text-2xl font-semibold text-slate-900">{dataset.title}</h2>
//                   <p className="text-sm text-slate-600">{dataset.description}</p>
//                 </div>
//                 <dl className="grid gap-4 sm:grid-cols-3">
//                   <div>
//                     <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                       Price / scene
//                     </dt>
//                     <dd className="text-lg font-semibold text-slate-900">
//                       ${dataset.pricePerScene.toLocaleString()}
//                     </dd>
//                   </div>
//                   <div>
//                     <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                       Scenes
//                     </dt>
//                     <dd className="text-lg font-semibold text-slate-900">
//                       {dataset.sceneCount}
//                     </dd>
//                   </div>
//                   <div>
//                     <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                       Variants
//                     </dt>
//                     <dd className="text-lg font-semibold text-slate-900">
//                       {dataset.variantCount}
//                     </dd>
//                   </div>
//                 </dl>
//                 <div className="space-y-3">
//                   <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                     Randomizer scripts
//                   </p>
//                   <div className="flex flex-wrap gap-2 text-sm text-slate-600">
//                     {dataset.randomizerScripts.map((script) => (
//                       <span
//                         key={script}
//                         className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600"
//                       >
//                         {script}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//                 <div className="space-y-2">
//                   <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                     Policy coverage
//                   </p>
//                   <div className="flex flex-wrap gap-2 text-sm text-slate-700">
//                     {dataset.policySlugs.map((slug) => (
//                       <span
//                         key={slug}
//                         className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
//                       >
//                         {getPolicyTitle(slug)}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//                 <div className="space-y-2">
//                   <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                     Deliverables
//                   </p>
//                   <div className="flex flex-wrap gap-2 text-sm text-slate-600">
//                     {dataset.deliverables.map((item) => (
//                       <span
//                         key={item}
//                         className="rounded-full border border-slate-200 px-3 py-1"
//                       >
//                         {item}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//               <div className="relative min-h-[280px] overflow-hidden border-t border-slate-200 md:border-t-0">
//                 <img
//                   src={dataset.heroImage}
//                   alt={dataset.title}
//                   className="h-full w-full object-cover"
//                   loading="lazy"
//                 />
//                 <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
//                 <div className="absolute inset-0 flex flex-col justify-end gap-4 p-6 text-white">
//                   <div className="space-y-1 text-sm">
//                     <p className="text-xs uppercase tracking-[0.3em] text-white/70">
//                       Plug & play
//                     </p>
//                     <p>
//                       Variants + scripted randomizers ship with USD so your lab doesn’t have to
//                       touch the pipeline.
//                     </p>
//                   </div>
//                   <div className="flex flex-wrap gap-2 text-xs">
//                     {dataset.tags.map((tag) => (
//                       <span key={tag} className="rounded-full bg-white/15 px-3 py-1">
//                         {tag}
//                       </span>
//                     ))}
//                   </div>
//                   <div className="flex flex-col gap-2 text-sm">
//                     <a
//                       href={`/contact?dataset=${dataset.slug}`}
//                       className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
//                     >
//                       Request access
//                     </a>
//                     <span className="text-xs text-white/70">
//                       Include this slug in your note for prioritized delivery.
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </article>
//           ))
//         )}
//       </section>
//     </div>
//   );
// }
import { useMemo, useState } from "react";
import { environmentPolicies, syntheticDatasets } from "@/data/content";
import {
  Search,
  Filter,
  ArrowUpDown,
  MapPin,
  Box,
  Shield,
  Terminal,
  Download,
  Sparkles,
  Database,
  Calendar,
} from "lucide-react";

// --- Configuration ---

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

const newestRelease = syntheticDatasets.reduce<string | null>(
  (latest, dataset) => {
    if (!latest) {
      return dataset.releaseDate;
    }
    return new Date(dataset.releaseDate) > new Date(latest)
      ? dataset.releaseDate
      : latest;
  },
  null,
);

const totalScenes = syntheticDatasets.reduce(
  (sum, dataset) => sum + dataset.sceneCount,
  0,
);

// --- Visual Helpers ---

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern)"
      />
    </svg>
  );
}

export default function Environments() {
  // --- State ---
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [policyFilter, setPolicyFilter] = useState<string | null>(null);
  const [objectFiltersSelection, setObjectFiltersSelection] = useState<
    string[]
  >([]);
  const [variantOnly, setVariantOnly] = useState(false);
  const [sortOption, setSortOption] = useState<string>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Logic ---
  const filteredDatasets = useMemo(() => {
    let result = syntheticDatasets.slice();

    if (locationFilter) {
      result = result.filter(
        (dataset) => dataset.locationType === locationFilter,
      );
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

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    if (normalizedSearchQuery) {
      result = result.filter((dataset) => {
        const searchableString = [
          dataset.title,
          dataset.description,
          dataset.locationType,
          dataset.objectTags.join(" "),
          dataset.policySlugs.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return searchableString.includes(normalizedSearchQuery);
      });
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
            new Date(b.releaseDate).getTime() -
            new Date(a.releaseDate).getTime(),
        );
        break;
    }

    return result;
  }, [
    locationFilter,
    objectFiltersSelection,
    policyFilter,
    sortOption,
    variantOnly,
    searchQuery,
  ]);

  const handleObjectToggle = (objectTag: string) => {
    setObjectFiltersSelection((prev) =>
      prev.includes(objectTag)
        ? prev.filter((tag) => tag !== objectTag)
        : [...prev, objectTag],
    );
  };

  const getPolicyTitle = (slug: string) =>
    environmentPolicies.find((policy) => policy.slug === slug)?.title ?? slug;

  // --- Render ---
  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      <DotPattern />

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* --- Header Section --- */}
        <header className="space-y-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
              <Database className="h-3 w-3" />
              Synthetic Marketplace
            </div>

            <div className="max-w-4xl">
              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Plug-and-play{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  SimReady datasets.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-zinc-600">
                Daily drops of synthetic scenes authored for Isaac-ready
                training. Each dataset includes randomizer scripts, USD
                packages, and validation notes so you can train without touching
                the pipeline.
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-zinc-200 bg-white/50 px-6 py-4 text-sm text-zinc-600 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="font-medium text-zinc-900">
                {syntheticDatasets.length}
              </span>
              active families
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-zinc-400" />
              <span className="font-medium text-zinc-900">
                {totalScenes.toLocaleString()}
              </span>
              total scenes
            </div>
            {newestRelease && (
              <>
                <div className="h-4 w-px bg-zinc-300" />
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  Latest drop:
                  <span className="font-medium text-zinc-900">
                    {new Date(newestRelease).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </>
            )}
          </div>
        </header>

        {/* --- Control Panel (Filters) --- */}
        <section className="rounded-3xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur-xl">
          <div className="border-b border-zinc-100 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Search */}
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, policy, or object..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* Top Level Sort & Variant Toggle */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setVariantOnly(!variantOnly)}
                  className={`group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    variantOnly
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <div
                    className={`h-3 w-3 rounded-sm border transition-colors ${variantOnly ? "border-indigo-600 bg-indigo-600" : "border-zinc-400"}`}
                  >
                    {variantOnly && (
                      <svg
                        className="h-full w-full text-white"
                        viewBox="0 0 12 12"
                      >
                        <path
                          d="M3 6l2 2 4-4"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                        />
                      </svg>
                    )}
                  </div>
                  Variants Only
                </button>

                <div className="h-6 w-px bg-zinc-200 mx-1" />

                <div className="flex gap-1 rounded-lg border border-zinc-200 p-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortOption(option.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        sortOption === option.value
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-zinc-100 md:grid-cols-3 lg:grid-cols-[1.2fr_1fr_0.8fr]">
            {/* Location Filter */}
            <div className="bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                <MapPin className="h-3.5 w-3.5" />
                Archetype
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLocationFilter(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    locationFilter === null
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  All
                </button>
                {locationOptions.map((location) => (
                  <button
                    key={location}
                    onClick={() => setLocationFilter(location)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      locationFilter === location
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>

            {/* Policy Filter */}
            <div className="bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
                <Shield className="h-3.5 w-3.5" />
                Policy Target
              </div>
              <div className="flex flex-wrap gap-2">
                {policyFilters.map((policy) => (
                  <button
                    key={policy.value}
                    onClick={() =>
                      setPolicyFilter((prev) =>
                        prev === policy.value ? null : policy.value,
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      policyFilter === policy.value
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200"
                    }`}
                  >
                    {policy.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Object Filter */}
            <div className="bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                <Box className="h-3.5 w-3.5" />
                Objects
              </div>
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-200">
                {objectOptions.map((objectTag) => (
                  <button
                    key={objectTag}
                    onClick={() => handleObjectToggle(objectTag)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                      objectFiltersSelection.includes(objectTag)
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {objectTag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- Results Grid --- */}
        <section className="space-y-6">
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <p>
              Showing{" "}
              <span className="font-medium text-zinc-900">
                {filteredDatasets.length}
              </span>{" "}
              results
            </p>
          </div>

          {filteredDatasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-20 text-center">
              <div className="rounded-full bg-zinc-100 p-4 mb-4">
                <Filter className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                No datasets found
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-600">
                Try adjusting your filters or search query. Can't find what you
                need?
                <a
                  href="/contact"
                  className="ml-1 text-indigo-600 hover:underline"
                >
                  Request a custom capture.
                </a>
              </p>
            </div>
          ) : (
            <div className="grid gap-8">
              {filteredDatasets.map((dataset) => (
                <article
                  key={dataset.slug}
                  className="group relative grid overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-lg md:grid-cols-[1.2fr_0.8fr]"
                >
                  {/* Content Side */}
                  <div className="flex flex-col p-8">
                    <div className="mb-6 flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                            {dataset.locationType}
                          </span>
                          {dataset.isNew && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-200">
                              <Sparkles className="h-2.5 w-2.5" /> New
                            </span>
                          )}
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                          {dataset.title}
                        </h2>
                      </div>
                    </div>

                    <p className="mb-8 max-w-xl text-sm leading-relaxed text-zinc-600">
                      {dataset.description}
                    </p>

                    {/* Technical Specs Grid */}
                    <div className="mb-8 grid grid-cols-3 gap-px bg-zinc-100 border border-zinc-100 rounded-lg overflow-hidden">
                      <div className="bg-zinc-50 p-3 text-center">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Pricing
                        </dt>
                        <dd className="font-mono text-sm font-semibold text-zinc-900">
                          ${dataset.pricePerScene}
                          <span className="text-[10px] text-zinc-400 font-sans ml-0.5">
                            /scene
                          </span>
                        </dd>
                      </div>
                      <div className="bg-zinc-50 p-3 text-center">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Scenes
                        </dt>
                        <dd className="font-mono text-sm font-semibold text-zinc-900">
                          {dataset.sceneCount}
                        </dd>
                      </div>
                      <div className="bg-zinc-50 p-3 text-center">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Variants
                        </dt>
                        <dd className="font-mono text-sm font-semibold text-zinc-900">
                          {dataset.variantCount}
                        </dd>
                      </div>
                    </div>

                    <div className="mt-auto space-y-5">
                      {/* Policies */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          <Shield className="h-3 w-3" /> Covered Policies
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dataset.policySlugs.map((slug) => (
                            <span
                              key={slug}
                              className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                            >
                              {getPolicyTitle(slug)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Tech/Scripts */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          <Terminal className="h-3 w-3" /> Included Scripts
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 font-mono">
                          {dataset.randomizerScripts.map((script) => (
                            <span
                              key={script}
                              className="flex items-center gap-1"
                            >
                              <span className="h-1 w-1 rounded-full bg-indigo-500" />
                              {script}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Image Side */}
                  <div className="relative min-h-[320px] overflow-hidden bg-zinc-100">
                    <img
                      src={dataset.heroImage}
                      alt={dataset.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent opacity-90" />

                    {/* Overlay Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
                      <div className="space-y-6 transform transition-all duration-300 translate-y-4 group-hover:translate-y-0">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            Deliverables
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {dataset.deliverables.map((item) => (
                              <span
                                key={item}
                                className="flex items-center gap-1.5 rounded border border-white/20 bg-white/10 px-2 py-1 text-[10px] backdrop-blur-sm"
                              >
                                <Download className="h-3 w-3" />
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-white/10 pt-6">
                          <a
                            href={`/contact?dataset=${dataset.slug}`}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-zinc-900 shadow-lg transition-all hover:bg-indigo-50 hover:text-indigo-900"
                          >
                            Request Access
                            <span className="text-xs font-normal text-zinc-500 ml-1">
                              (Slug: {dataset.slug})
                            </span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
