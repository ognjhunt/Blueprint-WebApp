import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Database, Loader2, ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  isConfiguredScenePublicOffering,
  type ConfiguredScenePublicOfferingCard,
  type PublicSiteCatalogItem,
  type SiteWorldCard,
} from "@/data/siteWorlds";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

interface SiteDetailProps {
  params: { slug: string };
}

function requestHref(site: SiteWorldCard) {
  const query = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "task-evaluation-run",
    path: "task-evaluation-run",
    requestedOutputs: "Task Evaluation Run",
    location: site.siteName,
    source: "site-detail-live-record",
  });
  return `/contact/robot-team?${query.toString()}`;
}

function ConfiguredSceneOfferingDetail({ offering }: { offering: ConfiguredScenePublicOfferingCard }) {
  const controlsPending = offering.status === "configured_controls_pending";
  const appearanceUngraded = offering.presentation.appearanceReviewStatus === "paused_ungraded";
  return (
    <>
      <section className="mt-8 grid gap-10 border-b border-runway-line pb-12 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="runway-prov"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-runway-green" />Configured scene</span>
            <span className={`runway-chip ${controlsPending ? "runway-chip-neutral" : "border-runway-green/30 bg-runway-green/[0.1] text-runway-green"}`}>
              {controlsPending ? "Configured — controls pending" : "Evaluation ready"}
            </span>
          </div>
          <h1 className="mt-5 font-display uppercase text-5xl font-bold leading-[0.95] tracking-[0.005em] text-runway-text sm:text-6xl">{offering.title}</h1>
          <p className="mt-5 max-w-xl text-lg leading-[1.6] text-runway-body">{offering.summary}</p>
          {appearanceUngraded ? (
            <p className="mt-4 border border-runway-amber/30 bg-runway-amber/[0.1] px-3 py-2 text-sm font-semibold text-runway-amber">
              Visual review paused — appearance ungraded
            </p>
          ) : null}
          {offering.evaluationAction.enabled && offering.evaluationAction.href ? (
            <a href={offering.evaluationAction.href} className="runway-cta mt-8">
              {offering.evaluationAction.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <button type="button" disabled className="runway-cta mt-8 cursor-not-allowed opacity-60">
              {offering.evaluationAction.label}
            </button>
          )}
        </div>
        <div>
          <img
            src={offering.presentation.thumbnailUrl}
            alt={`Derived configured-scene view for ${offering.title}`}
            className="aspect-[16/10] w-full border border-runway-line object-cover"
          />
          <p className="runway-meta mt-2">Derived appearance evidence selected from the configuration run; not a captured or physical-outcome image.</p>
        </div>
      </section>

      <section className="grid gap-8 py-12 md:grid-cols-[0.34fr_0.66fr]">
        <div>
          <h2 className="font-display uppercase text-4xl font-semibold tracking-[0.005em] text-runway-text">Configured task</h2>
          <p className="mt-4 text-sm leading-[1.6] text-runway-mute">This identity is bound to the immutable configured-scene revision. Controls and policy results remain separate evidence.</p>
        </div>
        <article className="runway-panel p-5">
          <p className="text-lg font-semibold text-runway-text">{offering.task.identity.id}</p>
          <p className="mt-2 text-sm text-runway-mute">{offering.task.kind.replaceAll("_", " ")} · {offering.task.strategy.replaceAll("_", " ")}</p>
          <p className="mt-3 text-xs text-runway-faint">Scene {offering.sceneIdentity.id} · revision {offering.sceneIdentity.version}</p>
        </article>
      </section>

      <section className="flex gap-4 border-t border-runway-line pt-8">
        <ShieldCheck className="h-7 w-7 shrink-0 text-runway-signal" aria-hidden="true" />
        <p className="max-w-4xl text-sm font-semibold leading-[1.6] text-runway-mute">
          This public projection proves only that an authorized configured-scene offering was published by Pipeline. It does not prove policy execution, ranking performance, physical success, deployment safety, or safety approval.
        </p>
      </section>
    </>
  );
}

export default function SiteDetail({ params }: SiteDetailProps) {
  const [site, setSite] = useState<PublicSiteCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const controller = new AbortController();
    setLoading(true);
    setSite(null);
    fetch(`/api/site-worlds/${encodeURIComponent(params.slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "Site record not found" : `Site record unavailable (${response.status})`);
        return response.json() as Promise<PublicSiteCatalogItem>;
      })
      .then((record) => {
        if (record.dataSource !== "pipeline") throw new Error("Site record is not backed by Pipeline");
        setSite(record);
        setError(null);
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string })?.name !== "AbortError") {
          setError(reason instanceof Error ? reason.message : "Site record unavailable");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [params.slug]);

  const siteName = site
    ? isConfiguredScenePublicOffering(site) ? site.title : site.siteName
    : "Pipeline record";
  return (
    <>
      <SEO
        title={`${siteName} | Sites | Blueprint`}
        description="Inspect a Pipeline-backed workflow record that may ground a months 0–2 deployment-preparation run."
        canonical={`/sites/${params.slug}`}
        image={`https://tryblueprint.io${wamPolicyEvalAssets.hero}`}
        jsonLd={[
          webPageJsonLd({
            path: `/sites/${params.slug}`,
            name: `${siteName} capture record`,
            description: "Pipeline-backed capture and task scope for a request-specific robot evaluation.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Sites", path: "/sites" },
            { name: siteName, path: `/sites/${params.slug}` },
          ]),
        ]}
      />

      <div className="bg-runway-deep px-5 py-12 text-runway-text md:px-8 md:py-16">
        <main className="mx-auto max-w-[88rem]">
          <a href="/sites" className="inline-flex items-center gap-2 text-sm font-semibold text-runway-mute hover:text-runway-text">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sites
          </a>

          {loading ? (
            <div className="runway-panel mt-8 flex min-h-72 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-runway-signal" aria-label="Loading site record" />
            </div>
          ) : error || !site ? (
            <section className="runway-panel mt-8 p-8">
              <Database className="h-7 w-7 text-runway-signal" aria-hidden="true" />
              <h1 className="mt-5 font-display uppercase text-4xl font-semibold tracking-[0.005em] text-runway-text">This public site record is not available.</h1>
              <p className="mt-3 text-runway-mute">{error || "No Pipeline-backed record was returned."}</p>
              <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=capture-access&path=new-capture&source=site-detail-unavailable" className="runway-cta mt-7">
                Request the exact site
              </a>
            </section>
          ) : isConfiguredScenePublicOffering(site) ? (
            <ConfiguredSceneOfferingDetail offering={site} />
          ) : (
            <>
              <section className="mt-8 grid gap-10 border-b border-runway-line pb-12 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="runway-prov"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-runway-green" />Pipeline record</span>
                    {site.evaluationReadiness?.qualification_state ? (
                      <span className="runway-chip runway-chip-neutral">
                        {site.evaluationReadiness.qualification_state.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-5 font-display uppercase text-5xl font-bold leading-[0.95] tracking-[0.005em] text-runway-text sm:text-6xl">{site.siteName}</h1>
                  <p className="mt-5 max-w-xl text-lg leading-[1.6] text-runway-body">{site.summary}</p>
                  <a href={requestHref(site)} className="runway-cta mt-8">
                    Test robot fit <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
                <div>
                  <img src={wamPolicyEvalAssets.hero} alt="Illustrative humanoid robot evaluation workflow" className="aspect-[16/10] w-full border border-runway-line object-cover" />
                  <p className="runway-meta mt-2">Illustrative workflow image; not evidence from this capture record.</p>
                </div>
              </section>

              <section className="grid gap-8 py-12 md:grid-cols-[0.34fr_0.66fr]">
                <div>
                  <h2 className="font-display uppercase text-4xl font-semibold tracking-[0.005em] text-runway-text">Recorded task scope</h2>
                  <p className="mt-4 text-sm leading-[1.6] text-runway-mute">Tasks and scenarios below come from this record. Run outcomes appear only after an owned evaluation executes.</p>
                </div>
                <div className="grid gap-3">
                  {site.taskCatalog.length ? site.taskCatalog.map((task) => (
                    <article key={task.id} className="runway-panel p-5">
                      <p className="text-lg font-semibold text-runway-text">{task.taskText || task.taskId || task.id}</p>
                      {task.taskCategory ? <p className="mt-2 text-sm text-runway-mute">{task.taskCategory}</p> : null}
                    </article>
                  )) : (
                    <div className="runway-panel p-5 text-sm text-runway-mute">Task detail will be scoped with the buyer request.</div>
                  )}
                </div>
              </section>

              <section className="flex gap-4 border-t border-runway-line pt-8">
                <ShieldCheck className="h-7 w-7 shrink-0 text-runway-signal" aria-hidden="true" />
                <p className="max-w-4xl text-sm font-semibold leading-[1.6] text-runway-mute">
                  This page proves only that a current public capture record exists. It does not prove policy execution, ranking performance, deployment safety, rights beyond the stated request, or fulfillment.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
