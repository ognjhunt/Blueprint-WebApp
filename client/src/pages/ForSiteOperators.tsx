import { ArrowRight, LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentComparison } from "@/components/site/DeploymentComparison";
import { DeploymentTimeline } from "@/components/site/DeploymentTimeline";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { siteOperatorHero } from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const submitHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=for-site-operators";

const siteSteps = [
  {
    title: "Show the job",
    body: "Upload phone video, plans, measurements, throughput, exceptions, and a guided scan when available.",
    Icon: ScanSearch,
  },
  {
    title: "Set the rules",
    body: "Choose restricted areas, allowed uses, approved viewers, and whether physical access is ever permitted.",
    Icon: LockKeyhole,
  },
  {
    title: "Review qualified fit",
    body: "See which robot categories fit, what remains unknown, and which teams merit deeper access or an onsite visit.",
    Icon: ShieldCheck,
  },
] as const;

const accessLevels = [
  [
    "01",
    "Anonymous summary",
    "Task type, region, operating window, and rough volume.",
  ],
  [
    "02",
    "Standard benchmark",
    "Object ranges, task metrics, environment class, and expected throughput.",
  ],
  [
    "03",
    "Controlled evaluation",
    "Robot teams run approved tests; the site model stays hosted by Blueprint.",
  ],
  [
    "04",
    "Shortlisted package",
    "Detailed layouts and integrations only for operator-approved teams.",
  ],
] as const;

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="Prepare a site for robot deployment | Blueprint"
        description="Explain one real workflow once, keep control of the site data, and let qualified robot teams test fit before they visit."
        canonical="/for-site-operators"
        jsonLd={[
          webPageJsonLd({
            path: "/for-site-operators",
            name: "Blueprint for site operators",
            description:
              "A private workflow package and Task Evaluation Run for prospective robot deployments.",
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
        ctaHref={submitHref}
        ctaLabel="Submit a site task"
        secondaryHref="/governance"
        secondaryLabel="See data controls"
        imageSrc="/redesign/pov/loading-dock.jpg"
        imageAlt="A loading-dock workflow prepared for robot evaluation"
        imageCaption="One workflow · not the whole facility"
        routeTrace
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="What you do"
            title="Show the job. Set the rules. Review the fit."
            lede="You do not need to choose a robot, simulator, or evaluation stack before starting."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 lg:grid-cols-3">
            {siteSteps.map(({ title, body, Icon }, index) => (
              <Reveal key={title} delay={index * 0.06}>
                <article className="h-full bg-ink p-6 lg:p-8">
                  <Icon className="h-5 w-5 text-brass" aria-hidden="true" />
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-white">
                    {title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-ink-300">
                    {body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Why not do it yourself"
            title="Stop rebuilding the same opportunity for every vendor."
            lede="One controlled work package makes robot-team answers easier to compare and keeps the site from handing raw facility data to every interested company."
          />
          <Reveal className="mt-14">
            <DeploymentComparison />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="Progressive access"
            title="Robot teams learn more only when the opportunity earns it."
            lede="Evaluation rights are not training rights. The underlying site model is not a download."
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
            {accessLevels.map(([number, title, body]) => (
              <li key={number} className="bg-white p-6">
                <span className="font-mono text-micro text-action">
                  {number}
                </span>
                <h2 className="mt-4 text-title-m font-semibold tracking-tight text-ink-900">
                  {title}
                </h2>
                <p className="mt-3 text-caption leading-6 text-ink-500">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="Where Blueprint stops"
            title="The robot provider still owns onsite deployment."
          />
          <Reveal className="mt-14">
            <DeploymentTimeline compact />
          </Reveal>
        </Inner>
      </Band>

      <section className="bg-action text-white">
        <div className="mx-auto flex max-w-[94rem] flex-col gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-white/70">
              Site price to start
            </p>
            <h2 className="mt-3 text-[clamp(2.2rem,4vw,4rem)] font-semibold leading-none tracking-[-0.05em]">
              Submit and screen the workflow for $0.
            </h2>
          </div>
          <a
            href={submitHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-ink-900"
          >
            Submit a site task{" "}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <ClosingCta
        eyebrow="Start with the job"
        title="You do not need a robot vendor to begin."
        body="Describe the workflow, operating conditions, success criteria, and access rules. Blueprint will tell you what can be screened now and what evidence is still missing."
        primaryHref={submitHref}
        primaryLabel="Submit a site task"
        secondaryHref="/pricing"
        secondaryLabel="See the success fee"
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="Inspection workflow prepared as a private robot opportunity"
      />
    </>
  );
}
