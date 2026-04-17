import { SEO } from "@/components/SEO";
import { LaunchMapTeaser } from "@/components/site/LaunchMapTeaser";
import { ProofModule } from "@/components/site/ProofModule";
import { WhenNotToBuyModule } from "@/components/site/WhenNotToBuyModule";
import {
  companyTrustItems,
  hostedEvaluationDefinition,
  hostedEvaluationOutputs,
  illustrativeLabel,
  sessionHourDefinition,
  sitePackageDefinition,
  sitePackageIncludes,
  worldModelDefinition,
} from "@/data/marketingDefinitions";
import { exactSiteScopingCallPath } from "@/lib/booking";
import { publicDemoHref, publicProofAssets } from "@/lib/marketingProof";
import { ArrowRight } from "lucide-react";

const definitionCards = [
  {
    title: "World model",
    body: worldModelDefinition,
    imageSrc: "/illustrations/home-world-model-card.png",
    imageAlt:
      "Illustration of a site-specific digital environment built from real indoor capture and camera trajectory data.",
  },
  {
    title: "Site package",
    body: sitePackageDefinition,
    imageSrc: "/illustrations/home-site-package-card.png",
    imageAlt:
      "Illustration of a structured site package with walkthrough media, geometry, metadata, and rights artifacts.",
  },
  {
    title: "Hosted evaluation",
    body: hostedEvaluationDefinition,
    imageSrc: "/illustrations/home-hosted-evaluation-card.png",
    imageAlt:
      "Illustration of a hosted evaluation workspace comparing checkpoints on one exact site and exporting results.",
  },
];

const workflowCards = [
  {
    title: "Deployment fit",
    body: "Use one exact site to see whether the robot can localize, fit, see the task, and finish the job before the expensive visit starts.",
  },
  {
    title: "Site-specific data",
    body: "Generate exports tied to the real facility instead of trying to recover that context later.",
  },
  {
    title: "Checkpoint comparison",
    body: "Run the same lane after each autonomy update so regressions show up on the exact environment that matters.",
  },
];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-slate-200 [mask-image:radial-gradient(80%_80%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern id="home-grid" width={36} height={36} x="50%" y={-1} patternUnits="userSpaceOnUse">
          <path d="M.5 36V.5H36" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#home-grid)" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Test The Exact Site Before Deployment"
        description="Blueprint helps robot teams shrink the demo-to-deployment gap with site-specific world models, data packages, and hosted evaluation built from real indoor capture."
        canonical="/"
      />

      <div className="relative min-h-screen overflow-hidden bg-stone-50 text-slate-900">
        <DotPattern />

        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                For Robot Teams
              </p>
              <h1 className="mt-5 text-[3.3rem] font-semibold tracking-tight text-slate-950 sm:text-[4.2rem] sm:leading-[0.95]">
                Test the exact site before deployment.
              </h1>
              <p className="mt-4 max-w-3xl text-[1.05rem] leading-8 text-slate-600">
                Blueprint turns a real facility into a site-specific world model, data package,
                and hosted test environment so your team can answer deployment questions before
                site visits, pilot spend, and rollout work begin.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                One exact site. One workflow lane. Package access and hosted evaluation tied back
                to the same real capture record.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={publicDemoHref}
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View Sample Site
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={exactSiteScopingCallPath}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Book Hosted Review
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Need a custom scope instead?{" "}
                <a href="/contact?persona=robot-team" className="font-semibold text-slate-900 hover:underline">
                  Talk to Blueprint.
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <LaunchMapTeaser />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Buying paths
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Choose the path that matches the work.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Start with the exact-site proof object, then choose the package, hosted evaluation,
              or a request-scoped program tied to that same source record.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {definitionCards.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="overflow-hidden rounded-[1.1rem] border border-slate-200 bg-slate-50">
                  <img
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    className="aspect-[16/10] w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-3 text-base leading-7 text-slate-700">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <ProofModule
            eyebrow="Visual proof"
            title="See the real site first, then inspect the product around it."
            description="The public demo listing is the first trust check. It shows that the site is real, that the package is grounded to that site, and that the hosted path stays tied to the same facility."
            caption="This reel shows current capture and product surfaces. Additional views are added as the product develops."
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Proof trail
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Inspect the public proof before you contact anyone.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Start with the sample listing, then move into the runtime still and representative
              artifact layout. The point is to let a serious buyer inspect the proof path before
              deciding whether the package or hosted route is the right next step.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {publicProofAssets.map((asset) => (
              <a
                key={asset.title}
                href={asset.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {asset.label}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{asset.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{asset.detail}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img
                src="/illustrations/site-package-diagram.svg"
                alt="Illustrative diagram of the site package structure"
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {illustrativeLabel}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">What goes into the site package</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {sitePackageIncludes.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img
                src="/illustrations/export-bundle-diagram.svg"
                alt="Illustrative diagram of hosted evaluation outputs"
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sample artifact
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">What comes back from hosted evaluation</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {hostedEvaluationOutputs.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {sessionHourDefinition}
            </p>
          </article>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              How teams use it
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Use one exact site to answer one expensive question earlier.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {workflowCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Trust and governance
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                What a serious buyer should be able to verify at a glance.
              </h2>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
                {companyTrustItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Proof depth",
                    body: "Public demo, sample artifact layouts, and listing-specific export availability should be visible before inquiry.",
                  },
                  {
                    title: "Rights class",
                    body: "Usage, sharing, and export boundaries should be attached to the listing rather than hidden behind a sales call.",
                  },
                  {
                    title: "Freshness",
                    body: "Capture recency and refresh state should be legible so a buyer knows whether the site is current enough for review.",
                  },
                  {
                    title: "Restrictions",
                    body: "Redaction, retention, restricted zones, and hosted-access limits should be easy to read.",
                  },
                ].map((card) => (
                  <article key={card.title} className="rounded-2xl border border-slate-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-stone-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Company references</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Blueprint handles capture, packaging, licensing, and hosted access for
                site-specific world models. It does not promise deployment success. It makes the
                real site available earlier.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <a href="/about" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  Read about Blueprint
                </a>
                <a href="/governance" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  Review governance and trust
                </a>
                <a href="/sample-deliverables" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  See deliverables and technical reference
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6 lg:px-8">
          <WhenNotToBuyModule />
        </div>
      </div>
    </>
  );
}
