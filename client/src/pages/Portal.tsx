import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { SEO } from "@/components/SEO";
import {
  CalendarDays,
  Clock,
  DollarSign,
  Filter,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Search,
  LayoutGrid,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileBox,
} from "lucide-react";

// --- Types & Data ---

type ScenePriority = "rush" | "urgent" | "standard";

type SceneRequest = {
  id: string;
  title: string;
  locationType: string;
  client: string;
  city: string;
  policies: string[];
  editsNeeded: string[];
  payout: number;
  estimatedTimeMinutes: number;
  deadline: string;
  priority: ScenePriority;
  thumbnail: string;
  fileFormat: string;
};

type SceneWithTiming = SceneRequest & { hoursUntilDeadline: number };

const SCENE_REQUESTS: SceneRequest[] = [
  {
    id: "SCN-001",
    title: "Tribeca Loft Kitchen",
    locationType: "Residential",
    client: "Cuisine Robotics",
    city: "New York, NY",
    policies: ["Food Prep", "Dexterous Manipulation"],
    editsNeeded: [
      "Model cabinet interiors with collision-safe shelving",
      "Add rig-ready hinges to all upper cabinets",
      "Populate countertop with randomized produce props",
      "Author lighting rig for day + evening variations",
    ],
    payout: 185,
    estimatedTimeMinutes: 110,
    deadline: "2024-12-19T19:00:00.000Z",
    priority: "rush",
    thumbnail:
      "https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=960&q=80",
    fileFormat: "Blender / GLB",
  },
  {
    id: "SCN-002",
    title: "SoMa Robotics Lab",
    locationType: "Industrial R&D",
    client: "Waypoint Systems",
    city: "San Francisco, CA",
    policies: ["Safety Perimeter", "Calibration"],
    editsNeeded: [
      "Rebuild wiring bundles with accurate cable constraints",
      "Add labelled tool shadow boards with 12 unique props",
      "Set up motion paths for dual-arm workcell calibration",
    ],
    payout: 265,
    estimatedTimeMinutes: 160,
    deadline: "2024-12-22T03:00:00.000Z",
    priority: "urgent",
    thumbnail:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=960&q=80",
    fileFormat: "Maya / USDZ",
  },
  {
    id: "SCN-003",
    title: "Boulder Gear Shop",
    locationType: "Retail Floor",
    client: "Summit Outfitters",
    city: "Boulder, CO",
    policies: ["Planogram Accuracy", "Navigation"],
    editsNeeded: [
      "Retopo shelving for accurate shelf-edge detections",
      "Author cloth simulation presets for hanging jackets",
      "Add POS counter training props (tablets, loyalty cards)",
    ],
    payout: 150,
    estimatedTimeMinutes: 95,
    deadline: "2024-12-27T17:00:00.000Z",
    priority: "standard",
    thumbnail:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=960&q=80",
    fileFormat: "Blender / FBX",
  },
  {
    id: "SCN-004",
    title: "Austin Smart Kitchen",
    locationType: "Test Facility",
    client: "Hestia Robotics",
    city: "Austin, TX",
    policies: ["Heat Safety", "Fine Motor"],
    editsNeeded: [
      "Build inside geometry for ovens + smart fridge drawers",
      "Author ingredient library with 24 manipulable items",
      "Set up collision proxies for countertops and island",
      "Bake lighting + reflection cubes for metal surfaces",
    ],
    payout: 220,
    estimatedTimeMinutes: 140,
    deadline: "2024-12-20T14:00:00.000Z",
    priority: "rush",
    thumbnail:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=960&q=80",
    fileFormat: "Unreal 5 / USD",
  },
  {
    id: "SCN-005",
    title: "Micro-Fulfillment Hub",
    locationType: "Warehouse",
    client: "Northshore Delivery",
    city: "Seattle, WA",
    policies: ["Inventory", "Forklift Safety"],
    editsNeeded: [
      "Author modular pallet variants with LODs",
      "Rig conveyor belts for runtime speed adjustments",
      "Label bulk storage with barcode and QR assets",
      "Light for overnight operations with baked GI",
    ],
    payout: 310,
    estimatedTimeMinutes: 210,
    deadline: "2024-12-24T05:00:00.000Z",
    priority: "urgent",
    thumbnail:
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=960&q=80",
    fileFormat: "Unity / GLB",
  },
  {
    id: "SCN-006",
    title: "Med Prep Suite",
    locationType: "Healthcare",
    client: "Vista Health",
    city: "Chicago, IL",
    policies: ["Sterile Field", "Handling"],
    editsNeeded: [
      "Model interior storage for med cabinets with trays",
      "Create 8 dosage kit props with texture variations",
      "Place signage decals per sterile procedure policy",
      "Simulate soft lighting for overnight nursing crew",
    ],
    payout: 275,
    estimatedTimeMinutes: 155,
    deadline: "2024-12-21T12:00:00.000Z",
    priority: "urgent",
    thumbnail:
      "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=960&q=80",
    fileFormat: "Blender / USDZ",
  },
];

