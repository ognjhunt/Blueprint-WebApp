export function LoadingScreen() {
  return (
    <div className="route-loading flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 opacity-55">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-sm uppercase tracking-[0.3em]">Loading</span>
      </div>
    </div>
  );
}
