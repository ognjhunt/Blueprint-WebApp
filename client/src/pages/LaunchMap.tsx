import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialMetricStrip,
  EditorialSectionIntro,
  EditorialSectionLabel,
  ProofChip,
} from "@/components/site/editorial";
import { PublicLaunchMap } from "@/components/site/PublicLaunchMap";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { launchStatusMeta } from "@/lib/launchMap";

export default function LaunchMap() {
  const { data, loading, error } = usePublicLaunchStatus();
  const counts = data?.statusCounts || {
    live: 0,
    planned: 0,
    underReview: 0,
  };
  const cities = data?.cities || [];

  const metrics = [
    {
      label: "Live cities",
      detail: `${counts.live} launch markets currently show public live status.`,
    },
    {
      label: "Planned cities",
      detail: `${counts.planned} rollout lanes are visible but not yet open for public capture.`,
    },
    {
      label: "Under review",
      detail: `${counts.underReview} cities still sit inside launch qualification and city-specific review.`,
    },
    {
      label: "Interaction rule",
      detail: "City details stay inline on this page rather than jumping into separate route views.",
    },
  ];

  const grouped = {
    live: cities.filter((city) => city.status === "live").slice(0, 4),
    planned: cities.filter((city) => city.status === "planned").slice(0, 4),
    under_review: cities.filter((city) => city.status === "under_review").slice(0, 4),
  };

  return (
    <>
      <SEO
        title="Blueprint Launch Map | Public City Rollout"
        description="See where Blueprint is live, planned, and under review across the United States."
        canonical="/launch-map"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-[linear-gradient(180deg,#fbfaf6_0%,#f1efea_100%)]">
          <div className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-14">
            <div className="grid gap-8 lg:grid-cols-[0.62fr_0.38fr] lg:items-end">
              <div className="max-w-[40rem]">
                <EditorialSectionLabel>Public launch map</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  Where Blueprint is live.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-slate-700">
                  This is the public rollout surface. Live, planned, and under-review states stay visible without pretending every city is already open.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <ProofChip>Robot teams</ProofChip>
                <ProofChip>Site operators</ProofChip>
                <ProofChip>Capturers</ProofChip>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-10 sm:px-8 lg:px-10 lg:pb-12">
          <div className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr]">
            <div className="space-y-6">
              <EditorialSectionIntro
                eyebrow="Rollout posture"
                title="Public status should read clearly."
                description="Each city keeps its current launch meaning inline. The map is a public product surface, not a hidden ops dashboard."
              />

              {([
                ["live", grouped.live],
                ["planned", grouped.planned],
                ["under_review", grouped.under_review],
              ] as const).map(([status, list]) => {
                const meta = launchStatusMeta[status];
                return (
                  <div
                    key={status}
                    className="rounded-[1.6rem] border border-black/10 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.22)]"
                  >
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClassName}`}>
                      {meta.label}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{meta.definition}</p>
                    <div className="mt-4 space-y-2 border-t border-black/8 pt-4">
                      {list.length > 0 ? (
                        list.map((city) => (
                          <div key={city.citySlug} className="flex items-center justify-between text-sm text-slate-700">
                            <span>{city.displayName}</span>
                            <span className="text-slate-400">Public</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">No cities currently shown in this state.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              {error ? (
                <div className="rounded-[2rem] border border-black/10 bg-white p-10 text-sm text-slate-600 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.22)]">
                  Blueprint could not load the public launch map right now. Try again shortly.
                </div>
              ) : loading ? (
                <div className="rounded-[2rem] border border-black/10 bg-white p-10 text-sm text-slate-500 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.22)]">
                  Loading launch map…
                </div>
              ) : (
                <PublicLaunchMap cities={cities} />
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Use the launch surface to decide where to lean in."
            description="If the city you care about is already live, move into hosted review or a buyer brief. If it is not, keep the request scoped and truthful."
            imageSrc={editorialGeneratedAssets.homeHero}
            imageAlt="Blueprint rollout proof"
            primaryHref="/book-exact-site-review"
            primaryLabel="Book hosted review"
            secondaryHref="/contact?persona=launch-map"
            secondaryLabel="Talk to Blueprint"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