const PRIORITY_WEIGHT: Record<ScenePriority, number> = {
  rush: 3,
  urgent: 2,
  standard: 1,
};

const sortOptions = [
  { value: "urgency", label: "Priority (High → Low)" },
  { value: "deadline", label: "Deadline (Soonest)" },
  { value: "payout", label: "Payout (Highest)" },
  { value: "time", label: "Duration (Shortest)" },
];

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

export default function Portal() {
  // --- State ---
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("urgency");

  // --- Derived State ---
  const uniqueTypes = useMemo(
    () => [
      "all",
      ...new Set(SCENE_REQUESTS.map((scene) => scene.locationType)),
    ],
    [],
  );

  const filteredScenes = useMemo<SceneWithTiming[]>(() => {
    const now = new Date();

    const matchesFilters = (scene: SceneRequest) => {
      const searchTarget =
        `${scene.title} ${scene.locationType} ${scene.client} ${scene.city} ${scene.fileFormat}`.toLowerCase();
      const matchesSearch = searchTarget.includes(search.toLowerCase());
      const matchesType =
        typeFilter === "all" || scene.locationType === typeFilter;
      return matchesSearch && matchesType;
    };

    const sorted = SCENE_REQUESTS.filter(matchesFilters).sort((a, b) => {
      if (sort === "urgency") {
        const priorityDiff =
          PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sort === "deadline")
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (sort === "payout") return b.payout - a.payout;
      if (sort === "time")
        return a.estimatedTimeMinutes - b.estimatedTimeMinutes;
      return 0;
    });

    return sorted.map((scene) => ({
      ...scene,
      hoursUntilDeadline: Math.max(
        0,
        Math.ceil((new Date(scene.deadline).getTime() - now.getTime()) / 36e5),
      ),
    }));
  }, [search, typeFilter, sort]);

  const totals = useMemo(
    () => ({
      totalPayout: filteredScenes.reduce((sum, scene) => sum + scene.payout, 0),
      totalHours: Math.round(
        filteredScenes.reduce(
          (sum, scene) => sum + scene.estimatedTimeMinutes,
          0,
        ) / 60,
      ),
      rushCount: filteredScenes.filter((scene) => scene.priority === "rush")
        .length,
    }),
    [filteredScenes],
  );

  return (
    <>
      <SEO
        title="Artist Portal | SimReady Work Queue"
        description="Browse and claim SimReady scene finishing briefs. Get paid to create physics-accurate 3D environments for robotics training."
        canonical="/portal"
      />
      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* --- Header & Stats Dashboard --- */}
          <header className="mb-12 space-y-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                  <LayoutGrid className="h-3 w-3" />
                Artist Portal
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                SimReady Work Queue
              </h1>
            </div>

            {/* Login / Gate Placeholder */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-600">
              <Lock className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-700">Guest View</span>
                <span aria-hidden className="text-zinc-400">•</span>
                <Link
                  href="/login"
                  className="font-semibold text-indigo-600 transition hover:text-indigo-700"
                >
                  Sign in to claim tasks
                </Link>
              </div>
            </div>
          </div>

          {/* Dashboard Stats Strip */}
          <div className="grid grid-cols-1 gap-px bg-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 md:grid-cols-3">
            <div className="bg-white p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Active Briefs
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-zinc-900">
                    {filteredScenes.length}
                  </span>
                  <span className="text-xs font-medium text-amber-600">
                    {totals.rushCount} Rush
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Available Payout
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-zinc-900">
                    ${totals.totalPayout.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Estimated Effort
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-zinc-900">
                    {totals.totalHours}h
                  </span>
                  <span className="text-xs text-zinc-500">Total pipeline</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* --- Control Bar (Filters) --- */}
        <section className="mb-8 sticky top-4 z-20">
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white/90 p-2 shadow-lg backdrop-blur-xl md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, Client, or Software..."
                className="w-full rounded-lg border-0 bg-transparent py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-0"
              />
            </div>

            <div className="h-8 w-px bg-zinc-200 hidden md:block" />

            {/* Filter Group */}
            <div className="flex gap-2 overflow-x-auto px-2 pb-2 md:pb-0">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border-0 bg-zinc-100 py-2 pl-3 pr-8 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Environments</option>
                {uniqueTypes
                  .filter((t) => t !== "all")
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border-0 bg-zinc-100 py-2 pl-3 pr-8 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-indigo-500"
              >
                {sortOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    Sort: {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* --- Job Queue Grid --- */}
        <section className="grid gap-6 lg:grid-cols-2">
          {filteredScenes.map((scene) => {
            const deadlineDate = new Date(scene.deadline);
            const estimatedHours = Math.floor(scene.estimatedTimeMinutes / 60);
            const estimatedMinutes = scene.estimatedTimeMinutes % 60;

            return (
              <article
                key={scene.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-xl hover:border-indigo-200"
              >
                {/* Card Header / Visuals */}
                <div className="relative h-48 w-full overflow-hidden bg-zinc-100">
                  <img
                    src={scene.thumbnail}
                    alt={scene.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Floating Badges */}
                  <div className="absolute left-4 top-4 flex gap-2">
                    <span className="flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-bold text-zinc-900 backdrop-blur-sm shadow-sm">
                      <FileBox className="h-3.5 w-3.5 text-indigo-600" />
                      {scene.fileFormat}
                    </span>
                  </div>

                  <div className="absolute right-4 top-4">
                    {scene.priority === "rush" && (
                      <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm animate-pulse">
                        <AlertCircle className="h-3 w-3" /> Rush
                      </span>
                    )}
                    {scene.priority === "urgent" && (
                      <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        Urgent
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col p-6">
                  {/* Title Row */}
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                        <span className="font-mono text-zinc-400">
                          {scene.id}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300" />
                        <span>{scene.client}</span>
                      </div>
                      <h2 className="text-xl font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                        {scene.title}
                      </h2>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                        <MapPin className="h-3 w-3" /> {scene.city}
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Dashboard */}
                  <div className="mb-6 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <div className="p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Payout
                      </p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-emerald-600">
                        ${scene.payout}
                      </p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Est. Time
                      </p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-zinc-700">
                        {estimatedHours}h{" "}
                        {estimatedMinutes > 0 && `${estimatedMinutes}m`}
                      </p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Deadline
                      </p>
                      <p
                        className={`mt-0.5 font-mono text-lg font-bold ${scene.hoursUntilDeadline < 24 ? "text-amber-600" : "text-zinc-700"}`}
                      >
                        {scene.hoursUntilDeadline}h
                      </p>
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="mb-8 space-y-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Scope of Work
                    </p>
                    <ul className="space-y-2.5">
                      {scene.editsNeeded.map((edit, idx) => (
                        <li
                          key={idx}
                          className="flex gap-3 text-sm text-zinc-600"
                        >
                          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                          <span className="leading-snug">{edit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Footer */}
                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {scene.policies.slice(0, 2).map((p) => (
                        <span
                          key={p}
                          className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600"
                        >
                          {p}
                        </span>
                      ))}
                      {scene.policies.length > 2 && (
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500">
                          +{scene.policies.length - 2}
                        </span>
                      )}
                    </div>

                    <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-600 hover:shadow-lg group-hover:translate-x-1">
                      <Lock className="h-3.5 w-3.5" />
                      Claim Brief
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {/* Empty State */}
        {filteredScenes.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 py-20">
            <div className="rounded-full bg-zinc-200 p-4 mb-4">
              <Filter className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-zinc-900 font-bold">No briefs found</p>
            <p className="text-zinc-500 text-sm mt-1">
              Try adjusting your search or filters.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
              }}
              className="mt-4 text-sm font-semibold text-indigo-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
