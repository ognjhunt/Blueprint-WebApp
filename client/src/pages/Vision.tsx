import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

import { Button, Eyebrow } from "@/components/blueprint";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  MonochromeMedia,
} from "@/components/site/editorial";
import { TileGrid } from "@/components/site/TileGrid";

const statStrip = [
  { label: "Robot data vs. text", value: "~1B×", caption: "Smaller than internet text (Bessemer)" },
  { label: "Sim-to-site rank", value: "0.929", caption: "Generated-world vs. real ordering (SC3-Eval)" },
  { label: "One real eval", value: "2,500+", caption: "Rollouts + 100+ human hours (AutoEval)" },
  { label: "Reliability bar", value: "99.99%", caption: "What industrial buyers expect (Bain)" },
];

const rungs = [
  {
    step: "01",
    phase: "Today",
    title: "Know which policy will actually work — before field time.",
    body: "Blueprint's Task Evaluation Runs rank robot policies on a real captured site against your task suite, success rate, cycle time, and intervention thresholds. Ranking is the honest unit — and a generated world can now do it: 2026 research (SC3-Eval, from NVIDIA and Physical Intelligence; OSCAR, from Peking University and NVIDIA) shows video world models predicting real policy rankings at a Pearson correlation up to 0.98 in-distribution. The ~0.929 rank fidelity we report sits squarely in that regime.",
    proof: "Rank fidelity & predicted success — an estimate, never a guaranteed field outcome.",
  },
  {
    step: "02",
    phase: "Building",
    title: "Become the neutral standard both sides route decisions through.",
    body: "Robot teams use our runs to prove readiness and win pilots; site operators require them before a robot reaches the floor. The goal is that a large share of deployment and pilot decisions pass through one trusted, neutral measurement — the way credit ratings, UL safety marks, and MLPerf became the scoreboard their industries transact against. This is a decision layer, not a marketplace.",
    proof: "Neutrality is the asset. Visible methodology, re-validation, and a conflict-of-interest firewall.",
  },
  {
    step: "03",
    phase: "Horizon",
    title: "Predict real-world performance, and generate the data to improve it.",
    body: "Every deployment decision routed through Blueprint is a labeled, ground-truth outcome. That proprietary, multi-site capture is the scarcest input in robotics — and research shows policy generalization scales with the diversity of real environments, not raw demo count. Today's evaluators are strong in-distribution but weaker on unfamiliar sites (SC3-Eval drops from 0.98 to ~0.87 out-of-distribution); every site we capture pulls more of the real world in-distribution. That is what powers site-specific post-training data and, over time, calibrated prediction: getting a 95% eval to mean ~95% in the real world.",
    proof: "Calibrated prediction depends on multi-year world-model progress. We publish the dependency, not a promise.",
  },
  {
    step: "04",
    phase: "Horizon",
    title: "Site-specific policies, measured on a neutral scoreboard.",
    body: "Because we hold provenance-clean data for each site we capture, we can fine-tune policies specialized to that exact environment — and use our own neutral evaluation to test the honest question of whether they beat the alternatives on that site. An edge only counts when our own scoreboard says so.",
    proof: "Only claimed when the neutral eval measures it — and only behind a structural neutrality firewall.",
  },
  {
    step: "05",
    phase: "Horizon",
    title: "Help run the deployment where we can prove we're the best operator.",
    body: "As robot hardware commoditizes, the durable value moves to the intelligence and the operating relationship. Where a site is best served by our per-site policy — and only where our neutral evaluation proves it — Blueprint can help operate the deployment on commodity hardware. We keep the standard credibly independent from any operating arm.",
    proof: "An option we earn, never an assumption. Neutrality is protected structurally before this step.",
  },
];

const invariants = [
  {
    eyebrow: "Invariant 01",
    label: "Capture first, always.",
    description:
      "Every stage is built on real, rights-clean, provenance-true site capture. That is the moat that grows stronger as models commoditize — not weaker.",
  },
  {
    eyebrow: "Invariant 02",
    label: "The model backend stays swappable.",
    description:
      "No stage couples the company to one checkpoint, provider, or world model. A better model later is a drop-in behind the adapter boundary, not a rebuild.",
  },
  {
    eyebrow: "Invariant 03",
    label: "Estimates, never guarantees.",
    description:
      "Rank fidelity and predicted success — with proof boundaries and missing-proof labels — all the way up. We never turn a correlation into a promise.",
  },
  {
    eyebrow: "Invariant 04",
    label: "Neutrality is an asset we protect.",
    description:
      "From the standard onward, independence is structural. Any move to build our own policies or operate deployments is gated on a credible firewall that keeps the measurement trusted.",
  },
];

