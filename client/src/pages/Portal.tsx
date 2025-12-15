// import { useMemo, useState } from "react";
// import { format, formatDistanceToNow } from "date-fns";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   CalendarDays,
//   Clock,
//   DollarSign,
//   Filter,
//   Lock,
//   MapPin,
//   ShieldCheck,
//   Sparkles,
// } from "lucide-react";

// type ScenePriority = "rush" | "urgent" | "standard";

// type SceneRequest = {
//   id: string;
//   title: string;
//   locationType: string;
//   client: string;
//   city: string;
//   policies: string[];
//   editsNeeded: string[];
//   payout: number;
//   estimatedTimeMinutes: number;
//   deadline: string;
//   priority: ScenePriority;
//   thumbnail: string;
//   fileFormat: string;
// };

// type SceneWithTiming = SceneRequest & { hoursUntilDeadline: number };

// const SCENE_REQUESTS: SceneRequest[] = [
//   {
//     id: "scene-001",
//     title: "Tribeca Loft Kitchen",
//     locationType: "Residential Kitchen",
//     client: "Cuisine Robotics",
//     city: "New York, NY",
//     policies: [
//       "Food Prep Safety",
//       "Dexterous Manipulation",
//       "Appliance Compliance",
//     ],
//     editsNeeded: [
//       "Model cabinet interiors with collision-safe shelving",
//       "Add rig-ready hinges to all upper cabinets and appliances",
//       "Populate countertop with randomized produce + prep tools",
//       "Author lighting rig for day + evening variations",
//     ],
//     payout: 185,
//     estimatedTimeMinutes: 110,
//     deadline: "2024-12-19T19:00:00.000Z",
//     priority: "rush",
//     thumbnail:
//       "https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=960&q=80",
//     fileFormat: "Blender 3.6 / GLB",
//   },
//   {
//     id: "scene-002",
//     title: "SoMa Robotics Lab",
//     locationType: "Industrial R&D Lab",
//     client: "Waypoint Systems",
//     city: "San Francisco, CA",
//     policies: ["Safety Perimeter", "Robotic Reach Calibration"],
//     editsNeeded: [
//       "Rebuild wiring bundles with accurate cable constraints",
//       "Add labelled tool shadow boards with 12 unique props",
//       "Set up motion paths for dual-arm workcell calibration",
//     ],
//     payout: 265,
//     estimatedTimeMinutes: 160,
//     deadline: "2024-12-22T03:00:00.000Z",
//     priority: "urgent",
//     thumbnail:
//       "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=960&q=80",
//     fileFormat: "Maya 2024 / USDZ",
//   },
//   {
//     id: "scene-003",
//     title: "Boulder Gear Shop",
//     locationType: "Retail Floor",
//     client: "Summit Outfitters",
//     city: "Boulder, CO",
//     policies: ["Planogram Accuracy", "Accessible Navigation"],
//     editsNeeded: [
//       "Retopo shelving for accurate shelf-edge detections",
//       "Author cloth simulation presets for hanging jackets",
//       "Add POS counter training props (tablets, loyalty cards)",
//     ],
//     payout: 150,
//     estimatedTimeMinutes: 95,
//     deadline: "2024-12-27T17:00:00.000Z",
//     priority: "standard",
//     thumbnail:
//       "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=960&q=80",
//     fileFormat: "Blender 3.6 / FBX",
//   },
//   {
//     id: "scene-004",
//     title: "Austin Smart Kitchen Lab",
//     locationType: "Test Kitchen",
//     client: "Hestia Robotics",
//     city: "Austin, TX",
//     policies: [
//       "Heat Source Safety",
//       "Fine Motor",
//       "Ingredient Handling",
//     ],
//     editsNeeded: [
//       "Build inside geometry for ovens + smart fridge drawers",
//       "Author ingredient library with 24 manipulable items",
//       "Set up collision proxies for countertops and island",
//       "Bake lighting + reflection cubes for metal surfaces",
//     ],
//     payout: 220,
//     estimatedTimeMinutes: 140,
//     deadline: "2024-12-20T14:00:00.000Z",
//     priority: "rush",
//     thumbnail:
//       "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=960&q=80",
//     fileFormat: "Unreal 5.3 / USD",
//   },
//   {
//     id: "scene-005",
//     title: "Seattle Micro-Fulfillment Hub",
//     locationType: "Logistics Warehouse",
//     client: "Northshore Delivery",
//     city: "Seattle, WA",
//     policies: ["Inventory Accuracy", "Forklift Safety"],
//     editsNeeded: [
//       "Author modular pallet variants with LODs",
//       "Rig conveyor belts for runtime speed adjustments",
//       "Label bulk storage with barcode and QR assets",
//       "Light for overnight operations with baked GI",
//     ],
//     payout: 310,
//     estimatedTimeMinutes: 210,
//     deadline: "2024-12-24T05:00:00.000Z",
//     priority: "urgent",
//     thumbnail:
//       "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=960&q=80",
//     fileFormat: "Unity 2022 / GLB",
//   },
//   {
//     id: "scene-006",
//     title: "Hospital Med Prep Suite",
//     locationType: "Healthcare",
//     client: "Vista Health",
//     city: "Chicago, IL",
//     policies: ["Sterile Field", "Medication Handling"],
//     editsNeeded: [
//       "Model interior storage for med cabinets with trays",
//       "Create 8 dosage kit props with texture variations",
//       "Place signage decals per sterile procedure policy",
//       "Simulate soft lighting for overnight nursing crew",
//     ],
//     payout: 275,
//     estimatedTimeMinutes: 155,
//     deadline: "2024-12-21T12:00:00.000Z",
//     priority: "urgent",
//     thumbnail:
//       "https://images.unsplash.com/photo-1587502537734-0f3c9a3ac1d4?auto=format&fit=crop&w=960&q=80",
//     fileFormat: "Blender 3.6 / USDZ",
//   },
// ];

