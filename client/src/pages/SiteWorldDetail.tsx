import { useEffect, useMemo } from "react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { getSiteWorldById, siteWorldCards } from "@/data/siteWorlds";
import { ArrowLeft, Play, ScanLine } from "lucide-react";

interface SiteWorldDetailProps {
  params: {
    slug: string;
  };
}

const hostedSessionSteps = [
  {
    title: "Pick the site",
    detail:
      "Start with the exact site you want to evaluate so the whole run stays tied to one real place.",
  },
  {
    title: "Open a hosted session for that site",
    detail:
      "Blueprint brings up the managed eval environment built from that site so your team does not have to run the environment stack itself.",
  },
  {
    title: "Choose robot, sensors, task, policy/checkpoint, and scenario variation",
    detail:
      "Set the robot setup, what it should do, which policy you want to test, and which variation you want to run first.",
  },
  {
    title: "Receive the starting observation",
    detail:
      "The session returns the first view of the site so the policy begins from a concrete starting point.",
  },
  {
    title: "Let the policy choose an action",
    detail:
      "Your policy reads that observation and decides what to do next, such as move, turn, lift, grasp, or stop.",
  },
  {
    title: "Let the hosted world model produce the next observation",
    detail:
      "The hosted session rolls the site forward one step and returns what the robot would see after that action.",
  },
  {
    title: "Repeat until success, failure, or timeout",
    detail:
      "Keep looping through observe, act, and update until the task ends or your run reaches the stop condition.",
  },
  {
    title: "Score the run, export results, and compare policies",
    detail:
      "Review the outcome, collect videos and metrics, then compare checkpoints or scenario variants side by side.",
  },
];

interface SupportBlock {
  title: string;
  items: string[];
}

export default function SiteWorldDetail({ params }: SiteWorldDetailProps) {
  const site = getSiteWorldById(params.slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params.slug]);

  const relatedSites = useMemo(() => {
    if (!site) return [];
    return siteWorldCards.filter((item) => item.id !== site.id).slice(0, 3);
  }, [site]);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Site world not found</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The site world you are looking for does not exist in this placeholder catalog.
        </p>
        <a
          href="/site-worlds"
          className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to Site Worlds
        </a>
      </div>
    );
  }

  const scenePackage = site.packages[0];
  const hostedSessions = site.packages[1];
  const supportBlocks: SupportBlock[] = [
    {
      title: "What goes in",
      items: [
        site.sampleRobot,
        site.runtime,
        site.sampleTask,
        site.samplePolicy,
        site.scenarioVariants.join(", "),
      ],
    },
    {
      title: "What the session returns",
      items: [
        `Starting observation from ${site.siteName}`,
        "Step-by-step observations as the run progresses",
        "Rewards or success signals for the run",
        "Rollout video for each episode",
        "Metrics and failure cases for review",
      ],
    },
    {
      title: "What teams do with it",
      items: [
        "Benchmark checkpoints against each other",
        "Test clutter, lighting, and placement changes",
        "Export trajectories and summary results",
        "Decide pass, fix, or escalate",
      ],
    },
  ];

  return (
    <>
      <SEO
        title={`${site.siteName} | Site Worlds | Blueprint`}
        description={`${site.siteName} shows the site asset package first and the hosted eval flow second so robot teams can understand how testing would work on that site.`}
        canonical={`/site-worlds/${site.id}`}
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <a
            href="/site-worlds"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Site Worlds
          </a>

          <header className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {site.industry}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {site.siteName}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-[1.08rem]">
                {site.summary}
              </p>
              <p className="mt-3 text-sm text-slate-500">{site.bestFor}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  {site.taskLane}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  {site.runtime}
                </span>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-slate-900">What robot teams are reviewing</p>
              <div className="mt-4 space-y-2.5">
                <a
                  href="#scene-package"
                  className="block rounded-2xl border border-slate-300 bg-white p-4 transition hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">Scene Package</p>
                  <p className="mt-1 text-sm text-slate-600">{scenePackage.priceLabel}</p>
                </a>
                <a
                  href="#hosted-sessions"
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">Hosted Sessions</p>
                  <p className="mt-1 text-sm text-slate-600">{hostedSessions.priceLabel}</p>
                </a>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Qualification is for the site side. This page is the robot-team view: review the
                site asset first, then the hosted eval option for the same site.
              </p>
            </aside>
          </header>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <SiteWorldGraphic site={site} />
          </section>

          <section
            id="scene-package"
            className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7"
          >
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-slate-700" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Scene Package
              </p>
            </div>
            <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Start with the site asset package.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This package gives your team the site-specific inputs for this workflow area. It
                  is the asset layer, not the hosted eval layer.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {scenePackage.deliverables.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Likely buyer
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {scenePackage.payerLabel.replace("Likely buyer: ", "")}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Starting price
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{scenePackage.priceLabel}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Use this when your team wants the captured site package for review, integration,
                  or downstream internal work.
                </p>
                <a
                  href="/contact?interest=data-licensing"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Request Scene Package
                </a>
              </div>
            </div>
          </section>

          <section
            id="hosted-sessions"
            className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-6 sm:px-7 sm:py-7"
          >
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-slate-700" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Hosted Sessions
              </p>
            </div>
            <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Use the hosted eval layer built from the site.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Hosted Sessions are for robot-team testing, checkpoint comparison, stress
                  testing, and rollout review on this exact site. They are not the raw scan, not a
                  physics-certified sim, and not final deployment proof.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {hostedSessions.deliverables.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                  {site.startStates.map((state) => (
                    <div
                      key={state}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                    >
                      {state}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Likely buyer
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {hostedSessions.payerLabel.replace("Likely buyer: ", "")}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Starting rate
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{hostedSessions.priceLabel}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Use this when your team wants Blueprint to host the eval environment and return
                  rollout outputs instead of handing you only the site package.
                </p>
                <a
                  href="/contact?interest=evaluation-package"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Request Hosted Sessions
                </a>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Step by step
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                How a robot team would use this
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The simplest picture is a temporary hosted copy of one real site where your team
                can test a policy loop, score it, and compare runs.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {hostedSessionSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            {supportBlocks.map((block) => (
              <article
                key={block.title}
                className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h2 className="text-xl font-bold text-slate-900">{block.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-900 px-5 py-6 text-white sm:px-7 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Simple example
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Example run for {site.siteName}
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-200">
              A team picks {site.siteName}, chooses {site.sampleRobot}, and sets the task to{" "}
              {site.sampleTask.toLowerCase()}. They run {site.samplePolicy} against a few scenario
              variations like {site.scenarioVariants.slice(0, 2).join(" and ").toLowerCase()}. The
              hosted session returns the starting view, lets the policy act step by step, and then
              gives the team rollout video, metrics, and failure cases so they can decide whether
              the policy passes, needs work, or should move to a stricter next stage.
            </p>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Related sites
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {relatedSites.map((relatedSite) => (
                <a
                  key={relatedSite.id}
                  href={`/site-worlds/${relatedSite.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {relatedSite.industry}
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{relatedSite.siteName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {relatedSite.taskLane}
                  </p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
