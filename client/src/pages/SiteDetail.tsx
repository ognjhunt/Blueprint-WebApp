import { useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";
import { RobotEvalJobRequestPanel } from "@/components/site/RobotEvalJobRequestButton";
import { breadcrumbJsonLd, productJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { getSiteLibrarySite } from "@/data/siteLibrary";

interface SiteDetailProps {
  params: {
    slug: string;
  };
}

function buildTaskPackHref(siteName: string) {
  return `/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&location=${encodeURIComponent(siteName)}&source=site-detail`;
}

export default function SiteDetail({ params }: SiteDetailProps) {
  const site = getSiteLibrarySite(params?.slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params?.slug]);

  if (!site) {
    return (
      <div className="bg-white px-5 py-20 text-slate-950 md:px-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8">
          <a href="/sites" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Back to Sites
          </a>
          <h1 className="mt-6 text-4xl font-semibold">Site not found.</h1>
          <a
            href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=capture-access&path=new-capture&source=sites-detail-not-found"
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Request new site
          </a>
        </div>
      </div>
    );
  }

  const taskPackHref = buildTaskPackHref(site.name);

  return (
    <>
      <SEO
        title={`${site.name} | Sites | Blueprint`}
        description={`${site.name} is a captured task-pack profile for Blueprint Policy Evaluation Runs.`}
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
            name: `${site.name} Policy Evaluation Run`,
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

      <div className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-10 md:grid-cols-[0.9fr_1.1fr] md:items-center md:px-8 md:py-14">
            <div>
              <a href="/sites" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sites
              </a>
              <h1 className="mt-6 max-w-[10ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                A captured place to test robots.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                {site.name}
              </p>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                This package gives every policy the same task.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={taskPackHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Use this task pack
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="#task-pack"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  View tasks
                </a>
              </div>
            </div>

            <img
              src={site.thumbnailSrc}
              alt={site.thumbnailAlt}
              className="aspect-[16/10] w-full rounded-lg border border-slate-200 object-cover"
              loading="eager"
            />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-8 md:grid-cols-3 md:px-8">
            {[
              ["Place", `${site.siteType} · ${site.locationLabel}`],
              ["Task", site.taskPacks[0] || "Task pack"],
              ["Ready", site.readiness],
            ].map(([title, body]) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white p-5">
                <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h2 className="mt-4 text-3xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="task-pack" className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 md:grid-cols-[0.34fr_0.66fr] md:px-8">
          <div>
            <h2 className="text-4xl font-semibold leading-tight">Task pack</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Pick one task. Run each policy against the same setup.
            </p>
          </div>
          <div className="grid gap-3">
            {site.taskPackNotes.map((note, index) => (
              <div key={note} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-lg font-semibold text-slate-950">
                  {site.taskPacks[index] || `Task ${index + 1}`}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
              </div>
            ))}
          </div>
        </section>

        {site.robotEvalPublication ? (
          <section className="border-y border-slate-200 bg-slate-50">
            <div className="mx-auto max-w-[88rem] px-5 py-10 md:px-8">
              <h2 className="text-4xl font-semibold leading-tight">
                Start from this package.
              </h2>
              <div className="mt-6">
                <RobotEvalJobRequestPanel site={site} source="site-detail" />
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-5 px-5 py-8 md:grid-cols-[auto_1fr] md:items-start md:px-8">
            <ShieldCheck className="h-8 w-8 text-blue-300" aria-hidden="true" />
            <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-300">
              Generated clips help review. They are not real-world proof. Access,
              rights, and validation stay scoped per request.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
