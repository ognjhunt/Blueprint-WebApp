import { useState } from "react";

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
    label: "I need a specific scene",
    description:
      "Per-scene SKU for targeted pilots. Choose the layout, interactions, and delivery version you need to ship.",
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

const sceneCategories = ["Kitchen", "Warehouse", "Retail", "Office", "Lab"] as const;

const interactionOptions = [
  "Revolute",
  "Prismatic",
  "Buttons",
  "Knobs",
  "Pickables",
] as const;

const useCaseOptions = [
  "Open/slide",
  "Pick-place",
  "Palletize",
  "Other",
] as const;

const exclusivityOptions = [
  { value: "none", label: "Shared catalog is fine" },
  { value: "preferred", label: "Prefer exclusivity" },
  { value: "required", label: "Exclusivity required" },
];

const budgetRanges = [
  "Under $10k",
  "$10k – $25k",
  "$25k – $50k",
  "$50k+",
];

const isaacVersions = ["Isaac 4.x", "Isaac 5.x", "Both", "Other"] as const;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [requestType, setRequestType] = useState<"dataset" | "scene">("dataset");
  const [datasetTier, setDatasetTier] = useState<string>(datasetTiers[0].value);
  const [sceneCategory, setSceneCategory] = useState<string>(sceneCategories[0]);
  const [sceneInteractions, setSceneInteractions] = useState<string[]>([]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [exclusivity, setExclusivity] = useState<string>(exclusivityOptions[0].value);

  const handleInteractionToggle = (value: string) => {
    setSceneInteractions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

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
    data.set("sceneCategory", sceneCategory);

    const payload: Record<string, unknown> = Object.fromEntries(data.entries());
    payload["useCases"] = selectedUseCases;
    payload["sceneInteractions"] = sceneInteractions;
    payload["requestType"] = requestType;
    payload["datasetTier"] = datasetTier;
    payload["sceneCategory"] = sceneCategory;
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
      setSceneCategory(sceneCategories[0]);
      setSceneInteractions([]);
      setSelectedUseCases([]);
      setExclusivity(exclusivityOptions[0].value);
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
          <h2 className="text-2xl font-semibold text-slate-900">We’ll set up a walkthrough next</h2>
          <p className="text-sm text-slate-600">
            A Blueprint teammate will reach out shortly to coordinate a 30-minute session and
            share prep materials. You can also reserve a slot right away below.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="https://calendly.com/blueprintar/30min"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Book a Calendly slot
          </a>
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
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Choose your path</span>
          <h2 className="text-xl font-semibold text-slate-900">How can we help?</h2>
          <p className="text-sm text-slate-600">
            Labs usually start with datasets for coverage. You can still request a single hero scene if you know exactly what
            you need.
          </p>
          <p className="text-sm text-slate-500">
            Once you submit, we’ll reach out to line up a 30-minute walkthrough and share our Calendly if you want to book
            instantly.
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
                <span className="text-base font-semibold text-slate-900">{option.label}</span>
                {option.recommended ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">Recommended</span>
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
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Dataset tiers</span>
            <p className="text-sm text-slate-600">
              These anchors are non-binding, but they map to how teams scope training corpora. Bigger bundles beat one-offs.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {datasetTiers.map((tier) => (
              <label
                key={tier.value}
                className={`flex h-full cursor-pointer flex-col gap-2 rounded-2xl border p-5 transition hover:border-slate-300 ${
                  datasetTier === tier.value ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200"
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
                <span className="text-base font-semibold text-slate-900">{tier.label}</span>
                <p className="text-sm font-medium text-slate-800">{tier.primary}</p>
                <p className="text-sm text-slate-600">{tier.secondary}</p>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Notes</label>
            <textarea
              name="datasetNotes"
              rows={3}
              placeholder="Anything specific about capture, semantics, or pilot milestones?"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Scene details</span>
            <p className="text-sm text-slate-600">
              Pick the layout and interactions you need. We’ll confirm lighting, dressing, and any hardware fixtures after you
              submit.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Category</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sceneCategories.map((category) => (
                  <label
                    key={category}
                    className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
                      sceneCategory === category ? "border-slate-900 bg-slate-50 font-medium" : "border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sceneCategory"
                      value={category}
                      checked={sceneCategory === category}
                      onChange={() => setSceneCategory(category)}
                      className="sr-only"
                      required
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Interactions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {interactionOptions.map((interaction) => (
                  <label
                    key={interaction}
                    className={`flex cursor-pointer items-center justify-between rounded-full border px-4 py-2 text-sm transition hover:border-slate-300 ${
                      sceneInteractions.includes(interaction)
                        ? "border-slate-900 bg-slate-50 font-medium"
                        : "border-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="sceneInteractions"
                      value={interaction}
                      checked={sceneInteractions.includes(interaction)}
                      onChange={() => handleInteractionToggle(interaction)}
                      className="sr-only"
                    />
                    {interaction}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Quantity</label>
              <input
                type="number"
                name="sceneQuantity"
                min={1}
                required
                defaultValue={1}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Delivery date</label>
              <input
                type="date"
                name="sceneDeliveryDate"
                required
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Isaac version</label>
              <select
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
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Company</label>
            <input
              required
              name="company"
              placeholder="Organization"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Robot platform</label>
            <input
              required
              name="robotPlatform"
              placeholder="Arm, mobile base, AMR fleet, etc."
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Use case</span>
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Required semantics</label>
            <textarea
              required
              name="requiredSemantics"
              rows={3}
              placeholder="Collider fidelity, replicator semantics, material IDs, etc."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Exclusivity needs</label>
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
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Budget range</label>
            <select
              name="budgetRange"
              required
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            >
              {budgetRanges.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Deadline</label>
            <input
              type="date"
              name="deadline"
              required
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Anything else we should know?</label>
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
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Your name</label>
            <input
              required
              name="name"
              placeholder="Full name"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</label>
            <input
              required
              type="email"
              name="email"
              placeholder="you@company.com"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Job title</label>
            <input
              required
              name="jobTitle"
              placeholder="Head of Robotics, Simulation Lead, etc."
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Country</label>
            <input
              required
              name="country"
              placeholder="Where you’re based"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
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
            {status === "loading" ? "Sending…" : "Submit & plan walkthrough"}
          </button>
          <p className="text-xs text-slate-500">
            By submitting this form, your information will be processed in accordance with our {" "}
            <a href="/privacy" className="underline transition hover:text-slate-700">
              Privacy Policy
            </a>
            .
          </p>
        </div>
        {message ? (
          <p className={`text-sm ${status === "error" ? "text-red-500" : "text-emerald-600"}`}>{message}</p>
        ) : null}
      </div>
    </form>
  );
}