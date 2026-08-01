import { SEO } from "@/components/SEO";
import { StatRow } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  MediaSplit,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  aboutHero,
  aboutMission,
  aboutPrinciples,
  aboutStats,
  closingCta,
} from "@/data/publicSiteCopy";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyScreeningValue,
} from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=about";
const runCtaHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=about-cta";

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why Blueprint exists: turning one real site-task into a maintained testbed and an inspectable decision, with rights, privacy, and provenance kept visible."
        canonical="/about"
        jsonLd={[
          webPageJsonLd({
            path: "/about",
            name: "About Blueprint",
            description:
              "Why Blueprint exists: turning one real site-task into a maintained testbed and an inspectable decision, with rights, privacy, and provenance kept visible.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={aboutHero.eyebrow}
        title={aboutHero.title}
        body={aboutHero.body}
        chips={aboutHero.chips}
        ctaHref={runHref}
        ctaLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
        imageSrc="/redesign/robot-hero.png"
        imageAlt="Robot at work inside a captured real-world site"
        imageCaption="Review support · not real-world proof"
      />

      {/* Definitional properties of the service, not traction figures. */}
      <Band tone="ink">
        <Inner className="py-16 lg:py-20">
          <StatRow tiles={aboutStats} onInk />
        </Inner>
      </Band>

      <Band tone="canvas" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="What we are for"
            title="One real job, made testable before the week onsite."
            lede={robotPolicyScreeningValue}
          />
          <Reveal className="mt-10">
            <p className="max-w-[62ch] text-[15.5px] leading-[1.8] text-ink-500">
              {robotPolicyEvaluationBeachhead}
            </p>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="white">
        <Inner className="py-20 lg:py-28">
          <MediaSplit
            imageSrc="/redesign/pov/warehouse-tote.jpg"
            imageAlt="Warehouse aisle where a real site-task is captured"
            imageCaption="Where the answer has to hold"
            flip
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              The mission
            </p>
            <blockquote className="mt-6 font-display text-[clamp(1.8rem,3.2vw,2.9rem)] font-medium leading-[1.08] tracking-[-0.035em] text-ink-900">
              “{aboutMission.quote}”
            </blockquote>
            <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.75] text-ink-600">
              {aboutMission.body}
            </p>
            <p className="mt-6 max-w-[46ch] border-t border-line-strong pt-5 text-[14px] leading-[1.7] text-ink-500">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em] text-brass-deep">
                Why one service
              </span>
              {aboutMission.note}
            </p>
          </MediaSplit>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="What we hold to"
            title="Five rules that decide what a result may claim."
            lede="These are the constraints behind every page on this site: what gets shown, what gets labelled, and what never gets claimed regardless of how well it would sell."
          />
          <NoteCards items={aboutPrinciples} className="mt-12" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title="Bring one exact site-task."
        body="Browse captured sites as possible testbed inputs, or come straight to us when you already know the decision."
        primaryHref={runCtaHref}
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/sites"
        secondaryLabel="Explore captured sites"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Captured warehouse conveyor site"
      />
    </>
  );
}