export default function Vision() {
  return (
    <>
      <SEO
        title="Vision | Blueprint"
        description="Blueprint's long-horizon vision: start as the neutral way to know which robot policy works at a real site, become the standard the market routes deployment decisions through, then climb into prediction, data, and site-specific policies — capture-first the whole way."
        canonical="/vision"
        jsonLd={[
          webPageJsonLd({
            path: "/vision",
            name: "Blueprint Vision",
            description:
              "Blueprint's long-horizon vision: the neutral way to know which robot policy works at a real site, capture-first the whole way.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Vision", path: "/vision" },
          ]),
        ]}
      />

      <div className="bg-canvas text-ink">
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
            <div className="max-w-prose">
              <Eyebrow tone="brass" rule>
                The vision
              </Eyebrow>
              <h1 className="font-editorial mt-6 text-[clamp(2.6rem,5vw,4.2rem)] font-medium leading-[0.96] tracking-[-0.045em] text-ink">
                Make sure the best robot runs at every site.
              </h1>
              <p className="mt-6 text-lg leading-[1.7] text-ink-600">
                Robotics is heading toward millions of robots, dozens of vendors, and no neutral way
                to know which one will actually work at a specific real place. Blueprint starts by
                answering exactly that question — and earns the right to climb the stack from there.
              </p>
              <p className="mt-4 text-lg leading-[1.7] text-ink-600">
                We begin as the neutral measurement of policy performance on a captured site, grow
                into the standard the market routes its deployment decisions through, and let the
                proprietary data that produces open the door to prediction, site-specific policies,
                and — where we can prove we're the best operator — deployment itself. Capture-first,
                provenance-true, the whole way up.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="brass" size="lg">
                  <a href="/how-it-works">
                    See how it works today
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href="/sites">Explore site packages</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Why-now stat strip */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-[88rem] px-5 sm:px-8 lg:px-10">
            <dl className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-line">
              {statStrip.map((stat, index) => (
                <div
                  key={stat.label}
                  className={
                    "flex flex-col gap-2 py-8 lg:px-8 " +
                    (index === 0 ? "lg:pl-0" : "") +
                    (index % 2 === 1 ? " sm:border-l sm:border-line lg:border-l-0" : "")
                  }
                >
                  <dt className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                    {stat.label}
                  </dt>
                  <dd className="font-mono text-[2rem] font-medium leading-none tracking-tight text-ink">
                    {stat.value}
                  </dd>
                  <p className="text-[13px] leading-snug text-ink-500">{stat.caption}</p>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Thesis editorial */}
        <section className="border-b border-line bg-white">
          <div className="mx-auto grid max-w-[88rem] items-stretch gap-4 px-5 py-12 sm:px-8 lg:grid-cols-[0.46fr_0.54fr] lg:px-10 lg:py-16">
            <MonochromeMedia
              src="/redesign/robot-hero.png"
              alt="A robot at work inside a captured real-world site (review support, not real-world proof)"
              className="min-h-[24rem] lg:min-h-[30rem]"
              imageClassName="min-h-[24rem] lg:min-h-[30rem]"
              overlay="soft"
            >
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-sm border border-white/15 bg-black/40 px-[0.6rem] py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-on-ink)]">
                Review support · not real-world proof
              </span>
            </MonochromeMedia>
            <div className="flex flex-col justify-center lg:pl-4">
              <Eyebrow tone="muted" rule>
                The thesis
              </Eyebrow>
              <blockquote className="font-editorial mt-6 text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.035em] text-ink">
                “When bodies and brains are both plentiful, the scarce, valuable thing is a
                trustworthy way to compare them on a real site — and the data that comparison
                produces.”
              </blockquote>
              <p className="mt-6 max-w-[34rem] text-[15px] leading-[1.7] text-ink-600">
                A single rigorous real-world evaluation of one policy can take thousands of rollouts
                and a hundred hours of human labor. New research from NVIDIA, Physical Intelligence,
                and leading universities — SC3-Eval and OSCAR (2026) — shows a generated world can now
                predict real policy rankings, which is exactly what a neutral, site-specific evaluator
                needs. That is where Blueprint starts, and the proprietary outcome data it generates is
                what lets us climb.
              </p>
            </div>
          </div>
        </section>

        {/* The ladder */}
        <section className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <EditorialSectionIntro
            eyebrow="The path up the stack"
            title="Five rungs, each built on the data the last one produces."
            description="We don't skip rungs. Each is a product we can sell, a moat we deepen, and the launchpad for the next. Today's product is rung one; everything above it is where the same capture-first foundation is taking us."
            className="max-w-3xl"
          />
          <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-sm border border-line bg-line">
            {rungs.map((rung) => (
              <div
                key={rung.step}
                className="grid gap-5 bg-white p-6 sm:grid-cols-[auto_1fr] sm:gap-8 lg:p-8"
              >
                <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-3">
                  <span className="font-mono text-[2.2rem] font-medium leading-none tracking-tight text-ink">
                    {rung.step}
                  </span>
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] " +
                      (rung.phase === "Today"
                        ? "border-brass-deep/30 bg-brass-deep/10 text-brass-deep"
                        : rung.phase === "Building"
                          ? "border-line bg-canvas text-ink-600"
                          : "border-line bg-canvas text-ink-400")
                    }
                  >
                    {rung.phase}
                  </span>
                </div>
                <div>
                  <h3 className="font-editorial text-[1.6rem] leading-[1.05] tracking-[-0.03em] text-ink">
                    {rung.title}
                  </h3>
                  <p className="mt-3 max-w-[46rem] text-[15px] leading-[1.7] text-ink-500">
                    {rung.body}
                  </p>
                  <p className="mt-4 flex items-start gap-2 text-[13px] leading-snug text-ink-400">
                    <span className="mt-[0.15rem] text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                      Proof boundary
                    </span>
                    <span className="text-ink-500">{rung.proof}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* The flywheel */}
        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
            <div className="max-w-3xl">
              <Eyebrow tone="muted" rule>
                Why the order compounds
              </Eyebrow>
              <p className="font-editorial mt-6 text-[clamp(1.5rem,2.6vw,2.2rem)] font-medium leading-[1.15] tracking-[-0.03em] text-ink">
                More sites captured → better, more diverse evaluations → more deployment decisions
                routed through us → more proprietary real-world outcome data → better prediction and
                data → better site-specific policies → more deployments we can credibly serve → which
                funds more capture.
              </p>
              <p className="mt-6 max-w-[44rem] text-[15px] leading-[1.7] text-ink-600">
                The first rungs are a data-acquisition strategy disguised as a product. Every decision
                we sit under is a ground-truth outcome the rest of the ladder needs — and one no
                competitor without our capture footprint can buy.
              </p>
            </div>
          </div>
        </section>

        {/* Invariants */}
        <section className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <EditorialSectionIntro
            eyebrow="What never changes"
            title="Four commitments that hold on every rung."
            description="The higher we climb, the more these matter. They are what keep the measurement trustworthy and the company honest."
            className="max-w-3xl"
          />
          <TileGrid cols={2} className="mt-8">
            {invariants.map((item) => (
              <div key={item.label} className="flex h-full flex-col gap-5 bg-white p-6 lg:p-8">
                <span className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">
                  {item.eyebrow}
                </span>
                <div>
                  <h3 className="font-editorial text-[1.7rem] leading-[1.02] tracking-[-0.035em] text-ink">
                    {item.label}
                  </h3>
                  <p className="mt-4 text-[15px] leading-[1.7] text-ink-500">{item.description}</p>
                </div>
              </div>
            ))}
          </TileGrid>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-[88rem] px-5 pb-14 sm:px-8 lg:px-10 lg:pb-20">
          <EditorialCtaBand
            eyebrow="Start at rung one"
            title="The vision is long. The product is real today."
            description="Evaluate a policy on a real captured site before you spend field time — that's where the whole climb begins."
            imageSrc="/redesign/pov/factory-conveyor.jpg"
            imageAlt="Captured factory conveyor site (review support, not real-world proof)"
            primaryHref="/contact/robot-team"
            primaryLabel="Request an evaluation"
            secondaryHref="/how-it-works"
            secondaryLabel="See how it works"
            dark
          />
        </section>
      </div>
    </>
  );
}
