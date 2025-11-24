// import { useEffect, useRef, useState } from "react";

// import { Loader } from "@googlemaps/js-api-loader";

// import { countries } from "@/data/countries";
// import { getGoogleMapsApiKey } from "@/lib/client-env";

// const requestOptions = [
//   {
//     value: "scene" as const,
//     label: "Scan my real-world facility",
//     description:
//       "Best for labs heading toward deployment. We coordinate on-site capture, rebuild the space in USD, and deliver a plug-and-play package.",
//     recommended: true,
//   },
//   {
//     value: "dataset" as const,
//     label: "Synthetic marketplace wishlist",
//     description:
//       "Tell us which policies, objects, or locations you need most so we can prioritize the next drop. No purchase required.",
//     recommended: false,
//   },
// ];

// const datasetTiers = [
//   {
//     value: "Pilot",
//     label: "Pilot",
//     primary: "5 scenes / 30–50 articulated links",
//     secondary: "50–100 pickable props. Replicator semantics optional.",
//   },
//   {
//     value: "Lab Pack",
//     label: "Lab Pack",
//     primary: "20–30 scenes / 200–400 articulated links",
//     secondary: "Full semantics with Isaac 4.x/5.x validation notes included.",
//   },
//   {
//     value: "Enterprise / Custom",
//     label: "Enterprise / Custom",
//     primary: "50–100+ scenes with optional on-site capture",
//     secondary: "Exclusivity, SLA options, and program co-design for scale.",
//   },
// ];

// const useCaseOptions = [
//   "Pick & place",
//   "Articulated access",
//   "Panel interaction",
//   "Logistics (bin picking / palletizing)",
//   "Precision insertion & assembly",
//   "Laundry sorting & folding",
// ] as const;

// const environmentOptions = [
//   "Kitchens",
//   "Grocery Aisles",
//   "Warehouse Lanes",
//   "Loading Docks",
//   "Labs",
//   "Office Pods",
//   "Utility Rooms",
//   "Home Laundry",
// ] as const;

// const placeTypeToEnvironmentMap: Record<
//   string,
//   (typeof environmentOptions)[number]
// > = {
//   bakery: "Kitchens",
//   cafe: "Kitchens",
//   convenience_store: "Grocery Aisles",
//   department_store: "Grocery Aisles",
//   distribution_center: "Warehouse Lanes",
//   food: "Kitchens",
//   grocery_or_supermarket: "Grocery Aisles",
//   laundromat: "Home Laundry",
//   laundry: "Home Laundry",
//   medical_lab: "Labs",
//   meal_delivery: "Kitchens",
//   meal_takeaway: "Kitchens",
//   office: "Office Pods",
//   research_facility: "Labs",
//   restaurant: "Kitchens",
//   storage: "Warehouse Lanes",
//   supermarket: "Grocery Aisles",
//   warehouse: "Warehouse Lanes",
// };

// function findEnvironmentMatch(types?: readonly string[]) {
//   if (!types) {
//     return undefined;
//   }

//   for (const type of types) {
//     const normalized = type.toLowerCase();
//     if (normalized in placeTypeToEnvironmentMap) {
//       return placeTypeToEnvironmentMap[normalized];
//     }
//   }

//   return undefined;
// }

// function humanizePlaceType(type?: string) {
//   if (!type) {
//     return "";
//   }

//   return type
//     .split("_")
//     .map((segment) =>
//       segment.length > 0
//         ? segment[0].toUpperCase() + segment.slice(1).toLowerCase()
//         : segment,
//     )
//     .join(" ");
// }

// const exclusivityOptions = [
//   { value: "none", label: "Shared catalog is fine" },
//   { value: "preferred", label: "Prefer exclusivity" },
//   { value: "required", label: "Exclusivity required" },
// ];

// const datasetBudgetRanges = [
//   "Under $50k",
//   "$50k – $100k",
//   "$100k – $500k",
//   "$500k+",
// ];

// const sceneBudgetRanges = ["Under $5k", "$5k – $10k", "$10k – $25k", "$25k+"];

// const isaacVersions = ["Isaac 4.x", "Isaac 5.x", "Both", "Other"] as const;

// export function ContactForm() {
//   const [status, setStatus] = useState<
//     "idle" | "loading" | "success" | "error"
//   >("idle");
//   const [message, setMessage] = useState("");
//   const [requestType, setRequestType] = useState<"dataset" | "scene">(
//     "scene",
//   );
//   const [datasetTier, setDatasetTier] = useState<string>(datasetTiers[0].value);
//   const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
//   const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(
//     [],
//   );
//   const [exclusivity, setExclusivity] = useState<string>(
//     exclusivityOptions[0].value,
//   );
//   const [siteAddress, setSiteAddress] = useState<string>("");
//   const [sitePlaceId, setSitePlaceId] = useState<string>("");
//   const [locationTypeSelection, setLocationTypeSelection] =
//     useState<string>("");
//   const [customLocationType, setCustomLocationType] = useState<string>("");
//   const addressInputRef = useRef<HTMLInputElement | null>(null);
//   const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
//   const [placesUnavailable, setPlacesUnavailable] = useState<boolean>(false);

//   useEffect(() => {
//     if (requestType !== "scene") {
//       setLocationTypeSelection("");
//       setCustomLocationType("");
//     }
//   }, [requestType]);

//   useEffect(() => {
//     if (requestType !== "scene") {
//       if (autocompleteRef.current) {
//         google.maps.event.clearInstanceListeners(autocompleteRef.current);
//         autocompleteRef.current = null;
//       }
//       return;
//     }

//     const apiKey = getGoogleMapsApiKey();
//     if (!apiKey) {
//       setPlacesUnavailable(true);
//       return;
//     }

//     if (!addressInputRef.current) {
//       return;
//     }

//     let isCancelled = false;
//     const loader = new Loader({
//       apiKey,
//       version: "weekly",
//       libraries: ["places"],
//     });

//     loader
//       .load()
//       .then(() => {
//         if (isCancelled || !addressInputRef.current) {
//           return;
//         }

//         const autocomplete = new google.maps.places.Autocomplete(
//           addressInputRef.current,
//           {
//             fields: ["place_id", "formatted_address", "name", "types"],
//             types: ["establishment", "geocode"],
//           },
//         );

//         autocompleteRef.current = autocomplete;
//         setPlacesUnavailable(false);

//         autocomplete.addListener("place_changed", () => {
//           const place = autocomplete.getPlace();
//           const formatted =
//             place.formatted_address ?? addressInputRef.current?.value ?? "";
//           setSiteAddress(formatted);
//           setSitePlaceId(place.place_id ?? "");

