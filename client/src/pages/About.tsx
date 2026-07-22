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
import {
  robotPolicyScreeningValue,
  robotPolicyEvaluationBeachhead,
} from "@/data/robotPolicyEvaluationClaims";

const statStrip = [
  { label: "Episodes / run", value: "100–500", caption: "Per policy evaluation" },
  { label: "Evidence layers", value: "3", caption: "Capture · run · owner proof" },
  { label: "Core service", value: "1", caption: "Task Evaluation Run — ranks which policy to field-test first" },
  { label: "Proof boundary", value: "Always on", caption: "Review support, not proof" },
];

const principles = [
  {
    eyebrow: "Principle 01",
    label: "Every run starts from one real captured place.",
    description:
      "The captured site is the ground truth, not the world model. We package the capture truth — where, when, how, and under what rights — before any evaluation output is shown. Post-Training Data Packages come off the same captures later, as a follow-on, never the front door.",
  },
  {
    eyebrow: "Principle 02",
    label: "Estimates, never guarantees.",
    description:
      "Policy comparison is framed as rank fidelity and predicted success on captured tasks. We do not promise field deployment or guaranteed outcomes.",
  },
  {
    eyebrow: "Principle 03",
    label: "Generated media is review support.",
    description:
      "Simulated and generated frames help a team read a run. They are always labeled as review support — never presented as real-world proof.",
  },
  {
    eyebrow: "Principle 04",
    label: "Rights stay attached.",
    description:
      "Rights, privacy, provenance, and hosted-access boundaries travel with the listing and manifest, not with marketing copy.",
  },
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why Blueprint exists: turning one real facility into capture-backed policy evaluation runs with rights, privacy, and provenance kept visible."
        canonical="/about"
        jsonLd={[
          webPageJsonLd({
            path: "/about",
            name: "About Blueprint",
            description:
              "Why Blueprint exists: turning one real facility into capture-backed policy evaluation runs with rights, privacy, and provenance kept visible.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />

      <div className="bg-canvas text-ink">
        {/* Hero — prose, max-w-prose (44rem) */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
            <div className="max-w-prose">
              <Eyebrow tone="brass" rule>
                About Blueprint
              </Eyebrow>
              <h1 className="font-editorial mt-6 text-[clamp(2.6rem,5vw,4.2rem)] font-medium leading-[0.96] tracking-[-0.045em] text-ink">
                Blueprint runs one service: a Task Evaluation Run that ranks your candidate
                robot policies on a captured real-site task envelope.
              </h1>
              <p className="mt-6 text-lg leading-[1.7] text-ink-600">
                {robotPolicyScreeningValue}
              </p>
              <p className="mt-4 text-lg leading-[1.7] text-ink-600">
                {robotPolicyEvaluationBeachhead}
              </p>
              <p className="mt-4 text-[15px] leading-[1.7] text-ink-500">
                We frame policy comparison as rank fidelity and an estimate — never a
                guarantee, a safety certification, or a deployment-readiness claim. We are
                not a generic AI marketplace or a model demo, so the next test is chosen on
                evidence instead of assumption.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="brass" size="lg">
                  <a href="/contact/robot-team">
                    Request an evaluation run
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href="/sites">Explore site packages</a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <a href="/how-it-works">See how it works</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 4-col stat strip — mono values, hairline-separated */}
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

        {/* Mission editorial — image + Newsreader pull quote */}
        <section className="border-b border-line bg-white">
          <div className="mx-auto grid max-w-[88rem] items-stretch gap-4 px-5 py-12 sm:px-8 lg:grid-cols-[0.46fr_0.54fr] lg:px-10 lg:py-16">
            <MonochromeMedia
              src="/redesign/robot-hero.png"
              alt="Robot at work inside a captured real-world site (review support, not real-world proof)"
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
                The mission
              </Eyebrow>
              <blockquote className="font-editorial mt-6 text-[clamp(1.8rem,3vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.035em] text-ink">
                “The expensive part of robotics is field time. Our job is to make one real
                site usable before that clock starts — with proof a serious team can
                actually read.”
              </blockquote>
              <p className="mt-6 max-w-[34rem] text-[15px] leading-[1.7] text-ink-600">
                Blueprint was built by Nijel Hunt around the gap between an interesting
                robotics demo and serious, site-specific deployment work. Background in
                robotics simulation, 3D capture, and deployment operations.
              </p>
            </div>
          </div>
        </section>

        {/* Principles — 2-col TileGrid */}
        <section className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <EditorialSectionIntro
            eyebrow="What we hold to"
            title="Four principles that keep the product honest."
            description="These are the rules that decide what Blueprint shows, what it labels, and what it refuses to claim."
            className="max-w-3xl"
          />
          <TileGrid cols={2} className="mt-8">
            {principles.map((item) => (
              <div key={item.label} className="flex h-full flex-col gap-5 bg-white p-6 lg:p-8">
                <span className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">
                  {item.eyebrow}
                </span>
                <div>
                  <h3 className="font-editorial text-[1.7rem] leading-[1.02] tracking-[-0.035em] text-ink">
                    {item.label}
                  </h3>
                  <p className="mt-4 text-[15px] leading-[1.7] text-ink-500">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </TileGrid>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-[88rem] px-5 pb-14 sm:px-8 lg:px-10 lg:pb-20">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Bring one exact site and rank the policies you'd otherwise field-test blind."
            description="Request a Task Evaluation Run when the readiness question is already known, or browse site packages first to read the proof style."
            imageSrc="/redesign/pov/factory-conveyor.jpg"
            imageAlt="Captured warehouse conveyor site (review support, not real-world proof)"
            primaryHref="/contact/robot-team"
            primaryLabel="Request an evaluation run"
            secondaryHref="/sites"
            secondaryLabel="Explore site packages"
            dark
          />
        </section>
      </div>
    </>
  );
}