// const PRIORITY_WEIGHT: Record<ScenePriority, number> = {
//   rush: 3,
//   urgent: 2,
//   standard: 1,
// };

// const payoutRanges = [
//   { value: "all", label: "All payouts" },
//   { value: "under200", label: "Under $200" },
//   { value: "200to275", label: "$200 – $275" },
//   { value: "over275", label: "$275+" },
// ];

// const timeRanges = [
//   { value: "all", label: "Any duration" },
//   { value: "under90", label: "Up to 1.5 hrs" },
//   { value: "90to150", label: "1.5 – 2.5 hrs" },
//   { value: "over150", label: "2.5 hrs+" },
// ];

// const sortOptions = [
//   { value: "urgency", label: "Priority" },
//   { value: "deadline", label: "Soonest deadline" },
//   { value: "payout", label: "Highest payout" },
//   { value: "time", label: "Shortest duration" },
// ];

// export default function Portal() {
//   const [search, setSearch] = useState("");
//   const [typeFilter, setTypeFilter] = useState("all");
//   const [policyFilter, setPolicyFilter] = useState("all");
//   const [payoutFilter, setPayoutFilter] = useState("all");
//   const [timeFilter, setTimeFilter] = useState("all");
//   const [sort, setSort] = useState("urgency");

//   const uniqueTypes = useMemo(
//     () => ["all", ...new Set(SCENE_REQUESTS.map((scene) => scene.locationType))],
//     [],
//   );

//   const uniquePolicies = useMemo(
//     () =>
//       [
//         "all",
//         ...new Set(
//           SCENE_REQUESTS.flatMap((scene) => scene.policies).sort((a, b) =>
//             a.localeCompare(b),
//           ),
//         ),
//       ],
//     [],
//   );

//   const filteredScenes = useMemo<SceneWithTiming[]>(() => {
//     const now = new Date();

//     const matchesFilters = (scene: SceneRequest) => {
//       const searchTarget = `${scene.title} ${scene.locationType} ${scene.client} ${scene.city} ${scene.policies.join(" ")} ${scene.editsNeeded.join(" ")}`.toLowerCase();
//       const matchesSearch = searchTarget.includes(search.toLowerCase());
//       const matchesType =
//         typeFilter === "all" || scene.locationType === typeFilter;
//       const matchesPolicy =
//         policyFilter === "all" || scene.policies.includes(policyFilter);

