// FILE: client/src/pages/blog/RestaurantOS.tsx
// PURPOSE: Phase Six vertical page — restaurantOS (guest-centric AR for dining)
// STYLE: Matches dark “aurora glass” aesthetic used across Warehouse/Retail/Property/Museum posts

import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function RestaurantOS() {
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
                restaurantOS – our sixth phase
              </h1>

              <p>
                Blueprint is building the operating system for physical
                spaces—our motto is{" "}
                <strong>“know the place to serve the person.”</strong>{" "}
                restaurantOS brings that vision to bistros, cafés and dining
                rooms. It blends AR and AI to understand the table, the menu and
                the flow of service so <em>guests</em> feel informed, delighted
                and taken care of—without adding strain to the floor.
              </p>

              <h2>Guest Experience Suite</h2>
              <p>
                restaurantOS focuses on one program: a{" "}
                <strong>Guest Experience Suite</strong> that runs on a shared
                spatial map of the venue. Guests opt in with a quick scan and
                get a calm, useful layer that enhances the meal rather than
                competing with it.
              </p>

              <ul>
                <li>
                  <strong>Photoreal 3D menu previews:</strong> See true-to-size
                  dishes anchored to your table with portion cues and plating
                  details, improving decision confidence and purchase
                  likelihood.{" "}
                  <sup>
                    <a href="#src-1">[1]</a>
                  </sup>
                </li>
                <li>
                  <strong>Chef’s notes &amp; story bites:</strong> Lightweight
                  “hologram” moments convey provenance, technique, wine pairings
                  and brand lore at the exact point of decision—no app install.
                </li>
                <li>
                  <strong>Dietary &amp; allergen guardrails:</strong> Toggle
                  nut-free, gluten-free or vegan modes to highlight safe choices
                  and ingredient swaps; AR nutrition callouts can also nudge
                  healthier selections.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Smart recommendations:</strong> AI suggests pairings,
                  limited-run specials and table-share items based on party
                  size, time of day and inventory—guests stay in control.
                </li>
                <li>
                  <strong>Wayfinding &amp; amenity cues:</strong> Discreet AR
                  arrows guide guests to restrooms, bar pickup, patio seating or
                  exits, reducing “where is…?” interruptions.
                </li>
                <li>
                  <strong>Tap-to-reorder &amp; split checks:</strong> Optional
                  contactless flows speed up service peaks and reduce order
                  errors; venues can keep classic server-led service while
                  letting guests self-serve when they prefer.{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>
                </li>
              </ul>

              <h2>ROI snapshot</h2>
              <ul>
                <li>
                  <strong>Higher purchase intent:</strong> Field and lab studies
                  show AR food presentation increases mental simulation and{" "}
                  <em>raises desire and purchase likelihood</em> versus
                  photos—an effect demonstrated in real restaurants.{" "}
                  <sup>
                    <a href="#src-1">[1]</a>
                  </sup>
                </li>
                <li>
                  <strong>Order confidence &amp; expectation match:</strong>{" "}
                  Photoreal 3D models help guests understand portions and
                  plating, which can reduce disappointment and comp requests;
                  industry deployments (e.g., Kabaq/QReal) highlight
                  expectation-setting benefits for 3D food.{" "}
                  <sup>
                    <a href="#src-4">[4]</a>
                  </sup>
                </li>
                <li>
                  <strong>Service efficiency:</strong> Digital ordering and
                  contactless flows can improve order accuracy and service time,
                  especially during peaks—used selectively to complement
                  hospitality.{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>
                </li>
                <li>
                  <strong>Dwell &amp; attachment:</strong> Longer, more engaged
                  stays often correlate with higher spend on desserts and
                  beverages; experiential layers can support that behavior
                  without “rushing the check.”{" "}
                  <sup>
                    <a href="#src-5">[5]</a>, <a href="#src-6">[6]</a>
                  </sup>
                </li>
                <li>
                  <strong>Health &amp; trust:</strong> AR nutrition overlays
                  have been shown to guide healthier choices and improve
                  comprehension, which builds guest trust around transparency.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
              </ul>

              <h3>Design principles</h3>
              <ul>
                <li>
                  <strong>Hospitality-first:</strong> The AR layer is quiet by
                  default, respectful of ambience and lighting; nothing competes
                  with conversation or the plate.
                </li>
                <li>
                  <strong>Hybrid by choice:</strong> Not everyone loves scanning
                  codes. Keep classic menus and server-led service, with AR as
                  an
                  <em>optional</em> enhancement.{" "}
                  <sup>
                    <a href="#src-7">[7]</a>
                  </sup>
                </li>
                <li>
                  <strong>Cross-device:</strong> Works on headsets, glasses and
                  phones for guests; staff can use the same spatial map for
                  back-of-house if desired later.
                </li>
              </ul>

              <h3 id="sources">Sources</h3>
              <ol className="text-sm">
                <li id="src-1">
                  <a
                    href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9792938/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fritz, Hadi &amp; Stephen (2022/2023) — “From tablet to
                    table: How AR influences food desirability &amp; purchase
                    behavior” (field experiments show higher purchase
                    likelihood)
                  </a>
                </li>
                <li id="src-2">
                  <a
                    href="https://link.springer.com/article/10.1007/s10055-023-00792-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Pini et&nbsp;al. (2023) — AR nutrition overlays can steer
                    healthier food choices (Virtual Reality journal)
                  </a>
                </li>
                <li id="src-3">
                  <a
                    href="https://hospitalitytech.com/qr-code-ordering-benefits-customers-restaurants"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hospitality&nbsp;Tech (2023) — QR/ digital ordering
                    benefits: guest control, order accuracy, faster service
                  </a>
                </li>
                <li id="src-4">
                  <a
                    href="https://www.virtualrealitymarketing.com/case-studies/kabaq-ar-in-restaurant/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    QReal (Kabaq) case study — photoreal 3D food models for
                    expectation-setting and decision confidence
                  </a>
                </li>
                <li id="src-5">
                  <a
                    href="https://www.fastsensor.com/post/the-importance-of-dwell-time-in-your-restaurant"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    FastSensor (2020) — Longer dwell time often correlates with
                    higher spend (desserts, beverages)
                  </a>
                </li>
                <li id="src-6">
                  <a
                    href="https://bloomintelligence.com/blog/what-is-dwell-time-restaurant-owners/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Bloom Intelligence — Dwell time as a proxy for satisfaction
                    and revenue opportunity
                  </a>
                </li>
                <li id="src-7">
                  <a
                    href="https://www.wsj.com/business/hospitality/restaurant-menus-qr-codes-33f777c8"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wall Street Journal (2024) — QR backlash context; adopt
                    hybrid models so tech remains guest-friendly
                  </a>
                </li>
              </ol>

              <p>
                restaurantOS treats place as the interface—helping guests choose
                confidently, learn the story behind the food, and enjoy a
                smoother service flow from hello to check.
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
