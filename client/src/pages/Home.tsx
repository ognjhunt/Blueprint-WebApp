import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { OfferComparison } from "@/components/site/OfferComparison";
import { ProofModule } from "@/components/site/ProofModule";
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
import { publicDemoHref, publicDemoLabel } from "@/lib/marketingProof";
import { analyticsEvents } from "@/lib/analytics";
import { resolveExperimentVariant } from "@/lib/experiments";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

const heroSignals = [
  "Start from one real customer facility instead of a generic sim scene.",
  "Choose the site package when your team wants all the data in its own stack.",
  "Choose hosted evaluation when your team wants Blueprint to run the site now.",
];

const speedLedSignals = [
  "24-hour scoping on the exact customer facility and workflow lane.",
  "48-hour evidence packaging with capture provenance kept intact.",
  "72-hour hosted review delivery for the same real site your team cares about.",
  "One fixed-SLA path instead of a vague multi-week services process.",
];

const definitionCards = [
  {
    title: "World model",
    body: worldModelDefinition,
  },
  {
    title: "Site package",
    body: sitePackageDefinition,
  },
  {
    title: "Hosted evaluation",
    body: hostedEvaluationDefinition,
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
  const [heroVariant, setHeroVariant] = useState<"proof_led" | "speed_led">("proof_led");

  useEffect(() => {
    let cancelled = false;

    void resolveExperimentVariant("home_hero_variant", ["proof_led", "speed_led"]).then(
      (variant) => {
        if (cancelled) {
          return;
        }
        const resolved = variant === "speed_led" ? "speed_led" : "proof_led";
        setHeroVariant(resolved);
        analyticsEvents.experimentExposure("home_hero_variant", resolved, "page_load");
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SEO
        title="Blueprint | Train Your Robot On The Exact Customer Site"
        description="Blueprint helps robot teams buy site packages and hosted evaluation on exact customer facilities, built from real indoor capture."
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
              {heroVariant === "speed_led" ? (
                <>
                  <h1 className="mt-5 text-[3.3rem] font-semibold tracking-tight text-slate-950 sm:text-[4.2rem] sm:leading-[0.95]">
                    Your robot trains on the real customer site in 72 hours.
                  </h1>
                  <p className="mt-4 max-w-3xl text-[1.05rem] leading-8 text-slate-600">
                    Blueprint captures the exact facility, packages the site evidence cleanly,
                    and delivers a hosted review path without breaking capture provenance.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mt-5 text-[3.3rem] font-semibold tracking-tight text-slate-950 sm:text-[4.2rem] sm:leading-[0.95]">
                    Train your robot on the exact customer site before you visit.
                  </h1>
                  <p className="mt-4 max-w-3xl text-[1.05rem] leading-8 text-slate-600">
                    Blueprint captures real customer facilities and turns them into digital environments
                    your team can test against before showing up.
                  </p>
                </>
              )}
              <p className="mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                <span className="font-semibold text-slate-900">Plain-English version:</span> a
                world model is a site-specific digital environment built from real capture of one
                facility and one workflow lane.
              </p>
              <div className="mt-5 grid gap-2.5">
                {(heroVariant === "speed_led" ? speedLedSignals : heroSignals).map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={publicDemoHref}
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {publicDemoLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/exact-site-hosted-review"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Request hosted evaluation
                </a>
              </div>
              <a
                href="mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <Mail className="h-4 w-4" />
                Prefer email? Send a short brief.
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              What Blueprint is
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Three things Blueprint sells.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Capture the real site, package it cleanly, then let the buyer run its own stack
              or use Blueprint-hosted runtime.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {definitionCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
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
          <OfferComparison
            eyebrow="What teams get"
            title="Start with the path that matches the work."
            description="Buy the site package if your team wants all the site data in its own stack. Request hosted evaluation if your team wants Blueprint to run the exact site, compare checkpoints, and export results before the real visit."
          />
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
                Clear enough for a skeptical buyer.
              </h2>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
                {companyTrustItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
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
                  Review governance and privacy
                </a>
                <a href="/sample-deliverables" className="text-sm font-semibold text-slate-900 transition hover:text-slate-700">
                  See deliverables and technical reference
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
