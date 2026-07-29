import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { CinematicMedia, Reveal, Stagger } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  MonoNote,
  Section,
  SectionHead,
  StatementList,
} from "@/components/site/publicSections";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyScreeningValue,
} from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const structuralFacts = [
  { value: "1", label: "Customer-facing product", caption: "A Task Evaluation Run. Nothing else is sold." },
  { value: "5", label: "Ways a run can end", caption: "Positive · negative · partial · abstained · next test named" },
  { value: "0", label: "Backend choices you make", caption: "Method selection is per claim, and it is ours" },
  { value: "∞", label: "Times a claim can be traced", caption: "Capture, rights, version, digest, permitted use" },
];

const principles = [
  {
    title: "Capture first. Claim later.",
    body: "Every testbed starts as one real place, walked and recorded with timestamps, poses, device metadata, and a rights record. Derived geometry, simulation, and generated media never outrank the capture they came from.",
  },
  {
    title: "An estimate is never a guarantee.",
    body: "We report what the evidence supports inside a stated envelope. Partial decisions and explicit abstention are first-class results, and no run promises field success, deployment, or safety approval.",
  },
  {
    title: "Generated frames are review support.",
    body: "Simulated and generated material helps a team read a run. It is labelled as review support everywhere it appears, and it is never shown as real-world proof.",
  },
  {
    title: "Rights travel with the evidence.",
    body: "Consent, privacy, restricted areas, and permitted use live on the artifact and the manifest — not in marketing copy, and not in someone's memory of a conversation.",
  },
  {
    title: "The expensive resource is field time.",
    body: "Everything we build exists to make one real site usable before that clock starts, and to be honest about the questions only a real robot on a real floor can settle.",
  },
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why Blueprint exists: turning one real site-task into a maintained testbed and bounded decision with rights, privacy, and provenance kept visible."
        canonical="/about"
        jsonLd={[
          webPageJsonLd({
            path: "/about",
            name: "About Blueprint",
            description:
              "Why Blueprint exists: turning one real site-task into a maintained testbed and bounded decision with rights, privacy, and provenance kept visible.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.12]" />
        <div className="relative mx-auto max-w-[88rem] px-5 pb-16 pt-16 sm:px-8 lg:px-10 lg:pb-20 lg:pt-24">
          <Reveal y="1.75rem" className="max-w-[52rem]">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                About Blueprint
              </span>
            </div>
            <h1 className="mt-7 font-display text-[clamp(2.5rem,5.2vw,4.8rem)] font-medium leading-[0.99] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              The gap between a good demo and a real building.
            </h1>
            <p className="mt-7 max-w-[40rem] text-[1.0625rem] leading-[1.75] text-white/70">
              {robotPolicyScreeningValue}
            </p>
            <p className="mt-4 max-w-[40rem] text-[15px] leading-[1.75] text-white/55">
              {robotPolicyEvaluationBeachhead}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=about"
                className="inline-flex h-12 items-center justify-center gap-2 bg-brass px-6 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors duration-200 hover:bg-brass-lit"
              >
                Request a Task Evaluation Run
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/how-it-works"
                className="inline-flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] transition-colors duration-200 hover:border-white/50 hover:bg-white/5"
              >
                See how it works
              </a>
            </div>
          </Reveal>
        </div>

        {/* Structural facts — countable properties of the product, not traction. */}
        <div className="relative border-t border-white/10">
          <Stagger className="mx-auto grid max-w-[88rem] gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4" step={70}>
            {structuralFacts.map((fact) => (
              <div key={fact.label} className="bg-ink px-5 py-8 sm:px-8">
                <p className="font-mono text-[2.5rem] font-medium leading-none text-brass">
                  {fact.value}
                </p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                  {fact.label}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-white/60">{fact.caption}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* -------------------------------------------------------- mission ---- */}
      <Section tone="white" innerClassName="py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
          <Reveal>
            <CinematicMedia
              src="/redesign/robot-hero.png"
              alt="Robot at work inside a captured real-world site"
              caption="Review support · not real-world proof"
              meta="Illustrative"
              wash="soft"
              className="aspect-[4/5] w-full sm:aspect-[4/3] lg:aspect-[4/5]"
            />
          </Reveal>

          <Reveal delay={100}>
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass-deep/60" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-ink-500">
                The mission
              </span>
            </div>
            <blockquote className="mt-7 font-display text-[clamp(1.8rem,3.2vw,2.9rem)] font-medium leading-[1.08] tracking-[-0.035em] text-ink-900">
              “The expensive part of robotics is field time. Our job is to make one real site
              usable before that clock starts — with proof a serious team can actually read.”
            </blockquote>
            <p className="mt-7 max-w-[34rem] text-[15px] leading-[1.75] text-ink-600">
              Blueprint was built by Nijel Hunt around the gap between an interesting robotics demo
              and serious, site-specific deployment work. Background in robotics simulation, 3D
              capture, and deployment operations.
            </p>
            <div className="mt-7">
              <MonoNote label="Why one product">
                Every extra SKU is another chance to sell a claim the evidence cannot carry. One
                run, scoped to one decision, is harder to fake and easier to check.
              </MonoNote>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ----------------------------------------------------- principles ---- */}
      <Section tone="canvas">
        <SectionHead
          index="01"
          eyebrow="What we hold to"
          title={
            <>
              Five rules that decide what we <Accent>refuse to say</Accent>.
            </>
          }
          lede="These are the constraints behind every page on this site: what gets shown, what gets labelled, and what never gets claimed regardless of how well it would sell."
          align="wide"
        />
        <div className="mt-12">
          <StatementList items={principles} />
        </div>
      </Section>

      <BigCta
        eyebrow="Next step"
        title={
          <>
            Bring one exact site-task. <br className="hidden sm:block" />
            We will tell you what it can prove.
          </>
        }
        body="Browse captured sites as possible testbed inputs, or come straight to us when the decision question is already known."
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Captured warehouse conveyor site"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=about-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/sites"
        secondaryLabel="Explore captured sites"
      />
    </>
  );
}
