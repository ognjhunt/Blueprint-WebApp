import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function WarehouseOS() {
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
                warehouseOS – our first vertical
              </h1>
              <p>
                Blueprint is building the operating system for physical
                spaces—our motto is
                <strong>"know the place to serve the person."</strong>{" "}
                warehouseOS brings that vision to distribution centers and
                fulfillment sites, blending AR and AI to understand every aisle,
                rack and bin so people can work faster and safer.
              </p>
              <h2>Key capabilities</h2>
              <ul>
                <li>
                  Ask where any SKU lives and get an AR path directly to the
                  bin.
                </li>
                <li>
                  Vision picking with hands-free confirmations cuts walking and
                  errors.
                </li>
                <li>
                  Smart slotting suggestions and putaway guidance reduce travel
                  time.
                </li>
                <li>
                  Safety overlays warn about forklifts, no-go zones and
                  pedestrian traffic.
                </li>
                <li>
                  Cycle counting and receiving QA use computer vision for
                  instant accuracy.
                </li>
              </ul>
              <h2>ROI snapshot</h2>
              <ul>
                <li>
                  15–25% faster picks compared to paper or handheld scanners.
                </li>
                <li>
                  Mispicks often cost $22–$100 each; halving them saves six
                  figures yearly.
                </li>
                <li>AR-guided training can cut ramp time by 50% or more.</li>
              </ul>
              <p>
                warehouseOS is just the beginning. By treating location as a
                first-class interface, Blueprint unlocks new efficiency and
                safety gains for every type of facility.
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
