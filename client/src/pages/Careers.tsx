// import { jobs } from "@/data/content";
// import { ApplyForm } from "@/components/site/ApplyForm";

// export default function Careers() {
//   return (
//     <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
//       <header className="space-y-4">
//         <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//           Careers
//         </p>
//         <h1 className="text-4xl font-semibold text-slate-900">
//           Join the network building the worlds robots learn in.
//         </h1>
//         <p className="max-w-3xl text-sm text-slate-600">
//           Blueprint’s artist and technical director network turns real spaces into SimReady scenes. We’re looking for specialists who love polishing geometry, building simulation-ready assets, and crafting premium training environments.
//         </p>
//       </header>

//       <div className="grid gap-8 md:grid-cols-2">
//         {jobs.map((job) => (
//           <article
//             key={job.title}
//             className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6"
//           >
//             <div className="space-y-2">
//               <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
//                 <span>{job.type}</span>
//                 <span>•</span>
//                 <span>{job.location}</span>
//               </div>
//               <h2 className="text-2xl font-semibold text-slate-900">{job.title}</h2>
//               <p className="text-sm text-slate-600">{job.summary}</p>
//             </div>
//             <p className="mt-4 text-sm text-slate-600">{job.description}</p>
//             <ApplyForm role={job.title} email={job.applyEmail} />
//           </article>
//         ))}
//       </div>
//     </div>
//   );
// }
import { useState } from "react";
import { jobs } from "@/data/content";
import { ApplyForm } from "@/components/site/ApplyForm";
import { SEO } from "@/components/SEO";
import {
  Briefcase,
  MapPin,
  ArrowRight,
  Users,
  Sparkles,
  Code2,
  PenTool,
  Box,
} from "lucide-react";

// --- Helper Components ---

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

function getRoleIcon(title: string) {
  if (title.includes("Artist") || title.includes("3D"))
    return <PenTool className="h-5 w-5" />;
  if (title.includes("Engineer") || title.includes("Developer"))
    return <Code2 className="h-5 w-5" />;
  if (title.includes("Product") || title.includes("Lead"))
    return <Box className="h-5 w-5" />;
  return <Sparkles className="h-5 w-5" />;
}

export default function Careers() {
  // Track which job is currently expanded for application
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  return (
    <>
      <SEO
        title="Careers"
        description="Join Blueprint's artist and technical director network. We're looking for specialists who love building simulation-ready assets with real physics constraints and certification gates."
        canonical="/careers"
      />
      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* --- Header --- */}
          <header className="mb-20 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
              <Users className="h-3 w-3" />
              Join the Network
            </div>

          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl md:max-w-2xl">
            Build the worlds <br />
            <span className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl md:max-w-2xl">
              robots learn in.
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 md:mx-0 mx-auto">
            Blueprint’s artist and technical director network turns real spaces
            into certified SimReady scenes. We’re looking for specialists who love
            polishing geometry, authoring colliders and articulation, and shipping
            assets that pass real physics QA gates.
          </p>
        </header>

        {/* --- Job Board --- */}
        <div className="space-y-6">
          {jobs.map((job) => {
            const isExpanded = expandedJob === job.title;
            const Icon = getRoleIcon(job.title);

            return (
              <article
                key={job.title}
                className={`group relative overflow-hidden rounded-3xl border transition-all duration-500 ${
                  isExpanded
                    ? "border-indigo-600 bg-white shadow-xl ring-1 ring-indigo-600"
                    : "border-zinc-200 bg-white hover:border-indigo-200 hover:shadow-md"
                }`}
              >
                <div className="p-6 sm:p-8">
                  {/* Card Header */}
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                          isExpanded
                            ? "bg-indigo-600 text-white"
                            : "bg-zinc-100 text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                        }`}
                      >
                        {Icon}
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-xl font-bold text-zinc-900">
                          {job.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            {job.type}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isExpanded && (
                      <button
                        onClick={() => setExpandedJob(job.title)}
                        className="group/btn flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-600 hover:pr-4"
                      >
                        Apply Now
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    )}
                  </div>

                  {/* Description Content */}
                  <div className="mt-6 pl-[68px]">
                    <p className="text-sm leading-relaxed text-zinc-600 max-w-3xl">
                      {job.summary}
                    </p>

                    {/* Expanded Details */}
                    <div
                      className={`grid transition-all duration-500 ease-in-out ${
                        isExpanded
                          ? "grid-rows-[1fr] opacity-100 mt-6"
                          : "grid-rows-[0fr] opacity-0 mt-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="rounded-2xl bg-zinc-50/50 p-6 border border-zinc-100">
                          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-2">
                            Role Overview
                          </h3>
                          <p className="text-sm text-zinc-600 mb-8 leading-relaxed">
                            {job.description}
                          </p>

                          <div className="border-t border-zinc-200 pt-8">
                            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                              Application
                            </h3>
                            <ApplyForm
                              role={job.title}
                              email={job.applyEmail}
                              onCancel={() => setExpandedJob(null)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* --- Empty State / General Inquiries --- */}
        {jobs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
            <p className="text-zinc-500">No open positions at the moment.</p>
            <p className="mt-2 text-sm text-zinc-400">
              Check back later or email us directly.
            </p>
          </div>
        )}

        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-500">
            Don't see a fit? We're always looking for talent. <br />
            Email your portfolio to{" "}
            <a
              href="mailto:careers@tryblueprint.io"
              className="font-bold text-zinc-900 underline hover:text-indigo-600"
            >
              careers@tryblueprint.io
            </a>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
