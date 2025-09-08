// FILE: client/src/pages/blog/HospitalityOS.tsx

import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function HospitalityOS() {
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
                hospitalityOS – our fifth vertical
              </h1>

              <p>
                Blueprint is building the operating system for physical
                spaces—our motto is{" "}
                <strong>“know the place to serve the person.”</strong>{" "}
                hospitalityOS brings that vision to hotels, resorts, and
                short-stays. It blends AR and AI with your property systems so
                <em> people</em>—both staff and guests—get what they need
                faster, with less friction and more delight.
              </p>

              <h2>Two programs for impact</h2>
              <p>
                hospitalityOS ships in two coordinated programs: the{" "}
                <strong>Staff Operations Suite</strong> (for teams) and the{" "}
                <strong>Guest Experience Suite</strong> (for visitors). Both run
                on the same spatial map of your property, so improvements in one
                reinforce wins in the other.
              </p>

              <h3>Staff Operations Suite</h3>
              <ul>
                <li>
                  <strong>Guided workflows:</strong> AR routes for housekeeping
                  runs, amenity deliveries, and turn-downs; live priorities and
                  room status right in view.
                </li>
                <li>
                  <strong>Maintenance in place:</strong> Overlay work orders on
                  the exact unit—HVAC, elevators, pool systems—with part IDs,
                  history, and safety checks.
                </li>
                <li>
                  <strong>Service recovery cues:</strong> Real-time flags for
                  VIP arrivals, late check-outs, and special requests so teams
                  can intervene before issues escalate.
                </li>
                <li>
                  <strong>Training on the floor:</strong> Micro-lessons anchored
                  to real fixtures and SOP checklists reduce ramp time for new
                  hires.
                </li>
              </ul>

              <h3>Guest Experience Suite</h3>
              <ul>
                <li>
                  <strong>Property wayfinding:</strong> Ask “spa,” “ice,” or
                  “conference B” and follow a subtle AR route; hours, dress
                  codes, and accessibility notes appear in view.
                </li>
                <li>
                  <strong>In-room overlays:</strong> Point at the thermostat,
                  TV, or espresso machine for instant how-tos; tap to request
                  more towels or late checkout.
                </li>
                <li>
                  <strong>AI concierge:</strong> A multilingual, on-site guide
                  answers questions about amenities, neighborhood tips, transit,
                  and policies—and can place requests on your behalf.
                </li>
                <li>
                  <strong>Moments that matter:</strong> Contextual upsells (spa,
                  dining, late checkout) appear at natural decision points and
                  honor loyalty preferences.
                </li>
              </ul>

              <h2>ROI snapshot</h2>
              <ul>
                <li>
                  <strong>Higher satisfaction with mobile journeys:</strong>{" "}
                  Guests who used their hotel’s mobile app scored{" "}
                  <strong>~68 points higher</strong> on J.D. Power’s 1,000-point
                  scale than those who did not (2025).{" "}
                  <sup>
                    <a href="#src-1">[1]</a>
                  </sup>
                </li>
                <li>
                  <strong>Guests prefer contactless:</strong> Surveys show{" "}
                  <strong>~73% of travelers</strong> are more likely to stay at
                  properties offering self-service and contactless options.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Personalized upsell revenue:</strong> Properties using
                  Oracle Nor1 eStandby in 2023 averaged{" "}
                  <strong>~17% incremental upsell revenue</strong> over booked
                  rates per transaction.{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>
                </li>
                <li>
                  <strong>Immersive content boosts engagement:</strong>{" "}
                  AR/VR-style experiences in hospitality/tourism are linked to
                  higher learning, satisfaction, and revisit intention in
                  peer-reviewed studies—useful for tours, brand storytelling,
                  and venue orientation.{" "}
                  <sup>
                    <a href="#src-4">[4]</a>
                  </sup>
                </li>
                <li>
                  <strong>Digital concierge impact:</strong> Recent case studies
                  report strong guest adoption of mobile/tablet platforms (e.g.,
                  ~57% platform adoption with tens of thousands of monthly
                  interactions), supporting faster service and ancillary sales.{" "}
                  <sup>
                    <a href="#src-5">[5]</a>
                  </sup>
                </li>
              </ul>

              <h3 id="sources">Sources</h3>
              <ol className="text-sm">
                <li id="src-1">
                  <a
                    href="https://www.jdpower.com/sites/default/files/file/2025-07/2025069%20N.A.%20Hotel%20Guest%20Satisfaction.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    J.D. Power (2025) — Mobile app users score ~68 points higher
                  </a>{" "}
                  &nbsp;|&nbsp;
                  <a
                    href="https://www.hoteldive.com/news/hotel-amenities-technology-boost-guest-satisfaction/753036/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    HotelDive coverage
                  </a>
                </li>
                <li id="src-2">
                  <a
                    href="https://www.hftp.org/blog/smart-check-in-opportunities-challenges-recommendations"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    HFTP (2024) — Oracle/Skift: ~73% prefer self-service options
                  </a>
                </li>
                <li id="src-3">
                  <a
                    href="https://www.hotelmanagement.net/tech/choice-hotels-upscale-hotels-use-oracles-nor1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    HotelManagement (2024) — Nor1 eStandby ~17% incremental
                    upsell revenue
                  </a>
                </li>
                <li id="src-4">
                  <a
                    href="https://www.sciencedirect.com/science/article/pii/S2211973623000327"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Tourism Management Perspectives (2023) — AR/VR increases
                    satisfaction & revisit intention
                  </a>
                </li>
                <li id="src-5">
                  <a
                    href="https://intelity.com/success/the-whisper-of-innovation-how-two-luxury-hotels-transformed-their-guest-experience/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    INTELITY case studies (2025) — Platform adoption/engagement
                    metrics
                  </a>
                </li>
              </ol>

              <p>
                hospitalityOS turns place into the interface—helping teams work
                smarter while guests feel more informed, more in control, and
                more at home.
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
