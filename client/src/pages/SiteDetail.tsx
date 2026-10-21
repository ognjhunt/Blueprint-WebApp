import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  isConfiguredScenePublicOffering,
  type ConfiguredScenePublicOfferingCard,
  type PublicSiteCatalogItem,
  type SiteWorldCard,
} from "@/data/siteWorlds";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { taskStageLabels } from "@/types/taskBrowse";

interface SiteDetailProps {
  params: { slug: string };
}

/**
 * The only states a visitor sees. Review, approval and qualification states are
 * internal workflow (who accepted what, which AI review disagreed) and stay off
 * the public page; each maps to the same small vocabulary the job library uses.
 */
export function publicSiteStageLabel(item: PublicSiteCatalogItem): string {
  if (isConfiguredScenePublicOffering(item)) {
    return item.status === "evaluation_ready" ? taskStageLabels.ready : taskStageLabels.preparing;
  }
  return "Recorded job";
}

/** The robot-team application, told which site the team asked about. */
export function robotTeamRequestHref(siteLabel: string, source: string) {
  const query = new URLSearchParams({ site: siteLabel, source });
  return `/contact/robot-team?${query.toString()}#robot-team-access`;
}

function siteRequestHref(site: SiteWorldCard) {
  return robotTeamRequestHref(site.siteName, "site-detail-live-record");
}

function ConfiguredSceneOfferingDetail({ offering }: { offering: ConfiguredScenePublicOfferingCard }) {
  return (
    <>
      <p className="ms-eyebrow">Job library · <span className="ms-site-stage">{publicSiteStageLabel(offering)}</span></p>
      <h1>{offering.title}</h1>
      <p>{offering.summary}</p>
      {offering.evaluationAction.enabled && offering.evaluationAction.href ? (
        <p className="ms-site-cta">
          <a href={offering.evaluationAction.href} className="ms-button">
            {offering.evaluationAction.label} <ArrowRight size={18} aria-hidden="true" />
          </a>
        </p>
      ) : (
        <p className="ms-site-cta">
          <a href={robotTeamRequestHref(offering.title, "site-detail-configured-scene")} className="ms-button">
            Ask to evaluate this job <ArrowRight size={18} aria-hidden="true" />
          </a>
        </p>
      )}
      <figure className="ms-site-figure">
        <img
          src={offering.presentation.thumbnailUrl}
          alt={`Rendered view of the simulated scene for ${offering.title}`}
          width={1600}
          height={1000}
        />
        <figcaption className="ms-imagery-caption">
          A view rendered from the simulated scene, not a photo of the site or of a robot run. Some visual details may differ from the real site.
        </figcaption>
      </figure>

      <section>
        <h2>The task</h2>
        <p>The task is tied to this exact version of the scene. Evaluation results are reported separately.</p>
        <dl className="ms-legal-rows">
          <div><dt>Task</dt><dd>{offering.task.kind.replaceAll("_", " ")}</dd></div>
          <div><dt>Scene version</dt><dd>{offering.sceneIdentity.version}</dd></div>
        </dl>
      </section>

      <section>
        <h2>What this page shows</h2>
        <p>
          This page shows only that the site approved publishing this scene. It is not a result: it says nothing about how any robot performed, how candidates rank, or whether a deployment would be safe.
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
        if (!response.ok) throw new Error(response.status === 404 ? "We could not find this site." : "This site is not available right now. Try again shortly.");
        return response.json() as Promise<PublicSiteCatalogItem>;
      })
      .then((record) => {
        // Only records published from real site work are shown; a static fixture never is.
        if (record.dataSource !== "pipeline") throw new Error("This site record is not a published site.");
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
    : "Site record";
  return (
    <>
      <SEO
        title={`${siteName} | Sites | Blueprint`}
        description="A recurring job shared for compatible-system assessment and delivery planning. Access and pilot terms require site approval."
        canonical={`/sites/${params.slug}`}
        image={`https://tryblueprint.io${wamPolicyEvalAssets.hero}`}
        jsonLd={[
          webPageJsonLd({
            path: `/sites/${params.slug}`,
            name: `${siteName} capture record`,
            description: "The recorded job at a real site, for robot evaluation.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Sites", path: "/sites" },
            { name: siteName, path: `/sites/${params.slug}` },
          ]),
        ]}
      />

      <article className="ms-legal ms-container ms-site-detail" aria-busy={loading}>
        <a href="/sites" className="ms-back">
          <ArrowLeft size={16} aria-hidden="true" /> Back to the job library
        </a>

        {loading ? (
          <>
            <h1>Loading this job</h1>
            <p role="status">Loading the site record…</p>
          </>
        ) : error || !site ? (
          <>
            <h1>This public site record is not available.</h1>
            <p>{error || "We could not load this site."}</p>
            <p className="ms-site-cta">
              <a href={robotTeamRequestHref(params.slug, "site-detail-unavailable")} className="ms-button">
                Request the exact site
              </a>
            </p>
          </>
        ) : isConfiguredScenePublicOffering(site) ? (
          <ConfiguredSceneOfferingDetail offering={site} />
        ) : (
          <>
            <p className="ms-eyebrow">Job library · <span className="ms-site-stage">{publicSiteStageLabel(site)}</span></p>
            <h1>{site.siteName}</h1>
            <p>{site.summary}</p>
            <p className="ms-site-cta">
              <a href={siteRequestHref(site)} className="ms-button">
                Ask to evaluate this job <ArrowRight size={18} aria-hidden="true" />
              </a>
            </p>
            <figure className="ms-site-figure">
              <img src={wamPolicyEvalAssets.hero} alt="Illustrative humanoid robot evaluation workflow" width={1600} height={1000} />
              <figcaption className="ms-imagery-caption">Illustrative workflow image; not evidence from this capture record.</figcaption>
            </figure>

            <section>
              <h2>Recorded job scope</h2>
              <p>The jobs below come from the site. Evidence appears only when an authorized assessment has produced a result.</p>
              {site.taskCatalog.length ? (
                <ul>
                  {site.taskCatalog.map((task) => (
                    <li key={task.id}>
                      <span>{task.taskText || task.taskId || task.id}</span>
                      {task.taskCategory ? <span className="ms-site-task-category"> · {task.taskCategory}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Detailed scope and access are agreed with the site before evaluation or a delivery proposal.</p>
              )}
            </section>

            <section>
              <h2>What this page shows</h2>
              <p>
                This page shows only that the site has recorded its job. It is not a result: it says nothing about how any robot performed, how candidates rank, or whether a deployment would be safe.
              </p>
            </section>
          </>
        )}
      </article>
    </>
  );
}
