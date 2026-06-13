import { useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { RobotEvalJobRequestPanel } from "@/components/site/RobotEvalJobRequestButton";
import { breadcrumbJsonLd, productJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  getSiteLibrarySite,
  type AccessStatus,
  type ReadinessStatus,
  type SiteLibrarySite,
} from "@/data/siteLibrary";

interface SiteDetailProps {
  params: {
    slug: string;
  };
}

const readinessTone: Record<ReadinessStatus, string> = {
  "Ready to evaluate": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Capture complete": "border-blue-200 bg-blue-50 text-blue-900",
  "Needs review": "border-amber-200 bg-amber-50 text-amber-950",
  "Coming soon": "border-slate-200 bg-slate-100 text-slate-700",
};

const accessTone: Record<AccessStatus, string> = {
  "Open sample": "border-emerald-200 bg-white text-emerald-900",
  "Request-gated": "border-[#c7a775]/50 bg-[#fff7e3] text-[#624313]",
  "Private / NDA": "border-slate-300 bg-slate-100 text-slate-800",
  "Operator approval required": "border-amber-200 bg-amber-50 text-amber-950",
};

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center border px-3 py-1.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function DetailTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-black/10 bg-[#f8f6f1] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{value}</p>
    </div>
  );
}

function IncludedList({ site }: { site: SiteLibrarySite }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {site.included.map((item) => (
        <div key={item} className="flex gap-3 border border-black/10 bg-white p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <p className="text-sm leading-6 text-slate-700">{item}</p>
        </div>
      ))}
    </div>
  );
}