//       const matchesPayout = (() => {
//         switch (payoutFilter) {
//           case "under200":
//             return scene.payout < 200;
//           case "200to275":
//             return scene.payout >= 200 && scene.payout <= 275;
//           case "over275":
//             return scene.payout > 275;
//           default:
//             return true;
//         }
//       })();

//       const matchesTime = (() => {
//         switch (timeFilter) {
//           case "under90":
//             return scene.estimatedTimeMinutes <= 90;
//           case "90to150":
//             return (
//               scene.estimatedTimeMinutes > 90 && scene.estimatedTimeMinutes <= 150
//             );
//           case "over150":
//             return scene.estimatedTimeMinutes > 150;
//           default:
//             return true;
//         }
//       })();

//       return (
//         matchesSearch &&
//         matchesType &&
//         matchesPolicy &&
//         matchesPayout &&
//         matchesTime
//       );
//     };

//     const sorted = SCENE_REQUESTS.filter(matchesFilters).sort((a, b) => {
//       if (sort === "urgency") {
//         const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
//         if (priorityDiff !== 0) return priorityDiff;
//         return (
//           new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
//         );
//       }

//       if (sort === "deadline") {
//         return (
//           new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
//         );
//       }

//       if (sort === "payout") {
//         return b.payout - a.payout;
//       }

//       if (sort === "time") {
//         return a.estimatedTimeMinutes - b.estimatedTimeMinutes;
//       }

//       return 0;
//     });

//     return sorted.map((scene) => {
//       const hoursUntilDeadline = Math.max(
//         0,
//         Math.ceil(
//           (new Date(scene.deadline).getTime() - now.getTime()) / 36e5,
//         ),
//       );

//       return {
//         ...scene,
//         hoursUntilDeadline,
//       };
//     });
//   }, [search, typeFilter, policyFilter, payoutFilter, timeFilter, sort]);

//   const totals = useMemo(() => {
//     const totalPayout = filteredScenes.reduce(
//       (sum, scene) => sum + scene.payout,
//       0,
//     );
//     const totalHours = filteredScenes.reduce(
//       (sum, scene) => sum + scene.estimatedTimeMinutes,
//       0,
//     );
//     const rushCount = filteredScenes.filter(
//       (scene) => scene.priority === "rush",
//     ).length;

//     return {
//       totalPayout,
//       totalHours: Math.round(totalHours / 60),
//       rushCount,
//     };
//   }, [filteredScenes]);

//   return (
//     <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-20 sm:px-6">
//       <header className="space-y-6">
//         <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
//           <span>Contractor Portal</span>
//           <span>•</span>
//           <span>SimReady Scene Queue</span>
//         </div>
//         <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
//           <div className="space-y-4">
//             <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
//               Jump into the next Blueprint scene.
//             </h1>
//             <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
//               Review active environment briefs, estimate the effort, and lock the scene when you’re ready to start. Filter by the policies you specialise in or sort for the highest payouts. Once you claim a scene we’ll reserve the files for you and hand off the download package.
//             </p>
//           </div>
//           <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
//             <div className="flex items-center gap-2 font-semibold text-slate-900">
//               <Sparkles className="h-4 w-4" /> Portal preview
//             </div>
//             <p>
//               Contractor sign-in and claim locking will appear here once the portal is gated.
//             </p>
//           </div>
//         </div>
//       </header>

