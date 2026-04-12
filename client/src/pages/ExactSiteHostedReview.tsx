import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { VoiceConcierge } from "@/components/site/VoiceConcierge";

const proofPoints = [
  "One specific facility, not a generic synthetic environment.",
  "Grounded package and hosted-review surfaces tied to the same capture record.",
  "Rights, privacy, provenance, and operator handoffs stay explicit.",
  "Human gates remain on pricing, legal, security, and irreversible commitments.",
];

export default function ExactSiteHostedReview() {
  return (
    <>
      <SEO
        title="Exact-Site Hosted Review | Blueprint"
        description="Blueprint's narrow commercial wedge: one real facility, one workflow question, one grounded package-plus-hosted-review path."
        canonical="/exact-site-hosted-review"
      />

      <div className="min-h-screen bg-[#f6f4ef] text-zinc-950">
        <section className="relative overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_right,_rgba(17,24,39,0.08),_transparent_32%),linear-gradient(180deg,#fff_0%,#f6f4ef_100%)]">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
                  Exact-Site Hosted Review
                </p>
                <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
                  Run the exact site before your robot team travels.
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-700">
                  Use Blueprint when your team wants runtime evidence on one exact facility and one
                  workflow lane. The hosted review stays tied to the same capture-backed package so
                  policy checks, failure review, and exports all stay grounded to the real site.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&source=exact_site_review&utm_source=exact_site_review&utm_medium=hero&utm_campaign=hosted_review_v1"
                    className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    Request the hosted review
                  </Link>
                  <Link
                    href="/world-models"
                    className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-400"
                  >
                    Review live examples
                  </Link>
                </div>
              </div>

              <div className="rounded-[32px] border border-black/5 bg-zinc-950 p-8 text-white shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                  Fixed Wedge
                </p>
                <h2 className="mt-4 text-2xl font-semibold">What this SKU is</h2>
                <div className="mt-6 space-y-4 text-sm leading-6 text-zinc-300">
                  <p>
                    One real site. One workflow lane. One grounded package and hosted-review path.
                  </p>
                  <p>
                    It is designed to help a robot team answer the next deployment question sooner,
                    with provenance intact.
                  </p>
                  <p className="text-zinc-500">
                    It is not a claim that deployment is solved, generalized, or already
                    production-safe.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Why this loop compounds
              </p>
              <ol className="mt-6 space-y-5 text-sm leading-6 text-zinc-700">
                <li>1. Sell one narrow exact-site review motion with a clear next step.</li>
                <li>2. Capture attribution, experiment data, and proof-path objections.</li>
                <li>3. Turn the best proof into new creative, outbound, and follow-up campaigns.</li>
                <li>4. Route support, booking, and edge cases into operator summaries instead of losing them in inboxes.</li>
              </ol>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Trust Boundaries
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {proofPoints.map((point) => (
                  <li
                    key={point}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-700"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.95fr]">
            <VoiceConcierge
              surface="exact_site_hosted_review"
              pageContext="exact-site hosted review landing page"
            />

            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                What happens after the request
              </p>
              <div className="mt-6 space-y-6 text-sm leading-6 text-zinc-700">
                <div>
                  <h3 className="font-semibold text-zinc-950">1. Scope the real site</h3>
                  <p className="mt-2">
                    Blueprint confirms the facility, workflow lane, proof path, and any early
                    rights or privacy blockers.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-950">2. Package the evidence</h3>
                  <p className="mt-2">
                    The review stays tied to the same capture-backed package and hosted-session
                    surfaces.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-950">3. Route edge cases</h3>
                  <p className="mt-2">
                    Pricing, policy, rights, privacy, security, and contract questions stay
                    human-gated.
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <Link
                  href="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&source=exact_site_review_bottom&utm_source=exact_site_review&utm_medium=bottom&utm_campaign=hosted_review_v1"
                  className="inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  Start the hosted-review request
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
