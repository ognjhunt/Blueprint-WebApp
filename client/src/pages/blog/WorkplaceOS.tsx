import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function WorkplaceOS() {
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
                workplaceOS – our seventh phase
              </h1>

              <p>
                Blueprint is building the operating system for physical
                spaces. Our motto is{" "}
                <strong>"know the place to serve the person."</strong>{" "}
                workplaceOS brings that vision to offices, labs, and frontline
                hubs. It blends AR and AI so <em>people</em> see the right data
                in the right place: KPIs on a production cell, SLA health at a
                help desk, and context from docs right on the machine. This turns every
                workspace into a live, spatial dashboard.{" "}
                <sup>
                  <a href="#src-1">[1]</a>
                </sup>
              </p>

              <h2>Two programs for impact</h2>
              <p>
                workplaceOS ships in two coordinated programs: the{" "}
                <strong>Leadership Insight Suite</strong> (for managers) and the{" "}
                <strong>Team Productivity Suite</strong> (for employees). Both
                run on the same spatial map and identity graph so improvements
                on one side compound benefits on the other.
              </p>

              <h3>Leadership Insight Suite</h3>
              <ul>
                <li>
                  <strong>Walk-around dashboards:</strong> Live KPIs anchored to
                  zones (capacity, cycle time, queue depth, SLA risk) fed by your
                  existing tools (BI, IoT, ITSM).
                </li>
                <li>
                  <strong>Heatmaps &amp; root cause in place:</strong> See
                  incident clusters, bottlenecks, and churn risk laid over the
                  real floor plan; drill down to recent changes, owners, and
                  SOPs.
                </li>
                <li>
                  <strong>People &amp; safety overlays:</strong> Staffing
                  coverage, onboarding status, safety callouts and evacuation
                  routes appear where they matter.
                </li>
                <li>
                  <strong>Scenario previews:</strong> Try "what-ifs" in AR: new
                  seating plan, line balance, or shift mix. Then commit with one
                  tap.
                </li>
              </ul>

              <h3>Team Productivity Suite</h3>
              <ul>
                <li>
                  <strong>Guided work:</strong> Step-by-step AR instructions and
                  checklists attached to the exact station, tool, or
                  rack. Hands-free confirmations reduce rework.{" "}
                  <sup>
                    <a href="#src-5">[5]</a>
                  </sup>
                </li>
                <li>
                  <strong>Instant answers:</strong> Ask natural
                  questions ("Torque spec for pump A?" "Latest SOP?") and get
                  verified answers from connected sources (Confluence, Drive,
                  SharePoint, Jira, GitHub).
                </li>
                <li>
                  <strong>Remote expert:</strong> See-what-I-see help with
                  spatial annotations improves first-time fix and trims MTTR.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Micro-training in place:</strong> Bite-size lessons
                  and safety refreshers pinned to the real equipment; immersive
                  modules accelerate ramp and boost confidence.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Cross-system actions:</strong> Open a ticket, update a
                  task, start a runbook, or log a defect without breaking flow.
                </li>
              </ul>

              <h2>ROI snapshot</h2>
              <ul>
                <li>
                  <strong>HoloLens 2 mixed-reality deployments:</strong>{" "}
                  Forrester’s TEI analysis (commissioned) reports{" "}
                  <strong>177% three-year ROI</strong> and{" "}
                  <strong>~13-month payback</strong> across composite orgs using
                  Remote Assist/Guides.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>Training &amp; field efficiency:</strong> Mixed
                  reality cut <strong>training time by up to 75%</strong>,
                  improved <strong>field task efficiency up to 60%</strong>,
                  reduced <strong>follow-up visits by 75%</strong>, and improved{" "}
                  <strong>MTTR ~20%</strong> in aggregated studies.{" "}
                  <sup>
                    <a href="#src-2">[2]</a>
                  </sup>
                </li>
                <li>
                  <strong>AR-guided picking:</strong> DHL’s smart-glasses pilot
                  saw <strong>~25% productivity gains</strong> and{" "}
                  <strong>near-zero errors</strong> in order picking.{" "}
                  <sup>
                    <a href="#src-3">[3]</a>
                  </sup>
                </li>
                <li>
                  <strong>Procedural work:</strong> AR instruction flows
                  delivered <strong>~21% faster</strong> task completion with
                  lower cognitive load in lab comparisons.{" "}
                  <sup>
                    <a href="#src-5">[5]</a>
                  </sup>
                </li>
                <li>
                  <strong>Immersive learning (VR baseline):</strong> Learners
                  were <strong>4× faster</strong> to train and up to{" "}
                  <strong>~275% more confident</strong> than classroom in PwC’s
                  study, evidence that spatial learning lifts speed and
                  retention.{" "}
                  <sup>
                    <a href="#src-6">[6]</a>
                  </sup>
                </li>
              </ul>

              <h3 id="sources">Sources</h3>
              <ol className="text-sm">
                <li id="src-1">
                  <a
                    href="https://hbr.org/2017/11/a-managers-guide-to-augmented-reality"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Harvard Business Review — A Manager’s Guide to Augmented
                    Reality (Porter &amp; Heppelmann)
                  </a>
                </li>
                <li id="src-2">
                  <a
                    href="https://tools.totaleconomicimpact.com/go/microsoft/hololens2/docs/Forrester-TEI-Microsoft-Mixed-Reality-Hololens-Manufacturing-Spotlight.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Forrester — Total Economic Impact of Microsoft Mixed Reality
                    (HoloLens&nbsp;2): 177% ROI, ~13-month payback; training
                    time −75%, field efficiency +60%, follow-ups −75%, MTTR −20%
                  </a>
                </li>
                <li id="src-3">
                  <a
                    href="https://www.dhl.com/global-en/home/press/press-archive/2019/dhl-supply-chain-rolls-out-augmented-reality-smart-glasses-in-its-warehouses.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    DHL — AR smart-glasses rollout: ~25% productivity, errors
                    effectively zero
                  </a>
                </li>
                <li id="src-4">
                  <a
                    href="https://www.assemblymag.com/articles/96226-ar-gives-wings-to-boeing"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Assembly Magazine — Boeing AR programs (context &amp;
                    outcomes)
                  </a>
                </li>
                <li id="src-5">
                  <a
                    href="https://www.tutorial-works.com/wp-content/uploads/2023/02/2023-AR-instruction-case-study.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    AR Instruction Case Study (2023) — ~21% faster completion,
                    lower workload vs. paper/app
                  </a>
                </li>
                <li id="src-6">
                  <a
                    href="https://www.axios.com/2020/06/25/virtual-reality-training-workers-pwc-study"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Axios summary of PwC — VR training: 4× faster; up to ~275%
                    more confident vs. classroom
                  </a>
                </li>
              </ol>

              <p>
                workplaceOS uses <em>place as the interface</em>, so leaders can
                steer with live context and teams can do their best work with
                the right guidance, right where the work happens.
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