//       <section className="grid gap-4 md:grid-cols-3">
//         <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
//           <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Active briefs
//           </p>
//           <div className="mt-3 flex items-baseline gap-2">
//             <span className="text-3xl font-semibold text-slate-900">
//               {filteredScenes.length}
//             </span>
//             <span className="text-xs text-slate-500">available now</span>
//           </div>
//           <p className="mt-2 text-sm text-slate-600">
//             {totals.rushCount} marked rush, prioritised to deliver this week.
//           </p>
//         </article>
//         <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
//           <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Combined payout
//           </p>
//           <div className="mt-3 flex items-baseline gap-2">
//             <span className="text-3xl font-semibold text-slate-900">
//               ${totals.totalPayout.toLocaleString()}
//             </span>
//             <span className="text-xs text-slate-500">ready to claim</span>
//           </div>
//           <p className="mt-2 text-sm text-slate-600">
//             Estimates include QA buffer and final polish time.
//           </p>
//         </article>
//         <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
//           <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Estimated effort
//           </p>
//           <div className="mt-3 flex items-baseline gap-2">
//             <span className="text-3xl font-semibold text-slate-900">
//               {totals.totalHours}
//             </span>
//             <span className="text-xs text-slate-500">hours of work</span>
//           </div>
//           <p className="mt-2 text-sm text-slate-600">
//             Based on scoped edit lists and typical contractor velocity.
//           </p>
//         </article>
//       </section>

