import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function RetailOS() {
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
                retailOS – our second phase
              </h1>

              <p>
                Blueprint is building the operating system for physical
                spaces. Our motto is{" "}
                <strong>"know the place to serve the person."</strong> retailOS
                brings that vision to stores and showrooms. It blends AR and AI
                to understand every aisle, bay and product so
                <em> people</em>, both associates and shoppers, get exactly what
                they need faster and more confidently.
              </p>

              <h2>Two tracks for impact</h2>
              <p>
                Unlike back-of-house workflows, retail has two primary
                audiences. retailOS ships in two coordinated tracks:
                <strong> Associate Ops Suite</strong> (for employees) and{" "}
                <strong>Customer Experience Suite</strong> (for shoppers). They
                run on the same spatial map and catalog so improvements on one
                side compound benefits on the other.
              </p>

              <h3>Associate Ops Suite</h3>
              <ul>
                <li>
                  <strong>Guided tasks:</strong> AR paths for BOPIS pick/pack,
                  restock, and facing. Hands-free confirmations cut walking
                  and errors.
                </li>
                <li>
                  <strong>Shelf intelligence:</strong> Out-of-stocks, pricing
                  mismatches, and planogram exceptions highlighted in-view for
                  faster audits and remediation.
                </li>
                <li>
                  <strong>Smart putaway:</strong> Best-bin suggestions and
                  overstock guidance reduce travel time and backroom churn.
                </li>
                <li>
                  <strong>Training in place:</strong> Micro-lessons and safety
                  overlays on real fixtures for faster ramp and fewer incidents.
                </li>
              </ul>

              <h3>Customer Experience Suite</h3>
              <ul>
                <li>
                  <strong>Store wayfinding:</strong> Ask for any item and get an
                  AR route to the exact shelf; compare alternatives in-view with
                  ratings, ingredients, or sustainability callouts.
                </li>
                <li>
                  <strong>Try-before-you-buy:</strong> 3D/AR try-ons and
                  "see-in-your-space" for size, fit, and finish, reducing
                  uncertainty and returns.
                </li>
                <li>
                  <strong>Moments that matter:</strong> Contextual offers,
                  bundles, and brand stories appear right where the decision
                  happens, boosting engagement and basket size.
                </li>
                <li>
                  <strong>Delight &amp; dwell:</strong> Lightweight, purposeful
                  interactions (no app install required) keep shoppers engaged
                  without slowing the trip.
                </li>
              </ul>

              <h2>ROI snapshot</h2>
              <ul>
                <li>
                  <strong>Conversion lift:</strong> Merchants who add 3D/AR to
                  product pages see ~<strong>94% higher conversions</strong> on
                  average (e-commerce baseline). In store, similar AR try-on
                  activations raise purchase confidence and intent.
                  <sup>
                    <a href="#src-1">[1]</a>
                  </sup>
                </li>
                <li>
                  <strong>Fewer returns:</strong> Case data shows{" "}
                  <strong>return rates down ~5%</strong> with AR sizing/fit
                  previews; some research reports up to{" "}
                  <strong>~25% reductions</strong> depending on category and
                  implementation.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Dwell &amp; engagement:</strong> AR experiences often
                  sustain <strong>~75s average dwell</strong> in campaigns, and
                  minute-plus sessions are common in retail case studies, far
                  above typical ad interactions.{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>
                </li>
                <li>
                  <strong>Associate productivity &amp; accuracy:</strong>{" "}
                  Vision-picking deployments report{" "}
                  <strong>~10% productivity gains</strong> with{" "}
                  <strong>~99.99% picking accuracy</strong> after rollout, with
                  research showing fewer picking errors than paper workflows.
                  <sup>
                    <a href="#src-4">[4]</a>
                  </sup>
                </li>
                <li>
                  <strong>Shelf execution:</strong> Retailers cite planogram
                  compliance, out-of-stock detection, and price accuracy as
                  prime AR use cases poised to scale in grocery and mass.
                  <sup>
                    <a href="#src-5">[5]</a>
                  </sup>
                </li>
              </ul>

              <h3 id="sources">Sources</h3>
              <ol className="text-sm">
                <li id="src-1">
                  <a
                    href="https://www.shopify.com/blog/3d-ecommerce"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Shopify — 3D commerce averages ~94% conversion lift (2024)
                  </a>
                </li>
                <li id="src-2">
                  <a
                    href="https://www.shopify.com/case-studies/gunner-kennels"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Shopify Case Study — Gunner Kennels: 5% return-rate
                    reduction
                  </a>
                </li>
                <li id="src-3">
                  <a
                    href="https://arinsider.co/2019/12/02/ar-lens-sessions-last-75-seconds-on-average/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    AR Insider — AR lens sessions average ~75 seconds
                  </a>
                </li>
                <li id="src-4">
                  <a
                    href="https://www.teamviewer.com/en-us/success-stories/coca-cola/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TeamViewer × Coca-Cola HBC — ~10% productivity, 99.99%
                    picking accuracy
                  </a>
                </li>
                <li id="src-5">
                  <a
                    href="https://incontextsolutions.com/blog/planogram-compliance-augmented-reality/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    InContext — AR for planogram compliance & shelf execution
                  </a>
                </li>
              </ol>

              <p>
                retailOS turns location into a first-class interface for both
                sides of the counter, elevating service, speeding work, and
                making stores more personal and more profitable.
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
