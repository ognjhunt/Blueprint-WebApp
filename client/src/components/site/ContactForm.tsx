import { useState } from "react";

const requestPaths = [
  {
    id: "dataset",
    label: "I need a dataset",
    description:
      "Recommended for labs and autonomy teams that need broad coverage across layouts, tasks, and interaction types.",
  },
  {
    id: "scene",
    label: "I need a specific scene",
    description: "Order a targeted scene with the exact fixtures and interactions you need to validate a workflow.",
  },
] as const;

const datasetTiers = [
  {
    value: "pilot",
    title: "Pilot",
    metrics: "5 scenes · 30–50 articulated links · 50–100 pickable props",
    note: "Replicator semantics optional.",
  },
  {
    value: "lab-pack",
    title: "Lab Pack",
    metrics: "20–30 scenes · 200–400 articulated links · Full semantics",
    note: "Includes Isaac 4.x/5.x validation notes.",
  },
  {
    value: "enterprise",
    title: "Enterprise / Custom",
    metrics: "50–100+ scenes · On-site capture option",
    note: "Exclusivity and SLA coverage available.",
  },
] as const;

const sceneCategories = ["Kitchen", "Warehouse", "Retail", "Office", "Lab"] as const;

const interactionOptions = [
  "Revolute",
  "Prismatic",
  "Buttons",
  "Knobs",
  "Pickables",
] as const;

const useCaseOptions = [
  "Open",
  "Slide",
  "Pick-place",
  "Palletize",
] as const;

const exclusivityOptions = [
  { value: "non-exclusive", label: "Non-exclusive (shared catalog)" },
  { value: "exclusive", label: "Exclusive / SLA" },
] as const;

const budgetRanges = [
  "Under $10k",
  "$10k – $25k",
  "$25k – $50k",
  "$50k+",
] as const;

const isaacVersions = ["Isaac 3.x", "Isaac 4.x", "Isaac 5.x", "Other"] as const;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selectedPath, setSelectedPath] = useState<(typeof requestPaths)[number]["id"]>("dataset");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(data.entries());
    payload["useCases"] = data.getAll("useCases");
    payload["sceneInteractions"] = data.getAll("sceneInteractions");

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

      setStatus("success");
      setMessage("Thanks — we’ll review and follow up within one business day.");
      event.currentTarget.reset();
      setSelectedPath("dataset");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("We couldn’t send your request. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 md:p-10"
    >
      <section className="grid gap-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Choose your path</p>
        <div className="grid gap-4 md:grid-cols-2">
          {requestPaths.map((path) => {
            const isActive = selectedPath === path.id;
            return (
              <label
                key={path.id}
                className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-slate-300 ${
                  isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{path.label}</span>
                  <input
                    type="radio"
                    name="requestType"
                    value={path.id}
                    checked={isActive}
                    onChange={() => setSelectedPath(path.id)}
                    className="h-4 w-4"
                  />
                </div>
                <p className={`text-xs leading-relaxed ${isActive ? "text-white/80" : "text-slate-500"}`}>
                  {path.description}
                </p>
              </label>
            );
          })}
        </div>
      </section>

      {selectedPath === "dataset" ? (
        <section className="grid gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dataset tiers</p>
          <div className="grid gap-4 md:grid-cols-3">
            {datasetTiers.map((tier) => (
              <label
                key={tier.value}
                className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-slate-900">{tier.title}</span>
                  <input
                    type="radio"
                    name="datasetTier"
                    value={tier.value}
                    defaultChecked={tier.value === "pilot"}
                    className="h-4 w-4"
                  />
                </div>
                <p className="text-xs text-slate-600">{tier.metrics}</p>
                <p className="text-xs text-slate-500">{tier.note}</p>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid gap-6">
          <div className="grid gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scene category</p>
            <div className="flex flex-wrap gap-3">
              {sceneCategories.map((category, index) => (
                <label
                  key={category}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm transition hover:border-slate-300"
                >
                  <input
                    type="radio"
                    name="sceneCategory"
                    value={category}
                    defaultChecked={index === 0}
                    className="h-4 w-4"
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Interactions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {interactionOptions.map((interaction) => (
                <label key={interaction} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input type="checkbox" name="sceneInteractions" value={interaction} className="h-4 w-4" />
                  {interaction}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              Quantity
              <input
                type="number"
                name="sceneQuantity"
                min={1}
                defaultValue={1}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              Delivery date
              <input
                type="date"
                name="sceneDeliveryDate"
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              Isaac version
              <select
                name="sceneIsaacVersion"
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              >
                {isaacVersions.map((version) => (
                  <option key={version}>{version}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          Name
          <input
            required
            name="name"
            placeholder="Your name"
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          />
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          Work email
          <input
            required
            type="email"
            name="email"
            placeholder="you@company.com"
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          />
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          Company
          <input
            required
            name="company"
            placeholder="Organization"
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          />
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          Robot platform
          <input
            name="robotPlatform"
            placeholder="Platform, arm, or AMR"
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          />
        </label>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Use case</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {useCaseOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input type="checkbox" name="useCases" value={option} className="h-4 w-4" />
                {option}
              </label>
            ))}
          </div>
        </div>
        <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          Required semantics
          <textarea
            name="requiredSemantics"
            rows={4}
            placeholder="Semantic layers, annotations, or Replicator requirements"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          />
        </label>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Exclusivity needs</p>
          <div className="grid gap-2">
            {exclusivityOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input type="radio" name="exclusivity" value={option.value} defaultChecked={option.value === "non-exclusive"} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            Budget range
            <select
              name="budget"
              required
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              {budgetRanges.map((range) => (
                <option key={range}>{range}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
            Deadline
            <input
              type="date"
              name="deadline"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Anything else?</p>
        <textarea
          name="message"
          rows={4}
          placeholder="Context, success criteria, datasets you admire, or delivery constraints"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Submit request"}
        </button>
        {message ? (
          <p className={`text-sm ${status === "error" ? "text-red-500" : "text-emerald-600"}`}>{message}</p>
        ) : null}
      </div>
    </form>
  );
}
