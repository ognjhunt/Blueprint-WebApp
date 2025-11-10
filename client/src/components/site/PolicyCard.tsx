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
// import type { Policy } from "@/data/content";

// interface PolicyCardProps {
//   policy: Policy;
//   isHighlighted?: boolean;
// }

// export function PolicyCard({ policy, isHighlighted = false }: PolicyCardProps) {
//   return (
//     <div
//       className={`flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition ${
//         isHighlighted
//           ? "border-emerald-500 shadow-emerald-100"
//           : "border-slate-200 hover:-translate-y-1 hover:shadow-md"
//       }`}
//     >
//       <div className="flex flex-col gap-2">
//         <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
//           {policy.tags.join(" • ")}
//         </div>
//         <h3 className="text-lg font-semibold text-slate-900">{policy.title}</h3>
//         <p className="text-sm text-slate-600">{policy.summary}</p>
//       </div>
//       {policy.focusAreas.length ? (
//         <ul className="mt-4 space-y-2 text-sm text-slate-500">
//           {policy.focusAreas.map((item) => (
//             <li key={item} className="flex gap-2">
//               <span aria-hidden className="mt-1 h-1 w-1 rounded-full bg-emerald-500" />
//               <span>{item}</span>
//             </li>
//           ))}
//         </ul>
//       ) : null}
//       <div className="mt-6 text-xs text-slate-400">
//         Supports: {policy.environments.length} environment{policy.environments.length === 1 ? "" : "s"}
//       </div>
//     </div>
//   );
// }