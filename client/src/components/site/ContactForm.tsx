import { useState } from "react";

const projectTypes = [
  "Procedural synthetic scene",
  "Real-world scan to SimReady",
  "Asset finishing",
  "Consultation",
];

const policyOptions = [
  "Open/slide",
  "Pick-place",
  "Buttons/knobs",
  "Palletize",
  "Bin-pick",
];

const deliveryFormats = ["USD", "USDC", "Both"];

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(
      data.entries(),
    );
    payload["targetPolicies"] = data.getAll("targetPolicies");
    payload["desiredCategories"] = data.getAll("desiredCategories");

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
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("We couldn’t send your request. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 md:grid-cols-2"
    >
      <div className="grid gap-4">
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Contact</label>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <input
              required
              name="name"
              placeholder="Your name"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
            <input
              required
              type="email"
              name="email"
              placeholder="you@company.com"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Company</label>
            <input
              required
              name="company"
              placeholder="Organization"
              className="mt-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Project type</label>
            <select
              name="projectType"
              className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            >
              {projectTypes.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Target policies</label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {policyOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="targetPolicies" value={option} className="h-4 w-4" />
                {option}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Desired categories</label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              "Kitchens",
              "Grocery",
              "Warehouse",
              "Retail",
              "Office",
              "Lab",
              "Utility",
              "Home",
            ].map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="desiredCategories" value={option} className="h-4 w-4" />
                {option}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Timeline</label>
            <input
              name="deadline"
              placeholder="Need by…"
              className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Budget range</label>
            <select
              name="budget"
              className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            >
              <option value="<$10k">Under $10k</option>
              <option value="$10k-$25k">$10k – $25k</option>
              <option value="$25k-$50k">$25k – $50k</option>
              <option value=">$50k">$50k+</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Delivery format</label>
          <div className="mt-3 flex flex-wrap gap-3">
            {deliveryFormats.map((format) => (
              <label key={format} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="radio" name="deliveryFormat" value={format} defaultChecked={format === "USD"} />
                {format}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Isaac version</label>
            <input
              name="isaacVersion"
              placeholder="e.g. 4.2"
              className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Interactables</label>
            <input
              name="interactables"
              placeholder="Number of joints"
              className="mt-2 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Project context</label>
          <textarea
            name="message"
            rows={5}
            placeholder="Tell us about the scene, success criteria, and timeline."
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Request this scene"}
        </button>
        {message ? (
          <p
            className={`text-sm ${
              status === "error" ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
