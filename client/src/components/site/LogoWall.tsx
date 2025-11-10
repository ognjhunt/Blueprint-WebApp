const placeholders = [
  "Nvidia Omniverse",
  "Isaac Sim",
  "Isaac Lab",
];

export function LogoWall() {
  return (
    <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.3em] text-slate-400">
      <span className="text-slate-500">Built for teams using</span>
      {placeholders.map((name) => (
        <span key={name} className="rounded-full border border-slate-200 px-3 py-1 text-slate-500">
          {name}
        </span>
      ))}
      <span className="text-slate-400">and more</span>
    </div>
  );
}
