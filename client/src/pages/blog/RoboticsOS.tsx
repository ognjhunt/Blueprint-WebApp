import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function RoboticsOS() {
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
                roboticsOS – spatial context for autonomous crews
              </h1>

              <p>
                Humanoid and mobile robotics are accelerating from pilot videos to
                real deployments. But once a robot leaves a lab or factory demo,
                it hits a wall: <strong>new locations lack context</strong>. The
                machine can walk, grasp, or speak, yet it does not know where the
                cleaning cart lives, which door hides the breaker panel, or how a
                stockroom was rearranged overnight. Every blind arrival burns
                time, technician hours, and battery cycles.
              </p>

              <p>
                roboticsOS gives robots a living briefing the moment they roll in.
                Blueprint already hosts continuously updating digital twins of
                every onboarded site, fed by human teams, IoT, and the robots
                themselves. When a new unit shows up, it authenticates, downloads
                the latest scene graph, and gets to work instead of wandering.
              </p>

              <h2>Why robots need context on arrival</h2>
              <ul>
                <li>
                  <strong>Unfamiliar layouts:</strong> Even slight planogram
                  changes break pre-scripted routes and force remote operators to
                  teleop or re-teach.
                </li>
                <li>
                  <strong>Dynamic inventory:</strong> Pallets, ingredient bins,
                  and tools move hourly; static CAD models become stale in days.
                </li>
                <li>
                  <strong>Operational variance:</strong> Safety zones, traffic
                  flows, and human preferences differ by shift and brand.
                </li>
                <li>
                  <strong>Costly annotation:</strong> Traditional digital twins
                  require tedious manual labeling before they are usable.
                </li>
              </ul>

              <h2>Living digital twins that stay accurate</h2>
              <p>
                Blueprint’s digital twins are not dusty scans—they are living
                systems co-authored by staff and robots. Every shelf, piece of
                equipment, sensor, and policy is structured, versioned, and tied
                to permissions. Updates flow bidirectionally so data stays fresh
                without heroic data-labeling projects.
              </p>
              <ul>
                <li>
                  <strong>Retail:</strong> Robots receive the exact end-cap
                  layouts, replenishment priorities, and planogram compliance
                  status before store opening.
                </li>
                <li>
                  <strong>Warehouse:</strong> Autonomous forklifts know which
                  pallets are staged for outbound, which racks are blocked for
                  cycle counts, and the safest aisle to traverse at 4&nbsp;pm.
                </li>
                <li>
                  <strong>Restaurant:</strong> Kitchen runners see line set-ups,
                  allergen segregation zones, and real-time prep queues shared by
                  chefs and service robots.
                </li>
                <li>
                  <strong>Hospitality and workplaces:</strong> Housekeeping bots
                  get room statuses, maintenance tickets, and guest privacy rules
                  synced instantly.
                </li>
              </ul>

              <h2>How roboticsOS sessions work</h2>
              <p>
                A typical session starts the moment a robot encounters a new
                facility. Here is a concrete example featuring an autonomous
                service humanoid arriving to replenish adhesives at a contract
                manufacturing site:
              </p>
              <ol>
                <li>
                  The robot scans a marker at reception and sends a request to
                  <code>POST /robotics/sessions</code> with its serial, firmware
                  version, and the venue ID printed on the marker.
                </li>
                <li>
                  Blueprint verifies device trust, then returns an encrypted scene
                  package: the latest floor graph, semantic layers (inventory,
                  safety, workflows), and a token scoped to permitted zones.
                </li>
                <li>
                  The robot asks <code>GET /robotics/navigation-path</code> with
                  the payload{" "}
                  <code>
                    {'{"pickup": "Adhesive A23", "tooling": "bin"}'}
                  </code>
                  . The API responds with the aisle, bay, shelf height, live
                  occupancy signals, and the safest path.
                </li>
                <li>
                  As the robot travels, it streams back vision deltas. Blueprint
                  reconciles them with human updates so everyone sees the new
                  placement when a bin shifts or a spill is flagged.
                </li>
              </ol>
              <p>
                No one hand-built labels; the digital twin already knew where
                Adhesive A23 lived because warehouse pickers kept it current via
                Blueprint’s apps. The robot simply consumed the same source of
                truth.
              </p>

              <h2>More reasons teams choose Blueprint</h2>
              <ul>
                <li>
                  <strong>One map for every stakeholder:</strong> Humans, robots,
                  and software see the same spatial model, preventing conflicts
                  between operations and automation.
                </li>
                <li>
                  <strong>Policy-aware autonomy:</strong> Access rules, quiet
                  hours, and regulatory constraints are enforced through the API
                  so robots cannot drift into restricted zones.
                </li>
                <li>
                  <strong>Fleet learning loops:</strong> Performance analytics,
                  near-misses, and task completions feed back into workflows,
                  helping teams tune robots without ripping up SOPs.
                </li>
                <li>
                  <strong>Faster onboarding:</strong> New vendors or third-party
                  robotics fleets can request temporary credentials instead of
                  weeks of site surveys.
                </li>
              </ul>

              <h2>Who pays for roboticsOS?</h2>
              <p>
                Pricing depends on who benefits most. Many deployments bundle the
                API into the <strong>location operator’s Blueprint license</strong>
                so any approved robot—owned by the brand, a contractor, or a
                robotics vendor—can plug in. Other customers arrange
                <strong>usage-based passes for robot OEMs</strong> that want to
                include Blueprint access in their service contracts. Consumer
                end-users rarely pay directly; instead, brands, facility owners,
                or robotics service providers cover usage because they capture the
                efficiency gains.
              </p>

              <p>
                roboticsOS is how autonomous teams show up ready. If your robots
                need instant awareness of every place they visit, Blueprint’s
                living digital twins are the fastest path from door-open to job
                done.
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
