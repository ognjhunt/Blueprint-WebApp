import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";

export default function RestaurantOS() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100">
      <SEO
        title="restaurantOS – our sixth phase"
        description="Guest-centric AI glasses: photoreal 3D menus, chef stories, smart recs, and contactless flows that enhance the meal."
        canonical="/blog/restaurant-os"
        type="article"
      />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
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
                Guest-centric AI glasses: photoreal 3D menus, chef stories, smart
                recs, and contactless flows that enhance the meal.
              </p>
              <p>More details on restaurantOS are coming soon.</p>
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
