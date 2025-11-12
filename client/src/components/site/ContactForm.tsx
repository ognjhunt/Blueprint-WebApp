import { useEffect, useRef, useState } from "react";

import { Loader } from "@googlemaps/js-api-loader";

import { countries } from "@/data/countries";
import { getGoogleMapsApiKey } from "@/lib/client-env";

const requestOptions = [
  {
    value: "dataset" as const,
    label: "I need a dataset",
    description:
      "Best for labs that need coverage across layouts and tasks. We’ll anchor scope, semantics, and delivery windows together.",
    recommended: true,
  },
  {
    value: "scene" as const,
    label: "On-site SimReady location (waitlist)",
    description:
      "We’ll visit the facility you care about, scan it, and return a validated digital twin so you can prove ROI before hardware ships.",
    recommended: false,
  },
];

const datasetTiers = [
  {
    value: "Pilot",
    label: "Pilot",
    primary: "5 scenes / 30–50 articulated links",
    secondary: "50–100 pickable props. Replicator semantics optional.",
  },
  {
    value: "Lab Pack",
    label: "Lab Pack",
    primary: "20–30 scenes / 200–400 articulated links",
    secondary: "Full semantics with Isaac 4.x/5.x validation notes included.",
  },
  {
    value: "Enterprise / Custom",
    label: "Enterprise / Custom",
    primary: "50–100+ scenes with optional on-site capture",
    secondary: "Exclusivity, SLA options, and program co-design for scale.",
  },
];

const useCaseOptions = [
  "Pick & place",
  "Articulated access",
  "Panel interaction",
  "Logistics (bin picking / palletizing)",
  "Precision insertion & assembly",
  "Laundry sorting & folding",
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

const placeTypeToEnvironmentMap: Record<string, (typeof environmentOptions)[number]> = {
  bakery: "Kitchens",
  cafe: "Kitchens",
  convenience_store: "Grocery Aisles",
  department_store: "Grocery Aisles",
  distribution_center: "Warehouse Lanes",
  food: "Kitchens",
  grocery_or_supermarket: "Grocery Aisles",
  laundromat: "Home Laundry",
  laundry: "Home Laundry",
  medical_lab: "Labs",
  meal_delivery: "Kitchens",
  meal_takeaway: "Kitchens",
  office: "Office Pods",
  research_facility: "Labs",
  restaurant: "Kitchens",
  storage: "Warehouse Lanes",
  supermarket: "Grocery Aisles",
  warehouse: "Warehouse Lanes",
};

function findEnvironmentMatch(types?: readonly string[]) {
  if (!types) {
    return undefined;
  }

  for (const type of types) {
    const normalized = type.toLowerCase();
    if (normalized in placeTypeToEnvironmentMap) {
      return placeTypeToEnvironmentMap[normalized];
    }
  }

  return undefined;
}

function humanizePlaceType(type?: string) {
  if (!type) {
    return "";
  }

  return type
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? segment[0].toUpperCase() + segment.slice(1).toLowerCase()
        : segment,
    )
    .join(" ");
}

const exclusivityOptions = [
  { value: "none", label: "Shared catalog is fine" },
  { value: "preferred", label: "Prefer exclusivity" },
  { value: "required", label: "Exclusivity required" },
];

const datasetBudgetRanges = [
  "Under $50k",
  "$50k – $100k",
  "$100k – $500k",
  "$500k+",
];

const sceneBudgetRanges = ["Under $5k", "$5k – $10k", "$10k – $25k", "$25k+"];

const isaacVersions = ["Isaac 4.x", "Isaac 5.x", "Both", "Other"] as const;

