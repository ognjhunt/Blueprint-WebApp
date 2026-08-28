export function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-paper-0">
      <div className="flex flex-col items-center gap-3 text-runway-faint">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-runway-line border-t-slate-900" />
        <span className="text-sm uppercase tracking-[0.3em]">Loading</span>
      </div>
    </div>
  );
}
