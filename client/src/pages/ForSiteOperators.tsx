import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import { OutcomeSpectrum, RunLifecycleRail } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  FullBleedMedia,
  Inner,
  MediaSplit,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  closingCta,
  homeLifecycle,
  homeLimits,
  homeOutcomes,
  siteOperatorControls,
  siteOperatorHero,
  siteOperatorNeeds,
} from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-site-operators";
const runCtaHref =
  "/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-site-operators-cta";

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="Task Evaluation Runs for site operators | Blueprint"
        description="Turn one real job at your site into a maintained testbed and an inspectable decision, with the missing evidence and physical requirements named."
        canonical="/for-site-operators"
        jsonLd={[
          webPageJsonLd({
            path: "/for-site-operators",
            name: "Task Evaluation Runs for site operators",
            description:
              "The same Task Evaluation Run robot teams use, explained for the people who own the site.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For site operators", path: "/for-site-operators" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={siteOperatorHero.eyebrow}
        title={siteOperatorHero.title}
        body={siteOperatorHero.body}
        chips={siteOperatorHero.chips}
        ctaHref={runHref}
        ctaLabel="Request a Task Evaluation Run"
        secondaryHref="/governance"
        secondaryLabel="Rights and privacy"
        imageSrc="/redesign/pov/loading-dock.jpg"
        imageAlt="A real loading dock of the kind a site-task is defined from"
        imageCaption="Illustrative task context"
        routeTrace
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Same service, different entry"
            title="You should not have to become an evaluation expert to get an answer."
            lede="Robot teams arrive with candidates and a threshold. You can arrive with a job and a set of conditions. Both end up in the same run."
            onInk
          />
          <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {siteOperatorNeeds.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.06}>
                <div className="border-t border-white/15 pt-6">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-brass">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 font-display text-[1.5rem] font-medium leading-[1.15] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-3.5 max-w-[44ch] text-[14.5px] leading-[1.72] text-ink-300">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <MediaSplit
            imageSrc="/redesign/pov/cold-storage.jpg"
            imageAlt="A cold-storage aisle where conditions define what a robot can do"
            imageCaption="Conditions are part of the task"
          >
            <div>
              <p className="inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-brass-deep">
                <span aria-hidden="true" className="h-px w-6 shrink-0 bg-current opacity-50" />
                02 · What you keep
              </p>
              <h2 className="mt-6 max-w-[24ch] font-display text-[clamp(2rem,3.6vw,3.1rem)] font-medium leading-[1.03] tracking-[-0.035em] text-ink-900">
                Your floor, your rules — written down before anything is captured.
              </h2>
              <p className="mt-6 max-w-[46ch] text-[15.5px] leading-[1.75] text-ink-600">
                Restricted areas are excluded before capture rather than redacted
                afterwards, and what a run's evidence may be used for is recorded
                per artifact. Nobody tests on your floor without a separate,
                explicit yes.
              </p>
              <dl className="mt-9 divide-y divide-line">
                {siteOperatorControls.map((control) => (
                  <div key={control.label} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] sm:gap-6">
                    <dt className="text-[13px] font-semibold text-ink-900">{control.label}</dt>
                    <dd className="text-[13.5px] leading-[1.65] text-ink-500">{control.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </MediaSplit>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="How a run moves"
            title="One real task in. One inspectable answer out."
            lede="Candidates are optional at the start. The task and the terms are what make a run scopeable."
          />
          <div className="mt-16">
            <RunLifecycleRail stages={homeLifecycle} />
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="What comes back"
            title="Including the answer nobody likes to sell."
            lede="If the evidence will not carry the decision, the run says so and names what would. That is the version of this service worth buying twice."
          />
          <div className="mt-14">
            <OutcomeSpectrum bands={homeOutcomes} />
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="The learning loop is joined, not typed">
                When physical evidence is needed, it is tied back to the exact
                decision and testbed version it belongs to. A note typed into a
                form is not evidence and cannot recalibrate a method.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="Safety stays yours">
                Nothing a run returns is a safety approval or a certification for
                operating a robot at your site. Virtual evidence is never
                presented as a physical guarantee.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <FullBleedMedia
        src="/redesign/pov/retail-backroom.jpg"
        alt="A retail backroom being assessed as a robot work area"
        eyebrow="Before a vendor arrives"
        title="Know what the honest answer is before someone pitches you one."
        body="A maintained testbed of your own task means every candidate that shows up later is measured against the same job, the same conditions, and the same threshold — yours."
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader index="05" eyebrow="Where we stop" title="The limits, stated plainly." onInk />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start with the job"
        title={closingCta.title}
        body="Describe the real workflow, the conditions, the failures you will not accept, and the terms of access. Candidates can be linked whenever they exist."
        primaryHref={runCtaHref}
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/governance"
        secondaryLabel="Review rights and privacy"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="An inspection bench in a working facility"
      />
    </>
  );
}
