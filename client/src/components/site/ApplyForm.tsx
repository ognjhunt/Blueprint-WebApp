import { useId, useState } from "react";

interface ApplyFormProps {
  role: string;
  email: string;
}

export function ApplyForm({ role, email }: ApplyFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const uniqueId = useId();
  const nameId = `${uniqueId}-name`;
  const applicantEmailId = `${uniqueId}-email`;
  const portfolioId = `${uniqueId}-portfolio`;
  const resumeId = `${uniqueId}-resume`;
  const notesId = `${uniqueId}-notes`;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("role", role);
    data.set("email", email);

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setStatus("success");
      setMessage("");
      form.reset();
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("We couldn’t submit your application. Try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
        <div className="space-y-3">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Thanks for applying
          </span>
          <h3 className="text-xl font-semibold text-slate-900">
            We’ll review your materials
          </h3>
          <p className="text-sm text-slate-600">
            Our team will look over your application for the {role} role and
            reach out at the email you provided if it’s a fit.
          </p>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setMessage("");
            }}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            Submit another application
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={nameId}>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Name
          </span>
          <input
          required
          name="name"
            id={nameId}
          placeholder="Your name"
          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </label>
        <label
          className="flex flex-col gap-2 text-sm text-slate-600"
          htmlFor={applicantEmailId}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Email address
          </span>
          <input
          required
          type="email"
          name="contactEmail"
            id={applicantEmailId}
          placeholder="you@studio.com"
          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
          aria-describedby={`${applicantEmailId}-hint`}
        />
          <span id={`${applicantEmailId}-hint`} className="text-xs text-slate-500">
            We’ll send updates to this address.
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={portfolioId}>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Portfolio URL
        </span>
        <input
          required
          type="url"
          name="portfolio"
          id={portfolioId}
          placeholder="https://yourstudio.com/portfolio"
          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
          aria-describedby={`${portfolioId}-hint`}
        />
        <span id={`${portfolioId}-hint`} className="text-xs text-slate-500">
          Share your best work—reels, breakdowns, or project sites.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={resumeId}>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Resume or sample (optional)
        </span>
        <input
          type="file"
          name="resume"
          id={resumeId}
          className="w-full rounded-full border border-dashed border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-400 focus:outline-none"
          aria-describedby={`${resumeId}-hint`}
        />
        <span id={`${resumeId}-hint`} className="text-xs text-slate-500">
          Upload resumes, PDFs, ZIPs, or any supporting files.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={notesId}>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Relevant experience
        </span>
        <textarea
          name="notes"
          id={notesId}
          rows={3}
          placeholder="Share simulation, environment build, or toolchain experience"
          className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Sending…" : "Apply"}
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
    </form>
  );
}
