import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function PropertyOS() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100">
      {/* BACKGROUND: aurora wash + subtle dot/grid */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* dots/grid via radial-gradient */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* emerald→cyan vertical wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
      </div>

      <Nav />

      <main className="flex-1 pt-24 px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 md:p-8 shadow-xl">
            <article className="prose prose-invert prose-slate md:prose-lg max-w-none">
              <h1 className="mb-4 font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                propertyOS – our third phase
              </h1>

              <p>
                Blueprint is building the operating system for physical
                spaces. Our motto is{" "}
                <strong>“know the place to serve the person.”</strong>{" "}
                propertyOS brings that vision to real estate. For{" "}
                <em>listings</em>, it delivers immersive, on-site AR staging and
                AI answers that boost buyer confidence. For <em>residents</em>,
                it introduces a persistent home layer that anyone in the
                household can use to personalize their space beyond the limits
                of the physical world.
              </p>

              <h2>Two programs for impact</h2>
              <p>
                propertyOS ships in two coordinated programs: the{" "}
                <strong>Seller Experience Suite</strong> (for listing agents &
                sellers) and the <strong>Resident Experience Suite</strong> (for
                owners & housemates). Both run on the same spatial map of the
                home, so improvements on one side compound benefits on the
                other.
              </p>

              <h3>Seller Experience Suite</h3>
              <ul>
                <li>
                  <strong>AR staging overlays:</strong> Instantly furnish vacant
                  or dated rooms with lifelike layouts, finishes, and
                  lighting, toggled live during showings or captured in 3D tours.
                </li>
                <li>
                  <strong>Design “switchers”:</strong> One tap to preview styles
                  (modern, cozy, minimalist), flooring/paint swaps, or
                  kitchen/bath variations, without moving a single couch.
                </li>
                <li>
                  <strong>Guided tours + hotspots:</strong> Visitors follow
                  subtle AR cues with callouts for upgrades, energy features,
                  storage, and neighborhood notes.
                </li>
                <li>
                  <strong>AI Q&amp;A at the property:</strong> Buyers ask
                  natural questions (“HOA rules?”, “2023 utility average?”,
                  “What’s the school zoning?”) and get transparent answers with
                  docs attached.
                </li>
                <li>
                  <strong>Remote-ready assets:</strong> One spatial map powers
                  3D tours and interactive floor plans for online shoppers.
                </li>
              </ul>

              <h3>Resident Experience Suite</h3>
              <ul>
                <li>
                  <strong>Persistent home layer:</strong> Shared widgets for
                  groceries, chores, calendars, and “where things live” labels
                  anchored to real surfaces and appliances.
                </li>
                <li>
                  <strong>Household access, like Wi-Fi:</strong> Anyone you
                  invite (roommates, family, guests) can “join” your home’s AR
                  layer on any supported device. No need for a specific host to
                  be present.
                </li>
                <li>
                  <strong>Collaborative &amp; controlled:</strong> Default is
                  editable by everyone you allow; granular permissions let
                  owners lock certain elements or rooms.
                </li>
                <li>
                  <strong>Cross-platform by design:</strong> Works across
                  headsets, glasses, and phones, so visitors always get the
                  experience you set up.
                </li>
                <li>
                  <strong>Living documentation:</strong> Maintenance notes
                  pinned to the water heater, filter reminders on the HVAC,
                  measurements on walls &amp; windows, warranties attached to
                  appliances.
                </li>
              </ul>

              <h2>ROI snapshot</h2>
              <ul>
                <li>
                  <strong>Staging raises perceived value:</strong> In NAR’s
                  staging research, agents report buyers find it easier to
                  visualize living in a staged home, and a share of agents see
                  offers increase by <strong>~1–5%</strong>.{" "}
                  <sup>
                    <a href="#src-1">[1]</a>
                  </sup>{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Time-on-market reductions:</strong> Sellers’ agents
                  report staging can <em>decrease</em> days on market (from
                  “slight” to “great” reductions depending on the listing).{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>
                </li>
                <li>
                  <strong>3D tours drive attention:</strong> On Zillow, listings
                  with a 3D Home tour see about <strong>43% more views</strong>{" "}
                  and <strong>55% more saves</strong> vs. photo-only.{" "}
                  <sup>
                    <a href="#src-4">[4]</a>
                  </sup>
                </li>
                <li>
                  <strong>Faster sales with 3D:</strong> Zillow found homes with
                  a 3D Home tour sold <strong>~14% faster</strong> on average
                  than those without.{" "}
                  <sup>
                    <a href="#src-5">[5]</a>
                  </sup>
                </li>
                <li>
                  <strong>More qualified leads:</strong> Matterport reports
                  listings with immersive media can yield{" "}
                  <strong>up to ~49% more leads</strong> vs. traditional media.{" "}
                  <sup>
                    <a href="#src-6">[6]</a>
                  </sup>
                </li>
                <li>
                  <strong>Reality check:</strong> Some analysts note ROI varies
                  by market; staging costs can rise, and not every uplift is
                  guaranteed. Transparent expectations and quality execution
                  still matter.{" "}
                  <sup>
                    <a href="#src-7">[7]</a>
                  </sup>
                </li>
              </ul>

              <h3 id="sources">Sources</h3>
              <ol className="text-sm">
                <li id="src-1">
                  <a
                    href="https://www.nar.realtor/research-and-statistics/research-reports/profile-of-home-staging"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    NAR — Profile of Home Staging (summary &amp; stats)
                  </a>
                </li>
                <li id="src-2">
                  <a
                    href="https://www.nar.realtor/blogs/styled-staged-sold/tv-design-shows-may-be-reshaping-buyers-expectations"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    NAR Styled, Staged &amp; Sold — Buyer visualization &amp;
                    value perception
                  </a>
                </li>
                <li id="src-3">
                  <a
                    href="https://cms.nar.realtor/sites/default/files/documents/2023-profile-of-home-staging-03-30-2023.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    NAR — 2023 Profile of Home Staging (PDF): time-on-market
                    impacts
                  </a>
                </li>
                <li id="src-4">
                  <a
                    href="https://www.zillow.com/premier-agent/expand-business-with-zillow-3d-home/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Zillow — 3D Home tours: +43% views, +55% saves
                  </a>
                </li>
                <li id="src-5">
                  <a
                    href="https://www.zillow.com/learn/virtual-tours-home-sell-faster/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Zillow — Homes with 3D tours sell ~14% faster (site data)
                  </a>
                </li>
                <li id="src-6">
                  <a
                    href="https://matterport.com/blog/guide-3d-virtual-tours-how-they-differ-360-tours"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Matterport — Listings with immersive media: up to ~49% more
                    leads
                  </a>
                </li>
                <li id="src-7">
                  <a
                    href="https://www.wsj.com/personal-finance/does-staging-your-house-really-help-it-sell-for-more-money-37f55b72"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wall Street Journal — Nuanced view of staging ROI &amp;
                    costs
                  </a>
                </li>
              </ol>

              <p>
                propertyOS uses place as the interface, elevating the listing,
                accelerating decisions, and giving residents a canvas to make
                their homes truly theirs.
              </p>

              <p>
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 text-emerald-300 hover:text-cyan-300"
                >
                  &larr; Back to all posts
                </Link>
              </p>
            </article>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