export default function SiteDetail({ params }: SiteDetailProps) {
  const site = getSiteLibrarySite(params?.slug);

  useEffect(() => {
    if (window.location.hash === "#simulator-evaluation") {
      window.requestAnimationFrame(() => {
        document.getElementById("simulator-evaluation")?.scrollIntoView({ block: "start" });
      });
      return;
    }
    window.scrollTo(0, 0);
  }, [params?.slug]);

  if (!site) {
    return (
      <div className="bg-[#f5f1e8] px-4 py-20 text-slate-950 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl border border-black/10 bg-white p-8">
          <a href="/sites" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Back to Sites
          </a>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em]">Site not found</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This site is not in the public library. Browse the current mock library or request a new site capture.
          </p>
          <a
            href="/contact?persona=robot-team&buyerType=robot_team&interest=capture-access&path=new-capture&source=sites-detail-not-found"
            className="mt-7 inline-flex min-h-11 items-center justify-center bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Request new site
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${site.name} | Sites | Blueprint`}
        description={`${site.name} is a captured-site profile for robot-team Task Evaluation Run requests.`}
        canonical={`/sites/${site.slug}`}
        image={site.thumbnailSrc}
        type="product"
        jsonLd={[
          webPageJsonLd({
            path: `/sites/${site.slug}`,
            name: `${site.name} site profile`,
            description: `${site.summary} ${site.evidenceLine}.`,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Sites", path: "/sites" },
            { name: site.name, path: `/sites/${site.slug}` },
          ]),
          productJsonLd({
            path: `/sites/${site.slug}`,
            name: `${site.name} Task Evaluation Run`,
            description: site.summary,
            image: site.thumbnailSrc,
            category: "Captured site for robot evaluation",
            properties: [
              { name: "Site type", value: site.siteType },
              { name: "Region", value: site.region },
              { name: "Readiness", value: site.readiness },
              { name: "Access", value: site.access },
            ],
          }),
        ]}
      />

      <div className="bg-[#f5f1e8] text-slate-950">
        <section className="border-b border-black/10 bg-[#0d0d0b] text-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.48fr_0.52fr] lg:px-10 lg:py-10">
            <div className="flex min-h-[34rem] flex-col justify-end">
              <a href="/sites" className="inline-flex items-center gap-2 text-sm font-semibold text-white/62 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Back to Sites
              </a>
              <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c7a775]">
                Captured site
              </p>
              <h1 className="mt-4 max-w-[11ch] text-[3.3rem] font-semibold leading-[0.9] tracking-[-0.05em] sm:text-[5rem]">
                {site.name}
              </h1>
              <p className="mt-5 max-w-[38rem] text-base leading-7 text-white/75">
                {site.summary}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <StatusBadge label={site.readiness} className={readinessTone[site.readiness]} />
                <StatusBadge label={site.access} className={accessTone[site.access]} />
                <StatusBadge label={`${site.siteType} · ${site.locationLabel}`} className="border-white/20 bg-white/10 text-white" />
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#simulator-evaluation"
                  className="inline-flex min-h-12 items-center justify-center bg-[#c7a775] px-5 text-sm font-semibold text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
                >
                  Run simulator evaluation
                </a>
                <a
                  href="/proof"
                  className="inline-flex min-h-12 items-center justify-center border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  See proof details
                </a>
              </div>
            </div>

            <div className="overflow-hidden border border-white/15 bg-white/5 p-3">
              <img
                src={site.thumbnailSrc}
                alt={site.thumbnailAlt}
                className="h-full min-h-[31rem] w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px bg-black/10 px-4 py-6 sm:px-6 md:grid-cols-4 lg:px-10">
            <DetailTile label="Scenarios" value={`${site.scenarioCount.toLocaleString()} ready`} />
            <DetailTile label="Region" value={site.region} />
            <DetailTile label="Evidence" value={site.evidenceLine} />
            <DetailTile label="Access" value={site.access} />
            {site.robotEvalPublication ? (
              <>
                <DetailTile label="Publication" value="Publication package complete" />
                <DetailTile label="Thresholds" value="Thresholds attached" />
                <DetailTile
                  label="Episode specs"
                  value={site.robotEvalPublication.preflightSummary.episodeSpecLabel}
                />
                <DetailTile
                  label="CPU preflight"
                  value={site.robotEvalPublication.preflightSummary.cpuSimulatorLabel}
                />
                <DetailTile
                  label="GPU handoff"
                  value={site.robotEvalPublication.preflightSummary.gpuHandoffLabel}
                />
              </>
            ) : null}
          </div>
        </section>

        {site.robotEvalPublication ? (
          <section className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-10">
            <RobotEvalJobRequestPanel site={site} source="site-detail" />
          </section>
        ) : null}

        <section className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.36fr_0.64fr] lg:px-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Task packs
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
              Available task packs
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              These are the tasks a robot team can scope into a Task Evaluation Run request for this site.
            </p>
          </div>
          <div className="grid gap-3">
            {site.taskPackNotes.map((note, index) => (
              <div key={note} className="grid gap-3 border border-black/10 bg-white p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8f6f1]">
                  <ClipboardList className="h-4 w-4 text-slate-950" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {site.taskPacks[index] || "Task pack"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{note}</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Pack {index + 1}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.42fr_0.58fr] lg:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Included
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                What is included
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The detail page is intentionally compact: enough for a robot team to decide whether this site is worth requesting.
              </p>
            </div>
            <IncludedList site={site} />
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Capture summary",
                body: site.captureSummary,
              },
              {
                icon: CheckCircle2,
                title: "Robot POV",
                body: site.robotPovSummary,
              },
              {
                icon: ShieldCheck,
                title: "Geometry/access",
                body: site.geometrySummary,
              },
            ].map((item) => (
              <div key={item.title} className="border border-black/10 bg-white p-5">
                <item.icon className="h-5 w-5 text-slate-950" />
                <p className="mt-4 text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {site.robotEvalPublication ? (
          <section className="border-y border-black/10 bg-white">
            <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.36fr_0.64fr] lg:px-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Pipeline status
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                  Manifest-backed request status
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  These statuses come from synced Pipeline artifact slots or fixtures.
                  They help scope a request before any GPU simulator or owner-system policy run.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(site.pipelineManifestStatuses || []).map((item) => (
                  <div key={item.label} className="border border-black/10 bg-[#f8f6f1] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                      {item.summary}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      Retry: {item.retrySummary}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Failure: {item.failureSummary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-black/10 bg-[#0d0d0b] text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.5fr_0.5fr] lg:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7a775]">
                Evidence boundary
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                A site page is not a run result.
              </h2>
            </div>
            <div className="space-y-5 text-sm leading-7 text-white/72">
              <p>
                This page helps a robot team choose a site. A Task Evaluation Run still needs request review, access confirmation, task scope, robot profile, threshold context, and owner-system proof before any stronger claim is made.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="#simulator-evaluation"
                  className="inline-flex min-h-11 items-center justify-center bg-[#c7a775] px-4 text-sm font-semibold text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
                >
                  Run simulator evaluation
                </a>
                <a
                  href="/sites"
                  className="inline-flex min-h-11 items-center justify-center border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Browse all sites
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
