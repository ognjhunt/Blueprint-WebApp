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
	      detail: `${counts.live} launch markets currently show public live status for capture access.`,
	    },
	    {
	      label: "Planned",
	      detail: `${counts.planned} rollout lanes are tracked without implying public capture is open.`,
	    },
	    {
	      label: "Under review",
	      detail: `${counts.underReview} cities are under review for demand, capturer coverage, and site supply.`,
	    },
	    {
	      label: "Request path",
	      detail: "If a city is not live yet, the useful action is to request the city or submit a site lead.",
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
	        title="Blueprint Launch Map | City Requests And Rollout Status"
	        description="See truthful Blueprint city rollout status and request public-facing capture coverage for a city or site."
	        canonical="/launch-map"
	      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-[linear-gradient(180deg,#fbfaf6_0%,#f1efea_100%)]">
          <div className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-14">
            <div className="grid gap-8 lg:grid-cols-[0.62fr_0.38fr] lg:items-end">
              <div className="max-w-[40rem]">
	                <EditorialSectionLabel>Public launch map</EditorialSectionLabel>
	                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
	                  Request the next city or site.
	                </h1>
	                <p className="mt-6 max-w-[30rem] text-base leading-8 text-slate-700">
	                  This page keeps rollout status honest. If your city is not live yet, send the public-facing location or capture market Blueprint needs to prioritize.
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
	                title="Public status stays narrow."
	                description="Only live cities imply public capture access. Planned and under-review markets are demand signals, not open capture availability."
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
                    <div className="mt-4 space-y-2 border-t border-black/10 pt-4">
                      {list.length > 0 ? (
                        list.map((city) => (
                          <div key={city.citySlug} className="flex items-center justify-between text-sm text-slate-700">
                            <span>{city.displayName}</span>
                            <span className="text-slate-400">Public</span>
                          </div>
                        ))
                      ) : (
	                        <p className="text-sm leading-6 text-slate-400">
	                          No public cities currently shown in this state. Use the request path to add city or site demand.
	                        </p>
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
	            title="Tell Blueprint which city or place matters."
	            description="Send the city, public-facing location type, and whether you are a robot team, site operator, or capturer. Blueprint keeps the status truthful until the market is actually open."
	            imageSrc={editorialGeneratedAssets.homeHero}
	            imageAlt="Blueprint rollout proof"
	            primaryHref="/contact?persona=launch-map"
	            primaryLabel="Request a city or site"
	            secondaryHref="/capture-app/launch-access?source=launch-map"
	            secondaryLabel="Join capture access"
	            dark={false}
	          />
        </section>
      </div>
    </>
  );
}