//           const matchedEnvironment = findEnvironmentMatch(place.types);
//           if (matchedEnvironment) {
//             setLocationTypeSelection(matchedEnvironment);
//             setCustomLocationType("");
//           } else {
//             const fallback = place.name ?? humanizePlaceType(place.types?.[0]);
//             setLocationTypeSelection("Other");
//             setCustomLocationType(fallback ?? "");
//           }
//         });
//       })
//       .catch((error) => {
//         console.error("Failed to load Google Maps Places API", error);
//         if (!isCancelled) {
//           setPlacesUnavailable(true);
//         }
//       });

//     return () => {
//       isCancelled = true;
//       if (autocompleteRef.current) {
//         google.maps.event.clearInstanceListeners(autocompleteRef.current);
//         autocompleteRef.current = null;
//       }
//     };
//   }, [requestType]);

//   const handleUseCaseToggle = (value: string) => {
//     setSelectedUseCases((prev) => {
//       const next = prev.includes(value)
//         ? prev.filter((item) => item !== value)
//         : [...prev, value];
//       if (
//         next.length > 0 &&
//         status === "error" &&
//         message === "Select at least one use case so we can scope your request."
//       ) {
//         setStatus("idle");
//         setMessage("");
//       }
//       return next;
//     });
//   };

//   const handleEnvironmentToggle = (value: string) => {
//     setSelectedEnvironments((prev) =>
//       prev.includes(value)
//         ? prev.filter((item) => item !== value)
//         : [...prev, value],
//     );
//   };

//   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
//     const form = event.currentTarget;

//     if (selectedUseCases.length === 0) {
//       setStatus("error");
//       setMessage("Select at least one use case so we can scope your request.");
//       return;
//     }

//     const data = new FormData(form);
//     data.set("requestType", requestType);
//     data.set("datasetTier", datasetTier);
//     data.set("siteAddress", siteAddress);
//     data.set("sitePlaceId", sitePlaceId);

//     const payload: Record<string, unknown> = Object.fromEntries(data.entries());
//     payload["useCases"] = selectedUseCases;
//     payload["environments"] = selectedEnvironments;
//     payload["requestType"] = requestType;
//     payload["datasetTier"] = datasetTier;
//     payload["siteAddress"] = siteAddress;
//     payload["sitePlaceId"] = sitePlaceId;
//     payload["exclusivityNeeds"] = exclusivity;
//     payload["budgetRange"] = data.get("budgetRange") ?? "";

//     setStatus("loading");
//     setMessage("");

//     try {
//       const res = await fetch("/api/contact", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (!res.ok) {
//         throw new Error("Failed to send");
//       }

//       form.reset();
//       setStatus("success");
//       setMessage("");
//       setRequestType("scene");
//       setDatasetTier(datasetTiers[0].value);
//       setSelectedUseCases([]);
//       setSelectedEnvironments([]);
//       setExclusivity(exclusivityOptions[0].value);
//       setSiteAddress("");
//       setSitePlaceId("");
//     } catch (error) {
//       console.error(error);
//       setStatus("error");
//       setMessage("We couldn’t send your request. Please try again.");
//     }
//   };

//   if (status === "success") {
//     return (
//       <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
//         <div className="space-y-3">
//           <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Thanks for reaching out
//           </span>
//           <h2 className="text-2xl font-semibold text-slate-900">
//             We’ll be in touch soon
//           </h2>
//           <p className="text-sm text-slate-600">
//             A Blueprint teammate will review your request and follow up by email
//             with next steps if it’s a match.
//           </p>
//         </div>
//         <div className="flex justify-center">
//           <button
//             type="button"
//             onClick={() => {
//               setStatus("idle");
//               setMessage("");
//             }}
//             className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
//           >
//             Submit another request
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
//     >
//       <section className="space-y-3">
//         <div className="flex flex-col gap-1">
//           <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Choose your path
//           </span>
//           <h2 className="text-xl font-semibold text-slate-900">
//             How can we help?
//           </h2>
//           <p className="text-sm text-slate-600">
//             Most labs start by scanning the real site they plan to deploy into.
//             If you’re just steering the synthetic marketplace, pick the
//             wishlist option and tell us what to drop next.
//           </p>
//           <p className="text-sm text-slate-500">
//             Once you submit, we’ll review your request and email you with next
//             steps if we’re a fit for your needs.
//           </p>
//         </div>
//         <div className="grid gap-4 md:grid-cols-2">
//           {requestOptions.map((option) => (
//             <label
//               key={option.value}
//               className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition hover:border-slate-300 ${
//                 requestType === option.value
//                   ? "border-slate-900 bg-slate-50 shadow-sm"
//                   : "border-slate-200 bg-white"
//               }`}
//             >
//               <input
//                 type="radio"
//                 name="requestType"
//                 value={option.value}
//                 checked={requestType === option.value}
//                 onChange={() => setRequestType(option.value)}
//                 className="sr-only"
//               />
//               <div className="flex items-center justify-between gap-3">
//                 <span className="text-base font-semibold text-slate-900">
//                   {option.label}
//                 </span>
//                 {option.recommended ? (
//                   <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
//                     Recommended
//                   </span>
//                 ) : null}
//               </div>
//               <p className="text-sm text-slate-600">{option.description}</p>
//             </label>
//           ))}
//         </div>
//       </section>

