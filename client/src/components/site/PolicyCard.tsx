import type { EnvironmentPolicy } from "@/data/content";

interface PolicyCardProps {
  policy: EnvironmentPolicy;
}

export function PolicyCard({ policy }: PolicyCardProps) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <header className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Policy
        </span>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white">
          {policy.focus}
        </span>
      </header>

      <div>
        <h3 className="text-lg font-semibold text-slate-900">{policy.title}</h3>
        <p className="mt-2 text-sm text-slate-600">{policy.summary}</p>
      </div>

      <ul className="flex flex-col gap-2 text-sm text-slate-600">
        {policy.coverage.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span>{policy.cadence}</span>
        {policy.metric ? (
          <span className="text-sm font-medium normal-case tracking-normal text-slate-900">
            {policy.metric}
          </span>
        ) : null}
      </footer>
    </article>
  );
}
