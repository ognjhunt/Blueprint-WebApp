import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentTimeline } from "@/components/site/DeploymentTimeline";
import { DeploymentWorkPackage } from "@/components/site/DeploymentWorkPackage";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { robotTeamHero, robotTeamValue } from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const joinHref = "/signup/business?buyerType=robot_team&source=for-robot-teams";

const teamReceives = [
  "A task dossier with the workflow, objects, timing, exceptions, systems, and acceptance criteria",
  "A permissioned testbed your team can evaluate without receiving unrestricted site files",
  "Robot-fit results, unhandled edge cases, integration burden, and the onsite questions still open",
] as const;

export default function ForRobotTeams() {
  return (
    <>
      <SEO
        title="Pre-deployment opportunities for robot teams | Blueprint"
        description="Start from a captured workflow, secure testbed, acceptance criteria, and robot-fit evaluation instead of repeating months of site discovery."
        canonical="/for-robot-teams"
        jsonLd={[
          webPageJsonLd({
            path: "/for-robot-teams",
            name: "Blueprint for robot teams",
            description:
              "Captured site tasks and standard pre-deployment evaluations for robot providers.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For robot teams", path: "/for-robot-teams" },
          ]),
        ]}
      />

      <PageHero
        eyebrow={robotTeamHero.eyebrow}
        title={robotTeamHero.title}
        body={robotTeamHero.body}
        chips={robotTeamHero.chips}
        ctaHref={joinHref}
        ctaLabel="Join the robot network"
        secondaryHref="/how-it-works"
        secondaryLabel="See the four steps"
        imageSrc="/generated/humanoid-readiness-2026-06-03/humanoid-warehouse-readiness-hero.png"
        imageAlt="Illustrative humanoid material-handling workflow"
        imageCaption="Illustrative task context · physical proof still required"
        routeTrace
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Why use Blueprint"
            title="Keep scarce deployment engineers on qualified work."
            lede="A promising lead is not a deployable task. Blueprint does the common discovery and evaluation work before your team commits to the site."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 lg:grid-cols-3">
            {robotTeamValue.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.06}>
                <article className="h-full bg-ink p-6 lg:p-8">
                  <span className="font-mono text-micro text-brass">
                    0{index + 1}
                  </span>
                  <h2 className="mt-5 text-title-m font-semibold tracking-tight text-white">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-ink-300">
                    {item.body}
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
            eyebrow="What arrives before you do"
            title="The information your deployment team normally has to build itself."
          />
          <Reveal className="mt-14">
            <DeploymentWorkPackage />
          </Reveal>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
            {teamReceives.map((item) => (
              <li
                key={item}
                className="flex gap-3 bg-white p-6 text-body-s leading-7 text-ink-600"
              >
                <Check
                  className="mt-1 h-4 w-4 shrink-0 text-action"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="Your place in the timeline"
            title="Blueprint prepares. Your team integrates and proves."
            lede="The handoff is meant to make onsite work narrower and better informed—not to claim that a virtual test deployed your robot."
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
              Core access
            </p>
            <h2 className="mt-3 text-[clamp(2.2rem,4vw,4rem)] font-semibold leading-none tracking-[-0.05em]">
              Join, match, and run standard evaluations free.
            </h2>
          </div>
          <a
            href={joinHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-ink-900"
          >
            Join as a robot team{" "}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <ClosingCta
        eyebrow="Before field engineering"
        title="Start with a task your team can inspect."
        body="Browse permission-matched opportunities, submit your robot specification, and use the common testbed before deciding whether to pursue the onsite proof of concept."
        primaryHref={joinHref}
        primaryLabel="Join the robot network"
        secondaryHref="/pricing"
        secondaryLabel="See what stays free"
        imageSrc="/redesign/pov/machine-tending.jpg"
        imageAlt="Machine-tending workflow prepared for robot evaluation"
      />
    </>
  );
}