//       {requestType === "dataset" ? (
//         <section className="space-y-4">
//           <div className="flex flex-col gap-1">
//             <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Wishlist scale
//             </span>
//             <p className="text-sm text-slate-600">
//               Non-binding, but helps us size how many scenes/variants to line up
//               when we drop the dataset you care about.
//             </p>
//           </div>
//           <div className="grid gap-4 lg:grid-cols-3">
//             {datasetTiers.map((tier) => (
//               <label
//                 key={tier.value}
//                 className={`flex h-full cursor-pointer flex-col gap-2 rounded-2xl border p-5 transition hover:border-slate-300 ${
//                   datasetTier === tier.value
//                     ? "border-slate-900 bg-slate-50 shadow-sm"
//                     : "border-slate-200"
//                 }`}
//               >
//                 <input
//                   type="radio"
//                   name="datasetTier"
//                   value={tier.value}
//                   checked={datasetTier === tier.value}
//                   onChange={() => setDatasetTier(tier.value)}
//                   className="sr-only"
//                 />
//                 <span className="text-base font-semibold text-slate-900">
//                   {tier.label}
//                 </span>
//                 <p className="text-sm font-medium text-slate-800">
//                   {tier.primary}
//                 </p>
//                 <p className="text-sm text-slate-600">{tier.secondary}</p>
//               </label>
//             ))}
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Wishlist notes
//             </label>
//             <textarea
//               name="datasetNotes"
//               rows={3}
//               placeholder="Tell us which policies, objects, semantics, or deployment milestones we should prioritize."
//               className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//         </section>
//       ) : (
//         <section className="space-y-8">
//           <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
//             <h3 className="text-base font-semibold text-slate-900">
//               What the capture crew delivers
//             </h3>
//             <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
//               <li>
//                 Survey-grade lidar + photogrammetry aligned to the facility you
//                 specify (labs, warehouses, kitchens, utilities, etc.).
//               </li>
//               <li>
//                 SimReady USD/URDF with articulation, materials, semantics, and
//                 QA against Isaac 4.x/5.x.
//               </li>
//               <li>
//                 Optional randomizer scripts + annotation exports so you can run
//                 site-specific experiments immediately.
//               </li>
//             </ul>
//           </div>
//           {/* <div className="space-y-4">
//             <div className="space-y-2">
//               <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 SimReady location capture
//               </span>
//               <h3 className="text-xl font-semibold text-slate-900">
//                 On-site SimReady Location (waitlist)
//               </h3>
//               <p className="text-sm text-slate-600">
//                 Turn a real site into a validated digital twin. Whether you need
//                 to capture a facility you already control or a prospect’s floor
//                 you hope to deploy into, we scan, rebuild, and deliver SimReady
//                 scenes within days so your robotics team can prove ROI in
//                 simulation before rolling out hardware.
//               </p>
//             </div>
//             <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
//               <h4 className="text-sm font-semibold text-slate-900">
//                 Two ways customers use the service today:
//               </h4>
//               <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
//                 <li>
//                   Capture a lab-owned environment so you can iterate and
//                   post-train policies against a space you control before
//                   inviting external stakeholders.
//                 </li>
//                 <li>
//                   Scan the exact warehouse, grocery, or retail floor you’re
//                   selling into, then simulate workflows to quantify savings,
//                   prove uptime, and de-risk the rollout before robots ever
//                   arrive.
//                 </li>
//               </ul>
//             </div>
//             <div className="grid gap-4 md:grid-cols-3">
//               {["Scan", "Rebuild", "Prove"].map((step, index) => {
//                 const copy = [
//                   "Lidar + photogrammetry capture of either your in-house testbed or the customer site you need to validate—aligned for robotics-safe coverage and survey-grade accuracy.",
//                   "Blueprint engineers convert captures into SimReady scene packages with joints, colliders, semantics, and the exact layout your team will deploy into.",
//                   "Run targeted policies in your preferred simulator to forecast KPIs, adapt behaviors to site-specific constraints, and prove ROI before hardware deployment.",
//                 ][index];

//                 return (
//                   <div
//                     key={step}
//                     className="space-y-2 rounded-3xl border border-slate-200 p-5"
//                   >
//                     <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//                       {String(index + 1).padStart(2, "0")}
//                     </span>
//                     <h5 className="text-base font-semibold text-slate-900">
//                       {step}
//                     </h5>
//                     <p className="text-sm text-slate-600">{copy}</p>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>

//           <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
//             <h4 className="text-sm font-semibold text-slate-900">
//               Reserve your slot
//             </h4>
//             <p className="text-sm text-slate-600">
//               Priority goes to facilities with active robotic deployments. Join
//               the waitlist and we’ll coordinate capture windows, SLAs, and
//               pricing.
//             </p>
//           </div> */}

//           <div className="grid gap-4 md:grid-cols-2">
//             <div className="space-y-2">
//               <label
//                 className="text-xs uppercase tracking-[0.3em] text-slate-400"
//                 htmlFor="scene-facility-address"
//               >
//                 Facility address
//               </label>
//               <input
//                 ref={addressInputRef}
//                 id="scene-facility-address"
//                 name="siteAddress"
//                 value={siteAddress}
//                 onChange={(event) => {
//                   setSiteAddress(event.target.value);
//                   setSitePlaceId("");
//                   setLocationTypeSelection("");
//                   setCustomLocationType("");
//                 }}
//                 required
//                 placeholder="Street, city, state"
//                 autoComplete="off"
//                 className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//               />
//               <input type="hidden" name="sitePlaceId" value={sitePlaceId} />
//               {placesUnavailable ? (
//                 <p className="text-xs text-slate-500">
//                   Autocomplete unavailable—enter the address manually.
//                 </p>
//               ) : (
//                 <p className="text-xs text-slate-400">
//                   Powered by Google Places Autocomplete.
//                 </p>
//               )}
//             </div>
//             <div className="space-y-2">
//               <label
//                 className="text-xs uppercase tracking-[0.3em] text-slate-400"
//                 htmlFor="scene-location-type"
//               >
//                 Location type
//               </label>
//               <select
//                 id="scene-location-type"
//                 value={locationTypeSelection}
//                 onChange={(event) => {
//                   const value = event.target.value;
//                   setLocationTypeSelection(value);
//                   if (value !== "Other") {
//                     setCustomLocationType("");
//                   }
//                 }}
//                 required
//                 className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//               >
//                 <option value="" disabled>
//                   Select a location type
//                 </option>
//                 {environmentOptions.map((option) => (
//                   <option key={option} value={option}>
//                     {option}
//                   </option>
//                 ))}
//                 <option value="Other">Other</option>
//               </select>
//               {locationTypeSelection === "Other" ? (
//                 <input
//                   type="text"
//                   value={customLocationType}
//                   onChange={(event) =>
//                     setCustomLocationType(event.target.value)
//                   }
//                   required
//                   placeholder="Describe the environment"
//                   className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//                 />
//               ) : null}
//               <input
//                 type="hidden"
//                 name="locationType"
//                 value={
//                   locationTypeSelection === "Other"
//                     ? customLocationType
//                     : locationTypeSelection
//                 }
//               />
//             </div>
//           </div>

//           <div className="space-y-2">
//             <label
//               className="text-xs uppercase tracking-[0.3em] text-slate-400"
//               htmlFor="scene-notes"
//             >
//               Capture context
//             </label>
//             <textarea
//               id="scene-notes"
//               name="sceneNotes"
//               rows={3}
//               placeholder="Share access details, coordination needs, or anything the capture crew should prep."
//               className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>

