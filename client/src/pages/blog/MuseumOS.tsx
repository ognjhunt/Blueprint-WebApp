import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function MuseumOS() {
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
                museumOS – our fourth vertical
              </h1>

              <p>
                Blueprint is building the operating system for physical
                spaces. Our motto is{" "}
                <strong>“know the place to serve the person.”</strong> museumOS
                brings that vision to museums and cultural sites, turning
                galleries and grounds into living, adaptive layers. It blends AR
                and AI so <em>visitors</em> get richer stories and access, while{" "}
                <em>staff</em> see what’s working and can iterate quickly.
              </p>

              <h2>Two programs for impact</h2>
              <p>
                museumOS ships in two coordinated programs: the{" "}
                <strong>Curator &amp; Operations Suite</strong> (for teams) and
                the <strong>Visitor Experience Suite</strong> (for guests). Both
                run on the same spatial map and collection graph, so
                improvements in one compound benefits in the other.
              </p>

              <h3>Curator &amp; Operations Suite</h3>
              <ul>
                <li>
                  <strong>Live floor insights:</strong> Heatmaps of dwell,
                  popular paths, and queue health to fine-tune staffing and
                  signage.
                </li>
                <li>
                  <strong>Instant labels &amp; accessibility:</strong> One tap
                  to publish translations, captions, large-type labels, and
                  audio descriptions, anchored right where they're needed.
                </li>
                <li>
                  <strong>Impact analytics:</strong> Exhibit- and object-level
                  engagement reports (views, dwell, completion) and sentiment
                  from on-device prompts (no emails required).
                </li>
                <li>
                  <strong>Rapid content swaps:</strong> Safe “what-if” modes to
                  test new wall text, layouts, or lighting before you commit on
                  the floor.
                </li>
              </ul>

              <h3>Visitor Experience Suite</h3>
              <ul>
                <li>
                  <strong>AI docent &amp; hologram guide:</strong> Ask natural
                  questions (“How was this restored?”, “What’s the context?”)
                  and get grounded answers with citations; optional character
                  tours narrated by artists, scientists, or historical voices.
                </li>
                <li>
                  <strong>Time-Shift storytelling:</strong> See reconstructions
                  "appear" in place (missing frescoes, ancient colors, or
                  original facades), then scrub between eras to understand change.
                </li>
                <li>
                  <strong>Follow-your-curiosity paths:</strong> Adaptive routes
                  by time, interests, or accessibility needs; family/kid modes
                  unlock hunt-style prompts and maker tasks at each stop.
                </li>
                <li>
                  <strong>Bring-it-closer tools:</strong> X-ray/zoom overlays
                  reveal brushwork, materials, or fossils inside cases; haptics
                  &amp; audio queues support low-vision and neurodiverse guests.
                </li>
                <li>
                  <strong>Moments that matter:</strong> Contextual membership,
                  program sign-ups, and shop tie-ins appear at natural decision
                  points, never interrupting the visit.
                </li>
              </ul>

              <h2>Impact snapshot</h2>
              <ul>
                <li>
                  <strong>Engagement &amp; satisfaction:</strong> At the
                  Cleveland Museum of Art, visitors reported that ARTLENS
                  enhanced their visit (<strong>76%</strong> agreed) and
                  encouraged closer looking (<strong>74%</strong>), with higher
                  gains in understanding across a visit vs. non-ARTLENS
                  visitors.{" "}
                  <sup>
                    <a href="#src-1">[1]</a>
                  </sup>{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Learning outcomes:</strong> Meta-analyses in education
                  find AR produces meaningful gains in learning performance
                  (e.g., standardized effect sizes from <strong>~0.5</strong> to{" "}
                  <strong>~0.9</strong> across studies), supporting its use for
                  complex concepts and motivation in cultural contexts.{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>{" "}
                  <sup>
                    <a href="#src-4">[4]</a>
                  </sup>
                </li>
                <li>
                  <strong>Immersive demand:</strong> Immersive art experiences
                  posted millions of ticket sales and substantial revenue,
                  signaling sustained visitor appetite for interactive,
                  tech-forward storytelling.{" "}
                  <sup>
                    <a href="#src-5">[5]</a>
                  </sup>
                </li>
                <li>
                  <strong>Accessibility in practice:</strong> Museums are
                  deploying vision-assist apps and AR-style image enhancement
                  on-site to expand participation for low-vision visitors.{" "}
                  <sup>
                    <a href="#src-6">[6]</a>
                  </sup>
                </li>
                <li>
                  <strong>On-site AR guides at heritage sites:</strong> Mobile
                  AR tours that reconstruct the past (e.g., Acropolis) show how
                  AI-assisted guides and in-place overlays can deepen context
                  and appeal to broad audiences.{" "}
                  <sup>
                    <a href="#src-7">[7]</a>
                  </sup>
                </li>
              </ul>

              <h3 id="sources">Sources</h3>
              <ol className="text-sm">
                <li id="src-1">
                  <a
                    href="https://www.clevelandart.org/about/press/digital-technology-cleveland-museum-art-enhances-visitor-engagement"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cleveland Museum of Art — ARTLENS visitor impact (press
                    summary)
                  </a>
                </li>
                <li id="src-2">
                  <a
                    href="https://www.clevelandart.org/articles/seeing-cma-through-new-lens-measuring-impact-artlens-gallery"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cleveland Museum of Art — Measuring impact of ARTLENS
                    (details)
                  </a>
                </li>
                <li id="src-3">
                  <a
                    href="https://www.sciencedirect.com/science/article/pii/S0360131522002123"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Chang et&nbsp;al. (2022) — Meta-analysis: AR improves
                    multiple learning outcomes
                  </a>
                </li>
                <li id="src-4">
                  <a
                    href="https://www.mdpi.com/2227-7102/15/6/678"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Li et&nbsp;al. (2025) — Systematic review: large AR effect
                    sizes in higher education
                  </a>
                </li>
                <li id="src-5">
                  <a
                    href="https://www.aam-us.org/2022/11/01/taking-the-plunge/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    AAM — Growth of immersive experiences (tickets &amp;
                    revenue)
                  </a>
                </li>
                <li id="src-6">
                  <a
                    href="https://www.houstonchronicle.com/news/houston-texas/trending/article/museum-natural-science-accessibility-vision-20058102.php"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Houston Museum of Natural Science — Low-vision accessibility
                    app initiative
                  </a>
                </li>
                <li id="src-7">
                  <a
                    href="https://apnews.com/article/273f4a1c64c6aa72a1c3c3d39e34d252"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    AP News — AR reconstructions &amp; AI guide at the Acropolis
                  </a>
                </li>
              </ol>

              <p>
                museumOS turns place into a first-class interface, helping teams
                iterate with data and giving visitors stories they’ll remember.
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
