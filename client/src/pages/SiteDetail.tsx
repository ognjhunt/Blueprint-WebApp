import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Database, Loader2, ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import type { SiteWorldCard } from "@/data/siteWorlds";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

interface SiteDetailProps {
  params: { slug: string };
}

function requestHref(site: SiteWorldCard) {
  const query = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "policy-evaluation-run",
    path: "policy-evaluation-run",
    requestedOutputs: "Policy Evaluation Run",
    location: site.siteName,
    source: "site-detail-live-record",
  });
  return `/contact/robot-team?${query.toString()}`;
}

export default function SiteDetail({ params }: SiteDetailProps) {
  const [site, setSite] = useState<SiteWorldCard | null>(null);
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
        return response.json() as Promise<SiteWorldCard>;
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

  const siteName = site?.siteName || "Captured site record";
  return (
    <>
      <SEO
        title={`${siteName} | Sites | Blueprint`}
        description="Inspect a Pipeline-backed capture record for a Blueprint Policy Evaluation Run."
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

      <div className="bg-white px-5 py-12 text-slate-950 md:px-8 md:py-16">
        <main className="mx-auto max-w-[88rem]">
          <a href="/sites" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sites
          </a>

          {loading ? (
            <div className="mt-8 flex min-h-72 items-center justify-center rounded-lg border border-slate-200">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" aria-label="Loading site record" />
            </div>
          ) : error || !site ? (
            <section className="mt-8 rounded-lg border border-slate-200 p-8">
              <Database className="h-7 w-7 text-blue-600" aria-hidden="true" />
              <h1 className="mt-5 text-4xl font-semibold">This public site record is not available.</h1>
              <p className="mt-3 text-slate-600">{error || "No Pipeline-backed record was returned."}</p>
              <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=capture-access&path=new-capture&source=site-detail-unavailable" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
                Request the exact site
              </a>
            </section>
          ) : (
            <>
              <section className="mt-8 grid gap-10 border-b border-slate-200 pb-12 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-900">Pipeline record</span>
                    {site.evaluationReadiness?.qualification_state ? (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
                        {site.evaluationReadiness.qualification_state.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-5 text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">{site.siteName}</h1>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{site.summary}</p>
                  <a href={requestHref(site)} className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">
                    Request evaluation <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
                <div>
                  <img src={wamPolicyEvalAssets.hero} alt="Illustrative humanoid robot evaluation workflow" className="aspect-[16/10] w-full rounded-lg border border-slate-200 object-cover" />
                  <p className="mt-2 text-xs text-slate-500">Illustrative workflow image; not evidence from this capture record.</p>
                </div>
              </section>

              <section className="grid gap-8 py-12 md:grid-cols-[0.34fr_0.66fr]">
                <div>
                  <h2 className="text-4xl font-semibold">Recorded task scope</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">Tasks and scenarios below come from this record. Run outcomes appear only after an owned evaluation executes.</p>
                </div>
                <div className="grid gap-3">
                  {site.taskCatalog.length ? site.taskCatalog.map((task) => (
                    <article key={task.id} className="rounded-lg border border-slate-200 p-5">
                      <p className="text-lg font-semibold">{task.taskText || task.taskId || task.id}</p>
                      {task.taskCategory ? <p className="mt-2 text-sm text-slate-600">{task.taskCategory}</p> : null}
                    </article>
                  )) : (
                    <div className="rounded-lg border border-slate-200 p-5 text-sm text-slate-600">Task detail will be scoped with the buyer request.</div>
                  )}
                </div>
              </section>

              <section className="flex gap-4 border-t border-slate-200 pt-8">
                <ShieldCheck className="h-7 w-7 shrink-0 text-blue-600" aria-hidden="true" />
                <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-600">
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