//           <div className="space-y-2">
//             <label
//               className="text-xs uppercase tracking-[0.3em] text-slate-400"
//               htmlFor="scene-simulator"
//             >
//               Preferred simulator / format
//             </label>
//             <select
//               id="scene-simulator"
//               name="isaacVersion"
//               required
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             >
//               {isaacVersions.map((version) => (
//                 <option key={version} value={version}>
//                   {version}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </section>
//       )}

//       <section className="space-y-6">
//         <div className="grid gap-4 md:grid-cols-2">
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Company
//             </label>
//             <input
//               required
//               name="company"
//               placeholder="Organization"
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Robot platform
//             </label>
//             <input
//               required
//               name="robotPlatform"
//               placeholder="Arm, mobile base, AMR fleet, etc."
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//         </div>
//         <div className="space-y-2">
//           <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Use case
//           </span>
//           <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
//             {useCaseOptions.map((option) => (
//               <label
//                 key={option}
//                 className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
//                   selectedUseCases.includes(option)
//                     ? "border-slate-900 bg-slate-50 font-medium"
//                     : "border-slate-200"
//                 }`}
//               >
//                 <input
//                   type="checkbox"
//                   name="useCases"
//                   value={option}
//                   checked={selectedUseCases.includes(option)}
//                   onChange={() => handleUseCaseToggle(option)}
//                   className="sr-only"
//                 />
//                 {option}
//               </label>
//             ))}
//           </div>
//         </div>
//         {requestType === "dataset" ? (
//           <div className="space-y-2">
//             <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Environment type
//             </span>
//             <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
//               {environmentOptions.map((option) => (
//                 <label
//                   key={option}
//                   className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
//                     selectedEnvironments.includes(option)
//                       ? "border-slate-900 bg-slate-50 font-medium"
//                       : "border-slate-200"
//                   }`}
//                 >
//                   <input
//                     type="checkbox"
//                     name="environments"
//                     value={option}
//                     checked={selectedEnvironments.includes(option)}
//                     onChange={() => handleEnvironmentToggle(option)}
//                     className="sr-only"
//                   />
//                   {option}
//                 </label>
//               ))}
//             </div>
//           </div>
//         ) : null}
//         <div className="grid gap-4 md:grid-cols-2">
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Required semantics
//             </label>
//             <textarea
//               required
//               name="requiredSemantics"
//               rows={3}
//               placeholder="Collider fidelity, replicator semantics, material IDs, etc."
//               className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Exclusivity needs
//             </label>
//             <div className="grid gap-2">
//               {exclusivityOptions.map((option) => (
//                 <label
//                   key={option.value}
//                   className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
//                     exclusivity === option.value
//                       ? "border-slate-900 bg-slate-50 font-medium"
//                       : "border-slate-200"
//                   }`}
//                 >
//                   <input
//                     type="radio"
//                     name="exclusivityNeeds"
//                     value={option.value}
//                     checked={exclusivity === option.value}
//                     onChange={() => setExclusivity(option.value)}
//                     className="sr-only"
//                   />
//                   {option.label}
//                 </label>
//               ))}
//             </div>
//           </div>
//         </div>
//         <div className="grid gap-4 md:grid-cols-2">
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Budget range
//             </label>
//             <select
//               name="budgetRange"
//               required={requestType === "scene"}
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             >
//               {(requestType === "scene"
//                 ? sceneBudgetRanges
//                 : datasetBudgetRanges
//               ).map((range) => (
//                 <option key={range} value={range}>
//                   {range}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               {requestType === "scene"
//                 ? "Preferred capture window"
//                 : "Deadline"}
//             </label>
//             {requestType === "scene" ? (
//               <input
//                 type="text"
//                 name="deadline"
//                 placeholder="e.g. Week of March 18"
//                 required
//                 className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//               />
//             ) : (
//               <input
//                 type="date"
//                 name="deadline"
//                 required
//                 className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//               />
//             )}
//           </div>
//         </div>
//         <div className="space-y-2">
//           <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Anything else we should know?
//           </label>
//           <textarea
//             name="message"
//             rows={4}
//             placeholder="Deployment context, evaluation criteria, or tooling preferences."
//             className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//           />
//         </div>
//       </section>

//       <section className="space-y-4">
//         <div className="grid gap-4 md:grid-cols-2">
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Your name
//             </label>
//             <input
//               required
//               name="name"
//               placeholder="Full name"
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Email
//             </label>
//             <input
//               required
//               type="email"
//               name="email"
//               placeholder="you@company.com"
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Job title
//             </label>
//             <input
//               required
//               name="jobTitle"
//               placeholder="Head of Robotics, Simulation Lead, etc."
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//           </div>
//           <div className="space-y-2">
//             <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Country
//             </label>
//             <input
//               required
//               name="country"
//               list="contact-country-options"
//               placeholder="Where you’re based"
//               className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//             />
//             <datalist id="contact-country-options">
//               {countries.map((country) => (
//                 <option key={country} value={country} />
//               ))}
//             </datalist>
//           </div>
//         </div>
//       </section>

