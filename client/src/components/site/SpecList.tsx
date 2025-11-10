interface SpecListProps {
  items: { label: string; value: string }[];
}

export function SpecList({ items }: SpecListProps) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {item.label}
          </dt>
          <dd className="mt-2 text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
