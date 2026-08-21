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
import { ArrowRight, LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";

const runHref =
  "/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-site-operators";
const runCtaHref =
  "/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-site-operators-cta";
const pilotOpportunityHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=for-site-operators";

const pilotOpportunitySteps = [
  {
    title: "You choose visibility",
    body: "Keep the dossier private, approve an anonymized summary, or name the exact robot-team work emails allowed to inspect it.",
    Icon: LockKeyhole,
  },
  {
    title: "Blueprint checks the opportunity",
    body: "The review can advance the task, ask for missing evidence, identify a better robot class, or conclude the economics do not support a pilot.",
    Icon: ScanSearch,
  },
  {
    title: "Robot teams see only qualified work",
    body: "Nothing enters their private feed until capture, access, rights, dossier, and evaluation gates are recorded as passed.",
    Icon: ShieldCheck,
  },
] as const;

const pilotAccessLadder = [
  ["01", "Anonymized opportunity", "Operator-approved summary; identity and exact facility stay withheld."],
  ["02", "Standardized benchmark", "Object ranges, metrics, environment class, and expected throughput."],
  ["03", "Controlled evaluation", "Robot teams submit approved policies or containers; site-model files remain hosted."],
  ["04", "Shortlisted package", "Detailed layouts, integrations, and process data only for operator-approved teams."],
  ["05", "Separately negotiated training rights", "Site adaptation, improvement retention, and general training are negotiated separately."],
] as const;

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
        ctaLabel="Scope a site benchmark"
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
          <SectionHeader
            index="02"
            eyebrow="Private pilot opportunities"
            title="Bring robot teams a qualified workflow, not another cold lead."
            lede="Submit one real workflow for private qualification. Blueprint packages the conditions, economics, integration boundaries, acceptance criteria, and permissions inside the same Task Evaluation Run."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-3">
            {pilotOpportunitySteps.map(({ title, body, Icon }, index) => (
              <Reveal key={title} delay={index * 0.06}>
                <article className="h-full bg-white p-6 lg:p-7">
                  <Icon className="h-5 w-5 text-brass-deep" strokeWidth={1.75} aria-hidden="true" />
                  <h3 className="mt-5 text-title-m font-semibold tracking-tight text-ink-900">{title}</h3>
                  <p className="mt-3 text-body-s leading-7 text-ink-500">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 border-y border-line py-8">
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">Progressive access · no twin download</p>
            <ol className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {pilotAccessLadder.map(([index, title, body]) => (
                <li key={index} className="border-l border-line-strong pl-4">
                  <span className="font-mono text-micro text-ink-400">{index}</span>
                  <h3 className="mt-2 text-body-s font-semibold text-ink-900">{title}</h3>
                  <p className="mt-2 text-caption leading-6 text-ink-500">{body}</p>
                </li>
              ))}
            </ol>
          </div>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Site", "Common site model and one standardized baseline assessment."],
              ["Robot team", "Its incremental evaluation runs, parameter sweeps, and proprietary testing."],
              ["Training", "Scoped separately according to who requests exclusivity and who retains reusable value."],
              ["Commercial handoff", "Terms may be negotiated directly; capacity, milestones, acceptance tests, and payment state count only when recorded by their owner systems."],
            ].map(([term, detail]) => (
              <div key={term} className="bg-white p-5">
                <dt className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">{term}</dt>
                <dd className="mt-2 text-caption leading-6 text-ink-500">{detail}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-col items-start gap-4 border-l-2 border-brass-deep pl-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[48rem] space-y-2 text-body-s leading-7 text-ink-600">
              <p>
              A simulation candidate is still only a candidate. Deployment readiness requires the
              selected robot, its actual interfaces, and authoritative physical evidence.
              </p>
              <p>
                The site funds the common site model and baseline assessment. Robot teams fund their
                incremental evaluation compute; training compute is scoped separately according to
                who keeps the reusable capability.
              </p>
            </div>
            <a
              href={pilotOpportunityHref}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xs bg-ink px-5 text-body-s font-semibold text-white transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-deep"
            >
              Prepare a pilot opportunity
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <MediaSplit
            imageSrc="/redesign/pov/cold-storage.jpg"
            imageAlt="A cold-storage aisle where conditions define what a robot can do"
            imageCaption="Conditions are part of the task"
            className="overflow-x-clip"
          >
            <div>
              <p className="inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-brass-deep">
                <span aria-hidden="true" className="h-px w-6 shrink-0 bg-current opacity-50" />
                03 · What you keep
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
            index="04"
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
            index="05"
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
          <SectionHeader index="06" eyebrow="Where we stop" title="The limits, stated plainly." onInk />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start with the job"
        title={closingCta.title}
        body="Describe the real workflow, the conditions, the failures you will not accept, and the terms of access. Candidates can be linked whenever they exist."
        primaryHref={runCtaHref}
        primaryLabel="Scope a site benchmark"
        secondaryHref="/governance"
        secondaryLabel="Review rights and privacy"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="An inspection bench in a working facility"
      />
    </>
  );
}