//       <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
//         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
//           <button
//             type="submit"
//             className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
//             disabled={status === "loading"}
//           >
//             {status === "loading" ? "Sending…" : "Submit request"}
//           </button>
//           <p className="text-xs text-slate-500">
//             By submitting this form, your information will be processed in
//             accordance with our{" "}
//             <a
//               href="/privacy"
//               className="underline transition hover:text-slate-700"
//             >
//               Privacy Policy
//             </a>
//             .
//           </p>
//         </div>
//         {message ? (
//           <p
//             className={`text-sm ${status === "error" ? "text-red-500" : "text-emerald-600"}`}
//           >
//             {message}
//           </p>
//         ) : null}
//       </div>
//     </form>
//   );
// }
import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { GoogleGenAI } from "@google/genai";
import { countries } from "@/data/countries";
import { getGoogleMapsApiKey } from "@/lib/client-env";
import {
  MapPin,
  Scan,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Cpu,
  Globe,
  Briefcase,
  Mail,
  User,
  Layers,
  Terminal,
  Camera,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { SUPPORT } from "../pilotCopy";

// --- Configuration ---

const SHOW_REAL_WORLD_CAPTURE = false;

const requestOptions = [
  {
    value: "scene" as const,
    label: "Real-world Capture",
    icon: <Scan className="h-6 w-6" />,
    description:
      "We send a crew to scan your exact facility, rebuild it in USD, and deliver a validated SimReady twin.",
    recommended: true,
  },
  {
    value: "dataset" as const,
    label: "Marketplace Wishlist",
    icon: <Sparkles className="h-6 w-6" />,
    description:
      "Tell us which policies or environments to prioritize for the next synthetic drop. Help steer the roadmap.",
    recommended: false,
  },
  {
    value: "snapshot" as const,
    label: "Reference Photo Rebuild",
    icon: <Camera className="h-6 w-6" />,
    description:
      "Upload a single well-lit photo of a supported archetype. We’ll reconstruct that exact layout into a SimReady scene.",
    recommended: false,
  },
];

const visibleRequestOptions = SHOW_REAL_WORLD_CAPTURE
  ? requestOptions
  : requestOptions.filter((option) => option.value !== "scene");

const datasetTiers = [
  {
    value: "Pilot",
    label: "Pilot Tier",
    specs: ["5 scenes", "30–50 links"],
    desc: "Pickable props",
  },
  {
    value: "Lab Pack",
    label: "Lab Pack",
    specs: ["20–30 scenes", "200+ links"],
    desc: "Full semantics + QA",
  },
  {
    value: "Enterprise",
    label: "Enterprise",
    specs: ["50–100+ scenes", "Custom SLA"],
    desc: "Program co-design",
  },
];

const useCaseOptions = [
  "Pick & place",
  "Articulated access",
  "Panel interaction",
  "Logistics / Palletizing",
  "Precision assembly",
  "Deformable / Laundry",
] as const;

const environmentOptions = [
  "Kitchens",
  "Grocery Aisles",
  "Warehouse Lanes",
  "Loading Docks",
  "Labs",
  "Office Pods",
  "Utility Rooms",
  "Home Laundry",
] as const;

const placeTypeToEnvironmentMap: Record<string, string> = {
  bakery: "Kitchens",
  cafe: "Kitchens",
  convenience_store: "Grocery Aisles",
  department_store: "Grocery Aisles",
  distribution_center: "Warehouse Lanes",
  food: "Kitchens",
  grocery_or_supermarket: "Grocery Aisles",
  laundromat: "Home Laundry",
  medical_lab: "Labs",
  restaurant: "Kitchens",
  storage: "Warehouse Lanes",
  supermarket: "Grocery Aisles",
  warehouse: "Warehouse Lanes",
};

function findEnvironmentMatch(types?: readonly string[]) {
  if (!types) return undefined;
  for (const type of types) {
    const normalized = type.toLowerCase();
    if (normalized in placeTypeToEnvironmentMap) {
      return placeTypeToEnvironmentMap[normalized];
    }
  }
  return undefined;
}

const exclusivityOptions = [
  { value: "none", label: "Shared catalog (Standard)" },
  { value: "preferred", label: "Prefer exclusivity" },
  { value: "required", label: "Strict exclusivity required" },
];

const isaacVersions = ["Isaac 4.x", "Isaac 5.x", "Both", "Other"] as const;

type SnapshotAnalysis = {
  supported: boolean;
  supportedReason?: string;
  totalThings: number;
  articulatedObjects: number;
  staticObjects: number;
  extraNotes?: string[];
  suggestedQuote?: number;
  sceneArchetype?: (typeof environmentOptions)[number];
};

const clampQuote = (value: number) =>
  Math.min(5000, Math.max(1000, Math.round(value / 50) * 50));

const base64FromFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const deriveQuote = (analysis: SnapshotAnalysis | null) => {
  if (!analysis) return 1500;
  const complexityBias =
    analysis.totalThings * 120 + analysis.articulatedObjects * 180;
  const supportedBuffer = analysis.supported ? 0 : 250;
  const inferred = 1200 + complexityBias + supportedBuffer;
  return clampQuote(analysis.suggestedQuote ?? inferred);
};

const defaultRequestType = SHOW_REAL_WORLD_CAPTURE ? "scene" : "dataset";

export function ContactForm() {
  // --- State ---
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [requestType, setRequestType] = useState<
    "dataset" | "scene" | "snapshot"
  >(defaultRequestType);

  // Form Data
  const [datasetTier, setDatasetTier] = useState<string>(datasetTiers[0].value);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(
    [],
  );
  const [exclusivity, setExclusivity] = useState<string>(
    exclusivityOptions[0].value,
  );
  const [snapshotExclusive, setSnapshotExclusive] = useState<boolean>(true);
  const [siteAddress, setSiteAddress] = useState<string>("");
  const [sitePlaceId, setSitePlaceId] = useState<string>("");
  const [locationTypeSelection, setLocationTypeSelection] =
    useState<string>("");
  const [customLocationType, setCustomLocationType] = useState<string>("");
  const [snapshotEnvironment, setSnapshotEnvironment] = useState<string>("");
  const [snapshotEnvironmentManuallySet, setSnapshotEnvironmentManuallySet] =
    useState<boolean>(false);
  const [referenceImagesCount, setReferenceImagesCount] = useState<number>(0);
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "analyzing" | "ready" | "error"
  >("idle");
  const [analysisResult, setAnalysisResult] = useState<SnapshotAnalysis | null>(
    null,
  );
  const [analysisMessage, setAnalysisMessage] = useState<string>("");

  // Refs
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const snapshotEnvironmentManualRef = useRef<boolean>(false);
  const [placesUnavailable, setPlacesUnavailable] = useState<boolean>(false);

  // --- Effects ---

  // Reset specific fields when switching types
  useEffect(() => {
    if (requestType !== "scene") {
      setLocationTypeSelection("");
      setCustomLocationType("");
    }

    if (requestType !== "snapshot") {
      setSnapshotEnvironment("");
      setSnapshotEnvironmentManuallySet(false);
      snapshotEnvironmentManualRef.current = false;
      setSnapshotExclusive(true);
      setReferenceImagesCount(0);
      setSnapshotFile(null);
      setSnapshotPreview(null);
      setAnalysisStatus("idle");
      setAnalysisResult(null);
      setAnalysisMessage("");
    }
  }, [requestType]);

  // Google Maps Logic
  useEffect(() => {
    if (requestType !== "scene") {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      return;
    }

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      setPlacesUnavailable(true);
      return;
    }

    if (!addressInputRef.current) return;

    let isCancelled = false;
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loader
      .load()
      .then(() => {
        if (isCancelled || !addressInputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            fields: ["place_id", "formatted_address", "name", "types"],
            types: ["establishment", "geocode"],
          },
        );

        autocompleteRef.current = autocomplete;
        setPlacesUnavailable(false);

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const formatted =
            place.formatted_address ?? addressInputRef.current?.value ?? "";
          setSiteAddress(formatted);
          setSitePlaceId(place.place_id ?? "");

          const matchedEnvironment = findEnvironmentMatch(place.types);
          if (matchedEnvironment) {
            setLocationTypeSelection(matchedEnvironment);
            setCustomLocationType("");
          } else {
            setLocationTypeSelection("Other");
          }
        });
      })
      .catch((error) => {
        console.error("Google Maps Error", error);
        if (!isCancelled) setPlacesUnavailable(true);
      });

    return () => {
      isCancelled = true;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [requestType]);

  // --- Handlers ---

  const handleUseCaseToggle = (value: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleEnvironmentToggle = (value: string) => {
    setSelectedEnvironments((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSnapshotUpload = (fileList: FileList | null) => {
    const firstFile = fileList?.[0];
    if (!firstFile) {
      setSnapshotFile(null);
      setSnapshotPreview(null);
      setReferenceImagesCount(0);
      setSnapshotEnvironmentManuallySet(false);
      snapshotEnvironmentManualRef.current = false;
      return;
    }

    setSnapshotFile(firstFile);
    setReferenceImagesCount(1);
    setAnalysisStatus("idle");
    setAnalysisResult(null);
    setAnalysisMessage("");
    setSnapshotEnvironmentManuallySet(false);
    snapshotEnvironmentManualRef.current = false;

    const previewUrl = URL.createObjectURL(firstFile);
    setSnapshotPreview(previewUrl);

    void runSnapshotAnalysis(firstFile);
  };

  const runSnapshotAnalysis = async (file: File | null = snapshotFile) => {
    const targetFile = file ?? snapshotFile;

    if (!targetFile) {
      setAnalysisStatus("error");
      setAnalysisMessage("Add a reference photo to analyze.");
      setMessage("Please attach a reference photo for Gemini to review.");
      setStatus("error");
      return;
    }

    const key = "AIzaSyDpEZHda1az1ynC96pDfFbiHtyat7AWS-8";
    if (!key) {
      setAnalysisStatus("error");
      setAnalysisMessage("Gemini analysis is temporarily unavailable.");
      setMessage(
        "We couldn't auto-run Gemini. You can still submit the request.",
      );
      return;
    }

    setAnalysisStatus("analyzing");
    setAnalysisMessage("Gemini 3 Pro is reviewing your scene...");
    setMessage("");

    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const encodedImage = await base64FromFile(targetFile);
      const prompt = `You are Blueprint's quoting assistant. Analyze the uploaded reference photo for a robotics simulation rebuild. Return JSON with keys: supported (boolean), supportedReason (string), totalThings (integer count of visually distinct items), articulatedObjects (integer count of things that must move or hinge), staticObjects (integer count of items that can stay fixed), extraNotes (array of 1-3 bullet strings), suggestedQuote (number between 1000 and 5000 estimating USD effort for rebuild), sceneArchetype (choose one best-fit string from [${environmentOptions.join(", ")}]). Be concise.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        config: {
          thinkingConfig: { thinkingLevel: "HIGH" },
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        } as any,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: encodedImage,
                  mimeType: targetFile.type || "image/jpeg",
                },
              },
            ],
          },
        ],
      });

      const rawText =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)?.response?.text?.() ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)?.candidates?.[0]?.content?.parts
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ?.map((p: any) => p.text ?? "")
          .join("") ??
        "";

      const parsed: SnapshotAnalysis = JSON.parse(rawText);
      const normalizedNotes = Array.isArray(parsed.extraNotes)
        ? parsed.extraNotes.map((note) => String(note))
        : parsed.extraNotes
          ? [String(parsed.extraNotes)]
          : [];
      const normalizedArchetype =
        typeof parsed.sceneArchetype === "string" &&
        environmentOptions.includes(
          parsed.sceneArchetype as (typeof environmentOptions)[number],
        )
          ? (parsed.sceneArchetype as (typeof environmentOptions)[number])
          : undefined;
      const normalized: SnapshotAnalysis = {
        supported: Boolean(parsed.supported),
        supportedReason: parsed.supportedReason ?? "",
        totalThings: Number.isFinite(parsed.totalThings)
          ? Math.max(0, Math.round(parsed.totalThings))
          : 0,
        articulatedObjects: Number.isFinite(parsed.articulatedObjects)
          ? Math.max(0, Math.round(parsed.articulatedObjects))
          : 0,
        staticObjects: Number.isFinite(parsed.staticObjects)
          ? Math.max(0, Math.round(parsed.staticObjects))
          : 0,
        extraNotes: normalizedNotes,
        suggestedQuote: parsed.suggestedQuote,
        sceneArchetype: normalizedArchetype,
      };

      const quote = deriveQuote(normalized);
      setAnalysisResult({ ...normalized, suggestedQuote: quote });
      setAnalysisStatus("ready");
      setAnalysisMessage(
        normalized.supported
          ? "Scene looks compatible with our coverage."
          : "Scene may need a manual review — we’ll help you triage.",
      );
      if (normalized.sceneArchetype && !snapshotEnvironmentManualRef.current) {
        setSnapshotEnvironment(normalized.sceneArchetype);
      }
      setStatus("idle");
    } catch (error) {
      console.error("Gemini analysis failed", error);
      setAnalysisStatus("error");
      setAnalysisMessage(
        "Gemini analysis failed. Try again or contact support.",
      );
      setStatus("error");
      setMessage("We couldn’t complete the Gemini review. Please retry.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const data = new FormData(form);

    if (selectedUseCases.length === 0) {
      setStatus("error");
      setMessage("Please select at least one use case.");
      return;
    }

    if (requestType === "snapshot") {
      const uploads = data
        .getAll("referenceImages")
        .filter((file) => file instanceof File && file.size > 0);

      if (uploads.length === 0) {
        setStatus("error");
        setMessage("Please attach at least one reference photo.");
        return;
      }
    }

    const payload: Record<string, unknown> = Object.fromEntries(data.entries());

    // Append React State
    Object.assign(payload, {
      requestType,
      datasetTier,
      siteAddress,
      sitePlaceId,
      useCases: selectedUseCases,
      environments: selectedEnvironments,
      exclusivityNeeds:
        requestType === "snapshot"
          ? snapshotExclusive
            ? "exclusive-default"
            : "open-catalog-ok"
          : exclusivity,
    });

    if (requestType === "snapshot") {
      payload["snapshotExclusive"] = snapshotExclusive;
      payload["snapshotEnvironment"] = snapshotEnvironment;
      payload["referenceImagesCount"] = referenceImagesCount;
      payload["snapshotAnalysis"] = analysisResult;
      payload["snapshotQuote"] = deriveQuote(analysisResult);
    }

    setStatus("loading");
    setMessage("");

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // const res = await fetch("/api/contact", { ... });

      setStatus("success");
      form.reset();
      // Reset State
      setRequestType(defaultRequestType);
      setDatasetTier(datasetTiers[0].value);
      setSelectedUseCases([]);
      setSelectedEnvironments([]);
      setExclusivity(exclusivityOptions[0].value);
      setSiteAddress("");
      setSitePlaceId("");
      setSnapshotExclusive(true);
      setSnapshotEnvironment("");
      setSnapshotEnvironmentManuallySet(false);
      snapshotEnvironmentManualRef.current = false;
      setReferenceImagesCount(0);
      setSnapshotFile(null);
      setSnapshotPreview(null);
      setAnalysisStatus("idle");
      setAnalysisResult(null);
      setAnalysisMessage("");
    } catch (error) {
      setStatus("error");
      setMessage("Transmission failed. Please try again.");
    }
  };

  // --- Render: Success State ---
  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white p-12 text-center shadow-lg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">Request Received</h2>
        <p className="mt-4 max-w-md text-zinc-600">
          A Blueprint engineer will review your specs and reach out shortly.
          Expect a confirmation email within 5 minutes.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-8 rounded-full border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Submit another request
        </button>
      </div>
    );
  }

  // --- Render: Form ---
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Path Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleRequestOptions.map((option) => (
          <div
            key={option.value}
            onClick={() => setRequestType(option.value)}
            className={`group relative flex cursor-pointer flex-col gap-4 rounded-2xl border p-6 transition-all duration-300 ${
              requestType === option.value
                ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-600"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`rounded-lg p-2.5 transition-colors ${
                  requestType === option.value
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 text-zinc-500 group-hover:text-zinc-900"
                }`}
              >
                {option.icon}
              </div>
              {requestType === option.value && (
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              )}
            </div>
            <div>
              <h3
                className={`font-bold ${requestType === option.value ? "text-indigo-900" : "text-zinc-900"}`}
              >
                {option.label}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                {option.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Container for the rest of the form */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        {/* 2. Specific Path Fields */}
        {requestType === "dataset" ? (
          <section className="mb-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border-b border-zinc-100 pb-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                <Sparkles className="h-3.5 w-3.5" /> Wishlist Specs
              </h4>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {datasetTiers.map((tier) => (
                <label
                  key={tier.value}
                  className={`cursor-pointer rounded-xl border px-4 py-5 transition-all ${
                    datasetTier === tier.value
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="datasetTier"
                    value={tier.value}
                    checked={datasetTier === tier.value}
                    onChange={() => setDatasetTier(tier.value)}
                    className="sr-only"
                  />
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-zinc-900">
                      {tier.label}
                    </span>
                    {datasetTier === tier.value && (
                      <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-zinc-600 font-mono">
                    {tier.specs.map((spec) => (
                      <div key={spec}>• {spec}</div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 border-t border-zinc-200/50 pt-2">
                    {tier.desc}
                  </p>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Priority Notes
              </span>
              <textarea
                name="datasetNotes"
                rows={3}
                placeholder="E.g. We need transparent plastics and reflective metals in warehouse lighting..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
              />
            </div>
          </section>
        ) : requestType === "snapshot" ? (
          <section className="mb-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.35em] text-indigo-700">
                    Reference Photo Brief
                  </h4>
                  <p className="text-sm text-zinc-600">
                    Upload one wide, well-lit frame. Gemini 3 Pro will estimate
                    feasibility, effort, and a quote before you submit.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Reference photo
                    </label>
                    <label className="group flex h-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center transition hover:border-indigo-300 hover:bg-indigo-50/50">
                      <input
                        type="file"
                        name="referenceImages"
                        accept="image/*"
                        required
                        onChange={(e) => handleSnapshotUpload(e.target.files)}
                        className="hidden"
                      />
                      {snapshotPreview ? (
                        <div className="w-full space-y-3">
                          <div className="overflow-hidden rounded-xl border border-zinc-200">
                            <img
                              src={snapshotPreview}
                              alt="Reference preview"
                              className="h-48 w-full object-cover"
                            />
                          </div>
                          <p className="text-sm font-medium text-zinc-800">
                            {snapshotFile?.name ?? "Reference photo attached"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Replace the file to re-run Gemini analysis.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-zinc-500">
                          <Camera className="h-5 w-5 text-indigo-500" />
                          <p className="text-sm font-semibold text-zinc-700">
                            Drop a single well-lit frame
                          </p>
                          <p className="text-xs text-zinc-500">
                            Wide shot of the entire scene. JPG or PNG works
                            great.
                          </p>
                        </div>
                      )}
                    </label>
                    <p className="text-xs text-zinc-500">
                      Capture a single wide, well-lit frame of the entire scene.
                      We’ll reconstruct a SimReady version of that exact layout.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Scene Archetype (existing coverage)
                    </label>
                    <select
                      required
                      value={snapshotEnvironment}
                      onChange={(e) => {
                        setSnapshotEnvironment(e.target.value);
                        setSnapshotEnvironmentManuallySet(true);
                        snapshotEnvironmentManualRef.current = true;
                      }}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                    >
                      <option value="" disabled>
                        Select archetype...
                      </option>
                      {environmentOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Notes about this location
                    </label>
                    <input
                      name="snapshotNotes"
                      placeholder="What must stay true in the reconstruction?"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                      <Terminal className="h-3.5 w-3.5" /> Gemini Analysis
                    </div>
                    {analysisStatus === "analyzing" && (
                      <div className="flex items-center gap-2 text-xs text-indigo-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600">
                    We’ll auto-run Gemini after you add a reference photo. It
                    checks coverage, counts articulated vs static objects, and
                    suggests effort.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        analysisStatus === "ready"
                          ? "bg-emerald-100 text-emerald-700"
                          : analysisStatus === "error"
                            ? "bg-red-100 text-red-700"
                            : analysisStatus === "analyzing"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {analysisStatus === "ready"
                        ? "Analysis ready"
                        : analysisStatus === "analyzing"
                          ? "Running automatically"
                          : analysisStatus === "error"
                            ? "Needs retry"
                            : "Waiting for photo"}
                    </div>
                    {analysisStatus === "error" && (
                      <span className="text-xs text-amber-700">
                        We’ll handle review manually if needed.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Gemini 3 Pro Findings
                      </p>
                      <p className="text-sm text-zinc-600">
                        {analysisMessage ||
                          "Upload a reference photo to see support and effort signals."}
                      </p>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        analysisResult?.supported === false
                          ? "bg-amber-100 text-amber-700"
                          : analysisResult?.supported
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {analysisResult
                        ? analysisResult.supported
                          ? "Supported"
                          : "Manual review"
                        : "Not yet analyzed"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-zinc-100 p-3">
                        <p className="text-xs font-semibold text-zinc-500">
                          Total things
                        </p>
                        <p className="text-lg font-bold text-zinc-900">
                          {analysisResult?.totalThings ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-100 p-3">
                        <p className="text-xs font-semibold text-zinc-500">
                          Articulated objects
                        </p>
                        <p className="text-lg font-bold text-zinc-900">
                          {analysisResult?.articulatedObjects ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-100 p-3">
                        <p className="text-xs font-semibold text-zinc-500">
                          Static objects
                        </p>
                        <p className="text-lg font-bold text-zinc-900">
                          {analysisResult?.staticObjects ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-100 p-3">
                        <p className="text-xs font-semibold text-zinc-500">
                          Support match
                        </p>
                        <p className="text-lg font-bold text-zinc-900">
                          {analysisResult?.supported
                            ? "Looks covered"
                            : analysisResult?.supported === false
                              ? "Needs review"
                              : "Pending"}
                        </p>
                      </div>
                    </div>
                    {analysisResult?.extraNotes?.length ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Notes
                        </p>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700">
                          {analysisResult.extraNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                        Gemini Quote Range
                      </p>
                      <p className="text-2xl font-bold text-indigo-900">
                        ${deriveQuote(analysisResult).toLocaleString()}
                      </p>
                      <p className="text-xs text-indigo-700/80">
                        Estimated per-scene effort based on the current
                        analysis.
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                      $1,000 – $5,000 window
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href={`mailto:${SUPPORT.email}?subject=Reference%20photo%20question`}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
                    >
                      <Mail className="h-4 w-4" /> Email support
                    </a>
                    <a
                      href={SUPPORT.calendly}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
                    >
                      <MessageCircle className="h-4 w-4" /> Book time
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border-b border-zinc-100 pb-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
                <MapPin className="h-3.5 w-3.5" /> Site Parameters
              </h4>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="scene-address"
                  className="text-xs font-bold text-zinc-500 uppercase tracking-wider"
                >
                  Target Facility
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    ref={addressInputRef}
                    id="scene-address"
                    name="siteAddress"
                    value={siteAddress}
                    onChange={(e) => {
                      setSiteAddress(e.target.value);
                      setSitePlaceId("");
                      setLocationTypeSelection("");
                    }}
                    placeholder="Search address (Google Maps)..."
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-3 text-sm font-medium text-zinc-900 focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>
                {placesUnavailable && (
                  <p className="text-xs text-red-500">
                    Maps API unavailable. Enter manually.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Environment Archetype
                </label>
                <select
                  value={locationTypeSelection}
                  onChange={(e) => {
                    setLocationTypeSelection(e.target.value);
                    if (e.target.value !== "Other") setCustomLocationType("");
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                >
                  <option value="" disabled>
                    Select Type...
                  </option>
                  {environmentOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="Other">Other (Specify)</option>
                </select>
                {locationTypeSelection === "Other" && (
                  <input
                    placeholder="Describe custom facility..."
                    value={customLocationType}
                    onChange={(e) => setCustomLocationType(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm"
                  />
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Simulator Target
                </label>
                <div className="relative">
                  <Terminal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <select
                    name="isaacVersion"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                  >
                    {isaacVersions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Access Notes
                </label>
                <input
                  name="sceneNotes"
                  placeholder="Security clearance, hours of operation, etc."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </section>
        )}

        {/* 3. Shared Mission Profile */}
        <section className="mb-12 space-y-6">
          <div className="border-b border-zinc-100 pb-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <Layers className="h-3.5 w-3.5" /> Mission Profile
            </h4>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Required Capabilities (Use Cases)
            </span>
            <div className="flex flex-wrap gap-2">
              {useCaseOptions.map((option) => {
                const isSelected = selectedUseCases.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => handleUseCaseToggle(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${
                      isSelected
                        ? "bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {requestType === "dataset" && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Environment Types
              </span>
              <div className="flex flex-wrap gap-2">
                {environmentOptions.map((option) => {
                  const isSelected = selectedEnvironments.includes(option);
                  return (
                    <button
                      type="button"
                      key={option}
                      onClick={() => handleEnvironmentToggle(option)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${
                        isSelected
                          ? "bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Robot Platform
              </label>
              <div className="relative">
                <Cpu className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  required
                  name="robotPlatform"
                  placeholder="e.g. UR5e, Franka, Custom AMR"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Timeline / Deadline
              </label>
              <input
                required
                name="deadline"
                type={requestType === "dataset" ? "date" : "text"}
                placeholder="e.g. Q3 Deployment"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {requestType === "snapshot" ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Exclusivity
              </label>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={snapshotExclusive}
                    onChange={(e) => setSnapshotExclusive(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="font-semibold text-zinc-900">
                      Keep this reconstruction exclusive by default
                    </p>
                    <p className="text-sm text-zinc-600">
                      Uncheck to allow an open catalog listing; pricing stays
                      the same.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Exclusivity
              </label>
              <select
                value={exclusivity}
                onChange={(e) => setExclusivity(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
              >
                {exclusivityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* 4. Contact Info */}
        <section className="space-y-6">
          <div className="border-b border-zinc-100 pb-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <User className="h-3.5 w-3.5" /> Point of Contact
            </h4>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Full Name
              </label>
              <input
                required
                name="name"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  required
                  type="email"
                  name="email"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-3 text-sm focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Company
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  required
                  name="company"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-3 text-sm focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Country
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  required
                  name="country"
                  list="countries"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 py-3 text-sm focus:border-indigo-500"
                />
                <datalist id="countries">
                  {countries.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Additional Context
            </label>
            <textarea
              name="message"
              rows={3}
              placeholder="Anything else we should know about your simulation stack?"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-indigo-500"
            />
          </div>
        </section>

        {/* Footer / Submit */}
        <div className="mt-8 border-t border-zinc-100 pt-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-zinc-400">
              Data processed securely. See{" "}
              <a href="/privacy" className="underline hover:text-zinc-600">
                Privacy Policy
              </a>
              .
            </p>
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <>Sending Request...</>
              ) : (
                <>
                  Submit Request <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
          {message && status === "error" && (
            <p className="mt-4 text-center text-sm font-medium text-red-600 bg-red-50 p-2 rounded-lg">
              {message}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
