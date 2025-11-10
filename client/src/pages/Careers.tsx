import { jobs } from "@/data/content";
import { ApplyForm } from "@/components/site/ApplyForm";

export default function Careers() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Careers
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Join the network building the worlds robots learn in.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Blueprint’s artist and technical director network turns real spaces into SimReady scenes. We’re looking for specialists who love polishing geometry, building simulation-ready assets, and crafting premium training environments.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {jobs.map((job) => (
          <article
            key={job.title}
            className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>{job.type}</span>
                <span>•</span>
                <span>{job.location}</span>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">{job.title}</h2>
              <p className="text-sm text-slate-600">{job.summary}</p>
            </div>
            <p className="mt-4 text-sm text-slate-600">{job.description}</p>
            <ApplyForm role={job.title} email={job.applyEmail} />
          </article>
        ))}
      </div>
    </div>
  );
}
