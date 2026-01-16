import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useSearch } from "wouter";
import { withCsrfHeader } from "@/lib/csrf";
import { useAuth } from "@/contexts/AuthContext";

const budgetRanges = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
] as const;

const offerings = [
  { value: "benchmark-packs", label: "Benchmark Packs - Evaluation suites with scenes, tasks & harnesses" },
  { value: "scene-library", label: "Scene Library - Individual SimReady USD scenes" },
  { value: "dataset-packs", label: "Dataset Packs - Pre-generated episodes for offline training" },
  { value: "custom-capture", label: "Custom Scene - On-site facility scan to SimReady environment" },
] as const;

export function ContactForm() {
  const { currentUser, userData } = useAuth();
  const searchString = useSearch();
  const interest = useMemo(() => {
    if (!searchString) return "";
    return new URLSearchParams(searchString).get("interest")?.trim() ?? "";
  }, [searchString]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [detailsMessage, setDetailsMessage] = useState("");
  const [selectedBudget, setSelectedBudget] = useState<string>("");
  const [selectedOfferings, setSelectedOfferings] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const displayName = userData?.name || currentUser?.displayName || "";
    const trimmedName = displayName.trim();
    const [defaultFirstName, ...restName] = trimmedName ? trimmedName.split(/\s+/) : [];
    const defaultLastName = restName.join(" ");
    const defaultCompany = userData?.company || userData?.organizationName || "";
    const defaultJobTitle = userData?.jobTitle || "";
    const defaultEmail = currentUser?.email || "";

    if (!firstName && defaultFirstName) {
      setFirstName(defaultFirstName);
    }

    if (!lastName && defaultLastName) {
      setLastName(defaultLastName);
    }

    if (!company && defaultCompany) {
      setCompany(defaultCompany);
    }

    if (!jobTitle && defaultJobTitle) {
      setJobTitle(defaultJobTitle);
    }

    if (!email && defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [company, currentUser, email, firstName, jobTitle, lastName, userData]);

  useEffect(() => {
    if (interest !== "exclusive-dataset") {
      return;
    }

    setSelectedOfferings((prev) =>
      prev.includes("dataset-packs") ? prev : [...prev, "dataset-packs"]
    );

    setDetailsMessage((prev) =>
      prev.trim().length > 0 ? prev : "Requesting an exclusive dataset license."
    );
  }, [interest]);

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
      message: detailsMessage,
      requestSource: "simplified-contact-form",
      interest,
    };

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorResponse = await res.json().catch(() => null);
        const errorMessage = errorResponse?.error ?? "Failed to send request";
        throw new Error(errorMessage);
      }

      setStatus("success");
      form.reset();
      setFirstName("");
      setLastName("");
      setCompany("");
      setJobTitle("");
      setEmail("");
      setSelectedBudget("");
      setSelectedOfferings([]);
      setDetailsMessage("");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* First Name */}
        <div>
          <input
            type="text"
            name="firstName"
            placeholder="First name*"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Last Name */}
        <div>
          <input
            type="text"
            name="lastName"
            placeholder="Last name*"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Company Name */}
        <div>
          <input
            type="text"
            name="company"
            placeholder="Company name*"
            required
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Job Title */}
        <div>
          <input
            type="text"
            name="jobTitle"
            placeholder="Job title*"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Project Budget */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-zinc-900">
          Project Budget*
        </label>
        <div className="flex flex-wrap gap-2">
          {budgetRanges.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setSelectedBudget(range)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                selectedBudget === range
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* What can we help with */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-zinc-900">
          What can we help with? Select all that apply*
        </label>
        <div className="space-y-2">
          {offerings.map((offering) => (
            <label
              key={offering.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                selectedOfferings.includes(offering.value)
                  ? "border-indigo-200 bg-indigo-50"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedOfferings.includes(offering.value)}
                onChange={() => handleOfferingToggle(offering.value)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <span className="text-sm text-zinc-700">{offering.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <textarea
          name="message"
          rows={4}
          placeholder="Share additional details on your needs, we support a wide range of Embodied AI use cases beyond the options above."
          value={detailsMessage}
          onChange={(event) => setDetailsMessage(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Error Message */}
      {status === "error" && message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {message}
        </div>
      )}

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Submitting...
            </>
          ) : (
            <>
              Submit Request
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
