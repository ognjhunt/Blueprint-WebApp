// import { useId, useState } from "react";

// interface ApplyFormProps {
//   role: string;
//   email: string;
// }

// export function ApplyForm({ role, email }: ApplyFormProps) {
//   const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
//     "idle",
//   );
//   const [message, setMessage] = useState("");
//   const uniqueId = useId();
//   const nameId = `${uniqueId}-name`;
//   const applicantEmailId = `${uniqueId}-email`;
//   const portfolioId = `${uniqueId}-portfolio`;
//   const resumeId = `${uniqueId}-resume`;
//   const notesId = `${uniqueId}-notes`;

//   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
//     const form = event.currentTarget;
//     const data = new FormData(form);
//     data.set("role", role);
//     data.set("email", email);

//     setStatus("loading");
//     setMessage("");

//     try {
//       const res = await fetch("/api/apply", {
//         method: "POST",
//         body: data,
//       });

//       if (!res.ok) {
//         throw new Error("Failed to submit");
//       }

//       setStatus("success");
//       setMessage("");
//       form.reset();
//     } catch (error) {
//       console.error(error);
//       setStatus("error");
//       setMessage("We couldn’t submit your application. Try again.");
//     }
//   };

//   if (status === "success") {
//     return (
//       <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
//         <div className="space-y-3">
//           <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
//             Thanks for applying
//           </span>
//           <h3 className="text-xl font-semibold text-slate-900">
//             We’ll review your materials
//           </h3>
//           <p className="text-sm text-slate-600">
//             Our team will look over your application for the {role} role and
//             reach out at the email you provided if it’s a fit.
//           </p>
//         </div>
//         <div className="flex justify-center">
//           <button
//             type="button"
//             onClick={() => {
//               setStatus("idle");
//               setMessage("");
//             }}
//             className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
//           >
//             Submit another application
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
//       <div className="grid gap-3 sm:grid-cols-2">
//         <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={nameId}>
//           <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
//             Name
//           </span>
//           <input
//           required
//           name="name"
//             id={nameId}
//           placeholder="Your name"
//           className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//           />
//         </label>
//         <label
//           className="flex flex-col gap-2 text-sm text-slate-600"
//           htmlFor={applicantEmailId}
//         >
//           <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
//             Email address
//           </span>
//           <input
//           required
//           type="email"
//           name="contactEmail"
//             id={applicantEmailId}
//           placeholder="you@studio.com"
//           className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//           aria-describedby={`${applicantEmailId}-hint`}
//         />
//           <span id={`${applicantEmailId}-hint`} className="text-xs text-slate-500">
//             We’ll send updates to this address.
//           </span>
//         </label>
//       </div>
//       <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={portfolioId}>
//         <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
//           Portfolio URL
//         </span>
//         <input
//           required
//           type="url"
//           name="portfolio"
//           id={portfolioId}
//           placeholder="https://yourstudio.com/portfolio"
//           className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//           aria-describedby={`${portfolioId}-hint`}
//         />
//         <span id={`${portfolioId}-hint`} className="text-xs text-slate-500">
//           Share your best work, including reels, breakdowns, or project sites.
//         </span>
//       </label>
//       <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={resumeId}>
//         <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
//           Resume or sample (optional)
//         </span>
//         <input
//           type="file"
//           name="resume"
//           id={resumeId}
//           className="w-full rounded-full border border-dashed border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-400 focus:outline-none"
//           aria-describedby={`${resumeId}-hint`}
//         />
//         <span id={`${resumeId}-hint`} className="text-xs text-slate-500">
//           Upload resumes, PDFs, ZIPs, or any supporting files.
//         </span>
//       </label>
//       <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor={notesId}>
//         <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
//           Relevant experience
//         </span>
//         <textarea
//           name="notes"
//           id={notesId}
//           rows={3}
//           placeholder="Share simulation, environment build, or toolchain experience"
//           className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
//         />
//       </label>
//       <button
//         type="submit"
//         className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
//         disabled={status === "loading"}
//       >
//         {status === "loading" ? "Sending…" : "Apply"}
//       </button>
//       {message ? (
//         <p
//           className={`text-sm ${
//             status === "error" ? "text-red-500" : "text-emerald-600"
//           }`}
//         >
//           {message}
//         </p>
//       ) : null}
//     </form>
//   );
// }
import { useId, useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  Loader2,
  Send,
  Paperclip,
} from "lucide-react";

interface ApplyFormProps {
  role: string;
  email: string;
  onCancel?: () => void;
}

export function ApplyForm({ role, email, onCancel }: ApplyFormProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState<string>("");

  const uniqueId = useId();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("role", role);
    data.set("email", email);

    setStatus("loading");
    setMessage("");

    try {
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // const res = await fetch("/api/apply", { method: "POST", body: data });

      setStatus("success");
      setMessage("");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage("Transmission failed. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  if (status === "success") {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-300 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900">Application Sent</h3>
        <p className="mt-2 text-sm text-zinc-600">
          We've received your dossier for <strong>{role}</strong>. Expect a
          confirmation email at the address you provided shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMessage("");
            setFileName("");
          }}
          className="mt-6 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          Submit another application
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-6 animate-in slide-in-from-top-4 fade-in duration-500"
    >
      {/* Personal Info Group */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor={`${uniqueId}-name`}
            className="text-xs font-bold uppercase tracking-wider text-zinc-500"
          >
            Full Name
          </label>
          <input
            required
            name="name"
            id={`${uniqueId}-name`}
            placeholder="Jane Doe"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`${uniqueId}-email`}
            className="text-xs font-bold uppercase tracking-wider text-zinc-500"
          >
            Email Address
          </label>
          <input
            required
            type="email"
            name="contactEmail"
            id={`${uniqueId}-email`}
            placeholder="jane@example.com"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>
      </div>

      {/* Portfolio Link */}
      <div className="space-y-2">
        <label
          htmlFor={`${uniqueId}-portfolio`}
          className="text-xs font-bold uppercase tracking-wider text-zinc-500"
        >
          Portfolio / GitHub
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">
            https://
          </span>
          <input
            required
            type="text" // Changed to text to allow cleaner input without protocol
            name="portfolio"
            id={`${uniqueId}-portfolio`}
            placeholder="dribbble.com/yourname"
            className="w-full rounded-xl border border-zinc-200 bg-white pl-20 pr-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>
      </div>

      {/* File Upload & Experience Grid */}
      <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
        {/* Custom File Input */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Resume / CV
          </span>
          <div className="relative group">
            <input
              type="file"
              name="resume"
              id={`${uniqueId}-resume`}
              onChange={handleFileChange}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${fileName ? "border-indigo-200 bg-indigo-50/50" : "border-zinc-200 bg-zinc-50 group-hover:border-zinc-300"}`}
            >
              {fileName ? (
                <>
                  <Paperclip className="h-6 w-6 text-indigo-500" />
                  <span className="text-xs font-medium text-indigo-700 truncate max-w-[120px]">
                    {fileName}
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                  <span className="text-xs font-medium text-zinc-500">
                    Drop PDF here
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`${uniqueId}-notes`}
            className="text-xs font-bold uppercase tracking-wider text-zinc-500"
          >
            Why Blueprint?
          </label>
          <textarea
            name="notes"
            id={`${uniqueId}-notes`}
            rows={4}
            placeholder="Tell us about your experience with 3D pipelines or simulation..."
            className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Cancel
          </button>
        )}

        <div className="flex items-center gap-4 ml-auto">
          {status === "error" && (
            <span className="text-sm text-red-600">{message}</span>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Submit Application
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
