export function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
        <span className="text-sm uppercase tracking-[0.3em]">Loading</span>
      </div>
    </div>
  );
}