//       <section className="space-y-6">
//         <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
//           <div className="flex flex-wrap items-center justify-between gap-4">
//             <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
//               <Filter className="h-4 w-4" /> Refine queue
//             </div>
//             <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
//               Showing scenes sorted by {sortOptions.find((s) => s.value === sort)?.label?.toLowerCase()}.
//             </div>
//           </div>
//           <div className="grid gap-4 md:grid-cols-5">
//             <div className="md:col-span-2">
//               <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                 Search briefs
//               </label>
//               <Input
//                 value={search}
//                 onChange={(event) => setSearch(event.target.value)}
//                 placeholder="Search by scene, client, or policy"
//                 className="mt-2"
//               />
//             </div>
//             <div>
//               <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                 Environment type
//               </label>
//               <Select value={typeFilter} onValueChange={setTypeFilter}>
//                 <SelectTrigger className="mt-2">
//                   <SelectValue placeholder="All" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {uniqueTypes.map((type) => (
//                     <SelectItem key={type} value={type}>
//                       {type === "all" ? "All types" : type}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div>
//               <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                 Policy focus
//               </label>
//               <Select value={policyFilter} onValueChange={setPolicyFilter}>
//                 <SelectTrigger className="mt-2">
//                   <SelectValue placeholder="All" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {uniquePolicies.map((policy) => (
//                     <SelectItem key={policy} value={policy}>
//                       {policy === "all" ? "All policies" : policy}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div>
//               <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                 Payout
//               </label>
//               <Select value={payoutFilter} onValueChange={setPayoutFilter}>
//                 <SelectTrigger className="mt-2">
//                   <SelectValue placeholder="All" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {payoutRanges.map((range) => (
//                     <SelectItem key={range.value} value={range.value}>
//                       {range.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div>
//               <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                 Sort by
//               </label>
//               <Select value={sort} onValueChange={setSort}>
//                 <SelectTrigger className="mt-2">
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {sortOptions.map((option) => (
//                     <SelectItem key={option.value} value={option.value}>
//                       {option.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>
//           <div className="grid gap-4 md:grid-cols-3">
//             <div>
//               <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                 Time commitment
//               </label>
//               <Select value={timeFilter} onValueChange={setTimeFilter}>
//                 <SelectTrigger className="mt-2">
//                   <SelectValue placeholder="All" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {timeRanges.map((range) => (
//                     <SelectItem key={range.value} value={range.value}>
//                       {range.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
//               <p className="font-semibold text-slate-700">
//                 Tip: rush briefs
//               </p>
//               <p>
//                 Look for scenes tagged rush to grab the most time-sensitive work. Claiming will lock the download for four hours.
//               </p>
//             </div>
//             <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
//               <p className="font-semibold text-slate-700">
//                 Policy coverage
//               </p>
//               <p>
//                 Filter by policy focus to line up with your certification or past experience.
//               </p>
//             </div>
//           </div>
//         </div>

//         <div className="grid gap-6 lg:grid-cols-2">
//           {filteredScenes.map((scene) => {
//             const deadlineDate = new Date(scene.deadline);
//             const timeRemaining = formatDistanceToNow(deadlineDate, {
//               addSuffix: true,
//             });
//             const estimatedHours = Math.floor(
//               scene.estimatedTimeMinutes / 60,
//             );
//             const estimatedMinutes = scene.estimatedTimeMinutes % 60;
//             const priorityLabel = scene.priority === "rush"
//               ? "Rush"
//               : scene.priority === "urgent"
//                 ? "Urgent"
//                 : "Standard";

//             return (
//               <article
//                 key={scene.id}
//                 className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
//               >
//                 <div className="relative h-56 w-full overflow-hidden">
//                   <img
//                     src={scene.thumbnail}
//                     alt={`${scene.title} thumbnail`}
//                     className="h-full w-full object-cover"
//                   />
//                   <div className="absolute right-4 top-4 flex items-center gap-2">
//                     <Badge className="bg-slate-900/80 text-white">
//                       {priorityLabel}
//                     </Badge>
//                     <Badge className="bg-white/90 text-slate-900">
//                       {scene.fileFormat}
//                     </Badge>
//                   </div>
//                 </div>
//                 <div className="flex flex-col gap-6 p-6">
//                   <div className="flex flex-wrap items-start justify-between gap-4">
//                     <div>
//                       <h2 className="text-2xl font-semibold text-slate-900">
//                         {scene.title}
//                       </h2>
//                       <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
//                         <MapPin className="h-4 w-4" /> {scene.city}
//                         <span className="h-1 w-1 rounded-full bg-slate-300" />
//                         {scene.client}
//                       </div>
//                     </div>
//                     <div className="text-right text-sm text-slate-500">
//                       <p className="font-semibold text-slate-900">
//                         Due {format(deadlineDate, "MMM d • h:mma")}
//                       </p>
//                       <p>{timeRemaining}</p>
//                     </div>
//                   </div>

//                   <div className="flex flex-wrap gap-2">
//                     <Badge variant="outline">{scene.locationType}</Badge>
//                     {scene.policies.map((policy) => (
//                       <Badge key={policy} variant="secondary">
//                         {policy}
//                       </Badge>
//                     ))}
//                   </div>

//                   <div className="space-y-2 text-sm text-slate-600">
//                     <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                       Edit requirements
//                     </p>
//                     <ul className="space-y-2">
//                       {scene.editsNeeded.map((edit) => (
//                         <li key={edit} className="flex gap-2">
//                           <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
//                           <span>{edit}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </div>

//                   <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-3">
//                     <div className="flex items-start gap-3">
//                       <DollarSign className="mt-1 h-4 w-4 text-slate-500" />
//                       <div>
//                         <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                           Payout
//                         </p>
//                         <p className="text-lg font-semibold text-slate-900">
//                           ${scene.payout}
//                         </p>
//                       </div>
//                     </div>
//                     <div className="flex items-start gap-3">
//                       <Clock className="mt-1 h-4 w-4 text-slate-500" />
//                       <div>
//                         <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                           Estimated time
//                         </p>
//                         <p className="text-lg font-semibold text-slate-900">
//                           {estimatedHours}h {estimatedMinutes.toString().padStart(2, "0")}
//                           m
//                         </p>
//                       </div>
//                     </div>
//                     <div className="flex items-start gap-3">
//                       <CalendarDays className="mt-1 h-4 w-4 text-slate-500" />
//                       <div>
//                         <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                           Deadline lock
//                         </p>
//                         <p className="text-lg font-semibold text-slate-900">
//                           {scene.hoursUntilDeadline}h left
//                         </p>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="flex flex-wrap items-center justify-between gap-4">
//                     <div className="text-xs text-slate-500">
//                       Claiming will reserve this brief for four hours while you download assets.
//                     </div>
//                     <Button className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-white hover:bg-slate-700">
//                       <Lock className="h-4 w-4" /> Start scene edits
//                     </Button>
//                   </div>
//                 </div>
//               </article>
//             );
//           })}
//           {filteredScenes.length === 0 ? (
//             <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500">
//               No scenes match your filters yet. Try clearing a filter to see everything that’s available.
//             </div>
//           ) : null}
//         </div>
//       </section>
//     </div>
//   );
// }
import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
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
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-500">
              <Lock className="h-4 w-4" />
              <span>Guest View — Sign in to claim tasks</span>
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
  );
}
