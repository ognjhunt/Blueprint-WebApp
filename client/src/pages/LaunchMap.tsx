import { SEO } from "@/components/SEO";
import { PublicLaunchMap } from "@/components/site/PublicLaunchMap";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { launchStatusMeta } from "@/lib/launchMap";

export default function LaunchMap() {
  const { data, loading, error } = usePublicLaunchStatus();
  const counts = data?.statusCounts || {
    live: 0,
    planned: 0,
    underReview: 0,
  };

  return (
    <>
      <SEO
        title="Blueprint Launch Map | Public City Rollout"
        description="See where Blueprint is live, planned, and under review across the United States."
        canonical="/launch-map"
      />

      <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
        <section className="border-b border-[color:var(--line)] bg-[radial-gradient(circle_at_top_left,_rgba(21,128,61,0.1),_transparent_32%),linear-gradient(180deg,#fffdf8_0%,#f5f0e6_100%)]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
                Public launch map
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                Where Blueprint is live.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-[color:var(--ink-soft)]">
                This is the public rollout surface for robot teams, site operators, and
                capturers. Live cities can support direct public capture actions. Planned and
                under-review cities stay clearly gated until the city-launch org changes their
                status.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["live", counts.live],
                ["planned", counts.planned],
                ["under_review", counts.underReview],
              ].map(([status, count]) => {
                const meta = launchStatusMeta[status as keyof typeof launchStatusMeta];

                return (
                  <article key={status} className="rounded-[1.4rem] border border-[color:var(--line)] bg-white/80 p-5">
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClassName}`}
                    >
                      {meta.label}
                    </div>
                    <p className="mt-4 text-3xl font-semibold">{count}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                      {meta.definition}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {error ? (
            <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
              Blueprint could not load the public launch map right now. Try again shortly.
            </div>
          ) : loading ? (
            <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-10 text-center text-sm text-[color:var(--ink-muted)]">
              Loading launch map…
            </div>
          ) : (
            <PublicLaunchMap cities={data?.cities ?? []} />
          )}
        </section>
      </div>
    </>
  );
}
