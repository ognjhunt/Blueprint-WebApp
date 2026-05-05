import { ArrowRight, MapPinned } from "lucide-react";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { getLaunchCitiesByStatus } from "@/lib/publicLaunchStatus";

export function LaunchMapTeaser() {
  const { data, loading } = usePublicLaunchStatus();
  const liveCities = getLaunchCitiesByStatus(data?.cities ?? [], "live");

  return (
    <section className="rounded-[2rem] border border-[color:var(--line)] bg-[radial-gradient(circle_at_top_left,_rgba(21,128,61,0.12),_transparent_32%),linear-gradient(180deg,#fffdf8_0%,#f4efe4_100%)] p-6 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-strong)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
            <MapPinned className="h-3.5 w-3.5" />
            Public launch truth
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-4xl">
            Where Blueprint is live, planned, and under review.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--ink-soft)]">
            The map is the public answer to launch availability. Live cities can support stronger
            capture actions. Planned and under-review cities stay in future-city interest and
            launch work until Blueprint marks them open.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="/launch-map"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--leaf-deep)]"
            >
              Open launch map
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="/capture"
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--line-strong)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
            >
              Read capture basics
            </a>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
            Live now
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {loading ? (
              <span className="text-sm text-[color:var(--ink-muted)]">Loading launch cities…</span>
            ) : liveCities.length ? (
              liveCities.map((city) => (
                <span
                  key={city.citySlug}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-900"
                >
                  {city.displayName}
                </span>
              ))
            ) : (
              <span className="text-sm text-[color:var(--ink-muted)]">No live cities are currently listed.</span>
            )}
          </div>
          <p className="mt-4 text-sm leading-6 text-[color:var(--ink-soft)]">
            Use the dedicated map to inspect the full United States map, hover each city, and
            open the role-specific next actions without leaving the page.
          </p>
        </div>
      </div>
    </section>
  );
}
