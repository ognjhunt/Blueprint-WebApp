import { useEffect, useMemo } from "react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { getSiteWorldById, siteWorldCards } from "@/data/siteWorlds";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import { ArrowLeft, Play, ScanLine } from "lucide-react";
import { useState } from "react";

interface SiteWorldDetailProps {
  params: {
    slug: string;
  };
}

const hostedSessionSteps = [
  {
    title: "Pick the site",
    detail: "Pick the exact site you want to test so the run stays tied to one real place.",
  },
  {
    title: "Start the hosted session",
    detail: "Blueprint brings up the managed eval environment built from that site.",
  },
  {
    title: "Choose robot, sensors, task, policy/checkpoint, and scenario variation",
    detail: "Choose the robot setup, the task, the policy, and the variation you want to run.",
  },
  {
    title: "Receive the starting observation",
    detail: "The session returns the first view of the site so the policy has a starting point.",
  },
  {
    title: "Let the policy choose an action",
    detail: "The policy decides what to do next, such as move, turn, lift, grasp, or stop.",
  },
  {
    title: "Get the next observation",
    detail: "The hosted world model rolls the site forward one step and returns the next view.",
  },
  {
    title: "Repeat until success, failure, or timeout",
    detail: "Keep looping until the task succeeds, fails, or times out.",
  },
  {
    title: "Score the run, export results, and compare policies",
    detail: "Review the results, export the outputs, and compare checkpoints side by side.",
  },
];

const worldModelUseCases = [
  {
    title: "Check deployment fit",
    detail:
      "See if your robot can move through this site, see the task, and finish the job before a field visit.",
  },
  {
    title: "Make site-specific data",
    detail:
      "Render runs from this exact site, vary scenarios, and export outputs for training or debugging.",
  },
  {
    title: "Compare releases",
    detail:
      "Run the same task on the same site after each software update so regressions are easy to spot.",
  },
  {
    title: "Train and demo",
    detail:
      "Use the exact site for customer demos, operator walkthroughs, and shared remote review.",
  },
];

interface SupportBlock {
  title: string;
  items: string[];
}

export default function SiteWorldDetail({ params }: SiteWorldDetailProps) {
  const fallbackSite = getSiteWorldById(params.slug);
  const [site, setSite] = useState(fallbackSite);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params.slug]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteWorldDetail(params.slug)
      .then((item) => {
        if (!cancelled) {
          setSite(item as typeof fallbackSite);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSite(getSiteWorldById(params.slug));
        }
      });
    return () => {
      cancelled = true;
    };
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
      title: "What comes back",
      items: [
        `Starting observation from ${site.siteName}`,
        "Step-by-step observations as the run progresses",
        "Rewards or success signals for the run",
        "Rollout video for each episode",
        "Metrics and failure cases for review",
      ],
    },
    {
      title: "What teams do with this world model",
      items: [
        "Check deployment fit before travel",
        "Generate site-specific data",
        "Compare releases on the same setup",
        "Train operators or run customer demos",
      ],
    },
  ];

  return (
    <>
      <SEO
        title={`${site.siteName} | Site Worlds | Blueprint`}
        description={`${site.siteName} is a site-specific world model that robot teams can review, stream, and use for validation or data generation before a site visit.`}
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
              <p className="mt-3 text-base font-medium text-slate-500">{site.siteAddress}</p>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-[1.08rem]">
                {site.summary}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Think of it as a site-specific world model you can either license or stream.
              </p>
              <p className="mt-2 text-sm text-slate-500">{site.bestFor}</p>
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
              <p className="text-sm font-semibold text-slate-900">What this world model offers</p>
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
                Qualification happens on the site side. This page is the robot-team view: confirm
                the site, then decide whether you want the package or hosted time on that exact
                location.
              </p>
            </aside>
          </header>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <SiteWorldGraphic site={site} />
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                What teams do with it
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Practical uses for this site-specific world model.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Robot teams usually buy this to answer a real deployment question, not just to look
                at a model.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {worldModelUseCases.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          {site.deploymentReadiness ? (
            <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-950 px-5 py-6 text-slate-100 sm:px-7 sm:py-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Deployment Readiness
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Current site status</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {String(site.deploymentReadiness.qualification_state || "unknown").replaceAll("_", " ")}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Benchmark coverage: {site.deploymentReadiness.benchmark_coverage_status || "missing"}
                    {typeof site.deploymentReadiness.benchmark_task_count === "number"
                      ? ` · ${site.deploymentReadiness.benchmark_task_count} tasks`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Export readiness: {site.deploymentReadiness.export_readiness_status || "missing"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Refresh state: {site.deploymentReadiness.recapture_required ? "Needs refresh" : site.deploymentReadiness.recapture_status || "Current"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Capability envelope</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    <li>Embodiment: {site.deploymentReadiness.capability_envelope?.embodiment_type || "Not specified"}</li>
                    <li>
                      Minimum path width: {site.deploymentReadiness.capability_envelope?.minimum_path_width_m ?? "N/A"} m
                    </li>
                    <li>
                      Maximum reach: {site.deploymentReadiness.capability_envelope?.maximum_reach_m ?? "N/A"} m
                    </li>
                    <li>
                      Sensors: {(site.deploymentReadiness.capability_envelope?.sensor_requirements || []).join(", ") || "Not specified"}
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Rights and compliance</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    <li>
                      Export entitlements: {(site.deploymentReadiness.rights_and_compliance?.export_entitlements || []).join(", ") || "Review required"}
                    </li>
                    <li>
                      Consent scope: {(site.deploymentReadiness.rights_and_compliance?.consent_scope || []).join(", ") || "Review required"}
                    </li>
                    <li>
                      Retention policy: {site.deploymentReadiness.rights_and_compliance?.retention_policy || "Not specified"}
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Evidence gaps</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {(site.deploymentReadiness.missing_evidence || []).length > 0 ? (
                      site.deploymentReadiness.missing_evidence?.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No flagged evidence gaps on the current readiness package.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

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
                  Start with the site-world package.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This gives your team the site-specific world-model inputs for this workflow area.
                  Use it when you want the package for internal review, integration work, or your
                  own stack. It is the asset layer, not the hosted session layer.
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
                  href={scenePackage.actionHref}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  {scenePackage.actionLabel}
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
                  Stream this world model in a hosted test room.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Hosted Sessions are for the practical questions robot teams actually ask: can
                  this robot handle this lane, what fails first, and how do releases compare on the
                  same setup? Use them for repeatable validation, site-specific data generation,
                  and remote demos without another site visit. They are not final deployment proof
                  and not a full contact-accurate manipulation simulator.
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
                  Self-serve starting rate
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{hostedSessions.priceLabel}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  That rate is for self-serve hosted eval time. Managed, priority, or higher-touch
                  sessions are scoped separately when the work needs more support or fidelity.
                </p>
                <a
                  href={hostedSessions.actionHref}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {hostedSessions.actionLabel}
                </a>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Simple walkthrough
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                How this works
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Think of this as a streamed world model for one real site and one real robot
                question.
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
              A team picks {site.siteName}, chooses {site.sampleRobot}, and tests{" "}
              {site.samplePolicy} on the task to {site.sampleTask.toLowerCase()}. They run a few
              variations like {site.scenarioVariants.slice(0, 2).join(" and ").toLowerCase()} to
              see whether the lane is viable, what breaks first, and whether the checkpoint is
              ready for a real visit. Then they review the rollout video, metrics, failure cases,
              and exported data.
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
