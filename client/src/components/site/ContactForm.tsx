import { useEffect, useMemo, useState, useCallback } from "react";
import { CheckCircle2, Calendar, Mail, ArrowRight, Clock } from "lucide-react";
import { useSearch } from "wouter";
import { withCsrfHeader } from "@/lib/csrf";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BudgetBucket,
  HelpWithOption,
  InboundRequestPayload,
  SubmitInboundRequestResponse,
  UTMParams,
} from "@/types/inbound-request";

const budgetRanges: BudgetBucket[] = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
];

const offerings: { value: HelpWithOption; label: string }[] = [
  { value: "benchmark-packs", label: "Benchmark Packs - Evaluation suites with scenes, tasks & harnesses" },
  { value: "scene-library", label: "Scene Library - Individual SimReady USD scenes" },
  { value: "dataset-packs", label: "Dataset Packs - Pre-generated episodes for offline training" },
  { value: "custom-capture", label: "Custom Scene - On-site facility scan to SimReady environment" },
];

/**
 * Generate a UUID v4 for request idempotency
 */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extract UTM parameters from URL
 */
function getUTMParams(): UTMParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || null,
    medium: params.get("utm_medium") || null,
    campaign: params.get("utm_campaign") || null,
    term: params.get("utm_term") || null,
    content: params.get("utm_content") || null,
  };
}

/**
 * Get the referrer URL
 */
function getReferrer(): string | null {
  if (typeof document === "undefined") return null;
  return document.referrer || null;
}

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
  const [selectedBudget, setSelectedBudget] = useState<BudgetBucket | "">("");
  const [selectedOfferings, setSelectedOfferings] = useState<HelpWithOption[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  // Honeypot field for anti-bot (hidden from users)
  const [honeypot, setHoneypot] = useState("");
  // Store the submitted request ID for reference
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

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

  const handleOfferingToggle = useCallback((value: HelpWithOption) => {
    setSelectedOfferings((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  }, []);

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

    // Validate email format
    const emailValue = data.get("email")?.toString().trim() || "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    // Generate a unique request ID for idempotency
    const requestId = generateRequestId();

    // Build payload with context
    const payload: InboundRequestPayload = {
      requestId,
      firstName: data.get("firstName")?.toString().trim() || "",
      lastName: data.get("lastName")?.toString().trim() || "",
      company: data.get("company")?.toString().trim() || "",
      roleTitle: data.get("jobTitle")?.toString().trim() || "",
      email: emailValue.toLowerCase(),
      budgetBucket: selectedBudget as BudgetBucket,
      helpWith: selectedOfferings,
      details: detailsMessage.trim() || undefined,
      context: {
        sourcePageUrl: typeof window !== "undefined" ? window.location.href : "",
        referrer: getReferrer() || undefined,
        utm: getUTMParams(),
        timezoneOffset: new Date().getTimezoneOffset(),
        locale: typeof navigator !== "undefined" ? navigator.language : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
      // Include honeypot for bot detection
      honeypot: honeypot || undefined,
    };

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/inbound-request", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      const response: SubmitInboundRequestResponse = await res.json();

      if (!res.ok || !response.ok) {
        throw new Error(response.message || "Failed to send request");
      }

      setSubmittedRequestId(response.requestId);
      setStatus("success");

      // Track analytics event
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "request_submitted", {
          event_category: "lead",
          event_label: selectedOfferings.join(","),
          value: selectedBudget,
        });
      }

      // Reset form state
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
      setHoneypot("");
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

  const handleResetForm = useCallback(() => {
    setStatus("idle");
    setSubmittedRequestId(null);
  }, []);

  // Success state with enhanced UI
  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">Thank You!</h2>
        <p className="mt-4 max-w-md text-zinc-600">
          We've received your request and will get back to you within 24 hours.
        </p>

        {/* What happens next */}
        <div className="mt-8 w-full max-w-md rounded-xl bg-zinc-50 p-6 text-left">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">What happens next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                1
              </div>
              <p className="text-sm text-zinc-600">
                Our team reviews your request and product needs
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                2
              </div>
              <p className="text-sm text-zinc-600">
                We reach out to schedule a call to understand your requirements
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                3
              </div>
              <p className="text-sm text-zinc-600">
                You receive a customized proposal based on your project scope
              </p>
            </div>
          </div>
        </div>

        {/* CTA: Book a call */}
        <div className="mt-8 w-full max-w-md">
          <p className="mb-3 text-sm text-zinc-500">Want to get started faster?</p>
          <a
            href="https://calendly.com/blueprintar/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Calendar className="h-4 w-4" />
            Book a 30-min Call
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Contact email */}
        <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <Mail className="h-4 w-4" />
          <span>Or email us at</span>
          <a
            href="mailto:hello@tryblueprint.io"
            className="font-medium text-indigo-600 hover:underline"
          >
            hello@tryblueprint.io
          </a>
        </div>

        {/* Submit another request */}
        <button
          onClick={handleResetForm}
          className="mt-8 text-sm text-zinc-500 underline hover:text-zinc-700"
        >
          Submit another request
        </button>

        {/* Reference ID (for support) */}
        {submittedRequestId && (
          <p className="mt-4 text-xs text-zinc-400">
            Reference ID: {submittedRequestId.slice(0, 8)}
          </p>
        )}
      </div>
    );
  }

  // Form state
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot field - hidden from users, visible to bots */}
      <div className="absolute left-[-9999px] opacity-0" aria-hidden="true">
        <label htmlFor="website_url">Website</label>
        <input
          type="text"
          id="website_url"
          name="website_url"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

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

      {/* Response time indicator */}
      <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <Clock className="h-4 w-4 text-zinc-400" />
        <span>We typically respond within 24 hours</span>
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
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
