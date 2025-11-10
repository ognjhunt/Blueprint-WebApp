import { useState } from "react";

interface ApplyFormProps {
  role: string;
  email: string;
}

export function ApplyForm({ role, email }: ApplyFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, role, email }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setStatus("success");
      setMessage("Application received. We’ll reach out if it’s a fit.");
      event.currentTarget.reset();
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("We couldn’t submit your application. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          required
          name="name"
          placeholder="Your name"
          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
        />
        <input
          required
          type="email"
          name="contactEmail"
          placeholder="you@studio.com"
          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>
      <input
        required
        name="portfolio"
        placeholder="Portfolio or reel"
        className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
      />
      <textarea
        name="notes"
        rows={3}
        placeholder="Relevant simulation or environment build experience"
        className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
      />
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