export function ContactForm() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [requestType, setRequestType] = useState<"dataset" | "scene">(
    "dataset",
  );
  const [datasetTier, setDatasetTier] = useState<string>(datasetTiers[0].value);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(
    [],
  );
  const [exclusivity, setExclusivity] = useState<string>(
    exclusivityOptions[0].value,
  );
  const [siteAddress, setSiteAddress] = useState<string>("");
  const [sitePlaceId, setSitePlaceId] = useState<string>("");
  const [locationTypeSelection, setLocationTypeSelection] =
    useState<string>("");
  const [customLocationType, setCustomLocationType] = useState<string>("");
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [placesUnavailable, setPlacesUnavailable] = useState<boolean>(false);

  useEffect(() => {
    if (requestType !== "scene") {
      setLocationTypeSelection("");
      setCustomLocationType("");
    }
  }, [requestType]);

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

    if (!addressInputRef.current) {
      return;
    }

    let isCancelled = false;
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loader
      .load()
      .then(() => {
        if (isCancelled || !addressInputRef.current) {
          return;
        }

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
            const fallback = place.name ?? humanizePlaceType(place.types?.[0]);
            setLocationTypeSelection("Other");
            setCustomLocationType(fallback ?? "");
          }
        });
      })
      .catch((error) => {
        console.error("Failed to load Google Maps Places API", error);
        if (!isCancelled) {
          setPlacesUnavailable(true);
        }
      });

    return () => {
      isCancelled = true;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [requestType]);

  const handleUseCaseToggle = (value: string) => {
    setSelectedUseCases((prev) => {
      const next = prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value];
      if (
        next.length > 0 &&
        status === "error" &&
        message === "Select at least one use case so we can scope your request."
      ) {
        setStatus("idle");
        setMessage("");
      }
      return next;
    });
  };

  const handleEnvironmentToggle = (value: string) => {
    setSelectedEnvironments((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (selectedUseCases.length === 0) {
      setStatus("error");
      setMessage("Select at least one use case so we can scope your request.");
      return;
    }

    const data = new FormData(form);
    data.set("requestType", requestType);
    data.set("datasetTier", datasetTier);
    data.set("siteAddress", siteAddress);
    data.set("sitePlaceId", sitePlaceId);

    const payload: Record<string, unknown> = Object.fromEntries(data.entries());
    payload["useCases"] = selectedUseCases;
    payload["environments"] = selectedEnvironments;
    payload["requestType"] = requestType;
    payload["datasetTier"] = datasetTier;
    payload["siteAddress"] = siteAddress;
    payload["sitePlaceId"] = sitePlaceId;
    payload["exclusivityNeeds"] = exclusivity;
    payload["budgetRange"] = data.get("budgetRange") ?? "";

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to send");
      }

      form.reset();
      setStatus("success");
      setMessage("");
      setRequestType("dataset");
      setDatasetTier(datasetTiers[0].value);
      setSelectedUseCases([]);
      setSelectedEnvironments([]);
      setExclusivity(exclusivityOptions[0].value);
      setSiteAddress("");
      setSitePlaceId("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("We couldn’t send your request. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <div className="space-y-3">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Thanks for reaching out
          </span>
          <h2 className="text-2xl font-semibold text-slate-900">
            We’ll be in touch soon
          </h2>
          <p className="text-sm text-slate-600">
            A Blueprint teammate will review your request and follow up by email
            with next steps if it’s a match.
          </p>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setMessage("");
            }}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Choose your path
          </span>
          <h2 className="text-xl font-semibold text-slate-900">
            How can we help?
          </h2>
          <p className="text-sm text-slate-600">
            Labs usually start with datasets for coverage. You can still request
            a single hero scene if you know exactly what you need.
          </p>
          <p className="text-sm text-slate-500">
            Once you submit, we’ll review your request and email you with next
            steps if we’re a fit for your needs.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {requestOptions.map((option) => (
            <label
              key={option.value}
              className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition hover:border-slate-300 ${
                requestType === option.value
                  ? "border-slate-900 bg-slate-50 shadow-sm"
                  : "border-slate-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="requestType"
                value={option.value}
                checked={requestType === option.value}
                onChange={() => setRequestType(option.value)}
                className="sr-only"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-slate-900">
                  {option.label}
                </span>
                {option.recommended ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">{option.description}</p>
            </label>
          ))}
        </div>
      </section>

      {requestType === "dataset" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Dataset tiers
            </span>
            <p className="text-sm text-slate-600">
              These anchors are non-binding, but they map to how teams scope
              training corpora. Bigger bundles beat one-offs.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {datasetTiers.map((tier) => (
              <label
                key={tier.value}
                className={`flex h-full cursor-pointer flex-col gap-2 rounded-2xl border p-5 transition hover:border-slate-300 ${
                  datasetTier === tier.value
                    ? "border-slate-900 bg-slate-50 shadow-sm"
                    : "border-slate-200"
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
                <span className="text-base font-semibold text-slate-900">
                  {tier.label}
                </span>
                <p className="text-sm font-medium text-slate-800">
                  {tier.primary}
                </p>
                <p className="text-sm text-slate-600">{tier.secondary}</p>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Notes
            </label>
            <textarea
              name="datasetNotes"
              rows={3}
              placeholder="Anything specific about capture, semantics, or pilot milestones?"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </section>
      ) : (
        <section className="space-y-8">
          {/* <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                SimReady location capture
              </span>
              <h3 className="text-xl font-semibold text-slate-900">
                On-site SimReady Location (waitlist)
              </h3>
              <p className="text-sm text-slate-600">
                Turn a real site into a validated digital twin. Whether you need
                to capture a facility you already control or a prospect’s floor
                you hope to deploy into, we scan, rebuild, and deliver SimReady
                scenes within days so your robotics team can prove ROI in
                simulation before rolling out hardware.
              </p>
            </div>
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h4 className="text-sm font-semibold text-slate-900">
                Two ways customers use the service today:
              </h4>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
                <li>
                  Capture a lab-owned environment so you can iterate and
                  post-train policies against a space you control before
                  inviting external stakeholders.
                </li>
                <li>
                  Scan the exact warehouse, grocery, or retail floor you’re
                  selling into, then simulate workflows to quantify savings,
                  prove uptime, and de-risk the rollout before robots ever
                  arrive.
                </li>
              </ul>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {["Scan", "Rebuild", "Prove"].map((step, index) => {
                const copy = [
                  "Lidar + photogrammetry capture of either your in-house testbed or the customer site you need to validate—aligned for robotics-safe coverage and survey-grade accuracy.",
                  "Blueprint engineers convert captures into SimReady scene packages with joints, colliders, semantics, and the exact layout your team will deploy into.",
                  "Run targeted policies in your preferred simulator to forecast KPIs, adapt behaviors to site-specific constraints, and prove ROI before hardware deployment.",
                ][index];

                return (
                  <div
                    key={step}
                    className="space-y-2 rounded-3xl border border-slate-200 p-5"
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h5 className="text-base font-semibold text-slate-900">
                      {step}
                    </h5>
                    <p className="text-sm text-slate-600">{copy}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Reserve your slot
            </h4>
            <p className="text-sm text-slate-600">
              Priority goes to facilities with active robotic deployments. Join
              the waitlist and we’ll coordinate capture windows, SLAs, and
              pricing.
            </p>
          </div> */}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                className="text-xs uppercase tracking-[0.3em] text-slate-400"
                htmlFor="scene-facility-address"
              >
                Facility address
              </label>
              <input
                ref={addressInputRef}
                id="scene-facility-address"
                name="siteAddress"
                value={siteAddress}
                onChange={(event) => {
                  setSiteAddress(event.target.value);
                  setSitePlaceId("");
                  setLocationTypeSelection("");
                  setCustomLocationType("");
                }}
                required
                placeholder="Street, city, state"
                autoComplete="off"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
              <input type="hidden" name="sitePlaceId" value={sitePlaceId} />
              {placesUnavailable ? (
                <p className="text-xs text-slate-500">
                  Autocomplete unavailable—enter the address manually.
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Powered by Google Places Autocomplete.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label
                className="text-xs uppercase tracking-[0.3em] text-slate-400"
                htmlFor="scene-location-type"
              >
                Location type
              </label>
              <select
                id="scene-location-type"
                value={locationTypeSelection}
                onChange={(event) => {
                  const value = event.target.value;
                  setLocationTypeSelection(value);
                  if (value !== "Other") {
                    setCustomLocationType("");
                  }
                }}
                required
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="" disabled>
                  Select a location type
                </option>
                {environmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              {locationTypeSelection === "Other" ? (
                <input
                  type="text"
                  value={customLocationType}
                  onChange={(event) => setCustomLocationType(event.target.value)}
                  required
                  placeholder="Describe the environment"
                  className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                />
              ) : null}
              <input
                type="hidden"
                name="locationType"
                value={
                  locationTypeSelection === "Other"
                    ? customLocationType
                    : locationTypeSelection
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-xs uppercase tracking-[0.3em] text-slate-400"
              htmlFor="scene-notes"
            >
              Capture context
            </label>
            <textarea
              id="scene-notes"
              name="sceneNotes"
              rows={3}
              placeholder="Share access details, coordination needs, or anything the capture crew should prep."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-xs uppercase tracking-[0.3em] text-slate-400"
              htmlFor="scene-simulator"
            >
              Preferred simulator / format
            </label>
            <select
              id="scene-simulator"
              name="isaacVersion"
              required
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            >
              {isaacVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Company
            </label>
            <input
              required
              name="company"
              placeholder="Organization"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Robot platform
            </label>
            <input
              required
              name="robotPlatform"
              placeholder="Arm, mobile base, AMR fleet, etc."
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Use case
          </span>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {useCaseOptions.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
                  selectedUseCases.includes(option)
                    ? "border-slate-900 bg-slate-50 font-medium"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  name="useCases"
                  value={option}
                  checked={selectedUseCases.includes(option)}
                  onChange={() => handleUseCaseToggle(option)}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
        {requestType === "dataset" ? (
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Environment type
            </span>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {environmentOptions.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
                    selectedEnvironments.includes(option)
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="environments"
                    value={option}
                    checked={selectedEnvironments.includes(option)}
                    onChange={() => handleEnvironmentToggle(option)}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Required semantics
            </label>
            <textarea
              required
              name="requiredSemantics"
              rows={3}
              placeholder="Collider fidelity, replicator semantics, material IDs, etc."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Exclusivity needs
            </label>
            <div className="grid gap-2">
              {exclusivityOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
                    exclusivity === option.value
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="exclusivityNeeds"
                    value={option.value}
                    checked={exclusivity === option.value}
                    onChange={() => setExclusivity(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Budget range
            </label>
            <select
              name="budgetRange"
              required
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            >
              {(requestType === "scene"
                ? sceneBudgetRanges
                : datasetBudgetRanges
              ).map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {requestType === "scene"
                ? "Preferred capture window"
                : "Deadline"}
            </label>
            {requestType === "scene" ? (
              <input
                type="text"
                name="deadline"
                placeholder="e.g. Week of March 18"
                required
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
            ) : (
              <input
                type="date"
                name="deadline"
                required
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Anything else we should know?
          </label>
          <textarea
            name="message"
            rows={4}
            placeholder="Deployment context, evaluation criteria, or tooling preferences."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Your name
            </label>
            <input
              required
              name="name"
              placeholder="Full name"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Email
            </label>
            <input
              required
              type="email"
              name="email"
              placeholder="you@company.com"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Job title
            </label>
            <input
              required
              name="jobTitle"
              placeholder="Head of Robotics, Simulation Lead, etc."
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Country
            </label>
            <input
              required
              name="country"
              list="contact-country-options"
              placeholder="Where you’re based"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
            <datalist id="contact-country-options">
              {countries.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Sending…" : "Submit request"}
          </button>
          <p className="text-xs text-slate-500">
            By submitting this form, your information will be processed in
            accordance with our{" "}
            <a
              href="/privacy"
              className="underline transition hover:text-slate-700"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
        {message ? (
          <p
            className={`text-sm ${status === "error" ? "text-red-500" : "text-emerald-600"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
