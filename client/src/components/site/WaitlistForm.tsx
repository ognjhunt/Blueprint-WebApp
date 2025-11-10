import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [locationType, setLocationType] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locationType }),
      });

      if (!res.ok) {
        throw new Error("Failed to join waitlist");
      }

      setStatus("success");
      setMessage("You're on the waitlist. We'll be in touch soon.");
      setEmail("");
      setLocationType("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
    >
      <label className="flex-1 text-sm text-slate-500">
        <span className="sr-only">Work email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
        />
      </label>
      <label className="flex-1 text-sm text-slate-500">
        <span className="sr-only">Location type</span>
        <input
          required
          value={locationType}
          onChange={(event) => setLocationType(event.target.value)}
          placeholder="e.g. Grocery micro-fulfillment"
          className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Submitting…" : "Join waitlist"}
      </button>
    </form>
    {message ? (
      <p
        className={`mt-2 text-xs ${
          status === "error" ? "text-red-500" : "text-emerald-600"
        }`}
      >
        {message}
      </p>
    ) : null}
  );
}
