import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const budgetRanges = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
] as const;

const offerings = [
  { value: "scene-marketplace", label: "Scene Marketplace - SimReady scenes including add-ons/upsells" },
  { value: "genie-data", label: "Data from Genie Sim 3.0 (Episodes)" },
  { value: "genie-evals", label: "Evals from Genie Sim 3.0 Output" },
  { value: "blueprint-capture", label: "Blueprint Capture for Real-World Locations (Coming Soon)" },
] as const;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selectedBudget, setSelectedBudget] = useState<string>("");
  const [selectedOfferings, setSelectedOfferings] = useState<string[]>([]);

  const handleOfferingToggle = (value: string) => {
    setSelectedOfferings((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Validate required fields
    const missingFields: string[] = [];
    if (!data.get("firstName")?.toString().trim()) missingFields.push("First Name");
    if (!data.get("lastName")?.toString().trim()) missingFields.push("Last Name");
    if (!data.get("company")?.toString().trim()) missingFields.push("Company Name");
    if (!data.get("email")?.toString().trim()) missingFields.push("Work Email");

    if (missingFields.length > 0) {
      setStatus("error");
      setMessage(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    if (!selectedBudget) {
      setStatus("error");
      setMessage("Please select a project budget");
      return;
    }

    if (selectedOfferings.length === 0) {
      setStatus("error");
      setMessage("Please select at least one option for what we can help with");
      return;
    }

    // Build payload
    const payload = {
      name: `${data.get("firstName")} ${data.get("lastName")}`,
      email: data.get("email"),
      company: data.get("company"),
      jobTitle: data.get("jobTitle"),
      country: "United States", // Default, can be made into a field if needed
      budgetRange: selectedBudget,
      requestType: "contact-form",
      useCases: selectedOfferings,
      message: data.get("message"),
      requestSource: "simplified-contact-form",
    };

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorResponse = await res.json().catch(() => null);
        const errorMessage = errorResponse?.error ?? "Failed to send request";
        throw new Error(errorMessage);
      }

      setStatus("success");
      form.reset();
      setSelectedBudget("");
      setSelectedOfferings([]);
      setMessage("");
    } catch (error) {
      console.error("Contact submission failed", error);
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send request. Please try again."
      );
    }
  };

  // Success state
  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">Thank You!</h2>
        <p className="mt-4 max-w-md text-zinc-600">
          We've received your request and will be in touch soon.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-8 rounded-lg bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Submit another request
        </button>
      </div>
    );
  }

  // Form state
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* First Name */}
        <div>
          <input
            type="text"
            name="firstName"
            placeholder="First name*"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Last Name */}
        <div>
          <input
            type="text"
            name="lastName"
            placeholder="Last name*"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Company Name */}
        <div>
          <input
            type="text"
            name="company"
            placeholder="Company name*"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Job Title */}
        <div>
          <input
            type="text"
            name="jobTitle"
            placeholder="Job title*"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      {/* Work Email - Full Width */}
      <div>
        <input
          type="email"
          name="email"
          placeholder="Work email*"
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {/* Project Budget */}
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-white">
          Project Budget*
        </label>
        <div className="space-y-3">
          {budgetRanges.map((range) => (
            <label
              key={range}
              className="flex cursor-pointer items-center gap-3 transition hover:text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selectedBudget === range}
                onChange={() => setSelectedBudget(range)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-sm text-zinc-300">{range}</span>
            </label>
          ))}
        </div>
      </div>

      {/* What can we help with */}
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-white">
          What can we help with? Select all that apply*
        </label>
        <div className="space-y-3">
          {offerings.map((offering) => (
            <label
              key={offering.value}
              className="flex cursor-pointer items-start gap-3 transition hover:text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selectedOfferings.includes(offering.value)}
                onChange={() => handleOfferingToggle(offering.value)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-sm text-zinc-300">{offering.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <textarea
          name="message"
          rows={5}
          placeholder="Share additional details on your needs, we support a wide range of Embodied AI use cases beyond the options above."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {/* Error Message */}
      {status === "error" && message && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {message}
        </div>
      )}

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex items-center gap-2 rounded-lg bg-zinc-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Submitting...
            </>
          ) : (
            <>
              Submit
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
