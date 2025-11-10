import type { Policy } from "@/data/content";

interface PolicyCardProps {
  policy: Policy;
  isHighlighted?: boolean;
}

export function PolicyCard({ policy, isHighlighted = false }: PolicyCardProps) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition ${
        isHighlighted
          ? "border-emerald-500 shadow-emerald-100"
          : "border-slate-200 hover:-translate-y-1 hover:shadow-md"
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          {policy.tags.join(" • ")}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{policy.title}</h3>
        <p className="text-sm text-slate-600">{policy.summary}</p>
      </div>
      {policy.focusAreas.length ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-500">
          {policy.focusAreas.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-1 h-1 w-1 rounded-full bg-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 text-xs text-slate-400">
        Supports: {policy.environments.length} environment{policy.environments.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
