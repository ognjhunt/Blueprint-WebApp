// import { ContactForm } from "@/components/site/ContactForm";

// export default function Contact() {
//   return (
//     <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
//       <header className="space-y-4">
//         <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//           Real-world capture + marketplace wishlist
//         </p>
//         <h1 className="text-4xl font-semibold text-slate-900">
//           Scan the site you care about or steer the next drop.
//         </h1>
//         <p className="max-w-3xl text-sm text-slate-600">
//           Most teams land here to book a real-world SimReady capture. We send a
//           crew, scan your facility, and hand back a validated USD/URDF scene so
//           you can tune policies against the layout you actually deploy. If
//           you’re primarily buying synthetic data, use the wishlist path to tell
//           us which policy, object, or location types you need most—the signal
//           helps decide the next drops.
//         </p>
//       </header>
//       <ContactForm />
//     </div>
//   );
// }
import { ContactForm } from "@/components/site/ContactForm";
import { MessageSquare } from "lucide-react";

const SHOW_REAL_WORLD_CAPTURE = false;

const badgeLabel = SHOW_REAL_WORLD_CAPTURE
  ? "Capture & Marketplace Requests"
  : "Marketplace & Photo Rebuild Requests";

const headingLead = SHOW_REAL_WORLD_CAPTURE
  ? "Scan a site, upload a photo, or"
  : "Upload a photo or";

const headingEmphasis = "steer the roadmap.";

const descriptionWithCapture =
  "Book a real-world SimReady capture, upload a single wide photo of a supported archetype for an exclusive reconstruction (default—you can opt into open catalog), or steer the synthetic marketplace roadmap. Tell us which policy, object, or location types you need most—the signal helps decide our next drops.";

const descriptionWithoutCapture =
  "Upload a single wide photo of a supported archetype for an exclusive reconstruction (default—you can opt into open catalog), or steer the synthetic marketplace roadmap. Tell us which policy, object, or location types you need most—the signal helps decide our next drops.";

// --- Visual Helper ---
function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern)"
      />
    </svg>
  );
}

export default function Contact() {
  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      <DotPattern />

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-16 space-y-6 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-500 shadow-sm">
            <MessageSquare className="h-3 w-3" />
            {badgeLabel}
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
            {headingLead} <br />
            <span className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              {headingEmphasis}
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 sm:mx-0">
            {SHOW_REAL_WORLD_CAPTURE
              ? descriptionWithCapture
              : descriptionWithoutCapture}
          </p>
        </header>

        <div className="mb-12 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <img
            src="/images/Gemini_Contact.png"
            alt="Upload a photo to receive a SimReady scene"
            className="w-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Main Form Component */}
        <ContactForm />

        {/* Footer Support Note */}
        <div className="mt-12 text-center text-sm text-zinc-500">
          Need to talk to sales directly? Email us at{" "}
          <a
            href="mailto:hello@tryblueprint.io"
            className="font-bold text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-900"
          >
            hello@tryblueprint.io
          </a>
        </div>
      </div>
    </div>
  );
}
